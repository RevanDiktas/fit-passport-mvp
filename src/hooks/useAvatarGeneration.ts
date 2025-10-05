/**
 * Hook for generating SMPL avatars from measurements
 * Handles loading states, caching, and error handling
 */

import { useState, useCallback, useEffect } from 'react';
import { BodyMeasurements } from '@/types/measurements';

interface UseAvatarGenerationResult {
  avatarUrl: string | null;
  isLoading: boolean;
  error: string | null;
  generateAvatar: (measurements: BodyMeasurements) => Promise<void>;
  clearAvatar: () => void;
}

// Simple in-memory cache
const avatarCache = new Map<string, string>();

// Generate cache key from measurements
function getMeasurementHash(measurements: BodyMeasurements): string {
  const keys: (keyof BodyMeasurements)[] = [
    'height',
    'chest',
    'waist',
    'hips',
    'shoulderWidth',
    'armLength',
    'inseam',
    'neckCircumference',
  ];

  return keys
    .map(key => `${key}:${measurements[key]}`)
    .join('|');
}

export function useAvatarGeneration(): UseAvatarGenerationResult {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (avatarUrl && avatarUrl.startsWith('blob:')) {
        URL.revokeObjectURL(avatarUrl);
      }
    };
  }, [avatarUrl]);

  const generateAvatar = useCallback(async (measurements: BodyMeasurements) => {
    const cacheKey = getMeasurementHash(measurements);

    // Check cache first
    if (avatarCache.has(cacheKey)) {
      const cachedUrl = avatarCache.get(cacheKey)!;
      console.log('[Avatar] Using cached avatar:', cacheKey);
      setAvatarUrl(cachedUrl);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('[Avatar] Generating new avatar...');

      const response = await fetch('/api/avatar/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          measurements,
          gender: 'neutral',
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        console.error('[Avatar] API error response:', errorData);

        // Handle validation errors from Python service
        if (errorData.details) {
          try {
            const details = JSON.parse(errorData.details);
            if (details.detail && Array.isArray(details.detail)) {
              const validationErrors = details.detail.map((err: any) =>
                `${err.loc[1]}: ${err.msg}`
              ).join(', ');
              throw new Error(`Validation error: ${validationErrors}`);
            }
          } catch (parseError) {
            // If parsing fails, use original error
          }
        }

        throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
      }

      // Get GLB blob
      const blob = await response.blob();
      console.log(`[Avatar] Received GLB: ${blob.size} bytes`);

      // Create blob URL
      const blobUrl = URL.createObjectURL(blob);

      // Cache the URL
      avatarCache.set(cacheKey, blobUrl);

      // Update state
      setAvatarUrl(blobUrl);
      setError(null);

      console.log('[Avatar] Generation successful');
    } catch (err) {
      console.error('[Avatar] Full error object:', err);
      const errorMessage = err instanceof Error ? err.message : 'Avatar generation failed';
      console.error('[Avatar] Generation error:', errorMessage);
      setError(errorMessage);
      setAvatarUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearAvatar = useCallback(() => {
    if (avatarUrl && avatarUrl.startsWith('blob:')) {
      URL.revokeObjectURL(avatarUrl);
    }
    setAvatarUrl(null);
    setError(null);
  }, [avatarUrl]);

  return {
    avatarUrl,
    isLoading,
    error,
    generateAvatar,
    clearAvatar,
  };
}
