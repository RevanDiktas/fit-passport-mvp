/**
 * Garment Measurement System
 * Applies actual product measurements to create accurate garment fit
 */

import * as THREE from 'three';

/**
 * Product garment measurements (from size charts)
 */
export interface GarmentMeasurements {
  // Primary measurements
  chest: number;          // cm - chest circumference
  waist?: number;         // cm - waist circumference
  length: number;         // cm - total garment length
  shoulderWidth?: number; // cm - shoulder seam to shoulder seam
  sleeveLength?: number;  // cm - sleeve length from shoulder

  // Additional measurements
  hemWidth?: number;      // cm - bottom hem circumference
  neckWidth?: number;     // cm - neck opening width
  armholeDepth?: number;  // cm - armhole depth
}

/**
 * User body measurements (from avatar)
 */
export interface BodyMeasurements {
  chest: number;
  waist: number;
  hips?: number;
  shoulderWidth: number;
  torsoLength?: number;
}

/**
 * Fit analysis result
 */
export interface FitAnalysis {
  overall: 'too_tight' | 'tight' | 'perfect' | 'loose' | 'too_loose';
  chestFit: FitMetric;
  waistFit?: FitMetric;
  shoulderFit?: FitMetric;
  lengthFit?: FitMetric;
  recommendation: string;
}

export interface FitMetric {
  garmentMeasurement: number;
  bodyMeasurement: number;
  difference: number; // positive = loose, negative = tight
  status: 'too_tight' | 'tight' | 'perfect' | 'loose' | 'too_loose';
  percentage: number; // % difference
}

/**
 * Calculate fit analysis between garment and body measurements
 */
export function analyzeFit(
  garmentMeasurements: GarmentMeasurements,
  bodyMeasurements: BodyMeasurements
): FitAnalysis {
  // Analyze chest fit
  const chestDiff = garmentMeasurements.chest - bodyMeasurements.chest;
  const chestPercentage = (chestDiff / bodyMeasurements.chest) * 100;

  const chestFit: FitMetric = {
    garmentMeasurement: garmentMeasurements.chest,
    bodyMeasurement: bodyMeasurements.chest,
    difference: chestDiff,
    percentage: chestPercentage,
    status: classifyFit(chestPercentage),
  };

  // Analyze waist fit (if available)
  let waistFit: FitMetric | undefined;
  if (garmentMeasurements.waist) {
    const waistDiff = garmentMeasurements.waist - bodyMeasurements.waist;
    const waistPercentage = (waistDiff / bodyMeasurements.waist) * 100;
    waistFit = {
      garmentMeasurement: garmentMeasurements.waist,
      bodyMeasurement: bodyMeasurements.waist,
      difference: waistDiff,
      percentage: waistPercentage,
      status: classifyFit(waistPercentage),
    };
  }

  // Analyze shoulder fit (if available)
  let shoulderFit: FitMetric | undefined;
  if (garmentMeasurements.shoulderWidth) {
    const shoulderDiff = garmentMeasurements.shoulderWidth - bodyMeasurements.shoulderWidth;
    const shoulderPercentage = (shoulderDiff / bodyMeasurements.shoulderWidth) * 100;
    shoulderFit = {
      garmentMeasurement: garmentMeasurements.shoulderWidth,
      bodyMeasurement: bodyMeasurements.shoulderWidth,
      difference: shoulderDiff,
      percentage: shoulderPercentage,
      status: classifyFit(shoulderPercentage),
    };
  }

  // Analyze length fit (if body torso length available)
  let lengthFit: FitMetric | undefined;
  if (bodyMeasurements.torsoLength) {
    const lengthDiff = garmentMeasurements.length - bodyMeasurements.torsoLength;
    const lengthPercentage = (lengthDiff / bodyMeasurements.torsoLength) * 100;
    lengthFit = {
      garmentMeasurement: garmentMeasurements.length,
      bodyMeasurement: bodyMeasurements.torsoLength,
      difference: lengthDiff,
      percentage: lengthPercentage,
      status: classifyFit(lengthPercentage),
    };
  }

  // Determine overall fit (worst case among key measurements)
  const allStatuses = [
    chestFit.status,
    waistFit?.status,
    shoulderFit?.status,
  ].filter(Boolean) as Array<'too_tight' | 'tight' | 'perfect' | 'loose' | 'too_loose'>;

  const statusPriority = {
    too_tight: 0,
    tight: 1,
    perfect: 2,
    loose: 1,
    too_loose: 0,
  };

  const overall = allStatuses.reduce((worst, current) =>
    statusPriority[current] < statusPriority[worst] ? current : worst
  );

  // Generate recommendation
  const recommendation = generateRecommendation(chestFit, waistFit, shoulderFit, lengthFit);

  return {
    overall,
    chestFit,
    waistFit,
    shoulderFit,
    lengthFit,
    recommendation,
  };
}

/**
 * Classify fit based on percentage difference
 */
function classifyFit(percentage: number): 'too_tight' | 'tight' | 'perfect' | 'loose' | 'too_loose' {
  if (percentage < -5) return 'too_tight';   // 5% smaller than body
  if (percentage < 2) return 'tight';        // 2% smaller to 2% larger
  if (percentage < 10) return 'perfect';     // 2-10% larger (ideal ease)
  if (percentage < 20) return 'loose';       // 10-20% larger
  return 'too_loose';                        // > 20% larger
}

/**
 * Generate fit recommendation text
 */
function generateRecommendation(
  chestFit: FitMetric,
  waistFit?: FitMetric,
  shoulderFit?: FitMetric,
  lengthFit?: FitMetric
): string {
  const issues: string[] = [];

  if (chestFit.status === 'too_tight') {
    issues.push(`chest will be very tight (${Math.abs(chestFit.difference).toFixed(0)}cm too small)`);
  } else if (chestFit.status === 'tight') {
    issues.push(`chest will be snug`);
  } else if (chestFit.status === 'too_loose') {
    issues.push(`chest will be very loose (${chestFit.difference.toFixed(0)}cm extra)`);
  }

  if (waistFit) {
    if (waistFit.status === 'too_tight') {
      issues.push(`waist will be very tight (${Math.abs(waistFit.difference).toFixed(0)}cm too small)`);
    } else if (waistFit.status === 'too_loose') {
      issues.push(`waist will be very loose (${waistFit.difference.toFixed(0)}cm extra)`);
    }
  }

  if (shoulderFit) {
    if (shoulderFit.status === 'too_tight') {
      issues.push(`shoulders will be too narrow`);
    } else if (shoulderFit.status === 'too_loose') {
      issues.push(`shoulders will be too wide`);
    }
  }

  if (lengthFit) {
    if (lengthFit.difference < -5) {
      issues.push(`garment will be too short`);
    } else if (lengthFit.difference > 15) {
      issues.push(`garment will be very long`);
    }
  }

  if (issues.length === 0) {
    return '✓ Perfect fit - this size should fit well';
  } else if (issues.length === 1) {
    return `⚠ ${issues[0]}`;
  } else {
    return `⚠ ${issues.join(', ')}`;
  }
}

/**
 * Calculate actual fabric ease based on product vs body measurements
 */
export function calculateActualEase(
  garmentMeasurements: GarmentMeasurements,
  bodyMeasurements: BodyMeasurements
): {
  chestEase: number;
  waistEase: number;
  shoulderEase: number;
} {
  const chestEase = garmentMeasurements.chest - bodyMeasurements.chest;

  const waistEase = garmentMeasurements.waist
    ? garmentMeasurements.waist - bodyMeasurements.waist
    : chestEase * 0.75; // Estimate if not provided

  const shoulderEase = garmentMeasurements.shoulderWidth
    ? garmentMeasurements.shoulderWidth - bodyMeasurements.shoulderWidth
    : Math.min(chestEase * 0.4, 3); // Estimate if not provided

  return {
    chestEase: Math.max(0, chestEase), // Ensure non-negative
    waistEase: Math.max(0, waistEase),
    shoulderEase: Math.max(0, shoulderEase),
  };
}

/**
 * Adjust garment shape based on product measurements
 * Returns scale factors for different body regions
 */
export function calculateGarmentScaleFactors(
  garmentMeasurements: GarmentMeasurements,
  bodyMeasurements: BodyMeasurements,
  baseGarmentChest: number = 100 // Base template chest circumference
): {
  chestScale: number;
  waistScale: number;
  shoulderScale: number;
  lengthScale: number;
} {
  // Calculate how much to scale the base template to match product measurements
  const chestScale = garmentMeasurements.chest / baseGarmentChest;

  const waistScale = garmentMeasurements.waist
    ? garmentMeasurements.waist / (baseGarmentChest * 0.9) // Base waist is 90% of chest
    : chestScale * 0.95;

  const shoulderScale = garmentMeasurements.shoulderWidth
    ? garmentMeasurements.shoulderWidth / 45 // Base shoulder width
    : chestScale * 0.85;

  const lengthScale = garmentMeasurements.length / 70; // Base length 70cm

  return {
    chestScale,
    waistScale,
    shoulderScale,
    lengthScale,
  };
}

/**
 * Determine fit recommendation for size selection
 */
export function recommendSize(
  availableSizes: Array<{ size: string; measurements: GarmentMeasurements }>,
  bodyMeasurements: BodyMeasurements
): {
  recommendedSize: string;
  analysis: FitAnalysis;
  alternativeSizes?: Array<{ size: string; reason: string }>;
} {
  let bestSize = availableSizes[0];
  let bestAnalysis = analyzeFit(bestSize.measurements, bodyMeasurements);
  let bestScore = calculateFitScore(bestAnalysis);

  const alternatives: Array<{ size: string; reason: string }> = [];

  for (const sizeOption of availableSizes) {
    const analysis = analyzeFit(sizeOption.measurements, bodyMeasurements);
    const score = calculateFitScore(analysis);

    if (score > bestScore) {
      // Add previous best as alternative
      if (bestAnalysis.overall !== 'too_tight' && bestAnalysis.overall !== 'too_loose') {
        alternatives.push({
          size: bestSize.size,
          reason: `Alternative: ${bestAnalysis.recommendation}`,
        });
      }

      bestSize = sizeOption;
      bestAnalysis = analysis;
      bestScore = score;
    } else if (score > 0 && analysis.overall !== 'too_tight' && analysis.overall !== 'too_loose') {
      alternatives.push({
        size: sizeOption.size,
        reason: analysis.recommendation,
      });
    }
  }

  return {
    recommendedSize: bestSize.size,
    analysis: bestAnalysis,
    alternativeSizes: alternatives.slice(0, 2), // Top 2 alternatives
  };
}

/**
 * Calculate numerical fit score (higher = better)
 */
function calculateFitScore(analysis: FitAnalysis): number {
  const statusScores = {
    too_tight: -10,
    tight: 3,
    perfect: 10,
    loose: 5,
    too_loose: -5,
  };

  let score = statusScores[analysis.overall] * 2; // Weight overall fit heavily

  score += statusScores[analysis.chestFit.status];
  if (analysis.waistFit) score += statusScores[analysis.waistFit.status];
  if (analysis.shoulderFit) score += statusScores[analysis.shoulderFit.status];

  return score;
}
