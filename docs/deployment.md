# Production deployment record

## ASENDEX Beta v4

Deployed: **2026-09-17**

Production URL:

`https://asendex-testnet-beta.vercel.app/`

Vercel deployment ID:

`dpl_J1BHWZixHJBniyBpwxNxJo2EeD2Q`

Deployment-specific URL:

`https://asendex-testnet-beta-pym156b9t.vercel.app/`

Network:

- Asentum Testnet
- Chain ID: `1423`

Application fee:

- ASENDEX: `0.10%` (`10 bps`)
- Fee asset: native ASE
- Treasury: `ase16qnk8kgjajray9dltuauf8a7jzjtt0ul5rwqxm`
- Auras pool fee is separate
- Current Beta v4 fee flow is two-step and requires a second explicit wallet approval after a confirmed swap
- Reverted swaps do not request the ASENDEX fee

Production smoke checks completed after deployment:

- Root application: HTTP `200`
- `/api/read?mode=network`: HTTP `200`, Chain ID `1423`
- `/api/read?mode=pairs`: HTTP `200`, current Auras pairs returned
- Native ASE balance endpoint accepted an `ase1...` address and returned a live balance
- Production `/app.js` exposes the documented treasury and `10 bps` fee configuration

## Transparency note

The GitHub repository is the public source and policy record for ASENDEX. Vercel receives a production deployment artifact from the same Beta v4 implementation. Any fee-rate or treasury change should be documented in GitHub before a production rollout.

ASENDEX remains experimental, unaudited, testnet-only software and is not an official Asentum product.
