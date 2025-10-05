import {
  BodyMeasurements,
  MeasurementUnit,
  MEASUREMENT_RANGES,
} from '@/types/measurements';

const CM_TO_INCHES = 0.393701;
const INCHES_TO_CM = 2.54;

/**
 * Convert centimeters to inches
 */
export function cmToInches(cm: number): number {
  return parseFloat((cm * CM_TO_INCHES).toFixed(2));
}

/**
 * Convert inches to centimeters
 */
export function inchesToCm(inches: number): number {
  return parseFloat((inches * INCHES_TO_CM).toFixed(2));
}

/**
 * Convert measurement value between units
 */
export function convertMeasurement(
  value: number,
  fromUnit: MeasurementUnit,
  toUnit: MeasurementUnit
): number {
  if (fromUnit === toUnit) return value;

  if (fromUnit === 'cm' && toUnit === 'inches') {
    return cmToInches(value);
  }

  return inchesToCm(value);
}

/**
 * Validate a single measurement value
 */
export function validateMeasurement(
  field: keyof BodyMeasurements,
  value: number
): { valid: boolean; error?: string } {
  const range = MEASUREMENT_RANGES[field];

  if (value < range.min) {
    return {
      valid: false,
      error: `${field} must be at least ${range.min} cm`,
    };
  }

  if (value > range.max) {
    return {
      valid: false,
      error: `${field} cannot exceed ${range.max} cm`,
    };
  }

  return { valid: true };
}

/**
 * Validate all measurements in a BodyMeasurements object
 */
export function validateAllMeasurements(
  measurements: Partial<BodyMeasurements>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  Object.entries(measurements).forEach(([field, value]) => {
    if (value !== undefined) {
      const result = validateMeasurement(
        field as keyof BodyMeasurements,
        value
      );
      if (!result.valid && result.error) {
        errors[field] = result.error;
      }
    }
  });

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}
