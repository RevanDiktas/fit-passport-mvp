/**
 * Avatar Component
 * Renders either SMPL-generated GLB avatar or fallback static mannequin
 */

'use client';

import { useEffect, useRef, Suspense, useState } from 'react';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { createMannequinGeometry } from '@/lib/3d/createMannequin';

interface AvatarProps {
  avatarUrl?: string | null;
  onMeshLoaded?: (mesh: THREE.Mesh | null) => void;
}

/**
 * GLB Avatar Loader - loads dynamic SMPL avatar
 */
function GLBAvatar({ url, onMeshLoaded }: { url: string; onMeshLoaded?: (mesh: THREE.Mesh | null) => void }) {
  const { scene } = useGLTF(url);
  const groupRef = useRef<THREE.Group>(null);
  const [meshExtracted, setMeshExtracted] = useState(false);

  useEffect(() => {
    if (!scene || meshExtracted) return;

    let avatarMesh: THREE.Mesh | null = null;

    // Apply material to SMPL mesh and extract first mesh reference
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        if (!child.material || !(child.material instanceof THREE.MeshStandardMaterial)) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            roughness: 0.7,
            metalness: 0.1,
          });
        }
        child.castShadow = true;
        child.receiveShadow = true;

        // Extract the first mesh as the avatar body mesh
        if (!avatarMesh) {
          avatarMesh = child;
        }
      }
    });

    // Notify parent component of mesh
    if (onMeshLoaded && avatarMesh) {
      console.log('[Avatar] Avatar mesh loaded and extracted');
      onMeshLoaded(avatarMesh);
      setMeshExtracted(true);
    }
  }, [scene, onMeshLoaded, meshExtracted]);

  // Calculate position offset to place feet at ground level
  useEffect(() => {
    if (!scene || !groupRef.current) return;

    const box = new THREE.Box3().setFromObject(scene);

    // Lift the avatar so feet (min Y) are at ground level (Y=0)
    const offsetY = -box.min.y;
    groupRef.current.position.y = offsetY;

    console.log('[Avatar] Positioned at ground level:', {
      boundingBoxMinY: box.min.y,
      boundingBoxMaxY: box.max.y,
      appliedOffset: offsetY,
      height: box.max.y - box.min.y,
    });
  }, [scene]);

  return (
    <group ref={groupRef}>
      <primitive object={scene} />
    </group>
  );
}

/**
 * Fallback Static Mannequin
 */
function StaticMannequin() {
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!groupRef.current) return;

    const mannequin = createMannequinGeometry();

    // Apply PBR material
    mannequin.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material = new THREE.MeshStandardMaterial({
          color: 0xcccccc,
          roughness: 0.7,
          metalness: 0.1,
        });
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });

    groupRef.current.add(mannequin);

    return () => {
      groupRef.current?.remove(mannequin);
    };
  }, []);

  return <group ref={groupRef} />;
}

/**
 * Loading Fallback
 */
function AvatarLoading() {
  return (
    <mesh>
      <sphereGeometry args={[0.5, 16, 16]} />
      <meshStandardMaterial color="#666666" wireframe />
    </mesh>
  );
}

/**
 * Main Avatar Component
 * Only shows SMPL avatar when generated - no fallback mannequin
 */
export function Avatar({ avatarUrl, onMeshLoaded }: AvatarProps): JSX.Element {
  // Only render if we have a generated avatar
  if (avatarUrl) {
    return (
      <Suspense fallback={<AvatarLoading />}>
        <GLBAvatar url={avatarUrl} onMeshLoaded={onMeshLoaded} />
      </Suspense>
    );
  }

  // No avatar - render nothing, and clear mesh reference
  useEffect(() => {
    if (onMeshLoaded) {
      onMeshLoaded(null);
    }
  }, [onMeshLoaded]);

  return null;
}
