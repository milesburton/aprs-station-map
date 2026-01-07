#!/bin/bash
# Test that the Dockerfile builds correctly on the current platform
# This validates Bun installation and basic build steps

set -e

echo "Testing Dockerfile build..."

# Build the image with progress output
docker build --progress=plain -t aprs-station-map-test . 2>&1

# Verify the build succeeded
if [ $? -eq 0 ]; then
    echo "✓ Docker build succeeded"
else
    echo "✗ Docker build failed"
    exit 1
fi

# Test that nginx is working in the final image
CONTAINER_ID=$(docker run -d -p 8888:80 aprs-station-map-test)

# Wait for container to start
sleep 2

# Check if the container is running
if docker ps | grep -q "$CONTAINER_ID"; then
    echo "✓ Container started successfully"
else
    echo "✗ Container failed to start"
    docker logs "$CONTAINER_ID"
    docker rm -f "$CONTAINER_ID" 2>/dev/null
    exit 1
fi

# Check if we can fetch the index page
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8888 | grep -q "200"; then
    echo "✓ Web server responding"
else
    echo "✗ Web server not responding"
    docker logs "$CONTAINER_ID"
    docker rm -f "$CONTAINER_ID" 2>/dev/null
    exit 1
fi

# Cleanup
docker rm -f "$CONTAINER_ID" 2>/dev/null
docker rmi aprs-station-map-test 2>/dev/null

echo ""
echo "All tests passed!"
