/**
 * Example: Using Product Measurements for Virtual Try-On
 *
 * This shows how to use actual garment measurements from a product's size chart
 * to create an accurate virtual try-on experience
 */

import { GarmentMeasurements, BodyMeasurements, recommendSize } from './garmentMeasurements';
import { createHybridTShirt } from './hybridGarmentFitting';
import * as THREE from 'three';

/**
 * EXAMPLE 1: Single Size Product
 *
 * When you have measurements for one specific size (e.g., from a size chart)
 */
export function createTShirtFromSizeChart(
  avatarMesh: THREE.Mesh,
  productMeasurements: GarmentMeasurements,
  userBodyMeasurements: BodyMeasurements
) {
  // Create garment with product measurements
  const tshirt = createHybridTShirt(avatarMesh, {
    garmentMeasurements: productMeasurements,
    bodyMeasurements: userBodyMeasurements,
    color: 0x4A90E2,

    // Fit analysis callback - use this to show fit warnings to user
    onFitAnalysis: (analysis) => {
      console.log('Fit Analysis:', {
        overall: analysis.overall,
        recommendation: analysis.recommendation,
        chestFit: `${analysis.chestFit.difference > 0 ? '+' : ''}${analysis.chestFit.difference.toFixed(1)}cm`,
      });

      // Show UI warning if fit is bad
      if (analysis.overall === 'too_tight' || analysis.overall === 'too_loose') {
        console.warn('⚠️ Poor fit detected:', analysis.recommendation);
      }
    },
  });

  return tshirt;
}

/**
 * EXAMPLE 2: Multiple Sizes - Recommend Best Size
 *
 * When you have a size chart with multiple sizes, find the best fit
 */
export function demonstrateMultipleSizes() {
  // Example: Zara Basic T-Shirt size chart
  const availableSizes = [
    {
      size: 'S',
      measurements: {
        chest: 96,
        waist: 88,
        length: 68,
        shoulderWidth: 44,
      } as GarmentMeasurements,
    },
    {
      size: 'M',
      measurements: {
        chest: 102,
        waist: 94,
        length: 70,
        shoulderWidth: 46,
      } as GarmentMeasurements,
    },
    {
      size: 'L',
      measurements: {
        chest: 108,
        waist: 100,
        length: 72,
        shoulderWidth: 48,
      } as GarmentMeasurements,
    },
    {
      size: 'XL',
      measurements: {
        chest: 114,
        waist: 106,
        length: 74,
        shoulderWidth: 50,
      } as GarmentMeasurements,
    },
  ];

  // User's body measurements
  const userBody: BodyMeasurements = {
    chest: 95,
    waist: 80,
    shoulderWidth: 45,
    torsoLength: 68,
  };

  // Find best size
  const result = recommendSize(availableSizes, userBody);

  console.log('Size Recommendation:', {
    recommended: result.recommendedSize,
    fit: result.analysis.overall,
    reason: result.analysis.recommendation,
    alternatives: result.alternativeSizes,
  });

  return result;
}

/**
 * EXAMPLE 3: Real-world Size Chart Data
 *
 * Examples of actual product measurements from popular retailers
 */
export const EXAMPLE_SIZE_CHARTS = {
  // H&M Basic T-Shirt (slim fit)
  hm_basic_tshirt: {
    S: {
      chest: 94,
      waist: 86,
      length: 68,
      shoulderWidth: 43,
      sleeveLength: 20,
    } as GarmentMeasurements,
    M: {
      chest: 100,
      waist: 92,
      length: 70,
      shoulderWidth: 45,
      sleeveLength: 21,
    } as GarmentMeasurements,
    L: {
      chest: 106,
      waist: 98,
      length: 72,
      shoulderWidth: 47,
      sleeveLength: 22,
    } as GarmentMeasurements,
  },

  // Uniqlo Airism T-Shirt (regular fit)
  uniqlo_airism: {
    S: {
      chest: 98,
      waist: 90,
      length: 66,
      shoulderWidth: 44,
      sleeveLength: 19,
    } as GarmentMeasurements,
    M: {
      chest: 104,
      waist: 96,
      length: 68,
      shoulderWidth: 46,
      sleeveLength: 20,
    } as GarmentMeasurements,
    L: {
      chest: 110,
      waist: 102,
      length: 70,
      shoulderWidth: 48,
      sleeveLength: 21,
    } as GarmentMeasurements,
  },

  // Zara Oversized T-Shirt (loose fit)
  zara_oversized: {
    S: {
      chest: 110,
      waist: 104,
      length: 70,
      shoulderWidth: 50,
      sleeveLength: 23,
    } as GarmentMeasurements,
    M: {
      chest: 116,
      waist: 110,
      length: 72,
      shoulderWidth: 52,
      sleeveLength: 24,
    } as GarmentMeasurements,
    L: {
      chest: 122,
      waist: 116,
      length: 74,
      shoulderWidth: 54,
      sleeveLength: 25,
    } as GarmentMeasurements,
  },
};

/**
 * EXAMPLE 4: Complete Usage Flow
 */
export function completeExample(
  avatarMesh: THREE.Mesh,
  retailer: 'hm_basic_tshirt' | 'uniqlo_airism' | 'zara_oversized',
  selectedSize: 'S' | 'M' | 'L',
  userBodyMeasurements: BodyMeasurements
) {
  // 1. Get product measurements for selected size
  const sizeChart = EXAMPLE_SIZE_CHARTS[retailer];
  const productMeasurements = sizeChart[selectedSize];

  console.log(`[Example] Creating ${retailer} size ${selectedSize}`);

  // 2. Create garment with measurements
  const garment = createHybridTShirt(avatarMesh, {
    garmentMeasurements: productMeasurements,
    bodyMeasurements: userBodyMeasurements,
    color: 0x4A90E2,

    onFitAnalysis: (analysis) => {
      // Display fit information to user
      console.log('\n📏 Fit Analysis:');
      console.log(`Overall: ${analysis.overall.toUpperCase()}`);
      console.log(`Recommendation: ${analysis.recommendation}`);
      console.log('\nDetails:');
      console.log(`  Chest: ${analysis.chestFit.status} (${analysis.chestFit.difference > 0 ? '+' : ''}${analysis.chestFit.difference.toFixed(1)}cm)`);

      if (analysis.waistFit) {
        console.log(`  Waist: ${analysis.waistFit.status} (${analysis.waistFit.difference > 0 ? '+' : ''}${analysis.waistFit.difference.toFixed(1)}cm)`);
      }

      if (analysis.shoulderFit) {
        console.log(`  Shoulders: ${analysis.shoulderFit.status} (${analysis.shoulderFit.difference > 0 ? '+' : ''}${analysis.shoulderFit.difference.toFixed(1)}cm)`);
      }

      // Visual feedback based on fit
      if (analysis.overall === 'perfect' || analysis.overall === 'loose') {
        console.log('\n✅ This size should fit well!');
      } else if (analysis.overall === 'tight') {
        console.log('\n⚠️  This size might be snug. Consider sizing up.');
      } else if (analysis.overall === 'too_tight') {
        console.log('\n❌ This size will be too tight. Please size up.');
      } else if (analysis.overall === 'too_loose') {
        console.log('\n❌ This size will be too loose. Please size down.');
      }
    },
  });

  return garment;
}

/**
 * USAGE IN COMPONENTS:
 *
 * ```tsx
 * // In your TShirt component:
 * const tshirt = createHybridTShirt(avatarMesh, {
 *   garmentMeasurements: {
 *     chest: 102,      // From product size chart
 *     waist: 94,
 *     length: 70,
 *     shoulderWidth: 46,
 *   },
 *   bodyMeasurements: {
 *     chest: 95,       // From user's avatar
 *     waist: 80,
 *     shoulderWidth: 45,
 *     torsoLength: 68,
 *   },
 *   color: 0x4A90E2,
 *   onFitAnalysis: (analysis) => {
 *     // Update UI with fit information
 *     setFitRecommendation(analysis.recommendation);
 *     setFitStatus(analysis.overall);
 *   },
 * });
 * ```
 */
