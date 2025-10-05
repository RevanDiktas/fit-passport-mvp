"""
Convert SMPL .npz files to .pkl format that smplx expects
"""
import numpy as np
import pickle
from pathlib import Path

def convert_npz_to_pkl(npz_path: Path, pkl_path: Path):
    """Convert .npz SMPL file to .pkl format"""
    print(f"Converting {npz_path.name} to {pkl_path.name}...")

    # Load npz
    data = np.load(npz_path, allow_pickle=True, encoding='latin1')

    # Create dict from npz
    smpl_dict = {key: data[key] for key in data.files}

    # Save as pkl
    with open(pkl_path, 'wb') as f:
        pickle.dump(smpl_dict, f, protocol=2)

    print(f"✓ Converted successfully")

if __name__ == "__main__":
    models_dir = Path(__file__).parent / "models" / "smpl"

    files = [
        ("SMPL_NEUTRAL.npz", "SMPL_NEUTRAL.pkl"),
        ("SMPL_MALE.npz", "SMPL_MALE.pkl"),
        ("SMPL_FEMALE.npz", "SMPL_FEMALE.pkl"),
    ]

    for npz_name, pkl_name in files:
        npz_path = models_dir / npz_name
        pkl_path = models_dir / pkl_name

        if npz_path.exists():
            convert_npz_to_pkl(npz_path, pkl_path)
        else:
            print(f"Skipping {npz_name} (not found)")

    print("\n✓ Conversion complete!")
