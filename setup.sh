#!/bin/bash

# UNIK Project Setup Script
# Este script configura el entorno completo de UNIK

set -e

echo "🧠 UNIK - Setup Script"
echo "======================"
echo ""

# Colores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verificar dependencias
echo "📦 Verificando dependencias..."

if ! command -v anchor &> /dev/null; then
    echo -e "${YELLOW}⚠️  Anchor no está instalado${NC}"
    echo "Instalar desde: https://www.anchor-lang.com/docs/installation"
    exit 1
fi

if ! command -v solana &> /dev/null; then
    echo -e "${YELLOW}⚠️  Solana CLI no está instalado${NC}"
    echo "Instalar desde: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js no está instalado${NC}"
    echo "Instalar desde: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Todas las dependencias están instaladas${NC}"
echo ""

# Configurar Solana
echo "⚙️  Configurando Solana..."
solana config set --url localhost
echo -e "${GREEN}✅ Solana configurado para localhost${NC}"
echo ""

# Instalar dependencias del backend
echo "📦 Instalando dependencias del backend..."
cd indexer
npm install
echo -e "${GREEN}✅ Backend instalado${NC}"
cd ..
echo ""

# Instalar dependencias del frontend
echo "📦 Instalando dependencias del frontend..."
cd app
npm install
echo -e "${GREEN}✅ Frontend instalado${NC}"
cd ..
echo ""

# Configurar variables de entorno
echo "🔧 Configurando variables de entorno..."
if [ ! -f indexer/.env ]; then
    cp indexer/.env.example indexer/.env
    echo -e "${GREEN}✅ Archivo .env creado${NC}"
else
    echo -e "${YELLOW}⚠️  .env ya existe, saltando...${NC}"
fi
echo ""

# Build del smart contract
echo "🔨 Compilando Smart Contract..."
anchor build
echo -e "${GREEN}✅ Smart Contract compilado${NC}"
echo ""

echo "🎉 Setup completado!"
echo ""
echo "Próximos pasos:"
echo "1. Iniciar Solana validator: solana-test-validator"
echo "2. Ejecutar tests: anchor test"
echo "3. Iniciar backend: cd indexer && npm run dev"
echo "4. Iniciar frontend: cd app && npm run dev"
echo ""
echo "Ver QUICKSTART.md para más información"
