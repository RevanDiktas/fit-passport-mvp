"""
Utilities for measuring SMPL body models
Based on SMPL-Anthropometry approach
"""
import numpy as np
import torch


def measure_smpl_body(vertices: np.ndarray) -> dict:
    """
    Extract anthropometric measurements from SMPL vertices

    Args:
        vertices: SMPL mesh vertices (6890, 3) in meters

    Returns:
        Dictionary of measurements in centimeters
    """
    # Convert to cm
    verts_cm = vertices * 100

    # Key vertex indices for measurements (approximations)
    # These are simplified - actual SMPL-Anthropometry uses more precise landmark definitions

    # Height: distance from floor to top of head
    height = np.max(verts_cm[:, 1]) - np.min(verts_cm[:, 1])

    # Get vertices at specific heights for circumference measurements
    torso_verts = verts_cm[verts_cm[:, 1] > np.min(verts_cm[:, 1]) + 80]

    # Chest circumference (approximate at chest level ~130cm from floor)
    chest_height = np.min(verts_cm[:, 1]) + height * 0.75
    chest_verts = verts_cm[np.abs(verts_cm[:, 1] - chest_height) < 5]
    if len(chest_verts) > 0:
        chest = estimate_circumference(chest_verts)
    else:
        chest = 95.0  # fallback

    # Waist circumference (approximate at waist level ~100cm from floor)
    waist_height = np.min(verts_cm[:, 1]) + height * 0.6
    waist_verts = verts_cm[np.abs(verts_cm[:, 1] - waist_height) < 5]
    if len(waist_verts) > 0:
        waist = estimate_circumference(waist_verts)
    else:
        waist = 80.0  # fallback

    # Hip circumference (approximate at hip level ~90cm from floor)
    hip_height = np.min(verts_cm[:, 1]) + height * 0.52
    hip_verts = verts_cm[np.abs(verts_cm[:, 1] - hip_height) < 5]
    if len(hip_verts) > 0:
        hips = estimate_circumference(hip_verts)
    else:
        hips = 95.0  # fallback

    # Shoulder width (distance between shoulder points)
    shoulder_height = np.min(verts_cm[:, 1]) + height * 0.82
    shoulder_verts = verts_cm[np.abs(verts_cm[:, 1] - shoulder_height) < 3]
    if len(shoulder_verts) > 0:
        shoulder_width = np.max(shoulder_verts[:, 0]) - np.min(shoulder_verts[:, 0])
    else:
        shoulder_width = 45.0  # fallback

    # Arm length (approximate)
    arm_length = height * 0.38  # Rough proportion

    # Inseam (approximate)
    inseam = height * 0.45  # Rough proportion

    # Neck circumference (approximate)
    neck_height = np.min(verts_cm[:, 1]) + height * 0.88
    neck_verts = verts_cm[np.abs(verts_cm[:, 1] - neck_height) < 2]
    if len(neck_verts) > 0:
        neck = estimate_circumference(neck_verts) * 0.5  # Scale down
    else:
        neck = 38.0  # fallback

    return {
        "height": float(height),
        "chest": float(chest),
        "waist": float(waist),
        "hips": float(hips),
        "shoulderWidth": float(shoulder_width),
        "armLength": float(arm_length),
        "inseam": float(inseam),
        "neckCircumference": float(neck),
    }


def estimate_circumference(vertices: np.ndarray) -> float:
    """
    Estimate circumference from a slice of vertices
    Uses convex hull perimeter as approximation

    Args:
        vertices: Nx3 array of vertex coordinates

    Returns:
        Estimated circumference in cm
    """
    if len(vertices) < 3:
        return 0.0

    # Project to XZ plane (horizontal slice)
    points_2d = vertices[:, [0, 2]]

    # Calculate convex hull perimeter
    from scipy.spatial import ConvexHull
    try:
        hull = ConvexHull(points_2d)
        perimeter = 0
        for simplex in hull.simplices:
            p1 = points_2d[simplex[0]]
            p2 = points_2d[simplex[1]]
            perimeter += np.linalg.norm(p2 - p1)
        return perimeter
    except:
        # Fallback: use bounding box
        width = np.max(points_2d[:, 0]) - np.min(points_2d[:, 0])
        depth = np.max(points_2d[:, 1]) - np.min(points_2d[:, 1])
        return 2 * (width + depth)


def validate_measurements(measurements: dict) -> bool:
    """
    Validate that measurements are within reasonable ranges

    Args:
        measurements: Dictionary of measurements

    Returns:
        True if valid, False otherwise
    """
    from config import MEASUREMENT_RANGES

    for key, value in measurements.items():
        if key in MEASUREMENT_RANGES:
            min_val, max_val = MEASUREMENT_RANGES[key]
            if not (min_val <= value <= max_val):
                return False
    return True
