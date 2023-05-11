#!/bin/sh
echo "0. create python virtual env"
# Create and Activate python virtual env
python -m venv xdc
. xdc/bin/activate

echo ""
echo "1. initialize config"
pip install --upgrade pip
pip install -r requirements.txt
python contract_config_setup.py

echo ""
echo "2. replace web3 to customize xdc web3"
# Git clone the modified web3
git clone https://github.com/hash-laboratories-au/web3.py.git
cd web3.py

# Install modified web3
pip install rpds-py cytoolz
python setup.py install
cd ..

echo ""
echo "3. contract deploy"
python contract_deployment.py
