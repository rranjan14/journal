import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import fetch from 'node-fetch';

export class DualAudioRecorder extends EventEmitter {
  private recording = false;
  private transcription = '';
  private microphoneStream: MediaStream | null = null;
  private systemAudioStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private tempAudioFile: string = '';

  constructor() {
    super();
  }

  async startRecording(): Promise<void> {
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
      
    } catch (error) {
      this.recording = false;
      console.error('Failed to start dual audio recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
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

  private async getSystemAudioStream(): Promise<MediaStream> {
    // This will be implemented via IPC to the main process
    // The main process will use electron-audio-loopback to get system audio
    return new Promise((resolve, reject) => {
      // This is a placeholder - the actual implementation will use IPC
      // to communicate with the main process which has electron-audio-loopback initialized
      const { ipcRenderer } = require('electron');
      
      ipcRenderer.invoke('get-system-audio-stream').then((stream: MediaStream) => {
        resolve(stream);
      }).catch((error: Error) => {
        reject(error);
      });
    });
  }

  private async processAudioChunk(chunk: Blob): Promise<void> {
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
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private async processRecordedAudio(): Promise<void> {
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
      
    } catch (error) {
      console.error('Error processing recorded audio:', error);
    }
  }

  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OpenAI API key not found');
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
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
    } catch (error) {
      console.error('Transcription error:', error);
      return '';
    }
  }

  isRecording(): boolean {
    return this.recording;
  }

  getTranscription(): string {
    return this.transcription;
  }

  clearTranscription(): void {
    this.transcription = '';
  }
}