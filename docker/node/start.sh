#!/bin/bash

# Variables
params=""

# constants
KEYSTORE_DIR="keystore"
DATA_DIR="/work/xdcchain"

# networkid
if [[ ! -z $NETWORK_ID ]]; then
  echo "Network Id set to ${NETWORK_ID}"
  params="$params --networkid $NETWORK_ID"
else
  echo "NETWORK_ID environment variable has not been set. Default to 102"
  params="$params --networkid 102"
fi

# bootnodes
if [[ ! -z $BOOTNODES ]]; then
  echo "Received bootnodes of ${BOOTNODES}"
  params="$params --bootnodes $BOOTNODES"
fi

# extip
if [[ ! -z $EXTIP ]]; then
echo "Set the NAT to extip:${EXTIP}"
  params="$params --nat extip:${EXTIP}"
fi

# syncmode
if [[ ! -z $SYNC_MODE ]]; then
  echo "Set the sync mode to ${SYNC_MODE}"
  params="$params --syncmode ${SYNC_MODE}"
else
  params="$params --syncmode full"
fi

# log level
if [[ ! -z $LOG_LEVEL ]]; then
  echo "Set the log level to ${LOG_LEVEL}"
  params="$params --verbosity ${LOG_LEVEL}"
else
  params="$params --verbosity 3"
fi

# GC mode
if [[ ! -z $GC_MODE ]]; then
  echo "Set the GC mode to ${GC_MODE}"
  params="$params --gcmode ${GC_MODE}"
else
  params="$params --gcmode full"
fi

# RPC API
if [[ ! -z $RPC_API ]]; then
  echo "Open rpc API of ${RPC_API}"
  params="$params --rpcapi ${RPC_API} --wsapi ${RPC_API}"
else
  echo "No RPC API is enabled. If you wanna enable any API calls, provide values to RPC_API. Available options are admin,db,eth,debug,miner,net,shh,txpool,personal,web3,XDPoS"
fi

if [ ! -d $DATA_DIR/XDC/chaindata ]
then
  if test -z "$PRIVATE_KEY" 
  then
    echo "PRIVATE_KEY environment variable has not been set, randomly creating a new one"
    XDC account new \
      --datadir $DATA_DIR \
      --keystore $KEYSTORE_DIR \
      --password .pwd
    XDC --datadir $DATA_DIR init /work/genesis.json  
    wallet=$(XDC account list --datadir $DATA_DIR --keystore $KEYSTORE_DIR | head -n 1 | awk -v FS="({|})" '{print $2}')
  else
    echo "${PRIVATE_KEY}" > ./private_key
    echo "Creating account from private key"
    wallet=$(XDC account import --password .pwd --datadir $DATA_DIR --keystore $KEYSTORE_DIR ./private_key | awk -v FS="({|})" '{print $2}')
    XDC --datadir $DATA_DIR init /work/genesis.json  
  fi
  
else
  wallet=$(XDC account list --datadir $DATA_DIR --keystore $KEYSTORE_DIR | head -n 1 | awk -v FS="({|})" '{print $2}')
fi

echo "Using wallet $wallet"
params="$params --unlock $wallet"

echo "Starting nodes with $bootnodes ..."

XDC $params \
--datadir $DATA_DIR \
--port 30303 \
--rpc \
--rpccorsdomain "*" \
--rpcaddr 0.0.0.0 \
--rpcport 8545 \
--rpcvhosts "*" \
--password /work/.pwd \
--gasprice "1" \
--targetgaslimit "420000000" \
--ws --wsaddr=0.0.0.0 \
--wsport 8555 \
--mine \
--wsorigins "*" 2>&1 >>$DATA_DIR/xdc.log | tee --append $DATA_DIR/xdc.log
