/**
 * Camera & Audio Device Manager
 * Handles local media stream acquisition, hardware switching,
 * track enabling/disabling, and cleanup.
 */
export interface CameraManagerOptions {
  videoWidth?: number;
  videoHeight?: number;
  frameRate?: number;
}

export class CameraManager {
  private rawStream: MediaStream | null = null;
  private isAudioMuted: boolean = false;
  private isVideoEnabled: boolean = true;

  async requestMedia(options: CameraManagerOptions = {}): Promise<MediaStream> {
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        width: { ideal: options.videoWidth || 1280 },
        height: { ideal: options.videoHeight || 720 },
        frameRate: { ideal: options.frameRate || 30 },
        facingMode: 'user',
      },
    };

    try {
      this.rawStream = await navigator.mediaDevices.getUserMedia(constraints);
      return this.rawStream;
    } catch (err) {
      console.error('CameraManager: Failed to get user media', err);
      throw err;
    }
  }

  toggleAudio(muted?: boolean): boolean {
    if (!this.rawStream) return false;
    this.isAudioMuted = muted !== undefined ? muted : !this.isAudioMuted;
    
    this.rawStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isAudioMuted;
    });

    return this.isAudioMuted;
  }

  toggleVideo(enabled?: boolean): boolean {
    if (!this.rawStream) return false;
    this.isVideoEnabled = enabled !== undefined ? enabled : !this.isVideoEnabled;

    this.rawStream.getVideoTracks().forEach((track) => {
      track.enabled = this.isVideoEnabled;
    });

    return this.isVideoEnabled;
  }

  getRawStream(): MediaStream | null {
    return this.rawStream;
  }

  stopAllTracks(): void {
    if (this.rawStream) {
      this.rawStream.getTracks().forEach((track) => track.stop());
      this.rawStream = null;
    }
  }
}

export const cameraManager = new CameraManager();
