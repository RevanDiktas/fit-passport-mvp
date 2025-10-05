import * as THREE from 'three';

/**
 * Creates a simple parametric t-shirt mesh
 * Proportions based on standard t-shirt measurements
 */
export function createTShirtGeometry(
  chestCircumference = 95,
  shoulderWidth = 45,
  length = 65
): THREE.Group {
  const tshirt = new THREE.Group();

  // Scale factors from cm measurements
  const chestRadius = (chestCircumference / (2 * Math.PI)) * 0.01;
  const torsoWidth = shoulderWidth * 0.01;
  const torsoLength = length * 0.01;

  // Torso body - main t-shirt body
  const torsoGeometry = new THREE.CylinderGeometry(
    chestRadius * 0.9, // Top radius (shoulders)
    chestRadius * 0.95, // Bottom radius (waist)
    torsoLength,
    16,
    1,
    true // Open-ended cylinder
  );
  const torsoMesh = new THREE.Mesh(torsoGeometry);
  torsoMesh.position.y = 1.6 - 0.12 - 0.1 - torsoLength / 2;
  tshirt.add(torsoMesh);

  // Sleeves
  const sleeveLength = 0.25;
  const sleeveRadius = 0.06;

  // Left sleeve
  const sleeveGeometry = new THREE.CylinderGeometry(
    sleeveRadius,
    sleeveRadius * 0.9,
    sleeveLength,
    8,
    1,
    true
  );

  const leftSleeve = new THREE.Mesh(sleeveGeometry);
  leftSleeve.rotation.z = Math.PI / 2;
  leftSleeve.position.set(
    -torsoWidth / 2 - sleeveLength / 2,
    1.6 - 0.12 - 0.1 - 0.05,
    0
  );
  tshirt.add(leftSleeve);

  // Right sleeve
  const rightSleeve = new THREE.Mesh(sleeveGeometry);
  rightSleeve.rotation.z = -Math.PI / 2;
  rightSleeve.position.set(
    torsoWidth / 2 + sleeveLength / 2,
    1.6 - 0.12 - 0.1 - 0.05,
    0
  );
  tshirt.add(rightSleeve);

  // Neck opening (slightly elevated from torso top)
  const neckRadius = chestRadius * 0.35;
  const neckGeometry = new THREE.CylinderGeometry(
    neckRadius,
    neckRadius * 1.1,
    0.08,
    12,
    1,
    true
  );
  const neckMesh = new THREE.Mesh(neckGeometry);
  neckMesh.position.y = 1.6 - 0.12 - 0.1;
  tshirt.add(neckMesh);

  return tshirt;
}

/**
 * Update t-shirt geometry based on measurements
 */
export function updateTShirtScale(
  tshirt: THREE.Group,
  chest: number,
  shoulderWidth: number,
  torsoLength: number
): void {
  const scaleX = shoulderWidth / 45;
  const scaleY = torsoLength / 65;
  const scaleZ = chest / 95;

  tshirt.scale.set(scaleX, scaleY, scaleZ);
}
