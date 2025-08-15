// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SwiftAudioCapture",
    platforms: [
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "SwiftAudioCapture",
            targets: ["SwiftAudioCapture"]
        ),
        .executable(
            name: "AudioCaptureService",
            targets: ["AudioCaptureService"]
        )
    ],
    dependencies: [],
    targets: [
        .target(
            name: "SwiftAudioCapture",
            dependencies: [],
            path: "Sources/SwiftAudioCapture"
        ),
        .executableTarget(
            name: "AudioCaptureService",
            dependencies: ["SwiftAudioCapture"],
            path: "Sources/AudioCaptureService"
        )
    ]
)