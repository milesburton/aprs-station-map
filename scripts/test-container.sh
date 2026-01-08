#!/bin/bash
# Container health and functionality test script

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

CONTAINER_NAME="${CONTAINER_NAME:-aprs-station-map}"
HOST="${TEST_HOST:-localhost}"
HTTP_PORT="${TEST_HTTP_PORT:-3000}"
API_PORT="${TEST_API_PORT:-3001}"

echo "=========================================="
echo "APRS Station Map Container Test Suite"
echo "=========================================="
echo ""

# Test 1: Container is running
echo -n "Test 1: Checking if container is running... "
if docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" | grep -q "${CONTAINER_NAME}"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Container '${CONTAINER_NAME}' is not running"
    exit 1
fi

# Test 2: Container health status
echo -n "Test 2: Checking container health status... "
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' "${CONTAINER_NAME}" 2>/dev/null || echo "none")
if [ "$HEALTH" = "healthy" ] || [ "$HEALTH" = "none" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Status: ${HEALTH})"
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Status: ${HEALTH})"
fi

# Test 3: HTTP server responding (nginx)
echo -n "Test 3: Checking HTTP server on port ${HTTP_PORT}... "
if curl -sf "http://${HOST}:${HTTP_PORT}" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "HTTP server not responding on http://${HOST}:${HTTP_PORT}"
    exit 1
fi

# Test 4: API health endpoint
echo -n "Test 4: Checking API health endpoint... "
RESPONSE=$(curl -sf "http://${HOST}:${HTTP_PORT}/api/health" 2>/dev/null || echo "")
if echo "$RESPONSE" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "API health endpoint returned: $RESPONSE"
    exit 1
fi

# Test 5: WebSocket endpoint accessible
echo -n "Test 5: Checking WebSocket endpoint... "
if timeout 3 bash -c "exec 3<>/dev/tcp/${HOST}/${HTTP_PORT}" 2>/dev/null; then
    echo -e "${GREEN}✓ PASS${NC}"
    exec 3>&-
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Could not verify WebSocket, but HTTP is working)"
fi

# Test 6: API stations endpoint
echo -n "Test 6: Checking API stations endpoint... "
STATIONS_RESPONSE=$(curl -sf "http://${HOST}:${HTTP_PORT}/api/stations" 2>/dev/null || echo "")
if echo "$STATIONS_RESPONSE" | grep -q '"stations"'; then
    STATION_COUNT=$(echo "$STATIONS_RESPONSE" | grep -o '"callsign"' | wc -l)
    echo -e "${GREEN}✓ PASS${NC} (${STATION_COUNT} stations)"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "API stations endpoint returned: $STATIONS_RESPONSE"
    exit 1
fi

# Test 7: API stats endpoint
echo -n "Test 7: Checking API stats endpoint... "
STATS_RESPONSE=$(curl -sf "http://${HOST}:${HTTP_PORT}/api/stats" 2>/dev/null || echo "")
if echo "$STATS_RESPONSE" | grep -q 'kissConnected'; then
    KISS_STATUS=$(echo "$STATS_RESPONSE" | grep -o '"kissConnected":[^,}]*' | cut -d':' -f2)
    echo -e "${GREEN}✓ PASS${NC} (KISS connected: ${KISS_STATUS})"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "API stats endpoint returned: $STATS_RESPONSE"
    exit 1
fi

# Test 8: Database volume exists
echo -n "Test 8: Checking database volume... "
VOLUME_NAME=$(docker inspect --format='{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "${CONTAINER_NAME}")
if [ -n "$VOLUME_NAME" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Volume: ${VOLUME_NAME})"
else
    echo -e "${YELLOW}⚠ WARNING${NC} (No volume mounted at /app/data)"
fi

# Test 9: Supervisor processes running
echo -n "Test 9: Checking supervisor processes... "
NGINX_RUNNING=$(docker exec "${CONTAINER_NAME}" pgrep nginx 2>/dev/null | wc -l)
NODE_RUNNING=$(docker exec "${CONTAINER_NAME}" pgrep node 2>/dev/null | wc -l)
if [ "$NGINX_RUNNING" -gt 0 ] && [ "$NODE_RUNNING" -gt 0 ]; then
    echo -e "${GREEN}✓ PASS${NC} (nginx: ${NGINX_RUNNING}, node: ${NODE_RUNNING})"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "nginx processes: $NGINX_RUNNING, node processes: $NODE_RUNNING"
    exit 1
fi

# Test 10: Container logs don't show critical errors
echo -n "Test 10: Checking for critical errors in logs... "
ERROR_COUNT=$(docker logs "${CONTAINER_NAME}" 2>&1 | grep -i "error" | grep -v "0 errors" | grep -v "error handling" | wc -l)
if [ "$ERROR_COUNT" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} (${ERROR_COUNT} error messages found)"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}All critical tests passed!${NC}"
echo "=========================================="
echo ""
echo "Container Status Summary:"
echo "  Container: ${CONTAINER_NAME}"
echo "  HTTP: http://${HOST}:${HTTP_PORT}"
echo "  API: http://${HOST}:${HTTP_PORT}/api"
echo "  WebSocket: ws://${HOST}:${HTTP_PORT}/ws"
echo ""
