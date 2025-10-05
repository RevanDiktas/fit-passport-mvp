"""
FastAPI service for SMPL avatar generation
"""
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import hashlib
import json
from pathlib import Path

from smpl_generator import SMPLGenerator
from gltf_exporter import GLTFExporter
from measurement_utils import validate_measurements
from config import CACHE_DIR, OUTPUT_DIR, MEASUREMENT_RANGES

# Initialize FastAPI app
app = FastAPI(
    title="SMPL Avatar Generation Service",
    description="Generate 3D body avatars from anthropometric measurements",
    version="1.0.0",
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SMPL generator (lazy loading)
_smpl_generators = {}


def get_generator(gender: str = "neutral") -> SMPLGenerator:
    """Get or create SMPL generator for given gender"""
    if gender not in _smpl_generators:
        _smpl_generators[gender] = SMPLGenerator(gender=gender)
    return _smpl_generators[gender]


# Request/Response Models
class MeasurementRequest(BaseModel):
    """Body measurement input"""

    height: float = Field(..., ge=140, le=210, description="Height in cm")
    chest: float = Field(..., ge=70, le=140, description="Chest circumference in cm")
    waist: float = Field(..., ge=60, le=130, description="Waist circumference in cm")
    hips: float = Field(..., ge=70, le=140, description="Hip circumference in cm")
    shoulderWidth: float = Field(
        ..., ge=30, le=60, description="Shoulder width in cm"
    )
    armLength: Optional[float] = Field(
        None, ge=50, le=90, description="Arm length in cm"
    )
    inseam: Optional[float] = Field(None, ge=60, le=100, description="Inseam in cm")
    neckCircumference: Optional[float] = Field(
        None, ge=30, le=50, description="Neck circumference in cm"
    )
    gender: str = Field("neutral", description="Gender (neutral, male, female)")

    class Config:
        json_schema_extra = {
            "example": {
                "height": 175,
                "chest": 95,
                "waist": 80,
                "hips": 98,
                "shoulderWidth": 45,
                "armLength": 60,
                "inseam": 78,
                "neckCircumference": 38,
                "gender": "neutral",
            }
        }


class HealthResponse(BaseModel):
    """Health check response"""

    status: str
    message: str
    regression_model_loaded: bool


# Endpoints
@app.get("/", response_model=dict)
async def root():
    """Root endpoint"""
    return {
        "service": "SMPL Avatar Generation",
        "version": "1.0.0",
        "endpoints": {
            "health": "/health",
            "generate": "/generate (POST)",
            "docs": "/docs",
        },
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    try:
        # Try to load generator to check if models are available
        generator = get_generator("neutral")
        regression_loaded = generator.regression_model is not None

        return HealthResponse(
            status="healthy",
            message="Service is operational",
            regression_model_loaded=regression_loaded,
        )
    except Exception as e:
        raise HTTPException(
            status_code=503, detail=f"Service unhealthy: {str(e)}"
        )


@app.post("/generate")
async def generate_avatar(measurements: MeasurementRequest):
    """
    Generate SMPL avatar from body measurements

    Returns binary glTF/GLB file
    """
    try:
        # Convert to dict
        measurement_dict = measurements.model_dump()
        gender = measurement_dict.pop("gender", "neutral")

        # Validate gender
        if gender not in ["neutral", "male", "female"]:
            raise HTTPException(status_code=400, detail="Invalid gender")

        # Fill in missing measurements with defaults
        defaults = {
            "armLength": measurement_dict["height"] * 0.38,
            "inseam": measurement_dict["height"] * 0.45,
            "neckCircumference": 38.0,
        }
        for key, value in defaults.items():
            if measurement_dict.get(key) is None:
                measurement_dict[key] = value

        # Validate measurements
        if not validate_measurements(measurement_dict):
            raise HTTPException(
                status_code=400, detail="Measurements out of valid range"
            )

        # Check cache
        cache_key = hashlib.md5(
            json.dumps(measurement_dict, sort_keys=True).encode()
        ).hexdigest()
        cache_path = CACHE_DIR / f"{cache_key}.glb"

        if cache_path.exists():
            print(f"Cache hit: {cache_key}")
            with open(cache_path, "rb") as f:
                glb_data = f.read()
            return Response(
                content=glb_data, media_type="model/gltf-binary"
            )

        # Generate SMPL mesh
        print(f"Generating avatar for measurements: {measurement_dict}")
        generator = get_generator(gender)
        vertices, faces = generator.generate_mesh(measurement_dict)

        # Export to glTF
        exporter = GLTFExporter()
        glb_data = exporter.export_mesh(vertices, faces)

        # Save to cache
        with open(cache_path, "wb") as f:
            f.write(glb_data)

        print(f"Generated avatar: {len(glb_data)} bytes")

        return Response(content=glb_data, media_type="model/gltf-binary")

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating avatar: {e}")
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")


@app.get("/measurement-ranges")
async def get_measurement_ranges():
    """Get valid measurement ranges"""
    return MEASUREMENT_RANGES


# Development helpers
if __name__ == "__main__":
    import uvicorn

    print("=" * 60)
    print("Starting SMPL Avatar Generation Service")
    print("=" * 60)
    print("\nEndpoints:")
    print("  Health check: http://localhost:8000/health")
    print("  Generate:     http://localhost:8000/generate")
    print("  Docs:         http://localhost:8000/docs")
    print("\n" + "=" * 60)

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
