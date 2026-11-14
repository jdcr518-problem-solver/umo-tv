import * as THREE from 'three';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Procedural Futuristic Neon Sunglasses AR Filter
 * Features glowing cyberpunk frames, dark tinted specular lenses,
 * side cyber-arms, and smooth 3D tracking aligned to eyes and nose bridge.
 */
export class SunglassesFilter {
  public group: THREE.Group;

  // Smoothing state
  private currentPos = new THREE.Vector3();
  private currentQuat = new THREE.Quaternion();
  private currentScale = 1;
  private hasInitializedTracking = false;
  private framesWithoutFace = 0;

  // Neon pulse animation
  private pulseClock = 0;
  private neonRimMaterial!: THREE.MeshStandardMaterial;
  private neonAccentMaterial!: THREE.MeshBasicMaterial;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'NeonSunglassesFilter';
    this.group.visible = false;

    this.buildSunglasses();
  }

  private buildSunglasses(): void {
    // 1. Materials
    this.neonRimMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0ff, // Electric Cyan
      emissive: 0x00f0ff,
      emissiveIntensity: 1.6,
      roughness: 0.2,
      metalness: 0.8,
    });

    this.neonAccentMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0088, // Hot Neon Pink / Magenta Accent
    });

    const frameChassisMaterial = new THREE.MeshStandardMaterial({
      color: 0x0f172a, // Dark Matte Titanium Chassis
      roughness: 0.35,
      metalness: 0.85,
    });

    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x050811, // Deep Dark Tinted Polycarbonate
      transparent: true,
      opacity: 0.82,
      roughness: 0.08,
      metalness: 0.9,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
    });

    const glareMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });

    // 2. Left & Right Lenses (Angular Cyber Hexagon Shape)
    const lensShape = new THREE.Shape();
    // Angular cyber polygon
    lensShape.moveTo(-32, 14);
    lensShape.lineTo(26, 14);
    lensShape.lineTo(34, 4);
    lensShape.lineTo(24, -14);
    lensShape.lineTo(-24, -14);
    lensShape.lineTo(-34, -2);
    lensShape.closePath();

    const lensExtrude: THREE.ExtrudeGeometryOptions = {
      depth: 2,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 1,
      bevelThickness: 1,
    };

    // Left Lens
    const leftLensGeom = new THREE.ExtrudeGeometry(lensShape, lensExtrude);
    leftLensGeom.center();
    const leftLens = new THREE.Mesh(leftLensGeom, lensMaterial);
    leftLens.position.set(-38, 0, 0);
    this.group.add(leftLens);

    // Right Lens (Mirrored)
    const rightLensGeom = new THREE.ExtrudeGeometry(lensShape, lensExtrude);
    rightLensGeom.center();
    const rightLens = new THREE.Mesh(rightLensGeom, lensMaterial);
    rightLens.position.set(38, 0, 0);
    rightLens.scale.x = -1; // Mirror horizontally
    this.group.add(rightLens);

    // 3. Cyberpunk Neon Rims (Extruded contours around lenses)
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-33, 15);
    rimShape.lineTo(27, 15);
    rimShape.lineTo(35, 4);
    rimShape.lineTo(25, -15);
    rimShape.lineTo(-25, -15);
    rimShape.lineTo(-35, -2);
    rimShape.closePath();

    // Hole inside to form rim border
    const rimHole = new THREE.Path();
    rimHole.moveTo(-30, 12);
    rimHole.lineTo(24, 12);
    rimHole.lineTo(31, 3);
    rimHole.lineTo(22, -12);
    rimHole.lineTo(-22, -12);
    rimHole.lineTo(-31, -2);
    rimHole.closePath();
    rimShape.holes.push(rimHole);

    const rimExtrude: THREE.ExtrudeGeometryOptions = {
      depth: 4.5,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 1.2,
      bevelThickness: 1.2,
    };

    const leftRimGeom = new THREE.ExtrudeGeometry(rimShape, rimExtrude);
    leftRimGeom.center();
    const leftRim = new THREE.Mesh(leftRimGeom, this.neonRimMaterial);
    leftRim.position.set(-38, 0, 2);
    this.group.add(leftRim);

    const rightRimGeom = new THREE.ExtrudeGeometry(rimShape, rimExtrude);
    rightRimGeom.center();
    const rightRim = new THREE.Mesh(rightRimGeom, this.neonRimMaterial);
    rightRim.position.set(38, 0, 2);
    rightRim.scale.x = -1;
    this.group.add(rightRim);

    // 4. Center Bridge (Over nose bridge)
    const bridgeGeom = new THREE.BoxGeometry(22, 6, 5);
    const bridgeMesh = new THREE.Mesh(bridgeGeom, frameChassisMaterial);
    bridgeMesh.position.set(0, 5, 2);
    this.group.add(bridgeMesh);

    // Neon Accent on Bridge
    const bridgeNeonGeom = new THREE.BoxGeometry(16, 2, 6);
    const bridgeNeon = new THREE.Mesh(bridgeNeonGeom, this.neonAccentMaterial);
    bridgeNeon.position.set(0, 5, 2.5);
    this.group.add(bridgeNeon);

    // 5. Top Brow Bar / Cyber Visor Line
    const browBarGeom = new THREE.BoxGeometry(154, 4.5, 4.5);
    const browBar = new THREE.Mesh(browBarGeom, frameChassisMaterial);
    browBar.position.set(0, 15, 2);
    this.group.add(browBar);

    // Glowing Neon Stripe on Brow Bar
    const browNeonGeom = new THREE.BoxGeometry(148, 1.8, 5.5);
    const browNeon = new THREE.Mesh(browNeonGeom, this.neonRimMaterial);
    browNeon.position.set(0, 15, 2.5);
    this.group.add(browNeon);

    // 6. Side Arms / Cyber Temples (Extending back towards ears)
    const armGeom = new THREE.BoxGeometry(4, 7, 65);

    const leftArm = new THREE.Mesh(armGeom, frameChassisMaterial);
    leftArm.position.set(-76, 8, -30);
    leftArm.rotation.y = 0.08;
    this.group.add(leftArm);

    const rightArm = new THREE.Mesh(armGeom, frameChassisMaterial);
    rightArm.position.set(76, 8, -30);
    rightArm.rotation.y = -0.08;
    this.group.add(rightArm);

    // Neon Strips along Side Arms
    const armNeonGeom = new THREE.BoxGeometry(1.5, 2, 55);
    const leftArmNeon = new THREE.Mesh(armNeonGeom, this.neonAccentMaterial);
    leftArmNeon.position.set(-78.5, 8, -25);
    leftArmNeon.rotation.y = 0.08;
    this.group.add(leftArmNeon);

    const rightArmNeon = new THREE.Mesh(armNeonGeom, this.neonAccentMaterial);
    rightArmNeon.position.set(78.5, 8, -25);
    rightArmNeon.rotation.y = -0.08;
    this.group.add(rightArmNeon);

    // 7. Diagonal Glare / Specular Sheen Stripe across Lenses
    const glareGeom = new THREE.PlaneGeometry(12, 38);
    const leftGlare = new THREE.Mesh(glareGeom, glareMaterial);
    leftGlare.position.set(-42, 0, 3.5);
    leftGlare.rotation.z = -Math.PI / 4;
    this.group.add(leftGlare);

    const rightGlare = new THREE.Mesh(glareGeom, glareMaterial);
    rightGlare.position.set(34, 0, 3.5);
    rightGlare.rotation.z = -Math.PI / 4;
    this.group.add(rightGlare);
  }

  /**
   * Update sunglasses filter position, orientation, and scale from MediaPipe facial landmarks
   */
  update(
    landmarks: NormalizedLandmark[] | null,
    canvasWidth: number,
    canvasHeight: number,
    delta: number = 0.016
  ): void {
    // Animate subtle neon pulse
    this.pulseClock += delta * 3.5;
    const pulse = 1.4 + Math.sin(this.pulseClock) * 0.35;
    this.neonRimMaterial.emissiveIntensity = pulse;

    if (!landmarks || landmarks.length < 468) {
      this.framesWithoutFace++;
      if (this.framesWithoutFace > 6) {
        this.group.visible = false;
        this.hasInitializedTracking = false;
      }
      return;
    }

    this.framesWithoutFace = 0;
    this.group.visible = true;

    // Helper: Normalized to Pixel Space centered at origin
    const toPx = (lm: NormalizedLandmark): THREE.Vector3 => {
      return new THREE.Vector3(
        (lm.x - 0.5) * canvasWidth,
        (0.5 - lm.y) * canvasHeight,
        -lm.z * canvasWidth * 0.75
      );
    };

    // Key Landmarks
    const noseBridge = toPx(landmarks[168]); // Bridge between eyes
    const leftEyeOuter = toPx(landmarks[33]);
    const rightEyeOuter = toPx(landmarks[263]);
    const chin = toPx(landmarks[152]);
    const forehead = toPx(landmarks[10]);

    // 1. Calculate Face Scale (Inter-pupillary distance)
    const eyeDist = leftEyeOuter.distanceTo(rightEyeOuter);
    // Glasses base model has width ~160px; scale accordingly
    const targetScale = Math.max(0.4, (eyeDist / 80) * 0.95);

    // 2. Construct 3D Face Coordinate Basis
    // Right Vector (Left eye to Right eye)
    const rightVec = new THREE.Vector3().subVectors(rightEyeOuter, leftEyeOuter).normalize();
    // Up Vector (Chin to Forehead)
    const upVec = new THREE.Vector3().subVectors(forehead, chin).normalize();
    // Forward Normal (Cross product)
    const forwardVec = new THREE.Vector3().crossVectors(rightVec, upVec).normalize();
    // Re-orthogonalize Up Vector
    upVec.crossVectors(forwardVec, rightVec).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(rightVec, upVec, forwardVec);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    // 3. Position Sunglasses: Resting on bridge of nose, slightly forward in normal direction
    const targetPos = noseBridge
      .clone()
      .addScaledVector(forwardVec, targetScale * 14)
      .addScaledVector(upVec, targetScale * 1.5);

    // 4. Smooth Lerp/Slerp Interpolation
    const alpha = this.hasInitializedTracking ? 0.42 : 1.0;
    this.currentScale += (targetScale - this.currentScale) * alpha;
    this.currentPos.lerp(targetPos, alpha);
    this.currentQuat.slerp(targetQuat, alpha);

    this.hasInitializedTracking = true;

    // 5. Apply Transforms
    this.group.position.copy(this.currentPos);
    this.group.quaternion.copy(this.currentQuat);
    this.group.scale.setScalar(this.currentScale);
  }

  reset(): void {
    this.hasInitializedTracking = false;
    this.framesWithoutFace = 0;
    this.group.visible = false;
  }
}
