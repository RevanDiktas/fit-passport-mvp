/**
 * Garment Parametric Deformation System
 * Implements PRD Stage 3.3: Manual Garment Scaling
 * and PRD Section 3.2: Garment 3D Reconstruction
 *
 * Deforms garment templates based on measurements using vertex groups
 */

import * as THREE from 'three';

export interface GarmentMeasurements {
  chest?: number; // cm
  waist?: number; // cm
  length?: number; // cm
  shoulderWidth?: number; // cm
  sleeveLength?: number; // cm
  neckCircumference?: number; // cm
}

export interface VertexGroup {
  name: string;
  indices: number[]; // Vertex indices in this group
  deformationAxis: 'x' | 'y' | 'z' | 'radial'; // How to deform
  weight?: number[]; // Per-vertex weight (0-1), optional
}

export interface GarmentTemplate {
  mesh: THREE.Group;
  baseMeasurements: GarmentMeasurements;
  vertexGroups: VertexGroup[];
  category: 'tshirt' | 'jeans' | 'dress' | 'hoodie';
}

/**
 * Deform garment template to match target measurements
 * Implements linear interpolation as described in PRD
 */
export function deformGarment(
  template: GarmentTemplate,
  targetMeasurements: GarmentMeasurements
): THREE.Group {
  console.log('[GarmentDeformation] Deforming garment:', {
    base: template.baseMeasurements,
    target: targetMeasurements,
  });

  // Clone the template to avoid modifying original
  const garment = template.mesh.clone(true);

  // Apply deformations for each measurement
  template.vertexGroups.forEach((group) => {
    const measurementKey = getMeasurementKeyForGroup(group.name);
    if (!measurementKey) return;

    const baseMeasurement = template.baseMeasurements[measurementKey];
    const targetMeasurement = targetMeasurements[measurementKey];

    if (!baseMeasurement || !targetMeasurement) return;

    // Calculate scale factor
    const scaleFactor = targetMeasurement / baseMeasurement;

    console.log(`[GarmentDeformation] ${group.name}: ${baseMeasurement}cm → ${targetMeasurement}cm (×${scaleFactor.toFixed(2)})`);

    // Apply deformation to this vertex group
    applyDeformationToGroup(garment, group, scaleFactor);
  });

  return garment;
}

/**
 * Apply deformation to a specific vertex group
 */
function applyDeformationToGroup(
  garment: THREE.Group,
  group: VertexGroup,
  scaleFactor: number
): void {
  // Find all meshes in the garment
  garment.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const geometry = child.geometry as THREE.BufferGeometry;
    const positions = geometry.attributes.position;

    if (!positions) return;

    // Deform vertices in this group
    group.indices.forEach((vertexIndex, i) => {
      if (vertexIndex >= positions.count) return;

      const x = positions.getX(vertexIndex);
      const y = positions.getY(vertexIndex);
      const z = positions.getZ(vertexIndex);

      // Get weight for this vertex (default 1.0 if no weights)
      const weight = group.weight ? group.weight[i] || 1.0 : 1.0;
      const effectiveFactor = 1.0 + (scaleFactor - 1.0) * weight;

      let newX = x;
      let newY = y;
      let newZ = z;

      // Apply scaling based on deformation axis
      switch (group.deformationAxis) {
        case 'x':
          // Scale horizontally (left-right)
          newX = x * effectiveFactor;
          break;

        case 'y':
          // Scale vertically (up-down)
          newY = y * effectiveFactor;
          break;

        case 'z':
          // Scale depth (front-back)
          newZ = z * effectiveFactor;
          break;

        case 'radial':
          // Scale radially from center (chest/waist circumference)
          newX = x * effectiveFactor;
          newZ = z * effectiveFactor;
          break;
      }

      positions.setXYZ(vertexIndex, newX, newY, newZ);
    });

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
  });
}

/**
 * Map vertex group names to measurement keys
 */
function getMeasurementKeyForGroup(groupName: string): keyof GarmentMeasurements | null {
  const mapping: Record<string, keyof GarmentMeasurements> = {
    chest: 'chest',
    bust: 'chest',
    waist: 'waist',
    torso: 'length',
    body: 'length',
    length: 'length',
    shoulders: 'shoulderWidth',
    shoulder: 'shoulderWidth',
    sleeves: 'sleeveLength',
    sleeve: 'sleeveLength',
    arms: 'sleeveLength',
    neck: 'neckCircumference',
  };

  return mapping[groupName.toLowerCase()] || null;
}

/**
 * Create t-shirt template with vertex groups
 * This replaces the basic cylinder approach with a proper vertex-grouped template
 */
export function createTShirtTemplate(baseMeasurements?: Partial<GarmentMeasurements>): GarmentTemplate {
  const defaultMeasurements: GarmentMeasurements = {
    chest: 95, // cm
    waist: 85, // cm
    length: 70, // cm
    shoulderWidth: 45, // cm
    sleeveLength: 25, // cm
    neckCircumference: 38, // cm
  };

  const measurements = { ...defaultMeasurements, ...baseMeasurements };

  // Create garment group
  const garment = new THREE.Group();

  // Calculate body proportions from height
  const heightMeters = measurements.length! * 0.01; // Use length as approximation for torso
  const totalBodyHeight = (measurements.chest || 95) / 95 * 1.7; // Approximate total height

  // Anatomical proportions (from average human)
  const shoulderHeight = totalBodyHeight * 0.82; // Shoulders at 82% of height
  const chestHeight = totalBodyHeight * 0.75; // Chest at 75% of height
  const waistHeight = totalBodyHeight * 0.58; // Waist at 58% of height

  // Torso mesh - positioned at center between chest and waist
  const torsoGeometry = createTorsoGeometry(measurements);
  const torsoMesh = new THREE.Mesh(torsoGeometry);
  torsoMesh.name = 'torso';
  const torsoCenterY = (chestHeight + waistHeight) / 2;
  torsoMesh.position.y = torsoCenterY;
  garment.add(torsoMesh);

  // Sleeve meshes - positioned at shoulder height
  const sleeveGeometry = createSleeveGeometry(measurements);

  const leftSleeve = new THREE.Mesh(sleeveGeometry);
  leftSleeve.name = 'leftSleeve';
  leftSleeve.rotation.z = Math.PI / 2;
  leftSleeve.position.set(-(measurements.shoulderWidth! * 0.01) / 2, shoulderHeight, 0);
  garment.add(leftSleeve);

  const rightSleeve = new THREE.Mesh(sleeveGeometry.clone());
  rightSleeve.name = 'rightSleeve';
  rightSleeve.rotation.z = -Math.PI / 2;
  rightSleeve.position.set((measurements.shoulderWidth! * 0.01) / 2, shoulderHeight, 0);
  garment.add(rightSleeve);

  // Neck opening - positioned at top of torso
  const neckGeometry = createNeckGeometry(measurements);
  const neckMesh = new THREE.Mesh(neckGeometry);
  neckMesh.name = 'neck';
  neckMesh.position.y = chestHeight + (heightMeters / 2);
  garment.add(neckMesh);

  // Define vertex groups
  // Note: In a real implementation, these indices would be pre-calculated
  // For now, we'll use the entire mesh for each group
  const vertexGroups: VertexGroup[] = [
    {
      name: 'chest',
      indices: [], // All torso vertices (to be populated)
      deformationAxis: 'radial',
    },
    {
      name: 'waist',
      indices: [], // Lower torso vertices
      deformationAxis: 'radial',
    },
    {
      name: 'length',
      indices: [], // All vertices
      deformationAxis: 'y',
    },
    {
      name: 'shoulders',
      indices: [], // Shoulder area vertices
      deformationAxis: 'x',
    },
    {
      name: 'sleeves',
      indices: [], // Sleeve vertices
      deformationAxis: 'radial',
    },
  ];

  return {
    mesh: garment,
    baseMeasurements: measurements,
    vertexGroups,
    category: 'tshirt',
  };
}

/**
 * Create torso geometry with proper vertex count
 */
function createTorsoGeometry(measurements: GarmentMeasurements): THREE.BufferGeometry {
  const chestRadius = (measurements.chest! / (2 * Math.PI)) * 0.01;
  const waistRadius = (measurements.waist! / (2 * Math.PI)) * 0.01;
  const length = measurements.length! * 0.01;

  // Create tapered cylinder (centered at origin)
  const geometry = new THREE.CylinderGeometry(
    chestRadius * 0.9, // Top radius (chest)
    waistRadius * 0.95, // Bottom radius (waist)
    length,
    32, // Radial segments (increased for smoother deformation)
    8, // Height segments (increased for length deformation)
    true // Open-ended
  );

  // Geometry is centered at origin - positioning handled by mesh.position
  return geometry;
}

/**
 * Create sleeve geometry
 */
function createSleeveGeometry(measurements: GarmentMeasurements): THREE.BufferGeometry {
  const sleeveLength = measurements.sleeveLength! * 0.01;
  const sleeveRadius = 0.06;

  const geometry = new THREE.CylinderGeometry(
    sleeveRadius,
    sleeveRadius * 0.9,
    sleeveLength,
    16, // Radial segments
    4, // Height segments
    true
  );

  return geometry;
}

/**
 * Create neck geometry
 */
function createNeckGeometry(measurements: GarmentMeasurements): THREE.BufferGeometry {
  const neckRadius = (measurements.neckCircumference! / (2 * Math.PI)) * 0.01 * 0.5;

  const geometry = new THREE.CylinderGeometry(
    neckRadius,
    neckRadius * 1.1,
    0.08,
    24, // Radial segments
    1,
    true
  );

  return geometry;
}

/**
 * Calculate how much garment measurements differ from body measurements
 * Used for fit analysis
 */
export function calculateFitMetrics(
  bodyMeasurements: GarmentMeasurements,
  garmentMeasurements: GarmentMeasurements
): Record<string, { difference: number; status: 'tight' | 'perfect' | 'loose' }> {
  const metrics: Record<string, any> = {};

  const keys: Array<keyof GarmentMeasurements> = ['chest', 'waist', 'length', 'shoulderWidth'];

  keys.forEach((key) => {
    const body = bodyMeasurements[key];
    const garment = garmentMeasurements[key];

    if (!body || !garment) return;

    const difference = garment - body;

    // Determine fit status based on difference
    // Ideal: 3-8cm ease for comfort
    let status: 'tight' | 'perfect' | 'loose';
    if (difference < 2) {
      status = 'tight';
    } else if (difference > 10) {
      status = 'loose';
    } else {
      status = 'perfect';
    }

    metrics[key] = {
      bodyMeasurement: body,
      garmentMeasurement: garment,
      difference,
      status,
    };
  });

  return metrics;
}
