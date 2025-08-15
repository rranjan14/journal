import Foundation
import AVFoundation

public protocol TranscriptionServiceDelegate: AnyObject {
    func transcriptionService(_ service: TranscriptionService, didReceiveTranscription text: String)
    func transcriptionService(_ service: TranscriptionService, didEncounterError error: Error)
}

public enum TranscriptionError: Error {
    case noAPIKey
    case invalidAudioData
    case networkError(Error)
    case apiError(String)
    
    public var localizedDescription: String {
        switch self {
        case .noAPIKey:
            return "OpenAI API key not found"
        case .invalidAudioData:
            return "Invalid audio data for transcription"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .apiError(let message):
            return "API error: \(message)"
        }
    }
}

public class TranscriptionService {
    public weak var delegate: TranscriptionServiceDelegate?
    
    private let apiKey: String
    private let apiURL = URL(string: "https://api.openai.com/v1/audio/transcriptions")!
    private let session = URLSession.shared
    
    public init(apiKey: String) {
        self.apiKey = apiKey
    }
    
    public convenience init?() {
        guard let apiKey = ProcessInfo.processInfo.environment["OPENAI_API_KEY"] else {
            return nil
        }
        self.init(apiKey: apiKey)
    }
    
    public func transcribe(audioData: Data, format: AudioFormat = .wav) async throws -> String {
        guard !apiKey.isEmpty else {
            throw TranscriptionError.noAPIKey
        }
        
        guard !audioData.isEmpty else {
            throw TranscriptionError.invalidAudioData
        }
        
        let request = try createTranscriptionRequest(audioData: audioData, format: format)
        
        do {
            let (data, response) = try await session.data(for: request)
            
            guard let httpResponse = response as? HTTPURLResponse else {
                throw TranscriptionError.networkError(URLError(.badServerResponse))
            }
            
            guard httpResponse.statusCode == 200 else {
                let errorMessage = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw TranscriptionError.apiError("HTTP \(httpResponse.statusCode): \(errorMessage)")
            }
            
            let transcriptionResponse = try JSONDecoder().decode(TranscriptionResponse.self, from: data)
            return transcriptionResponse.text
            
        } catch let error as TranscriptionError {
            throw error
        } catch {
            throw TranscriptionError.networkError(error)
        }
    }
    
    public func transcribeAsync(audioData: Data, format: AudioFormat = .wav) {
        Task {
            do {
                let transcription = try await transcribe(audioData: audioData, format: format)
                await MainActor.run {
                    delegate?.transcriptionService(self, didReceiveTranscription: transcription)
                }
            } catch {
                await MainActor.run {
                    delegate?.transcriptionService(self, didEncounterError: error)
                }
            }
        }
    }
    
    private func createTranscriptionRequest(audioData: Data, format: AudioFormat) throws -> URLRequest {
        var request = URLRequest(url: apiURL)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        
        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
        
        var body = Data()
        
        // Add model parameter
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"model\"\r\n\r\n".data(using: .utf8)!)
        body.append("whisper-1\r\n".data(using: .utf8)!)
        
        // Add language parameter
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"language\"\r\n\r\n".data(using: .utf8)!)
        body.append("en\r\n".data(using: .utf8)!)
        
        // Add audio file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"file\"; filename=\"audio.\(format.fileExtension)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: \(format.mimeType)\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)
        
        // Close boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)
        
        request.httpBody = body
        
        return request
    }
}

public enum AudioFormat {
    case wav
    case mp3
    case m4a
    case flac
    
    var fileExtension: String {
        switch self {
        case .wav: return "wav"
        case .mp3: return "mp3"
        case .m4a: return "m4a"
        case .flac: return "flac"
        }
    }
    
    var mimeType: String {
        switch self {
        case .wav: return "audio/wav"
        case .mp3: return "audio/mpeg"
        case .m4a: return "audio/m4a"
        case .flac: return "audio/flac"
        }
    }
}

private struct TranscriptionResponse: Codable {
    let text: String
}