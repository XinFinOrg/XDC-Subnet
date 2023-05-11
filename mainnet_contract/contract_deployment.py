import os
import json

from config import *
from eth_account import Account
from web3_xdc import Web3
from dotenv import load_dotenv

load_dotenv()

# 1. Load ABI files and connect using web3
with open("config.json", "r") as f:
  config = json.load(f)
with open(config['subnet_contract'], "r") as f:
  subnet_contract = json.load(f)
with open(config['deploy_init'], "r") as f:
  blocks = json.load(f)

account = Account.from_key(os.getenv('PRIVATE_KEY'))
w3 = Web3(Web3.HTTPProvider(config['mainnet_rpc']))

# 2. Deploy Subnet Contract
with open("lib_address.txt", "r") as f:
  lib_addr = f.read().strip()[2:]

Subnet = w3.eth.contract(abi=subnet_contract["abi"], bytecode=subnet_contract["bytecode"].replace("__HeaderReader__________________________", lib_addr))
txn2 = Subnet.constructor(
  config["validators"],
  blocks["genesis_header_encoded"], 
  blocks["block1_header_encoded"],
  config["gap"],
  config["epoch"]
).build_transaction(
  {
    "from": account.address,
    "gas": 5500000,
    "gasPrice": 250000000,
    "nonce": w3.eth.get_transaction_count(account.address),
})
signed_txn2 = w3.eth.account.sign_transaction(txn2, account.key)
txn2_hash = w3.eth.send_raw_transaction(signed_txn2.rawTransaction)
# WARNING: If timeout or error, either web3 connection lost or contract deploy txn is not successfully processed
txn2_receipt = w3.eth.wait_for_transaction_receipt(txn2_hash)
print("Subnet contract deployed at: ", txn2_receipt.contractAddress)
with open("address.txt", "w") as f:
  f.write("{}".format(txn2_receipt.contractAddress))

subnet = w3.eth.contract(
  address=txn2_receipt.contractAddress,
  abi=subnet_contract["abi"]
)

# # 4. Small verification on deployment success
assert(subnet.functions.isMaster(account.address).call())
print("Deployment Complete!")

