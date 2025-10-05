"""
SMPL mesh generator from measurements
"""
import numpy as np
import torch
import pickle
import smplx
from pathlib import Path

from config import (
    SMPL_MODEL_PATHS,
    REGRESSION_MODEL_PATH,
    NUM_BETAS,
)


class SMPLGenerator:
    """Generate SMPL body meshes from anthropometric measurements"""

    def __init__(self, gender: str = "neutral"):
        """
        Initialize SMPL generator

        Args:
            gender: SMPL model gender (neutral, male, female)
        """
        self.gender = gender
        self.model_path = SMPL_MODEL_PATHS[gender]

        if not self.model_path.exists():
            raise FileNotFoundError(
                f"SMPL model not found at {self.model_path}. "
                f"Please download from https://smpl.is.tue.mpg.de/ "
                f"and place in {self.model_path.parent}"
            )

        # Load SMPL model
        print(f"Loading SMPL model: {gender}")
        self.smpl_model = smplx.create(
            model_path=str(self.model_path.parent.parent),  # models/ directory
            model_type="smpl",
            gender=gender,
            num_betas=NUM_BETAS,
        )

        # Load regression model
        self.regression_model = None
        self.scaler = None
        self._load_regression_model()

    def _load_regression_model(self):
        """Load trained regression model"""
        if not REGRESSION_MODEL_PATH.exists():
            print(
                f"Warning: Regression model not found at {REGRESSION_MODEL_PATH}. "
                f"Please train the model first using train_regression.py"
            )
            return

        with open(REGRESSION_MODEL_PATH, "rb") as f:
            model_data = pickle.load(f)

        self.regression_model = model_data["model"]
        self.scaler = model_data["scaler"]
        self.measurement_order = model_data["measurement_order"]
        print("Regression model loaded successfully")

    def measurements_to_beta(self, measurements: dict) -> np.ndarray:
        """
        Convert measurements to SMPL beta parameters using regression

        Args:
            measurements: Dictionary of measurements in cm

        Returns:
            beta parameters (10,)
        """
        if self.regression_model is None:
            # Fallback: use zeros (average body)
            print("Warning: Using default beta (average body)")
            return np.zeros(NUM_BETAS)

        # Extract measurements in correct order
        measurement_array = np.array(
            [measurements.get(key, 0) for key in self.measurement_order]
        ).reshape(1, -1)

        # Scale and predict
        measurement_scaled = self.scaler.transform(measurement_array)
        beta = self.regression_model.predict(measurement_scaled)[0]

        return beta

    def generate_mesh(
        self, measurements: dict, pose: np.ndarray = None
    ) -> tuple:
        """
        Generate SMPL mesh from measurements

        Args:
            measurements: Dictionary of body measurements in cm
            pose: Optional pose parameters (default: T-pose)

        Returns:
            vertices: (6890, 3) mesh vertices
            faces: (13776, 3) mesh faces
        """
        # Convert measurements to beta parameters
        beta = self.measurements_to_beta(measurements)
        beta_tensor = torch.tensor(beta, dtype=torch.float32).unsqueeze(0)

        # Default T-pose (72 dims: 3 global_orient + 69 body_pose)
        if pose is None:
            body_pose_tensor = torch.zeros(1, 69, dtype=torch.float32)
            global_orient_tensor = torch.zeros(1, 3, dtype=torch.float32)
        else:
            pose_tensor = torch.tensor(pose, dtype=torch.float32).unsqueeze(0)
            body_pose_tensor = pose_tensor[:, 3:]
            global_orient_tensor = pose_tensor[:, :3]

        # Generate SMPL mesh
        with torch.no_grad():
            output = self.smpl_model(
                betas=beta_tensor,
                body_pose=body_pose_tensor,
                global_orient=global_orient_tensor,
            )

        vertices = output.vertices[0].detach().cpu().numpy()
        faces = self.smpl_model.faces

        return vertices, faces

    def generate_with_beta(
        self, beta: np.ndarray, pose: np.ndarray = None
    ) -> tuple:
        """
        Generate SMPL mesh directly from beta parameters

        Args:
            beta: SMPL beta parameters (10,)
            pose: Optional pose parameters

        Returns:
            vertices: (6890, 3) mesh vertices
            faces: (13776, 3) mesh faces
        """
        beta_tensor = torch.tensor(beta, dtype=torch.float32).unsqueeze(0)

        if pose is None:
            body_pose_tensor = torch.zeros(1, 69, dtype=torch.float32)
            global_orient_tensor = torch.zeros(1, 3, dtype=torch.float32)
        else:
            pose_tensor = torch.tensor(pose, dtype=torch.float32).unsqueeze(0)
            body_pose_tensor = pose_tensor[:, 3:]
            global_orient_tensor = pose_tensor[:, :3]

        with torch.no_grad():
            output = self.smpl_model(
                betas=beta_tensor,
                body_pose=body_pose_tensor,
                global_orient=global_orient_tensor,
            )

        vertices = output.vertices[0].detach().cpu().numpy()
        faces = self.smpl_model.faces

        return vertices, faces


# Test function
def test_generator():
    """Test the SMPL generator with sample measurements"""
    print("Testing SMPL Generator...")

    # Sample measurements
    measurements = {
        "height": 175,
        "chest": 95,
        "waist": 80,
        "hips": 98,
        "shoulderWidth": 45,
        "armLength": 60,
        "inseam": 78,
        "neckCircumference": 38,
    }

    try:
        generator = SMPLGenerator(gender="neutral")
        vertices, faces = generator.generate_mesh(measurements)

        print(f"Generated mesh:")
        print(f"  Vertices: {vertices.shape}")
        print(f"  Faces: {faces.shape}")
        print(f"  Vertex range: [{vertices.min():.3f}, {vertices.max():.3f}]")

        return True
    except Exception as e:
        print(f"Error: {e}")
        return False


if __name__ == "__main__":
    test_generator()
