#!/bin/sh

echo "0. create python virtual env"
# Create and Activate python virtual env
alias python=python3.9
python -m venv xdc
. xdc/bin/activate

echo ""
echo "1. initialize config"
pip install -r requirements.txt
python contract_config_setup.py

echo ""
echo "2. replace web3 to customize xdc web3"
# Git clone the modified web3
git clone https://github.com/span14/web3.py.git | true
cd web3.py
git checkout v5-patch

# Install modified web3
python setup.py install
cd ..

echo ""
echo "3. contract deploy"
python contract_deployment.py
