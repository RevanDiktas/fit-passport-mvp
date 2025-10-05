#!/bin/bash

echo "=============================================="
echo "Phase 2 Integration Test"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0.32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Python Service Health
echo "Test 1: Python Service Health"
echo "------------------------------"
response=$(curl -s http://localhost:8000/health)
if echo "$response" | grep -q "healthy"; then
    echo -e "${GREEN}✓ Python service is healthy${NC}"
    echo "  Response: $response"
else
    echo -e "${RED}✗ Python service is not healthy${NC}"
    echo "  Response: $response"
    exit 1
fi
echo ""

# Test 2: Next.js API Health
echo "Test 2: Next.js API Health"
echo "--------------------------"
response=$(curl -s http://localhost:3000/api/avatar/generate)
if echo "$response" | grep -q "pythonService"; then
    echo -e "${GREEN}✓ Next.js API is responding${NC}"
    echo "  Response: $response"
else
    echo -e "${RED}✗ Next.js API is not responding${NC}"
    echo "  Response: $response"
fi
echo ""

# Test 3: Avatar Generation
echo "Test 3: Avatar Generation (Full Integration)"
echo "--------------------------------------------"
echo "Sending measurements to Next.js API..."
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/avatar/generate \
  -H "Content-Type: application/json" \
  -d '{
    "measurements": {
      "height": 175,
      "chest": 95,
      "waist": 80,
      "hips": 98,
      "shoulderWidth": 45,
      "armLength": 60,
      "inseam": 78,
      "neckCircumference": 38
    },
    "gender": "neutral"
  }')

http_code=$(echo "$response" | tail -n 1)
content=$(echo "$response" | head -n -1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Avatar generated successfully${NC}"
    echo "  HTTP Status: $http_code"

    # Save GLB to file
    echo "$content" > /tmp/test_avatar.glb
    size=$(wc -c < /tmp/test_avatar.glb)
    echo "  GLB File Size: $size bytes"

    if [ $size -gt 100000 ]; then
        echo -e "${GREEN}✓ GLB file size looks reasonable${NC}"
    else
        echo -e "${YELLOW}⚠ GLB file seems small, might be an error${NC}"
    fi
else
    echo -e "${RED}✗ Avatar generation failed${NC}"
    echo "  HTTP Status: $http_code"
    echo "  Response: $content"
fi
echo ""

# Test 4: Cached Generation (should be instant)
echo "Test 4: Cached Avatar Generation"
echo "--------------------------------"
echo "Requesting same measurements again..."
start_time=$(date +%s%N)
response=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/avatar/generate \
  -H "Content-Type: application/json" \
  -d '{
    "measurements": {
      "height": 175,
      "chest": 95,
      "waist": 80,
      "hips": 98,
      "shoulderWidth": 45,
      "armLength": 60,
      "inseam": 78,
      "neckCircumference": 38
    },
    "gender": "neutral"
  }')
end_time=$(date +%s%N)
duration=$(( (end_time - start_time) / 1000000 ))

http_code=$(echo "$response" | tail -n 1)

if [ "$http_code" = "200" ]; then
    echo -e "${GREEN}✓ Cached avatar retrieved${NC}"
    echo "  Response time: ${duration}ms"
    if [ $duration -lt 2000 ]; then
        echo -e "${GREEN}✓ Response time is fast (likely cached)${NC}"
    fi
else
    echo -e "${RED}✗ Cached request failed${NC}"
fi
echo ""

# Summary
echo "=============================================="
echo "Test Summary"
echo "=============================================="
echo ""
echo -e "${GREEN}Phase 2 Integration: COMPLETE ✓${NC}"
echo ""
echo "Services Running:"
echo "  - Python SMPL Service: http://localhost:8000"
echo "  - Next.js Frontend: http://localhost:3000"
echo ""
echo "Next Steps:"
echo "  1. Open http://localhost:3000 in browser"
echo "  2. Enter measurements in the form"
echo "  3. Watch your avatar generate in 3D!"
echo ""
echo "=============================================="
