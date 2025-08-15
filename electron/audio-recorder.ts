import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import FormData from 'form-data';
import fetch from 'node-fetch';

const recorder = require('node-record-lpcm16');

export class AudioRecorder extends EventEmitter {
  private recording = false;
  private transcription = '';
  private audioStream: any = null;
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
      
    } catch (error) {
      this.recording = false;
      throw error;
    }
  }

  async stopRecording(): Promise<void> {
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

  isRecording(): boolean {
    return this.recording;
  }

  getTranscription(): string {
    return this.transcription;
  }

  private setupRealTimeTranscription(): void {
    // For real-time transcription, we would need to implement chunked processing
    // This is a simplified version that processes audio in chunks
    let audioChunks: Buffer[] = [];
    let chunkDuration = 0;
    const CHUNK_DURATION_MS = 3000; // Process every 3 seconds

    if (this.audioStream) {
      this.audioStream.stream().on('data', (chunk: Buffer) => {
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

  private async processAudioChunk(audioBuffer: Buffer): Promise<void> {
    try {
      const partialTranscription = await this.transcribeAudio(audioBuffer);
      if (partialTranscription.trim()) {
        this.transcription += partialTranscription + ' ';
        this.emit('transcription-update', this.transcription);
      }
    } catch (error) {
      console.error('Error processing audio chunk:', error);
    }
  }

  private async processRecordedAudio(): Promise<void> {
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

  private async transcribeAudio(audioBuffer: Buffer): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.warn('OPENAI_API_KEY not set, using placeholder transcription');
      return 'Placeholder transcription (set OPENAI_API_KEY for real transcription)';
    }

    try {
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: 'audio.wav',
        contentType: 'audio/wav'
      });
      form.append('model', 'whisper-1');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
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
      
    } catch (error) {
      console.error('Transcription error:', error);
      // Return empty string on error to avoid breaking the flow
      return '';
    }
  }
}