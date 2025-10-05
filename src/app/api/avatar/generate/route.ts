/**
 * API Route: Avatar Generation
 * Proxies requests to Python SMPL service and returns GLB files
 */

import { NextRequest, NextResponse } from 'next/server';
import { BodyMeasurements } from '@/types/measurements';

const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || 'http://localhost:8000';

interface AvatarGenerationRequest {
  measurements: BodyMeasurements;
  gender?: 'neutral' | 'male' | 'female';
}

export async function POST(request: NextRequest) {
  try {
    const body: AvatarGenerationRequest = await request.json();
    const { measurements, gender = 'neutral' } = body;

    // Validate measurements exist
    if (!measurements || !measurements.height || !measurements.chest || !measurements.waist) {
      return NextResponse.json(
        { error: 'Missing required measurements (height, chest, waist)' },
        { status: 400 }
      );
    }

    // Prepare request payload for Python service
    const pythonPayload = {
      height: measurements.height,
      chest: measurements.chest,
      waist: measurements.waist,
      hips: measurements.hips,
      shoulderWidth: measurements.shoulderWidth,
      armLength: measurements.armLength,
      inseam: measurements.inseam,
      neckCircumference: measurements.neckCircumference,
      gender,
    };

    console.log('[Avatar API] Calling Python service:', PYTHON_SERVICE_URL);
    console.log('[Avatar API] Measurements:', pythonPayload);

    // Call Python service
    const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pythonPayload),
    });

    if (!pythonResponse.ok) {
      const errorText = await pythonResponse.text();
      console.error('[Avatar API] Python service error:', errorText);
      return NextResponse.json(
        { error: 'Avatar generation failed', details: errorText },
        { status: pythonResponse.status }
      );
    }

    // Get GLB binary data
    const glbData = await pythonResponse.arrayBuffer();

    console.log(`[Avatar API] Generated GLB: ${glbData.byteLength} bytes`);

    // Return GLB file with proper headers
    return new NextResponse(glbData, {
      status: 200,
      headers: {
        'Content-Type': 'model/gltf-binary',
        'Content-Length': glbData.byteLength.toString(),
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('[Avatar API] Error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check service health
export async function GET() {
  try {
    const healthResponse = await fetch(`${PYTHON_SERVICE_URL}/health`);
    const health = await healthResponse.json();

    return NextResponse.json({
      status: 'ok',
      pythonService: health,
      serviceUrl: PYTHON_SERVICE_URL,
    });
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      pythonService: 'unavailable',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}
