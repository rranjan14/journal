mod transcription;

use transcription::{AppState, RecordingState};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize audio session
    if !transcription::init_audio() {
        panic!("Failed to initialize audio session");
    }

    // Create app state
    let app_state = AppState(std::sync::Arc::new(std::sync::Mutex::new(
        RecordingState::new(),
    )));

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            transcription::start_recording,
            transcription::stop_recording,
            transcription::get_transcription,
            transcription::is_recording,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
