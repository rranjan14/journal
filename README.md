# Journal

## Features

- [x] Audio Recording
- [x] Audio Transcription
- [x] HMR on modifying swift files
- [x] Realtime transcription
- [ ] Handle device changes for input and output

### Technology Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri
- **Native Integration**: Swift
- **Build System**: Cargo + npm

## How It Works

### Rust-Swift FFI Integration

The application uses Foreign Function Interface (FFI) to enable communication between Rust and Swift components:

1. Swift exposes functions to Rust using `@_cdecl`
2. [swift_rs](https://github.com/Brendonovich/swift-rs) helps to link swift function to the rust backend and make them available at runtime.
3. [tokio](https://github.com/tokio-rs/tokio/tree/master/tokio) for reading file and creating background task to handle transcription generation


## Technical Deep Dive: Audio Processing Pipeline

The audio processing pipeline demonstrates a sophisticated interaction between TypeScript (frontend), Rust (backend), and Swift (native audio). The flow begins when the frontend invokes the `start_recording` command through Tauri's IPC (Inter-Process Communication). This triggers Rust code that interfaces with Swift using FFI (Foreign Function Interface) through `swift-rs` bindings. Swift handles the native audio recording using AVFoundation, capturing audio chunks captured through microphone and system audio which are passed back to Rust via a callback mechanism (`set_chunk_callback_impl`).

The data flow is managed through a thread-safe state system using Rust's `Arc<Mutex<RecordingState>>`, ensuring concurrent access to recording status and transcription data is synchronized. When audio chunks arrive from Swift, they're processed through a channel-based system (`mpsc::channel`) that spawns a dedicated transcription worker using `tokio::spawn`. This worker processes audio chunks asynchronously, sending them to OpenAI's Whisper API for transcription. The transcription results are accumulated in the shared state, protected by mutex locks to prevent race conditions.

The system employs a combination of static global state (using `lazy_static`) and dynamic state management through Tauri's state system. Memory management is handled automatically through Rust's ownership system, while Swift resources are properly managed through the FFI boundary. (near)Real-time updates are pushed to the frontend through state changes, allowing for live transcription updates without blocking the main UI thread. This architecture ensures efficient memory usage, prevents data races, and maintains responsiveness throughout the recording and transcription process.

## Development

### Prerequisites

- Node.js (v16 or later)
- Rust (latest stable)
- Xcode (for macOS development)

### Setup

1. Install dependencies:

```bash
npm install
```

2. Install Rust dependencies:

```bash
cd src-tauri
cargo build
```

### Development Commands

Start development server:

```bash
npm run tauri dev
```

Build for production:

```bash
npm run tauri build
```

## Permissions

### Required Permissions

- Microphone access
- File system access
- Application Support directory access

### Configuration

Permissions are configured in:

- `Info.plist` for macOS
- `tauri.conf.json` for application capabilities
- `Cargo.toml` for Rust features

## Error Handling

The application implements comprehensive error handling for:

- Audio device errors
- Transcription failures
- File system operations
- FFI communication

## Building for Production

### Build Process

1. Compile Swift code
2. Build Rust backend
3. Bundle React frontend
4. Package into native application

### Production Build Command

```bash
npm run tauri build
```
