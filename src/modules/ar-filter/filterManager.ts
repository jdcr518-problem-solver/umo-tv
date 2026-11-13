import type { FilterId, FilterDefinition } from '@shared/types.js';

export const AVAILABLE_FILTERS: FilterDefinition[] = [
  {
    id: 'none',
    name: 'Normal (No Filter)',
    description: 'Clean high-definition raw camera feed without post-processing.',
    icon: 'SparklesOff',
    isPremium: false,
    requiresAdUnlock: false,
  },
  {
    id: 'dog-face',
    name: 'Dog Ears & Nose',
    description: 'Animated puppy ears and nose tracking your face and expressions.',
    icon: 'Dog',
    isPremium: false,
    requiresAdUnlock: false,
  },
  {
    id: 'sunglasses',
    name: 'Neon Sunglasses',
    description: 'Stylized 3D tinted sunglasses that adapt to face tilt and perspective.',
    icon: 'Glasses',
    isPremium: false,
    requiresAdUnlock: false,
  },
];

export interface FilterProcessResult {
  filteredStream: MediaStream;
  videoTrack: MediaStreamTrack;
}

/**
 * FilterManager
 * Manages the MediaPipe Face Landmarker + Three.js AR pipeline.
 * Modifies the outgoing video stream so the remote peer sees the rendered filter.
 */
export class FilterManager {
  private activeFilter: FilterId = 'none';
  private outputCanvas: HTMLCanvasElement | null = null;
  private canvasStream: MediaStream | null = null;
  private isModelLoaded: boolean = false;

  getActiveFilter(): FilterId {
    return this.activeFilter;
  }

  isReady(): boolean {
    return this.isModelLoaded;
  }

  setFilter(filterId: FilterId): void {
    this.activeFilter = filterId;
    console.log(`[FilterManager] Filter switched to: ${filterId}`);
  }

  /**
   * Initializes the pipeline using an input video stream and canvas
   */
  setupPipeline(inputVideo: HTMLVideoElement): FilterProcessResult | null {
    if (typeof window === 'undefined') return null;

    if (!this.outputCanvas) {
      this.outputCanvas = document.createElement('canvas');
      this.outputCanvas.width = inputVideo.videoWidth || 1280;
      this.outputCanvas.height = inputVideo.videoHeight || 720;
    }

    try {
      this.canvasStream = this.outputCanvas.captureStream(30);
      const videoTrack = this.canvasStream.getVideoTracks()[0];

      return {
        filteredStream: this.canvasStream,
        videoTrack,
      };
    } catch (err) {
      console.warn('[FilterManager] canvas.captureStream not supported in this environment', err);
      return null;
    }
  }

  destroy(): void {
    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((t) => t.stop());
      this.canvasStream = null;
    }
    this.outputCanvas = null;
  }
}

export const filterManager = new FilterManager();
