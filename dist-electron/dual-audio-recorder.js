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
exports.DualAudioRecorder = void 0;
const events_1 = require("events");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const form_data_1 = __importDefault(require("form-data"));
const node_fetch_1 = __importDefault(require("node-fetch"));
class DualAudioRecorder extends events_1.EventEmitter {
    constructor() {
        super();
        this.recording = false;
        this.transcription = '';
        this.microphoneStream = null;
        this.systemAudioStream = null;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.tempAudioFile = '';
    }
    async startRecording() {
        if (this.recording) {
            throw new Error('Already recording');
        }
        this.recording = true;
        this.transcription = '';
        this.audioChunks = [];
        this.tempAudioFile = path.join(os.tmpdir(), `recording-${Date.now()}.wav`);
        try {
            console.log('Starting dual audio recording...');
            // Get microphone stream
            this.microphoneStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    noiseSuppression: false,
                    autoGainControl: false,
                    sampleRate: 44100,
                    channelCount: 1
                }
            });
            // Get system audio stream using electron-audio-loopback
            // This will be handled by the renderer process via IPC
            this.systemAudioStream = await this.getSystemAudioStream();
            // Create a combined audio stream
            const audioContext = new AudioContext({ sampleRate: 44100 });
            const micSource = audioContext.createMediaStreamSource(this.microphoneStream);
            const systemSource = audioContext.createMediaStreamSource(this.systemAudioStream);
            // Create a mixer to combine both streams
            const mixer = audioContext.createGain();
            const destination = audioContext.createMediaStreamDestination();
            micSource.connect(mixer);
            systemSource.connect(mixer);
            mixer.connect(destination);
            // Set up MediaRecorder for the combined stream
            this.mediaRecorder = new MediaRecorder(destination.stream, {
                mimeType: 'audio/webm;codecs=opus'
            });
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    // Process chunk for real-time transcription
                    this.processAudioChunk(event.data);
                }
            };
            this.mediaRecorder.onstop = () => {
                this.processRecordedAudio();
            };
            // Start recording with 1-second chunks for real-time processing
            this.mediaRecorder.start(1000);
            console.log('Dual audio recording started successfully');
        }
        catch (error) {
            this.recording = false;
            console.error('Failed to start dual audio recording:', error);
            throw error;
        }
    }
    async stopRecording() {
        if (!this.recording) {
            throw new Error('Not currently recording');
        }
        this.recording = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        // Stop and clean up streams
        if (this.microphoneStream) {
            this.microphoneStream.getTracks().forEach(track => track.stop());
            this.microphoneStream = null;
        }
        if (this.systemAudioStream) {
            this.systemAudioStream.getTracks().forEach(track => track.stop());
            this.systemAudioStream = null;
        }
        console.log('Dual audio recording stopped');
    }
    async getSystemAudioStream() {
        // This will be implemented via IPC to the main process
        // The main process will use electron-audio-loopback to get system audio
        return new Promise((resolve, reject) => {
            // This is a placeholder - the actual implementation will use IPC
            // to communicate with the main process which has electron-audio-loopback initialized
            const { ipcRenderer } = require('electron');
            ipcRenderer.invoke('get-system-audio-stream').then((stream) => {
                resolve(stream);
            }).catch((error) => {
                reject(error);
            });
        });
    }
    async processAudioChunk(chunk) {
        try {
            // Convert blob to buffer for processing
            const arrayBuffer = await chunk.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            // Send to OpenAI Whisper for transcription
            const transcription = await this.transcribeAudio(buffer);
            if (transcription && transcription.trim()) {
                this.transcription += transcription + ' ';
                this.emit('transcription-update', this.transcription);
            }
        }
        catch (error) {
            console.error('Error processing audio chunk:', error);
        }
    }
    async processRecordedAudio() {
        if (this.audioChunks.length === 0) {
            return;
        }
        try {
            // Combine all chunks into a single blob
            const combinedBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            const arrayBuffer = await combinedBlob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            // Save to temporary file
            fs.writeFileSync(this.tempAudioFile, buffer);
            // Get final transcription
            const finalTranscription = await this.transcribeAudio(buffer);
            if (finalTranscription) {
                this.transcription = finalTranscription;
                this.emit('transcription-update', this.transcription);
            }
            // Clean up
            this.audioChunks = [];
        }
        catch (error) {
            console.error('Error processing recorded audio:', error);
        }
    }
    async transcribeAudio(audioBuffer) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error('OpenAI API key not found');
        }
        try {
            const formData = new form_data_1.default();
            formData.append('file', audioBuffer, {
                filename: 'audio.webm',
                contentType: 'audio/webm',
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
}
exports.DualAudioRecorder = DualAudioRecorder;
