use hound::{WavSpec, WavWriter};
use lazy_static;
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use swift_rs::{swift, Bool};
use tauri::State;

swift!(fn stop_recording_impl() -> Bool);
swift!(fn init_audio_session_impl() -> bool);
swift!(fn start_recording_impl() -> bool);

extern "C" {
    fn set_data_callback_impl(callback: extern "C" fn(*const f32, i32));
}

pub struct RecordingState {
    pub is_recording: bool,
    pub transcription: String,
}

impl RecordingState {
    pub fn new() -> Self {
        Self {
            is_recording: false,
            transcription: String::new(),
        }
    }
}

lazy_static::lazy_static! {
    static ref GLOBAL_DATA_SENDER: Mutex<Option<Sender<Vec<f32>>>> = Mutex::new(None);
}

pub struct AppState(pub Arc<Mutex<RecordingState>>);

// Initialize audio session
pub fn init_audio() -> bool {
    unsafe { init_audio_session_impl() }
}

extern "C" fn handle_audio_data(data: *const f32, length: i32) {
    let float_slice = unsafe { std::slice::from_raw_parts(data, length as usize) };
    let float_vec = float_slice.to_vec();

    if let Some(sender) = GLOBAL_DATA_SENDER.lock().unwrap().as_ref() {
        sender.send(float_vec).unwrap();
    }
}

// Command handlers
#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<bool, String> {
    let state_clone = Arc::clone(&state.0);
    let (sender, receiver) = channel();

    {
        let mut global_sender = GLOBAL_DATA_SENDER.lock().unwrap();
        *global_sender = Some(sender);
    }

    let state_for_spawn = Arc::clone(&state_clone);

    tokio::spawn(async move {
        handle_audio_data_stream(receiver, state_for_spawn).await;
    });

    unsafe {
        set_data_callback_impl(handle_audio_data);
    }

    let success = unsafe { start_recording_impl() };
    if success {
        let mut recording_state = state_clone.lock().unwrap();
        recording_state.is_recording = true;
        Ok(true)
    } else {
        Err("Failed to start recording".into())
    }
}

async fn handle_audio_data_stream(receiver: Receiver<Vec<f32>>, state: Arc<Mutex<RecordingState>>) {
    while let Ok(audio_data) = receiver.recv() {
        match transcribe_audio_data(&audio_data).await {
            Ok(partial_transcription) => {
                let mut recording_state = state.lock().unwrap();
                recording_state
                    .transcription
                    .push_str(&partial_transcription);
                recording_state.transcription.push(' ');
            }
            Err(e) => eprintln!("Transcription error: {}", e),
        }
    }
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<bool, String> {
    let state_clone = Arc::clone(&state.0);

    {
        let mut global_sender = GLOBAL_DATA_SENDER.lock().unwrap();
        *global_sender = None;
    }

    let result = thread::spawn(move || {
        let mut recording_state = state_clone.lock().unwrap();
        recording_state.is_recording = false;

        let success = unsafe { stop_recording_impl() };
        Ok(success)
    })
    .join()
    .map_err(|_| "Thread panicked".to_string())?;

    result
}

#[tauri::command]
pub fn get_transcription(state: State<'_, AppState>) -> String {
    let recording_state = state.0.lock().unwrap();
    recording_state.transcription.clone()
}

#[tauri::command]
pub fn is_recording(state: State<'_, AppState>) -> bool {
    let recording_state = state.0.lock().unwrap();
    recording_state.is_recording
}

async fn transcribe_audio_data(audio_data: &[f32]) -> Result<String, String> {
    println!(
        "Processing audio chunk: {} samples ({:.2} seconds)",
        audio_data.len(),
        audio_data.len() as f32 / 44100.0
    );

    let client = reqwest::Client::new();

    let spec = WavSpec {
        channels: 1,
        sample_rate: 44100,
        bits_per_sample: 32,
        sample_format: hound::SampleFormat::Float,
    };

    let mut wav_buffer = Vec::new();
    {
        let mut writer = WavWriter::new(std::io::Cursor::new(&mut wav_buffer), spec)
            .map_err(|e| format!("Failed to create WAV writer: {}", e))?;

        for &sample in audio_data {
            writer
                .write_sample(sample)
                .map_err(|e| format!("Failed to write sample: {}", e))?;
        }

        writer
            .finalize()
            .map_err(|e| format!("Failed to finalize WAV data: {}", e))?;
    }

    let file_part = reqwest::multipart::Part::bytes(wav_buffer)
        .file_name("audio.wav")
        .mime_str("audio/wav")
        .map_err(|e| format!("Failed to create file part: {}", e))?;

    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1");

    let api_key =
        std::env::var("OPENAI_API_KEY").map_err(|e| format!("Failed to get API key: {}", e))?;

    let response = client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {}", api_key))
        .multipart(form)
        .send()
        .await
        .map_err(|e| format!("API request failed: {}", e))?;

    let response_status = response.status();
    let response_text = response
        .text()
        .await
        .map_err(|e| format!("Failed to get response text: {}", e))?;

    if !response_status.is_success() {
        return Err(format!(
            "API returned error status: {} with body: {}",
            response_status, response_text
        ));
    }

    let json: serde_json::Value =
        serde_json::from_str(&response_text).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let transcription = json["text"].as_str().unwrap_or("").to_string();

    Ok(transcription)
}
