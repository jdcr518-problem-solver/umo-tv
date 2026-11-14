import type { FilterId, FilterDefinition } from '@shared/types.js';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { FaceLandmarkerService } from './faceLandmarkerService.js';
import { FilterScene } from './filterScene.js';

export const AVAILABLE_FILTERS: FilterDefinition[] = [
  {
    id: 'none',
    name: 'Normal (No Filter)',
    description: 'Clean raw camera feed without post-processing or facial filters.',
    icon: 'SparklesOff',
    isPremium: false,
    requiresAdUnlock: false,
  },
  {
    id: 'dog-face',
    name: 'Dog Ears & Nose',
    description: 'Cartoon puppy ears and glossy nose with playful ear bounce and head tracking.',
    icon: 'Dog',
    isPremium: false,
    requiresAdUnlock: false,
  },
  {
    id: 'sunglasses',
    name: 'Neon Sunglasses',
    description: 'Futuristic cyberpunk sunglasses with glowing neon rims, tinted lenses, and 3D tilt.',
    icon: 'Glasses',
    isPremium: false,
    requiresAdUnlock: false,
  },
];

export interface FilterSwitchResult {
  filteredStream: MediaStream | null;
  videoTrack: MediaStreamTrack | null;
  changedTrack: boolean;
}

export type FilterManagerNotification = (msg: string) => void;

export interface FilterDiagnostics {
  activeFilter: FilterId;
  visibilityState: string;
  cameraTrackState: string;
  filteredTrackState: string;
  canvasWidth: number;
  canvasHeight: number;
  canvasFps: number;
  detectionsPerSec: number;
  hasFace: boolean;
  timestamp: number;
}

/**
 * FilterManager
 * Orchestrates the real-time AR filter pipeline:
 * Camera MediaStream -> In-Viewport Video Source -> MediaPipe Face Landmarker -> Three.js WebGL -> canvas.captureStream()
 *
 * CRITICAL RELIABILITY ARCHITECTURE:
 * 1. Decouples continuous camera video rendering (30 FPS) from facial inference (~15-20 FPS).
 *    Video frames keep transmitting to WebRTC even if no face is detected or inference skips.
 * 2. Uses requestVideoFrameCallback as the primary camera frame driver with requestAnimationFrame
 *    and background watchdog intervals to prevent frozen remote video under tab focus/blur/occlusion.
 * 3. Keeps hiddenVideo in the DOM with non-zero dimensions and opacity > 0 to prevent Chromium's
 *    background video decoder suspension.
 * 4. Calls track.requestFrame() after each WebGL draw buffer presentation.
 * 5. Strictly preserves pixelRatio: 1.0 and intrinsic camera dimensions to guarantee zero zoom/crop.
 */
export class FilterManager {
  private activeFilter: FilterId = 'none';
  private outputCanvas: HTMLCanvasElement | null = null;
  private hiddenVideo: HTMLVideoElement | null = null;
  private canvasStream: MediaStream | null = null;
  private combinedStream: MediaStream | null = null;
  private rawStream: MediaStream | null = null;

  private currentWidth = 1280;
  private currentHeight = 720;

  private landmarkerService: FaceLandmarkerService;
  private scene: FilterScene | null = null;

  // Render & Inference loop management
  private isProcessing = false;
  private isRendering = false;
  private isInferenceBusy = false;
  private animFrameId: number | null = null;
  private videoCallbackId: number | null = null;
  private watchdogIntervalId: ReturnType<typeof setInterval> | null = null;
  private inferenceIntervalId: ReturnType<typeof setInterval> | null = null;
  private diagnosticsIntervalId: ReturnType<typeof setInterval> | null = null;

  private lastRenderTimestamp = 0;
  private latestLandmarks: NormalizedLandmark[] | null = null;

  // Diagnostics counters
  private frameRenderCount = 0;
  private detectionCount = 0;
  private currentFps = 0;
  private currentDps = 0;
  private lastFpsCalcTime = 0;

  private switchSequence = 0;
  private onNotificationCallback?: FilterManagerNotification;

  constructor() {
    this.landmarkerService = new FaceLandmarkerService({
      onError: (err) => {
        console.error('[FilterManager] Landmarker error:', err);
        this.notifyUser('Face tracking unavailable. Falling back to normal camera.');
        this.setFilter('none');
      },
    });
  }

  setNotificationHandler(callback: FilterManagerNotification): void {
    this.onNotificationCallback = callback;
  }

  private notifyUser(msg: string): void {
    if (this.onNotificationCallback) {
      this.onNotificationCallback(msg);
    }
  }

  getActiveFilter(): FilterId {
    return this.activeFilter;
  }

  isFilterActive(): boolean {
    return this.activeFilter !== 'none' && this.isProcessing;
  }

  getFilteredStream(): MediaStream | null {
    if (this.activeFilter === 'none') return this.rawStream;
    return this.combinedStream || this.rawStream;
  }

  getActiveVideoTrack(): MediaStreamTrack | null {
    if (this.activeFilter !== 'none' && this.canvasStream) {
      const tracks = this.canvasStream.getVideoTracks();
      if (tracks.length > 0 && tracks[0].readyState === 'live') {
        return tracks[0];
      }
    }
    return this.rawStream ? this.rawStream.getVideoTracks()[0] || null : null;
  }

  /**
   * Retrieves the exact intrinsic video dimensions from the raw camera track or video element
   */
  private getIntrinsicDimensions(): { width: number; height: number } {
    if (this.rawStream) {
      const track = this.rawStream.getVideoTracks()[0];
      if (track) {
        const settings = track.getSettings();
        if (settings.width && settings.height && settings.width > 0 && settings.height > 0) {
          return { width: settings.width, height: settings.height };
        }
      }
    }

    if (this.hiddenVideo && this.hiddenVideo.videoWidth > 0 && this.hiddenVideo.videoHeight > 0) {
      return { width: this.hiddenVideo.videoWidth, height: this.hiddenVideo.videoHeight };
    }

    return { width: 1280, height: 720 };
  }

  /**
   * Retrieves live diagnostic state
   */
  getDiagnostics(): FilterDiagnostics {
    const rawTrack = this.rawStream?.getVideoTracks()[0];
    const canvasTrack = this.canvasStream?.getVideoTracks()[0];

    const diag: FilterDiagnostics = {
      activeFilter: this.activeFilter,
      visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'unknown',
      cameraTrackState: rawTrack ? rawTrack.readyState : 'none',
      filteredTrackState: canvasTrack ? canvasTrack.readyState : 'none',
      canvasWidth: this.currentWidth,
      canvasHeight: this.currentHeight,
      canvasFps: this.currentFps,
      detectionsPerSec: this.currentDps,
      hasFace: this.latestLandmarks !== null,
      timestamp: Date.now(),
    };

    if (typeof window !== 'undefined') {
      (window as unknown as { __UMO_FILTER_DIAGNOSTICS__?: FilterDiagnostics }).__UMO_FILTER_DIAGNOSTICS__ = diag;
    }

    return diag;
  }

  /**
   * Diagnostic logger to inspect camera framing, canvas dimensions, and track settings
   */
  private logDiagnostics(label: string): void {
    const diag = this.getDiagnostics();
    console.log(`[FilterManager-Diagnostics] ${label}:`, diag);
  }

  /**
   * Switches or updates the active face filter.
   * Handles asynchronous loading, rapid clicking, and seamless WebRTC track replacement.
   */
  async setFilter(filterId: FilterId, stream?: MediaStream | null): Promise<FilterSwitchResult> {
    const currentSeq = ++this.switchSequence;

    if (stream) {
      this.rawStream = stream;
    }

    const previousFilter = this.activeFilter;
    this.activeFilter = filterId;

    // CASE 1: Turning off filter ("none")
    if (filterId === 'none') {
      this.stopProcessing();
      if (this.scene) {
        this.scene.setFilter('none');
      }

      this.logDiagnostics('Filter Disabled (None)');
      const rawTrack = this.rawStream ? this.rawStream.getVideoTracks()[0] || null : null;
      return {
        filteredStream: this.rawStream,
        videoTrack: rawTrack,
        changedTrack: previousFilter !== 'none',
      };
    }

    // CASE 2: Switching between two active filters ('dog-face' <-> 'sunglasses')
    // If the pipeline is already rendering, simply swap the 3D scene mesh with 0 WebRTC renegotiation
    if (previousFilter !== 'none' && this.isProcessing && this.canvasStream && this.scene) {
      this.scene.setFilter(filterId);
      this.logDiagnostics(`Filter Swapped (${previousFilter} -> ${filterId})`);
      const canvasTrack = this.canvasStream.getVideoTracks()[0] || null;
      return {
        filteredStream: this.combinedStream,
        videoTrack: canvasTrack,
        changedTrack: false, // Same canvas track; remote sees swap with 0 WebRTC renegotiation
      };
    }

    // CASE 3: Enabling filter from "none"
    if (!this.rawStream) {
      console.warn('[FilterManager] No camera stream available yet to apply filter.');
      return {
        filteredStream: null,
        videoTrack: null,
        changedTrack: false,
      };
    }

    try {
      // 1. Initialize MediaPipe Face Landmarker if not ready
      if (!this.landmarkerService.isReady()) {
        this.notifyUser('Initializing AR Face Landmarker...');
        const ready = await this.landmarkerService.initialize();

        // Check if user clicked something else while waiting
        if (currentSeq !== this.switchSequence) {
          return { filteredStream: null, videoTrack: null, changedTrack: false };
        }

        if (!ready) {
          this.notifyUser('AR Filter could not be loaded on this device.');
          this.activeFilter = 'none';
          return {
            filteredStream: this.rawStream,
            videoTrack: this.rawStream.getVideoTracks()[0] || null,
            changedTrack: true,
          };
        }
      }

      // 2. Setup In-Viewport Video Source and wait for intrinsic dimensions
      await this.ensureHiddenVideo(this.rawStream);

      // Check race condition
      if (currentSeq !== this.switchSequence) {
        return { filteredStream: null, videoTrack: null, changedTrack: false };
      }

      // 3. Setup Canvas and Three.js Scene strictly using camera intrinsic dimensions
      this.ensureCanvasAndScene();
      this.scene!.setFilter(filterId);

      // 4. Start Render and Inference Loops
      this.startProcessing();

      this.logDiagnostics(`Filter Activated (${filterId})`);
      const canvasTrack = this.canvasStream!.getVideoTracks()[0] || null;
      return {
        filteredStream: this.combinedStream,
        videoTrack: canvasTrack,
        changedTrack: true,
      };
    } catch (err) {
      console.error('[FilterManager] Failed to start filter:', err);
      this.notifyUser('Error starting filter. Reverting to standard camera.');
      this.activeFilter = 'none';
      this.stopProcessing();
      return {
        filteredStream: this.rawStream,
        videoTrack: this.rawStream?.getVideoTracks()[0] || null,
        changedTrack: true,
      };
    }
  }

  /**
   * Mounts in-viewport video element to reliably play input MediaStream without browser decoder throttling
   */
  private async ensureHiddenVideo(stream: MediaStream): Promise<void> {
    if (!this.hiddenVideo) {
      this.hiddenVideo = document.createElement('video');
      this.hiddenVideo.muted = true;
      this.hiddenVideo.autoplay = true;
      this.hiddenVideo.setAttribute('playsinline', '');
      this.hiddenVideo.setAttribute('muted', '');

      // CRITICAL FOR BROWSER THROTTLING PREVENTION:
      // Using opacity: 0.01 and in-viewport layout positioning (bottom: 0, right: 0)
      // prevents Chromium's "BackgroundVideoTrackOptimization" from suspending the video decoder.
      this.hiddenVideo.style.position = 'fixed';
      this.hiddenVideo.style.bottom = '0';
      this.hiddenVideo.style.right = '0';
      this.hiddenVideo.style.width = '4px';
      this.hiddenVideo.style.height = '4px';
      this.hiddenVideo.style.opacity = '0.01';
      this.hiddenVideo.style.pointerEvents = 'none';
      this.hiddenVideo.style.zIndex = '-9999';

      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(this.hiddenVideo);
      }
    }

    if (this.hiddenVideo.srcObject !== stream) {
      this.hiddenVideo.srcObject = stream;
    }

    // Wait for video metadata so intrinsic dimensions (videoWidth, videoHeight) are ready
    if (this.hiddenVideo.readyState < 1) {
      await new Promise<void>((resolve) => {
        const onLoaded = () => {
          this.hiddenVideo?.removeEventListener('loadedmetadata', onLoaded);
          resolve();
        };
        this.hiddenVideo?.addEventListener('loadedmetadata', onLoaded);
        setTimeout(resolve, 400);
      });
    }

    await this.hiddenVideo.play().catch((err) => {
      console.warn('[FilterManager] Video element play error:', err);
    });

    // Fallback polling if metadata was slightly delayed
    let waitCount = 0;
    while ((!this.hiddenVideo.videoWidth || !this.hiddenVideo.videoHeight) && waitCount < 10) {
      await new Promise((r) => setTimeout(r, 40));
      waitCount++;
    }
  }

  /**
   * Initializes off-screen Canvas, Three.js FilterScene, and WebRTC captured stream
   * using strictly the intrinsic camera dimensions with pixelRatio = 1.0 to prevent zooming
   */
  private ensureCanvasAndScene(): void {
    const { width: exactW, height: exactH } = this.getIntrinsicDimensions();
    this.currentWidth = exactW;
    this.currentHeight = exactH;

    if (!this.outputCanvas) {
      this.outputCanvas = document.createElement('canvas');
      this.outputCanvas.width = exactW;
      this.outputCanvas.height = exactH;

      // Keep in DOM layer to ensure WebGL damages are composited
      this.outputCanvas.style.position = 'fixed';
      this.outputCanvas.style.bottom = '0';
      this.outputCanvas.style.left = '0';
      this.outputCanvas.style.width = '4px';
      this.outputCanvas.style.height = '4px';
      this.outputCanvas.style.opacity = '0.001';
      this.outputCanvas.style.pointerEvents = 'none';
      this.outputCanvas.style.zIndex = '-9998';

      if (typeof document !== 'undefined' && document.body) {
        document.body.appendChild(this.outputCanvas);
      }
    } else if (this.outputCanvas.width !== exactW || this.outputCanvas.height !== exactH) {
      this.outputCanvas.width = exactW;
      this.outputCanvas.height = exactH;
    }

    if (!this.scene) {
      this.scene = new FilterScene({
        canvas: this.outputCanvas,
        width: exactW,
        height: exactH,
      });
      if (this.hiddenVideo) {
        this.scene.setupVideoBackground(this.hiddenVideo);
      }
    } else {
      this.scene.resize(exactW, exactH);
      if (this.hiddenVideo) {
        this.scene.setupVideoBackground(this.hiddenVideo);
      }
    }

    // Capture Canvas stream at 30 FPS matching intrinsic video track dimensions
    if (!this.canvasStream) {
      try {
        const captureStreamFn =
          this.outputCanvas.captureStream?.bind(this.outputCanvas) ||
          (this.outputCanvas as unknown as { mozCaptureStream?: (fps: number) => MediaStream }).mozCaptureStream?.bind(this.outputCanvas);

        if (captureStreamFn) {
          this.canvasStream = captureStreamFn(30);
        } else {
          throw new Error('canvas.captureStream is not supported in this browser');
        }
      } catch (err) {
        console.error('[FilterManager] Failed to capture canvas stream:', err);
        throw err;
      }
    }

    // Build combined stream (Canvas Video Track + Microphone Audio Track)
    const videoTrack = this.canvasStream.getVideoTracks()[0];
    const combined = new MediaStream([videoTrack]);
    if (this.rawStream) {
      const audioTracks = this.rawStream.getAudioTracks();
      audioTracks.forEach((t) => combined.addTrack(t));
    }
    this.combinedStream = combined;
  }

  /**
   * Explicitly signals the CanvasCaptureMediaStreamTrack that a new frame has been drawn
   */
  private triggerCaptureFrame(): void {
    if (this.canvasStream) {
      const track = this.canvasStream.getVideoTracks()[0];
      if (track && typeof (track as unknown as { requestFrame?: () => void }).requestFrame === 'function') {
        try {
          (track as unknown as { requestFrame: () => void }).requestFrame();
        } catch {
          // ignore
        }
      }
    }
  }

  /**
   * Renders a single camera video frame with AR filter overlay
   */
  private renderFrame(timestamp: number): void {
    if (!this.isProcessing || this.activeFilter === 'none' || this.isRendering) {
      return;
    }

    this.isRendering = true;
    try {
      if (this.hiddenVideo && this.hiddenVideo.readyState >= 2 && this.scene) {
        const vw = this.hiddenVideo.videoWidth;
        const vh = this.hiddenVideo.videoHeight;

        // If camera intrinsic resolution dynamically updates, resize canvas and scene without stretching
        if (vw > 0 && vh > 0 && (this.currentWidth !== vw || this.currentHeight !== vh)) {
          this.currentWidth = vw;
          this.currentHeight = vh;
          if (this.outputCanvas) {
            this.outputCanvas.width = vw;
            this.outputCanvas.height = vh;
          }
          this.scene.resize(vw, vh);
        }

        const delta = Math.min(0.1, (timestamp - this.lastRenderTimestamp) / 1000);
        this.lastRenderTimestamp = timestamp;

        // Render camera background + AR filter overlay
        this.scene.updateAndRender(this.latestLandmarks, delta);

        // Notify WebRTC capture handler of fresh frame
        this.triggerCaptureFrame();

        this.frameRenderCount++;
      }
    } finally {
      this.isRendering = false;
    }
  }

  /**
   * Runs facial landmark detection independently from rendering
   */
  private runInference(timestamp: number): void {
    if (!this.isProcessing || this.activeFilter === 'none' || this.isInferenceBusy) {
      return;
    }

    if (!this.hiddenVideo || this.hiddenVideo.readyState < 2) {
      return;
    }

    this.isInferenceBusy = true;
    try {
      const result = this.landmarkerService.detect(this.hiddenVideo, timestamp);
      if (result) {
        this.latestLandmarks = result.faceLandmarks?.[0] || null;
        this.detectionCount++;
      }
    } catch (err) {
      console.warn('[FilterManager] Inference error:', err);
    } finally {
      this.isInferenceBusy = false;
    }
  }

  /**
   * Starts the decoupled Render and Inference loops
   */
  private startProcessing(): void {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.lastRenderTimestamp = performance.now();
    this.lastFpsCalcTime = performance.now();
    this.frameRenderCount = 0;
    this.detectionCount = 0;

    // 1. Primary Video Driver: requestVideoFrameCallback on the video element
    const scheduleNextVideoFrame = () => {
      if (!this.isProcessing || this.activeFilter === 'none' || !this.hiddenVideo) return;
      if ('requestVideoFrameCallback' in this.hiddenVideo) {
        this.videoCallbackId = (this.hiddenVideo as unknown as {
          requestVideoFrameCallback: (cb: (now: number, meta: unknown) => void) => number;
        }).requestVideoFrameCallback((now) => {
          this.renderFrame(now);
          scheduleNextVideoFrame();
        });
      }
    };
    scheduleNextVideoFrame();

    // 2. Animation loop via requestAnimationFrame (ensures rendering if rVFC is unsupported or delayed)
    const animLoop = (timestamp: number) => {
      if (!this.isProcessing || this.activeFilter === 'none') {
        this.animFrameId = null;
        return;
      }

      // If at least 25ms have passed since the last render, render via rAF
      if (timestamp - this.lastRenderTimestamp >= 25) {
        this.renderFrame(timestamp);
      }

      this.animFrameId = requestAnimationFrame(animLoop);
    };
    this.animFrameId = requestAnimationFrame(animLoop);

    // 3. Background / Blurring Watchdog Interval
    // Keeps WebRTC transmission alive at ~30 FPS even if the window is blurred or throttled
    this.watchdogIntervalId = setInterval(() => {
      if (!this.isProcessing || this.activeFilter === 'none') return;
      const now = performance.now();
      if (now - this.lastRenderTimestamp > 38) {
        this.renderFrame(now);
      }
    }, 33);

    // 4. Independent Facial Inference Loop (~20 FPS target)
    this.inferenceIntervalId = setInterval(() => {
      if (!this.isProcessing || this.activeFilter === 'none') return;
      const now = performance.now();
      this.runInference(now);
    }, 50);

    // 5. Diagnostics Monitor (every 1 second for rate calculation, logged every 3s)
    let diagLogCounter = 0;
    this.diagnosticsIntervalId = setInterval(() => {
      if (!this.isProcessing || this.activeFilter === 'none') return;
      const now = performance.now();
      const elapsedSec = (now - this.lastFpsCalcTime) / 1000;
      if (elapsedSec > 0.5) {
        this.currentFps = Math.round(this.frameRenderCount / elapsedSec);
        this.currentDps = Math.round(this.detectionCount / elapsedSec);
        this.frameRenderCount = 0;
        this.detectionCount = 0;
        this.lastFpsCalcTime = now;
      }

      diagLogCounter++;
      if (diagLogCounter >= 3) {
        diagLogCounter = 0;
        const diag = this.getDiagnostics();
        console.log(`[FilterManager-LiveStats] FPS: ${diag.canvasFps}, DPS: ${diag.detectionsPerSec}, Filter: ${diag.activeFilter}, Visibility: ${diag.visibilityState}`);
      }
    }, 1000);
  }

  /**
   * Pauses loops to release CPU/GPU when filters are disabled
   */
  private stopProcessing(): void {
    this.isProcessing = false;

    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.videoCallbackId !== null && this.hiddenVideo && 'cancelVideoFrameCallback' in this.hiddenVideo) {
      (this.hiddenVideo as unknown as { cancelVideoFrameCallback: (id: number) => void }).cancelVideoFrameCallback(this.videoCallbackId);
      this.videoCallbackId = null;
    }

    if (this.watchdogIntervalId !== null) {
      clearInterval(this.watchdogIntervalId);
      this.watchdogIntervalId = null;
    }

    if (this.inferenceIntervalId !== null) {
      clearInterval(this.inferenceIntervalId);
      this.inferenceIntervalId = null;
    }

    if (this.diagnosticsIntervalId !== null) {
      clearInterval(this.diagnosticsIntervalId);
      this.diagnosticsIntervalId = null;
    }

    this.latestLandmarks = null;
    this.currentFps = 0;
    this.currentDps = 0;
  }

  /**
   * Complete teardown on application stop or page unload
   */
  destroy(): void {
    this.stopProcessing();

    if (this.scene) {
      this.scene.destroy();
      this.scene = null;
    }

    if (this.canvasStream) {
      this.canvasStream.getTracks().forEach((t) => t.stop());
      this.canvasStream = null;
    }

    if (this.combinedStream) {
      this.combinedStream.getTracks().forEach((t) => t.stop());
      this.combinedStream = null;
    }

    if (this.outputCanvas && this.outputCanvas.parentNode) {
      this.outputCanvas.parentNode.removeChild(this.outputCanvas);
      this.outputCanvas = null;
    }

    if (this.hiddenVideo) {
      this.hiddenVideo.pause();
      this.hiddenVideo.srcObject = null;
      if (this.hiddenVideo.parentNode) {
        this.hiddenVideo.parentNode.removeChild(this.hiddenVideo);
      }
      this.hiddenVideo = null;
    }

    this.landmarkerService.close();
    this.rawStream = null;
    this.activeFilter = 'none';
  }
}

export const filterManager = new FilterManager();
