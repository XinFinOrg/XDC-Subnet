// Copyright 2017 The go-ethereum Authors
// This file is part of go-ethereum.
//
// go-ethereum is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// go-ethereum is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with go-ethereum. If not, see <http://www.gnu.org/licenses/>.

package main

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"math"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/core"
	"github.com/XinFinOrg/XDC-Subnet/log"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"gopkg.in/yaml.v3"

	"context"
	"math/big"

	"github.com/XinFinOrg/XDC-Subnet/accounts/abi/bind"
	"github.com/XinFinOrg/XDC-Subnet/accounts/abi/bind/backends"
	validatorContract "github.com/XinFinOrg/XDC-Subnet/contracts/validator"
	"github.com/XinFinOrg/XDC-Subnet/crypto"
	"github.com/XinFinOrg/XDC-Subnet/rlp"
)

type GenesisInput struct {
	Name                 string
	Denom                string
	Period               uint64
	Reward               uint64
	TimeoutPeriod        int
	TimeoutSyncThreshold int
	CertThreshold        int
	Grandmasters         []common.Address
	Masternodes          []common.Address
	Epoch                uint64
	Gap                  uint64
	PreFundedAccounts    []common.Address
	ChainId              uint64
}

func NewGenesisInput() *GenesisInput {
	return &GenesisInput{
		Name:                 "xdc-subnet",
		Denom:                "0x",
		Period:               2,
		Reward:               2,
		TimeoutPeriod:        10,
		TimeoutSyncThreshold: 3,
		CertThreshold:        common.MaxMasternodes*2/3 + 1,
		Epoch:                900,
		Gap:                  450,
		ChainId:              112,
	}
}

func SetDefaultAfterInputRead(input *GenesisInput) {
	//if no cert threshold provided, use 2/3 of masternode len
	if input.CertThreshold == common.MaxMasternodes*2/3+1 {
		input.CertThreshold = int(math.Ceil(float64(len(input.Masternodes)) * 2.0 / 3.0))
	}
}

// makeGenesis creates a new genesis struct based on some user input.
func (w *wizard) makeGenesisFile() {
	// Construct a default genesis block
	genesis := &core.Genesis{
		Timestamp:  uint64(time.Now().Unix()),
		GasLimit:   4700000,
		Difficulty: big.NewInt(524288),
		Alloc:      make(core.GenesisAlloc),
		Config: &params.ChainConfig{
			HomesteadBlock: big.NewInt(1),
			EIP150Block:    big.NewInt(2),
			EIP155Block:    big.NewInt(3),
			EIP158Block:    big.NewInt(3),
			ByzantiumBlock: big.NewInt(4),
		},
	}
	configFile, err := ioutil.ReadFile(w.options.filePath)
	if err != nil {
		fmt.Println("read file error ", err)
		os.Exit(1)
		return
	}
	var input = NewGenesisInput()
	// Unmarshal our input YAML file
	if err := yaml.Unmarshal(configFile, &input); err != nil {
		fmt.Println("parse YAML error  ", err)
		os.Exit(1)
		return
	}
	SetDefaultAfterInputRead(input)
	fmt.Println("Generating genesis file with the below input  ", err)
	fmt.Printf("%+v\n", input)

	// Make sure we have a good network name to work with	fmt.Println()
	// Docker accepts hyphens in image names, but doesn't like it for container names
	if w.network == "" {
		fmt.Println("Please specify a network name to administer (no spaces or hyphens, please)")
		for {
			// w.network = w.readString()
			fmt.Println(input.Name)
			w.network = input.Name
			if !strings.Contains(w.network, " ") && !strings.Contains(w.network, "-") {
				fmt.Printf("\nSweet, you can set this via --network=%s next time!\n\n", w.network)
				break
			}
			log.Error("I also like to live dangerously, still no spaces or hyphens")
		}
	}

	log.Info("Administering Ethereum network", "name", w.network)
	genesis.Difficulty = big.NewInt(1)
	genesis.Config.XDPoS = &params.XDPoSConfig{
		Period: 15,
		Epoch:  30000,
		Reward: 0,
		V2: &params.V2{
			SwitchBlock: big.NewInt(0),
			CurrentConfig: &params.V2Config{
				SwitchRound: 0,
			},
			AllConfigs: make(map[uint64]*params.V2Config),
		},
	}
	w.network = input.Name
	genesis.Config.XDPoS.NetworkName = input.Name
	genesis.Config.XDPoS.Denom = input.Denom
	fmt.Println()
	fmt.Println("How many seconds should blocks take? (default = 2)")
	// genesis.Config.XDPoS.Period = uint64(w.readDefaultInt(2))
	fmt.Println(input.Period)
	genesis.Config.XDPoS.Period = input.Period
	genesis.Config.XDPoS.V2.CurrentConfig.MinePeriod = int(genesis.Config.XDPoS.Period)

	fmt.Println()
	fmt.Println("How many Ethers should be rewarded to masternode? (default = 10)")
	// genesis.Config.XDPoS.Reward = uint64(w.readDefaultInt(10))
	fmt.Println(input.Reward)
	genesis.Config.XDPoS.Reward = input.Reward

	fmt.Println()
	fmt.Println("How long is the v2 timeout period? (default = 10)")
	// genesis.Config.XDPoS.V2.CurrentConfig.TimeoutPeriod = w.readDefaultInt(10)
	fmt.Println(input.TimeoutPeriod)
	genesis.Config.XDPoS.V2.CurrentConfig.TimeoutPeriod = input.TimeoutPeriod

	fmt.Println()
	fmt.Println("How many v2 timeout reach to send Synchronize message? (default = 3)")
	// genesis.Config.XDPoS.V2.CurrentConfig.TimeoutSyncThreshold = w.readDefaultInt(3)
	fmt.Println(input.TimeoutSyncThreshold)
	genesis.Config.XDPoS.V2.CurrentConfig.TimeoutSyncThreshold = input.TimeoutSyncThreshold

	fmt.Println()
	fmt.Printf("How many v2 vote collection to generate a QC, should be two thirds of masternodes? (default = %d)\n", common.MaxMasternodes/3*2+1)
	// genesis.Config.XDPoS.V2.CurrentConfig.CertThreshold = w.readDefaultInt(common.MaxMasternodes/3*2 + 1)
	fmt.Println(input.CertThreshold)
	minCandidateThreshold := input.CertThreshold
	genesis.Config.XDPoS.V2.CurrentConfig.CertThreshold = minCandidateThreshold

	genesis.Config.XDPoS.V2.AllConfigs[0] = genesis.Config.XDPoS.V2.CurrentConfig

	// We also need the grand master address
	fmt.Println()
	fmt.Println("Which accounts are allowed to regulate masternodes (grand master nodes)? (mandatory at least one)")
	fmt.Println(input.Grandmasters)
	grandMasters := input.Grandmasters
	owner := input.Grandmasters[0]

	// We also need the initial list of signers
	fmt.Println()
	fmt.Println("Which accounts are masternodes? (mandatory at least one)")

	fmt.Println(input.Masternodes)
	candidates := input.Masternodes

	// Sort the signers and embed into the extra-data section
	for i := 0; i < len(candidates); i++ {
		for j := i + 1; j < len(candidates); j++ {
			if bytes.Compare(candidates[i][:], candidates[j][:]) > 0 {
				candidates[i], candidates[j] = candidates[j], candidates[i]
			}
		}
	}
	// De-duplicate signers
	for i := 0; i < len(candidates)-1; i++ {
		if bytes.Equal(candidates[i][:], candidates[i+1][:]) {
			log.Crit("masternodes contain duplicate address")
		}
	}

	genesis.Validators = candidates
	genesis.NextValidators = candidates

	validatorCap := new(big.Int)
	validatorCap.SetString(validatorContract.MinCandidateCap, 10)
	var validatorCaps []*big.Int
	genesis.ExtraData = make([]byte, 32+len(candidates)*common.AddressLength+65)
	for i, signer := range candidates {
		validatorCaps = append(validatorCaps, validatorCap)
		copy(genesis.ExtraData[32+i*common.AddressLength:], signer[:])
	}

	fmt.Println()
	fmt.Println("How many blocks per epoch? (default = 900)")
	// epochNumber := uint64(w.readDefaultInt(900))
	fmt.Println(input.Epoch)
	epochNumber := input.Epoch

	genesis.Config.XDPoS.Epoch = epochNumber
	genesis.Config.XDPoS.RewardCheckpoint = epochNumber

	fmt.Println()
	fmt.Println("How many blocks before checkpoint need to prepare new set of masternodes? (default = 450)")
	// genesis.Config.XDPoS.Gap = uint64(w.readDefaultInt(450))
	fmt.Println(input.Gap)
	genesis.Config.XDPoS.Gap = input.Gap

	fmt.Println()
	fmt.Println("What is foundation wallet address? (default = xdc0000000000000000000000000000000000000068)")
	// genesis.Config.XDPoS.FoudationWalletAddr = w.readDefaultAddress(common.HexToAddress(common.FoudationAddr))
	fmt.Println(input.Grandmasters[0])
	genesis.Config.XDPoS.FoudationWalletAddr = input.Grandmasters[0]

	// Validator Smart Contract Code
	pKey, _ := crypto.HexToECDSA("b71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291")
	addr := crypto.PubkeyToAddress(pKey.PublicKey)
	contractBackend := backends.NewXDCSimulatedBackend(core.GenesisAlloc{addr: {Balance: big.NewInt(1000000000)}}, 10000000, params.TestXDPoSMockChainConfig, nil)
	transactOpts := bind.NewKeyedTransactor(pKey)

	validatorAddress, _, err := validatorContract.DeployValidator(transactOpts, contractBackend, candidates, validatorCaps, owner, grandMasters, int64(minCandidateThreshold))
	if err != nil {
		fmt.Println("Can't deploy root registry")
	}
	contractBackend.Commit()

	d := time.Now().Add(1000 * time.Millisecond)
	ctx, cancel := context.WithDeadline(context.Background(), d)
	defer cancel()
	code, _ := contractBackend.CodeAt(ctx, validatorAddress, nil)
	storage := make(map[common.Hash]common.Hash)
	f := func(key, val common.Hash) bool {
		decode := []byte{}
		trim := bytes.TrimLeft(val.Bytes(), "\x00")
		err := rlp.DecodeBytes(trim, &decode)
		if err != nil {
			log.Error("Failed while decode byte, please contract developer team")
		}
		storage[key] = common.BytesToHash(decode)
		log.Info("DecodeBytes", "value", val.String(), "decode", storage[key].String())
		return true
	}
	contractBackend.ForEachStorageAt(ctx, validatorAddress, nil, f)
	genesis.Alloc[common.HexToAddress(common.MasternodeVotingSMC)] = core.GenesisAccount{
		Balance: validatorCap.Mul(validatorCap, big.NewInt(int64(len(validatorCaps)))),
		Code:    code,
		Storage: storage,
	}

	// Consensus all set, just ask for initial funds and go
	fmt.Println()
	fmt.Println("Pre-funding grand master nodes...")
	exponent := uint(256 - 7)
	for i := 0; i < len(grandMasters); i++ {
		// Read the address of the account to fund
		address := grandMasters[i]
		genesis.Alloc[address] = core.GenesisAccount{
			Balance: new(big.Int).Lsh(big.NewInt(1), exponent), // 2^256 / 128 (allow many pre-funds without balance overflows)
		}
		fmt.Printf("Pre-fund grand master node %s with 2^%d tokens\n", address.Hex(), exponent-18)
	}
	fmt.Println()

	fmt.Println()
	fmt.Println("Which accounts should be pre-funded? (other than grand master nodes)")

	fmt.Println(input.PreFundedAccounts)
	address := input.PreFundedAccounts
	for _, value := range address {
		genesis.Alloc[value] = core.GenesisAccount{
			Balance: new(big.Int).Lsh(big.NewInt(1), 256-7), // 2^256 / 128 (allow many pre-funds without balance overflows)
		}
		fmt.Printf("Pre-fund node %s with 2^%d tokens\n", value.Hex(), exponent-18)
	}

	// Add a batch of precompile balances to avoid them getting deleted
	for i := int64(0); i < 2; i++ {
		genesis.Alloc[common.BigToAddress(big.NewInt(i))] = core.GenesisAccount{Balance: big.NewInt(0)}
	}
	// Query the user for some custom extras
	fmt.Println()
	fmt.Println("Specify your chain/network ID if you want an explicit one (default = random)")
	// genesis.Config.ChainId = new(big.Int).SetUint64(uint64(w.readDefaultInt(rand.Intn(65536))))
	if input.ChainId >= 65536 || input.ChainId <= 0 {
		fmt.Println("Invalid ChainId, must be between 0 and 65536 ")
		return

	} else {
		fmt.Println(input.ChainId)
		genesis.Config.ChainId = new(big.Int).SetUint64(input.ChainId)
	}

	// All done, store the genesis and flush to disk
	log.Info("Configured new genesis block")

	w.conf.Genesis = genesis

	binPath, err := os.Executable()
	if err != nil {
		fmt.Println("get binary path error ", err)
		return
	}
	// w.conf.path = filepath.Join(os.Getenv("HOME"), ".puppeth", w.network)
	// fileName := w.network + ".json"
	fileName := "genesis.json"
	if w.options.outputPath != "" {
		w.conf.path = filepath.Join(w.options.outputPath, fileName)
	} else {
		w.conf.path = filepath.Join(binPath, "..", fileName)
	}
	log.Info("writing output genesis to", "file", w.conf.path)
	w.conf.flush()

}
