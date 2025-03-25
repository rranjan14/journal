import Foundation
import SwiftRs

private var recorder = AudioRecorder()
private var delegate: FFIAudioDelegate? = nil

public typealias AudioChunkCallback = @convention(c) (UnsafePointer<CChar>) -> Void
private var chunkCallback: AudioChunkCallback?

public typealias AudioDataCallback = @convention(c) (UnsafePointer<Float>, Int) -> Void
private var dataCallback: AudioDataCallback?

class FFIAudioDelegate: AudioRecorderDelegate {
    func audioRecorderDidCaptureChunk(_ chunkURL: URL) {
        if let callback = chunkCallback {
            callback(strdup(chunkURL.path))
        }
    }
    
    func audioRecorderDidFailWithError(_ error: Error) {
        print("Recording error: \(error)")
    }
    
    func audioRecorderDidCaptureData(_ audioData: Data) {
        if let callback = dataCallback {
            audioData.withUnsafeBytes { ptr in
                callback(ptr.baseAddress!.assumingMemoryBound(to: Float.self), 
                        audioData.count / MemoryLayout<Float>.stride)
            }
        }
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

@_cdecl("set_data_callback_impl")
public func setDataCallback(_ callback: @escaping AudioDataCallback) {
    dataCallback = callback
}
