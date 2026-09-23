# Asentum Operator Mobile v0.2 Beta

Android controller for the **official Asentum validator** running on an Ubuntu/Debian VPS.

## Why controller instead of running consensus inside Android
The current official Operator is an Electron desktop app, while the validator core uses Node.js plus `classic-level`/LevelDB and long-lived background networking. Asentum does not currently publish a supported native Android validator package. This mobile app therefore keeps consensus on a supported Linux environment and controls it securely over SSH.

## Features
- Validator status / sync output
- Balance and earnings
- Start / stop / restart
- Official validator update
- Last 100 validator logs
- Password is never persisted
- TOFU SSH host-key pinning
- `validator.key` stays on the validator machine

## Existing bonded validator
To preserve an existing bonded identity, migrate the SAME `validator.key` to the Linux validator **with the Windows node fully stopped**. Never run the same validator key simultaneously on two machines.

## Server helper
`server/setup-restricted-user.sh` creates a restricted `asenode` SSH user that can execute only the validator control commands used by the Android app.

## Build
GitHub Actions builds the debug APK with Android Gradle Plugin 8.7.3 / Gradle 8.9 / JDK 17.
