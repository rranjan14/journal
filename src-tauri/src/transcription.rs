use std::ffi::CStr;
use std::os::raw::c_char;
use std::sync::{Arc, Mutex};
use std::thread;
use tauri::State;

// FFI declarations
extern "C" {
    fn init_audio_session_impl() -> bool;
    fn start_recording_impl() -> bool;
    fn stop_recording_impl() -> *const c_char;
    fn free_string_impl(ptr: *const c_char);
}

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
        let file_path_ptr = unsafe { stop_recording_impl() };

        if file_path_ptr.is_null() {
            return Err("Failed to stop recording".to_string());
        }

        let file_path = unsafe {
            let c_str = CStr::from_ptr(file_path_ptr);
            let result = c_str.to_string_lossy().into_owned();
            free_string_impl(file_path_ptr);
            result
        };

        // Perform transcription in this background thread
        let transcription = transcribe_audio(&file_path)?;
        recording_state.transcription = transcription.clone();

        Ok(transcription)
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
