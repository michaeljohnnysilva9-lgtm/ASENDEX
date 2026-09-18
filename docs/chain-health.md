# ASENDEX Chain Health Sentinel

Status: **Beta v4.1 / Asentum testnet Chain 1423**

ASENDEX uses chain-health checks to reduce the risk of users submitting or resubmitting swaps while the Asentum testnet is stalled or public RPC heads disagree.

## Signals

The production read proxy checks:

- Chain ID
- Latest block number
- Latest block hash
- Parent hash
- Latest block timestamp
- Block age
- A secondary public RPC head when available
- Block-height divergence between the two public RPCs

## Timestamp normalization

During the 2026-09-17 launch-day stall, the latest block timestamp was observed as a millisecond-scale Unix value rather than second-scale Unix time.

ASENDEX therefore normalizes timestamps before calculating block age:

- second-scale timestamps are used directly;
- millisecond/microsecond-scale values are reduced to Unix seconds.

Without this normalization, a stale block could incorrectly appear to have an age of zero.

## Stall rule

A head is considered stale when its normalized block age exceeds **120 seconds**.

The Sentinel also marks network health as unsafe when public RPC heads disagree materially:

- Chain ID mismatch; or
- block-height difference greater than 2 blocks.

When unsafe, ASENDEX displays:

`NETWORK STALLED / UNHEALTHY`

and disables new swap submission.

## Recovery rule

After a client has observed a stall, ASENDEX does not immediately re-enable swaps after one apparently fresh observation.

It requires **three consecutive advancing block observations** before clearing the local recovery state.

This is intentionally conservative.

## Swap preflight

The swap button being enabled is not the only guard.

Immediately before a swap can be submitted, ASENDEX performs another network-health read. If the network is stalled, recovering or RPC heads materially disagree, the operation is stopped before the wallet call.

## Receipt timeouts

A receipt timeout is not proof that a transaction failed.

ASENDEX warns users not to immediately resubmit a pending transaction during a network incident.

## Limitations

- Secondary RPC comparison is best-effort and may be unavailable.
- A healthy head does not prove every service in the ecosystem is healthy.
- The 120-second threshold is an ASENDEX safety policy, not an official Asentum consensus parameter.
- Recovery state is client-side and intentionally conservative.
- Testnet resets may invalidate earlier contracts, pools or transaction assumptions.

## Independence

ASENDEX is an independent community project and is not affiliated with or endorsed by Asentum.
