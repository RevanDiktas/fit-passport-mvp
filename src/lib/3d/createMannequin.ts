import * as THREE from 'three';

/**
 * Creates a simple procedural mannequin mesh
 * Temporary solution before SMPL integration
 */
export function createMannequinGeometry(): THREE.Group {
  const mannequin = new THREE.Group();

  // Body proportions (in meters)
  const headRadius = 0.12;
  const neckHeight = 0.1;
  const torsoWidth = 0.35;
  const torsoHeight = 0.6;
  const armLength = 0.6;
  const armRadius = 0.05;
  const legLength = 0.9;
  const legRadius = 0.08;

  // Head
  const headGeometry = new THREE.SphereGeometry(headRadius, 16, 16);
  const head = new THREE.Mesh(headGeometry);
  head.position.y = 1.6;
  mannequin.add(head);

  // Neck
  const neckGeometry = new THREE.CylinderGeometry(
    headRadius * 0.6,
    headRadius * 0.7,
    neckHeight,
    8
  );
  const neck = new THREE.Mesh(neckGeometry);
  neck.position.y = 1.6 - headRadius - neckHeight / 2;
  mannequin.add(neck);

  // Torso
  const torsoGeometry = new THREE.BoxGeometry(
    torsoWidth,
    torsoHeight,
    torsoWidth * 0.5
  );
  const torso = new THREE.Mesh(torsoGeometry);
  torso.position.y = 1.6 - headRadius - neckHeight - torsoHeight / 2;
  mannequin.add(torso);

  // Left arm
  const armGeometry = new THREE.CapsuleGeometry(armRadius, armLength, 4, 8);
  const leftArm = new THREE.Mesh(armGeometry);
  leftArm.rotation.z = Math.PI / 2;
  leftArm.position.set(
    -torsoWidth / 2 - armLength / 2,
    1.6 - headRadius - neckHeight - 0.1,
    0
  );
  mannequin.add(leftArm);

  // Right arm
  const rightArm = new THREE.Mesh(armGeometry);
  rightArm.rotation.z = -Math.PI / 2;
  rightArm.position.set(
    torsoWidth / 2 + armLength / 2,
    1.6 - headRadius - neckHeight - 0.1,
    0
  );
  mannequin.add(rightArm);

  return mannequin;
}
