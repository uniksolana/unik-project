# Protocole UNIK — Documentation Complète

> **Le Routeur de Paiements Intelligent et Non-Custodial sur Solana**

---

## 1. Qu'est-ce que UNIK ?

**UNIK (UnikPay)** est une infrastructure de paiement intelligente et non-custodiale construite sur la blockchain Solana. Sa mission est de transformer l'expérience complexe d'envoi et de réception de cryptomonnaies en un processus aussi simple et convivial qu'un e-mail, un message WhatsApp ou un virement Lydia/Paylib, tout en ajoutant des capacités avancées de routage et de répartition automatique des fonds (**Auto-Splits**) pour les entreprises, créateurs et particuliers.

Contrairement aux processeurs de paiement web2 (tels que PayPal ou Stripe) qui retiennent et contrôlent les fonds des utilisateurs, UNIK est **100% Non-Custodial**. Les contrats intelligents d'UNIK ne touchent, ne gèlent et ne bloquent jamais l'argent ; ils se contentent d'indiquer à la blockchain comment et où le capital doit circuler d'un point A à un point B en quelques millisecondes.

---

## 2. Le Problème Résolu

L'adoption massive des cryptomonnaies comme moyen de paiement quotidien se heurte à des frictions sévères qu'UNIK élimine complètement :

| Problème | Description |
|---|---|
| ❌ **Adresses Ingérables** | Envoyer des paiements à des adresses de 44 caractères (ex : `7xQ2...Y9P`) crée de la confusion, du stress et est sujet à des erreurs humaines catastrophiques entraînant la perte totale des fonds. |
| ❌ **Réconciliation Impossible** | Recevoir des transferts crypto sans « concept » attaché rend presque impossible pour un freelance ou un commerce de savoir *qui* a payé *quelle* facture. |
| ❌ **Répartitions Manuelles** | Partager les revenus entre associés ou fournisseurs implique de recevoir dans un portefeuille centralisé et d'effectuer des transferts un par un, perdant du temps et payant des frais supplémentaires. |
| ❌ **Historique Illisible** | Explorer les transactions sur un explorateur de blocs classique (comme Solscan) est incompréhensible pour l'utilisateur moyen et ne révèle pas les détails privés de l'accord commercial. |
| ❌ **Déconnexion Sociale** | Les utilisateurs n'ont aucun moyen natif et simple de mémoriser les adresses récurrentes de leurs amis ou clients. |
| ❌ **Friction Mobile** | Les liens web3 échouent souvent lorsqu'ils sont ouverts depuis les navigateurs de téléphones mobiles (pas d'extensions de portefeuille web3). |

---

## 3. Comment Fonctionne la Solution ?

UNIK résout ces points de friction critiques grâce à trois innovations technologiques principales :

### A. Alias Universels (Noms Lisibles)

Les utilisateurs peuvent revendiquer un **alias unique et court** (ex : `@maria`, `@maboutique`). Chaque alias est lié cryptographiquement à leur portefeuille réel via une *Program Derived Address (PDA)* sur la blockchain Solana.

Pour encaisser, au lieu de partager une clé publique complexe, ils partagent simplement leur lien :

```
unikpay.xyz/pay/maboutique
```

Le système résout l'alias vers le portefeuille réel de manière transparente, instantanée et vérifiable.

### B. Auto-Splits On-Chain (Routage Actif)

Le propriétaire d'un alias peut définir des **« Règles de Routage »**. Par exemple, il peut configurer que tout argent reçu par `@maboutique` soit réparti instantanément au moment de l'achat :

| Destination | Pourcentage |
|---|---|
| 🏦 Portefeuille Principal (Propriétaire) | **60%** |
| 📦 Portefeuille Fournisseur | **30%** |
| 🏛️ Réserve Fiscale | **10%** |

Le payeur (client) effectue **une seule transaction**, et le Contrat Intelligent d'UNIK (déployé sur Solana) distribue atomiquement l'argent à tous les portefeuilles de destination en temps réel, sans intermédiaire. Les frais de réseau (*gas fees*) ne sont payés qu'une seule fois dans la transaction de base.

### C. Liens de Paiement Validés par HMAC (Sécurité Anti-Falsification)

UNIK permet de créer des factures ou ordres de paiement inviolables. Par exemple :

```
unikpay.xyz/pay/alias?amount=50&token=USDC&concept=Consultation
```

Pour empêcher un client ou un attaquant de modifier malicieusement l'URL avant de payer (ex : changer `amount=50` en `amount=1`), chaque lien d'ordre de paiement est validé par une **Signature Cryptographique HMAC-SHA256**. Si la signature ne correspond pas exactement aux paramètres émis par le créateur, le système rejette et bloque le paiement instantanément, garantissant ainsi une sécurité totale pour les plateformes e-commerce.

---

## 4. À qui s'adresse UNIK ?

| Profil | Cas d'Utilisation |
|---|---|
| 🎨 **Créateurs de Contenu / Streamers** | Recevoir des dons ou pourboires pendant les directs (avec des QR codes hyper-esthétiques) et répartir automatiquement les revenus avec modérateurs, agences ou monteurs vidéo. |
| 🛒 **E-Commerce & Retail Web3** | Intégrer des paiements crypto rapides, recevoir des paiements instantanés (liquidité immédiate en stablecoins) et minimiser les frais bancaires à 0%. La validation HMAC garantit quel produit exact a été payé. |
| 💼 **Freelances & Agences** | Générer un lien professionnel à intégrer dans les factures PDF. Lors du paiement, les revenus sont automatiquement répartis selon la participation de chaque freelance. |
| 👥 **Utilisateurs Quotidiens** | Paiements du quotidien avec famille et amis, partage de l'addition au restaurant ou d'abonnements (grâce au carnet de contacts web3 intégré). |

---

## 5. Technologie & Architecture (Le Stack UNIK)

UNIK n'est pas qu'un simple frontend ; c'est un système complet d'infrastructures interconnectées.

### 5.1. Contrats Intelligents (Rust / Anchor Framework)

La logique de transferts divisibles *on-chain* repose sur des programmes efficaces déployés sur Solana. Le contrat intelligent utilise :

- **SPL Token Program** pour les transferts de tokens standards (USDC, EURC).
- **Instructions idempotentes `getOrCreateAssociatedTokenAccount`** qui protègent les transactions vers des portefeuilles « vierges » ne possédant pas encore le token. Si un destinataire n'a jamais reçu d'USDC, le système lui crée automatiquement le compte de token associé (ATA) avant l'envoi.
- **Program Derived Addresses (PDAs)** pour garantir que les alias sont uniques et immuables sur la blockchain, impossibles à usurper.

**Instructions du Contrat :**

| Instruction | Description |
|---|---|
| `register_alias` | Enregistre un alias unique, le liant à un portefeuille. Stocké comme PDA, impossible à dupliquer. |
| `set_route_config` | Définit les règles de répartition (jusqu'à 5 destinations). Chacune avec un pourcentage en *basis points* (100% = 10000). |
| `execute_transfer` | Exécute le paiement et distribue atomiquement les fonds selon les règles configurées. |

### 5.2. Frontend & Backend (Next.js / React / TailwindCSS)

Une interface utilisateur (UI) ultra-réactive au design esthétique « Premium », fluide et agile, construite sur l'écosystème **Vercel / Next.js**. Les routes API (`/api/*`) fonctionnent comme des fonctions *serverless* qui orchestrent :

- Les signatures HMAC pour la validation des ordres de paiement.
- La communication avec Supabase pour la lecture/écriture des métadonnées.
- La génération dynamique d'images OpenGraph pour les aperçus sociaux.
- La limitation de débit (protection contre les attaques DDoS).

### 5.3. Base de Données Privée (Supabase / PostgreSQL)

Supabase héberge les métadonnées d'enrichissement UI. Il est important de noter que **la base de données ne stocke jamais d'argent, de clés privées, ni de soldes**. Elle ne contient que :

| Table | Contenu |
|---|---|
| `profiles` | Langue préférée, devise préférée et adresse du portefeuille. |
| `payment_orders` | Ordres de paiement avec concept, montant, token, signature HMAC, statut et date d'expiration. |
| `user_encrypted_data` | Blobs chiffrés E2E (contacts, notes, avatar privé). Le serveur ne voit que du texte illisible. |
| `transaction_notes` | Notes partagées chiffrées entre émetteur et destinataire (voir section Chiffrement). |
| `rate_limits` | Compteurs par IP pour protéger les APIs contre les attaques par force brute. |
| `processed_signatures` | Registre des signatures de transactions déjà traitées, pour prévenir la double dépense. |
| `legal_consents` | Acceptation des conditions d'utilisation par portefeuille. |

### 5.4. Deep-Linking Mobile Exclusif (Focus Phantom)

Pour garantir une efficacité à 100% et zéro friction dans les transactions web3 depuis les *Smartphones*, UNIK intercepte intelligemment tout atterrissage mobile et emploie un redirecteur Universal Link natif :

```
https://phantom.app/ul/v1/browse?url=<votre_url>&ref=<référence>
```

Cela pousse toute la navigation et l'exécution du paiement directement dans le navigateur interne de *sécurité maximale* du portefeuille Phantom.

---

## 6. 🔐 Système de Chiffrement et Confidentialité

UNIK implémente un système de chiffrement multicouche conçu pour que **même les administrateurs du serveur ne puissent pas lire les données privées des utilisateurs**.

### 6.1. Chiffrement des Données Personnelles (Notes, Contacts, Avatar Privé)

**Algorithme :** AES-256-GCM (Galois/Counter Mode)
**Dérivation de Clé :** PBKDF2 avec 600 000 itérations + SHA-256

**Comment ça marche ?**

1. **Connexion Sécurisée :** Lorsque l'utilisateur connecte son portefeuille pour la première fois dans une session, UNIK lui demande de signer un message unique. Cette signature est utilisée comme graine (*seed*) pour générer une clé symétrique AES-256.
2. **Dérivation de la Clé :** La signature de l'utilisateur est mélangée avec sa clé publique (`unik-v2-<publicKey>`) en utilisant PBKDF2 avec **600 000 itérations** de SHA-256. Cela produit une clé cryptographique AES-256 extrêmement robuste, virtuellement impossible à deviner par force brute.
3. **Chiffrement Local :** Toute information sensible (notes de transaction, liste de contacts, photo de profil privée) est chiffrée **dans le navigateur de l'utilisateur** *avant* de quitter son appareil.
4. **Stockage Aveugle :** Le serveur Supabase reçoit et stocke uniquement des blobs binaires chiffrés. Un administrateur de base de données ne verrait que des chaînes illisibles comme `dWsfR3kQ...==`.
5. **Déchiffrement à Destination :** Lorsque l'utilisateur se reconnecte, la clé est re-dérivée en demandant la même signature, et les données sont déchiffrées localement dans son navigateur.

> **Clé éphémère :** La clé de session est stockée **exclusivement dans la RAM du navigateur**. Elle n'est jamais écrite sur disque, dans le `localStorage`, les cookies, ni envoyée au serveur. En fermant l'onglet, la clé disparaît automatiquement et irrécupérablement.

### 6.2. Notes de Transaction Partagées (Obfuscation de Base de Données)

**Algorithme :** AES-256-GCM
**Clé dérivée de :** La signature publique de la transaction sur la blockchain (SHA-256)

Les notes qu'un payeur joint lors de l'envoi d'argent (ex : *« Loyer de Mars »*) doivent être lisibles par l'émetteur et le destinataire. Étant donné qu'un véritable chiffrement E2EE nécessiterait un échange de clés complexe, UNIK utilise la signature de la transaction pour ofusquer la note dans la base de données :

**Comment ça marche ?**

1. Le payeur écrit une note lors de l'envoi.
2. La transaction est envoyée sur Solana et génère une **signature publique**.
3. Cette signature est hachée avec SHA-256 pour générer une clé AES-256.
4. La note est chiffrée avec cette clé et stockée dans la table `transaction_notes`.
5. Au sein de l'interface UNIK, l'émetteur et le destinataire utilisent la signature de la transaction pour déchiffrer la note localement de manière transparente.

**Niveau de Confidentialité :**
Les notes partagées sont ofusquées dans notre base de données contre les regards indiscrets. En tant qu'administrateurs, nous ne voyons que du texte illisible (ciphertext). Cependant, Solana étant un réseau public, tout utilisateur avancé connaissant la signature publique exacte pourrait théoriquement dériver la clé et lire la note. N'utilisez pas ce champ pour des mots de passe ou des secrets critiques, utilisez-le pour des concepts descriptifs.

### 6.3. Chiffrement d'Images et Fichiers Binaires (Avatar Privé)

**Algorithme :** AES-256-GCM sur buffer binaire

L'avatar de l'utilisateur bénéficie d'un traitement spécial à double couche :

| Couche | Type | Objectif |
|---|---|---|
| 🔒 **Copie Privée** | Chiffrée (E2E avec clé de session) | Garantit la récupération de la photo même en changeant d'appareil. |
| 🌐 **Copie Publique** | Non chiffrée (Supabase Storage) | Permet aux autres utilisateurs de voir la photo de profil. |

**Flux de l'avatar :**

1. L'utilisateur télécharge une image.
2. L'image est **redimensionnée** automatiquement à 400×400px max et compressée en JPEG 80%.
3. Sauvegardée comme note chiffrée privée (E2E) + copie publique sur Supabase Storage.
4. Lors du chargement : Cache local → Note chiffrée → Copie publique (par ordre de priorité).

### 6.4. Stockage Intelligent avec Fallback

Toutes les opérations de données personnelles utilisent un système **« Smart Storage »** avec deux backends :

- **Session chiffrée active →** Cloud Supabase (chiffré E2E).
- **Session non disponible →** `localStorage` du navigateur (fallback local temporaire).

---

## 📖 Guide Utilisateur Complet

### I. Inscription et Connexion

1. **Accédez** à `unikpay.xyz` depuis votre PC, ou directement via l'onglet « Explorer » de Phantom Wallet mobile.
2. Cliquez sur **Connect Wallet** ou **Launch Dashboard →**. La plateforme vous demandera de connecter votre portefeuille Solana. **Les clés privées ne quittent jamais votre appareil.**
3. **Déverrouillage du Chiffrement (une fois par session) :** Un modal de consentement vous demandera de signer un message spécial. Cette signature **ne coûte rien et n'autorise aucune transaction** ; elle sert uniquement à dériver votre clé de chiffrement personnelle.

### II. Les Onglets du Tableau de Bord

---

#### 🏷️ Onglet : Alias

**Objectif :** Revendiquer votre nom unique sur le réseau UNIK.

- **Vérifier la Disponibilité :** Tapez un nom de 3 à 20 caractères alphanumériques. Le système vérifie en temps réel la disponibilité sur la blockchain.
- **Revendiquer :** Si disponible, signez une transaction Solana (coût minimal <0,01$) qui enregistre l'alias comme PDA.
- **Carte de Contact Partageable :** Un lien `unikpay.xyz/add-contact/votre-alias` est généré automatiquement avec aperçu OpenGraph.
- **Supprimer l'Alias :** Action irréversible nécessitant une confirmation explicite.

> **Note :** L'alias est **optionnel** pour l'utilisation basique mais **obligatoire pour les Auto-Splits**.

---

#### ⚙️ Onglet : Paramètres / Profil

**Avatar :** Téléchargez une image (JPEG, PNG, WebP). Redimensionnement automatique à 400×400px, compression JPEG 80%. Stockage double couche (chiffré + public).

**Préférences :**

| Préférence | Options | Description |
|---|---|---|
| 🌐 **Langue** | EN, ES, FR | Change la langue de toute l'interface. Synchronisé avec le cloud. |
| 💱 **Devise** | USD ($), EUR (€) | Change la devise d'affichage des prix SOL. Mise à jour en temps réel toutes les 60s. |

---

#### 🔀 Onglet : Routage / Splits

**Objectif :** Configurer la répartition automatique des fonds entrants.

1. **État Initial :** Votre portefeuille principal reçoit 100%.
2. **Ajouter une Règle :** Collez une adresse Solana valide + pourcentage (0-100%). Validation automatique.
3. **Tableau Visuel :** Indicateurs de couleur, adresses tronquées, pourcentages et boutons de suppression.
4. **Pourcentage Résiduel :** Le portefeuille principal reçoit automatiquement le reste. Le système UI et le Smart Contract valident que la somme des règles externes ne dépasse jamais 100% pour éviter les erreurs de calcul sur la blockchain.
5. **Sauvegarder :** Transaction Solana stockant les règles on-chain. Maximum 5 destinations.

---

#### 📝 Onglet : Créer un Lien (Ordre de Paiement)

| Champ | Description | Requis |
|---|---|---|
| **Concept** | Description du paiement. Non modifiable par le payeur. | ✅ |
| **Montant** | Montant exact. Verrouillé dans le lien. | ✅ |
| **Token** | SOL, USDC ou EURC. | ✅ |
| **Expiration (TTL)** | 15 min, 1h, 1 jour, 1 semaine. | ⚙️ Optionnel |

**Résultat :** Lien sécurisé HMAC-SHA256 + QR code téléchargeable.

---

#### 💸 Onglet : Envoyer

- **Destinataire :** Alias ou adresse Solana directe. Résolution automatique.
- **Montant :** Avec équivalent en devise préférée en temps réel.
- **Note :** Message optionnel chiffré (lisible uniquement par émetteur et destinataire).
- **📷 Scanner QR :** Décodage automatique alias/montant/token/concept.
- **Activation ATA :** Création automatique du compte token si nécessaire (~0,002 SOL), ce qui prévient l'échec des transactions et améliore l'expérience utilisateur, l'expéditeur couvrant automatiquement les frais de création.

---

#### 🗃️ Onglet : Historique

Livre comptable privé et lisible. Chaque transaction affiche : direction (↗️/↙️), contrepartie avec avatar, montant et token, note déchiffrée, date/heure, statut, et lien vers l'explorateur Solana.

---

#### 👥 Onglet : Contacts

Carnet d'adresses cryptographique personnel :
- **Ajouter :** Entrez un alias UNIK, résolution automatique sur la blockchain.
- **Notes Privées :** Ajoutez des notes chiffrées par contact (visibles uniquement par vous).
- **Envoi Rapide :** Un clic pour pré-remplir le formulaire d'envoi.
- **Stockage :** Blob AES-256-GCM chiffré E2E sur Supabase.

---

### III. Réception de Paiements : Deux Modes

#### Mode 1 : Pourboire Ouvert (Donation)

Partagez `unikpay.xyz/pay/VotreAlias` — le client choisit librement le montant, le token et peut ajouter une note.

#### Mode 2 : Ordre Fermé (Facture)

Facture numérique immuable avec montant verrouillé, concept fixe et validation HMAC (🔒).

---

### IV. Aperçus Sociaux (OpenGraph Dynamique)

Les liens partagés via WhatsApp, Telegram ou Twitter génèrent automatiquement une **carte visuelle** avec avatar, alias, montant, token et branding UNIK.

---

## 7. Limitations Actuelles

| # | Restriction | Détail |
|---|---|---|
| 1 | **Réseau : Solana** | UNIK fonctionne exclusivement sur Solana (~400ms de finalité). |
| 2 | **Tokens Supportés** | SOL + USDC + EURC uniquement. Pas de memecoins. |
| 3 | **5 Destinations Max** | Plafond technique lié au Compute Budget de Solana. |
| 4 | **Phantom sur Mobile** | Redirection obligatoire vers l'app Phantom sur téléphones. |
| 5 | **Signature Obligatoire** | Signature nécessaire par session pour accéder aux données chiffrées. |

---

## 8. Sécurité Implémentée

| Mesure | Description |
|---|---|
| 🔐 **Chiffrement E2E** | AES-256-GCM avec PBKDF2 (600K itérations). |
| 🛡️ **HMAC-SHA256** | Signatures cryptographiques sur tous les liens de paiement. |
| ⏱️ **TTL** | Expiration configurable des liens (15 min – 1 semaine). |
| 🚦 **Rate Limiting** | Protection contre les attaques par force brute. |
| 🔑 **Non-Custodial** | UNIK n'a jamais accès aux clés privées ni aux fonds. |
| ✅ **ATA Idempotent** | Création automatique des comptes token associés, garantissant des transactions fluides sans erreurs réseau. |
| 🔄 **Protection Replay** | Solana offre une protection anti-replay native au niveau du consensus. Notre registre agit au niveau applicatif pour éviter de traiter deux fois le même paiement. |

---

**Dernière mise à jour :** Mars 2026
**Version du Protocole :** 1.2-beta
**Statut :** 🧪 Développement (Solana Devnet)
**Site Web :** [unikpay.xyz](https://unikpay.xyz)
