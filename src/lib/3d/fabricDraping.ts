/**
 * Fabric Draping and Physics Simulation
 * Adds realistic fabric behavior: gravity, wrinkles, smoothing
 */

import * as THREE from 'three';

/**
 * Apply Laplacian smoothing to create natural fabric appearance
 * Reduces sharp edges and creates smooth fabric flow
 */
export function applyLaplacianSmoothing(
  geometry: THREE.BufferGeometry,
  iterations: number = 3,
  lambda: number = 0.5
): void {
  const positions = geometry.attributes.position;
  const tempPositions = new Float32Array(positions.count * 3);

  // Build adjacency map (which vertices are connected by edges)
  const adjacency = buildAdjacencyMap(geometry);

  for (let iter = 0; iter < iterations; iter++) {
    // Copy current positions
    for (let i = 0; i < positions.count; i++) {
      tempPositions[i * 3] = positions.getX(i);
      tempPositions[i * 3 + 1] = positions.getY(i);
      tempPositions[i * 3 + 2] = positions.getZ(i);
    }

    // For each vertex, move it toward the average of its neighbors
    for (let i = 0; i < positions.count; i++) {
      const neighbors = adjacency.get(i);
      if (!neighbors || neighbors.size === 0) continue;

      let avgX = 0, avgY = 0, avgZ = 0;

      for (const neighborIdx of neighbors) {
        avgX += tempPositions[neighborIdx * 3];
        avgY += tempPositions[neighborIdx * 3 + 1];
        avgZ += tempPositions[neighborIdx * 3 + 2];
      }

      avgX /= neighbors.size;
      avgY /= neighbors.size;
      avgZ /= neighbors.size;

      // Move vertex toward average position (controlled by lambda)
      const currentX = tempPositions[i * 3];
      const currentY = tempPositions[i * 3 + 1];
      const currentZ = tempPositions[i * 3 + 2];

      positions.setXYZ(
        i,
        currentX + (avgX - currentX) * lambda,
        currentY + (avgY - currentY) * lambda,
        currentZ + (avgZ - currentZ) * lambda
      );
    }
  }

  geometry.computeVertexNormals();
  console.log(`[FabricDraping] Applied Laplacian smoothing (${iterations} iterations, lambda=${lambda})`);
}

/**
 * Apply gravity simulation to create natural fabric drape
 */
export function applyGravityDrape(
  geometry: THREE.BufferGeometry,
  strength: number = 0.02
): void {
  const positions = geometry.attributes.position;

  // Compute bounding box to understand garment structure
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const garmentHeight = bbox.max.y - bbox.min.y;

  // Apply gravity: vertices lower on garment get pulled down more
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Normalized height (0 at bottom, 1 at top)
    const normalizedY = (y - bbox.min.y) / garmentHeight;

    // Bottom vertices get pulled down more (inverted weight)
    const gravityWeight = 1 - normalizedY;

    // Pull vertex down
    const newY = y - strength * gravityWeight * 0.1;

    positions.setY(i, newY);
  }

  geometry.computeVertexNormals();
  console.log(`[FabricDraping] Applied gravity drape (strength=${strength})`);
}

/**
 * Add subtle wrinkles and fabric variation for realism
 */
export function addFabricWrinkles(
  geometry: THREE.BufferGeometry,
  intensity: number = 0.005
): void {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const garmentHeight = bbox.max.y - bbox.min.y;

  // Use Perlin-like noise pattern (simplified)
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);

    // Normalized Y position
    const normalizedY = (y - bbox.min.y) / garmentHeight;

    // More wrinkles in middle/bottom (loose fabric)
    const wrinkleWeight = normalizedY < 0.7 ? (1 - normalizedY) : 0.3;

    // Pseudo-random displacement based on position
    const noise = (Math.sin(x * 50) * Math.cos(z * 50) + Math.sin(y * 30)) * 0.5;
    const displacement = noise * intensity * wrinkleWeight;

    // Displace along normal
    positions.setXYZ(
      i,
      x + nx * displacement,
      y + ny * displacement,
      z + nz * displacement
    );
  }

  geometry.computeVertexNormals();
  console.log(`[FabricDraping] Added fabric wrinkles (intensity=${intensity})`);
}

/**
 * Collision detection: ensure garment doesn't penetrate avatar body
 */
export function preventBodyCollisions(
  garmentGeometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh,
  minDistance: number = 0.01 // 1cm minimum distance
): void {
  const positions = garmentGeometry.attributes.position;
  const normals = garmentGeometry.attributes.normal;

  // Setup raycaster for collision detection
  const raycaster = new THREE.Raycaster();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();

  let collisionCount = 0;

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);

    // Cast ray from vertex inward (opposite to normal)
    raycaster.set(vertex, normal.clone().negate());

    // Check for intersections with avatar
    const intersections = raycaster.intersectObject(avatarMesh, true);

    if (intersections.length > 0) {
      const closestIntersection = intersections[0];

      // If too close to body, push outward
      if (closestIntersection.distance < minDistance) {
        const pushDistance = minDistance - closestIntersection.distance;

        vertex.x += normal.x * pushDistance;
        vertex.y += normal.y * pushDistance;
        vertex.z += normal.z * pushDistance;

        positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
        collisionCount++;
      }
    }
  }

  if (collisionCount > 0) {
    geometry.computeVertexNormals();
    console.log(`[FabricDraping] Resolved ${collisionCount} body collisions`);
  }
}

/**
 * Apply complete fabric draping pipeline
 */
export function applyCompleteFabricDraping(
  garmentGeometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh | null,
  options: {
    gravity?: boolean;
    gravityStrength?: number;
    wrinkles?: boolean;
    wrinkleIntensity?: number;
    smoothing?: boolean;
    smoothingIterations?: number;
    collisionDetection?: boolean;
  } = {}
): void {
  const {
    gravity = true,
    gravityStrength = 0.02,
    wrinkles = true,
    wrinkleIntensity = 0.005,
    smoothing = true,
    smoothingIterations = 2,
    collisionDetection = true,
  } = options;

  console.log('[FabricDraping] Starting complete draping pipeline...');

  // Step 1: Apply gravity for natural drape
  if (gravity) {
    applyGravityDrape(garmentGeometry, gravityStrength);
  }

  // Step 2: Add subtle wrinkles
  if (wrinkles) {
    addFabricWrinkles(garmentGeometry, wrinkleIntensity);
  }

  // Step 3: Smooth out sharp edges
  if (smoothing) {
    applyLaplacianSmoothing(garmentGeometry, smoothingIterations, 0.5);
  }

  // Step 4: Collision detection (if avatar available)
  if (collisionDetection && avatarMesh) {
    preventBodyCollisions(garmentGeometry, avatarMesh, 0.01);
  }

  console.log('[FabricDraping] Draping pipeline complete');
}

/**
 * Build adjacency map for Laplacian smoothing
 */
function buildAdjacencyMap(geometry: THREE.BufferGeometry): Map<number, Set<number>> {
  const adjacency = new Map<number, Set<number>>();
  const index = geometry.index;

  if (!index) {
    console.warn('[FabricDraping] Geometry must be indexed for smoothing');
    return adjacency;
  }

  // Initialize sets for all vertices
  const vertexCount = geometry.attributes.position.count;
  for (let i = 0; i < vertexCount; i++) {
    adjacency.set(i, new Set());
  }

  // Build adjacency from faces
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    // Each vertex is adjacent to the other two in the triangle
    adjacency.get(a)!.add(b);
    adjacency.get(a)!.add(c);
    adjacency.get(b)!.add(a);
    adjacency.get(b)!.add(c);
    adjacency.get(c)!.add(a);
    adjacency.get(c)!.add(b);
  }

  return adjacency;
}
