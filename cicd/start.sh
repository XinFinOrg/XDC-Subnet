#!/bin/bash
if [ ! -d /work/xdcchain/XDC/chaindata ]
then
  if test -z "$PRIVATE_KEY" 
  then
    echo "PRIVATE_KEY environment variable has not been set."
    exit 1
  elif test -z "$NETWORK_ID"
  then
    echo "NETWORK_ID environment variable has not been set."
    exit 1
  elif test -z "$BOOTNODES"
  then
    echo "WARNING: BOOTNODES environment variable has not been set. You should at least provide 1 bootnode address"
  fi
  
  echo "${PRIVATE_KEY}" >> /tmp/key
  echo "Creating a new wallet"
  wallet=$(XDC account import --password .pwd --datadir /work/xdcchain /tmp/key | awk -v FS="({|})" '{print $2}')
  XDC --datadir /work/xdcchain init /work/genesis.json
else
  echo "Wallet already exist, re-use the same one"
  wallet=$(XDC account list --datadir /work/xdcchain | head -n 1 | awk -v FS="({|})" '{print $2}')
fi

log_level=3
if test -z "$LOG_LEVEL" 
then
  echo "Log level not set, default to verbosity of 3"
else
  echo "Log level found, set to $LOG_LEVEL"
  log_level=$LOG_LEVEL
fi

syncmode="full"
if test -z "$SYNC_MODE" 
then
  echo "Sync mode not set, default to full"
else
  echo "Sync mode found, set to $SYNC_MODE"
  syncmode=$SYNC_MODE
fi

echo "Running a node with wallet: ${wallet}"
echo "Starting nodes with $bootnodes ..."

XDC --gcmode=full \
--bootnodes ${BOOTNODES} --syncmode ${syncmode} \
--datadir /work/xdcchain --networkid ${NETWORK_ID} \
-port 30303 --rpc --rpccorsdomain "*" --rpcaddr 0.0.0.0 \
--rpcport 8545 \
--rpcapi admin,db,eth,debug,miner,net,shh,txpool,personal,web3,XDPoS \
--rpcvhosts "*" --unlock "${wallet}" --password /work/.pwd --mine \
--gasprice "1" --targetgaslimit "420000000" --verbosity ${log_level} \
--ws --wsaddr=0.0.0.0 --wsport 8555 \
--wsorigins "*" 2>&1 >>/work/xdcchain/xdc.log | tee --append /work/xdcchain/xdc.log
