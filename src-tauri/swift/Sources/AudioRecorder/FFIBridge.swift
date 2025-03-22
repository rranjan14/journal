import Foundation

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
public func stopRecording() -> UnsafePointer<CChar>? {
    if let path = recorder.stopRecording() {
        let cString = strdup(path)
        return UnsafePointer(cString)
    }
    return nil
}

/// Get the current recording file path
/// - Returns: Pointer to C string containing the file path
@_cdecl("get_recording_path_impl")
public func getRecordingPath() -> UnsafePointer<CChar>? {
    let path = recorder.getAudioURL().path
    let cString = strdup(path)
    return UnsafePointer(cString)
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

/// Free a C string created by the Swift code
/// - Parameter ptr: Pointer to the C string to free
@_cdecl("free_string_impl")
public func freeString(_ ptr: UnsafePointer<CChar>?) {
    if let ptr = ptr {
        free(UnsafeMutablePointer(mutating: ptr))
    }
}
