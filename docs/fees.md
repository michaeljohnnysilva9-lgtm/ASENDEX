# ASENDEX fee policy

Status: **experimental testnet beta**

## Current fee

ASENDEX uses a **0.10% (10 bps)** application fee for swaps routed through the ASENDEX interface.

- Fee asset: native **ASE**
- Treasury: `ase16qnk8kgjajray9dltuauf8a7jzjtt0ul5rwqxm`
- Fee rate: `10 / 10,000 = 0.10%`
- Auras pool fees are separate and are shown independently in the interface.

## Beta collection model

The current testnet implementation is intentionally conservative because ASENDEX has not yet deployed an audited atomic fee router.

1. The user reviews the Auras pool fee, slippage, minimum received, price impact and the estimated ASENDEX fee.
2. The swap is signed by the user's Asentum wallet and sent to the Auras AMM.
3. ASENDEX waits for the on-chain swap receipt.
4. If the swap reverts, **no ASENDEX fee is requested**.
5. If the swap is confirmed, the wallet presents a **second explicit approval** for the 0.10% fee transfer to the public treasury.
6. The fee transaction hash and status are recorded in ASENDEX Activity when available.

This means the current beta fee is **not atomic with the swap**. A user may reject the second wallet approval after a successful swap, in which case the swap remains successful and the fee is marked `UNPAID`. ASENDEX does not hide this limitation.

## Why not charge before the swap?

ASENDEX deliberately does not transfer the fee before the swap. A pre-swap transfer could leave a user paying an application fee even if the AMM swap later reverts.

## Planned atomic router

The intended production architecture is an ASENDEX Router that atomically executes the routed swap and protocol fee in one logical operation. Before activation, the implementation must validate Asentum inter-contract calling semantics, native ASE value forwarding to Auras and failure behavior on the current runtime.

The Asentum VM publicly describes asynchronous inter-contract calls, but ASENDEX will not claim an atomic router is live until that exact Auras/native-value path has been verified on-chain.

## Transparency rules

- The fee rate must be visible before signing.
- The treasury address must be public.
- Auras pool fees and ASENDEX fees must be displayed separately.
- A reverted swap must not create an ASENDEX fee request.
- Every fee payment must require wallet approval while the beta two-step model is active.
- Fee transaction hashes must be linkable to the Asentum Explorer.
- Any future fee-rate or treasury change must be documented in this repository before deployment.

## Mainnet

This policy is **testnet-only**. It does not authorize mainnet fees. Any mainnet fee model requires a separate review, security testing and clear release documentation.
