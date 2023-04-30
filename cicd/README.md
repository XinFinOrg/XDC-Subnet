# CI/CD pipeline for XDC Subnet
This directory contain scripts used for building the subnet docker images

## CI Process
Each PR merged into `main` will trigger below actions:
- Tests
- Docker build of XDC subnet configurations with tag of `:latest`
- Docker push to docker hub. https://hub.docker.com/repository/docker/xinfinorg/xdcsubnets

## Run the subnet image
WIP: Working in progress
The subnet image require at least below environment variables injected when running docker command:
1. BOOTNODES: Addresses of the bootnodes, seperated by ","
2. PRIVATE_KEY: Primary key of the wallet
3. NETWORK_ID: The subnet network id. This shall be unique in your local network.
4. LOG_LEVEL (Optional): The log level of the running node. Default to 3. 
5. SYNC_MODE (Optional): The node syncing mode. Available values are full or fast. Default to full.

The docker container will store the chain data under the path of "/work/xdcchain". If you would like the chain data persisted on your machine, you will need to volume the container.
An example command as below
```
WIP
```