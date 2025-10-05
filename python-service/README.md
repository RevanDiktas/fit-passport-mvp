# SMPL Avatar Generation Service

Python microservice for generating SMPL body models from anthropometric measurements.

## Setup

### 1. Create Virtual Environment

```bash
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Download SMPL Model Files

1. Register at https://smpl.is.tue.mpg.de/
2. Download SMPL model files (SMPL_NEUTRAL.pkl, SMPL_MALE.pkl, SMPL_FEMALE.pkl)
3. Place them in `python-service/models/` directory

```
python-service/
├── models/
│   ├── SMPL_NEUTRAL.pkl
│   ├── SMPL_MALE.pkl
│   └── SMPL_FEMALE.pkl
```

### 4. Train Regression Model

Generate synthetic training data and train the measurement-to-beta regression model:

```bash
python train_regression.py
```

This will create `regression_model.pkl` used for converting measurements to SMPL beta parameters.

### 5. Run Service

```bash
uvicorn main:app --reload --port 8000
```

## API Endpoints

### POST /generate

Generate avatar from body measurements.

**Request:**
```json
{
  "height": 175,
  "chest": 95,
  "waist": 80,
  "hips": 98,
  "shoulderWidth": 45,
  "gender": "neutral"
}
```

**Response:** Binary glTF/GLB file

## Architecture

```
Measurements → Regression Model → Beta Parameters → SMPL Model → 3D Mesh → glTF Export
```

## Measurements Supported

- height (cm)
- chest (cm)
- waist (cm)
- hips (cm)
- shoulderWidth (cm)
- armLength (cm)
- inseam (cm)
- neckCircumference (cm)
