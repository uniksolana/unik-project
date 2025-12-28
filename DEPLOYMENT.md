# Deployment Guide - UNIK

## 🌐 Deploy a Solana Devnet

### 1. Preparación

```bash
# Configurar Solana para Devnet
solana config set --url devnet

# Crear/verificar wallet
solana-keygen new --outfile ~/.config/solana/devnet.json
solana config set --keypair ~/.config/solana/devnet.json

# Obtener SOL de prueba
solana airdrop 2
```

### 2. Actualizar Program ID

```bash
# Build para generar nuevo Program ID
anchor build

# Copiar el Program ID generado
solana address -k target/deploy/unik_anchor-keypair.json

# Actualizar en lib.rs
# declare_id!("NUEVO_PROGRAM_ID_AQUI");

# Actualizar en Anchor.toml
# [programs.devnet]
# unik_anchor = "NUEVO_PROGRAM_ID_AQUI"
```

### 3. Deploy del Smart Contract

```bash
# Rebuild con nuevo Program ID
anchor build

# Deploy a Devnet
anchor deploy --provider.cluster devnet

# Verificar deployment
solana program show PROGRAM_ID --url devnet
```

### 4. Configurar Backend para Devnet

```bash
# Editar indexer/.env
SOLANA_RPC_URL=https://api.devnet.solana.com
PORT=3001
```

### 5. Configurar Frontend para Devnet

Editar `app/components/WalletContextProvider.tsx`:
```typescript
const network = WalletAdapterNetwork.Devnet;
```

### 6. Probar en Devnet

```bash
# Ejecutar tests contra Devnet
anchor test --provider.cluster devnet

# Iniciar backend
cd indexer && npm run dev

# Iniciar frontend
cd app && npm run dev
```

## 🚀 Deploy a Mainnet (Producción)

### ⚠️ IMPORTANTE: Auditoría de Seguridad

Antes de deploy a mainnet:
1. ✅ Auditoría completa del código
2. ✅ Tests exhaustivos en Devnet
3. ✅ Revisión de seguridad por terceros
4. ✅ Plan de contingencia

### Pasos para Mainnet

```bash
# 1. Configurar mainnet
solana config set --url mainnet-beta

# 2. Usar wallet con fondos reales
solana config set --keypair ~/.config/solana/mainnet.json

# 3. Verificar balance (necesitas SOL real)
solana balance

# 4. Deploy
anchor deploy --provider.cluster mainnet-beta

# 5. Verificar
solana program show PROGRAM_ID --url mainnet-beta
```

### Configuración Post-Deploy

**Backend:**
```bash
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
# Considerar usar RPC privado (Helius, QuickNode, etc.)
```

**Frontend:**
```typescript
const network = WalletAdapterNetwork.Mainnet;
```

## 📊 Monitoreo

### Herramientas Recomendadas

1. **Solana Explorer:** https://explorer.solana.com/
2. **Solscan:** https://solscan.io/
3. **Helius Dashboard:** Para RPC analytics
4. **Sentry:** Para error tracking en frontend/backend

### Logs y Métricas

```bash
# Ver logs del programa
solana logs PROGRAM_ID

# Monitorear transacciones
solana transaction-history WALLET_ADDRESS
```

## 🔐 Seguridad en Producción

### Checklist

- [ ] Auditoría de smart contract completada
- [ ] Tests de integración pasando al 100%
- [ ] Rate limiting en backend API
- [ ] CORS configurado correctamente
- [ ] Variables de entorno seguras
- [ ] Backup de keypairs
- [ ] Plan de actualización del programa
- [ ] Documentación de emergencia

### Actualizar Programa en Producción

```bash
# 1. Build nueva versión
anchor build

# 2. Upgrade (requiere upgrade authority)
anchor upgrade target/deploy/unik_anchor.so --program-id PROGRAM_ID

# 3. Verificar
solana program show PROGRAM_ID
```

## 💰 Costos Estimados

### Devnet
- ✅ Gratis (SOL de prueba)

### Mainnet
- Deploy inicial: ~2-5 SOL
- Rent para cuentas: Variable según tamaño
- Transacciones: ~0.000005 SOL cada una
- RPC privado: $50-200/mes (recomendado)

## 🆘 Troubleshooting

**Error: "Insufficient funds"**
```bash
solana airdrop 2  # Devnet
# Mainnet: Comprar SOL en exchange
```

**Error: "Program already deployed"**
```bash
# Usar upgrade en lugar de deploy
anchor upgrade target/deploy/unik_anchor.so --program-id PROGRAM_ID
```

**Error: "Invalid program ID"**
```bash
# Verificar que Program ID en lib.rs coincide con keypair
solana address -k target/deploy/unik_anchor-keypair.json
```
