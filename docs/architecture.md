# Architecture

ASENDEX is being published in two layers.

## Application layer

The existing live testnet deployment provides the user-facing DEX experiment. Its production source is not yet Git-linked, so this repository must not pretend to contain source code that has not been recovered and verified.

## Observatory layer

The Network Observatory is intentionally read-only and independent from wallet signing. Its components are:

1. RPC adapters — feature-detect supported read methods.
2. Block sampler — collect height, hash, parent hash and timestamps.
3. Consensus comparator — compare common-height hashes across independent endpoints.
4. Reorg detector — identify changes to previously observed canonical hashes.
5. Health engine — deterministic telemetry states with explicit evidence.
6. Validator adapter — consume only publicly verifiable validator/signature data.
7. ASENDEX adapter — verify contract/application state without holding keys.
8. Dashboard — present evidence, timestamps and limitations.

## Safety boundary

Monitoring code must remain read-only by default. Private keys, wallet seeds and validator keys must never be required for network-health monitoring.
