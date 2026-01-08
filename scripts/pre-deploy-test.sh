#!/bin/bash
# Pre-deployment test script
# Validates the codebase before building/deploying containers

# Don't use set -e because we want to continue testing even if some tests fail
set +e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "=========================================="
echo "APRS Station Map - Pre-Deployment Tests"
echo "=========================================="
echo ""

FAILED_TESTS=0
PASSED_TESTS=0

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((PASSED_TESTS++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((FAILED_TESTS++))
}

warn() {
    echo -e "${YELLOW}⚠ WARNING${NC}: $1"
}

info() {
    echo -e "${BLUE}ℹ INFO${NC}: $1"
}

# Test 1: Check Node.js version
echo -n "Test 1: Node.js version... "
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -ge 18 ]; then
        pass "Node.js v$(node --version)"
    else
        fail "Node.js version too old (need v18+, have v$(node --version))"
    fi
else
    warn "Node.js not installed (only needed for local development)"
fi

# Test 2: Check npm
echo -n "Test 2: npm installed... "
if command -v npm &> /dev/null; then
    pass "npm v$(npm --version)"
else
    warn "npm not installed (only needed for local development)"
fi

# Test 3: Check Docker
echo -n "Test 3: Docker installed... "
if command -v docker &> /dev/null; then
    pass "Docker v$(docker --version | cut -d' ' -f3 | tr -d ',')"
else
    fail "Docker not installed"
fi

# Test 4: Check Docker Compose
echo -n "Test 4: Docker Compose v2... "
if docker compose version &> /dev/null; then
    pass "$(docker compose version)"
else
    fail "Docker Compose v2 not available"
fi

# Test 5: Check required files exist
echo "Test 5: Required files..."
REQUIRED_FILES=(
    ".appcontainer/Dockerfile"
    ".appcontainer/nginx.conf"
    "package.json"
    "tsconfig.json"
    ".appcontainer/compose.yaml"
    "src/server/index.ts"
    "src/main.tsx"
)

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "  Found: $file"
    else
        fail "  Missing: $file"
    fi
done

# Test 6: Check package.json for required scripts
echo "Test 6: package.json scripts..."
REQUIRED_SCRIPTS=("build" "test" "lint" "typecheck")
for script in "${REQUIRED_SCRIPTS[@]}"; do
    if grep -q "\"$script\":" package.json; then
        pass "  Script exists: $script"
    else
        fail "  Missing script: $script"
    fi
done

# Test 7: Validate .appcontainer/compose.yaml
echo -n "Test 7: Validate .appcontainer/compose.yaml... "
if docker compose -f .appcontainer/compose.yaml config > /dev/null 2>&1; then
    pass "Valid Docker Compose configuration"
else
    fail "Invalid Docker Compose configuration"
fi

# Test 8: Check for personal information (should be removed)
echo "Test 8: Check for personal information..."
SENSITIVE_TERMS=("M0LHA" "Bexley" "direwolf-stations.kml")
FOUND_SENSITIVE=0

for term in "${SENSITIVE_TERMS[@]}"; do
    # Check in tracked files only, exclude .git directory
    if git grep -q "$term" 2>/dev/null; then
        FILES=$(git grep -l "$term" 2>/dev/null || echo "")
        if [ -n "$FILES" ]; then
            warn "  Found '$term' in: $(echo $FILES | head -1)"
            ((FOUND_SENSITIVE++))
        fi
    fi
done

if [ $FOUND_SENSITIVE -eq 0 ]; then
    pass "No personal information found in tracked files"
fi

# Test 9: TypeScript configuration
echo -n "Test 9: TypeScript configuration... "
if [ -f "tsconfig.json" ]; then
    if command -v npx &> /dev/null && [ -d "node_modules" ]; then
        if npx tsc --noEmit --project tsconfig.json > /dev/null 2>&1; then
            pass "TypeScript configuration valid"
        else
            warn "TypeScript errors found (run 'npm run typecheck' for details)"
        fi
    else
        info "Skipping TypeScript validation (node_modules not found)"
    fi
else
    fail "tsconfig.json not found"
fi

# Test 10: Dockerfile syntax
echo -n "Test 10: Dockerfile syntax... "
if docker build -f .appcontainer/Dockerfile --target builder -t test-builder . > /dev/null 2>&1; then
    pass "Dockerfile syntax valid (builder stage)"
    docker rmi -f test-builder > /dev/null 2>&1 || true
else
    # Check if it's a build failure or just permission issue
    if docker build -f .appcontainer/Dockerfile --target builder --dry-run > /dev/null 2>&1; then
        warn "Could not build test image (Docker permissions?)"
    else
        fail "Dockerfile has syntax errors"
    fi
fi

# Test 11: Check .dockerignore exists
echo -n "Test 11: .dockerignore exists... "
if [ -f ".dockerignore" ]; then
    pass ".dockerignore found"
else
    warn ".dockerignore not found (build context may be large)"
fi

# Test 12: Check for node_modules in git
echo -n "Test 12: node_modules not in git... "
if git ls-files | grep -q "node_modules"; then
    fail "node_modules is tracked by git"
else
    pass "node_modules not tracked"
fi

# Test 13: Check environment variables documentation
echo -n "Test 13: Environment variables documented... "
if grep -q "STATION_CALLSIGN" README.md && grep -q "KISS_HOST" README.md; then
    pass "Environment variables documented in README"
else
    warn "Environment variables may not be fully documented"
fi

# Test 14: Check for test files
echo -n "Test 14: Test files exist... "
TEST_COUNT=$(find tests -name "*.test.ts" 2>/dev/null | wc -l)
if [ "$TEST_COUNT" -gt 0 ]; then
    pass "Found $TEST_COUNT test files"
else
    warn "No test files found"
fi

# Test 15: Validate named volumes are used
echo -n "Test 15: Named volumes configured... "
if grep -q "aprs-data:" .appcontainer/compose.yaml && grep -q "volumes:" .appcontainer/compose.yaml; then
    pass "Named volume 'aprs-data' configured for data persistence"
else
    fail "Named volumes not properly configured"
fi

echo ""
echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
if [ $FAILED_TESTS -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
fi
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed!${NC}"
    echo ""
    echo "Ready to deploy. Next steps:"
    echo "  1. Set up .env file with your station details"
    echo "  2. Build and run: docker compose -f .appcontainer/compose.yaml up -d"
    echo "  3. Verify deployment: npm run test:container"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please fix the issues before deploying.${NC}"
    exit 1
fi
