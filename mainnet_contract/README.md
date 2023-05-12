# XDC Subnet Contract
This folder has provided scripts for:
- Contract Building and Testing
- Contract Deployment
- API Interaction with Deployed Subnet Contract

## Contract Building and Testing:
Make sure you have installed [TruffleSuite](https://trufflesuite.com/docs/truffle/how-to/install/) ahead.

We have provided the precompiled contracts in JSON format under `./build/contracts`. But if you want to rebuild it in local machine, you can do this under current folder:
```
# Compile contracts in the contracts folder and this automatically generates those json files in ./build/contracts

truffle build

# Test contract functionality in local test network with test scripts written under ./test

truffle test
```

## Contract Setup:
This step is recommended to complete in python virtual environment because it is going to use the web3 library adapted for XDC. And before running the process, it is required to performed two operations:
1. Fill in the fields in `config.json`
    * `GAP`: GAP block number on public chain
    * `EPOCH`: EPOCH block number on public chain
    * `MAINNET_RPC`: Targeted XDC public chain devnet, testnet or mainnet node RPC link
    * `SUBNET_RPC`: Targeted XDC private subnet chain devnet, testnet or mainnet node RPC link
    * `DEPLOY_INIT`: Arguments to be provided into contract constructor
    * `SUBNET_CONTRACT`: Path to compiled Subnet JSON file 
    * `HEADER_CONTRACT`: Path to compiled HeaderReader JSON file
    * `VALIDATORS`: List of initial validator addresses
2. Create a `.env` file which contain a valid account privatekey, check `.env.sample` for example


## Contract Deployment:
And get the deployed contract address
```
docker build -t contract . && docker run -it contract

.....
.....
3. contract deploy
Subnet contract deployed at:  0x1234567890
Deployment Complete!
```

## API Interaction
Refer to `README.md` under `./API`

