/**
 * Parametric Deformation System
 * Scales and deforms garment templates based on body measurements
 */

import * as THREE from 'three';
import { TShirtTemplate, VertexGroup } from './garmentTemplates';

export interface BodyMeasurements {
  chest: number;        // cm
  waist: number;        // cm
  hips?: number;        // cm
  shoulderWidth?: number; // cm
  height?: number;      // cm
  torsoLength?: number; // cm
}

export interface FabricEase {
  chest: number;    // Extra space in cm (default: 8cm for regular fit)
  waist: number;    // Extra space in cm (default: 6cm)
  shoulders: number; // Extra space in cm (default: 3cm)
  length: number;   // Extra length in cm (default: 2cm)
}

/**
 * Deform t-shirt template to fit body measurements
 */
export function deformTShirtToMeasurements(
  template: TShirtTemplate,
  measurements: BodyMeasurements,
  ease: Partial<FabricEase> = {}
): THREE.BufferGeometry {
  // Clone the template geometry
  const deformedGeometry = template.geometry.clone();
  const positions = deformedGeometry.attributes.position;

  // Default fabric ease for regular fit (t-shirt should be looser than body)
  const fabricEase: FabricEase = {
    chest: ease.chest ?? 8,      // 8cm extra for comfort
    waist: ease.waist ?? 6,      // 6cm extra
    shoulders: ease.shoulders ?? 3, // 3cm extra at shoulders
    length: ease.length ?? 2,    // 2cm extra length
  };

  // Calculate scale factors from base template to actual measurements
  const baseChest = 100;      // Base template chest circumference (cm)
  const baseWaist = 90;       // Base template waist circumference (cm)
  const baseShoulder = 45;    // Base template shoulder width (cm)
  const baseLength = 70;      // Base template length (cm)

  // Target dimensions with ease
  const targetChest = measurements.chest + fabricEase.chest;
  const targetWaist = measurements.waist + fabricEase.waist;
  const targetShoulder = (measurements.shoulderWidth ?? 45) + fabricEase.shoulders;
  const targetLength = (measurements.torsoLength ?? 70) + fabricEase.length;

  // Scale factors
  const chestScale = targetChest / baseChest;
  const waistScale = targetWaist / baseWaist;
  const shoulderScale = targetShoulder / baseShoulder;
  const lengthScale = targetLength / baseLength;

  console.log('[ParametricDeform] Scale factors:', {
    chest: chestScale.toFixed(2),
    waist: waistScale.toFixed(2),
    shoulder: shoulderScale.toFixed(2),
    length: lengthScale.toFixed(2),
  });

  // Get bounding box to understand vertex positions
  deformedGeometry.computeBoundingBox();
  const bbox = deformedGeometry.boundingBox!;
  const garmentHeight = bbox.max.y - bbox.min.y;

  // Apply deformations based on vertex groups
  const vertex = new THREE.Vector3();

  for (let i = 0; i < positions.count; i++) {
    vertex.fromBufferAttribute(positions, i);

    // Determine Y-based region
    const normalizedY = (vertex.y - bbox.min.y) / garmentHeight; // 0 to 1 from bottom to top

    // Calculate blend weights for smooth transitions
    let shoulderWeight = 0;
    let chestWeight = 0;
    let waistWeight = 0;

    if (normalizedY > 0.85) {
      // Shoulder region (top 15%)
      shoulderWeight = 1;
    } else if (normalizedY > 0.7) {
      // Transition from shoulders to chest
      const t = (normalizedY - 0.7) / 0.15;
      shoulderWeight = t;
      chestWeight = 1 - t;
    } else if (normalizedY > 0.4) {
      // Chest region
      chestWeight = 1;
    } else if (normalizedY > 0.3) {
      // Transition from chest to waist
      const t = (normalizedY - 0.3) / 0.1;
      chestWeight = t;
      waistWeight = 1 - t;
    } else {
      // Waist and hem region
      waistWeight = 1;
    }

    // Calculate blended XZ scale (horizontal)
    const xzScale =
      shoulderWeight * shoulderScale +
      chestWeight * chestScale +
      waistWeight * waistScale;

    // Apply XZ scaling (horizontal expansion/contraction)
    vertex.x *= xzScale;
    vertex.z *= xzScale;

    // Apply Y scaling (vertical stretch)
    vertex.y *= lengthScale;

    // Update position
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }

  // Recompute normals after deformation
  deformedGeometry.computeVertexNormals();
  deformedGeometry.computeBoundingBox();

  console.log('[ParametricDeform] Deformed t-shirt:', {
    originalBounds: {
      x: (bbox.max.x - bbox.min.x).toFixed(2),
      y: garmentHeight.toFixed(2),
      z: (bbox.max.z - bbox.min.z).toFixed(2),
    },
    deformedBounds: {
      x: (deformedGeometry.boundingBox!.max.x - deformedGeometry.boundingBox!.min.x).toFixed(2),
      y: (deformedGeometry.boundingBox!.max.y - deformedGeometry.boundingBox!.min.y).toFixed(2),
      z: (deformedGeometry.boundingBox!.max.z - deformedGeometry.boundingBox!.min.z).toFixed(2),
    },
  });

  return deformedGeometry;
}

/**
 * Apply vertex group-based deformation
 */
export function applyVertexGroupDeformation(
  geometry: THREE.BufferGeometry,
  vertexGroups: VertexGroup[],
  deformations: Map<string, THREE.Vector3>
): void {
  const positions = geometry.attributes.position;

  for (const group of vertexGroups) {
    const deformation = deformations.get(group.name);
    if (!deformation) continue;

    for (const index of group.indices) {
      const x = positions.getX(index);
      const y = positions.getY(index);
      const z = positions.getZ(index);

      positions.setXYZ(
        index,
        x * deformation.x,
        y * deformation.y,
        z * deformation.z
      );
    }
  }

  geometry.computeVertexNormals();
}

/**
 * Calculate appropriate fabric ease based on garment type and fit preference
 */
export function calculateFabricEase(
  fitPreference: 'tight' | 'regular' | 'loose' = 'regular'
): FabricEase {
  const easeMultiplier = {
    tight: 0.5,
    regular: 1.0,
    loose: 1.5,
  }[fitPreference];

  return {
    chest: 8 * easeMultiplier,
    waist: 6 * easeMultiplier,
    shoulders: 3 * easeMultiplier,
    length: 2 * easeMultiplier,
  };
}

/**
 * Position garment on avatar (align to avatar's coordinate system)
 */
export function positionGarmentOnAvatar(
  garmentGeometry: THREE.BufferGeometry,
  avatarMesh: THREE.Mesh
): void {
  // Update avatar's world matrix
  avatarMesh.updateWorldMatrix(true, false);

  // Get avatar bounding box in world space
  const avatarBBox = new THREE.Box3().setFromObject(avatarMesh);

  // Get garment bounding box (currently in local space)
  garmentGeometry.computeBoundingBox();
  const garmentBBox = garmentGeometry.boundingBox!;

  // Calculate offset to align garment with avatar
  // Garment should be positioned so its top is at avatar's shoulder level
  const avatarHeight = avatarBBox.max.y - avatarBBox.min.y;
  const shoulderY = avatarBBox.min.y + avatarHeight * 0.82; // Shoulders at 82% height
  const garmentTopY = garmentBBox.max.y;

  // Offset all vertices
  const positions = garmentGeometry.attributes.position;
  const offsetY = shoulderY - garmentTopY;

  console.log('[PositionGarment] Aligning garment to avatar:', {
    avatarHeight: avatarHeight.toFixed(2),
    shoulderY: shoulderY.toFixed(2),
    garmentTopY: garmentTopY.toFixed(2),
    offsetY: offsetY.toFixed(2),
  });

  for (let i = 0; i < positions.count; i++) {
    const y = positions.getY(i);
    positions.setY(i, y + offsetY);
  }

  garmentGeometry.computeBoundingBox();
}
