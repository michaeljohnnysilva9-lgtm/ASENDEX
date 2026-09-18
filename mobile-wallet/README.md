# Asentum Wallet Mobile (Beta)

Android wallet + Web3 browser for AsentumChain. Black/neon-green UI, no preinstalled dApps, visited dApps only in Recent, per-origin connection permissions and per-transaction confirmation.

## Existing wallet import

The official `@asentum/sdk` supports two compatible import paths:

- 32-byte seed (hex), via `AsentumWallet.fromSeed(...)`.
- Dilithium3 secret key + public key (both hex), via `AsentumWallet.fromSecretKey(...)`.

Private key material must only be entered inside the APK. It is encrypted locally using PBKDF2-SHA256 + AES-256-GCM. The decrypted wallet exists only in memory while unlocked.

## DApp provider

The browser injects `window.asentum` with the official provider surface: `getAddress`, `connect`, `disconnect`, `sendTransfer`, `callContract`, `viewContract`, and `deployContract`. DApps run in a separate WebView from the local signer.

## Status

0.1.0-beta / Asentum testnet. Audit before using with assets of real-world value.
