# Journal

Download the [installer](https://github.com/rranjan14/journal/blob/main/Journal_0.1.0_aarch64.dmg) and run it on your MacOS(apple chip).

## Demo

Check out this demo of the application in action:

<video src="https://github.com/rranjan14/journal/blob/main/gh-assets/journal-demo.mp4" controls="controls" muted="muted" style="max-width:100%"></video>

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

The audio processing pipeline shows how TypeScript (frontend), Rust (backend), and Swift (native audio) work together in a pretty clever way. Here's how it flows: the frontend kicks things off by calling the `start_recording` command through Tauri's IPC (Inter-Process Communication). This gets Rust talking to Swift using FFI (Foreign Function Interface) via `swift-rs` bindings. Swift then does the heavy lifting of recording audio using AVFoundation, grabbing sound from both the microphone and system audio, and sending it back to Rust through a callback function (`set_chunk_callback_impl`).

We keep the data flowing smoothly using a thread-safe state system with Rust's `Arc<Mutex<RecordingState>>`, which is basically just making sure everyone plays nice when accessing the recording status and transcription data at the same time. When Swift sends over audio chunks, they get processed through a channel system (`mpsc::channel`) that fires up a dedicated worker using `tokio::spawn`. This worker handles audio chunks in the background, shipping them off to OpenAI's Whisper API for transcription. The results get collected in our shared state, with mutex locks standing guard to prevent any data mishaps.

The whole system uses a mix of static global state (with `lazy_static`) and dynamic state management through Tauri. The nice thing about Rust is that it handles memory cleanup automatically through its ownership system, while we make sure Swift resources are properly managed across the FFI boundary. We push near real-time updates to the frontend as the state changes, giving you live transcription updates without freezing up the main UI thread. This whole setup keeps memory usage tight, prevents data races, and keeps everything running smoothly throughout the recording and transcription process.

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
