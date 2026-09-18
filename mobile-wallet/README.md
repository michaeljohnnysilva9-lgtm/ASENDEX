# ASENDEX WALLET MOBILE

Android wallet beta for Asentum Testnet, built as a companion to ASENDEX.

## 0.2.0 beta
- Single-field import using the 32-byte Asentum Private Key (public key not requested in the UI).
- Password-encrypted local vault (AES-256-GCM / PBKDF2-SHA256).
- Optional strong biometric unlock backed by Android Keystore.
- Native ASENDEX swap interface with quotes, slippage, allowance, price-impact/risk checks and receipt confirmation.
- Live token/pool discovery from ASENDEX/Auras plus fallback entries for AURA, NOVA, PULSE, ZEPH and ORB.
- Search/add token by contract address.
- Web3 browser with `window.asentum`, per-origin connection permission and explicit transaction approvals.
- Android status-bar/cutout safe-area handling.
- Auto-lock when the app leaves the foreground.

## Security status
TESTNET / BETA. The build is intended for testnet evaluation. It has not received an independent wallet security audit and should not be treated as production custody software.

## Build
The GitHub Actions workflow `.github/workflows/asentum-mobile-build.yml` creates `ASENDEX-Wallet-Mobile-0.2.0-beta.apk`.
