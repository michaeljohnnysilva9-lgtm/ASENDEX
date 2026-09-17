# ASENDEX

**Community DEX & Network Observatory for the Asentum testnet**

[![Network](https://img.shields.io/badge/Asentum-Testnet-blue)](https://www.asentum.com/)
[![Chain](https://img.shields.io/badge/Chain-1423-6f42c1)](https://explorer.asentum.com/)
[![Status](https://img.shields.io/badge/status-experimental-orange)](#project-status)
[![Community](https://img.shields.io/badge/community-built-brightgreen)](#independence--disclaimer)

ASENDEX is an independent, community-built testnet project created to experiment with decentralized exchange infrastructure on Asentum and to provide transparent network observability.

> **Independent project:** ASENDEX is not an official Asentum product and does not claim endorsement by Asentum or its team.

## Live application

**ASENDEX Testnet:** https://asendex-testnet-beta.vercel.app/

## What ASENDEX is building

- Testnet token swaps and AMM experimentation
- Liquidity and transaction testing
- Independent Asentum network observability
- Block-production monitoring
- RPC availability and latency monitoring
- Fork/reorg detection through block-hash comparison
- Validator/committee visibility when exposed by public network interfaces
- Reproducible test results for builders and the community

## Network Observatory

The planned ASENDEX Network Observatory is designed to verify network behavior independently of a single explorer frontend.

It will monitor:

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

A web explorer saying `LIVE` is not sufficient proof by itself. Stronger evidence comes from independent observations that agree with each other:

`RPC reachable → head advances → blocks have valid timestamps/hashes → independent endpoints agree → transactions settle → application state persists → validators/signatures are verifiable`

## Project status

ASENDEX is experimental testnet software. Contracts, addresses, RPC endpoints and chain state may change or be reset during Asentum testnet development. Do not send mainnet assets or funds to testnet contracts.

## Repository structure

```text
ASENDEX/
├── README.md
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── docs/
│   ├── architecture.md
│   ├── asentum-network.md
│   ├── network-observatory.md
│   └── testnet-results.md
├── app/                 # application source (to be imported/reconstructed)
├── components/          # UI components
├── lib/                 # RPC and monitoring logic
├── contracts/           # testnet contracts when publishable
└── tests/               # reproducible network/application tests
```

## For the Asentum team and builders

The goal of publishing ASENDEX is transparency and collaboration. Network observations, reproducible failures, fork/reorg evidence, RPC behavior and successful test transactions can be documented here so that they can be independently reviewed.

Issues and pull requests are welcome for technical corrections and improvements.

## Independence & disclaimer

ASENDEX is independently developed by a community participant. References to Asentum, ASE and related infrastructure identify the network being tested and do not imply partnership, sponsorship, endorsement or official status.

Testnet software is inherently experimental. Nothing in this repository is financial advice.
