// Copyright 2018 The go-ethereum Authors
// This file is part of the go-ethereum library.
//
// The go-ethereum library is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// The go-ethereum library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the go-ethereum library. If not, see <http://www.gnu.org/licenses/>.

package core_test

import (
	"context"
	"fmt"
	"io/ioutil"
	"math/big"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/signer/core"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

//Used for testing
type headlessUi struct {
	approveCh chan string // to send approve/deny
	inputCh   chan string // to send password
}

func (ui *headlessUi) OnInputRequired(info core.UserInputRequest) (core.UserInputResponse, error) {
	input := <-ui.inputCh
	return core.UserInputResponse{Text: input}, nil
}

func (ui *headlessUi) OnSignerStartup(info core.StartupInfo)  {}
func (ui *headlessUi) RegisterUIServer(api *core.UIServerAPI) {}

func (ui *headlessUi) ApproveTx(request *core.SignTxRequest) (core.SignTxResponse, error) {

	switch <-ui.approveCh {
	case "Y":
		return core.SignTxResponse{request.Transaction, true}, nil
	case "M": // modify
		// The headless UI always modifies the transaction
		old := big.Int(request.Transaction.Value)
		newVal := big.NewInt(0).Add(&old, big.NewInt(1))
		request.Transaction.Value = hexutil.Big(*newVal)
		return core.SignTxResponse{request.Transaction, true}, nil
	default:
		return core.SignTxResponse{request.Transaction, false}, nil
	}
}

func (ui *headlessUi) ApproveSignData(request *core.SignDataRequest) (core.SignDataResponse, error) {
	approved := (<-ui.approveCh == "Y")
	return core.SignDataResponse{approved}, nil
}

func (ui *headlessUi) ApproveListing(request *core.ListRequest) (core.ListResponse, error) {
	approval := <-ui.approveCh
	//fmt.Printf("approval %s\n", approval)
	switch approval {
	case "A":
		return core.ListResponse{request.Accounts}, nil
	case "1":
		l := make([]accounts.Account, 1)
		l[0] = request.Accounts[1]
		return core.ListResponse{l}, nil
	default:
		return core.ListResponse{nil}, nil
	}
}

func (ui *headlessUi) ApproveNewAccount(request *core.NewAccountRequest) (core.NewAccountResponse, error) {
	if <-ui.approveCh == "Y" {
		return core.NewAccountResponse{true}, nil
	}
	return core.NewAccountResponse{false}, nil
}

func (ui *headlessUi) ShowError(message string) {
	//stdout is used by communication
	fmt.Fprintln(os.Stderr, message)
}

func (ui *headlessUi) ShowInfo(message string) {
	//stdout is used by communication
	fmt.Fprintln(os.Stderr, message)
}

func tmpDirName(t *testing.T) string {
	d, err := ioutil.TempDir("", "eth-keystore-test")
	if err != nil {
		t.Fatal(err)
	}
	d, err = filepath.EvalSymlinks(d)
	if err != nil {
		t.Fatal(err)
	}
	return d
}

func createAccount(ui *headlessUi, api *core.SignerAPI, t *testing.T) {
	ui.approveCh <- "Y"
	ui.inputCh <- "a_long_password"
	_, err := api.New(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	// Some time to allow changes to propagate
	time.Sleep(250 * time.Millisecond)
}

func failCreateAccountWithPassword(ui *headlessUi, api *core.SignerAPI, password string, t *testing.T) {

	ui.approveCh <- "Y"
	// We will be asked three times to provide a suitable password
	ui.inputCh <- password
	ui.inputCh <- password
	ui.inputCh <- password

	addr, err := api.New(context.Background())
	if err == nil {
		t.Fatal("Should have returned an error")
	}
	if addr != (common.Address{}) {
		t.Fatal("Empty address should be returned")
	}
}

func failCreateAccount(ui *headlessUi, api *core.SignerAPI, t *testing.T) {
	ui.approveCh <- "N"
	addr, err := api.New(context.Background())
	if err != core.ErrRequestDenied {
		t.Fatal(err)
	}
	if addr != (common.Address{}) {
		t.Fatal("Empty address should be returned")
	}
}

func list(ui *headlessUi, api *core.SignerAPI, t *testing.T) ([]common.Address, error) {
	ui.approveCh <- "A"
	return api.List(context.Background())

}

func mkTestTx(from common.MixedcaseAddress) apitypes.SendTxArgs {
	to := common.NewMixedcaseAddress(common.HexToAddress("0x1337"))
	gas := hexutil.Uint64(21000)
	gasPrice := (hexutil.Big)(*big.NewInt(2000000000))
	value := (hexutil.Big)(*big.NewInt(1e18))
	nonce := (hexutil.Uint64)(0)
	data := hexutil.Bytes(common.Hex2Bytes("01020304050607080a"))
	tx := apitypes.SendTxArgs{
		From:     from,
		To:       &to,
		Gas:      gas,
		GasPrice: &gasPrice,
		Value:    value,
		Data:     &data,
		Nonce:    nonce}
	return tx
}
