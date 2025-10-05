"""
Simplified measurement extraction for SMPL models
Uses body proportions based on beta parameters and known SMPL statistics
"""
import numpy as np

def measure_smpl_body_simple(vertices: np.ndarray, betas: np.ndarray) -> dict:
    """
    Extract measurements using simplified heuristics

    Args:
        vertices: SMPL vertices (6890, 3) in meters
        betas: Beta parameters (10,)

    Returns:
        Dictionary of measurements in cm
    """
    verts_cm = vertices * 100

    # Height is straightforward
    height = float(np.max(verts_cm[:, 1]) - np.min(verts_cm[:, 1]))

    # Use beta-based approximations (from SMPL paper statistics)
    # Beta 0 generally controls overall body shape/weight
    # These are approximations based on typical human proportions

    base_height = 170.0
    base_chest = 95.0
    base_waist = 80.0
    base_hips = 95.0
    base_shoulder = 45.0

    # Scale based on height difference
    height_factor = height / base_height

    # Beta influence (simplified linear model)
    beta_factor = 1.0 + (betas[0] * 0.15 if len(betas) > 0 else 0)  # Beta[0] affects girth

    chest = base_chest * beta_factor * (height_factor ** 0.5)
    waist = base_waist * beta_factor * (height_factor ** 0.5)
    hips = base_hips * beta_factor * (height_factor ** 0.5)
    shoulder_width = base_shoulder * (height_factor ** 0.7)

    # Proportional measurements
    arm_length = height * 0.38
    inseam = height * 0.45
    neck = 35.0 + betas[0] * 3.0 if len(betas) > 0 else 35.0

    return {
        "height": float(height),
        "chest": float(np.clip(chest, 70, 140)),
        "waist": float(np.clip(waist, 60, 130)),
        "hips": float(np.clip(hips, 70, 140)),
        "shoulderWidth": float(np.clip(shoulder_width, 30, 60)),
        "armLength": float(np.clip(arm_length, 50, 90)),
        "inseam": float(np.clip(inseam, 60, 100)),
        "neckCircumference": float(np.clip(neck, 30, 50)),
    }
