/**
 * Garment Template Generation System
 * Creates realistic garment meshes with proper topology instead of cloning avatar
 */

import * as THREE from 'three';

export interface VertexGroup {
  name: string;
  indices: number[];
}

export interface TShirtTemplate {
  geometry: THREE.BufferGeometry;
  vertexGroups: VertexGroup[];
}

/**
 * Generate a basic t-shirt template mesh with realistic topology
 * This creates an actual garment shape, not a body clone
 */
export function createTShirtTemplate(): TShirtTemplate {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  const vertexGroups: VertexGroup[] = [
    { name: 'chest', indices: [] },
    { name: 'waist', indices: [] },
    { name: 'shoulders', indices: [] },
    { name: 'sleeves', indices: [] },
    { name: 'neckline', indices: [] },
    { name: 'hem', indices: [] },
  ];

  // T-shirt dimensions (base template in meters)
  const baseChest = 1.0;      // 100cm chest circumference
  const baseWaist = 0.9;      // 90cm waist circumference
  const baseLength = 0.7;     // 70cm length
  const shoulderWidth = 0.45; // 45cm shoulder width
  const sleeveLength = 0.25;  // 25cm sleeve length
  const neckRadius = 0.08;    // 8cm neck opening radius

  // Create torso body (cylinder-like but with proper shirt shape)
  const torsoSegments = 32;   // Circumference resolution
  const heightSegments = 20;  // Vertical resolution

  let vertexIndex = 0;

  // Generate vertices for torso from top to bottom
  for (let h = 0; h <= heightSegments; h++) {
    const v = h / heightSegments; // 0 to 1 from top to bottom
    const y = baseLength * (1 - v); // Y position from top to bottom

    // Determine radius at this height (shirt silhouette)
    let radius: number;
    if (v < 0.15) {
      // Shoulder area - wider
      radius = shoulderWidth / (2 * Math.PI);
    } else if (v < 0.4) {
      // Chest area - interpolate from shoulders to chest
      const t = (v - 0.15) / 0.25;
      const shoulderR = shoulderWidth / (2 * Math.PI);
      const chestR = baseChest / (2 * Math.PI);
      radius = shoulderR + (chestR - shoulderR) * t;
    } else if (v < 0.7) {
      // Mid section - interpolate from chest to waist
      const t = (v - 0.4) / 0.3;
      const chestR = baseChest / (2 * Math.PI);
      const waistR = baseWaist / (2 * Math.PI);
      radius = chestR + (waistR - chestR) * t;
    } else {
      // Bottom hem - slightly wider than waist
      const waistR = baseWaist / (2 * Math.PI);
      radius = waistR * 1.05;
    }

    // Create ring of vertices at this height
    for (let seg = 0; seg <= torsoSegments; seg++) {
      const u = seg / torsoSegments;
      const theta = u * Math.PI * 2;

      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      positions.push(x, y, z);

      // Normal pointing outward
      const normal = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
      normal.normalize();
      normals.push(normal.x, normal.y, normal.z);

      // UVs
      uvs.push(u, v);

      // Assign to vertex groups
      if (v < 0.2) {
        vertexGroups.find(g => g.name === 'shoulders')!.indices.push(vertexIndex);
      } else if (v < 0.5) {
        vertexGroups.find(g => g.name === 'chest')!.indices.push(vertexIndex);
      } else if (v < 0.85) {
        vertexGroups.find(g => g.name === 'waist')!.indices.push(vertexIndex);
      } else {
        vertexGroups.find(g => g.name === 'hem')!.indices.push(vertexIndex);
      }

      vertexIndex++;
    }
  }

  // Create faces for torso
  for (let h = 0; h < heightSegments; h++) {
    for (let seg = 0; seg < torsoSegments; seg++) {
      const a = h * (torsoSegments + 1) + seg;
      const b = a + torsoSegments + 1;
      const c = a + 1;
      const d = b + 1;

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  // Add sleeves (simplified cylinders extending from shoulders)
  const sleeveStartVertex = vertexIndex;
  const sleeveSegments = 16;
  const sleeveHeightSegments = 8;

  for (let side = 0; side < 2; side++) {
    // Left and right sleeves
    const sideMultiplier = side === 0 ? 1 : -1;
    const shoulderX = sideMultiplier * shoulderWidth / 2;
    const shoulderY = baseLength * 0.85; // Slightly below top

    for (let h = 0; h <= sleeveHeightSegments; h++) {
      const v = h / sleeveHeightSegments;
      const sleeveY = shoulderY - v * 0.05; // Slight droop
      const sleeveX = shoulderX + sideMultiplier * v * sleeveLength;

      // Sleeve radius tapers slightly
      const sleeveRadius = 0.08 * (1 - v * 0.2);

      for (let seg = 0; seg <= sleeveSegments; seg++) {
        const u = seg / sleeveSegments;
        const theta = u * Math.PI * 2;

        // Rotate sleeve around arm axis
        const y = sleeveY + Math.cos(theta) * sleeveRadius;
        const z = Math.sin(theta) * sleeveRadius;

        positions.push(sleeveX, y, z);

        const normal = new THREE.Vector3(0, Math.cos(theta), Math.sin(theta));
        normal.normalize();
        normals.push(normal.x, normal.y, normal.z);

        uvs.push(u, v);

        vertexGroups.find(g => g.name === 'sleeves')!.indices.push(vertexIndex);
        vertexIndex++;
      }
    }

    // Create faces for this sleeve
    const sleeveOffset = side * (sleeveHeightSegments + 1) * (sleeveSegments + 1);
    for (let h = 0; h < sleeveHeightSegments; h++) {
      for (let seg = 0; seg < sleeveSegments; seg++) {
        const base = sleeveStartVertex + sleeveOffset;
        const a = base + h * (sleeveSegments + 1) + seg;
        const b = a + sleeveSegments + 1;
        const c = a + 1;
        const d = b + 1;

        indices.push(a, b, c);
        indices.push(b, d, c);
      }
    }
  }

  // Create neck opening (cut hole in top)
  const neckStartVertex = vertexIndex;
  const neckSegments = 24;
  const neckY = baseLength * 0.95;

  for (let seg = 0; seg <= neckSegments; seg++) {
    const u = seg / neckSegments;
    const theta = u * Math.PI * 2;

    const x = Math.cos(theta) * neckRadius;
    const z = Math.sin(theta) * neckRadius;

    positions.push(x, neckY, z);

    const normal = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta));
    normal.normalize();
    normals.push(-normal.x, 0, -normal.z); // Inward facing

    uvs.push(u, 1);

    vertexGroups.find(g => g.name === 'neckline')!.indices.push(vertexIndex);
    vertexIndex++;
  }

  // Create BufferGeometry
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  geometry.computeVertexNormals();
  geometry.computeBoundingBox();

  console.log('[GarmentTemplate] Created t-shirt template:', {
    vertices: vertexIndex,
    faces: indices.length / 3,
    vertexGroups: vertexGroups.map(g => ({ name: g.name, count: g.indices.length })),
  });

  return { geometry, vertexGroups };
}

/**
 * Helper: Create a parametric cylinder for garment parts
 */
function createCylinder(
  radius: number,
  height: number,
  radialSegments: number,
  heightSegments: number,
  centerY: number = 0
): { positions: number[]; normals: number[]; indices: number[]; uvs: number[] } {
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  const uvs: number[] = [];

  let vertexIndex = 0;

  for (let h = 0; h <= heightSegments; h++) {
    const v = h / heightSegments;
    const y = centerY + height * (v - 0.5);

    for (let r = 0; r <= radialSegments; r++) {
      const u = r / radialSegments;
      const theta = u * Math.PI * 2;

      const x = Math.cos(theta) * radius;
      const z = Math.sin(theta) * radius;

      positions.push(x, y, z);
      normals.push(Math.cos(theta), 0, Math.sin(theta));
      uvs.push(u, v);

      vertexIndex++;
    }
  }

  for (let h = 0; h < heightSegments; h++) {
    for (let r = 0; r < radialSegments; r++) {
      const a = h * (radialSegments + 1) + r;
      const b = a + radialSegments + 1;
      const c = a + 1;
      const d = b + 1;

      indices.push(a, b, c);
      indices.push(b, d, c);
    }
  }

  return { positions, normals, indices, uvs };
}
