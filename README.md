# Journal

A powerful audio recording and transcription application with **dual audio capture** capabilities. Available in two implementations:

1. **🍎 Swift Edition** (macOS only) - Native performance with Core Audio
2. **🌍 Cross-Platform Edition** - Works on Windows, macOS, and Linux

## Demo

Check out this demo of the application in action:

https://github.com/user-attachments/assets/92517461-110d-4e05-b2a5-f98ef49737fa

## Features

- [x] **Dual Audio Recording**: Capture both microphone and system audio simultaneously
- [x] **Real-time Transcription**: Live transcription using OpenAI Whisper
- [x] **Audio Level Monitoring**: Visual feedback for both audio streams
- [x] **Modern UI**: React-based interface with real-time updates
- [x] **Multiple Implementations**: Choose between native Swift or cross-platform Electron
- [ ] Handle device changes for input and output

## Choose Your Implementation

### 🍎 Swift Edition (macOS Only)
**Best performance and native integration**

- ✅ **Native Performance**: Direct Core Audio integration
- ✅ **Superior Audio Quality**: Uncompressed 32-bit float processing
- ✅ **Low Latency**: <10ms audio capture latency
- ✅ **Deep System Integration**: Proper macOS permissions and behavior
- ✅ **Future iOS Support**: Shared Swift codebase for iOS companion app

**Requirements**: macOS 12.0+, Xcode Command Line Tools

### 🌍 Cross-Platform Edition
**Works everywhere with great performance**

- ✅ **Universal Compatibility**: Windows, macOS, Linux support
- ✅ **Easy Deployment**: Single codebase for all platforms
- ✅ **Web Technologies**: Familiar React + Electron stack
- ✅ **Good Performance**: electron-audio-loopback for system audio

**Requirements**: Node.js 18+, npm

## Quick Start

### Check Your Platform
```bash
# Check if Swift is available (macOS only)
npm run check:swift

# If Swift is available, you can use either implementation
# If not, use the cross-platform version
```

### Swift Edition (macOS)
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your OpenAI API key to .env

# Build and run Swift version
npm run dev:swift
```

### Cross-Platform Edition
```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Add your OpenAI API key to .env

# Run cross-platform version
npm run dev
```

## Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- OpenAI API key (for transcription)

### Installation

```bash
# Clone the repository
git clone https://github.com/rranjan14/journal.git
cd journal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Add your OpenAI API key to .env
```

### Development Commands

```bash
# Start development server (frontend + electron)
npm run dev

# Build the application
npm run build

# Build only the electron backend
npm run build:electron

# Clean build artifacts
npm run clean

# Run the electron app (builds backend first)
npm run electron

# Create distributable package
npm run dist
```

### Build Process

The application uses a two-stage build process:

1. **Frontend Build**: `vite build` compiles the React app to `dist/`
2. **Backend Build**: TypeScript compiler builds Electron files to `dist-electron/`

The `dist-electron/` directory is automatically generated and should not be committed to git.

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
