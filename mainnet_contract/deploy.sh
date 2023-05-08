#!/bin/sh

echo "1. initialize config"
python contract_config_setup.py

echo "2. create python virtual env"
# Create and Activate python virtual env
python -m venv xdc
source xdc/bin/activate

# Git clone the modified web3
git clone https://github.com/span14/web3.py.git
cd web3.py

# Install modified web3
python setup.py install
cd ..

echo "3. contract deploy"
python contract_deployment.py

