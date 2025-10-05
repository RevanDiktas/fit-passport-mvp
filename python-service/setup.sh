#!/bin/bash

# Setup script for SMPL Avatar Generation Service

echo "======================================================"
echo "SMPL Avatar Generation Service - Setup"
echo "======================================================"
echo ""

# Check Python version
python_version=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python version: $python_version"

# Create virtual environment
echo ""
echo "Creating virtual environment..."
python3 -m venv venv
echo "✓ Virtual environment created"

# Activate virtual environment
echo ""
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"

# Upgrade pip
echo ""
echo "Upgrading pip..."
pip install --upgrade pip
echo "✓ pip upgraded"

# Install dependencies
echo ""
echo "Installing dependencies..."
pip install -r requirements.txt
echo "✓ Dependencies installed"

# Create necessary directories
echo ""
echo "Creating directories..."
mkdir -p models
mkdir -p output
mkdir -p cache
mkdir -p training_data
echo "✓ Directories created"

# Check for SMPL models
echo ""
echo "======================================================"
echo "SMPL Model Setup"
echo "======================================================"
echo ""
if [ ! -f "models/SMPL_NEUTRAL.pkl" ]; then
    echo "⚠️  SMPL model files not found!"
    echo ""
    echo "To download SMPL models:"
    echo "1. Register at https://smpl.is.tue.mpg.de/"
    echo "2. Download SMPL model files"
    echo "3. Place the following files in python-service/models/:"
    echo "   - SMPL_NEUTRAL.pkl"
    echo "   - SMPL_MALE.pkl"
    echo "   - SMPL_FEMALE.pkl"
    echo ""
else
    echo "✓ SMPL model files found"
fi

echo ""
echo "======================================================"
echo "Setup Complete!"
echo "======================================================"
echo ""
echo "Next steps:"
echo "1. Download SMPL models (if not already done)"
echo "2. Activate virtual environment: source venv/bin/activate"
echo "3. Train regression model: python train_regression.py"
echo "4. Start service: uvicorn main:app --reload --port 8000"
echo ""
