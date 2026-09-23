# ASENODE Mobile Operator

Android controller for an official Asentum validator running on Ubuntu/Debian VPS.

## What it does
- SSH connection from Android using trust-on-first-use host-key pinning.
- Validator dashboard commands: status, balance, earnings, logs, start, stop, restart, update.
- Interactive terminal that launches the official Asentum VPS installer.
- Existing-validator migration: import `validator.key` with Android file picker and upload it directly over SFTP to `/opt/asentum/data/validator.key`.
- Does not store the imported validator key.

## Important
This app is a mobile Operator/controller. It deliberately does **not** reimplement Asentum consensus. The actual validator process is the official Asentum node software running on the VPS.

If migrating a validator with an existing 500 ASE bond, stop the old node first and use the same `validator.key`. Never run the same validator key on two machines simultaneously.

## Build
```bash
gradle -p asenode-mobile :app:assembleDebug
```

APK: `asenode-mobile/app/build/outputs/apk/debug/app-debug.apk`

Version: 0.1.0-beta
