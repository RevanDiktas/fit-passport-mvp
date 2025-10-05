'use client';

import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { ReactNode, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Avatar } from './Avatar';
import { TShirt } from './TShirt';
import { ReferencePoints } from './ReferencePoints';
import { BodyMeasurements } from '@/types/measurements';
import { GarmentMeasurements } from '@/lib/3d/garmentMeasurements';

interface SceneProps {
  children?: ReactNode;
  measurements?: BodyMeasurements | null;
  avatarUrl?: string | null;
  garmentMeasurements?: GarmentMeasurements | null;
}

export function Scene({ children, measurements, avatarUrl, garmentMeasurements }: SceneProps): JSX.Element {
  const [avatarMesh, setAvatarMesh] = useState<THREE.Mesh | null>(null);

  console.log('[Scene.tsx] Received props:', {
    measurements: measurements ? 'exists' : 'null',
    avatarUrl: avatarUrl ? 'exists' : 'null',
    garmentMeasurements: garmentMeasurements ? 'exists' : 'null'
  });

  const handleMeshLoaded = useCallback((mesh: THREE.Mesh | null) => {
    console.log('[Scene] Avatar mesh reference updated:', mesh ? 'loaded' : 'cleared');
    setAvatarMesh(mesh);
  }, []);

  const shouldShowTShirt = measurements && garmentMeasurements;
  console.log('[Scene.tsx] Should show T-Shirt:', shouldShowTShirt);

  return (
    <div className="w-full h-screen">
      <Canvas
        camera={{ position: [0, 1.6, 3], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <color attach="background" args={['#f0f0f0']} />

        {/* Ambient light for overall illumination */}
        <ambientLight intensity={0.5} />

        {/* Main directional light */}
        <directionalLight
          position={[5, 5, 5]}
          intensity={1}
          castShadow
        />

        {/* Fill light from opposite side */}
        <directionalLight
          position={[-5, 3, -5]}
          intensity={0.3}
        />

        {/* Ground plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
          <planeGeometry args={[10, 10]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>

        {/* Grid helper for spatial reference */}
        <gridHelper args={[10, 10, '#999999', '#dddddd']} />

        {/* Avatar mannequin (dynamic SMPL or static fallback) */}
        <Avatar avatarUrl={avatarUrl} onMeshLoaded={handleMeshLoaded} />

        {/* T-Shirt garment - only show when measurements exist and garment is visible */}
        {shouldShowTShirt ? (
          <>
            {console.log('[Scene.tsx] Rendering TShirt component')}
            <TShirt
              chest={measurements.chest}
              waist={measurements.waist}
              shoulderWidth={measurements.shoulderWidth}
              torsoLength={65}
              avatarMesh={avatarMesh}
              garmentMeasurements={garmentMeasurements}
              bodyMeasurements={measurements}
            />
          </>
        ) : (
          <>
            {console.log('[Scene.tsx] NOT rendering TShirt component')}
          </>
        )}

        {/* Anatomical reference points visualization */}
        <ReferencePoints avatarMesh={avatarMesh} />

        {/* Orbital controls */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={2}
          maxDistance={10}
          maxPolarAngle={Math.PI / 2}
          target={[0, 1, 0]}
        />

        {children}
      </Canvas>
    </div>
  );
}
