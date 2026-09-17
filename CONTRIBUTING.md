# Contributing to ASENDEX

Contributions that improve reproducibility, network observability, safety and testnet usability are welcome.

## Good contributions

- RPC and block-production probes
- Multi-node block-hash comparison
- Reorg/fork detection
- Validator/committee adapters based on publicly verifiable data
- Transaction confirmation and revert reporting
- Balance and AMM-state verification
- Tests reproducing network or application failures
- Documentation corrections

## Evidence standard

Separate observations from interpretations. Include timestamps, chain ID, block height, block hash, transaction hash and endpoint/source where practical. Do not describe a network-wide outage from one failed local node alone.

If a value cannot be verified, label it as unavailable or `NOT PUBLICLY VERIFIABLE`.

## Pull requests

Keep changes focused, explain what was changed and how it was tested, and never include private keys, seed phrases, validator keys or access tokens.
