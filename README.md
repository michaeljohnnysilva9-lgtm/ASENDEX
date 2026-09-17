# ASENDEX

**Community DeFi interface & network observatory for the Asentum testnet**

[![Network](https://img.shields.io/badge/Asentum-Testnet-blue)](https://www.asentum.com/)
[![Chain](https://img.shields.io/badge/Chain-1423-6f42c1)](https://explorer.asentum.com/)
[![Status](https://img.shields.io/badge/status-experimental-orange)](#project-status)
[![Community](https://img.shields.io/badge/community-built-brightgreen)](#independence--disclaimer)

ASENDEX is an independent, community-built testnet project for experimenting with decentralized exchange UX, Auras AMM routing, transaction verification and independent Asentum network observability.

> **Independent project:** ASENDEX is not an official Asentum product and does not claim endorsement, partnership or sponsorship by Asentum or its team.

## Live application

**ASENDEX Testnet:** https://asendex-testnet-beta.vercel.app/

## Current beta features

- Live testnet swaps routed through Auras AMM
- Real wallet balances for ASE and discovered testnet tokens
- Insufficient-balance protection
- Slippage and minimum-received protection
- Estimated price impact and thin-liquidity warnings
- Quote-expiry and price-movement guardrails
- `CONFIRMED / REVERTED` receipt status
- Transaction hash, block, gas and actual output display when verifiable
- Local Activity history with receipt refresh
- Public treasury disclosure and transparent ASENDEX fee flow
- Independent chain/RPC observability

## ASENDEX fee — testnet beta

The current ASENDEX application fee is **0.10% (10 bps)**, denominated in native ASE.

**Public treasury:**

`ase16qnk8kgjajray9dltuauf8a7jzjtt0ul5rwqxm`

The Auras pool fee is separate and is displayed independently.

### Important: current beta is a two-step fee flow

ASENDEX does **not** charge its fee before the swap. The swap is sent first and ASENDEX waits for the on-chain receipt. Only after a successful swap does the wallet request a second explicit approval for the 0.10% ASENDEX fee transfer.

If the swap reverts, no ASENDEX fee is requested. If the user rejects the separate fee approval, the already-confirmed swap remains valid and the fee is recorded as unpaid in the local Activity view.

This is intentionally transparent and non-atomic while an ASENDEX Router is being researched and tested. See [`docs/fees.md`](docs/fees.md).

## Planned atomic router

The intended production design is:

`User → ASENDEX Router → Auras AMM → User`

with the ASENDEX protocol fee sent to the public treasury only as part of a successful routed execution.

ASENDEX will not claim this router is live until Asentum inter-contract calls, native ASE value forwarding and Auras integration have been verified on-chain under the current runtime.

## Network Observatory

ASENDEX Network Observatory is designed to verify network behavior independently of a single explorer frontend.

| Signal | Purpose |
| --- | --- |
| Chain ID | Confirm the network being queried |
| Head / block height | Verify chain progression |
| Latest block hash | Compare canonical history |
| Block timestamp | Detect stale heads |
| Block time | Measure production cadence |
| RPC latency | Measure endpoint responsiveness |
| Multi-endpoint hash comparison | Detect persistent divergence/forks |
| Reorg events | Detect canonical-history changes |
| Validator/committee data | Show signing/participation when publicly verifiable |
| ASENDEX transactions | Verify application-level network use |

When a metric cannot be independently obtained, ASENDEX should display **NOT PUBLICLY VERIFIABLE** rather than estimate or invent a value.

## Verification philosophy

A frontend saying `LIVE` is not sufficient proof by itself. Stronger evidence comes from observations that agree with each other:

`RPC reachable → head advances → blocks have valid timestamps/hashes → transactions settle → receipts confirm → application state persists`

## Security model

- ASENDEX never requests or stores private keys.
- Every write is signed by the user's Asentum wallet.
- The beta fee transfer requires an explicit wallet approval.
- Testnet assets and contracts may be reset by the network.
- ASENDEX is unaudited experimental software.
- Do not send mainnet assets to testnet contracts or addresses expecting testnet behavior.

See [`SECURITY.md`](SECURITY.md) for security reporting.

## Repository structure

```text
ASENDEX/
├── README.md
├── CHANGELOG.md
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── api/
│   └── read.js
├── public/
│   ├── index.html
│   ├── app.js
│   ├── network-observatory.html
│   └── network-observatory.js
└── docs/
    ├── architecture.md
    ├── asentum-network.md
    ├── fees.md
    ├── network-observatory.md
    └── testnet-results.md
```

## Project status

ASENDEX is experimental testnet software. Contracts, addresses, liquidity, RPC endpoints and chain state may change or be reset during Asentum testnet development.

## Builder evidence

ASENDEX keeps a public builder log with reproducible testnet observations, incidents, limitations and upstream references:

- [Builder Log](docs/builder-log.md)
- [GitHub Issues](https://github.com/michaeljohnnysilva9-lgtm/ASENDEX/issues)

The goal is to make technical contribution independently reviewable rather than relying on self-reported activity.

## For the Asentum team and builders

The goal of publishing ASENDEX is transparency and collaboration. Successful transactions, reproducible failures, RPC behavior, network observations and integration issues should be documented so they can be independently reviewed.

Issues and pull requests are welcome for technical corrections and improvements.

## Independence & disclaimer

ASENDEX is independently developed by a community participant. References to Asentum, ASE, Auras and related infrastructure identify the network and protocols being tested and do not imply partnership, sponsorship, endorsement or official status.

Testnet software is inherently experimental. Nothing in this repository is financial advice.
