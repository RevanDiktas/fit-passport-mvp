/**
 * Avatar Anatomical Reference Points
 * Defines key body landmarks for garment fitting, pose-agnostic
 */

import * as THREE from 'three';

export interface AvatarReferencePoints {
  // Head & Neck
  crownOfHead: THREE.Vector3;
  neckBase: THREE.Vector3;
  chinBottom: THREE.Vector3;

  // Shoulders
  leftShoulderTop: THREE.Vector3;
  rightShoulderTop: THREE.Vector3;
  leftShoulderOuter: THREE.Vector3;  // Where arm begins
  rightShoulderOuter: THREE.Vector3;

  // Torso
  chestCenter: THREE.Vector3;
  chestLeft: THREE.Vector3;
  chestRight: THREE.Vector3;
  waistCenter: THREE.Vector3;
  waistLeft: THREE.Vector3;
  waistRight: THREE.Vector3;
  hipCenter: THREE.Vector3;

  // Arms (left)
  leftElbow: THREE.Vector3;
  leftWrist: THREE.Vector3;
  leftHandTip: THREE.Vector3;

  // Arms (right)
  rightElbow: THREE.Vector3;
  rightWrist: THREE.Vector3;
  rightHandTip: THREE.Vector3;

  // Legs
  leftKnee: THREE.Vector3;
  rightKnee: THREE.Vector3;
  leftAnkle: THREE.Vector3;
  rightAnkle: THREE.Vector3;

  // Feet
  leftFootBottom: THREE.Vector3;
  rightFootBottom: THREE.Vector3;
}

/**
 * Calculate anatomical reference points from avatar mesh
 * Works for any pose by analyzing vertex positions and body proportions
 */
export function calculateAvatarReferencePoints(
  avatarMesh: THREE.Mesh,
  worldMatrix: THREE.Matrix4
): AvatarReferencePoints {
  const geometry = avatarMesh.geometry as THREE.BufferGeometry;
  const positions = geometry.attributes.position;

  // Calculate bounding box in world space
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const tempVertex = new THREE.Vector3();
  const allVertices: THREE.Vector3[] = [];

  for (let i = 0; i < positions.count; i++) {
    tempVertex.fromBufferAttribute(positions, i);
    tempVertex.applyMatrix4(worldMatrix);

    allVertices.push(tempVertex.clone());

    if (tempVertex.x < minX) minX = tempVertex.x;
    if (tempVertex.x > maxX) maxX = tempVertex.x;
    if (tempVertex.y < minY) minY = tempVertex.y;
    if (tempVertex.y > maxY) maxY = tempVertex.y;
    if (tempVertex.z < minZ) minZ = tempVertex.z;
    if (tempVertex.z > maxZ) maxZ = tempVertex.z;
  }

  const bodyHeight = maxY - minY;
  const bodyWidth = maxX - minX;
  const bodyDepth = maxZ - minZ;

  console.log('[ReferencePoints] Body dimensions:', {
    height: bodyHeight.toFixed(3),
    width: bodyWidth.toFixed(3),
    depth: bodyDepth.toFixed(3),
  });

  // Helper: Find vertex closest to target position
  const findClosestVertex = (targetY: number, targetX?: number, targetZ?: number): THREE.Vector3 => {
    let closestVertex = allVertices[0];
    let minDistance = Infinity;

    for (const vertex of allVertices) {
      let distance = Math.abs(vertex.y - targetY);

      if (targetX !== undefined) {
        distance += Math.abs(vertex.x - targetX) * 2; // Weight X more
      }
      if (targetZ !== undefined) {
        distance += Math.abs(vertex.z - targetZ);
      }

      if (distance < minDistance) {
        minDistance = distance;
        closestVertex = vertex;
      }
    }

    return closestVertex.clone();
  };

  // Helper: Find extreme vertex (furthest in a direction)
  const findExtremeVertex = (
    direction: 'x' | 'y' | 'z',
    condition: 'min' | 'max',
    withinY?: { min: number; max: number }
  ): THREE.Vector3 => {
    let extremeVertex = allVertices[0];
    let extremeValue = condition === 'min' ? Infinity : -Infinity;

    for (const vertex of allVertices) {
      // Optional Y-range filter
      if (withinY && (vertex.y < withinY.min || vertex.y > withinY.max)) {
        continue;
      }

      const value = vertex[direction];

      if (condition === 'min' && value < extremeValue) {
        extremeValue = value;
        extremeVertex = vertex;
      } else if (condition === 'max' && value > extremeValue) {
        extremeValue = value;
        extremeVertex = vertex;
      }
    }

    return extremeVertex.clone();
  };

  // ===== HEAD & NECK =====
  const crownOfHead = findExtremeVertex('y', 'max', undefined);
  const neckBase = findClosestVertex(minY + bodyHeight * 0.88, 0, minZ); // Front of neck
  const chinBottom = findClosestVertex(minY + bodyHeight * 0.92, 0, minZ);

  // ===== SHOULDERS =====
  const shoulderY = minY + bodyHeight * 0.82;

  // Shoulder tops (where neck meets shoulders)
  const leftShoulderTop = findClosestVertex(shoulderY, -bodyWidth * 0.15, minZ);
  const rightShoulderTop = findClosestVertex(shoulderY, bodyWidth * 0.15, minZ);

  // Shoulder outer points (where arms begin) - furthest X at shoulder height
  const leftShoulderOuter = findExtremeVertex('x', 'min', {
    min: shoulderY - 0.05,
    max: shoulderY + 0.05
  });
  const rightShoulderOuter = findExtremeVertex('x', 'max', {
    min: shoulderY - 0.05,
    max: shoulderY + 0.05
  });

  // ===== TORSO =====
  const chestY = minY + bodyHeight * 0.70;
  const waistY = minY + bodyHeight * 0.55;
  const hipY = minY + bodyHeight * 0.48;

  const chestCenter = findClosestVertex(chestY, 0, minZ);
  const chestLeft = findClosestVertex(chestY, -bodyWidth * 0.2, minZ);
  const chestRight = findClosestVertex(chestY, bodyWidth * 0.2, minZ);

  const waistCenter = findClosestVertex(waistY, 0, minZ);
  const waistLeft = findClosestVertex(waistY, -bodyWidth * 0.18, minZ);
  const waistRight = findClosestVertex(waistY, bodyWidth * 0.18, minZ);

  const hipCenter = findClosestVertex(hipY, 0, minZ);

  // ===== ARMS =====
  // Elbow: roughly 60% down the arm from shoulder
  const armLengthEstimate = bodyHeight * 0.35; // Arms are ~35% of height
  const elbowY = shoulderY - armLengthEstimate * 0.4;

  const leftElbow = findClosestVertex(
    elbowY,
    leftShoulderOuter.x * 0.8, // Slightly inward from shoulder
    undefined
  );
  const rightElbow = findClosestVertex(
    elbowY,
    rightShoulderOuter.x * 0.8,
    undefined
  );

  // Wrist: ~85% down the arm
  const wristY = shoulderY - armLengthEstimate * 0.8;
  const leftWrist = findClosestVertex(wristY, leftShoulderOuter.x * 0.7, undefined);
  const rightWrist = findClosestVertex(wristY, rightShoulderOuter.x * 0.7, undefined);

  // Hand tips: furthest X at low Y (hands extended)
  const leftHandTip = findExtremeVertex('x', 'min', {
    min: wristY - 0.15,
    max: wristY + 0.05
  });
  const rightHandTip = findExtremeVertex('x', 'max', {
    min: wristY - 0.15,
    max: wristY + 0.05
  });

  // ===== LEGS =====
  const kneeY = minY + bodyHeight * 0.28;
  const ankleY = minY + bodyHeight * 0.08;

  const leftKnee = findClosestVertex(kneeY, -bodyWidth * 0.1, minZ);
  const rightKnee = findClosestVertex(kneeY, bodyWidth * 0.1, minZ);

  const leftAnkle = findClosestVertex(ankleY, -bodyWidth * 0.08, minZ);
  const rightAnkle = findClosestVertex(ankleY, bodyWidth * 0.08, minZ);

  // ===== FEET =====
  const leftFootBottom = findExtremeVertex('y', 'min', undefined);
  const rightFootBottom = findClosestVertex(minY, bodyWidth * 0.08, maxZ);

  const referencePoints: AvatarReferencePoints = {
    crownOfHead,
    neckBase,
    chinBottom,
    leftShoulderTop,
    rightShoulderTop,
    leftShoulderOuter,
    rightShoulderOuter,
    chestCenter,
    chestLeft,
    chestRight,
    waistCenter,
    waistLeft,
    waistRight,
    hipCenter,
    leftElbow,
    rightElbow,
    leftWrist,
    rightWrist,
    leftHandTip,
    rightHandTip,
    leftKnee,
    rightKnee,
    leftAnkle,
    rightAnkle,
    leftFootBottom,
    rightFootBottom,
  };

  console.log('[ReferencePoints] Calculated anatomical landmarks:', {
    shoulderWidth: (rightShoulderOuter.x - leftShoulderOuter.x).toFixed(3),
    armSpan: (rightHandTip.x - leftHandTip.x).toFixed(3),
    torsoLength: (neckBase.y - waistCenter.y).toFixed(3),
  });

  return referencePoints;
}

/**
 * Calculate distance from a point to the arm "bone"
 * (straight line from shoulder to wrist along the arm)
 */
export function distanceToArmBone(
  point: THREE.Vector3,
  shoulderPoint: THREE.Vector3,
  wristPoint: THREE.Vector3
): number {
  // Vector from shoulder to wrist (arm direction)
  const armVector = new THREE.Vector3().subVectors(wristPoint, shoulderPoint);
  const armLength = armVector.length();

  // Vector from shoulder to point
  const toPoint = new THREE.Vector3().subVectors(point, shoulderPoint);

  // Project point onto arm line
  const projection = toPoint.dot(armVector) / armLength;

  // Clamp to arm bounds
  const clampedProjection = Math.max(0, Math.min(armLength, projection));

  // Point on arm line
  const pointOnArm = shoulderPoint.clone().add(
    armVector.clone().normalize().multiplyScalar(clampedProjection)
  );

  // Distance from point to arm line
  return point.distanceTo(pointOnArm);
}

/**
 * Calculate distance along arm from shoulder
 * Returns how far along the arm (in meters) this point is
 */
export function distanceAlongArm(
  point: THREE.Vector3,
  shoulderPoint: THREE.Vector3,
  wristPoint: THREE.Vector3
): number {
  const armVector = new THREE.Vector3().subVectors(wristPoint, shoulderPoint);
  const armLength = armVector.length();

  const toPoint = new THREE.Vector3().subVectors(point, shoulderPoint);
  const projection = toPoint.dot(armVector.normalize());

  return Math.max(0, Math.min(armLength, projection));
}
