import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';

export type DetectorState = 'uninitialized' | 'loading' | 'ready' | 'error';

export interface FaceLandmarkerServiceOptions {
  onStateChange?: (state: DetectorState) => void;
  onError?: (error: Error) => void;
}

/**
 * Service wrapper for MediaPipe Face Landmarker
 * Configures VIDEO running mode, handles local asset loading with CDN fallbacks,
 * and manages GPU/CPU delegate fallbacks.
 */
export class FaceLandmarkerService {
  private landmarker: FaceLandmarker | null = null;
  private state: DetectorState = 'uninitialized';
  private lastInferenceTime = 0;
  private inferenceIntervalMs = 50; // Adaptive target: ~20 FPS inference
  private consecutiveSlowFrames = 0;
  private options: FaceLandmarkerServiceOptions;

  constructor(options: FaceLandmarkerServiceOptions = {}) {
    this.options = options;
  }

  getState(): DetectorState {
    return this.state;
  }

  isReady(): boolean {
    return this.state === 'ready' && this.landmarker !== null;
  }

  /**
   * Initializes FaceLandmarker with local assets and fallback options
   */
  async initialize(): Promise<boolean> {
    if (this.state === 'ready' && this.landmarker) return true;
    if (this.state === 'loading') return false;

    this.setState('loading');

    // 1. Resolve Wasm Fileset (Try local /wasm/ first, then CDN fallback)
    let visionFileset;
    try {
      visionFileset = await FilesetResolver.forVisionTasks('/wasm');
    } catch (localWasmErr) {
      console.warn('[FaceLandmarkerService] Local wasm failed, trying CDN fallback', localWasmErr);
      try {
        visionFileset = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
      } catch (cdnErr) {
        console.error('[FaceLandmarkerService] Both local and CDN wasm resolvers failed', cdnErr);
        this.setState('error');
        this.options.onError?.(new Error('Failed to load FaceLandmarker Wasm runtime'));
        return false;
      }
    }

    // 2. Initialize Landmarker (Try local model + GPU delegate, fallback to CPU delegate, fallback to CDN model)
    const modelCandidates = [
      { path: '/models/face_landmarker.task', delegate: 'GPU' as const },
      { path: '/models/face_landmarker.task', delegate: 'CPU' as const },
      {
        path: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'GPU' as const,
      },
      {
        path: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
        delegate: 'CPU' as const,
      },
    ];

    for (const candidate of modelCandidates) {
      try {
        this.landmarker = await FaceLandmarker.createFromOptions(visionFileset, {
          baseOptions: {
            modelAssetPath: candidate.path,
            delegate: candidate.delegate,
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
          minFaceDetectionConfidence: 0.5,
          minFacePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

        this.setState('ready');
        console.log(
          `[FaceLandmarkerService] Initialized successfully with ${candidate.delegate} delegate (${candidate.path})`
        );
        return true;
      } catch (err) {
        console.warn(`[FaceLandmarkerService] Failed candidate ${candidate.path} (${candidate.delegate})`, err);
      }
    }

    this.setState('error');
    this.options.onError?.(new Error('Failed to initialize MediaPipe Face Landmarker'));
    return false;
  }

  /**
   * Runs facial landmark detection on the current video frame if ready and interval has elapsed
   */
  detect(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult | null {
    if (!this.landmarker || this.state !== 'ready') return null;
    if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) return null;

    // Adaptive throttling: only run inference if enough time has elapsed
    const elapsed = timestamp - this.lastInferenceTime;
    if (elapsed < this.inferenceIntervalMs) {
      return null;
    }

    try {
      const startTime = performance.now();
      const result = this.landmarker.detectForVideo(video, timestamp);
      const duration = performance.now() - startTime;
      this.lastInferenceTime = timestamp;

      // Dynamically adjust inference frequency if inference is too heavy
      if (duration > 35) {
        this.consecutiveSlowFrames++;
        if (this.consecutiveSlowFrames > 10 && this.inferenceIntervalMs < 100) {
          // Drop to ~10-12 FPS inference to save CPU/battery on slower devices
          this.inferenceIntervalMs = Math.min(100, this.inferenceIntervalMs + 10);
          this.consecutiveSlowFrames = 0;
        }
      } else if (duration < 15 && this.inferenceIntervalMs > 50) {
        // Recover inference frequency if device is comfortably performing
        this.inferenceIntervalMs = Math.max(50, this.inferenceIntervalMs - 5);
        this.consecutiveSlowFrames = 0;
      }

      return result;
    } catch (err) {
      console.warn('[FaceLandmarkerService] Error during detection:', err);
      return null;
    }
  }

  getInferenceInterval(): number {
    return this.inferenceIntervalMs;
  }

  private setState(state: DetectorState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }

  close(): void {
    if (this.landmarker) {
      try {
        this.landmarker.close();
      } catch {
        // ignore
      }
      this.landmarker = null;
    }
    this.setState('uninitialized');
    this.lastInferenceTime = 0;
  }
}
