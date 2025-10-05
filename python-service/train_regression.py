"""
Train regression model to map measurements to SMPL beta parameters

Approach:
1. Generate synthetic SMPL bodies with random beta parameters
2. Measure each body using measurement_utils
3. Train regression model: measurements -> beta parameters
"""
import numpy as np
import torch
import pickle
from pathlib import Path
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import smplx
from tqdm import tqdm

from config import (
    SMPL_MODEL_PATHS,
    SYNTHETIC_SAMPLES,
    BETA_RANGE,
    NUM_BETAS,
    REGRESSION_MODEL_PATH,
    TRAINING_DATA_DIR,
)
from simple_measurements import measure_smpl_body_simple
from measurement_utils import validate_measurements


def generate_synthetic_data(num_samples: int, gender: str = "neutral"):
    """
    Generate synthetic SMPL bodies and measure them

    Args:
        num_samples: Number of synthetic bodies to generate
        gender: SMPL model gender

    Returns:
        measurements_array: (N, 8) array of measurements
        betas_array: (N, 10) array of beta parameters
    """
    print(f"Generating {num_samples} synthetic SMPL bodies...")

    # Check if SMPL model exists
    model_path = SMPL_MODEL_PATHS[gender]
    if not model_path.exists():
        raise FileNotFoundError(
            f"SMPL model not found at {model_path}. "
            f"Please download from https://smpl.is.tue.mpg.de/"
        )

    # Load SMPL model
    smpl_model = smplx.create(
        model_path=str(model_path.parent.parent),  # models/ directory
        model_type="smpl",
        gender=gender,
        num_betas=NUM_BETAS,
    )

    measurements_list = []
    betas_list = []

    for i in tqdm(range(num_samples)):
        # Generate random beta parameters
        betas = torch.tensor(
            np.random.uniform(
                BETA_RANGE[0], BETA_RANGE[1], NUM_BETAS
            ).astype(np.float32)
        ).unsqueeze(0)

        # Generate SMPL body
        with torch.no_grad():
            output = smpl_model(betas=betas)
            vertices = output.vertices[0].detach().cpu().numpy()

        # Measure the body
        measurements = measure_smpl_body_simple(vertices, betas[0].numpy())

        # Validate measurements
        if validate_measurements(measurements):
            # Convert to array in consistent order
            measurement_array = [
                measurements["height"],
                measurements["chest"],
                measurements["waist"],
                measurements["hips"],
                measurements["shoulderWidth"],
                measurements["armLength"],
                measurements["inseam"],
                measurements["neckCircumference"],
            ]

            measurements_list.append(measurement_array)
            betas_list.append(betas[0].numpy())

    measurements_array = np.array(measurements_list)
    betas_array = np.array(betas_list)

    print(f"Generated {len(measurements_array)} valid samples")

    # Save training data
    data_path = TRAINING_DATA_DIR / f"synthetic_data_{gender}.npz"
    np.savez(
        data_path,
        measurements=measurements_array,
        betas=betas_array,
    )
    print(f"Saved training data to {data_path}")

    return measurements_array, betas_array


def train_regression_model(measurements: np.ndarray, betas: np.ndarray):
    """
    Train regression model to predict beta parameters from measurements

    Args:
        measurements: (N, 8) array of measurements
        betas: (N, 10) array of beta parameters

    Returns:
        Trained model and scaler
    """
    print("\nTraining regression model...")

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        measurements, betas, test_size=0.2, random_state=42
    )

    # Standardize features
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    # Train Ridge regression (handles multicollinearity)
    model = Ridge(alpha=1.0)
    model.fit(X_train_scaled, y_train)

    # Evaluate
    train_score = model.score(X_train_scaled, y_train)
    test_score = model.score(X_test_scaled, y_test)

    print(f"Training R² score: {train_score:.4f}")
    print(f"Testing R² score: {test_score:.4f}")

    # Calculate prediction error
    y_pred = model.predict(X_test_scaled)
    mse = np.mean((y_test - y_pred) ** 2)
    print(f"Mean Squared Error: {mse:.6f}")

    return model, scaler


def save_model(model, scaler):
    """Save trained model and scaler"""
    model_data = {
        "model": model,
        "scaler": scaler,
        "num_betas": NUM_BETAS,
        "measurement_order": [
            "height",
            "chest",
            "waist",
            "hips",
            "shoulderWidth",
            "armLength",
            "inseam",
            "neckCircumference",
        ],
    }

    with open(REGRESSION_MODEL_PATH, "wb") as f:
        pickle.dump(model_data, f)

    print(f"\nModel saved to {REGRESSION_MODEL_PATH}")


def main():
    """Main training pipeline"""
    print("=" * 60)
    print("SMPL Measurement-to-Beta Regression Training")
    print("=" * 60)

    # Check if training data already exists
    data_path = TRAINING_DATA_DIR / "synthetic_data_neutral.npz"
    if data_path.exists():
        print(f"\nLoading existing training data from {data_path}")
        data = np.load(data_path)
        measurements = data["measurements"]
        betas = data["betas"]
    else:
        # Generate synthetic training data
        measurements, betas = generate_synthetic_data(
            SYNTHETIC_SAMPLES, gender="neutral"
        )

    # Train regression model
    model, scaler = train_regression_model(measurements, betas)

    # Save model
    save_model(model, scaler)

    print("\n" + "=" * 60)
    print("Training complete!")
    print("=" * 60)
    print("\nNext steps:")
    print("1. Run the FastAPI service: uvicorn main:app --reload")
    print("2. Test with sample measurements")


if __name__ == "__main__":
    main()
