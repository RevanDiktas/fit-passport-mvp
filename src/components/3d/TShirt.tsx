'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { createHybridTShirt } from '@/lib/3d/hybridGarmentFitting';
import { GarmentMeasurements, BodyMeasurements } from '@/lib/3d/garmentMeasurements';

interface TShirtProps {
  chest?: number;
  shoulderWidth?: number;
  torsoLength?: number;
  waist?: number;
  color?: string;
  avatarMesh?: THREE.Mesh | null;
  garmentMeasurements?: GarmentMeasurements | null;
  bodyMeasurements?: BodyMeasurements | null;
}

export function TShirt({
  chest = 95,
  shoulderWidth = 45,
  torsoLength = 70,
  waist = 85,
  color = '#4A90E2',
  avatarMesh = null,
  garmentMeasurements = null,
  bodyMeasurements = null,
}: TShirtProps): JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useThree();
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (!groupRef.current) return;

    // Only create t-shirt if we have an avatar mesh
    if (!avatarMesh) {
      console.log('[TShirt] Waiting for avatar mesh...');
      return;
    }

    setIsProcessing(true);

    // Clear existing t-shirt
    while (groupRef.current.children.length > 0) {
      const child = groupRef.current.children[0];
      groupRef.current.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    console.log('[TShirt] Creating garment using hybrid approach');

    try {
      // Create hybrid t-shirt (avatar mesh + garment transformations)
      const tshirt = createHybridTShirt(avatarMesh, {
        // Use product measurements if available, otherwise use defaults
        ...(garmentMeasurements && bodyMeasurements
          ? {
              garmentMeasurements,
              bodyMeasurements,
              onFitAnalysis: (analysis) => {
                console.log('🔍 Fit Analysis:', {
                  overall: analysis.overall,
                  recommendation: analysis.recommendation,
                  chestFit: `${analysis.chestFit.difference > 0 ? '+' : ''}${analysis.chestFit.difference.toFixed(1)}cm`,
                });
              },
            }
          : {
              chestEase: 8,
              waistEase: 6,
              shoulderEase: 3,
            }),
        color: parseInt(color.replace('#', '0x')),
        gravity: true,
        smoothing: true,
        wrinkles: true,
      });

      groupRef.current.add(tshirt);
      console.log('[TShirt] Hybrid t-shirt created successfully');
    } catch (error) {
      console.error('[TShirt] Error creating t-shirt:', error);
    }

    setIsProcessing(false);

    return () => {
      // Cleanup
      while (groupRef.current && groupRef.current.children.length > 0) {
        const child = groupRef.current.children[0];
        groupRef.current.remove(child);
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (child.material instanceof THREE.Material) {
            child.material.dispose();
          }
        }
      }
    };
  }, [avatarMesh, chest, waist, shoulderWidth, torsoLength, color, garmentMeasurements, bodyMeasurements]);

  return (
    <group ref={groupRef}>
      {/* Add loading indicator if needed */}
      {isProcessing && (
        <mesh position={[0, 1.5, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshStandardMaterial color="#666666" wireframe />
        </mesh>
      )}
    </group>
  );
}
