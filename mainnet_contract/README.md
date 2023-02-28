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

## Contract Deployment:
This step is recommended to complete in python virtual environment because it is going to use the web3 library adapted for XDC. And before running the process, it is required to performed two operations:
1. Fill in the fields in `config.py`
    * `NODE_RPC`: Targeted XDC devnet, testnet or mainnet node RPC link
    * `DEPLOY_INIT_JSON`: Arguments to be provided into contract constructor
    * `SUBNET_CONTRACT_JSON`: Path to compiled Subnet JSON file 
    * `HEADER_CONTRACT_JSON`: Path to compiled HeaderReader JSON file
2. `DEPLOY_INIT_JSON` should include:
    * `genesis_header_encoded`: RLP encoded Genesis XDC block bytes in hexstring format
    * `validators`: List of initial validator addresses
    * `threshold`: The number of validator signatures to pass block verification
3. Create a `.env` file which contain a valid account privatekey

There are sample for `config.py` and `DEPLOY_INIT_JSON` as a reference. 

```
# Create and Activate python virtual env
python3 -m venv xdc
source xdc/bin/activate

# Git clone the modified web3
git clone https://github.com/span14/web3.py.git
cd web3.py
git fetch 
git checkout v5

# Install modified web3
python setup.py install

# Back to parent folder and run
cd ..
python contract_deployment.py
```

## API Interaction
Refer to `README.md` under `./API`

