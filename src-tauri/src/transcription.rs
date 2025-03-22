use std::sync::{Arc, Mutex};
use std::thread;
use swift_rs::{swift, SRString};
use tauri::State;

swift!(fn stop_recording_impl() -> Option<SRString>);
swift!(fn init_audio_session_impl() -> bool);
swift!(fn start_recording_impl() -> bool);

// State structures
pub struct RecordingState {
    pub is_recording: bool,
    pub transcription: String,
}

pub struct AppState(pub Arc<Mutex<RecordingState>>);

// Initialize audio session
pub fn init_audio() -> bool {
    unsafe { init_audio_session_impl() }
}

// Command handlers
#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<bool, String> {
    let state_clone = Arc::clone(&state.0);

    // Start recording in a separate thread to avoid blocking UI
    let result = thread::spawn(move || {
        let mut recording_state = state_clone.lock().unwrap();

        if recording_state.is_recording {
            return Err("Already recording".to_string());
        }

        let success = unsafe { start_recording_impl() };

        if success {
            recording_state.is_recording = true;
            Ok(true)
        } else {
            Err("Failed to start recording".into())
        }
    })
    .join()
    .unwrap()?;

    Ok(result)
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<String, String> {
    let state_clone = Arc::clone(&state.0);

    // Stop recording in a separate thread to avoid blocking UI
    let result = thread::spawn(move || {
        let mut recording_state = state_clone.lock().unwrap();
        recording_state.is_recording = false;

        // Call Swift function to stop recording and get file path
        let file_path_opt = unsafe { stop_recording_impl() };

        match file_path_opt {
            Some(file_path) => {
                // Create a new runtime in this thread
                let rt = tokio::runtime::Runtime::new()
                    .map_err(|e| format!("Failed to create runtime: {}", e))?;

                // Use block_on to run the async function in this thread
                let transcription =
                    rt.block_on(async { transcribe_audio(&file_path.to_string()).await })?;

                recording_state.transcription = transcription.clone();
                Ok(transcription)
            }
            None => Err("Failed to stop recording".to_string()),
        }
    })
    .join()
    .map_err(|_| "Thread panicked".to_string())?;

    // The result is already a Result<String, String>, so just return it directly
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
