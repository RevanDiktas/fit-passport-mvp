import {
  cmToInches,
  inchesToCm,
  convertMeasurement,
  validateMeasurement,
  validateAllMeasurements,
} from '../measurements';

describe('Measurement Conversion', () => {
  test('converts cm to inches correctly', () => {
    expect(cmToInches(100)).toBe(39.37);
    expect(cmToInches(170)).toBe(66.93);
    expect(cmToInches(0)).toBe(0);
  });

  test('converts inches to cm correctly', () => {
    expect(inchesToCm(39.37)).toBe(100);
    expect(inchesToCm(66.93)).toBe(170);
    expect(inchesToCm(0)).toBe(0);
  });

  test('convertMeasurement handles same unit', () => {
    expect(convertMeasurement(100, 'cm', 'cm')).toBe(100);
    expect(convertMeasurement(100, 'inches', 'inches')).toBe(100);
  });

  test('convertMeasurement handles unit conversion', () => {
    expect(convertMeasurement(100, 'cm', 'inches')).toBe(39.37);
    expect(convertMeasurement(39.37, 'inches', 'cm')).toBe(100);
  });
});

describe('Measurement Validation', () => {
  test('accepts valid height', () => {
    const result = validateMeasurement('height', 170);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('rejects height below minimum', () => {
    const result = validateMeasurement('height', 130);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 140');
  });

  test('rejects height above maximum', () => {
    const result = validateMeasurement('height', 250);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('cannot exceed 220');
  });

  test('accepts valid chest measurement', () => {
    const result = validateMeasurement('chest', 95);
    expect(result.valid).toBe(true);
  });

  test('accepts valid waist measurement', () => {
    const result = validateMeasurement('waist', 80);
    expect(result.valid).toBe(true);
  });
});

describe('Validate All Measurements', () => {
  test('validates correct measurements', () => {
    const measurements = {
      height: 170,
      chest: 95,
      waist: 80,
    };
    const result = validateAllMeasurements(measurements);
    expect(result.valid).toBe(true);
    expect(Object.keys(result.errors)).toHaveLength(0);
  });

  test('catches multiple validation errors', () => {
    const measurements = {
      height: 130,
      chest: 200,
      waist: 40,
    };
    const result = validateAllMeasurements(measurements);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.errors)).toHaveLength(3);
  });

  test('handles partial measurements', () => {
    const measurements = {
      height: 170,
    };
    const result = validateAllMeasurements(measurements);
    expect(result.valid).toBe(true);
  });
});
