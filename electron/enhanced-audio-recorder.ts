import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import fetch from 'node-fetch';

const recorder = require('node-record-lpcm16');

export class EnhancedAudioRecorder extends EventEmitter {
  private recording = false;
  private transcription = '';
  private microphoneStream: any = null;
  private tempAudioFile: string = '';
  private systemAudioEnabled = false;

  constructor() {
    super();
  }

  async startRecording(): Promise<void> {
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
      
    } catch (error) {
      this.recording = false;
      console.error('Failed to start enhanced audio recording:', error);
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
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

  private setupRealTimeTranscription(): void {
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
      } catch (error) {
        console.error('Error in real-time transcription:', error);
      }
    }, 3000); // Transcribe every 3 seconds
  }

  private async processRecordedAudio(): Promise<void> {
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
    } catch (error) {
      console.error('Error processing recorded audio:', error);
    }
  }

  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OpenAI API key not found, skipping transcription');
      return '';
    }

    try {
      const formData = new FormData();
      formData.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav',
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

  enableSystemAudio(): void {
    this.systemAudioEnabled = true;
    console.log('System audio capture enabled (requires electron-audio-loopback in renderer)');
  }

  isSystemAudioEnabled(): boolean {
    return this.systemAudioEnabled;
  }
}