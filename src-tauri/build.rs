use swift_rs::SwiftLinker;
fn main() {
    SwiftLinker::new("10.13")
        .with_package("AudioRecorder", "swift")
        .link();
    tauri_build::build()
}
