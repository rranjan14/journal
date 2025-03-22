use swift_rs::SwiftLinker;
fn main() {
    SwiftLinker::new("10.15")
        .with_package("AudioRecorder", "swift")
        .link();
    tauri_build::build()
}
