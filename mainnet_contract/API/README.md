# Sample Interaction Code with Subnet Contract
This folder contains a `main.js` file which shows all cases to interact with subnet contract.

## Test
If you want to test the default status of deployed subnet contract sample, make sure you do:
1. Installed [npm](https://docs.npmjs.com/downloading-and-installing-node-js-and-npm)
2. Created `.env` in the parent folder which has a valid private key of an EVM account

Then simply follows these commands: 

```
npm install -g web3
npm install -g rlp
node main.js
```

This script will verify:
- Whether the account loaded from `.env` is the master of the contract. (By default, there is only one master in the contract which has the address: `0x377B97484925d616886816754c6CD4FB2004D4C1`)
- Whether the default list of validators is the one defined in `subnet_initialization.json` of the parent folder
- Whether the default validator threshold is the one defined in `subnet_initialization.json` of the parent folder
- Whether the latest finalized block stored in the contract is the genesis block given in `subnet_initialization.json` of the parent folder. (The genesis block are encoded in RLP bytes and the latest finalized block may be updated in the later integration tests)