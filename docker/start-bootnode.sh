#!/bin/bash

params=""

if [[ ! -z $EXTIP ]]; then
  echo "Set the NAT to extip:${EXTIP}"
  params="$params -nat extip:${EXTIP}"
fi

if [[ ! -z $NET_RESTRICTING ]]; then
  echo "Restricting the network to: ${NET_RESTRICTING}"
  params="$params -netrestrict ${NET_RESTRICTING}"
fi

for env in PRIVATE_KEY; do
  file=$(eval echo "\$${env}_FILE")
  if [[ -f $file ]] && [[ ! -z $file ]]; then
    echo "Replacing $env by $file"
    export $env=$(cat $file)
  fi
done

NODEKEY_FILE="${NODEKEY_FILE:-bootnode/bootnode.key}"
if [[ ! -z "$PRIVATE_KEY" ]]; then
  echo "$PRIVATE_KEY" > "$NODEKEY_FILE"
elif [[ ! -f "${NODEKEY_FILE}" ]]; then
  mkdir -p "$(dirname "${NODEKEY_FILE}")"
  bootnode -genkey "$NODEKEY_FILE"
fi

if [[ ! -z "$BOOTNODE_PORT" ]]; then
  params="$params -addr :${BOOTNODE_PORT}"
else
  BOOTNODE_PORT=30301
  params="$params -addr :${BOOTNODE_PORT}"
fi

BOOTNODES_FILE="${BOOTNODES_FILE:-bootnode/bootnodes.list}"
if [[ -f "${BOOTNODES_FILE}" ]]; then
  params="$params -bootnodesfile ${BOOTNODES_FILE}"
fi

if [[ ! -z $VERBOSITY ]]; then
  params="$params -verbosity ${VERBOSITY}"
fi

host=$(hostname -i | awk '{print $1}')
if [[ ! -z $EXTIP ]]; then
  host=$EXTIP
fi
address="enode://$(bootnode -nodekey ${NODEKEY_FILE} -writeaddress)@${host}:${BOOTNODE_PORT}"
echo "Starting the bootnode with address at $address"
BOOTNODE_ENODE_OUT="${BOOTNODE_ENODE_OUT:-bootnode/bootnode.enode}"
echo $address > "$BOOTNODE_ENODE_OUT"

LOG_FILE="${LOG_FILE:-bootnode/bootnode.log}"
if [[ -n "$LOG_FILE" && "$LOG_FILE" != "-" ]]; then
  touch "$LOG_FILE"
  exec > >(tee -a "$LOG_FILE") 2>&1
fi

exec bootnode -nodekey "$NODEKEY_FILE" $params "$@"
