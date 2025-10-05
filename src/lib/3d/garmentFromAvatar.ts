/**
 * Generate garment mesh directly from avatar body mesh
 * This approach inflates the avatar mesh to create a perfectly fitting garment
 */

import * as THREE from 'three';

export interface GarmentRegion {
  name: string;
  minY: number; // Minimum Y coordinate (normalized 0-1)
  maxY: number; // Maximum Y coordinate (normalized 0-1)
}

/**
 * Create a t-shirt by inflating the torso region of the avatar mesh
 */
export function createTShirtFromAvatar(
  avatarMesh: THREE.Mesh,
  fabricOffset: number = 0.01 // 1cm offset
): THREE.Mesh {
  const geometry = avatarMesh.geometry as THREE.BufferGeometry;

  // Compute bounding box to understand body proportions
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  const bodyHeight = bbox.max.y - bbox.min.y;

  console.log('[GarmentFromAvatar] Body dimensions:', {
    height: bodyHeight.toFixed(2),
    minY: bbox.min.y.toFixed(2),
    maxY: bbox.max.y.toFixed(2),
  });

  // Define t-shirt coverage region (from shoulders to hips)
  const shoulderY = bbox.min.y + bodyHeight * 0.82; // Top of shirt
  const hipY = bbox.min.y + bodyHeight * 0.50; // Bottom of shirt
  const neckY = bbox.min.y + bodyHeight * 0.85; // Neck opening top
  const armholeTopY = bbox.min.y + bodyHeight * 0.80; // Armhole top
  const armholeBottomY = bbox.min.y + bodyHeight * 0.68; // Armhole bottom

  console.log('[GarmentFromAvatar] T-shirt regions:', {
    shoulderY: shoulderY.toFixed(2),
    hipY: hipY.toFixed(2),
    neckY: neckY.toFixed(2),
  });

  // Clone avatar geometry
  const garmentGeometry = geometry.clone();
  const positions = garmentGeometry.attributes.position;
  const normals = garmentGeometry.attributes.normal;

  if (!normals) {
    garmentGeometry.computeVertexNormals();
  }

  const newPositions = new Float32Array(positions.count * 3);
  const verticesToKeep: number[] = [];

  // Process each vertex
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    // Check if vertex is in t-shirt region
    const isInTorso = y >= hipY && y <= shoulderY;

    // Exclude neck area (vertices in center at high Y)
    const distanceFromCenter = Math.sqrt(x * x + z * z);
    const isNeckArea = y >= neckY && distanceFromCenter < 0.08; // 8cm radius

    // Exclude armhole areas (sides at shoulder level)
    const isArmhole = y >= armholeBottomY && y <= armholeTopY && Math.abs(x) > 0.15;

    if (isInTorso && !isNeckArea && !isArmhole) {
      // Keep this vertex and inflate it outward
      const nx = normals!.getX(i);
      const ny = normals!.getY(i);
      const nz = normals!.getZ(i);

      // Push vertex outward along normal
      newPositions[i * 3] = x + nx * fabricOffset;
      newPositions[i * 3 + 1] = y + ny * fabricOffset;
      newPositions[i * 3 + 2] = z + nz * fabricOffset;

      verticesToKeep.push(i);
    } else {
      // Mark vertex for removal
      newPositions[i * 3] = 0;
      newPositions[i * 3 + 1] = 0;
      newPositions[i * 3 + 2] = 0;
    }
  }

  // Update positions
  garmentGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(newPositions, 3)
  );

  // Recompute normals
  garmentGeometry.computeVertexNormals();

  console.log('[GarmentFromAvatar] Garment created with', verticesToKeep.length, 'vertices');

  // Create mesh with material
  const material = new THREE.MeshStandardMaterial({
    color: 0x4A90E2, // Blue
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const garmentMesh = new THREE.Mesh(garmentGeometry, material);
  garmentMesh.castShadow = true;
  garmentMesh.receiveShadow = true;

  return garmentMesh;
}

/**
 * Create t-shirt by filtering and offsetting body vertices in torso region
 */
export function createSimpleTShirtFromAvatar(
  avatarMesh: THREE.Mesh,
  options: {
    topY?: number;
    bottomY?: number;
    fabricOffset?: number;
    color?: number;
  } = {}
): THREE.Group {
  const {
    fabricOffset = 0.01,
    color = 0x4A90E2,
  } = options;

  // CRITICAL: Update world matrix to get actual transformed positions
  avatarMesh.updateWorldMatrix(true, false);
  const worldMatrix = avatarMesh.matrixWorld;

  const geometry = avatarMesh.geometry as THREE.BufferGeometry;

  // Get original geometry data
  const oldPositions = geometry.attributes.position;
  const oldNormals = geometry.attributes.normal;
  if (!oldNormals) {
    geometry.computeVertexNormals();
  }
  const normals = geometry.attributes.normal;
  const oldIndex = geometry.index;

  if (!oldIndex) {
    console.error('[SimpleT-Shirt] Geometry must be indexed');
    return new THREE.Group();
  }

  // Calculate bounding box in WORLD SPACE
  let minY = Infinity;
  let maxY = -Infinity;
  const tempVertex = new THREE.Vector3();

  for (let i = 0; i < oldPositions.count; i++) {
    tempVertex.fromBufferAttribute(oldPositions, i);
    tempVertex.applyMatrix4(worldMatrix);

    if (tempVertex.y < minY) minY = tempVertex.y;
    if (tempVertex.y > maxY) maxY = tempVertex.y;
  }

  const bodyHeight = maxY - minY;

  // Define shirt region in WORLD SPACE
  const topY = options.topY ?? minY + bodyHeight * 0.82;
  const bottomY = options.bottomY ?? minY + bodyHeight * 0.50;
  const neckTopY = minY + bodyHeight * 0.88;
  const neckRadius = 0.08;

  console.log('[SimpleT-Shirt] Shirt region (WORLD SPACE):', {
    minY: minY.toFixed(2),
    maxY: maxY.toFixed(2),
    bottomY: bottomY.toFixed(2),
    topY: topY.toFixed(2),
    bodyHeight: bodyHeight.toFixed(2),
  });

  // Create vertex map to track which vertices to keep
  const vertexInRegion = new Array(oldPositions.count).fill(false);
  const oldToNewVertexMap = new Map<number, number>();

  // Mark vertices in shirt region (check in WORLD SPACE)
  for (let i = 0; i < oldPositions.count; i++) {
    tempVertex.fromBufferAttribute(oldPositions, i);
    tempVertex.applyMatrix4(worldMatrix); // Transform to world space

    const isInYRange = tempVertex.y >= bottomY && tempVertex.y <= topY;

    // Exclude neck area
    const distFromCenter = Math.sqrt(tempVertex.x * tempVertex.x + tempVertex.z * tempVertex.z);
    const isNeck = tempVertex.y >= neckTopY && distFromCenter < neckRadius;

    if (isInYRange && !isNeck) {
      vertexInRegion[i] = true;
    }
  }

  // Build new vertex arrays with only kept vertices (in WORLD SPACE)
  const newPositions: number[] = [];
  const newNormals: number[] = [];
  let newVertexCount = 0;

  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(worldMatrix);

  for (let i = 0; i < oldPositions.count; i++) {
    if (vertexInRegion[i]) {
      // Get vertex in local space
      vertex.fromBufferAttribute(oldPositions, i);
      normal.fromBufferAttribute(normals, i);

      // Transform to world space
      vertex.applyMatrix4(worldMatrix);
      normal.applyMatrix3(normalMatrix).normalize();

      // Inflate vertex outward along world-space normal
      const inflatedX = vertex.x + normal.x * fabricOffset;
      const inflatedY = vertex.y + normal.y * fabricOffset;
      const inflatedZ = vertex.z + normal.z * fabricOffset;

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

  // Build new index array with only faces that use kept vertices
  const newIndices: number[] = [];
  for (let i = 0; i < oldIndex.count; i += 3) {
    const a = oldIndex.getX(i);
    const b = oldIndex.getX(i + 1);
    const c = oldIndex.getX(i + 2);

    // Only keep triangle if all 3 vertices are in the shirt region
    if (vertexInRegion[a] && vertexInRegion[b] && vertexInRegion[c]) {
      newIndices.push(oldToNewVertexMap.get(a)!);
      newIndices.push(oldToNewVertexMap.get(b)!);
      newIndices.push(oldToNewVertexMap.get(c)!);
    }
  }

  console.log('[SimpleT-Shirt] Filtered geometry:', {
    originalVertices: oldPositions.count,
    keptVertices: newVertexCount,
    originalTriangles: oldIndex.count / 3,
    keptTriangles: newIndices.length / 3,
  });

  // Create new geometry
  const shirtGeometry = new THREE.BufferGeometry();
  shirtGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
  shirtGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
  shirtGeometry.setIndex(newIndices);

  // Recompute normals for smooth shading
  shirtGeometry.computeVertexNormals();

  // Create mesh
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.8,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });

  const shirtMesh = new THREE.Mesh(shirtGeometry, material);
  shirtMesh.castShadow = true;
  shirtMesh.receiveShadow = true;

  const group = new THREE.Group();
  group.add(shirtMesh);

  return group;
}
