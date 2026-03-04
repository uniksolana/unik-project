# UNIK Protocol — Full Documentation

> **The Intelligent Non-Custodial Payment Router on Solana**

---

## 1. What is UNIK?

**UNIK (UnikPay)** is an intelligent, non-custodial payment infrastructure built on the Solana blockchain. Its mission is to transform the complex experience of sending and receiving cryptocurrency into a process as simple and friendly as sending an email, a WhatsApp message, or making a Venmo/Bizum transfer, while adding advanced routing capabilities and automatic fund splitting (**Auto-Splits**) for businesses, creators, and everyday users.

Unlike web2 payment processors (like PayPal or Stripe) that hold and control user funds, UNIK is **100% Non-Custodial**. UNIK's smart contracts never touch, pause, or freeze money in bridge wallets; they simply instruct the blockchain on how and where capital should flow from point A to point B in milliseconds.

---

## 2. The Problem It Solves

Mass adoption of crypto as an everyday payment method faces severe friction that UNIK completely eliminates:

| Problem | Description |
|---|---|
| ❌ **Unmanageable Addresses** | Sending payments to 44-character addresses (e.g., `7xQ2...Y9P`) creates confusion, stress, and is prone to catastrophic human errors resulting in total loss of funds. |
| ❌ **Impossible Reconciliation** | Receiving crypto transfers without an attached "concept" or memo makes it nearly impossible for a freelancer or store to know *who* paid for *what*. |
| ❌ **Manual Splits** | Splitting income among partners or suppliers means receiving into a centralized wallet and sending manual transfers one-by-one, wasting time and paying extra fees. |
| ❌ **Unreadable History** | Exploring transactions on a traditional block explorer (like Solscan) is incomprehensible to the average user and doesn't reveal the private details of the business agreement. |
| ❌ **Social Disconnect** | Users have no native, easy way to remember the recurring addresses of their friends or clients. |
| ❌ **Mobile Friction** | Web3 links often fail when opened from mobile phone browsers (no wallet extensions available). |

---

## 3. How Does the Solution Work?

UNIK solves these critical pain points through three main technological innovations:

### A. Universal Aliases (Human-Readable Names)

Users can claim a **unique, short alias** (e.g., `@maria`, `@mystore`). Each alias is cryptographically paired to their real wallet through a *Program Derived Address (PDA)* on the Solana blockchain.

When collecting payment, instead of sharing a cumbersome public key, they simply share their link:

```
unikpay.xyz/pay/mystore
```

The system resolves the alias to the real wallet transparently, instantly, and verifiably.

### B. Auto-Splits on Chain (Active Routing)

An alias owner can define **"Routing Rules"**. For example, they can configure any money received by `@mystore` to be split instantly at the moment of purchase:

| Destination | Percentage |
|---|---|
| 🏦 Main Wallet (Owner) | **60%** |
| 📦 Supplier Wallet | **30%** |
| 🏛️ Tax Reserve | **10%** |

The payer (customer) makes **a single transaction**, and UNIK's Smart Contract (deployed on Solana) atomically distributes the money to all destination wallets in real time, with no intermediaries. Network fees (*gas fees*) are paid only once in the base transaction.

### C. HMAC-Validated Payment Links (Anti-Tampering Security)

UNIK allows creating tamper-proof invoices or payment orders. For example:

```
unikpay.xyz/pay/alias?amount=50&token=USDC&concept=Consulting
```

To prevent a customer or attacker from maliciously modifying the URL before paying (e.g., changing `amount=50` to `amount=1`), every payment order link is validated by an **HMAC-SHA256 Cryptographic Signature**. If the signature doesn't exactly match the parameters issued by the creator, the system rejects and blocks the payment instantly, ensuring total security for e-commerce platforms.

---

## 4. Who is it For?

| Profile | Use Case |
|---|---|
| 🎨 **Content Creators / Streamers** | Receive donations or tips during livestreams (with hyper-aesthetic QR codes) and automatically split income with moderators, agencies, or video editors. |
| 🛒 **E-Commerce & Web3 Retail** | Integrate fast crypto payments in seconds, receive instant payments (immediate stablecoin liquidity) and minimize traditional bank fees to 0%. HMAC validation ensures which exact product was paid for. |
| 💼 **Freelancers & Agencies** | Generate a professional, presentable link to embed in PDF invoices. When the invoice is paid, income is automatically split according to each freelancer's project participation. |
| 👥 **Everyday Users** | Day-to-day payments with family, friends, splitting restaurant bills, or sharing subscriptions (thanks to the integrated web3 contact book). |

---

## 5. Technology & Architecture (The UNIK Stack)

UNIK is not just a frontend; it's a complete system of interconnected infrastructures.

### 5.1. Smart Contracts (Rust / Anchor Framework)

The on-chain divisible transfer logic is powered by efficient programs deployed on Solana. The smart contract uses:

- **SPL Token Program** for standard token transfers (USDC, EURC).
- **Idempotent `getOrCreateAssociatedTokenAccount` instructions** that protect transactions to "virgin" wallets that don't yet hold the token. This means if a recipient has never received USDC, the system automatically creates their Associated Token Account (ATA) before sending, preventing failures and fund loss.
- **Program Derived Addresses (PDAs)** to guarantee that aliases are unique and immutable on the blockchain, impossible to spoof.

**Contract Instructions:**

| Instruction | Description |
|---|---|
| `register_alias` | Registers a unique alias, binding it to a wallet. Stored as a PDA, impossible to duplicate. |
| `set_route_config` | Defines split rules (up to 5 destinations). Each with a percentage in *basis points* (100% = 10000). |
| `execute_transfer` | Executes the payment and atomically distributes funds according to configured rules. |

### 5.2. Frontend & Backend (Next.js / React / TailwindCSS)

An ultra-responsive user interface (UI) with a "Premium" aesthetic design, fluid and agile, built on the **Vercel / Next.js** ecosystem. API routes (`/api/*`) function as serverless functions that orchestrate:

- HMAC signatures for payment order validation.
- Communication with Supabase for metadata read/write.
- Dynamic OpenGraph image generation for social previews.
- Rate limiting (DDoS attack protection).

### 5.3. Private Database (Supabase / PostgreSQL)

Supabase hosts the UI enrichment metadata. It's important to note that **the database never stores money, private keys, or balances**. It only contains:

| Table | Content |
|---|---|
| `profiles` | Preferred language, preferred currency, and wallet address. |
| `payment_orders` | Payment orders with concept, amount, token, HMAC signature, status, and expiration date. |
| `user_encrypted_data` | E2E encrypted blobs (contacts, notes, private avatar). The server only sees unreadable text. |
| `transaction_notes` | Encrypted shared notes between sender and recipient (see Encryption section). |
| `rate_limits` | Per-IP counters to protect APIs from brute force attacks. |
| `processed_signatures` | Registry of already-processed transaction signatures to prevent double spending or replay. |
| `legal_consents` | Terms and conditions acceptance per wallet. |

### 5.4. Exclusive Mobile Deep-Linking (Phantom Focus)

To guarantee 100% effectiveness and zero friction in web3 transactions from *Smartphones*, UNIK intelligently intercepts any mobile landing and employs a native Universal Link redirector:

```
https://phantom.app/ul/v1/browse?url=<your_url>&ref=<reference>
```

This pushes all navigation and payment execution directly into Phantom wallet's *maximum security* internal browser. If the user doesn't have Phantom installed, they'll be automatically directed to download it from the corresponding app store (App Store / Google Play).

**Smart environment detection:**
- If the user is already *inside* the Phantom app (in-app browser), the system detects it and **does not** show the redirect prompt.
- If the user accesses the landing page (`/`) or documentation (`/docs`), the redirect prompt **does not appear**, allowing them to read informational content first.

---

## 6. 🔐 Encryption & Privacy System

UNIK implements a multi-layer encryption system designed so that **not even server administrators can read users' private data**. Below are the three encryption levels that operate simultaneously:

### 6.1. Personal Data Encryption (Notes, Contacts, Private Avatar)

**Algorithm:** AES-256-GCM (Galois/Counter Mode)
**Key Derivation:** PBKDF2 with 600,000 iterations + SHA-256

**How does it work?**

1. **Secure Login:** When the user connects their wallet for the first time in a session, UNIK asks them to sign a unique, predictable message ("UNIK Encryption Key Derivation"). This signature is used as a *seed* to generate an AES-256 symmetric key.
2. **Key Derivation:** The user's signature is mixed with their public key (`unik-v2-<publicKey>`) using PBKDF2 with **600,000 iterations** of SHA-256. This produces an extremely robust AES-256 cryptographic key that is virtually impossible to brute-force.
3. **Local Encryption:** All sensitive information (transaction notes, contact list, private profile photo) is encrypted **inside the user's browser** *before* leaving their device.
4. **Blind Storage:** The Supabase server receives and stores only encrypted binary blobs (*ciphertext*). A database administrator accessing the `user_encrypted_data` table directly would only see unreadable strings like `dWsfR3kQ...==`.
5. **Destination Decryption:** When the user logs back in (on the same device or another), the key is re-derived by requesting the same signature, and data is decrypted locally in their browser.

**Flow diagram:**

```
┌─────────────┐   Signature  ┌──────────────┐   PBKDF2    ┌──────────────┐
│   Phantom   │─────────────►│  Message:    │────────────►│ AES-256 Key  │
│   Wallet    │              │  "UNIK..."   │  600K iter  │  (in RAM)    │
└─────────────┘              └──────────────┘             └──────┬───────┘
                                                                │
                             ┌──────────────┐  AES-GCM    ┌─────▼───────┐
                             │   Supabase   │◄────────────│ Encrypted   │
                             │ (blind blob) │  Encrypt()  │ in browser  │
                             └──────────────┘             └─────────────┘
```

> **Ephemeral key:** The session key is stored **exclusively in browser RAM** (`sessionState.ts`). It is never written to disk, `localStorage`, cookies, or sent to the server. When the browser tab is closed, the key disappears automatically and irretrievably.

### 6.2. Shared Transaction Notes (Messages between Sender & Recipient)

**Algorithm:** AES-256-GCM
**Key derived from:** The blockchain transaction signature (SHA-256)

Notes that a payer attaches when sending money (e.g., *"March rent payment"*) need to be readable by both sender and recipient. UNIK solves this without compromising privacy by using the transaction's own blockchain signature as a shared cryptographic key:

**How does it work?**

1. The payer writes a note when sending funds.
2. The transaction is sent to Solana and generates a **unique signature** (`signature`, e.g., `5UHk7...wQ3P`).
3. That signature is hashed with SHA-256 to generate an AES-256 key.
4. The note is encrypted with that key and stored in the `transaction_notes` database table.
5. Both sender and recipient know the transaction signature (it's public on the explorer), so both can derive the key and decrypt the note.

**Who can read the note?**
- ✅ The sender (knows the signature, they generated it).
- ✅ The recipient (sees the signature in their Solana transaction history).
- ❌ Server administrators (only see the encrypted blob, don't know the signature in context).
- ❌ Third parties without access to the signature.

### 6.3. Binary File & Image Encryption (Private Avatar)

**Algorithm:** AES-256-GCM over binary buffer

The user's avatar (profile photo) has a special dual-layer treatment:

| Layer | Type | Purpose |
|---|---|---|
| 🔒 **Private Copy** | Encrypted (E2E with user's session key) | Ensures the user always recovers their photo even when switching devices, using their wallet signature as a "password." |
| 🌐 **Public Copy** | Unencrypted (Supabase Storage) | Allows other users (contacts, payers) to see the profile photo without needing the owner's keys. |

**Avatar workflow:**

1. The user uploads an image.
2. The image is **automatically resized** to a maximum of 400×400px and compressed to 80% quality JPEG (to optimize storage).
3. It's converted to Base64 and saved as an encrypted private note (E2E encrypted).
4. Simultaneously, a public copy is uploaded to Supabase Storage (bucket `avatars`).
5. When loading the dashboard, the system looks for the avatar in this priority order:
   - **Local cache** (fastest, zero network).
   - **Encrypted private note** (syncs across devices if encrypted session is active).
   - **Public copy** (last resort/fallback if encryption hasn't been unlocked yet).

### 6.4. Smart Storage with Fallback

All personal data operations (contacts, notes, avatar) use a **"Smart Storage"** system that implements a *Facade* pattern with two backends:

```
┌────────────────────────────────┐
│       SmartStorage (Facade)    │
│ ┌───────────┐  ┌─────────────┐ │
│ │   Cloud   │  │    Local    │ │
│ │ Supabase  │  │ localStorage│ │
│ │(encrypted)│  │ (no network)│ │
│ └───────────┘  └─────────────┘ │
└────────────────────────────────┘
```

- **If the encryption session is active** (user signed the derivation message), data is read/written to the cloud (Supabase), E2E encrypted.
- **If the encryption session is unavailable** (user hasn't signed yet, or network error), data is stored temporarily in the browser's `localStorage` as a local fallback. It's functional but doesn't sync across devices.

---

## 📖 User Guide: Master UNIK Protocol

### I. Registration & Login

1. **Access** `unikpay.xyz` from your PC, or enter directly through Phantom Wallet's mobile "Explore" / "Browser" tab.
2. Click **Connect Wallet** or **Launch Dashboard →**. The platform will ask you to connect your Solana wallet (silent authentication signature). **Private keys never leave your device.**
3. **Encryption Unlock (once per session):** Upon connecting your wallet, a consent modal will ask you to sign a special message. This signature **costs no money and authorizes no transaction**; its sole purpose is to derive your personal encryption key to unlock your private data (contacts, notes, enriched history). If you decline the signature, the dashboard will still work but without access to your cloud-encrypted data.

### II. Dashboard Tabs (Control Panel)

Once inside, you have full access to the control panel, organized in the following tabs:

---

#### 🏷️ Tab: Alias

**Purpose:** Claim your unique name on the UNIK network.

**Detailed features:**

- **Check Availability:** Type a name of 3 to 20 alphanumeric characters (no spaces or special characters). The system checks in real time whether it's available by querying the blockchain.
- **Claim:** If the alias is available, click the *Claim* button. You'll be asked to sign a Solana transaction (with minimal gas cost, typically <$0.01) that registers the alias as a PDA on the blockchain, mathematically binding it to your wallet address permanently.
- **My Active Alias:** Once claimed, you'll see a panel with:
  - Your alias (`@name`) with a green visual indicator.
  - The exact registration date.
  - The associated wallet address (one-click copy).
- **Shareable Contact Card:** A link `unikpay.xyz/add-contact/your-alias` is automatically generated. When another person clicks it, they'll see your profile photo, alias, and a button to add you directly to their UNIK contact book. When shared via WhatsApp or Telegram, a beautiful **OpenGraph card** with an attractive visual preview of your profile will appear.
- **Delete Alias:** If you want to release your alias so someone else can claim it, you can delete it. This requires a Solana transaction that erases the PDA. The action is irreversible and requires explicit confirmation.

> **Important Note:** The alias is **optional** for basic UNIK usage (sending/receiving payments). However, it is **mandatory to enable Routing Rules (Auto-Splits)**, as the smart contract needs a registered alias to associate distribution rules.

---

#### ⚙️ Tab: Settings / Profile

Accessed by clicking the gear icon (⚙️) at the top of the dashboard. Opens a modal with the following sections:

**Avatar (Profile Photo):**
- Click the photo circle to **upload an image** from your device (accepts any image format: JPEG, PNG, WebP, etc.).
- The image is automatically resized to 400×400px and compressed to 80% JPEG quality to optimize storage.
- Stored using the dual-layer system explained in the Encryption section (private encrypted copy + public copy).
- If you don't upload any photo, a **default geometric avatar** will be generated.
- **Remove Photo:** If you have a registered alias, a *"Remove Photo"* button appears that deletes both the public and private encrypted copies.

**Display Name:**
- Set a real name or brand name that will appear alongside your alias throughout the interface and in shared contact cards.

**Global Preferences:**

| Preference | Available Options | Description |
|---|---|---|
| 🌐 **Language** | English (EN), Spanish (ES), French (FR) | Changes the language of the entire interface. Syncs with your cloud profile (Supabase) for cross-device consistency. |
| 💱 **Display Currency** | USD ($), EUR (€) | Changes the currency in which SOL equivalent prices are displayed. SOL price updates in real time every 60 seconds via CoinGecko (with Binance fallback if CoinGecko fails). |

**Technical Information:**
- Active Solana network (Devnet / Mainnet).
- Registered alias and registration date.
- Full wallet address.

---

#### 🔀 Tab: Routing / Splits (Active Routing)

**Purpose:** Configure automatic fund splitting for incoming payments.

**Detailed operation:**

1. **Initial State:** The table shows your **Main Wallet at 100%** as the sole recipient.
2. **Add Rule ("+ Add Rule"):**
   - Paste a valid Solana wallet address (44 characters, Base58 format).
   - Enter the numeric percentage (0-100%) you want that person to absorb from any payment directed to your Alias.
   - The system **automatically validates** that the address is a legitimate Solana public key before accepting it.
3. **Visual Distribution Table:** Each rule shows:
   - 🎨 A unique color indicator for each recipient.
   - The wallet address (truncated for readability, e.g., `7xQ2...Y9P`).
   - The assigned percentage.
   - A delete button (🗑️) for each added rule.
4. **Automatic Residual Percentage:** The main wallet always receives the remaining percentage. If you assign 30% to a third party, your main wallet automatically drops to 70%.
5. **Save Configuration:** Clicking *Save* generates a Solana transaction that stores the rules on-chain in a `RouteAccount` (PDA). This requires a wallet signature and minimal gas.

> **Requirement:** You must have a registered alias to configure splits. If you don't, the tab will redirect you to the Alias section.

---

#### 📝 Tab: Create Link (Create Payment Link / Closed Order)

**Purpose:** Generate professional, tamper-proof payment links.

**Form Options:**

| Field | Description | Required |
|---|---|---|
| **Concept** | Free text describing what you're charging for (e.g., *"Apartment Reservation 1 / Ref: 5543"*). **The buyer cannot modify this field.** | ✅ Yes |
| **Amount** | The exact amount to charge (e.g., `250.00`). Locked in the link and not modifiable by the payer. | ✅ Yes |
| **Token** | Selector between SOL, USDC, and EURC. Determines which currency the payment is collected in. | ✅ Yes |
| **Expiration (TTL)** | Payment link lifetime. Options: *15 minutes, 1 hour, 1 day, 1 week.* Protects against price fluctuations, out-of-stock situations, or clients who delay completion. After the time expires, the link shows "Expired" and rejects payments. | ⚙️ Optional |

**Result:**

Upon clicking *Generate*, the system:
1. Creates a secure record in the database with all fields locked.
2. Generates an **HMAC-SHA256 signature** that seals the parameters (alias + amount + token + orderId).
3. Produces two shareable elements:
   - **🔗 A secure link** (URL with embedded signature) you can copy and send through any channel (WhatsApp, Telegram, email, chat).
   - **📱 A downloadable QR code** encoding the same link, ideal for printing on physical invoices, placing in your store, or displaying on screen during a livestream.

---

#### 💸 Tab: Send (Send Funds)

**Purpose:** Send payments to any UNIK alias or Solana address.

**Form fields:**

| Field | Description |
|---|---|
| **Recipient** | You can enter an **alias** (e.g., `maria`) or a **direct Solana address** (44 characters). If you enter an alias, the system automatically resolves the wallet address by querying the blockchain. |
| **Amount** | Amount to send. Shows the equivalent in your preferred currency (USD/EUR) in real time based on the SOL price. |
| **Token** | Selector between SOL, USDC, and EURC. |
| **Note / Concept** | Optional message attached to the payment. Encrypted using the transaction signature (see section 6.2: Shared Notes). Only the sender and recipient can read it. |

**Special features:**

- **📷 QR Scanner:** Button that activates your device's camera to scan a UNIK QR code (generated by another user's *Create Link* tab). Automatically decodes the alias, amount, token, and concept.
- **👥 Quick Access from Contacts:** You can go to the Contacts tab, tap on a contact, and the send form will automatically fill in with their alias and resolved address.
- **ATA Activation:** If the recipient has never received the selected token (USDC/EURC), the system detects that their *Associated Token Account (ATA)* doesn't exist and offers the sender to create it in a prior step (minimal cost of ~0.002 SOL). This prevents errors and fund loss.
- **Split Detection:** If the recipient has active routing rules, the system automatically distributes funds according to their configuration. The payer sees a clear breakdown before confirming.

---

#### 🗃️ Tab: History (Transaction History)

**Purpose:** Your private, readable, enriched ledger.

Unlike Solscan or other generic block explorers, here each transaction is presented in a human-readable accounting table:

**Information shown per transaction:**

| Column | Description |
|---|---|
| **Direction / Status** | Arrow indicating if it was a send (↗️ outgoing) or a receive (↙️ incoming). |
| **Counterparty** | Avatar and alias of the other participant (if in your contacts) or truncated address. |
| **Amount & Token** | Exact amount and token symbol (SOL, USDC, EURC). Shows the equivalent in your preferred currency. |
| **Note** | If the transaction has an associated shared note (encrypted), it's automatically decrypted using the transaction signature and displayed in clear text. |
| **Date & Time** | Readable timestamp formatted according to your language. |
| **Status** | Completed ✅ / Failed ❌ / Expired ⏰. |
| **Signature** | Direct link to the Solana explorer to verify on-chain authenticity. |

**Data Loading:**
- History is obtained directly from the blockchain (not the database), ensuring it reflects on-chain reality.
- Private and shared notes are decrypted locally after loading.
- Transactions are automatically categorized showing whether the amount was income or expense.

---

#### 👥 Tab: Contacts (Web3 Contact Book)

**Purpose:** Your personal cryptographic address book.

It's impossible to memorize a crypto address, so we've built a native contact book that transforms the experience:

**Available features:**

- **➕ Add Contact:** Enter a UNIK alias. The system resolves it against the blockchain, verifies it exists, obtains their address, and saves it in your personal address book.
- **Contact View:** Each contact shows:
  - Their avatar (public profile photo).
  - Their alias.
  - Custom notes only you can see (encrypted with your session key).
  - Quick action button: **"Send"** → takes you to the *Send* tab with the recipient already filled in.
- **📝 Per-Contact Notes:** You can add a private note to each contact (e.g., *"Alpha project colleague"*, *"Box supplier"*). These notes are encrypted with your personal key and only you can read them.
- **🗑️ Delete Contact:** Removes a contact from your address book. Requires modal confirmation.
- **🔗 Share Your Contact:** From the Alias tab, you can generate a `unikpay.xyz/add-contact/your-alias` link that when clicked by another person, adds your card directly to their contact book.

**Storage:**
- The entire contact book is stored as an **AES-256-GCM** encrypted blob in Supabase (E2E encrypted). The server only sees an unreadable text string.
- If no encrypted session is active, `localStorage` is used as a temporary local fallback.

---

### III. Receiving Payments: Two Modes

UNIK offers two complementary ways to collect money:

#### Mode 1: Open Tip (Donation)

Share the general URL:

```
unikpay.xyz/pay/YourAlias
```

The customer enters, sees your attractive profile photo and UNIK's aesthetic environment, and **fills in the fields themselves**:
- Choose the free amount (donation, tip, or open-ended payment).
- Select the currency with the selector (SOL, USDC, EURC).
- Can attach a motivational note (e.g., *"Great stream today!"*).

Ideal for: tips, donations, informal payments between friends.

#### Mode 2: Closed Order (Invoice)

The generator you create in the *Create Link* tab. It's an immutable digital invoice:
- Shows the locked amount (e.g., **40.00 USDC**) with the fixed concept.
- The customer can only connect their wallet and authorize the exact payment. They cannot modify the amount or concept.
- A green lock (🔒) visually confirms that the HMAC signature is valid and parameters haven't been altered.
- If the link has expired (TTL exceeded), a red banner indicates the order is no longer valid.

Ideal for: e-commerce, invoices, professional service charges.

---

### IV. Social Preview Cards (Dynamic OpenGraph)

When you share a UNIK payment link via WhatsApp, Telegram, Twitter, or any social platform, the system automatically generates a **dynamic, personalized preview image (OG Image)** that includes:

- The recipient's avatar.
- Their alias.
- The amount and token (if a closed order).
- The concept (if exists).
- UNIK branding.

This transforms a simple link into a **professional visual card** that inspires trust and facilitates immediate identification of what is being paid and to whom.

---

## 7. Current Limitations & System Restrictions

To ensure protocol-level robustness, you should be aware of these system boundaries:

| # | Restriction | Detail |
|---|---|---|
| 1 | **Exclusive Network: Solana** | UNIK operates 100% exclusively on the Solana blockchain (high speed, low fees, ~400ms finality). |
| 2 | **Supported Tokens** | Native SOL + official SPL stablecoins: **USDC** and **EURC**. Memecoins and arbitrary tokens are not supported to protect users. |
| 3 | **5 Max Destinations per Split** | There is a technical ceiling tied to Solana's *Compute Budget* and Anchor instruction byte sizes. Maximum 5 simultaneous rules/wallets per Alias. |
| 4 | **Phantom Only on Mobile** | On phones and tablets, the webapp forcefully redirects to Phantom's app browser. Generic browsers (Chrome/Safari) don't support web3 extensions on mobile and therefore cannot interact with the blockchain directly. |
| 5 | **Mandatory Signature for Encryption** | To access private data (contacts, notes, encrypted avatar), the user must sign a key derivation message at the start of each session. Without this signature, cloud-encrypted data is inaccessible (but the app remains functional with local data). |

---

## 8. Implemented Security

| Measure | Description |
|---|---|
| 🔐 **E2E Encryption** | AES-256-GCM with PBKDF2 (600K iterations). Data encrypted before leaving the browser. |
| 🛡️ **HMAC-SHA256** | Cryptographic signatures on all payment order links to prevent parameter tampering. |
| ⏱️ **TTL / Expiration** | Payment links expire based on configured time (15 min – 1 week). |
| 🚦 **Rate Limiting** | Active protection against brute force attacks (~5-30 req/min depending on endpoint). In-memory cache + database backup. |
| 🧹 **Input Sanitization** | Validation and sanitization of all user inputs to prevent XSS and code injection. |
| 🔑 **Non-Custodial** | UNIK never has access to private keys or funds. Smart Contracts execute, not custody. |
| 🪪 **PDA Uniqueness** | Aliases are unique and immutable on the blockchain thanks to Solana's Program Derived Address system. |
| ✅ **Idempotent ATA** | Associated token accounts are automatically created if they don't exist, preventing fund loss to "virgin" wallets. |
| 🔄 **Replay Protection** | Processed transaction signatures are recorded to prevent double spending (`processed_signatures`). |

---

**Last Updated:** March 2026
**Protocol Version:** 1.2-beta
**Status:** 🧪 Development (Solana Devnet)
**Website:** [unikpay.xyz](https://unikpay.xyz)
