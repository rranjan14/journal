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
pub fn start_recording(state: State<'_, AppState>) -> Result<bool, String> {
    let mut recording_state = state.0.lock().unwrap();

    if recording_state.is_recording {
        return Err("Already recording".into());
    }

    let success = unsafe { start_recording_impl() };

    if success {
        recording_state.is_recording = true;
        Ok(true)
    } else {
        Err("Failed to start recording".into())
    }
}

#[tauri::command]
pub async fn stop_recording(state: State<'_, AppState>) -> Result<String, String> {
    let state_clone = Arc::clone(&state.0);

    // Stop recording in a separate thread to avoid blocking UI
    let transcription = thread::spawn(move || {
        let mut recording_state = state_clone.lock().unwrap();
        recording_state.is_recording = false;

        // Call Swift function to stop recording and get file path
        let file_path_opt = unsafe { stop_recording_impl() };

        match file_path_opt {
            Some(file_path) => {
                // Perform transcription in this background thread
                let transcription = transcribe_audio(&file_path.to_string())?;
                recording_state.transcription = transcription.clone();

                Ok(transcription)
            }
            None => Err("Failed to stop recording".to_string()),
        }
    })
    .join()
    .unwrap()?;

    Ok(transcription)
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

fn transcribe_audio(_file_path: &str) -> Result<String, String> {
    // For simplicity, we're just returning a placeholder
    Ok("This is a placeholder for the actual transcription. In a real implementation, this would be the text transcribed from the audio recording.".into())
}
