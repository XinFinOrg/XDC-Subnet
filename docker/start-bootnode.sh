#!/bin/bash

# Variables
params=""

# extip
if [[ ! -z $EXTIP ]]; then
echo "Set the NAT to extip:${EXTIP}"
  params="$params -nat extip:${EXTIP}"
fi

# extip
if [[ ! -z $NET_RESTRICTING ]]; then
echo "Restricting the network to: ${NET_RESTRICTING}"
  params="$params -netrestrict NET_RESTRICTING"
fi

# file to env
for env in PRIVATE_KEY; do
  file=$(eval echo "\$${env}_FILE")
  if [[ -f $file ]] && [[ ! -z $file ]]; then
    echo "Replacing $env by $file"
    export $env=$(cat $file)
  fi
done

# private key
if [[ ! -z "$PRIVATE_KEY" ]]; then
  echo "$PRIVATE_KEY" > bootnode.key
elif [[ ! -f ./bootnode.key ]]; then
  bootnode -genkey bootnode.key
fi

# dump address
address="enode://$(bootnode -nodekey bootnode.key -writeaddress)@$(hostname -i):30301"
if [[ ! -z $EXTIP ]]; then
  address="enode://$(bootnode -nodekey bootnode.key -writeaddress)@$EXTIP:30301"
fi

echo "🥾 Starting the bootnode with address at $address"
echo $address > ./bootnodes.list



exec bootnode "$@" $params
