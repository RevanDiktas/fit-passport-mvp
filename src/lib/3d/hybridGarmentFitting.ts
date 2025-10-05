/**
 * Hybrid Garment Fitting System
 * Combines avatar mesh topology with garment-like transformations
 *
 * This approach:
 * 1. Uses avatar mesh vertices (guaranteed correct positioning)
 * 2. Applies garment-like expansion (not just uniform inflation)
 * 3. Adds fabric draping and realistic shape
 */

import * as THREE from 'three';
import { applyRealisticFabricPhysics } from './fabricPhysics';
import {
  GarmentMeasurements,
  BodyMeasurements,
  calculateActualEase,
  analyzeFit,
  type FitAnalysis,
} from './garmentMeasurements';

export interface HybridGarmentOptions {
  // Option 1: Manual fabric ease (for testing)
  chestEase?: number;      // cm (default: 8)
  waistEase?: number;      // cm (default: 6)
  shoulderEase?: number;   // cm (default: 3)

  // Option 2: Product measurements (preferred - real garment data)
  garmentMeasurements?: GarmentMeasurements;
  bodyMeasurements?: BodyMeasurements;

  // Visual options
  color?: number;

  // Draping options
  gravity?: boolean;
  smoothing?: boolean;
  wrinkles?: boolean;

  // Callbacks
  onFitAnalysis?: (analysis: FitAnalysis) => void;
}

/**
 * Create realistic t-shirt from avatar mesh with hybrid approach
 */
export function createHybridTShirt(
  avatarMesh: THREE.Mesh,
  options: HybridGarmentOptions = {}
): THREE.Group {
  const {
    color = 0x4A90E2,
    gravity = true,
    smoothing = true,
    wrinkles = true,
    garmentMeasurements,
    bodyMeasurements,
    onFitAnalysis,
  } = options;

  // Determine fabric ease: use product measurements if available, otherwise defaults
  let chestEase: number;
  let waistEase: number;
  let shoulderEase: number;
  let fitAnalysis: FitAnalysis | undefined;

  if (garmentMeasurements && bodyMeasurements) {
    // Calculate actual ease from product measurements
    const actualEase = calculateActualEase(garmentMeasurements, bodyMeasurements);
    chestEase = actualEase.chestEase;
    waistEase = actualEase.waistEase;
    shoulderEase = actualEase.shoulderEase;

    // Analyze fit
    fitAnalysis = analyzeFit(garmentMeasurements, bodyMeasurements);

    console.log('[HybridGarment] Using product measurements:', {
      garment: garmentMeasurements,
      body: bodyMeasurements,
      ease: { chestEase, waistEase, shoulderEase },
      fit: fitAnalysis.overall,
      recommendation: fitAnalysis.recommendation,
    });

    // Call fit analysis callback
    if (onFitAnalysis) {
      onFitAnalysis(fitAnalysis);
    }
  } else {
    // Use manual ease values or defaults
    chestEase = options.chestEase ?? 8;
    waistEase = options.waistEase ?? 6;
    shoulderEase = options.shoulderEase ?? 3;

    console.log('[HybridGarment] Using default ease:', { chestEase, waistEase, shoulderEase });
  }

  // Update world matrix
  avatarMesh.updateWorldMatrix(true, false);
  const worldMatrix = avatarMesh.matrixWorld;
  const geometry = avatarMesh.geometry as THREE.BufferGeometry;

  const oldPositions = geometry.attributes.position;
  const oldNormals = geometry.attributes.normal;
  if (!oldNormals) {
    geometry.computeVertexNormals();
  }
  const normals = geometry.attributes.normal;
  const oldIndex = geometry.index;

  if (!oldIndex) {
    console.error('[HybridGarment] Geometry must be indexed');
    return new THREE.Group();
  }

  // Calculate bounding box in world space
  let minY = Infinity, maxY = -Infinity;
  let minX = Infinity, maxX = -Infinity;
  const tempVertex = new THREE.Vector3();

  for (let i = 0; i < oldPositions.count; i++) {
    tempVertex.fromBufferAttribute(oldPositions, i);
    tempVertex.applyMatrix4(worldMatrix);
    if (tempVertex.y < minY) minY = tempVertex.y;
    if (tempVertex.y > maxY) maxY = tempVertex.y;
    if (tempVertex.x < minX) minX = tempVertex.x;
    if (tempVertex.x > maxX) maxX = tempVertex.x;
  }

  const bodyHeight = maxY - minY;
  const bodyWidth = maxX - minX;

  // Define t-shirt region
  const topY = minY + bodyHeight * 0.85;      // Shoulders
  const bottomY = minY + bodyHeight * 0.50;   // Hips
  const neckTopY = minY + bodyHeight * 0.92;  // Neck opening
  const neckRadius = 0.08;

  // SLEEVE LENGTH HANDLING
  // Get sleeve length from garment measurements or use default (20cm = short sleeve)
  const sleeveLength = garmentMeasurements?.sleeveLength ?? 20; // cm
  const sleeveLengthMeters = sleeveLength / 100; // Convert to meters
  const shoulderY = minY + bodyHeight * 0.82; // Shoulder level
  const sleeveEndY = shoulderY - sleeveLengthMeters; // Where sleeve ends

  console.log('[HybridGarment] Body & Sleeve dimensions:', {
    height: bodyHeight.toFixed(2),
    width: bodyWidth.toFixed(2),
    shirtRegion: `${bottomY.toFixed(2)} to ${topY.toFixed(2)}`,
    shoulderY: shoulderY.toFixed(2),
    sleeveLength: `${sleeveLength}cm`,
    sleeveEndY: sleeveEndY.toFixed(2),
    torsoWidth: (bodyWidth * 0.3).toFixed(2),
  });

  // Track vertices in shirt region
  const vertexInRegion = new Array(oldPositions.count).fill(false);
  const oldToNewVertexMap = new Map<number, number>();

  // Mark vertices
  for (let i = 0; i < oldPositions.count; i++) {
    tempVertex.fromBufferAttribute(oldPositions, i);
    tempVertex.applyMatrix4(worldMatrix);

    const isInYRange = tempVertex.y >= bottomY && tempVertex.y <= topY;
    const distFromCenter = Math.sqrt(tempVertex.x * tempVertex.x + tempVertex.z * tempVertex.z);
    const isNeck = tempVertex.y >= neckTopY && distFromCenter < neckRadius;

    // CRITICAL FIX: Proper sleeve cutoff logic
    // Arms extend horizontally from shoulders in T-pose
    // Identify arm vertices: at shoulder height (70-85% of body) AND far from body center
    const normalizedY = (tempVertex.y - minY) / bodyHeight;
    const isAtShoulderHeight = normalizedY >= 0.70 && normalizedY <= 0.90;
    const distanceFromBodyCenter = Math.abs(tempVertex.x); // Horizontal distance from center

    // Torso width at shoulders is roughly 1/4 of body width
    // Arms extend beyond that point
    const torsoHalfWidth = bodyWidth * 0.15; // Torso is ~30% of total width
    const isOnArm = isAtShoulderHeight && distanceFromBodyCenter > torsoHalfWidth;

    // Check if this arm vertex is below the sleeve end
    const isBelowSleeveEnd = tempVertex.y < sleeveEndY;
    const isSleeveCutoff = isOnArm && isBelowSleeveEnd;

    if (isInYRange && !isNeck && !isSleeveCutoff) {
      vertexInRegion[i] = true;
    }
  }

  // Count vertices removed by sleeve cutoff for debugging
  const totalVerticesInRange = vertexInRegion.filter(v => v).length;
  console.log('[HybridGarment] Sleeve cutoff applied:', {
    totalVerticesKept: totalVerticesInRange,
    totalVertices: oldPositions.count,
  });

  // Build new vertices with GARMENT-LIKE EXPANSION
  const newPositions: number[] = [];
  const newNormals: number[] = [];
  let newVertexCount = 0;

  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

  for (let i = 0; i < oldPositions.count; i++) {
    if (vertexInRegion[i]) {
      vertex.fromBufferAttribute(oldPositions, i);
      normal.fromBufferAttribute(normals, i);

      // Transform to world space
      vertex.applyMatrix4(worldMatrix);
      normal.applyMatrix3(normalMatrix).normalize();

      // Calculate normalized Y position (0 = hips, 1 = shoulders)
      const normalizedY = (vertex.y - bottomY) / (topY - bottomY);

      // Calculate fabric offset based on body region
      let fabricOffset: number;

      if (normalizedY > 0.8) {
        // Shoulder area - use shoulder ease
        fabricOffset = shoulderEase / 100; // Convert cm to meters
      } else if (normalizedY > 0.5) {
        // Chest area - use chest ease
        const t = (normalizedY - 0.5) / 0.3;
        const chestOffset = chestEase / 100;
        const shoulderOffset = shoulderEase / 100;
        fabricOffset = chestOffset + (shoulderOffset - chestOffset) * t;
      } else {
        // Waist area - use waist ease
        const t = normalizedY / 0.5;
        const waistOffset = waistEase / 100;
        const chestOffset = chestEase / 100;
        fabricOffset = waistOffset + (chestOffset - waistOffset) * t;
      }

      // CRITICAL FIX: Handle tight garments realistically
      // Real-world physics: tight garments NEVER go under skin, they stretch to fit
      const minClearance = 0.003; // 3mm minimum to prevent z-fighting
      const maxClearance = 0.05;  // 5cm maximum for very loose garments

      let actualOffset = fabricOffset;

      if (fabricOffset < 0) {
        // TIGHT GARMENT (smaller than body): stretches to fit with minimal clearance
        actualOffset = minClearance;
      } else if (fabricOffset < minClearance) {
        // Very snug: ensure minimum clearance
        actualOffset = minClearance;
      } else if (fabricOffset > maxClearance) {
        // Very loose: cap at maximum
        actualOffset = maxClearance;
      }

      // Make garment boxy (reduce inflation near center for natural drape)
      const distanceFromCenter = Math.sqrt(vertex.x * vertex.x + vertex.z * vertex.z);
      const maxRadius = bodyWidth / 2;
      const radialPosition = Math.min(distanceFromCenter / maxRadius, 1); // 0 at center, 1 at edges

      let adjustedOffset: number;
      if (actualOffset > 0.01) {
        // LOOSE garment: apply boxiness (reduce inflation at center)
        const boxinessMultiplier = 0.6 + radialPosition * 0.4; // 0.6 to 1.0
        adjustedOffset = actualOffset * boxinessMultiplier;
        // Still ensure minimum clearance
        adjustedOffset = Math.max(adjustedOffset, minClearance);
      } else {
        // TIGHT garment: no boxiness, uniform skin-tight fit
        adjustedOffset = actualOffset;
      }

      // Inflate vertex outward
      const inflatedX = vertex.x + normal.x * adjustedOffset;
      const inflatedY = vertex.y + normal.y * adjustedOffset;
      const inflatedZ = vertex.z + normal.z * adjustedOffset;

      newPositions.push(inflatedX);
      newPositions.push(inflatedY);
      newPositions.push(inflatedZ);

      newNormals.push(normal.x);
      newNormals.push(normal.y);
      newNormals.push(normal.z);

      oldToNewVertexMap.set(i, newVertexCount);
      newVertexCount++;
    }
  }

  // Build index array
  const newIndices: number[] = [];
  for (let i = 0; i < oldIndex.count; i += 3) {
    const a = oldIndex.getX(i);
    const b = oldIndex.getX(i + 1);
    const c = oldIndex.getX(i + 2);

    if (vertexInRegion[a] && vertexInRegion[b] && vertexInRegion[c]) {
      newIndices.push(oldToNewVertexMap.get(a)!);
      newIndices.push(oldToNewVertexMap.get(b)!);
      newIndices.push(oldToNewVertexMap.get(c)!);
    }
  }

  console.log('[HybridGarment] Created garment:', {
    vertices: newVertexCount,
    faces: newIndices.length / 3,
  });

  // Create geometry
  const shirtGeometry = new THREE.BufferGeometry();
  shirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  shirtGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
  shirtGeometry.setIndex(newIndices);

  // Apply basic draping
  if (smoothing) {
    applyLaplacianSmoothing(shirtGeometry, 3, 0.4);
  }

  if (gravity) {
    applyGravityDrape(shirtGeometry, 0.01);
  }

  if (wrinkles) {
    addSubtleWrinkles(shirtGeometry, 0.002);
  }

  // ENHANCED: Apply realistic physics
  applyRealisticFabricPhysics(shirtGeometry, avatarMesh, {
    fabricType: 'medium',
    enableStretch: true,
    enableCollision: true,
    enableWeight: true,
    enableSeams: true,
    enableDynamicWrinkles: true,
  });

  shirtGeometry.computeVertexNormals();

  // Create material with proper depth settings to prevent z-fighting
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.85,
    metalness: 0.0,
    side: THREE.DoubleSide,
    depthWrite: true,
    depthTest: true,
    // Slightly offset to render in front of body
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mesh = new THREE.Mesh(shirtGeometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.renderOrder = 1; // Render after avatar (higher = later)

  const group = new THREE.Group();
  group.add(mesh);

  return group;
}

/**
 * Laplacian smoothing
 */
function applyLaplacianSmoothing(
  geometry: THREE.BufferGeometry,
  iterations: number,
  lambda: number
): void {
  const positions = geometry.attributes.position;
  const tempPositions = new Float32Array(positions.count * 3);

  const adjacency = buildAdjacencyMap(geometry);

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < positions.count; i++) {
      tempPositions[i * 3] = positions.getX(i);
      tempPositions[i * 3 + 1] = positions.getY(i);
      tempPositions[i * 3 + 2] = positions.getZ(i);
    }

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
}

/**
 * Gravity drape
 */
function applyGravityDrape(geometry: THREE.BufferGeometry, strength: number): void {
  const positions = geometry.attributes.position;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const height = bbox.max.y - bbox.min.y;

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    const normalizedY = (y - bbox.min.y) / height;
    const gravityWeight = 1 - normalizedY;
    positions.setY(i, y - strength * gravityWeight * 0.05);
  }
}

/**
 * Add wrinkles
 */
function addSubtleWrinkles(geometry: THREE.BufferGeometry, intensity: number): void {
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);

    const noise = (Math.sin(x * 30) * Math.cos(z * 30) + Math.sin(y * 20)) * 0.5;
    const displacement = noise * intensity;

    positions.setXYZ(
      i,
      x + nx * displacement,
      y + ny * displacement,
      z + nz * displacement
    );
  }
}

/**
 * Build adjacency map
 */
function buildAdjacencyMap(geometry: THREE.BufferGeometry): Map<number, Set<number>> {
  const adjacency = new Map<number, Set<number>>();
  const index = geometry.index;

  if (!index) return adjacency;

  const vertexCount = geometry.attributes.position.count;
  for (let i = 0; i < vertexCount; i++) {
    adjacency.set(i, new Set());
  }

  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i);
    const b = index.getX(i + 1);
    const c = index.getX(i + 2);

    adjacency.get(a)!.add(b);
    adjacency.get(a)!.add(c);
    adjacency.get(b)!.add(a);
    adjacency.get(b)!.add(c);
    adjacency.get(c)!.add(a);
    adjacency.get(c)!.add(b);
  }

  return adjacency;
}
