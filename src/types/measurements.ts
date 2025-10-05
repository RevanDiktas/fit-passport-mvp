/**
 * User body measurements in centimeters
 * Based on SMPL model requirements from PRD
 */
export interface BodyMeasurements {
  height: number;          // Total height (cm)
  chest: number;           // Chest circumference (cm)
  waist: number;           // Waist circumference (cm)
  hips: number;            // Hip circumference (cm)
  shoulderWidth: number;   // Shoulder width (cm)
  armLength: number;       // Arm length (cm)
  inseam: number;          // Inseam/leg length (cm)
  neckCircumference: number; // Neck circumference (cm)
}

/**
 * Measurement unit system
 */
export type MeasurementUnit = 'cm' | 'inches';

/**
 * Validation ranges for measurements (in cm)
 */
export interface MeasurementRange {
  min: number;
  max: number;
}

export const MEASUREMENT_RANGES: Record<
  keyof BodyMeasurements,
  MeasurementRange
> = {
  height: { min: 140, max: 210 },
  chest: { min: 70, max: 140 },
  waist: { min: 60, max: 130 },
  hips: { min: 70, max: 140 },
  shoulderWidth: { min: 35, max: 60 },
  armLength: { min: 50, max: 90 },
  inseam: { min: 60, max: 100 },
  neckCircumference: { min: 30, max: 50 },
};

/**
 * Partial measurements for progressive input
 */
export type PartialMeasurements = Partial<BodyMeasurements>;
