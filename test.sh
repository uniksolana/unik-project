#!/bin/bash

# UNIK Test Suite
# Comprehensive testing script for all components

set -e

echo "🧪 UNIK - Test Suite"
echo "===================="
echo ""

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test 1: Solana Validator
echo "1️⃣ Testing Solana Validator..."
if solana cluster-version &>/dev/null; then
    echo -e "${GREEN}✓ Validator is running${NC}"
else
    echo -e "${RED}✗ Validator not running. Start with: solana-test-validator${NC}"
    exit 1
fi
echo ""

# Test 2: Backend API
echo "2️⃣ Testing Backend API..."
if curl -s http://localhost:3001 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is running${NC}"
    
    # Test endpoints
    echo "  Testing /api/check endpoint..."
    RESPONSE=$(curl -s http://localhost:3001/api/check/test_alias)
    if echo "$RESPONSE" | grep -q "pda"; then
        echo -e "${GREEN}  ✓ Endpoint working${NC}"
    else
        echo -e "${YELLOW}  ! Endpoint returned: $RESPONSE${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Backend not running. Start with: cd indexer && npm run dev${NC}"
fi
echo ""

# Test 3: Smart Contract
echo "3️⃣ Testing Smart Contract..."
if [ -f "target/deploy/unik_anchor.so" ]; then
    echo -e "${GREEN}✓ Smart contract compiled${NC}"
    
    # Check program ID
    PROGRAM_ID=$(solana address -k target/deploy/unik_anchor-keypair.json 2>/dev/null || echo "Not found")
    echo "  Program ID: $PROGRAM_ID"
else
    echo -e "${YELLOW}⚠ Smart contract not compiled. Run: anchor build${NC}"
fi
echo ""

# Test 4: Frontend
echo "4️⃣ Testing Frontend..."
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${YELLOW}⚠ Frontend not running. Start with: cd app && npm run dev${NC}"
fi
echo ""

# Test 5: File Structure
echo "5️⃣ Checking File Structure..."
FILES=(
    "programs/unik_anchor/src/lib.rs"
    "tests/unik_anchor.ts"
    "indexer/src/index.ts"
    "indexer/src/resolver.ts"
    "app/app/page.tsx"
    "README.md"
)

ALL_EXIST=true
for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}  ✓ $file${NC}"
    else
        echo -e "${RED}  ✗ $file${NC}"
        ALL_EXIST=false
    fi
done
echo ""

# Summary
echo "📊 Test Summary"
echo "==============="
if [ "$ALL_EXIST" = true ]; then
    echo -e "${GREEN}All core files present ✓${NC}"
else
    echo -e "${RED}Some files missing ✗${NC}"
fi

echo ""
echo "🚀 To run full tests:"
echo "   anchor test"
echo ""
echo "🌐 Access points:"
echo "   Backend API: http://localhost:3001"
echo "   Frontend:    http://localhost:3000"
echo "   Validator:   localhost:8899"
