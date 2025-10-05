"""
Configuration for SMPL avatar generation service
"""
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "output"
CACHE_DIR = BASE_DIR / "cache"
TRAINING_DATA_DIR = BASE_DIR / "training_data"

# Ensure directories exist
OUTPUT_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)
TRAINING_DATA_DIR.mkdir(exist_ok=True)

# SMPL Model Configuration
# Models should be in models/smpl/ directory
SMPL_MODELS_ROOT = MODELS_DIR / "smpl"

SMPL_MODEL_PATHS = {
    "neutral": SMPL_MODELS_ROOT / "SMPL_NEUTRAL.pkl",
    "male": SMPL_MODELS_ROOT / "SMPL_MALE.pkl",
    "female": SMPL_MODELS_ROOT / "SMPL_FEMALE.pkl",
}

# Number of SMPL shape parameters (beta)
NUM_BETAS = 10  # Use first 10 principal components

# Regression Model
REGRESSION_MODEL_PATH = BASE_DIR / "regression_model.pkl"

# Training Configuration
SYNTHETIC_SAMPLES = 10000  # Number of synthetic bodies for training
BETA_RANGE = (-3.0, 3.0)  # Range for random beta sampling

# Measurement ranges (in cm) for validation
MEASUREMENT_RANGES = {
    "height": (140, 210),
    "chest": (70, 140),
    "waist": (60, 130),
    "hips": (70, 140),
    "shoulderWidth": (30, 60),
    "armLength": (50, 90),
    "inseam": (60, 100),
    "neckCircumference": (30, 50),
}

# Export Configuration
EXPORT_FORMAT = "glb"  # glb or gltf
MESH_SIMPLIFICATION = False  # Enable to reduce vertex count
TARGET_VERTICES = 6890  # SMPL default vertex count
