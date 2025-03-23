use lazy_static;
use std::ffi::{c_char, CStr};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::thread;
use swift_rs::{swift, Bool};
use tauri::State;

swift!(fn stop_recording_impl() -> Bool);
swift!(fn init_audio_session_impl() -> bool);
swift!(fn start_recording_impl() -> bool);

extern "C" {
    fn set_chunk_callback_impl(callback: extern "C" fn(*const c_char));
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
    static ref GLOBAL_SENDER: Mutex<Option<Sender<String>>> = Mutex::new(None);
}

pub struct AppState(pub Arc<Mutex<RecordingState>>);

// Initialize audio session
pub fn init_audio() -> bool {
    unsafe { init_audio_session_impl() }
}

extern "C" fn handle_audio_chunk(path: *const c_char) {
    let path_str = unsafe { CStr::from_ptr(path) }
        .to_string_lossy()
        .into_owned();
    if let Some(sender) = GLOBAL_SENDER.lock().unwrap().as_ref() {
        sender.send(path_str).unwrap();
    }
}

// Command handlers
#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<bool, String> {
    let state_clone = Arc::clone(&state.0);
    let (sender, receiver) = channel();

    {
        let mut global_sender = GLOBAL_SENDER.lock().unwrap();
        *global_sender = Some(sender);
    }

    let state_for_spawn = Arc::clone(&state_clone);

    tokio::spawn(async move {
        handle_transcription_stream(receiver, state_for_spawn).await;
    });

    unsafe {
        set_chunk_callback_impl(handle_audio_chunk);
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

async fn handle_transcription_stream(
    receiver: Receiver<String>,
    state: Arc<Mutex<RecordingState>>,
) {
    while let Ok(chunk_path) = receiver.recv() {
        match transcribe_audio(&chunk_path).await {
            Ok(partial_transcription) => {
                let mut recording_state = state.lock().unwrap();
                recording_state
                    .transcription
                    .push_str(&partial_transcription);
                recording_state.transcription.push(' ');

                // Clean up the temporary file
                let _ = std::fs::remove_file(chunk_path);
            }
            Err(e) => eprintln!("Transcription error: {}", e),
        }
    }
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<bool, String> {
    let state_clone = Arc::clone(&state.0);

    {
        let mut global_sender = GLOBAL_SENDER.lock().unwrap();
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

async fn transcribe_audio(file_path: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    // Read the file into a buffer
    let file_content = tokio::fs::read(file_path)
        .await
        .map_err(|e| format!("Failed to read file: {}", e))?;

    // Create a Part from the file bytes
    let file_name = std::path::Path::new(file_path)
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    let file_part = reqwest::multipart::Part::bytes(file_content).file_name(file_name);

    // Build the form
    let form = reqwest::multipart::Form::new()
        .part("file", file_part)
        .text("model", "whisper-1");

    // Get API key
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

    // If the response was not successful, return an error
    if !response_status.is_success() {
        return Err(format!(
            "API returned error status: {} with body: {}",
            response_status, response_text
        ));
    }

    // Parse the response text as JSON
    let json: serde_json::Value =
        serde_json::from_str(&response_text).map_err(|e| format!("Failed to parse JSON: {}", e))?;

    let transcription = json["text"].as_str().unwrap_or("").to_string();

    Ok(transcription)
}
