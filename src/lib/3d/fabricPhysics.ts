/**
 * Advanced Fabric Physics System
 * Adds realistic cloth behavior: stretch zones, weight, collision, seam tension
 */

import * as THREE from 'three';

/**
 * Apply stretch zones - fabric stretches differently across body regions
 * Tight areas (chest, shoulders) stretch more, loose areas stretch less
 */
export function applyStretchZones(
  geometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh
): void {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  // Get avatar for raycasting (detect proximity to body)
  const raycaster = new THREE.Raycaster();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const height = bbox.max.y - bbox.min.y;

  let stretchCount = 0;

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);

    // Cast ray inward to find distance to body
    raycaster.set(vertex, normal.clone().negate());
    const intersections = raycaster.intersectObject(avatarMesh, true);

    if (intersections.length > 0) {
      const distanceToBody = intersections[0].distance;

      // If very close to body (< 2cm), fabric is stretched tight
      if (distanceToBody < 0.02) {
        const normalizedY = (vertex.y - bbox.min.y) / height;

        // Chest and shoulder areas stretch more when tight
        let stretchFactor = 1.0;
        if (normalizedY > 0.5 && normalizedY < 0.85) {
          // Chest area - pull tighter
          stretchFactor = 0.7;
        } else if (normalizedY >= 0.85) {
          // Shoulder area - very tight
          stretchFactor = 0.5;
        }

        // Pull vertex closer to body in stretched areas
        const pullAmount = distanceToBody * (1 - stretchFactor);
        vertex.x -= normal.x * pullAmount;
        vertex.y -= normal.y * pullAmount;
        vertex.z -= normal.z * pullAmount;

        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        stretchCount++;
      }
    }
  }

  geometry.computeVertexNormals();
  console.log(`[FabricPhysics] Applied stretch zones to ${stretchCount} vertices`);
}

/**
 * Enhanced collision response - push garment away from body with realistic force
 */
export function applyCollisionResponse(
  geometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh,
  minDistance: number = 0.015 // 1.5cm minimum clearance
): void {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  const raycaster = new THREE.Raycaster();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  let collisionCount = 0;
  let maxPushDistance = 0;

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);

    // Cast ray inward to detect body collision
    raycaster.set(vertex, normal.clone().negate());
    const intersections = raycaster.intersectObject(avatarMesh, true);

    if (intersections.length > 0) {
      const intersection = intersections[0];

      // If penetrating or too close, push outward
      if (intersection.distance < minDistance) {
        const pushDistance = minDistance - intersection.distance;

        // Add some elasticity - fabric pushes back more when compressed more
        const elasticFactor = 1.2;
        const actualPush = pushDistance * elasticFactor;

        vertex.x += normal.x * actualPush;
        vertex.y += normal.y * actualPush;
        vertex.z += normal.z * actualPush;

        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);

        collisionCount++;
        if (actualPush > maxPushDistance) {
          maxPushDistance = actualPush;
        }
      }
    }
  }

  if (collisionCount > 0) {
    geometry.computeVertexNormals();
    console.log(`[FabricPhysics] Resolved ${collisionCount} collisions (max push: ${(maxPushDistance * 100).toFixed(1)}cm)`);
  }
}

/**
 * Apply fabric weight simulation - heavier fabric drapes more at bottom
 */
export function applyFabricWeight(
  geometry: THREE.BufferGeometry,
  fabricType: 'light' | 'medium' | 'heavy' = 'medium'
): void {
  const positions = geometry.attributes.position;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const height = bbox.max.y - bbox.min.y;

  // Weight coefficients for different fabric types
  const weightFactors = {
    light: 0.008,   // Light cotton t-shirt
    medium: 0.015,  // Standard t-shirt
    heavy: 0.025,   // Heavy sweatshirt
  };

  const weightFactor = weightFactors[fabricType];

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const normalizedY = (y - bbox.min.y) / height;

    // Weight increases towards bottom (inverted Y)
    // But also consider distance from center (fabric hangs more at sides)
    const x = positions.getX(i);
    const z = positions.getZ(i);
    const distanceFromCenter = Math.sqrt(x * x + z * z);

    const verticalWeight = (1 - normalizedY) * weightFactor;
    const lateralWeight = distanceFromCenter * 0.3;

    const totalDrop = verticalWeight * (1 + lateralWeight);

    // Pull down by weight
    positions.setY(i, y - totalDrop);
  }

  geometry.computeVertexNormals();
  console.log(`[FabricPhysics] Applied ${fabricType} fabric weight`);
}

/**
 * Implement seam tension - fabric pulls and gathers at seams
 */
export function applySeamTension(
  geometry: THREE.BufferGeometry
): void {
  const positions = geometry.attributes.position;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const height = bbox.max.y - bbox.min.y;

  // Define seam lines (shoulders, sides)
  const shoulderY = bbox.min.y + height * 0.82;
  const seamTolerance = 0.05; // 5cm around seam

  let seamVertexCount = 0;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Shoulder seam (near shoulder height)
    if (Math.abs(y - shoulderY) < seamTolerance) {
      // Pull slightly inward (seam gathers fabric)
      const pullFactor = 0.95;
      positions.setX(i, x * pullFactor);
      positions.setZ(i, z * pullFactor);
      seamVertexCount++;
    }

    // Side seams (at maximum X positions, left and right)
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const angle = Math.atan2(z, x);

    // Side seams at ±90 degrees (sides of body)
    if (Math.abs(Math.abs(angle) - Math.PI / 2) < 0.3) {
      // Create slight inward pull at sides (seam tension)
      const inwardPull = 0.003; // 3mm
      const normalizedDist = distanceFromCenter;

      const pullX = -Math.sign(x) * inwardPull;
      positions.setX(i, x + pullX);
      seamVertexCount++;
    }
  }

  geometry.computeVertexNormals();
  console.log(`[FabricPhysics] Applied seam tension to ${seamVertexCount} vertices`);
}

/**
 * Add dynamic wrinkles based on body curvature and fabric compression
 */
export function applyDynamicWrinkles(
  geometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh,
  intensity: number = 0.004
): void {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  const raycaster = new THREE.Raycaster();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const height = bbox.max.y - bbox.min.y;

  let wrinkleCount = 0;

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);

    const normalizedY = (vertex.y - bbox.min.y) / height;

    // Cast ray to body to detect curvature
    raycaster.set(vertex, normal.clone().negate());
    const intersections = raycaster.intersectObject(avatarMesh, true);

    if (intersections.length > 0) {
      const distanceToBody = intersections[0].distance;

      // Areas closer to body (compressed) get more wrinkles
      let wrinkleFactor = 0;

      if (distanceToBody < 0.03) {
        // Very close - compressed area, lots of wrinkles
        wrinkleFactor = 1.0;
      } else if (distanceToBody < 0.06) {
        // Moderately close - some wrinkles
        wrinkleFactor = 0.5;
      }

      if (wrinkleFactor > 0) {
        // Create wrinkle pattern based on position
        const wrinklePattern =
          Math.sin(vertex.x * 40 + vertex.z * 30) *
          Math.cos(vertex.y * 35) *
          Math.sin(vertex.x * 60);

        const wrinkleDisplacement = wrinklePattern * intensity * wrinkleFactor;

        // Apply wrinkle perpendicular to normal (along surface)
        const perpX = -normal.z;
        const perpZ = normal.x;

        vertex.x += perpX * wrinkleDisplacement;
        vertex.z += perpZ * wrinkleDisplacement;

        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        wrinkleCount++;
      }
    }
  }

  geometry.computeVertexNormals();
  console.log(`[FabricPhysics] Applied dynamic wrinkles to ${wrinkleCount} vertices`);
}

/**
 * Apply complete physics pipeline for realistic fabric
 */
export function applyRealisticFabricPhysics(
  geometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh,
  options: {
    fabricType?: 'light' | 'medium' | 'heavy';
    enableStretch?: boolean;
    enableCollision?: boolean;
    enableWeight?: boolean;
    enableSeams?: boolean;
    enableDynamicWrinkles?: boolean;
  } = {}
): void {
  const {
    fabricType = 'medium',
    enableStretch = true,
    enableCollision = true,
    enableWeight = true,
    enableSeams = true,
    enableDynamicWrinkles = true,
  } = options;

  console.log('[FabricPhysics] Starting realistic physics pipeline...');

  // Step 1: Stretch zones (fabric stretches where tight)
  if (enableStretch) {
    applyStretchZones(geometry, avatarMesh);
  }

  // Step 2: Fabric weight (draping)
  if (enableWeight) {
    applyFabricWeight(geometry, fabricType);
  }

  // Step 3: Seam tension
  if (enableSeams) {
    applySeamTension(geometry);
  }

  // Step 4: Collision response (prevent body penetration)
  if (enableCollision) {
    applyCollisionResponse(geometry, avatarMesh, 0.015);
  }

  // Step 5: Dynamic wrinkles based on compression
  if (enableDynamicWrinkles) {
    applyDynamicWrinkles(geometry, avatarMesh, 0.004);
  }

  console.log('[FabricPhysics] Physics pipeline complete');
}
