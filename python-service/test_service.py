"""
Test script for SMPL avatar generation service
"""
import requests
import json
from pathlib import Path

# Service configuration
SERVICE_URL = "http://localhost:8000"


def test_health():
    """Test health check endpoint"""
    print("Testing /health endpoint...")
    try:
        response = requests.get(f"{SERVICE_URL}/health")
        print(f"  Status: {response.status_code}")
        print(f"  Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"  Error: {e}")
        return False


def test_measurement_ranges():
    """Test measurement ranges endpoint"""
    print("\nTesting /measurement-ranges endpoint...")
    try:
        response = requests.get(f"{SERVICE_URL}/measurement-ranges")
        print(f"  Status: {response.status_code}")
        ranges = response.json()
        print(f"  Ranges: {json.dumps(ranges, indent=2)}")
        return response.status_code == 200
    except Exception as e:
        print(f"  Error: {e}")
        return False


def test_generate_avatar():
    """Test avatar generation endpoint"""
    print("\nTesting /generate endpoint...")

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
        "gender": "neutral",
    }

    try:
        print(f"  Sending measurements: {json.dumps(measurements, indent=2)}")
        response = requests.post(
            f"{SERVICE_URL}/generate",
            json=measurements,
            headers={"Content-Type": "application/json"},
        )

        print(f"  Status: {response.status_code}")

        if response.status_code == 200:
            # Save generated GLB file
            output_path = Path("test_avatar.glb")
            with open(output_path, "wb") as f:
                f.write(response.content)
            print(f"  ✓ Avatar generated: {len(response.content)} bytes")
            print(f"  ✓ Saved to: {output_path}")
            return True
        else:
            print(f"  Error: {response.text}")
            return False

    except Exception as e:
        print(f"  Error: {e}")
        return False


def test_invalid_measurements():
    """Test with invalid measurements"""
    print("\nTesting with invalid measurements...")

    invalid_measurements = {
        "height": 300,  # Too tall
        "chest": 50,    # Too small
        "waist": 80,
        "hips": 98,
        "shoulderWidth": 45,
        "gender": "neutral",
    }

    try:
        response = requests.post(
            f"{SERVICE_URL}/generate",
            json=invalid_measurements,
        )

        print(f"  Status: {response.status_code}")
        if response.status_code == 400 or response.status_code == 422:
            print(f"  ✓ Correctly rejected invalid measurements")
            print(f"  Response: {response.text}")
            return True
        else:
            print(f"  ✗ Should have rejected invalid measurements")
            return False

    except Exception as e:
        print(f"  Error: {e}")
        return False


def run_all_tests():
    """Run all tests"""
    print("=" * 60)
    print("SMPL Avatar Generation Service - Tests")
    print("=" * 60)
    print("")

    tests = [
        ("Health Check", test_health),
        ("Measurement Ranges", test_measurement_ranges),
        ("Generate Avatar", test_generate_avatar),
        ("Invalid Measurements", test_invalid_measurements),
    ]

    results = []
    for name, test_func in tests:
        print(f"\n{'='*60}")
        result = test_func()
        results.append((name, result))
        print(f"{'='*60}")

    # Summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    for name, result in results:
        status = "✓ PASS" if result else "✗ FAIL"
        print(f"{status:8} {name}")

    passed = sum(1 for _, r in results if r)
    total = len(results)
    print(f"\nTotal: {passed}/{total} tests passed")
    print("=" * 60)


if __name__ == "__main__":
    print("\nMake sure the service is running:")
    print("  uvicorn main:app --reload --port 8000")
    print("\nPress Enter to continue...")
    input()

    run_all_tests()
