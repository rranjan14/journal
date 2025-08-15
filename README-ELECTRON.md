# Journal - Electron Version

A simple journal application built with Electron and React, migrated from Tauri.

## Features

- Audio recording with real-time transcription
- Clean, modern UI built with React and Tailwind CSS
- Cross-platform desktop application

## Development

### Prerequisites

- Node.js (v18 or later)

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

### Building

To build the application for production:

```bash
npm run build
```

To create distributable packages:

```bash
npm run dist
```

## Architecture

- **Frontend**: React with TypeScript and Tailwind CSS
- **Backend**: Electron main process with Node.js
- **Audio Recording**: node-record-lpcm16 for cross-platform audio capture
- **Transcription**: OpenAI Whisper API integration

## Configuration

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY=your_api_key_here
```

## Migration from Tauri

This application was successfully migrated from Tauri to Electron, preserving all functionality:

### Key Changes Made:

1. **Backend Migration**: 
   - Replaced Rust backend with Node.js Electron main process
   - Migrated Swift audio recording to `node-record-lpcm16`
   - Implemented OpenAI Whisper API integration in Node.js

2. **IPC Communication**:
   - Replaced Tauri's `invoke()` system with Electron's IPC
   - Updated frontend to use `window.electronAPI` instead of Tauri APIs
   - Maintained the same interface for seamless migration

3. **Audio Recording**:
   - Replaced native Swift implementation with cross-platform Node.js solution
   - Maintained real-time transcription functionality
   - Preserved chunked audio processing for live updates

4. **Build System**:
   - Updated from Tauri's Rust-based build to Electron's Node.js build
   - Configured electron-builder for packaging
   - Maintained TypeScript compilation for both frontend and backend

### Files Structure:

```
journal/
├── src/                    # React frontend (minimal changes)
├── electron/              # Electron backend
│   ├── main.ts           # Main process
│   ├── preload.ts        # Preload script for secure IPC
│   ├── audio-recorder.ts # Audio recording and transcription
│   └── types.d.ts        # Type definitions
├── dist/                 # Built frontend
├── dist-electron/        # Built Electron backend
└── build/               # App icons and resources
```

## License

This project is licensed under the MIT License.