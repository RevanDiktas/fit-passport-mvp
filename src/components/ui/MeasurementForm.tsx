'use client';

import { useState } from 'react';
import {
  BodyMeasurements,
  MeasurementUnit,
  MEASUREMENT_RANGES,
} from '@/types/measurements';
import {
  validateMeasurement,
  convertMeasurement,
} from '@/lib/utils/measurements';

interface MeasurementFormProps {
  onSubmit: (measurements: BodyMeasurements) => void;
}

export function MeasurementForm({
  onSubmit,
}: MeasurementFormProps): JSX.Element {
  const [unit, setUnit] = useState<MeasurementUnit>('cm');
  const [measurements, setMeasurements] = useState<
    Partial<BodyMeasurements>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (
    field: keyof BodyMeasurements,
    value: string
  ): void => {
    const numValue = parseFloat(value);

    if (isNaN(numValue)) {
      setMeasurements((prev) => ({ ...prev, [field]: undefined }));
      return;
    }

    const cmValue =
      unit === 'inches' ? convertMeasurement(numValue, 'inches', 'cm') : numValue;

    const validation = validateMeasurement(field, cmValue);

    setErrors((prev) => {
      const newErrors = { ...prev };
      if (validation.valid) {
        delete newErrors[field];
      } else if (validation.error) {
        newErrors[field] = validation.error;
      }
      return newErrors;
    });

    setMeasurements((prev) => ({
      ...prev,
      [field]: cmValue,
    }));
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();

    const hasErrors = Object.keys(errors).length > 0;
    if (hasErrors) return;

    if (measurements.height && measurements.chest && measurements.waist) {
      onSubmit(measurements as BodyMeasurements);
    }
  };

  const getDisplayValue = (field: keyof BodyMeasurements): string => {
    const cmValue = measurements[field];
    if (!cmValue) return '';

    const displayValue =
      unit === 'inches' ? convertMeasurement(cmValue, 'cm', 'inches') : cmValue;

    return displayValue.toString();
  };

  const fields: Array<{ key: keyof BodyMeasurements; label: string }> = [
    { key: 'height', label: 'Height' },
    { key: 'chest', label: 'Chest' },
    { key: 'waist', label: 'Waist' },
    { key: 'hips', label: 'Hips' },
    { key: 'shoulderWidth', label: 'Shoulder Width' },
    { key: 'armLength', label: 'Arm Length' },
    { key: 'inseam', label: 'Inseam' },
    { key: 'neckCircumference', label: 'Neck' },
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-6 bg-black text-white h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Body Measurements</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUnit('cm')}
            className={`px-3 py-1 rounded ${
              unit === 'cm'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            CM
          </button>
          <button
            type="button"
            onClick={() => setUnit('inches')}
            className={`px-3 py-1 rounded ${
              unit === 'inches'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300'
            }`}
          >
            Inches
          </button>
        </div>
      </div>

      {fields.map(({ key, label }) => (
        <div key={key} className="flex flex-col">
          <label htmlFor={key} className="text-sm font-medium mb-1 text-gray-300">
            {label} ({unit})
          </label>
          <input
            id={key}
            type="number"
            step="0.1"
            value={getDisplayValue(key)}
            onChange={(e) => handleInputChange(key, e.target.value)}
            className={`border rounded px-3 py-2 bg-gray-900 text-white ${
              errors[key] ? 'border-red-500' : 'border-gray-700'
            }`}
            placeholder={`${MEASUREMENT_RANGES[key].min}-${MEASUREMENT_RANGES[key].max} cm`}
          />
          {errors[key] && (
            <span className="text-red-400 text-sm mt-1">{errors[key]}</span>
          )}
        </div>
      ))}

      <button
        type="submit"
        className="w-full bg-blue-600 text-white py-3 rounded font-semibold hover:bg-blue-700 transition-colors"
      >
        Generate Avatar
      </button>
    </form>
  );
}
