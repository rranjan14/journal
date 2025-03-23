import Foundation
import SwiftRs

private var recorder = AudioRecorder()
private var delegate: FFIAudioDelegate? = nil

public typealias AudioChunkCallback = @convention(c) (UnsafePointer<CChar>) -> Void
private var chunkCallback: AudioChunkCallback?

class FFIAudioDelegate: AudioRecorderDelegate {
    func audioRecorderDidCaptureChunk(_ chunkURL: URL) {
        if let callback = chunkCallback {
            callback(strdup(chunkURL.path))
        }
    }
    
    func audioRecorderDidFailWithError(_ error: Error) {
        print("Recording error: \(error)")
    }
}


@_cdecl("init_audio_session_impl")
public func initAudioSession() -> Bool {
    delegate = FFIAudioDelegate()
    recorder.delegate = delegate
    return true
}

@_cdecl("start_recording_impl")
public func startRecording() -> Bool {
    return recorder.startRecording()
}

@_cdecl("stop_recording_impl")
public func stopRecording() -> Bool {
    return recorder.stopRecording()
}

@_cdecl("get_recording_path_impl")
public func getRecordingPath() -> SRString {
    return SRString(recorder.getAudioURL().path)
}

@_cdecl("create_recorder_with_path_impl")
public func createRecorderWithPath(_ path: UnsafePointer<CChar>) -> Bool {
    let pathString = String(cString: path)
    let url = URL(fileURLWithPath: pathString)
    recorder = AudioRecorder()
    delegate = FFIAudioDelegate()
    recorder.delegate = delegate
    return true
}

@_cdecl("set_chunk_callback_impl")
public func setChunkCallback(_ callback: @escaping @convention(c) (UnsafePointer<CChar>) -> Void) {
    chunkCallback = callback
}