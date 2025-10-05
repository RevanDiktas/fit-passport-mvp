/**
 * Garment Fitting Engine
 * Implements PRD Stage 4: Basic Fitting
 * - Collision detection and resolution
 * - Fabric offset
 * - Mesh smoothing
 */

import * as THREE from 'three';

export interface FittingOptions {
  fabricOffset: number; // Fabric thickness in meters (default: 0.005 = 5mm)
  smoothingIterations: number; // Laplacian smoothing passes
  collisionSamples: number; // Raycasting samples per vertex
}

const DEFAULT_OPTIONS: FittingOptions = {
  fabricOffset: 0.005, // 5mm
  smoothingIterations: 3,
  collisionSamples: 8, // Cast rays in 8 directions
};

/**
 * Fit garment to avatar body using collision detection
 */
export function fitGarmentToBody(
  garmentMesh: THREE.Mesh,
  bodyMesh: THREE.Mesh,
  options: Partial<FittingOptions> = {}
): void {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  console.log('[GarmentFitting] Starting fit process');

  // Step 1: Resolve collisions (push garment away from body)
  resolveCollisions(garmentMesh, bodyMesh, opts.fabricOffset);

  // Step 2: Smooth mesh to remove artifacts
  laplacianSmoothing(garmentMesh, opts.smoothingIterations);

  // Step 3: Recalculate normals for proper lighting
  garmentMesh.geometry.computeVertexNormals();

  console.log('[GarmentFitting] Fit complete');
}

/**
 * Detect and resolve garment-body collisions
 * Uses raycasting to detect intersections and pushes vertices outward
 */
function resolveCollisions(
  garmentMesh: THREE.Mesh,
  bodyMesh: THREE.Mesh,
  offset: number
): void {
  const geometry = garmentMesh.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  if (!positions || !normals) {
    console.error('[GarmentFitting] Missing position or normal attributes');
    return;
  }

  const raycaster = new THREE.Raycaster();
  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const worldVertex = new THREE.Vector3();
  const worldNormal = new THREE.Vector3();

  // Convert body mesh to world space
  bodyMesh.updateMatrixWorld(true);
  garmentMesh.updateMatrixWorld(true);

  let collisionCount = 0;

  // Process each vertex
  for (let i = 0; i < positions.count; i++) {
    // Get vertex position and normal in local space
    vertex.fromBufferAttribute(positions, i);
    normal.fromBufferAttribute(normals, i);

    // Transform to world space
    worldVertex.copy(vertex).applyMatrix4(garmentMesh.matrixWorld);
    worldNormal.copy(normal).transformDirection(garmentMesh.matrixWorld).normalize();

    // Cast ray from vertex toward body (inward along normal)
    raycaster.set(worldVertex, worldNormal.clone().negate());
    raycaster.far = offset * 2; // Only check nearby intersections

    const intersects = raycaster.intersectObject(bodyMesh, true);

    if (intersects.length > 0) {
      const collision = intersects[0];

      // Calculate how much vertex penetrates body
      const penetrationDepth = collision.distance;

      if (penetrationDepth < offset) {
        // Push vertex outward to maintain fabric offset
        const pushDistance = offset - penetrationDepth;
        worldVertex.add(worldNormal.multiplyScalar(pushDistance));

        // Transform back to local space
        const localVertex = worldVertex.clone();
        const inverseMatrix = garmentMesh.matrixWorld.clone().invert();
        localVertex.applyMatrix4(inverseMatrix);

        // Update vertex position
        positions.setXYZ(i, localVertex.x, localVertex.y, localVertex.z);
        collisionCount++;
      }
    }
  }

  positions.needsUpdate = true;
  console.log(`[GarmentFitting] Resolved ${collisionCount} collisions`);
}

/**
 * Laplacian smoothing to reduce mesh artifacts
 * Averages each vertex position with its neighbors
 */
function laplacianSmoothing(
  mesh: THREE.Mesh,
  iterations: number,
  lambda: number = 0.5
): void {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position;
  const index = geometry.index;

  if (!positions || !index) {
    console.error('[GarmentFitting] Missing position or index attributes');
    return;
  }

  // Build vertex neighbor map
  const neighbors = buildNeighborMap(geometry);

  // Smoothing iterations
  for (let iter = 0; iter < iterations; iter++) {
    const newPositions = new Float32Array(positions.count * 3);

    // Copy original positions
    for (let i = 0; i < positions.count; i++) {
      newPositions[i * 3] = positions.getX(i);
      newPositions[i * 3 + 1] = positions.getY(i);
      newPositions[i * 3 + 2] = positions.getZ(i);
    }

    // Average each vertex with neighbors
    for (let i = 0; i < positions.count; i++) {
      const neighborIndices = neighbors.get(i);
      if (!neighborIndices || neighborIndices.size === 0) continue;

      const current = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );

      // Calculate average of neighbors
      const avg = new THREE.Vector3();
      for (const neighborIdx of neighborIndices) {
        avg.x += positions.getX(neighborIdx);
        avg.y += positions.getY(neighborIdx);
        avg.z += positions.getZ(neighborIdx);
      }
      avg.divideScalar(neighborIndices.size);

      // Blend between current and average
      const smoothed = current.lerp(avg, lambda);

      newPositions[i * 3] = smoothed.x;
      newPositions[i * 3 + 1] = smoothed.y;
      newPositions[i * 3 + 2] = smoothed.z;
    }

    // Update positions
    for (let i = 0; i < positions.count; i++) {
      positions.setXYZ(
        i,
        newPositions[i * 3],
        newPositions[i * 3 + 1],
        newPositions[i * 3 + 2]
      );
    }
  }

  positions.needsUpdate = true;
  console.log(`[GarmentFitting] Applied ${iterations} smoothing iterations`);
}

/**
 * Build vertex neighbor adjacency map
 */
function buildNeighborMap(geometry: THREE.BufferGeometry): Map<number, Set<number>> {
  const neighbors = new Map<number, Set<number>>();
  const index = geometry.index;

  if (!index) return neighbors;

  // Initialize sets for all vertices
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    neighbors.set(i, new Set());
  }

  // Process each triangle
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    // Add bidirectional edges
    neighbors.get(a)!.add(b);
    neighbors.get(a)!.add(c);
    neighbors.get(b)!.add(a);
    neighbors.get(b)!.add(c);
    neighbors.get(c)!.add(a);
    neighbors.get(c)!.add(b);
  }

  return neighbors;
}

/**
 * Calculate fabric offset based on material type
 */
export function getFabricOffset(material: 'cotton' | 'denim' | 'silk' | 'wool'): number {
  const offsets = {
    cotton: 0.003, // 3mm - thin t-shirt
    denim: 0.008, // 8mm - thick jeans
    silk: 0.002, // 2mm - very thin
    wool: 0.006, // 6mm - medium sweater
  };
  return offsets[material];
}

/**
 * Check if garment still has collisions (for validation)
 */
export function hasCollisions(
  garmentMesh: THREE.Mesh,
  bodyMesh: THREE.Mesh,
  tolerance: number = 0.001
): boolean {
  const geometry = garmentMesh.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position;
  const raycaster = new THREE.Raycaster();
  const vertex = new THREE.Vector3();

  bodyMesh.updateMatrixWorld(true);
  garmentMesh.updateMatrixWorld(true);

  // Sample vertices (check every 10th for performance)
  for (let i = 0; i < positions.count; i += 10) {
    vertex.fromBufferAttribute(positions, i);
    vertex.applyMatrix4(garmentMesh.matrixWorld);

    // Cast ray inward
    const direction = new THREE.Vector3(0, 0, 0).sub(vertex).normalize();
    raycaster.set(vertex, direction);
    raycaster.far = 0.1;

    const intersects = raycaster.intersectObject(bodyMesh, true);
    if (intersects.length > 0 && intersects[0].distance < tolerance) {
      return true;
    }
  }

  return false;
}
