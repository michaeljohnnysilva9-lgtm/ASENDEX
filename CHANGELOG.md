# Changelog

All notable ASENDEX testnet changes are documented here.

## [Beta v4.2] - 2026-09-18

### Added

- Wallet-approved testnet actions for transparent network testing: one 0.001 ASE self-transfer or a three-transfer batch.
- Explicit disclosure that ASENDEX does not determine or guarantee Asentum XP eligibility.
- Current production deployment synchronized with the public GitHub implementation.

### Fixed

- Network Observatory now consumes `blockTimestamp` / `blockAgeSeconds` from the Chain Health Sentinel instead of the obsolete `timestamp` field.
- Observatory now surfaces `STALLED / UNHEALTHY` and `RPC MISMATCH` from the same health model used by the swap safety gate.
- Native balance reads now canonicalize 20-byte hex wallet addresses to lowercase before querying the current Asentum `/balance` endpoint. This works around a reproducible upstream behavior where mixed-case and lowercase representations of the same address can return different balances.
- The obsolete `asendex-testnet.vercel.app` build is deprecated in favor of the canonical Beta URL.

### Safety / transparency

- A responsive RPC is not labeled healthy if the canonical head timestamp is stale.
- Both public heads agreeing on the same stale block is classified as a network stall, not an RPC mismatch.
- Test actions remain disabled while the Chain Health Sentinel reports the network unhealthy.

## [Beta v4.1] - 2026-09-17

### Added

- Chain Health Sentinel for Asentum Chain 1423.
- Latest block age, hash and parent-hash health data.
- Best-effort cross-check between two public RPC heads.
- Material RPC mismatch detection.
- Automatic swap disablement while the network is stale/unhealthy.
- Three advancing observations required after a locally observed stall before swaps are re-enabled.
- A second chain-health preflight immediately before swap submission.
- Public `docs/chain-health.md` documentation.
- ASE Utility panel in the live interface.

### Fixed

- Block timestamp normalization. The launch-day latest block exposed a millisecond-scale timestamp; treating it as Unix seconds could incorrectly calculate block age as zero.

### Transparency / incident response

- The Season 1 launch-day stall at block 15914 is preserved in the Builder Log and GitHub Issue #2.
- Receipt timeouts are not treated as proof of transaction failure and users are warned not to blindly resubmit.


## [Beta v4] - 2026-09-17

### Added

- Transparent ASENDEX application fee: **0.10% (10 bps)** in native ASE.
- Public treasury disclosure: `ase16qnk8kgjajray9dltuauf8a7jzjtt0ul5rwqxm`.
- Post-confirmation fee flow: fee approval is requested only after a successful swap receipt.
- Fee transaction hash/status inside Activity when available.
- Fee preview before swap for ASE-input and ASE-output routes.
- Balance protection that accounts for the ASENDEX fee when ASE is the input asset.
- Public fee-policy documentation in `docs/fees.md`.
- Expanded API read proxy for network, pairs, contract views, balances and receipts.

### Transparency / limitations

- The Beta v4 fee path is **two-step and non-atomic**.
- A successful swap remains successful if a user rejects the second fee approval.
- No fee is requested for a reverted swap.
- An atomic ASENDEX Router is planned only after current-runtime inter-contract and native ASE forwarding behavior has been verified with Auras.

## [Beta v3] - 2026-09-17

### Added

- Real token balances.
- Insufficient-balance protection.
- Confirmed/reverted receipt display.
- TX hash, block, gas and actual-output reporting.
- Price-impact and thin-liquidity warnings.
- Quote freshness checks.
- Local Activity history.

## Earlier testnet builds

Experimental ASENDEX builds validated wallet connectivity, Chain 1423 detection and swaps routed through Auras AMM. Earlier deployments may no longer represent the current chain state after testnet resets.
