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
exports.EnhancedAudioRecorder = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const form_data_1 = __importDefault(require("form-data"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const recorder = require('node-record-lpcm16');
class EnhancedAudioRecorder extends events_1.EventEmitter {
    constructor() {
        super();
        this.recording = false;
        this.transcription = '';
        this.microphoneStream = null;
        this.tempAudioFile = '';
        this.systemAudioEnabled = false;
    }
    async startRecording() {
        if (this.recording) {
            throw new Error('Already recording');
        }
        this.recording = true;
        this.transcription = '';
        this.tempAudioFile = path.join(os.tmpdir(), `recording-${Date.now()}.wav`);
        try {
            console.log('Starting enhanced audio recording...');
            // Start microphone recording with node-record-lpcm16
            this.microphoneStream = recorder.record({
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
            this.microphoneStream.stream().pipe(fileStream);
            // Set up real-time transcription (chunked)
            this.setupRealTimeTranscription();
            console.log('Enhanced audio recording started successfully');
        }
        catch (error) {
            this.recording = false;
            console.error('Failed to start enhanced audio recording:', error);
            throw error;
        }
    }
    async stopRecording() {
        if (!this.recording) {
            throw new Error('Not currently recording');
        }
        this.recording = false;
        if (this.microphoneStream) {
            this.microphoneStream.stop();
            this.microphoneStream = null;
        }
        // Process the recorded audio for transcription
        await this.processRecordedAudio();
        console.log('Enhanced audio recording stopped');
    }
    setupRealTimeTranscription() {
        // Set up periodic transcription of recorded audio
        const transcriptionInterval = setInterval(async () => {
            if (!this.recording) {
                clearInterval(transcriptionInterval);
                return;
            }
            try {
                // Check if temp file exists and has content
                if (fs.existsSync(this.tempAudioFile)) {
                    const stats = fs.statSync(this.tempAudioFile);
                    if (stats.size > 1024) { // Only process if file has some content
                        const audioBuffer = fs.readFileSync(this.tempAudioFile);
                        const transcription = await this.transcribeAudio(audioBuffer);
                        if (transcription && transcription.trim()) {
                            this.transcription = transcription;
                            this.emit('transcription-update', this.transcription);
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error in real-time transcription:', error);
            }
        }, 3000); // Transcribe every 3 seconds
    }
    async processRecordedAudio() {
        try {
            if (fs.existsSync(this.tempAudioFile)) {
                const audioBuffer = fs.readFileSync(this.tempAudioFile);
                // Get final transcription
                const finalTranscription = await this.transcribeAudio(audioBuffer);
                if (finalTranscription) {
                    this.transcription = finalTranscription;
                    this.emit('transcription-update', this.transcription);
                }
            }
        }
        catch (error) {
            console.error('Error processing recorded audio:', error);
        }
    }
    async transcribeAudio(audioBuffer) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.warn('OpenAI API key not found, skipping transcription');
            return '';
        }
        try {
            const formData = new form_data_1.default();
            formData.append('file', audioBuffer, {
                filename: 'audio.wav',
                contentType: 'audio/wav',
            });
            formData.append('model', 'whisper-1');
            formData.append('language', 'en');
            const response = await (0, node_fetch_1.default)('https://api.openai.com/v1/audio/transcriptions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    ...formData.getHeaders(),
                },
                body: formData,
            });
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
            }
            const result = await response.json();
            return result.text || '';
        }
        catch (error) {
            console.error('Transcription error:', error);
            return '';
        }
    }
    isRecording() {
        return this.recording;
    }
    getTranscription() {
        return this.transcription;
    }
    clearTranscription() {
        this.transcription = '';
    }
    enableSystemAudio() {
        this.systemAudioEnabled = true;
        console.log('System audio capture enabled (requires electron-audio-loopback in renderer)');
    }
    isSystemAudioEnabled() {
        return this.systemAudioEnabled;
    }
}
exports.EnhancedAudioRecorder = EnhancedAudioRecorder;
