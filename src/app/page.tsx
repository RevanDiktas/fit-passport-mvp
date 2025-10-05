'use client';

import { useState } from 'react';
import { Scene } from '@/components/3d/Scene';
import { MeasurementForm } from '@/components/ui/MeasurementForm';
import { MeasurementProvider } from '@/contexts/MeasurementContext';
import { BodyMeasurements } from '@/types/measurements';
import { useAvatarGeneration } from '@/hooks/useAvatarGeneration';
import { EXAMPLE_SIZE_CHARTS } from '@/lib/3d/garmentMeasurementsExample';
import { GarmentMeasurements } from '@/lib/3d/garmentMeasurements';

type GarmentType = 'hm_basic_tshirt' | 'uniqlo_airism' | 'zara_oversized';
type GarmentSize = 'S' | 'M' | 'L';

export default function Home(): JSX.Element {
  const [showForm, setShowForm] = useState(true);
  const [measurements, setMeasurements] = useState<BodyMeasurements | null>(
    null
  );
  const [selectedGarmentType, setSelectedGarmentType] = useState<GarmentType>('hm_basic_tshirt');
  const [selectedSize, setSelectedSize] = useState<GarmentSize>('M');
  const [garmentMeasurements, setGarmentMeasurements] = useState<GarmentMeasurements | null>(null);
  const [showGarment, setShowGarment] = useState(true);

  const {
    avatarUrl,
    isLoading,
    error,
    generateAvatar,
  } = useAvatarGeneration();

  const handleMeasurementsSubmit = async (newMeasurements: BodyMeasurements): Promise<void> => {
    setMeasurements(newMeasurements);
    setShowForm(false);

    // Generate SMPL avatar from measurements
    await generateAvatar(newMeasurements);
  };

  const handleRegenerateAvatar = async (): Promise<void> => {
    if (measurements) {
      await generateAvatar(measurements);
    }
  };

  const handleGenerateRandomAvatar = async (): Promise<void> => {
    const randomMeasurements: BodyMeasurements = {
      height: Math.floor(Math.random() * 40) + 150,
      chest: Math.floor(Math.random() * 30) + 80,
      waist: Math.floor(Math.random() * 25) + 65,
      hips: Math.floor(Math.random() * 30) + 85,
      shoulderWidth: Math.floor(Math.random() * 15) + 35,
      armLength: Math.floor(Math.random() * 15) + 55,
      inseam: Math.floor(Math.random() * 20) + 70,
      neckCircumference: Math.floor(Math.random() * 10) + 32,
    };
    setMeasurements(randomMeasurements);
    setShowForm(false);
    await generateAvatar(randomMeasurements);
  };

  const handleGarmentChange = (type: GarmentType, size: GarmentSize) => {
    setSelectedGarmentType(type);
    setSelectedSize(size);
    const measurements = EXAMPLE_SIZE_CHARTS[type][size];
    setGarmentMeasurements(measurements);
    setShowGarment(true);
  };

  const handleRemoveGarment = () => {
    setShowGarment(false);
  };

  const handleAddGarment = () => {
    setShowGarment(true);
  };

  return (
    <MeasurementProvider>
      <main className="w-full h-screen flex">
        {/* Measurement Form Sidebar */}
        {showForm && (
          <div className="w-96 bg-black shadow-lg overflow-y-auto">
            <MeasurementForm onSubmit={handleMeasurementsSubmit} />
          </div>
        )}

        {/* 3D Viewer */}
        <div className="flex-1 relative">
          <Scene
            measurements={measurements}
            avatarUrl={avatarUrl}
            garmentMeasurements={showGarment ? garmentMeasurements : null}
          />

          {/* Toggle Form Button */}
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="absolute top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded shadow-lg hover:bg-blue-700 transition-colors"
            >
              Edit Measurements
            </button>
          )}

          {/* Random Avatar Button */}
          <button
            onClick={handleGenerateRandomAvatar}
            disabled={isLoading}
            className="absolute top-4 left-4 mt-14 bg-purple-600 text-white px-4 py-2 rounded shadow-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            🎲 Random Avatar
          </button>

          {/* Loading State */}
          {isLoading && (
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/80 text-white px-8 py-4 rounded-lg shadow-2xl">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                <p className="text-lg font-semibold">Generating your avatar...</p>
                <p className="text-sm text-gray-300">This may take a few seconds</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-600 text-white px-6 py-3 rounded-lg shadow-lg max-w-md">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <div className="flex-1">
                  <p className="font-semibold">Avatar Generation Failed</p>
                  <p className="text-sm text-red-100">{error}</p>
                </div>
                <button
                  onClick={handleRegenerateAvatar}
                  className="bg-white text-red-600 px-3 py-1 rounded text-sm font-semibold hover:bg-red-100 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Success State - Measurements Display */}
          {measurements && !showForm && !isLoading && !error && (
            <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800">Your Avatar</h3>
                {avatarUrl && (
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                    ✓ Generated
                  </span>
                )}
              </div>
              <ul className="text-sm space-y-1 text-gray-600">
                <li>Height: {measurements.height}cm</li>
                <li>Chest: {measurements.chest}cm</li>
                <li>Waist: {measurements.waist}cm</li>
                <li>Hips: {measurements.hips}cm</li>
              </ul>
              <button
                onClick={handleRegenerateAvatar}
                disabled={isLoading}
                className="mt-3 w-full text-xs bg-gray-100 text-gray-700 px-3 py-2 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                🔄 Regenerate Avatar
              </button>
            </div>
          )}

          {/* Garment Selection Panel */}
          {measurements && !showForm && !isLoading && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-white p-6 rounded-lg shadow-xl max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 text-center flex-1">Select Garment Type & Size</h3>
                {showGarment ? (
                  <button
                    onClick={handleRemoveGarment}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
                  >
                    Remove Garment
                  </button>
                ) : (
                  <button
                    onClick={handleAddGarment}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
                  >
                    Show Garment
                  </button>
                )}
              </div>

              {/* Garment Type Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Garment Type:</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => handleGarmentChange('hm_basic_tshirt', selectedSize)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedGarmentType === 'hm_basic_tshirt'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm">H&M Basic</div>
                    <div className="text-xs text-gray-500">Slim Fit</div>
                  </button>

                  <button
                    onClick={() => handleGarmentChange('uniqlo_airism', selectedSize)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedGarmentType === 'uniqlo_airism'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm">Uniqlo Airism</div>
                    <div className="text-xs text-gray-500">Regular Fit</div>
                  </button>

                  <button
                    onClick={() => handleGarmentChange('zara_oversized', selectedSize)}
                    className={`px-4 py-3 rounded-lg border-2 transition-all ${
                      selectedGarmentType === 'zara_oversized'
                        ? 'border-blue-500 bg-blue-50 text-blue-700 font-semibold'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-sm">Zara Oversized</div>
                    <div className="text-xs text-gray-500">Loose Fit</div>
                  </button>
                </div>
              </div>

              {/* Size Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Size:</label>
                <div className="flex gap-3 justify-center">
                  {(['S', 'M', 'L'] as GarmentSize[]).map((size) => (
                    <button
                      key={size}
                      onClick={() => handleGarmentChange(selectedGarmentType, size)}
                      className={`px-8 py-2 rounded-lg border-2 transition-all font-medium ${
                        selectedSize === size
                          ? 'border-blue-500 bg-blue-500 text-white'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Current Selection Info */}
              {garmentMeasurements && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="text-xs text-gray-600 text-center">
                    <span className="font-semibold">Selected:</span>{' '}
                    {selectedGarmentType === 'hm_basic_tshirt' && 'H&M Basic T-Shirt'}
                    {selectedGarmentType === 'uniqlo_airism' && 'Uniqlo Airism T-Shirt'}
                    {selectedGarmentType === 'zara_oversized' && 'Zara Oversized T-Shirt'}
                    {' '}Size {selectedSize} | Chest: {garmentMeasurements.chest}cm | Length: {garmentMeasurements.length}cm
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Help Text */}
          {!measurements && !isLoading && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-center">
              <p className="text-gray-500 text-sm bg-white/90 px-6 py-3 rounded-lg shadow">
                👈 Enter your measurements to generate your personalized 3D avatar
              </p>
            </div>
          )}
        </div>
      </main>
    </MeasurementProvider>
  );
}
