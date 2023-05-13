# XDPoSChain Subnet
Subnet is working in progress

## Docker images
docker pull xinfinorg/xdcsubnets:latest

## Run the subnet image
The subnet image require at least below environment variables injected when running docker command:
1. BOOTNODES: Addresses of the bootnodes, seperated by ","
2. PRIVATE_KEY: Primary key of the wallet. Note, if not provided, the node will run on a random key
3. NETWORK_ID: The subnet network id. This shall be unique in your local network. Default to 102 if not provided.
4. RPC_API (Optional): The API that you would like to turn on. Supported values are "admin,db,eth,debug,miner,net,shh,txpool,personal,web3,XDPoS"
5. EXTIP (Optional): NAT port mapping based on the external IP address.
6. LOG_LEVEL (Optional): The log level of the running node. Default to 3. 
7. SYNC_MODE (Optional): The node syncing mode. Available values are full or fast. Default to full.

The docker container will store the chain data under the path of "/work/xdcchain". If you would like the chain data persisted on your machine, you will need to volume the container.
An example command as below
```
WIP
```