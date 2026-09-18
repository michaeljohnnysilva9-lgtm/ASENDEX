# Engineering Prompt — ASENDEX WALLET MOBILE

Build an Android-first non-custodial wallet for Asentum Testnet named **ASENDEX WALLET MOBILE**. Treat security and transaction correctness as release blockers, not polish.

## Product requirements
1. Import an existing Asentum wallet through a single **Private Key** field. The supported exported key is the deterministic 32-byte/64-hex Asentum private key; do not ask the user for a public key. Reject incompatible lengths instead of guessing cryptographic material.
2. Encrypt wallet material locally with AES-256-GCM and a memory-only unlocked signer. Auto-lock when backgrounded.
3. Add optional strong biometric/fingerprint unlock using Android BiometricPrompt and an AES key in Android Keystore. Never store the wallet password in plaintext.
4. Respect Android status bars, cutouts/notches, navigation bars and safe areas on modern Android devices.
5. Provide Home, Swap, Browser, Activity and Settings as first-class surfaces with a premium black/green ASENDEX visual language.
6. Integrate the live ASENDEX/Auras pool registry. Discover token contracts dynamically and retain known testnet fallback entries for AURA, NOVA, PULSE, ZEPH and ORB.
7. Implement native swap execution using the ASENDEX pool contract flow: quote, balance check, slippage/min-out, allowance/approve when needed, price-impact guard, network-health guard, swapExactIn, receipt confirmation, actual-output extraction and explicit ASENDEX fee handling only after a confirmed swap.
8. Let users search any 0x token contract, read symbol/name/decimals, add it locally, display balance and indicate whether an ASENDEX pool exists.
9. Keep a secure dApp browser with window.asentum compatibility. A dApp may see the address only after origin approval and every state-changing request must show a native confirmation dialog. Never expose private keys to web content.
10. Preserve readable local activity and browser recents without claiming they replace on-chain receipts.

## Quality gates
- Web assets must bundle successfully.
- Android Gradle build must complete on API 35.
- The APK must be installable and versioned.
- The current ASENDEX web experience must remain functional.
- Publish a visible **Download ASENDEX WALLET MOBILE** control on the ASENDEX site pointing to the current APK.
- Treat the app as TESTNET/BETA until an independent wallet security audit is completed.
