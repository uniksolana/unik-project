# Informe de Auditoría de Seguridad 360° - Unik Pay
**Fecha:** 09 Febrero 2026
**Auditor:** Antigravity AI (Perfil Seguridad Blockchain)
**Versión del Proyecto:** 0.1.0

---

## 1. Resumen Ejecutivo

El proyecto **Unik Pay** presenta una base sólida en su capa de Smart Contract (Blockchain), utilizando correctamente las primitivas de seguridad de Solana y Anchor Framework. Sin embargo, la seguridad global del sistema se ve comprometida por decisiones arquitectónicas riesgosas en la capa de integración (Frontend) y en la gestión de datos Off-chain (Supabase).

**Estado General:**
*   🛡️ **Smart Contract:** Robusto y Seguro.
*   ⚠️ **Frontend/Integración:** Riesgo Alto (Confianza excesiva en el cliente).
*   ❌ **Gestión de Datos:** Crítico (Fugas de información y falta de control de acceso).

---

## 2. Análisis Detallado por Componente

### A. Smart Contract (Programs/Anchor) ✅
El contrato inteligente es el componente más fuerte del sistema.
*   **Lo que está bien:**
    *   **Control de Acceso:** Uso correcto de `Signer` y validación de `owner` en todas las instrucciones críticas (`set_route_config`, `update_alias`).
    *   **Gestión de PDAs:** Las semillas (`seeds`) están bien definidas (`[b"alias", name]`), previniendo colisiones.
    *   **Seguridad Aritmética:** Se utiliza `checked_mul` y `checked_div`, protegiendo contra desbordamientos numéricos.
*   **Vulnerabilidades Detectadas:**
    *   🟡 **Pérdida de Precisión (Dust):** La división entera por 10,000 implica que si se envían montos muy pequeños (< 10,000 lamports), el cálculo de `split_amount` resultará en 0. El contrato ejecutará la transferencia de 0, cobrando fees al usuario sin mover valor.
        *   *Solución:* Añadir `require!(amount >= 10000, UnikError::AmountTooSmall);`.

### B. Frontend & Lógica de Pagos (Next.js) ❌
Aquí residen los mayores riesgos de seguridad operativa.
*   **Vulnerabilidades Detectadas:**
    *   🔴 **Arquitectura de "Wallet Puente" (Fiat):** La funcionalidad descrita para pagos Fiat no se encuentra implementada. Sin embargo, el diseño propuesto (generar wallets efímeras en el navegador) es **inherentemente inseguro**. Exponer claves privadas en el entorno JS del cliente las hace vulnerables a ataques XSS y extensiones maliciosas.
        *   *Solución:* Utilizar servicios de custodia externos (MoonPay, Stripe Crypto) o tecnología MPC. **Nunca** gestionar claves privadas en la memoria del navegador.
    *   🟠 **Manipulación de Enlaces de Pago:** La página de pago (`/pay/[alias]`) confía ciegamente en los parámetros de la URL (`?amount=`). Un usuario malicioso puede modificar el enlace para pagar una fracción del precio real (ej. cambiar 1 SOL por 0.001 SOL) y el frontend mostrará "Pago Exitoso".
        *   *Solución:* El backend debe verificar la transacción on-chain y confirmar que `tx.amount == order.expected_price` antes de dar el servicio por pagado.
    *   🟠 **Fuga de Datos Sensibles (Logs):** Se detectó en `app/utils/notes.ts` (Línea 154) un `console.log` que imprime el contenido de las notas en **texto plano** antes de ser encriptadas. Esto expone información privada en la consola del navegador.
        *   *Solución:* Eliminar todos los `console.log` de datos sensibles en producción.

### C. Base de Datos & Backend (Supabase) ⚠️
*   **Vulnerabilidades Detectadas:**
    *   🟠 **Políticas RLS No Verificadas:** La aplicación conecta con `ANON_KEY`. No se han encontrado archivos de migración que definan políticas de "Row Level Security" (RLS). Sin estas políticas, la base de datos es efectivamente pública: cualquier usuario podría leer, modificar o borrar los perfiles y notas encriptadas de otros.
        *   *Solución:* Implementar políticas SQL estrictas inmediatamente:
          ```sql
          create policy "Users can only update own data" on user_encrypted_data
          for update using (auth.uid() = wallet_address);
          ```

---

## 3. Plan de Acción Recomendado

1.  **Inmediato (Hotfix):**
    *   Eliminar `console.log` en `app/utils/notes.ts`.
    *   Implementar y verificar políticas RLS en Supabase.
2.  **Corto Plazo:**
    *   Implementar validación de montos en Backend (Indexer o Edge Function) para los enlaces de pago.
    *   Añadir restricción de monto mínimo en el Smart Contract.
3.  **Largo Plazo (Arquitectura):**
    *   Rediseñar la integración Fiat para eliminar la necesidad de "wallets efímeras" en el cliente, adoptando un proveedor de pagos establecido.

---

**Conclusión:** Unik Pay tiene un núcleo blockchain sólido, pero debe reforzar urgentemente su capa de aplicación web para proteger los datos y fondos de los usuarios ante ataques básicos de manipulación y acceso a datos.
