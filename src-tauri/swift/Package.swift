// swift-tools-version:5.5
import PackageDescription

let package = Package(
    name: "AudioRecorder",
    platforms: [
        .macOS(.v10_15)
    ],
    products: [
        .library(
            name: "AudioRecorder",
            type: .static,
            targets: ["AudioRecorder"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/Brendonovich/swift-rs", from: "1.0.7")
    ],
    targets: [
        .target(
            name: "AudioRecorder",
            dependencies: [
                .product(
                    name: "SwiftRs",
                    package: "swift-rs"
                )
            ],
            path: "Sources/AudioRecorder"
        )
    ]
)
