# ASENDEX Network Observatory

## Objective

Provide an independent, read-only view of Asentum testnet health without treating a single explorer frontend as authoritative.

## Core probes

The monitor should query multiple independently operated RPC endpoints whenever they are available. For EVM-compatible JSON-RPC interfaces, candidate read-only probes include `eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `eth_syncing`, `net_peerCount` and `web3_clientVersion`. Support must be detected rather than assumed.

## Canonical-chain comparison

Comparing only the newest head can generate false alarms because nodes may receive blocks at slightly different times. The monitor should compare hashes at a common height behind the lowest observed head, for example `min(heads) - 2` where appropriate.

A divergence should not immediately be called a fork. Record endpoint, height, hash and time, repeat the observation, and raise a persistent-divergence warning only when disagreement survives the configured confirmation window.

## Block-production health

Maintain a rolling block sample and calculate median block time, p95 block time, head age, observed stalls and height progression. Preserve prior hashes long enough to identify a canonical-history change/reorg.

## Validator visibility

Validator/committee information must come from a documented public RPC/API or be derivable from verifiable block/signature data. If neither is available, display `NOT PUBLICLY VERIFIABLE`.

## ASENDEX application checks

Read-only application health can include deployed bytecode presence, configured AMM contract availability, balances/reserves where contract interfaces are known, and persistence of confirmed test transactions.

The monitor must never automatically sign transactions or hold private keys. Any state-changing test requires explicit user action.

## Suggested states

- `HEALTHY`: heads advancing and independent observations agree
- `DEGRADED`: chain reachable but one or more important probes are stale/unavailable
- `DIVERGENCE`: persistent same-height hash disagreement between independent nodes
- `STALLED`: no head progression beyond the configured block-time threshold
- `UNVERIFIABLE`: insufficient independent data to reach a conclusion

These states describe observed telemetry, not a claim about the entire network beyond the available evidence.
