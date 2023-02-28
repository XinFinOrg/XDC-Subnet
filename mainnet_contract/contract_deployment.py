from config import *
from eth_account import Account
import json
from web3_xdc import Web3

# 1. load ABI files and connect using web3
w3 = Web3(Web3.HTTPProvider(NODE_RPC))
with open(HEADER_CONTRACT_JSON, "r") as f:
  header_contract = json.load(f)
with open(SUBNET_CONTRACT_JSON, "r") as f:
  subnet_contract = json.load(f)
with open(".env", "r") as f:
  account = Account.from_key(f.read().strip())
with open(DEPLOY_INIT_JSON, "r") as f:
  init = json.load(f)

# Verify if deployment account has enough balance
# assert(w3.eth.get_balance(account.address) > (1500000*250000000 + 3400000*250000000))

# 2. Deploy HeaderReader Library
# signed_txn1 = w3.eth.account.sign_transaction({
#   "from": account.address,
#   "to": "",
#   "gas": 1600000,
#   "gasPrice": 250000000,
#   "data": header_contract["bytecode"],
#   "nonce": w3.eth.get_transaction_count(account.address),
# }, account.key)
# txn1_hash = w3.eth.send_raw_transaction(signed_txn1.rawTransaction)
# # WARNING: If timeout or error, either web3 connection lost or contract deploy txn is not successfully processed
# txn1_receipt = w3.eth.wait_for_transaction_receipt(txn1_hash)
# libAddress = txn1_receipt.contractAddress
# print("HeaderReader lib deployed at: ", libAddress)
# with open("address.txt", "w") as f:
#   f.write("{}\n".format(libAddress))

# 3. Deploy Subnet Contract
Subnet = w3.eth.contract(abi=subnet_contract["abi"], bytecode=subnet_contract["bytecode"].replace("__HeaderReader__________________________", "B1e5f1b912577049E58918378Df3bC12Daa22CFd"))
txn2 = Subnet.constructor(init["validators"], init["threshold"], init["genesis_header_encoded"], init["block1_header_encoded"]).build_transaction({
  "from": account.address,
  "gas": 3800000,
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

