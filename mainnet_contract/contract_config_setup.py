from config import *
import json
import requests
import base64


#Subnet 
block0 = {"jsonrpc":"2.0","method":"XDPoS_getV2BlockByNumber","params":["0x0"],"id":1}
block1 = {"jsonrpc":"2.0","method":"XDPoS_getV2BlockByNumber","params":["0x1"],"id":1}
headers = {'Accept': 'application/json'}

r0 = requests.post(url = SUBNET_RPC, json = block0, headers = headers)
r1 = requests.post(url = SUBNET_RPC, json = block1, headers = headers)
data0 = r0.json()
data1 = r1.json()

decodeHex0 = base64.b64decode(data0['result']['EncodedRLP']).hex()
decodeHex1 = base64.b64decode(data1['result']['EncodedRLP']).hex()

output = {}
output['genesis_header_encoded'] = '0x' + decodeHex0.upper()
output['block1_header_encoded'] = '0x' + decodeHex1.upper()
output['validators'] = VALIDATORS
output['gap'] = GAP
output['epoch'] = EPOCH
json_data = json.dumps(output)
json_object = json.dumps(output, indent=2)

with open("subnet_initialization.json", "w") as outfile:
    outfile.write(json_object)