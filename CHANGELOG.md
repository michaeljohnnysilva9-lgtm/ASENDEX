# Changelog

All notable ASENDEX testnet changes are documented here.

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
