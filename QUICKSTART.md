# UNIK - Guía de Inicio Rápido

## 🚀 Inicio Rápido (5 minutos)

### 1. Instalar Dependencias

```bash
# Backend
cd indexer
npm install

# Frontend
cd ../app
npm install
```

### 2. Configurar Entorno

```bash
# Backend
cd indexer
cp .env.example .env
# Editar .env si es necesario (por defecto usa localhost:8899)
```

### 3. Ejecutar Servicios

**Terminal 1 - Solana Local Validator:**
```bash
solana-test-validator
```

**Terminal 2 - Backend API:**
```bash
cd indexer
npm run dev
# Servidor en http://localhost:3001
```

**Terminal 3 - Frontend:**
```bash
cd app
npm run dev
# App en http://localhost:3000
```

### 4. Probar Smart Contract

```bash
# Compilar
anchor build

# Ejecutar tests
anchor test
```

## 📋 Comandos Útiles

### Smart Contract
```bash
anchor build          # Compilar
anchor test          # Ejecutar tests
anchor deploy        # Deploy a cluster configurado
```

### Backend
```bash
npm run dev          # Modo desarrollo
npm run build        # Compilar TypeScript
npm start           # Ejecutar producción
```

### Frontend
```bash
npm run dev         # Modo desarrollo
npm run build       # Build producción
npm start          # Ejecutar producción
```

## 🧪 Probar la Aplicación

1. **Abrir Frontend:** http://localhost:3000
2. **Probar Alias Checker:**
   - Ingresar un alias (ej: "test_alias")
   - Click en "Check"
   - Ver respuesta del backend

3. **Probar Backend API directamente:**
```bash
# Check alias
curl http://localhost:3001/api/check/test_alias

# Resolver alias (después de registrarlo)
curl http://localhost:3001/api/resolve/test_alias

# Ver routes
curl http://localhost:3001/api/route/test_alias
```

## 🔧 Troubleshooting

**Error: "No space left on device"**
```bash
# Limpiar builds
rm -rf target/ node_modules/ app/node_modules/
# Reinstalar
npm install
```

**Error: "Connection refused" en tests**
```bash
# Asegurar que solana-test-validator está corriendo
solana-test-validator
```

**Error: "Program not found"**
```bash
# Rebuild y redeploy
anchor build
anchor deploy
```

## 📚 Próximos Pasos

1. ✅ Registrar tu primer alias
2. ✅ Configurar splits automáticos
3. ✅ Probar transferencias
4. 🔜 Deploy a Devnet
5. 🔜 Implementar dashboard completo

## 🔗 Enlaces Útiles

- [Anchor Docs](https://www.anchor-lang.com/)
- [Solana Docs](https://docs.solana.com/)
- [Next.js Docs](https://nextjs.org/docs)
