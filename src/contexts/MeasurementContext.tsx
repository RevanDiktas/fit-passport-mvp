'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { BodyMeasurements, PartialMeasurements } from '@/types/measurements';

interface MeasurementContextType {
  measurements: PartialMeasurements;
  setMeasurements: (measurements: PartialMeasurements) => void;
  updateMeasurement: (
    field: keyof BodyMeasurements,
    value: number
  ) => void;
  clearMeasurements: () => void;
}

const MeasurementContext = createContext<MeasurementContextType | undefined>(
  undefined
);

export function MeasurementProvider({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  const [measurements, setMeasurements] = useState<PartialMeasurements>({});

  const updateMeasurement = (
    field: keyof BodyMeasurements,
    value: number
  ): void => {
    setMeasurements((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearMeasurements = (): void => {
    setMeasurements({});
  };

  return (
    <MeasurementContext.Provider
      value={{
        measurements,
        setMeasurements,
        updateMeasurement,
        clearMeasurements,
      }}
    >
      {children}
    </MeasurementContext.Provider>
  );
}

export function useMeasurements(): MeasurementContextType {
  const context = useContext(MeasurementContext);
  if (context === undefined) {
    throw new Error(
      'useMeasurements must be used within a MeasurementProvider'
    );
  }
  return context;
}
