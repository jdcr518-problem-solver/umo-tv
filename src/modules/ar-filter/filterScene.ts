import * as THREE from 'three';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { FilterId } from '@shared/types.js';
import { DogFilter } from './dogFilter.js';
import { SunglassesFilter } from './sunglassesFilter.js';

export interface FilterSceneOptions {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

/**
 * FilterScene
 * Manages Three.js WebGL context, 1:1 camera video background plane, lighting,
 * and AR 3D filter objects.
 *
 * CRITICAL FOR PRESERVING CAMERA FRAMING:
 * 1. Off-screen WebRTC video processing canvas MUST use pixelRatio = 1.0 (never devicePixelRatio).
 * 2. Canvas width & height MUST match the camera's exact intrinsic dimensions.
 * 3. Viewport and OrthographicCamera map 1:1 to canvas pixel coordinates without any cropping or zooming.
 */
export class FilterScene {
  private canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private videoTexture: THREE.VideoTexture | null = null;
  private backgroundMesh: THREE.Mesh | null = null;
  private width: number;
  private height: number;

  private dogFilter: DogFilter;
  private sunglassesFilter: SunglassesFilter;
  private activeFilter: FilterId = 'none';

  constructor(options: FilterSceneOptions) {
    this.canvas = options.canvas;
    this.width = options.width || 1280;
    this.height = options.height || 720;

    // 1. WebGL Renderer
    // IMPORTANT: pixelRatio MUST be strictly 1.0 to preserve 1:1 camera framing without zooming.
    // preserveDrawingBuffer MUST be true so canvas.captureStream() and WebRTC never capture empty buffers.
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(1.0);
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // 2. Three.js Scene
    this.scene = new THREE.Scene();

    // 3. Orthographic Camera (Maps 1:1 with canvas pixel space centered at 0,0)
    const halfW = this.width / 2;
    const halfH = this.height / 2;
    this.camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, -1000, 1000);
    this.camera.position.z = 500;
    this.scene.add(this.camera);

    // 4. Balanced lighting for AR filter overlays
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.5);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(0, 150, 400);
    this.scene.add(dirLight);

    const pointLight = new THREE.PointLight(0xffffff, 1.0, 600);
    pointLight.position.set(0, 0, 200);
    this.scene.add(pointLight);

    // 5. Filter Objects
    this.dogFilter = new DogFilter();
    this.scene.add(this.dogFilter.group);

    this.sunglassesFilter = new SunglassesFilter();
    this.scene.add(this.sunglassesFilter.group);
  }

  /**
   * Configures camera video feed as a 1:1 uncropped, unzoomed background plane
   */
  setupVideoBackground(video: HTMLVideoElement): void {
    if (this.videoTexture) {
      this.videoTexture.dispose();
    }
    if (this.backgroundMesh) {
      this.scene.remove(this.backgroundMesh);
      this.backgroundMesh.geometry.dispose();
      (this.backgroundMesh.material as THREE.Material).dispose();
    }

    this.videoTexture = new THREE.VideoTexture(video);
    this.videoTexture.colorSpace = THREE.SRGBColorSpace;
    this.videoTexture.minFilter = THREE.LinearFilter;
    this.videoTexture.magFilter = THREE.LinearFilter;
    this.videoTexture.generateMipmaps = false;

    // Plane geometry matches the exact intrinsic width & height of the video frame
    const bgGeom = new THREE.PlaneGeometry(this.width, this.height);
    const bgMat = new THREE.MeshBasicMaterial({
      map: this.videoTexture,
      depthTest: false,
      depthWrite: false,
    });

    this.backgroundMesh = new THREE.Mesh(bgGeom, bgMat);
    this.backgroundMesh.position.set(0, 0, -500);
    this.scene.add(this.backgroundMesh);
  }

  /**
   * Adjust resolution when input video intrinsic dimensions are confirmed or changed
   */
  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;
    this.width = width;
    this.height = height;

    this.renderer.setPixelRatio(1.0);
    this.renderer.setSize(width, height, false);
    this.renderer.setViewport(0, 0, width, height);

    const halfW = width / 2;
    const halfH = height / 2;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.updateProjectionMatrix();

    if (this.backgroundMesh) {
      this.backgroundMesh.geometry.dispose();
      this.backgroundMesh.geometry = new THREE.PlaneGeometry(width, height);
    }
  }

  setFilter(filterId: FilterId): void {
    this.activeFilter = filterId;

    if (filterId === 'dog-face') {
      this.dogFilter.reset();
      this.sunglassesFilter.reset();
      this.sunglassesFilter.group.visible = false;
    } else if (filterId === 'sunglasses') {
      this.dogFilter.reset();
      this.sunglassesFilter.reset();
      this.dogFilter.group.visible = false;
    } else {
      this.dogFilter.reset();
      this.sunglassesFilter.reset();
      this.dogFilter.group.visible = false;
      this.sunglassesFilter.group.visible = false;
    }
  }

  updateAndRender(
    landmarks: NormalizedLandmark[] | null,
    delta: number
  ): void {
    if (this.videoTexture) {
      this.videoTexture.needsUpdate = true;
    }

    if (this.activeFilter === 'dog-face') {
      this.dogFilter.update(landmarks, this.width, this.height);
    } else if (this.activeFilter === 'sunglasses') {
      this.sunglassesFilter.update(landmarks, this.width, this.height, delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy(): void {
    this.dogFilter.reset();
    this.sunglassesFilter.reset();

    if (this.backgroundMesh) {
      this.scene.remove(this.backgroundMesh);
      this.backgroundMesh.geometry.dispose();
      (this.backgroundMesh.material as THREE.Material).dispose();
      this.backgroundMesh = null;
    }

    if (this.videoTexture) {
      this.videoTexture.dispose();
      this.videoTexture = null;
    }

    this.renderer.dispose();
  }
}
