import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';
import * as fs from 'fs';

export interface SwiftAudioStatus {
  isRecording: boolean;
  microphoneLevel: number;
  systemAudioLevel: number;
  transcriptionEnabled: boolean;
  bufferSize: number;
}

export class SwiftAudioBridge extends EventEmitter {
  private swiftProcess: ChildProcess | null = null;
  private isConnected = false;
  private currentStatus: SwiftAudioStatus = {
    isRecording: false,
    microphoneLevel: 0,
    systemAudioLevel: 0,
    transcriptionEnabled: false,
    bufferSize: 0
  };

  constructor() {
    super();
  }

  async initialize(): Promise<void> {
    try {
      // Check if Swift service is built
      const swiftServicePath = this.getSwiftServicePath();
      if (!fs.existsSync(swiftServicePath)) {
        throw new Error('Swift audio service not found. Please build the Swift package first.');
      }

      // Start the Swift service
      await this.startSwiftService();
      console.log('Swift audio bridge initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Swift audio bridge:', error);
      throw error;
    }
  }

  async startRecording(): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Swift service not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Start recording timeout'));
      }, 5000);

      const onResponse = (success: boolean) => {
        clearTimeout(timeout);
        if (success) {
          this.currentStatus.isRecording = true;
          resolve(true);
        } else {
          reject(new Error('Failed to start recording'));
        }
      };

      this.sendCommand('start', onResponse);
    });
  }

  async stopRecording(): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Swift service not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Stop recording timeout'));
      }, 5000);

      const onResponse = (success: boolean) => {
        clearTimeout(timeout);
        if (success) {
          this.currentStatus.isRecording = false;
          resolve(true);
        } else {
          reject(new Error('Failed to stop recording'));
        }
      };

      this.sendCommand('stop', onResponse);
    });
  }

  async getStatus(): Promise<SwiftAudioStatus> {
    if (!this.isConnected) {
      throw new Error('Swift service not connected');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Get status timeout'));
      }, 3000);

      const onResponse = (status: SwiftAudioStatus) => {
        clearTimeout(timeout);
        this.currentStatus = status;
        resolve(status);
      };

      this.sendCommand('status', onResponse);
    });
  }

  isRecording(): boolean {
    return this.currentStatus.isRecording;
  }

  getMicrophoneLevel(): number {
    return this.currentStatus.microphoneLevel;
  }

  getSystemAudioLevel(): number {
    return this.currentStatus.systemAudioLevel;
  }

  async shutdown(): Promise<void> {
    if (this.swiftProcess) {
      this.sendCommand('quit');
      
      // Wait for graceful shutdown
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => {
          if (this.swiftProcess) {
            this.swiftProcess.kill('SIGTERM');
          }
          resolve();
        }, 3000);

        this.swiftProcess?.on('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      this.swiftProcess = null;
      this.isConnected = false;
    }
  }

  private async startSwiftService(): Promise<void> {
    const swiftServicePath = this.getSwiftServicePath();
    
    return new Promise((resolve, reject) => {
      this.swiftProcess = spawn(swiftServicePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          // Pass through OpenAI API key if available
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
        }
      });

      this.swiftProcess.stdout?.on('data', (data) => {
        this.handleSwiftOutput(data.toString());
      });

      this.swiftProcess.stderr?.on('data', (data) => {
        console.error('Swift service error:', data.toString());
      });

      this.swiftProcess.on('error', (error) => {
        console.error('Swift service process error:', error);
        reject(error);
      });

      this.swiftProcess.on('exit', (code) => {
        console.log(`Swift service exited with code ${code}`);
        this.isConnected = false;
        this.emit('disconnected');
      });

      // Wait for service to be ready
      setTimeout(() => {
        if (this.swiftProcess && !this.swiftProcess.killed) {
          this.isConnected = true;
          resolve();
        } else {
          reject(new Error('Swift service failed to start'));
        }
      }, 2000);
    });
  }

  private handleSwiftOutput(output: string): void {
    const lines = output.split('\n').filter(line => line.trim());
    
    for (const line of lines) {
      // Parse transcription output
      if (line.includes('📝 Transcription:')) {
        const transcriptionMatch = line.match(/📝 Transcription: "(.+)"/);
        if (transcriptionMatch) {
          const transcription = transcriptionMatch[1];
          this.emit('transcription', transcription);
        }
      }
      
      // Parse status updates
      if (line.includes('Recording:')) {
        const isRecording = line.includes('✅ Active');
        this.currentStatus.isRecording = isRecording;
      }
      
      // Parse audio levels (would need to be added to Swift output)
      if (line.includes('Microphone Level:')) {
        const levelMatch = line.match(/Microphone Level: ([\d.]+)/);
        if (levelMatch) {
          this.currentStatus.microphoneLevel = parseFloat(levelMatch[1]);
        }
      }
      
      if (line.includes('System Audio Level:')) {
        const levelMatch = line.match(/System Audio Level: ([\d.]+)/);
        if (levelMatch) {
          this.currentStatus.systemAudioLevel = parseFloat(levelMatch[1]);
        }
      }
    }
  }

  private sendCommand(command: string, callback?: (response: any) => void): void {
    if (!this.swiftProcess || !this.swiftProcess.stdin) {
      throw new Error('Swift service not available');
    }

    this.swiftProcess.stdin.write(`${command}\n`);
    
    // For now, we'll assume commands succeed
    // In a real implementation, you'd parse the response
    if (callback) {
      setTimeout(() => {
        callback(true);
      }, 100);
    }
  }

  private getSwiftServicePath(): string {
    // Path to the built Swift executable
    const projectRoot = path.resolve(__dirname, '..');
    return path.join(projectRoot, 'swift-audio', '.build', 'release', 'AudioCaptureService');
  }

  // Build the Swift package
  static async buildSwiftPackage(): Promise<void> {
    return new Promise((resolve, reject) => {
      const projectRoot = path.resolve(__dirname, '..');
      const swiftPackagePath = path.join(projectRoot, 'swift-audio');
      
      console.log('Building Swift audio package...');
      
      const buildProcess = spawn('swift', ['build', '--configuration', 'release'], {
        cwd: swiftPackagePath,
        stdio: 'inherit'
      });

      buildProcess.on('exit', (code) => {
        if (code === 0) {
          console.log('Swift package built successfully');
          resolve();
        } else {
          reject(new Error(`Swift build failed with code ${code}`));
        }
      });

      buildProcess.on('error', (error) => {
        reject(new Error(`Swift build error: ${error.message}`));
      });
    });
  }
}