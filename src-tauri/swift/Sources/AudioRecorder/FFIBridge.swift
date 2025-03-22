import Foundation
import SwiftRs

// MARK: - Global Shared Instance
private var recorder = AudioRecorder()

// MARK: - C Interface Functions

/// Initialize the audio session (no-op on macOS as AVAudioSession is not needed)
/// - Returns: Always returns true on macOS
@_cdecl("init_audio_session_impl")
public func initAudioSession() -> Bool {
    // On macOS, we don't need to initialize an audio session
    // Audio permissions are handled through system permissions
    return true
}

/// Start audio recording
/// - Returns: Boolean indicating success
@_cdecl("start_recording_impl")
public func startRecording() -> Bool {
    return recorder.startRecording()
}

/// Stop audio recording
/// - Returns: Pointer to C string containing the file path, or NULL if failed
@_cdecl("stop_recording_impl")
public func stopRecording() -> SRString? {
    return recorder.stopRecording()
}

/// Get the current recording file path
/// - Returns: Pointer to C string containing the file path
@_cdecl("get_recording_path_impl")
public func getRecordingPath() -> SRString {
    return SRString(recorder.getAudioURL().path)
}

/// Create a recorder with custom file path
/// - Parameter path: Path where to save the recording
/// - Returns: Boolean indicating success
@_cdecl("create_recorder_with_path_impl")
public func createRecorderWithPath(_ path: UnsafePointer<CChar>) -> Bool {
    let pathString = String(cString: path)
    let url = URL(fileURLWithPath: pathString)
    recorder = AudioRecorder()
    return true
}
