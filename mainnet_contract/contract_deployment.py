from config import *
from eth_account import Account
import json
from web3_xdc import Web3

# 1. Load ABI files and connect using web3
w3 = Web3(Web3.HTTPProvider(NODE_RPC))
with open(SUBNET_CONTRACT_JSON, "r") as f:
  subnet_contract = json.load(f)
with open(".env", "r") as f:
  account = Account.from_key(f.read().strip())
with open(DEPLOY_INIT_JSON, "r") as f:
  init = json.load(f)

# 2. Deploy Subnet Contract
with open("lib_address.txt", "r") as f:
  lib_addr = f.read().strip()[2:]

Subnet = w3.eth.contract(abi=subnet_contract["abi"], bytecode=subnet_contract["bytecode"].replace("__HeaderReader__________________________", lib_addr))
txn2 = Subnet.constructor(
  init["validators"],
  init["genesis_header_encoded"], 
  init["block1_header_encoded"],
  init["gap"],
  init["epoch"]
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

