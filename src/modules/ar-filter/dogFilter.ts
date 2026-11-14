import * as THREE from 'three';
import type { NormalizedLandmark } from '@mediapipe/tasks-vision';

/**
 * Procedural Cartoon Dog Face Filter
 * Renders floppy puppy ears perched above the head and a cute glossy button nose on the nose tip,
 * using reliable canvas textures mapped to Three.js planar meshes with depthTest: false.
 * Immune to triangulation failures, normal inversions, lighting bugs, and Z-clipping.
 */
export class DogFilter {
  public group: THREE.Group;

  // Meshes & Anchors
  private noseMesh: THREE.Mesh;
  private leftEarGroup: THREE.Group;
  private rightEarGroup: THREE.Group;
  private leftEarMesh: THREE.Mesh;
  private rightEarMesh: THREE.Mesh;

  // Smoothing state
  private currentPos = new THREE.Vector3();
  private currentQuat = new THREE.Quaternion();
  private currentScale = 1;
  private hasInitializedTracking = false;
  private framesWithoutFace = 0;

  // Playful ear jiggle dynamics
  private earJiggleAngle = 0;
  private prevFaceCenterY = 0;
  private jiggleVelocity = 0;

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'DogFilter';
    this.group.visible = false;

    // 1. Build Cartoon Dog Nose
    this.noseMesh = this.createNoseMesh();
    this.noseMesh.name = 'CartoonDogNose';
    this.noseMesh.renderOrder = 10; // Ensure nose is always drawn on top of face
    this.group.add(this.noseMesh);

    // 2. Build Left and Right Floppy Puppy Ears
    const earTexture = this.generateEarTexture();

    // Left Ear (RenderOrder 5)
    this.leftEarGroup = new THREE.Group();
    this.leftEarGroup.name = 'LeftEar';
    this.leftEarMesh = this.createEarMesh(earTexture, false);
    this.leftEarMesh.renderOrder = 5;
    this.leftEarGroup.add(this.leftEarMesh);
    this.group.add(this.leftEarGroup);

    // Right Ear (RenderOrder 5)
    this.rightEarGroup = new THREE.Group();
    this.rightEarGroup.name = 'RightEar';
    this.rightEarMesh = this.createEarMesh(earTexture, true);
    this.rightEarMesh.renderOrder = 5;
    this.rightEarGroup.add(this.rightEarMesh);
    this.group.add(this.rightEarGroup);
  }

  /**
   * Generates a procedural high-res texture for the glossy cartoon dog nose
   */
  private generateNoseTexture(): THREE.CanvasTexture {
    if (typeof document === 'undefined') {
      const emptyCanvas = { width: 256, height: 256 } as unknown as HTMLCanvasElement;
      return new THREE.CanvasTexture(emptyCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, 256, 256);

      const cx = 128;
      const cy = 128;

      // 1. Snout Whisker Dots (Subtle dots on snout)
      ctx.fillStyle = 'rgba(50, 36, 28, 0.75)';
      const whiskerDots = [
        [-65, -8], [-85, 2], [-72, 16],
        [65, -8], [85, 2], [72, 16],
      ];
      whiskerDots.forEach(([dx, dy]) => {
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, 5, 0, Math.PI * 2);
        ctx.fill();
      });

      // 2. Main Nose Outer Shadow / Rim
      ctx.beginPath();
      ctx.moveTo(cx, cy + 46);
      ctx.bezierCurveTo(cx + 42, cy + 44, cx + 64, cy + 12, cx + 60, cy - 20);
      ctx.bezierCurveTo(cx + 56, cy - 48, cx + 22, cy - 52, cx, cy - 48);
      ctx.bezierCurveTo(cx - 22, cy - 48, cx - 56, cy - 48, cx - 60, cy - 20);
      ctx.bezierCurveTo(cx - 64, cy + 12, cx - 42, cy + 44, cx, cy + 46);
      ctx.closePath();

      // Rich chocolate-charcoal gradient
      const noseGrad = ctx.createLinearGradient(cx, cy - 48, cx, cy + 46);
      noseGrad.addColorStop(0, '#3a2d26');
      noseGrad.addColorStop(0.45, '#1e1613');
      noseGrad.addColorStop(1, '#0c0908');
      ctx.fillStyle = noseGrad;
      ctx.fill();

      ctx.lineWidth = 4;
      ctx.strokeStyle = '#050403';
      ctx.stroke();

      // 3. Left & Right Nostrils
      ctx.fillStyle = '#040302';
      // Left nostril
      ctx.beginPath();
      ctx.ellipse(cx - 24, cy + 10, 12, 7, -Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();
      // Right nostril
      ctx.beginPath();
      ctx.ellipse(cx + 24, cy + 10, 12, 7, Math.PI / 8, 0, Math.PI * 2);
      ctx.fill();

      // Center nose cleft line
      ctx.beginPath();
      ctx.moveTo(cx, cy + 6);
      ctx.lineTo(cx, cy + 42);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#040302';
      ctx.stroke();

      // 4. Large Glossy Specular Highlight (Upper Left)
      ctx.beginPath();
      ctx.ellipse(cx - 20, cy - 22, 16, 8, -Math.PI / 6, 0, Math.PI * 2);
      const glossGrad = ctx.createLinearGradient(cx - 28, cy - 28, cx - 12, cy - 16);
      glossGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      glossGrad.addColorStop(1, 'rgba(255, 255, 255, 0.15)');
      ctx.fillStyle = glossGrad;
      ctx.fill();

      // Secondary smaller highlight dot
      ctx.beginPath();
      ctx.arc(cx - 4, cy - 26, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      // Bottom subtle rim light
      ctx.beginPath();
      ctx.ellipse(cx, cy + 38, 24, 3.5, 0, 0, Math.PI);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Generates procedural high-res texture for floppy cartoon puppy ear
   */
  private generateEarTexture(): THREE.CanvasTexture {
    if (typeof document === 'undefined') {
      const emptyCanvas = { width: 256, height: 384 } as unknown as HTMLCanvasElement;
      return new THREE.CanvasTexture(emptyCanvas);
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.clearRect(0, 0, 256, 384);

      // Outer Ear Path (Golden Caramel Hound Ear, drooping downwards)
      ctx.beginPath();
      ctx.moveTo(70, 20); // Top attachment crown
      ctx.bezierCurveTo(120, 20, 185, 45, 215, 95);
      ctx.bezierCurveTo(245, 145, 240, 240, 210, 310);
      ctx.bezierCurveTo(180, 370, 110, 375, 75, 345);
      ctx.bezierCurveTo(35, 310, 25, 230, 35, 140);
      ctx.bezierCurveTo(42, 70, 52, 20, 70, 20);
      ctx.closePath();

      // Warm Golden Caramel gradient
      const outerGrad = ctx.createLinearGradient(128, 20, 128, 380);
      outerGrad.addColorStop(0, '#e58e32');
      outerGrad.addColorStop(0.35, '#c7721e');
      outerGrad.addColorStop(0.85, '#994a08');
      outerGrad.addColorStop(1, '#783804');
      ctx.fillStyle = outerGrad;
      ctx.fill();

      // Outer contour stroke
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#4a2003';
      ctx.stroke();

      // Inner Ear Pink Patch
      ctx.beginPath();
      ctx.moveTo(85, 70);
      ctx.bezierCurveTo(125, 70, 175, 95, 192, 145);
      ctx.bezierCurveTo(210, 195, 198, 265, 175, 305);
      ctx.bezierCurveTo(152, 345, 110, 340, 90, 315);
      ctx.bezierCurveTo(68, 285, 62, 215, 68, 145);
      ctx.bezierCurveTo(72, 95, 78, 70, 85, 70);
      ctx.closePath();

      const innerGrad = ctx.createLinearGradient(128, 70, 128, 340);
      innerGrad.addColorStop(0, '#fca5a5');
      innerGrad.addColorStop(0.4, '#f472b6');
      innerGrad.addColorStop(1, '#db2777');
      ctx.fillStyle = innerGrad;
      ctx.fill();

      ctx.lineWidth = 3.5;
      ctx.strokeStyle = 'rgba(180, 50, 90, 0.4)';
      ctx.stroke();

      // Cute inner highlight sheen
      ctx.beginPath();
      ctx.ellipse(115, 130, 18, 40, Math.PI / 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  private createNoseMesh(): THREE.Mesh {
    const noseTexture = this.generateNoseTexture();
    // 64px wide, 64px high plane
    const geom = new THREE.PlaneGeometry(64, 64);
    geom.center();

    const mat = new THREE.MeshBasicMaterial({
      map: noseTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = 'DogNosePlane';
    mesh.position.set(0, -32, 15);
    return mesh;
  }

  private createEarMesh(earTexture: THREE.CanvasTexture, isRight: boolean): THREE.Mesh {
    // 82px wide, 122px high floppy ear plane
    const geom = new THREE.PlaneGeometry(82, 122);
    // Shift pivot point to the top-crown attachment so the ear hangs downward-outward
    geom.translate(isRight ? 18 : -18, -50, 0);

    const mat = new THREE.MeshBasicMaterial({
      map: earTexture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.name = isRight ? 'RightEarMesh' : 'LeftEarMesh';
    if (isRight) {
      mesh.scale.x = -1; // Mirror horizontally for right side
    }
    return mesh;
  }

  /**
   * Update dog filter position, orientation, and scale from MediaPipe facial landmarks
   */
  update(
    landmarks: NormalizedLandmark[] | null,
    canvasWidth: number,
    canvasHeight: number
  ): void {
    if (!landmarks || landmarks.length < 400) {
      this.framesWithoutFace++;
      if (this.framesWithoutFace > 6) {
        this.group.visible = false;
        this.hasInitializedTracking = false;
      }
      return;
    }

    this.framesWithoutFace = 0;
    this.group.visible = true;

    // Helper: Convert normalized landmark (0-1) to pixel space centered at (0, 0)
    const toPx = (lm: NormalizedLandmark): THREE.Vector3 => {
      return new THREE.Vector3(
        (lm.x - 0.5) * canvasWidth,
        (0.5 - lm.y) * canvasHeight,
        -lm.z * canvasWidth * 0.75
      );
    };

    // Key Facial Landmarks
    const noseTip = toPx(landmarks[4] || landmarks[1]);
    const noseBridge = toPx(landmarks[168]);
    const leftEyeOuter = toPx(landmarks[33]);
    const rightEyeOuter = toPx(landmarks[263]);
    const chin = toPx(landmarks[152]);
    const forehead = toPx(landmarks[10]);

    // 1. Calculate Face Scale (Inter-pupillary distance)
    const eyeDist = leftEyeOuter.distanceTo(rightEyeOuter);
    // Standard inter-pupillary distance is ~80px at 720p; scale proportionally
    const targetScale = Math.max(0.4, (eyeDist / 82) * 1.0);

    // 2. Construct 3D Face Coordinate Basis (Rigid Head Rotation)
    // Right Vector (Left eye outer to Right eye outer)
    const rightVec = new THREE.Vector3().subVectors(rightEyeOuter, leftEyeOuter).normalize();
    // Up Vector (Chin to Forehead)
    const upVec = new THREE.Vector3().subVectors(forehead, chin).normalize();
    // Forward Vector (Normal)
    const forwardVec = new THREE.Vector3().crossVectors(rightVec, upVec).normalize();
    // Re-orthogonalize Up Vector
    upVec.crossVectors(forwardVec, rightVec).normalize();

    const rotMatrix = new THREE.Matrix4().makeBasis(rightVec, upVec, forwardVec);
    const targetQuat = new THREE.Quaternion().setFromRotationMatrix(rotMatrix);

    // 3. Anchor Target Position: On bridge of nose, slightly forward in normal direction
    const targetPos = noseBridge
      .clone()
      .addScaledVector(forwardVec, targetScale * 10);

    // 4. Calculate Playful Ear Jiggle Dynamics (Spring physics on head motion)
    const currentFaceCenterY = (forehead.y + chin.y) / 2;
    if (this.prevFaceCenterY === 0) {
      this.prevFaceCenterY = currentFaceCenterY;
    }
    const velY = currentFaceCenterY - this.prevFaceCenterY;
    this.prevFaceCenterY = currentFaceCenterY;

    // Spring-damper physics for playful ear flop
    const springForce = -this.earJiggleAngle * 0.22;
    const dampingForce = -this.jiggleVelocity * 0.28;
    const accel = springForce + dampingForce + Math.max(-0.25, Math.min(0.25, velY * 0.03));
    this.jiggleVelocity += accel;
    this.earJiggleAngle += this.jiggleVelocity;
    this.earJiggleAngle = Math.max(-0.35, Math.min(0.35, this.earJiggleAngle));

    // 5. Smooth Interpolation to eliminate jitter
    const alpha = this.hasInitializedTracking ? 0.45 : 1.0;
    this.currentScale += (targetScale - this.currentScale) * alpha;
    this.currentPos.lerp(targetPos, alpha);
    this.currentQuat.slerp(targetQuat, alpha);

    this.hasInitializedTracking = true;

    // 6. Apply Transforms to Root Group
    this.group.position.copy(this.currentPos);
    this.group.quaternion.copy(this.currentQuat);
    this.group.scale.setScalar(this.currentScale);

    // 7. Update Child Mesh Offsets within Face Coordinate Frame
    // Dog Nose: Sits directly over the user's nose tip (below bridge)
    const localNoseY = Math.min(-24, (noseTip.y - noseBridge.y) / targetScale);
    this.noseMesh.position.set(0, localNoseY, 15);

    // Floppy Puppy Ears: Attached at the top sides of the head / crown (well above forehead)
    // and droop outward and downward away from the eyes, framing the head cutely
    // Forehead height above nose bridge is ~75px; crown is at ~125px; sides at +/- 82px
    this.leftEarGroup.position.set(-82, 125, 4);
    this.leftEarGroup.rotation.z = 0.22 + this.earJiggleAngle;
    this.leftEarGroup.rotation.y = -0.15; // Flared slightly back

    this.rightEarGroup.position.set(82, 125, 4);
    this.rightEarGroup.rotation.z = -0.22 - this.earJiggleAngle;
    this.rightEarGroup.rotation.y = 0.15;
  }

  reset(): void {
    this.hasInitializedTracking = false;
    this.framesWithoutFace = 0;
    this.group.visible = false;
    this.prevFaceCenterY = 0;
    this.earJiggleAngle = 0;
    this.jiggleVelocity = 0;
  }
}
