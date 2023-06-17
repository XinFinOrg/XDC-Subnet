# XDC Subnet Contract
This folder has provided scripts for:
- Contract Building and Testing
- Contract Deployment
- API Interaction with Deployed Subnet Contract

## Contract Building and Testing:
Environmental preparation
###### Nodejs 16 or higher version

Install dependencies
```
 yarn
```

Test

    npx hardhat compile
    npx hardhat test

## Contract Setup:
This step is recommended to complete in python virtual environment because it is going to use the web3 library adapted for XDC. And before running the process, it is required to performed two operations:
1. Fill in the fields in `deployment.json`
    * `GAP`: GAP block number on public chain
    * `EPOCH`: EPOCH block number on public chain
    * `MAINNET_RPC`: Targeted XDC public chain devnet, testnet or mainnet node RPC link
    * `SUBNET_RPC`: Targeted XDC private subnet chain devnet, testnet or mainnet node RPC link
    * `VALIDATORS`: List of initial validator addresses
2. Create a `.env` file which contain a valid account privatekey, check `.env.sample` for example


## Contract Deployment:
And get the deployed contract address
```
npx hardhat run scripts/deployment.js --network devnet
```

## API Interaction
Refer to `README.md` under `./API`

