'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';
import { calculateAvatarReferencePoints, AvatarReferencePoints } from '@/lib/3d/avatarReferencePoints';

interface ReferencePointsProps {
  avatarMesh: THREE.Mesh | null;
}

/**
 * Visual markers for anatomical reference points on the avatar
 */
export function ReferencePoints({ avatarMesh }: ReferencePointsProps): JSX.Element | null {
  const [points, setPoints] = useState<AvatarReferencePoints | null>(null);

  useEffect(() => {
    if (!avatarMesh) {
      setPoints(null);
      return;
    }

    // Update world matrix
    avatarMesh.updateWorldMatrix(true, false);
    const worldMatrix = avatarMesh.matrixWorld;

    // Calculate reference points
    const referencePoints = calculateAvatarReferencePoints(avatarMesh, worldMatrix);
    setPoints(referencePoints);

    console.log('[ReferencePoints] Calculated points:', referencePoints);
  }, [avatarMesh]);

  if (!points) return null;

  // Define point colors for different body regions
  const headColor = 0xff0000;      // Red
  const shoulderColor = 0x00ff00;  // Green
  const torsoColor = 0x0000ff;     // Blue
  const armColor = 0xffff00;       // Yellow
  const legColor = 0xff00ff;       // Magenta
  const footColor = 0x00ffff;      // Cyan

  // Create sphere markers for each point
  const markerSize = 0.02;

  return (
    <group>
      {/* Head & Neck */}
      <mesh position={points.crownOfHead}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={headColor} />
      </mesh>
      <mesh position={points.neckBase}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={headColor} />
      </mesh>
      <mesh position={points.chinBottom}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={headColor} />
      </mesh>

      {/* Shoulders */}
      <mesh position={points.leftShoulderTop}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={shoulderColor} />
      </mesh>
      <mesh position={points.rightShoulderTop}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={shoulderColor} />
      </mesh>
      <mesh position={points.leftShoulderOuter}>
        <sphereGeometry args={[markerSize * 1.5, 8, 8]} />
        <meshBasicMaterial color={shoulderColor} />
      </mesh>
      <mesh position={points.rightShoulderOuter}>
        <sphereGeometry args={[markerSize * 1.5, 8, 8]} />
        <meshBasicMaterial color={shoulderColor} />
      </mesh>

      {/* Torso */}
      <mesh position={points.chestCenter}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.chestLeft}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.chestRight}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.waistCenter}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.waistLeft}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.waistRight}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.hipCenter}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.hipLeft}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>
      <mesh position={points.hipRight}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={torsoColor} />
      </mesh>

      {/* Arms */}
      <mesh position={points.leftElbow}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={armColor} />
      </mesh>
      <mesh position={points.rightElbow}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={armColor} />
      </mesh>
      <mesh position={points.leftWrist}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={armColor} />
      </mesh>
      <mesh position={points.rightWrist}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={armColor} />
      </mesh>
      <mesh position={points.leftHandTip}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={armColor} />
      </mesh>
      <mesh position={points.rightHandTip}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={armColor} />
      </mesh>

      {/* Legs */}
      <mesh position={points.leftKnee}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={legColor} />
      </mesh>
      <mesh position={points.rightKnee}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={legColor} />
      </mesh>
      <mesh position={points.leftAnkle}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={legColor} />
      </mesh>
      <mesh position={points.rightAnkle}>
        <sphereGeometry args={[markerSize * 1.3, 8, 8]} />
        <meshBasicMaterial color={legColor} />
      </mesh>

      {/* Feet */}
      <mesh position={points.leftFootBottom}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={footColor} />
      </mesh>
      <mesh position={points.rightFootBottom}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={footColor} />
      </mesh>
      <mesh position={points.leftFootFront}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={footColor} />
      </mesh>
      <mesh position={points.rightFootFront}>
        <sphereGeometry args={[markerSize, 8, 8]} />
        <meshBasicMaterial color={footColor} />
      </mesh>
    </group>
  );
}
