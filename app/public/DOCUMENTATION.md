# UNIK Protocol — Documentación Completa

> **El Enrutador de Pagos Inteligente y No-Custodio en Solana**

---

## 1. ¿Qué es UNIK?

**UNIK (UnikPay)** es una infraestructura de pagos inteligente y no-custodia construida sobre la blockchain de Solana. Su misión es transformar la compleja experiencia de enviar y recibir criptomonedas en un proceso tan sencillo y amigable como enviar un correo electrónico, un mensaje por WhatsApp o hacer un Bizum, añadiendo al mismo tiempo capacidades avanzadas de enrutamiento y división automática de fondos (**Auto-Splits**) para negocios, creadores y usuarios particulares.

A diferencia de los procesadores de pago web2 (como PayPal o Stripe) que retienen y controlan los fondos de los usuarios, UNIK es **100% No-Custodio**. Los contratos inteligentes de UNIK no tocan, no pausan y no bloquean el dinero en monederos puente; simplemente instruyen a la blockchain sobre cómo y dónde debe circular el capital de un punto A a un punto B en cuestión de milisegundos.

---

## 2. El Problema que Resuelve

La adopción masiva de las criptomonedas como medio de pago diario enfrenta fricciones severas que UNIK elimina por completo:

| Problema | Descripción |
|---|---|
| ❌ **Direcciones Inmanejables** | Enviar pagos a direcciones de 44 caracteres (ej. `7xQ2...Y9P`) genera confusión, estrés y es propenso a errores humanos catastróficos que resultan en pérdida total de fondos. |
| ❌ **Conciliación Imposible** | Recibir transferencias cripto sin un "concepto" adjunto hace que sea casi imposible para un freelancer o tienda saber *quién* pagó *qué* factura. |
| ❌ **Splits Manuales** | Repartir ingresos entre socios o proveedores implica recibir en una billetera centralizada y hacer transferencias una a una, perdiendo tiempo y asumiendo comisiones extra. |
| ❌ **Historial Ilegible** | Explorar transacciones en un block explorer tradicional (como Solscan) es incomprensible para el usuario medio y no revela los detalles privados del acuerdo comercial. |
| ❌ **Desconexión Social** | Los usuarios no tienen un método nativo y fácil para recordar las direcciones recurrentes de sus amigos o clientes. |
| ❌ **Fricción Móvil** | Los enlaces web3 a menudo fallan cuando se abren desde navegadores de teléfonos móviles (sin extensiones de billetera web3). |

---

## 3. ¿Cómo Funciona la Solución?

UNIK resuelve estos puntos críticos de dolor mediante tres innovaciones tecnológicas principales:

### A. Universal Aliases (Nombres Legibles)

Los usuarios pueden reclamar un **alias único y corto** (ej. `@maria`, `@mitienda`). Cada alias está emparejado criptográficamente a su billetera real mediante un *Program Derived Address (PDA)* en la blockchain de Solana.

Al realizar un cobro, en lugar de copiar su engorrosa dirección pública, simplemente comparten su enlace:

```
unikpay.xyz/pay/mitienda
```

El sistema resuelve el alias a la billetera real de forma transparente, instantánea y verificable.

### B. Auto-Splits on Chain (Enrutamiento Activo)

El propietario de un alias puede definir **"Reglas de Enrutamiento"** (*Routing Rules*). Por ejemplo, puede configurar que cualquier dinero que reciba `@mitienda` se divida instantáneamente en el mismo momento de la compra:

| Destino | Porcentaje |
|---|---|
| 🏦 Billetera Principal (Dueño) | **60%** |
| 📦 Billetera del Proveedor | **30%** |
| 🏛️ Fondo de Impuestos | **10%** |

El pagador (cliente) realiza **una única transacción**, y el Contrato Inteligente de UNIK (desplegado en Solana) se encarga de repartir atómicamente el dinero a todas las billeteras de destino en tiempo real, sin intermediarios. Las comisiones de red (*gas fees*) se pagan una sola vez en la transacción base.

### C. Enlaces de Pago Validados con HMAC (Seguridad Anti-Tampering)

UNIK permite crear facturas u órdenes de pago "cerradas" a prueba de manipulaciones. Por ejemplo:

```
unikpay.xyz/pay/alias?amount=50&token=USDC&concept=Consultoría
```

Para evitar que un cliente o atacante modifique la URL maliciosamente antes de pagar (ej. cambiando `amount=50` a `amount=1`), todo enlace de orden de pago viaja validado por una **Firma Criptográfica HMAC-SHA256**. Si la firma no coincide exactamente con los parámetros emitidos por el creador, el sistema rechaza y bloquea el pago instantáneamente, garantizando así seguridad total en plataformas e-commerce.

---

## 4. ¿A quién va dirigido?

| Perfil | Caso de Uso |
|---|---|
| 🎨 **Creadores de Contenido / Streamers** | Recibir donaciones o propinas durante directos (generando códigos QR hiper-estéticos) y dividir esos ingresos en automático con moderadores, agencias o editores de vídeo. |
| 🛒 **E-Commerce y Retail Web3** | Integrar pagos cripto rápidos, recibiendo pagos instantáneos (liquidez inmediata en stablecoins) y minimizando comisiones bancarias al 0%. La validación HMAC asegura qué producto exacto ha sido pagado. |
| 💼 **Freelancers y Agencias** | Generar un enlace profesional para incrustarlo en facturas PDF. Al cobrar, los ingresos se dividen automáticamente según la participación de cada freelancer. |
| 👥 **Usuarios Corrientes** | Pagos del día a día con familiares, amigos, dividir facturas del restaurante o compartir suscripciones (gracias a la libreta de contactos integrada web3). |

---

## 5. Tecnología y Arquitectura (El Stack UNIK)

UNIK no es solo un frontend; es un sistema completo de infraestructuras interconectadas.

### 5.1. Smart Contracts (Rust / Anchor Framework)

La lógica de transferencias divisibles *on-chain* descansa sobre programas eficientes desplegados en Solana. El contrato inteligente utiliza:

- **SPL Token Program** para transferencias de tokens estándar (USDC, EURC).
- **Instrucciones idempotentes `getOrCreateAssociatedTokenAccount`** que protegen transacciones hacia billeteras "vírgenes" que aún no poseen el token. Esto significa que si un destinatario nunca ha recibido USDC, el sistema le crea automáticamente la cuenta asociada de token (ATA) antes de enviar, evitando fallos y pérdida de fondos.
- **Program Derived Addresses (PDAs)** para garantizar que los alias son únicos e inmutables en la blockchain, imposibles de suplantar.

**Instrucciones del Contrato:**

| Instrucción | Descripción |
|---|---|
| `register_alias` | Registra un alias único, ligándolo a una billetera. Se almacena como PDA, imposible de duplicar. |
| `set_route_config` | Define las reglas de splits (hasta 5 destinos). Cada uno con un porcentaje en *basis points* (100% = 10000). |
| `execute_transfer` | Ejecuta el pago y distribuye atómicamente los fondos según las reglas configuradas. |

### 5.2. Frontend y Backend (Next.js / React / TailwindCSS)

Una interfaz de usuario (UI) ultra-responsiva con un diseño estético "Premium", fluida y ágil, construida sobre el ecosistema **Vercel / Next.js**. Las rutas de API (`/api/*`) funcionan como funciones *serverless* que orquestan:

- Firmas HMAC para validar órdenes de pago.
- Comunicación con Supabase para lectura/escritura de metadatos.
- Generación dinámica de imágenes OpenGraph para las previsualizaciones sociales.
- Rate limiting (protección contra ataques DDoS).

### 5.3. Base de Datos Privada (Supabase / PostgreSQL)

Supabase aloja los metadatos de enriquecimiento de UI. Es importante destacar que **la base de datos nunca almacena dinero, claves privadas, ni saldos**. Solo contiene:

| Tabla | Contenido |
|---|---|
| `profiles` | Idioma preferido, moneda preferida y dirección de billetera. |
| `payment_orders` | Órdenes de pago con concepto, monto, token, firma HMAC, estado y fecha de expiración. |
| `user_encrypted_data` | Blobs cifrados E2E (contactos, notas, avatar privado). El servidor solo ve texto ilegible. |
| `transaction_notes` | Notas compartidas cifradas entre emisor y receptor (ver sección de Encriptación). |
| `rate_limits` | Contadores por IP para proteger las APIs de ataques de fuerza bruta. |
| `processed_signatures` | Registro de firmas de transacciones ya procesadas, para prevenir doble gasto o replay. |
| `legal_consents` | Aceptación de términos y condiciones por billetera. |

### 5.4. Deep-Linking Exclusivo Móvil (Phantom Focus)

Para garantizar un 100% de efectividad y 0% de fatiga de uso en transacciones web3 desde *Smartphones*, UNIK intercepta de forma inteligente cualquier aterrizaje en móvil y emplea un redireccionador Universal Link nativo:

```
https://phantom.app/ul/v1/browse?url=<tu_url>&ref=<referencia>
```

Esto empuja toda la navegación y ejecución del pago directamente al navegador interno de *máxima seguridad* de la billetera Phantom. Si el usuario no tiene Phantom instalado, se le derivará automáticamente a descargarlo desde la tienda de aplicaciones correspondiente (App Store / Google Play).

**Detección inteligente del entorno:**
- Si el usuario ya se encuentra *dentro* de la app Phantom (in-app browser), el sistema lo detecta y **no** muestra la ventana de redirección.
- Si el usuario accede a la landing page (`/`), la ventana de redirección **no aparece**, permitiendo leer el contenido informativo antes de decidir si continuar.

---

## 6. 🔐 Sistema de Encriptación y Privacidad

UNIK implementa un sistema de cifrado multicapa diseñado para que **ni siquiera los administradores del servidor puedan leer los datos privados de los usuarios**. A continuación se describen los tres niveles de encriptación que operan simultáneamente:

### 6.1. Cifrado de Datos Personales (Notas, Contactos, Avatar Privado)

**Algoritmo:** AES-256-GCM (Galois/Counter Mode)
**Derivación de Clave:** PBKDF2 con 600.000 iteraciones + SHA-256

**¿Cómo funciona?**

1. **Inicio de Sesión Seguro:** Cuando el usuario conecta su billetera por primera vez en una sesión, UNIK le solicita firmar un mensaje único y predecible ("UNIK Encryption Key Derivation"). Esta firma es utilizada como semilla (*seed*) para generar una clave simétrica AES-256.
2. **Derivación de la Clave:** La firma del usuario se mezcla con su clave pública (`unik-v2-<publicKey>`) usando PBKDF2 con **600.000 iteraciones** de SHA-256. Esto produce una clave criptográfica AES-256 extremadamente robusta que es virtualmente imposible de adivinar por fuerza bruta.
3. **Encriptación Local:** Toda información sensible (notas de transacciones, lista de contactos, foto de perfil privada) se cifra **dentro del navegador del usuario** *antes* de abandonar su dispositivo.
4. **Almacenamiento Ciego:** El servidor de Supabase recibe y almacena únicamente blobs binarios cifrados (*ciphertext*). Un administrador de base de datos que acceda directamente a la tabla `user_encrypted_data` solo vería cadenas de texto ilegibles como `dWsfR3kQ...==`.
5. **Descifrado en Destino:** Cuando el usuario vuelve a iniciar sesión (en el mismo dispositivo o en otro), la clave se re-deriva pidiendo la misma firma, y los datos son descifrados localmente en su navegador.

**Diagrama del flujo:**

```
┌─────────────┐    Firma    ┌──────────────┐   PBKDF2    ┌──────────────┐
│   Phantom   │────────────►│  Mensaje:    │────────────►│ Clave AES-256│
│   Wallet    │             │  "UNIK..."   │  600K iter  │   (en RAM)   │
└─────────────┘             └──────────────┘             └──────┬───────┘
                                                               │
                            ┌──────────────┐  AES-GCM    ┌─────▼───────┐
                            │   Supabase   │◄────────────│ Datos cifr. │
                            │ (blob ciego) │  Encrypt()  │ en browser  │
                            └──────────────┘             └─────────────┘
```

> **Clave efímera:** La clave de sesión se almacena **exclusivamente en la memoria RAM** del navegador (`sessionState.ts`). Nunca se escribe en disco, `localStorage`, cookies, ni se envía al servidor. Al cerrar la pestaña del navegador, la clave desaparece automática e irrecuperablemente.

### 6.2. Notas Compartidas de Transacción (Mensajes entre Emisor y Receptor)

**Algoritmo:** AES-256-GCM
**Clave derivada de:** La firma de la transacción en blockchain (SHA-256)

Las notas que un pagador adjunta al enviar dinero (ej. *"Pago del alquiler de Marzo"*) necesitan ser legibles tanto para quien envía como para quien recibe. UNIK resuelve esto sin comprometer la privacidad usando la propia firma de la transacción en la blockchain como clave criptográfica compartida:

**¿Cómo funciona?**

1. El pagador escribe una nota al enviar fondos.
2. La transacción se envía a Solana y genera una **firma única** (`signature`, ej: `5UHk7...wQ3P`).
3. Esa firma se hashea con SHA-256 para generar una clave AES-256.
4. La nota se cifra con esa clave y se almacena en la tabla `transaction_notes` de la base de datos.
5. Tanto el emisor como el receptor conocen la firma de la transacción (es pública en el explorador), por lo que ambos pueden derivar la clave y descifrar la nota.

**¿Quién puede leer la nota?**
- ✅ El emisor (conoce la firma, él la generó).
- ✅ El receptor (ve la firma en su historial de transacciones en Solana).
- ❌ Administradores del servidor (solo ven el blob cifrado, no conocen la firma en ese contexto).
- ❌ Terceros sin acceso a la firma.

### 6.3. Cifrado de Imágenes y Archivos Binarios (Avatar Privado)

**Algoritmo:** AES-256-GCM sobre buffer binario

El avatar (foto de perfil) del usuario tiene un tratamiento especial de doble capa:

| Capa | Tipo | Propósito |
|---|---|---|
| 🔒 **Copia Privada** | Cifrada (E2E con clave de sesión del usuario) | Garantiza que el usuario siempre recupera su foto aunque cambie de dispositivo, usando su firma de wallet como "contraseña". |
| 🌐 **Copia Pública** | Sin cifrar (Supabase Storage) | Permite que otros usuarios (contactos, pagadores) vean la foto de perfil sin necesitar las claves del propietario. |

**Funcionamiento del avatar:**

1. El usuario sube una imagen.
2. La imagen se **redimensiona** automáticamente a un máximo de 400×400px y se comprime a JPEG al 80% de calidad (para optimizar almacenamiento).
3. Se convierte a Base64 y se guarda como una nota cifrada privada (E2E encrypted).
4. Simultáneamente, se sube una copia pública al almacenamiento de Supabase Storage (bucket `avatars`).
5. Al cargar el dashboard, el sistema busca el avatar en este orden de prioridad:
   - **Caché local** (más rápido, sin conexión a red).
   - **Nota cifrada privada** (sincroniza entre dispositivos si la sesión encriptada está activa).
   - **Copia pública** (última opción/fallback si el cifrado aún no ha sido desbloqueado).

### 6.4. Almacenamiento Inteligente con Fallback (Smart Storage)

Todas las operaciones de datos personales (contactos, notas, avatar) utilizan un sistema de **"Smart Storage"** que implementa un patrón *Facade* con dos backends:

```
┌────────────────────────────────┐
│       SmartStorage (Facade)    │
│ ┌───────────┐  ┌─────────────┐ │
│ │   Cloud   │  │    Local    │ │
│ │ Supabase  │  │ localStorage│ │
│ │ (cifrado) │  │  (sin red)  │ │
│ └───────────┘  └─────────────┘ │
└────────────────────────────────┘
```

- **Si la sesión de cifrado está activa** (el usuario firmó el mensaje de derivación), los datos se leen/escriben en la nube (Supabase), cifrados E2E.
- **Si la sesión de cifrado no está disponible** (usuario no ha firmado todavía, o error de red), los datos se almacenan temporalmente en `localStorage` del navegador como fallback local. Son funcionales, pero no se sincronizan entre dispositivos.

---

## 📖 Guía de Usuario Completa

### I. Registro e Inicio de Sesión

1. **Accede** a `unikpay.xyz` desde tu PC, o ingresa directamente a través de la pestaña "Explorar" / "Browser" de tu Phantom Wallet móvil.
2. Pulsa en **Connect Wallet** o **Launch Dashboard →**. La plataforma te pedirá conectar tu billetera de Solana (firma silenciosa de autenticación). **Las claves privadas nunca abandonan tu dispositivo.**
3. **Desbloqueo de Cifrado (una vez por sesión):** Al conectar tu billetera, se te presentará un *modal de consentimiento* que te solicitará firmar un mensaje especial. Esta firma **no gasta dinero ni autoriza ninguna transacción**; su único propósito es derivar tu clave de cifrado personal para desbloquear tus datos privados (contactos, notas, historial enriquecido). Si rechazas la firma, el dashboard funcionará igualmente pero sin acceso a tus datos encriptados en la nube.

### II. Las Pestañas del Dashboard (Panel de Control)

Una vez dentro, dispones del panel de control total, estructurado en las siguientes pestañas:

---

#### 🏷️ Pestaña: Alias

**Propósito:** Reclamar tu nombre único en la red UNIK.

**Funciones detalladas:**

- **Verificar Disponibilidad:** Escribe un nombre de 3 a 20 caracteres alfanuméricos (sin espacios ni caracteres especiales). El sistema comprobará en tiempo real si está libre consultando la blockchain.
- **Reclamar (Claim):** Si el alias está disponible, pulsa el botón *Claim*. Se te pedirá firmar una transacción en Solana (con un coste mínimo de gas, normalmente <$0.01) que registra el alias como un PDA en la blockchain, vinculándolo matemáticamente a tu dirección de billetera de forma permanente.
- **Mi Alias Activo:** Una vez reclamado, verás un panel con:
  - Tu alias (`@nombre`) con un indicador visual verde.
  - La fecha exacta de registro.
  - La dirección de billetera asociada (copiable con un clic).
- **Tarjeta de Contacto Compartible:** Se genera automáticamente un enlace `unikpay.xyz/add-contact/tu-alias` que puedes enviar a cualquiera. Cuando la otra persona haga clic, verá tu foto de perfil, tu alias, y un botón para añadirte directamente a su libreta de contactos UNIK. Al compartir este enlace por WhatsApp o Telegram, aparecerá una **tarjeta OpenGraph** con una vista previa visual atractiva y profesional de tu perfil.
- **Eliminar Alias:** Si deseas liberar tu alias para que otra persona lo pueda reclamar, puedes eliminarlo. Esto requiere una transacción en Solana que borra el PDA. La acción es irreversible y requiere confirmación explícita.

> **Nota Importante:** El alias es **opcional** para usar UNIK de forma básica (enviar/recibir pagos). Sin embargo, es **obligatorio para habilitar las Reglas de Enrutamiento (Auto-Splits)**, ya que el contrato inteligente necesita un alias registrado para asociar las reglas de distribución.

---

#### ⚙️ Pestaña: Settings / Profile (Configuración del Perfil)

Se accede pulsando el icono de engranaje (⚙️) en la parte superior del dashboard. Abre un modal con las siguientes secciones:

**Avatar (Foto de Perfil):**
- Pulsa sobre el círculo de la foto para **subir una imagen** desde tu dispositivo (acepta cualquier formato de imagen: JPEG, PNG, WebP, etc.).
- La imagen se redimensiona automáticamente a 400×400px y se comprime a JPEG 80% para optimizar el almacenamiento.
- Se almacena con el sistema de doble capa explicado en la sección de Encriptación (copia privada cifrada + copia pública).
- Si no subes ninguna foto, se te generará un **avatar geométrico predeterminado**.
- **Eliminar Foto:** Si tienes un alias registrado, aparece un botón *"Remove Photo"* que borra tanto la copia pública como la privada cifrada.

**Nombre de Visualización (Display Name):**
- Configura un nombre real o de marca que aparecerá junto a tu alias en toda la interfaz y en las tarjetas de contacto compartidas.

**Preferencias Globales:**

| Preferencia | Opciones Disponibles | Descripción |
|---|---|---|
| 🌐 **Idioma** | Inglés (EN), Español (ES), Francés (FR) | Cambia el idioma de toda la interfaz. Se sincroniza con tu perfil en la nube (Supabase) para que mantenga consistencia entre dispositivos. |
| 💱 **Moneda de Visualización** | USD ($), EUR (€) | Cambia la moneda en la que se muestran los precios equivalentes de SOL. El precio de SOL se actualiza en tiempo real cada 60 segundos usando CoinGecko (con fallback a Binance si CoinGecko falla). |

**Información Técnica:**
- Red de Solana activa (Devnet / Mainnet).
- Alias registrado y fecha de registro.
- Dirección completa de la billetera.

---

#### 🔀 Pestaña: Routing / Splits (Enrutamiento Activo)

**Propósito:** Configurar la división automática de fondos entrantes.

**Funcionamiento detallado:**

1. **Estado Inicial:** La tabla muestra tu **Billetera Principal al 100%** como única receptora.
2. **Añadir Regla ("+ Add Rule"):**
   - Pega una dirección de billetera de Solana válida (44 caracteres, formato Base58).
   - Introduce el porcentaje numérico (0-100%) que deseas que esa persona absorba de cualquier pago dirigido a tu Alias.
   - El sistema **valida automáticamente** que la dirección sea una clave pública de Solana legítima antes de aceptarla.
3. **Tabla Visual de Distribución:** Cada regla muestra:
   - 🎨 Un indicador de color único para cada destinatario.
   - La dirección de la billetera (truncada para legibilidad, ej. `7xQ2...Y9P`).
   - El porcentaje asignado.
   - Un botón de eliminar (🗑️) para cada regla añadida.
4. **Porcentaje Residual Automático:** La billetera principal siempre recibe el porcentaje restante. Si asignas un 30% a un tercero, tu principal baja automáticamente al 70%.
5. **Guardar Configuración:** Al pulsar *Save*, se genera una transacción en Solana que almacena las reglas on-chain en un `RouteAccount` (PDA). Esto requiere una firma de tu billetera y un mínimo de gas.

> **Requisito:** Debes tener un alias registrado para configurar splits. Si no lo tienes, la pestaña te redirigirá a la sección de Alias.

---

#### 📝 Pestaña: Create Link (Crear Enlace de Pago / Orden Cerrada)

**Propósito:** Generar enlaces de cobro profesionales e inviolables.

**Opciones del Formulario:**

| Campo | Descripción | Obligatorio |
|---|---|---|
| **Concepto** | Texto libre que describe qué estás cobrando (ej: *"Reserva Apartamento 1 / Ref: 5543"*). **El comprador no puede modificar este campo.** | ✅ Sí |
| **Monto** | La cantidad exacta a cobrar (ej: `250.00`). Se bloquea en el enlace y no es modificable por el pagador. | ✅ Sí |
| **Token** | Selector entre SOL, USDC y EURC. Determina en qué moneda se realiza el cobro. | ✅ Sí |
| **Caducidad (TTL)** | Tiempo de vida del enlace de pago. Opciones: *15 minutos, 1 hora, 1 día, 1 semana.* Protege contra fluctuaciones de precio, falta de stock o clientes que demoran en completar. Pasado el tiempo, el enlace muestra "Expirado" y rechaza pagos. | ⚙️ Opcional |

**Resultado:**

Al pulsar *Generate*, el sistema:
1. Crea un registro seguro en la base de datos con todos los campos bloqueados.
2. Genera una **firma HMAC-SHA256** que sella los parámetros (alias + monto + token + orderId).
3. Produce dos elementos compartibles:
   - **🔗 Un enlace seguro** (URL con firma incluida) que puedes copiar y enviar por cualquier canal (WhatsApp, Telegram, email, chat).
   - **📱 Un código QR descargable** que codifica el mismo enlace, ideal para imprimir en facturas físicas, ponerlo en tu tienda o mostrarlo en pantalla durante un directo.

---

#### 💸 Pestaña: Send (Enviar Fondos)

**Propósito:** Enviar pagos a cualquier alias de UNIK o dirección de Solana.

**Campos del formulario:**

| Campo | Descripción |
|---|---|
| **Destinatario** | Puedes introducir un **alias** (ej: `maria`) o una **dirección directa de Solana** (44 caracteres). Si introduces un alias, el sistema resuelve la dirección de billetera automáticamente consultando la blockchain. |
| **Monto** | Cantidad a enviar. Se muestra el equivalente en tu moneda de preferencia (USD/EUR) en tiempo real según la cotización de SOL. |
| **Token** | Selector entre SOL, USDC y EURC. |
| **Nota / Concepto** | Mensaje opcional que se adjunta al pago. Se cifra usando la firma de la transacción (ver sección 6.2: Notas Compartidas). Solo el emisor y el receptor pueden leerla. |

**Funciones especiales:**

- **📷 Escáner QR:** Botón que activa la cámara de tu dispositivo para escanear un código QR de UNIK (generado por la pestaña *Create Link* de otro usuario). Decodifica automáticamente el alias, monto, token y concepto.
- **👥 Acceso Rápido desde Contactos:** Puedes ir a la pestaña Contactos, pulsar sobre un contacto, y el formulario de envío se rellenará automáticamente con su alias y dirección resuelta.
- **Activación de ATA:** Si el destinatario nunca ha recibido el token seleccionado (USDC/EURC), el sistema detecta que su *Associated Token Account (ATA)* no existe y le ofrece al remitente crearla en un paso previo (coste mínimo de ~0.002 SOL). Esto previene errores y pérdida de fondos.
- **Detección de Splits:** Si el destinatario tiene reglas de enrutamiento activas, el sistema automáticamente distribuye los fondos según su configuración. El pagador ve un desglose claro antes de confirmar.

---

#### 🗃️ Pestaña: History (Historial de Transacciones)

**Propósito:** Tu libro mayor privado, legible y enriquecido.

A diferencia de Solscan u otros exploradores de bloques genéricos, aquí cada transacción se presenta en una tabla contable con contexto humano legible:

**Información mostrada por cada transacción:**

| Columna | Descripción |
|---|---|
| **Dirección / Estado** | Flecha indicando si fue un envío (↗️ salida) o una recepción (↙️ entrada). |
| **Contraparte** | Avatar y alias del otro participante (si está en tus contactos) o dirección truncada. |
| **Monto y Token** | Cantidad exacta y símbolo del token (SOL, USDC, EURC). Se muestra el equivalente en tu moneda de preferencia. |
| **Nota** | Si la transacción tiene una nota compartida asociada (cifrada), se descifra automáticamente usando la firma de la transacción y se muestra en texto claro. |
| **Fecha y Hora** | Marca temporal legible y formateada según tu idioma. |
| **Estado** | Completado ✅ / Fallido ❌ / Expirado ⏰. |
| **Firma (Signature)** | Enlace directo al explorador de Solana para verificar la autenticidad on-chain. |

**Carga de Datos:**
- El historial se obtiene directamente de la blockchain (no de la base de datos), garantizando que refleja la realidad on-chain.
- Las notas privadas y compartidas se descifran localmente después de cargar.
- Las transacciones se categorizan automáticamente mostrando si el monto fue un ingreso o un gasto.

---

#### 👥 Pestaña: Contacts (Libreta de Contactos Web3)

**Propósito:** Tu agenda criptográfica personal.

Es imposible aprenderse una dirección cripto de memoria, así que hemos construido una libreta de contactos nativa que transforma la experiencia:

**Funciones disponibles:**

- **➕ Añadir Contacto:** Introduce el alias de UNIK de la persona. El sistema lo resuelve contra la blockchain, verifica que existe, obtiene su dirección y lo guarda en tu libreta personal.
- **Vista de Contactos:** Cada contacto muestra:
  - Su avatar (foto de perfil pública).
  - Su alias.
  - Notas personalizadas que solo tú puedes ver (cifradas con tu clave de sesión).
  - Botón de acción rápida: **"Enviar"** → te lleva a la pestaña *Send* con el destinatario ya rellenado.
- **📝 Notas por Contacto:** Puedes añadir una nota privada a cada contacto (ej: *"Compañero del proyecto Alpha"*, *"Proveedor de cajas"*). Estas notas están cifradas con tu clave personal y solo tú puedes leerlas.
- **🗑️ Eliminar Contacto:** Elimina un contacto de tu libreta. Requiere confirmación por modal.
- **🔗 Compartir tu Contacto:** Desde la pestaña Alias, puedes generar un enlace `unikpay.xyz/add-contact/tu-alias` que al ser pulsado por otra persona, les añade tu tarjeta directamente a su libreta.

**Almacenamiento:**
- Toda la libreta de contactos se almacena como un blob cifrado **AES-256-GCM** en Supabase (E2E encrypted). El servidor solo ve una cadena de texto ilegible.
- En caso de no tener sesión cifrada activa, se usa `localStorage` como fallback temporal.

---

### III. Recepción de Pagos: Dos Modalidades

UNIK ofrece dos formas complementarias de cobrar dinero:

#### Modalidad 1: Pago Abierto (Open Tip / Donación)

Comparte la URL general:

```
unikpay.xyz/pay/TuAlias
```

El cliente entra, verá tu foto de perfil atractiva y el entorno estético de UNIK, y **él mismo rellenará los campos**:
- Elige el importe libre (donación, propina o pago sin monto fijo).
- Selecciona la moneda con el selector (SOL, USDC, EURC).
- Puede adjuntar una nota motivacional (ej: *"¡Gran Stream el de hoy!"*).

Ideal para: propinas, donaciones, pagos informales entre amigos.

#### Modalidad 2: Orden Cerrada (Invoice / Factura)

El generador que creas en la pestaña *Create Link*. Es una factura digital inamovible:
- Muestra la cantidad bloqueada (ej: **40.00 USDC**) con el concepto fijo.
- El cliente solo puede conectar su billetera y autorizar el pago exacto. No puede modificar ni el monto ni el concepto.
- Un candado verde (🔒) confirma visualmente que la firma HMAC es válida y los parámetros no han sido alterados.
- Si el enlace ha expirado (TTL caducado), se muestra un banner rojo indicando que la orden ya no es válida.

Ideal para: e-commerce, facturas, cobros por servicios profesionales.

---

### IV. Previsualizaciones Sociales (OpenGraph Dinámico)

Cuando compartes un enlace de pago de UNIK por WhatsApp, Telegram, Twitter u otra plataforma social, el sistema genera automáticamente una **imagen de previsualización (OG Image)** dinámica y personalizada que incluye:

- El avatar del receptor.
- Su alias.
- El monto y token (si es una orden cerrada).
- El concepto (si existe).
- El branding de UNIK.

Esto transforma un simple enlace en una **tarjeta visual profesional** que inspira confianza y facilita la identificación inmediata de qué se está pagando y a quién.

---

## 7. Limitaciones Actuales y Restricciones de Sistema

Para asegurar la robustez a nivel protocolo, debes conocer estas fronteras del sistema:

| # | Restricción | Detalle |
|---|---|---|
| 1 | **Red Exclusiva: Solana** | UNIK opera al 100% y en exclusiva sobre la blockchain de Solana (alta velocidad, bajas comisiones, finalidad en ~400ms). |
| 2 | **Tokens Admitidos** | SOL nativo + stablecoins SPL oficiales: **USDC** y **EURC**. No se soportan memecoins ni tokens arbitrarios para proteger al usuario. |
| 3 | **5 Destinos Máximo por Split** | Existe un techo técnico ligado al *Compute Budget* de Solana y al tamaño de las instrucciones Anchor. Máximo 5 reglas/carteras simultáneas por Alias. |
| 4 | **Solo Phantom en Móvil** | En teléfonos y tabletas, la webapp redirige forzosamente al navegador de la app Phantom. Navegadores genéricos (Chrome/Safari) no soportan extensiones web3 en móvil y, por tanto, no pueden interactuar con la blockchain directamente. |
| 5 | **Firma Obligatoria para Cifrado** | Para acceder a datos privados (contactos, notas, avatar cifrado), el usuario debe firmar un mensaje de derivación de clave al inicio de cada sesión. Sin esta firma, los datos cifrados en la nube no son accesibles (pero la app sigue funcional con datos locales). |

---

## 8. Seguridad Implementada

| Medida | Descripción |
|---|---|
| 🔐 **E2E Encryption** | AES-256-GCM con PBKDF2 (600K iteraciones). Datos cifrados antes de salir del navegador. |
| 🛡️ **HMAC-SHA256** | Firmas criptográficas en todos los enlaces de orden de pago para evitar manipulación de parámetros. |
| ⏱️ **TTL / Expiración** | Los enlaces de pago caducan según el tiempo configurado (15 min – 1 semana). |
| 🚦 **Rate Limiting** | Protección activa contra ataques de fuerza bruta (~5-30 req/min según endpoint). Caché en memoria + respaldo en base de datos. |
| 🧹 **Input Sanitization** | Validación y saneamiento de todas las entradas del usuario para prevenir XSS e inyección de código. |
| 🔑 **Non-Custodial** | UNIK nunca tiene acceso a las claves privadas ni a los fondos. Los Smart Contracts ejecutan, no custodían. |
| 🪪 **PDA Uniqueness** | Los alias son únicos e inmutables en la blockchain gracias al sistema de Program Derived Addresses de Solana. |
| ✅ **ATA Idempotente** | Las cuentas de token asociadas se crean automáticamente si no existen, evitando pérdida de fondos hacia billeteras "vírgenes". |
| 🔄 **Replay Protection** | Las firmas de transacciones procesadas se registran para prevenir doble gasto (`processed_signatures`). |

---

**Última actualización:** Marzo 2026
**Versión del Protocolo:** 1.2
**Estado:** ✅ Producción (Mainnet de Solana)
**Sitio Web:** [unikpay.xyz](https://unikpay.xyz)
