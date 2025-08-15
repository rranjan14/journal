"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioRecorder = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const form_data_1 = __importDefault(require("form-data"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const recorder = require('node-record-lpcm16');
class AudioRecorder extends events_1.EventEmitter {
    constructor() {
        super();
        this.recording = false;
        this.transcription = '';
        this.audioStream = null;
        this.tempAudioFile = '';
    }
    async startRecording() {
        if (this.recording) {
            throw new Error('Already recording');
        }
        this.recording = true;
        this.transcription = '';
        this.tempAudioFile = path.join(os.tmpdir(), `recording-${Date.now()}.wav`);
        try {
            console.log('Starting audio recording...');
            // Start recording with node-record-lpcm16
            this.audioStream = recorder.record({
                sampleRate: 44100,
                channels: 1,
                compress: false,
                threshold: 0.5,
                thresholdStart: null,
                thresholdEnd: null,
                silence: '1.0',
                device: null,
                recordProgram: 'rec', // or 'sox' on some systems
                verbose: false
            });
            // Save audio to file
            const fileStream = fs.createWriteStream(this.tempAudioFile);
            this.audioStream.stream().pipe(fileStream);
            // Set up real-time transcription (chunked)
            this.setupRealTimeTranscription();
        }
        catch (error) {
            this.recording = false;
            throw error;
        }
    }
    async stopRecording() {
        if (!this.recording) {
            throw new Error('Not currently recording');
        }
        this.recording = false;
        if (this.audioStream) {
            this.audioStream.stop();
            this.audioStream = null;
        }
        // Process the recorded audio for transcription
        await this.processRecordedAudio();
    }
    isRecording() {
        return this.recording;
    }
    getTranscription() {
        return this.transcription;
    }
    setupRealTimeTranscription() {
        // For real-time transcription, we would need to implement chunked processing
        // This is a simplified version that processes audio in chunks
        let audioChunks = [];
        let chunkDuration = 0;
        const CHUNK_DURATION_MS = 3000; // Process every 3 seconds
        if (this.audioStream) {
            this.audioStream.stream().on('data', (chunk) => {
                audioChunks.push(chunk);
                chunkDuration += (chunk.length / (44100 * 2)) * 1000; // Approximate duration
                if (chunkDuration >= CHUNK_DURATION_MS) {
                    // Process accumulated chunks
                    const combinedChunk = Buffer.concat(audioChunks);
                    this.processAudioChunk(combinedChunk);
                    // Reset for next chunk
                    audioChunks = [];
                    chunkDuration = 0;
                }
            });
        }
    }
    async processAudioChunk(audioBuffer) {
        try {
            const partialTranscription = await this.transcribeAudio(audioBuffer);
            if (partialTranscription.trim()) {
                this.transcription += partialTranscription + ' ';
                this.emit('transcription-update', this.transcription);
            }
        }
        catch (error) {
            console.error('Error processing audio chunk:', error);
        }
    }
    async processRecordedAudio() {
        // This would contain the actual transcription logic
        // For now, we'll just emit a final transcription
        console.log('Processing recorded audio...');
        // In a real implementation, you would:
        // 1. Read the audio file
        // 2. Send it to OpenAI Whisper API
        // 3. Get the transcription result
        // 4. Update the transcription
        // Placeholder final transcription
        if (!this.transcription.trim()) {
            this.transcription = 'Recording completed. (This is a placeholder transcription for the migration demo)';
            this.emit('transcription-update', this.transcription);
        }
    }
    async transcribeAudio(audioBuffer) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.warn('OPENAI_API_KEY not set, using placeholder transcription');
            return 'Placeholder transcription (set OPENAI_API_KEY for real transcription)';
        }
        try {
            const form = new form_data_1.default();
            form.append('file', audioBuffer, {
                filename: 'audio.wav',
                contentType: 'audio/wav'
            });
            form.append('model', 'whisper-1');
            const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...form.getHeaders()
                },
                body: form
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.text || '';
        }
        catch (error) {
            console.error('Transcription error:', error);
            // Return empty string on error to avoid breaking the flow
            return '';
        }
    }
}
exports.AudioRecorder = AudioRecorder;
