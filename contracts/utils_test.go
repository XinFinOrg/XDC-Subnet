// Copyright (c) 2018 XDPoSChain
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package contracts

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"math/big"
	"math/rand"
	"testing"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/accounts/abi/bind"
	"github.com/XinFinOrg/XDC-Subnet/accounts/abi/bind/backends"
	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/contracts/blocksigner"
	"github.com/XinFinOrg/XDC-Subnet/core"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/crypto"
	"github.com/XinFinOrg/XDC-Subnet/params"
)

var (
	acc1Key, _ = crypto.HexToECDSA("8a1f9a8f95be41cd7ccb6168179afb4504aefe388d1e14474d32c45c72ce7b7a")
	acc2Key, _ = crypto.HexToECDSA("49a7b37aa6f6645917e7b807e9d1c00d4fa71f18343b0d4122a4d2df64dd6fee")
	acc3Key, _ = crypto.HexToECDSA("b71c71a67e1177ad4e901695e1b4b9ee17ae16c6668d313eac2f96dbcda3f291")
	acc4Key, _ = crypto.HexToECDSA("b71c71a67e1177ad4e901695e1b4b9ee04aefe388d1e14474d32c45c72ce7b7a")
	acc1Addr   = crypto.PubkeyToAddress(acc1Key.PublicKey)
	acc2Addr   = crypto.PubkeyToAddress(acc2Key.PublicKey)
	acc3Addr   = crypto.PubkeyToAddress(acc3Key.PublicKey)
	acc4Addr   = crypto.PubkeyToAddress(acc4Key.PublicKey)
)

func getCommonBackend() *backends.SimulatedBackend {
	genesis := core.GenesisAlloc{acc1Addr: {Balance: big.NewInt(1000000000000)}}
	backend := backends.NewXDCSimulatedBackend(genesis, 10000000, params.TestXDPoSMockChainConfig, nil)
	backend.Commit()

	return backend
}

func TestSendTxSign(t *testing.T) {
	accounts := []common.Address{acc2Addr, acc3Addr, acc4Addr}
	keys := []*ecdsa.PrivateKey{acc2Key, acc3Key, acc4Key}
	backend := getCommonBackend()
	signer := types.HomesteadSigner{}
	ctx := context.Background()

	transactOpts := bind.NewKeyedTransactor(acc1Key)
	blockSignerAddr, blockSigner, err := blocksigner.DeployBlockSigner(transactOpts, backend, big.NewInt(99))
	if err != nil {
		t.Fatalf("Can't get block signer: %v", err)
	}
	backend.Commit()

	nonces := make(map[*ecdsa.PrivateKey]int)
	oldBlocks := make(map[common.Hash]common.Address)

	signTx := func(ctx context.Context, backend *backends.SimulatedBackend, signer types.HomesteadSigner, nonces map[*ecdsa.PrivateKey]int, accKey *ecdsa.PrivateKey, blockNumber *big.Int, blockHash common.Hash) *types.Transaction {
		tx, _ := types.SignTx(CreateTxSign(blockNumber, blockHash, uint64(nonces[accKey]), blockSignerAddr), signer, accKey)
		backend.SendTransaction(ctx, tx)
		backend.Commit()
		nonces[accKey]++

		return tx
	}

	// Tx sign for signer.
	signCount := int64(0)
	blockHashes := make([]common.Hash, 10)
	for i := int64(0); i < 10; i++ {
		blockHash := randomHash()
		blockHashes[i] = blockHash
		randIndex := rand.Intn(len(keys))
		accKey := keys[randIndex]
		signTx(ctx, backend, signer, nonces, accKey, new(big.Int).SetInt64(i), blockHash)
		oldBlocks[blockHash] = accounts[randIndex]
		signCount++

		// Tx sign for validators.
		for _, key := range keys {
			if key != accKey {
				signTx(ctx, backend, signer, nonces, key, new(big.Int).SetInt64(i), blockHash)
				signCount++
			}
		}
	}

	for _, blockHash := range blockHashes {
		signers, err := blockSigner.GetSigners(blockHash)
		if err != nil {
			t.Fatalf("Can't get signers: %v", err)
		}

		if signers[0].String() != oldBlocks[blockHash].String() {
			t.Errorf("Tx sign for block signer not match %v - %v", signers[0].String(), oldBlocks[blockHash].String())
		}

		if len(signers) != len(keys) {
			t.Error("Tx sign for block validators not match")
		}
	}
}

// Generate random string.
func randomHash() common.Hash {
	letterBytes := "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456789"
	var b common.Hash
	for i := range b {
		rand.Seed(time.Now().UnixNano())
		b[i] = letterBytes[rand.Intn(len(letterBytes))]
	}
	return b
}

// Unit test for get random position of masternodes.
func TestRandomMasterNode(t *testing.T) {
	oldSlice := NewSlice(0, 10, 1)
	newSlice := Shuffle(oldSlice)
	for _, newNumber := range newSlice {
		for i, oldNumber := range oldSlice {
			if oldNumber == newNumber {
				// Delete find element.
				oldSlice = append(oldSlice[:i], oldSlice[i+1:]...)
			}
		}
	}
	if len(oldSlice) != 0 {
		t.Errorf("Test generate random masternode fail %v - %v", oldSlice, newSlice)
	}
}

func TestEncryptDecrypt(t *testing.T) {
	//byteInteger := common.LeftPadBytes([]byte(new(big.Int).SetInt64(4).String()), 32)
	randomByte := RandStringByte(32)
	encrypt := Encrypt(randomByte, new(big.Int).SetInt64(4).String())
	decrypt := Decrypt(randomByte, encrypt)
	t.Log("Encrypt", encrypt, "Test", string(randomByte), "Decrypt", decrypt, "trim", string(bytes.TrimLeft([]byte(decrypt), "\x00")))
}

func isArrayEqual(a [][]int64, b [][]int64) bool {
	if len(a) != len(b) {
		return false
	}
	for i, vs := range a {
		for j, v := range vs {
			if v != b[i][j] {
				return false
			}
		}
	}
	return true
}

// Unit test for
func TestGenM2FromRandomize(t *testing.T) {
	var a []int64
	for i := 0; i <= 10; i++ {
		rand.Seed(time.Now().UTC().UnixNano())
		a = append(a, int64(rand.Intn(9999)))
	}
	b, err := GenM2FromRandomize(a, common.MaxMasternodes)
	t.Log("randomize", b, "len", len(b))
	if err != nil {
		t.Error("Fail to test gen m2 for randomize.", err)
	}
	// Test Permutation Without Fixed-point.
	M1List := NewSlice(int64(0), common.MaxMasternodes, 1)
	for i, m1 := range M1List {
		if m1 == b[i] {
			t.Errorf("Error check Permutation Without Fixed-point %v - %v - %v", i, b[i], a)
		}
	}
}

// Unit test for validator m2.
func TestBuildValidatorFromM2(t *testing.T) {
	a := []int64{84, 58, 27, 96, 127, 60, 136, 20, 121, 31, 87, 85, 40, 120, 149, 109, 141, 145, 11, 110, 147, 35, 76, 46, 34, 108, 72, 103, 102, 12, 23, 47, 70, 86, 125, 112, 128, 13, 130, 98, 126, 62, 132, 111, 134, 6, 106, 67, 24, 91, 101, 50, 94, 43, 77, 73, 129, 71, 51, 10, 92, 29, 80, 95, 33, 100, 124, 75, 38, 133, 79, 83, 61, 36, 122, 99, 16, 28, 18, 116, 140, 97, 119, 82, 148, 48, 56, 32, 93, 107, 69, 68, 123, 81, 22, 137, 25, 115, 44, 8, 42, 131, 143, 17, 55, 89, 9, 15, 19, 59, 146, 54, 5, 30, 41, 144, 117, 1, 104, 49, 105, 45, 88, 78, 74, 135, 0, 21, 57, 3, 66, 52, 63, 138, 4, 114, 37, 118, 14, 2, 26, 7, 65, 139, 39, 64, 90, 142, 53, 113}
	b := BuildValidatorFromM2(a)
	c := utils.ExtractValidatorsFromBytes(b)
	if !isArrayEqual([][]int64{a}, [][]int64{c}) {
		t.Errorf("Fail to get m2 result %v", b)
	}
}

// Unit test for decode validator string data.
func TestDecodeValidatorsHexData(t *testing.T) {
	a := "0x000000310000003000000032000000310000003000000032000000310000003000000032000000310000003000000031000000320000003000000031000000320000003000000031000000320000003000000030000000310000003200000030000000310000003200000030000000310000003200000030000000300000003100000032000000300000003100000032000000300000003100000032000000300000003200000030000000310000003200000030000000310000003200000030000000310000003000000030"
	b, err := DecodeValidatorsHexData(a)
	if err != nil {
		t.Error("Fail to decode validator from hex string", err)
	}
	c := []int64{1, 0, 2, 1, 0, 2, 1, 0, 2, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 2, 0, 1, 2, 0, 1, 2, 0, 1, 0, 0}
	if !isArrayEqual([][]int64{b}, [][]int64{c}) {
		t.Errorf("Fail to get m2 result %v", b)
	}
	t.Log("b", b)
}
