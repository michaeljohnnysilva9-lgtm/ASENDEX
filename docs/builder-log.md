# ASENDEX Builder Log

This log records verifiable ASENDEX contributions, test results, incidents and limitations while building on the Asentum testnet.

ASENDEX is an independent community project and is not affiliated with or endorsed by Asentum.

## 2026-09-17 — Season 1 launch-day chain stall corroboration

### Observation

ASENDEX production monitoring returned:

```json
{"ok":true,"chainId":1423,"blockNumber":15914}
```

at approximately **22:01 UTC** from:

`https://asendex-testnet-beta.vercel.app/api/read?mode=network`

At the same time, upstream issue `asentum-network/asentum-explorer#5` reported that both public RPC endpoints had remained at block 15914 for hours while pending transactions accumulated.

Upstream reference:
https://github.com/asentum-network/asentum-explorer/issues/5

ASENDEX tracking issue:
https://github.com/michaeljohnnysilva9-lgtm/ASENDEX/issues/2

### User-safety implication

While the head is not progressing, ASENDEX should treat receipt timeouts as a network-health problem rather than instructing users to resubmit. Repeated submission can create duplicate intent once the network recovers.

### Sentinel implementation

The launch-day incident led directly to **ASENDEX Chain Health Sentinel v1**:

1. stale-head detection using normalized block timestamps;
2. visible persistent-stall warning;
3. automatic swap disablement while unhealthy;
4. best-effort comparison of two public RPC heads;
5. recovery gate requiring three consecutive advancing observations after a locally observed stall;
6. a fresh chain-health preflight immediately before swap submission.

### Additional finding during implementation

The production network endpoint exposed the latest block timestamp as a millisecond-scale Unix value. The first implementation interpreted it as seconds, which could make a stale block appear to have an age of zero.

ASENDEX corrected the calculation by normalizing second/millisecond/microsecond-scale timestamps before deriving block age.

This is documented in `docs/chain-health.md`.

---

## 2026-09-17 — ASENDEX Beta v4

Shipped:

- Auras-routed testnet swaps;
- real wallet balances;
- slippage and minimum-received protection;
- price-impact warnings;
- quote freshness checks;
- receipt verification;
- local Activity history;
- transparent ASENDEX 0.10% testnet fee;
- public treasury disclosure;
- explicit post-confirmation fee approval;
- no ASENDEX fee request for reverted swaps.

Known limitation:

The current ASENDEX fee path is two-step and non-atomic. An atomic router is not claimed as live until Asentum inter-contract value-forwarding behavior with Auras has been verified on-chain.

See:
- `CHANGELOG.md`
- `docs/fees.md`

---

## Address-format / indexer observations

ASENDEX testing has encountered address-format inconsistencies between `ase1...` and `0x...` representations. Upstream issue `asentum-network/asentum-explorer#2` independently documents related inconsistencies in RPC/log behavior and address formats.

Upstream reference:
https://github.com/asentum-network/asentum-explorer/issues/2

ASENDEX should not claim priority for this finding. The useful contribution is to design fallbacks and reproducible diagnostics around the behavior.

---

## Contribution principles

ASENDEX will prioritize:

- reproducible evidence over claims;
- transaction hashes and block heights over screenshots;
- public limitations over hidden assumptions;
- user-safety guardrails during network incidents;
- upstream references when a problem is already known;
- GitHub history for every material release or incident.
