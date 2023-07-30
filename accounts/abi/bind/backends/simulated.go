// Copyright 2015 The go-ethereum Authors
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

package backends

import (
	"context"
	"errors"
	"fmt"
	"io/ioutil"
	"math/big"
	"os"
	"sync"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/core/rawdb"

	XDPoSChain "github.com/XinFinOrg/XDC-Subnet"
	"github.com/XinFinOrg/XDC-Subnet/accounts"
	"github.com/XinFinOrg/XDC-Subnet/accounts/abi/bind"
	"github.com/XinFinOrg/XDC-Subnet/accounts/keystore"
	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/common/math"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"

	"github.com/XinFinOrg/XDC-Subnet/consensus/ethash"
	"github.com/XinFinOrg/XDC-Subnet/core"
	"github.com/XinFinOrg/XDC-Subnet/core/bloombits"
	"github.com/XinFinOrg/XDC-Subnet/core/state"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/core/vm"
	"github.com/XinFinOrg/XDC-Subnet/eth/filters"
	"github.com/XinFinOrg/XDC-Subnet/ethdb"
	"github.com/XinFinOrg/XDC-Subnet/event"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/XinFinOrg/XDC-Subnet/rpc"
)

// This nil assignment ensures compile time that SimulatedBackend implements bind.ContractBackend.
var _ bind.ContractBackend = (*SimulatedBackend)(nil)

var errBlockNumberUnsupported = errors.New("SimulatedBackend cannot access blocks other than the latest block")
var errGasEstimationFailed = errors.New("gas required exceeds allowance or always failing transaction")

// SimulatedBackend implements bind.ContractBackend, simulating a blockchain in
// the background. Its main purpose is to allow easily testing contract bindings.
type SimulatedBackend struct {
	database   ethdb.Database   // In memory database to store our testing data
	blockchain *core.BlockChain // Ethereum blockchain to handle the consensus

	mu           sync.Mutex
	pendingBlock *types.Block   // Currently pending block that will be imported on request
	pendingState *state.StateDB // Currently pending state that will be the active on on request

	events *filters.EventSystem // Event system for filtering log events live

	config *params.ChainConfig
}

func SimulateWalletAddressAndSignFn(path string) (common.Address, func(account accounts.Account, hash []byte) ([]byte, error), error) {
	veryLightScryptN := 2
	veryLightScryptP := 1
	dir, _ := ioutil.TempDir("", "eth-SimulateWalletAddressAndSignFn-test")

	new := func(kd string) *keystore.KeyStore {
		return keystore.NewKeyStore(kd, veryLightScryptN, veryLightScryptP)
	}

	defer os.RemoveAll(dir)
	ks := new(dir)
	pass := "" // not used but required by API
	var a1 accounts.Account

	// Read the JSON file
	jsonData, err := ioutil.ReadFile(path) // currently only for v2 test
	if err != nil {
		a1, err = ks.NewAccount(pass)
		if err != nil {
			return common.Address{}, nil, fmt.Errorf(err.Error())
		}
	} else {
		a1, err = ks.Import(jsonData, pass, pass)
		if err != nil {
			return common.Address{}, nil, fmt.Errorf(err.Error())
		}
	}

	if err != nil {
		return common.Address{}, nil, fmt.Errorf(err.Error())
	}
	if err := ks.Unlock(a1, ""); err != nil {
		return a1.Address, nil, fmt.Errorf(err.Error())
	}
	return a1.Address, ks.SignHash, nil
}

// XDC simulated backend for testing purpose.
func NewXDCSimulatedBackend(alloc core.GenesisAlloc, gasLimit uint64, chainConfig *params.ChainConfig) *SimulatedBackend {
	// database := ethdb.NewMemDatabase()
	database := rawdb.NewMemoryDatabase()

	genesis := core.Genesis{
		GasLimit:  gasLimit, // need this big, support initial smart contract
		Config:    chainConfig,
		Alloc:     alloc,
		ExtraData: append(make([]byte, 32), make([]byte, 65)...),
	}
	genesis.MustCommit(database)
	consensus := XDPoS.NewFaker(database, chainConfig)

	blockchain, err := core.NewBlockChain(database, nil, genesis.Config, consensus, vm.Config{})
	if err != nil {
		panic(err) // This cannot happen unless the simulator is wrong, fail in that case
	}

	backend := &SimulatedBackend{
		database:   database,
		blockchain: blockchain,
		config:     genesis.Config,
		events:     filters.NewEventSystem(new(event.TypeMux), &filterBackend{database, blockchain}, false),
	}

	go func() {
		for range core.CheckpointCh {
			<-core.CheckpointCh
		}
	}()

	blockchain.Client = backend
	backend.rollback()
	return backend
}

// NewSimulatedBackend creates a new binding backend using a simulated blockchain
// for testing purposes.
func NewSimulatedBackend(alloc core.GenesisAlloc) *SimulatedBackend {
	database := rawdb.NewMemoryDatabase()
	genesis := core.Genesis{Config: params.AllEthashProtocolChanges, Alloc: alloc, GasLimit: 42000000}
	genesis.MustCommit(database)
	blockchain, _ := core.NewBlockChain(database, nil, genesis.Config, ethash.NewFaker(), vm.Config{})

	backend := &SimulatedBackend{
		database:   database,
		blockchain: blockchain,
		config:     genesis.Config,
		events:     filters.NewEventSystem(new(event.TypeMux), &filterBackend{database, blockchain}, false),
	}
	backend.rollback()
	return backend
}

// Commit imports all the pending transactions as a single block and starts a
// fresh new state.
func (b *SimulatedBackend) Commit() {
	b.mu.Lock()
	defer b.mu.Unlock()

	if _, err := b.blockchain.InsertChain([]*types.Block{b.pendingBlock}); err != nil {
		panic(err) // This cannot happen unless the simulator is wrong, fail in that case
	}
	b.rollback()
}

// Rollback aborts all pending transactions, reverting to the last committed state.
func (b *SimulatedBackend) Rollback() {
	b.mu.Lock()
	defer b.mu.Unlock()

	b.rollback()
}

func (b *SimulatedBackend) rollback() {
	blocks, _ := core.GenerateChain(b.config, b.blockchain.CurrentBlock(), b.blockchain.Engine(), b.database, 1, func(int, *core.BlockGen) {})
	statedb, _ := b.blockchain.State()

	b.pendingBlock = blocks[0]
	b.pendingState, _ = state.New(b.pendingBlock.Root(), statedb.Database())
}

// CodeAt returns the code associated with a certain account in the blockchain.
func (b *SimulatedBackend) CodeAt(ctx context.Context, contract common.Address, blockNumber *big.Int) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if blockNumber != nil && blockNumber.Cmp(b.blockchain.CurrentBlock().Number()) != 0 {
		return nil, errBlockNumberUnsupported
	}
	statedb, _ := b.blockchain.State()
	return statedb.GetCode(contract), nil
}

// BalanceAt returns the wei balance of a certain account in the blockchain.
func (b *SimulatedBackend) BalanceAt(ctx context.Context, contract common.Address, blockNumber *big.Int) (*big.Int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if blockNumber != nil && blockNumber.Cmp(b.blockchain.CurrentBlock().Number()) != 0 {
		return nil, errBlockNumberUnsupported
	}
	statedb, _ := b.blockchain.State()
	return statedb.GetBalance(contract), nil
}

// NonceAt returns the nonce of a certain account in the blockchain.
func (b *SimulatedBackend) NonceAt(ctx context.Context, contract common.Address, blockNumber *big.Int) (uint64, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if blockNumber != nil && blockNumber.Cmp(b.blockchain.CurrentBlock().Number()) != 0 {
		return 0, errBlockNumberUnsupported
	}
	statedb, _ := b.blockchain.State()
	return statedb.GetNonce(contract), nil
}

// StorageAt returns the value of key in the storage of an account in the blockchain.
func (b *SimulatedBackend) StorageAt(ctx context.Context, contract common.Address, key common.Hash, blockNumber *big.Int) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if blockNumber != nil && blockNumber.Cmp(b.blockchain.CurrentBlock().Number()) != 0 {
		return nil, errBlockNumberUnsupported
	}
	statedb, _ := b.blockchain.State()
	val := statedb.GetState(contract, key)
	return val[:], nil
}

// ForEachStorageAt returns func to read all keys, values in the storage
func (b *SimulatedBackend) ForEachStorageAt(ctx context.Context, contract common.Address, blockNumber *big.Int, f func(key, val common.Hash) bool) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	if blockNumber != nil && blockNumber.Cmp(b.blockchain.CurrentBlock().Number()) != 0 {
		return errBlockNumberUnsupported
	}
	statedb, _ := b.blockchain.State()
	statedb.ForEachStorage(contract, f)
	return nil
}

// TransactionReceipt returns the receipt of a transaction.
func (b *SimulatedBackend) TransactionReceipt(ctx context.Context, txHash common.Hash) (*types.Receipt, error) {
	receipt, _, _, _ := core.GetReceipt(b.database, txHash)
	return receipt, nil
}

// PendingCodeAt returns the code associated with an account in the pending state.
func (b *SimulatedBackend) PendingCodeAt(ctx context.Context, contract common.Address) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.pendingState.GetCode(contract), nil
}

// CallContract executes a contract call.
func (b *SimulatedBackend) CallContract(ctx context.Context, call XDPoSChain.CallMsg, blockNumber *big.Int) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if blockNumber != nil && blockNumber.Cmp(b.blockchain.CurrentBlock().Number()) != 0 {
		return nil, errBlockNumberUnsupported
	}
	state, err := b.blockchain.State()
	if err != nil {
		return nil, err
	}
	rval, _, _, err := b.callContract(ctx, call, b.blockchain.CurrentBlock(), state)
	return rval, err
}

// PendingCallContract executes a contract call on the pending state.
func (b *SimulatedBackend) PendingCallContract(ctx context.Context, call XDPoSChain.CallMsg) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	defer b.pendingState.RevertToSnapshot(b.pendingState.Snapshot())

	rval, _, _, err := b.callContract(ctx, call, b.pendingBlock, b.pendingState)
	return rval, err
}

// PendingNonceAt implements PendingStateReader.PendingNonceAt, retrieving
// the nonce currently pending for the account.
func (b *SimulatedBackend) PendingNonceAt(ctx context.Context, account common.Address) (uint64, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	return b.pendingState.GetOrNewStateObject(account).Nonce(), nil
}

// SuggestGasPrice implements ContractTransactor.SuggestGasPrice. Since the simulated
// chain doens't have miners, we just return a gas price of 1 for any call.
func (b *SimulatedBackend) SuggestGasPrice(ctx context.Context) (*big.Int, error) {
	return big.NewInt(1), nil
}

// EstimateGas executes the requested code against the currently pending block/state and
// returns the used amount of gas.
func (b *SimulatedBackend) EstimateGas(ctx context.Context, call XDPoSChain.CallMsg) (uint64, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	// Determine the lowest and highest possible gas limits to binary search in between
	var (
		lo  uint64 = params.TxGas - 1
		hi  uint64
		cap uint64
	)
	if call.Gas >= params.TxGas {
		hi = call.Gas
	} else {
		hi = b.pendingBlock.GasLimit()
	}
	cap = hi

	// Create a helper to check if a gas allowance results in an executable transaction
	executable := func(gas uint64) bool {
		call.Gas = gas

		snapshot := b.pendingState.Snapshot()
		_, _, failed, err := b.callContract(ctx, call, b.pendingBlock, b.pendingState)
		b.pendingState.RevertToSnapshot(snapshot)

		if err != nil || failed {
			return false
		}
		return true
	}
	// Execute the binary search and hone in on an executable gas limit
	for lo+1 < hi {
		mid := (hi + lo) / 2
		if !executable(mid) {
			lo = mid
		} else {
			hi = mid
		}
	}
	// Reject the transaction as invalid if it still fails at the highest allowance
	if hi == cap {
		if !executable(hi) {
			return 0, errGasEstimationFailed
		}
	}
	return hi, nil
}

// callContract implements common code between normal and pending contract calls.
// state is modified during execution, make sure to copy it if necessary.
func (b *SimulatedBackend) callContract(ctx context.Context, call XDPoSChain.CallMsg, block *types.Block, statedb *state.StateDB) ([]byte, uint64, bool, error) {
	// Ensure message is initialized properly.
	if call.GasPrice == nil {
		call.GasPrice = big.NewInt(1)
	}
	if call.Gas == 0 {
		call.Gas = 50000000
	}
	if call.Value == nil {
		call.Value = new(big.Int)
	}
	// Set infinite balance to the fake caller account.
	from := statedb.GetOrNewStateObject(call.From)
	from.SetBalance(math.MaxBig256)
	// Execute the call.
	msg := callmsg{call}
	feeCapacity := state.GetTRC21FeeCapacityFromState(statedb)
	if msg.To() != nil {
		if value, ok := feeCapacity[*msg.To()]; ok {
			msg.CallMsg.BalanceTokenFee = value
		}
	}
	evmContext := core.NewEVMContext(msg, block.Header(), b.blockchain, nil)
	// Create a new environment which holds all relevant information
	// about the transaction and calling mechanisms.
	vmenv := vm.NewEVM(evmContext, statedb, nil, b.config, vm.Config{})
	gaspool := new(core.GasPool).AddGas(math.MaxUint64)
	owner := common.Address{}
	return core.NewStateTransition(vmenv, msg, gaspool).TransitionDb(owner)
}

// SendTransaction updates the pending block to include the given transaction.
// It panics if the transaction is invalid.
func (b *SimulatedBackend) SendTransaction(ctx context.Context, tx *types.Transaction) error {
	b.mu.Lock()
	defer b.mu.Unlock()

	sender, err := types.Sender(types.HomesteadSigner{}, tx)
	if err != nil {
		panic(fmt.Errorf("invalid transaction: %v", err))
	}
	nonce := b.pendingState.GetNonce(sender)
	if tx.Nonce() != nonce {
		panic(fmt.Errorf("invalid transaction nonce: got %d, want %d", tx.Nonce(), nonce))
	}

	blocks, _ := core.GenerateChain(b.config, b.blockchain.CurrentBlock(), b.blockchain.Engine(), b.database, 1, func(number int, block *core.BlockGen) {
		for _, tx := range b.pendingBlock.Transactions() {
			block.AddTxWithChain(b.blockchain, tx)
		}
		block.AddTxWithChain(b.blockchain, tx)
	})
	statedb, _ := b.blockchain.State()

	b.pendingBlock = blocks[0]
	b.pendingState, _ = state.New(b.pendingBlock.Root(), statedb.Database())
	return nil
}

// FilterLogs executes a log filter operation, blocking during execution and
// returning all the results in one batch.
//
// TODO(karalabe): Deprecate when the subscription one can return past data too.
func (b *SimulatedBackend) FilterLogs(ctx context.Context, query XDPoSChain.FilterQuery) ([]types.Log, error) {
	// Initialize unset filter boundaried to run from genesis to chain head
	from := int64(0)
	if query.FromBlock != nil {
		from = query.FromBlock.Int64()
	}
	to := int64(-1)
	if query.ToBlock != nil {
		to = query.ToBlock.Int64()
	}
	// Construct and execute the filter
	filter := filters.New(&filterBackend{b.database, b.blockchain}, from, to, query.Addresses, query.Topics)

	logs, err := filter.Logs(ctx)
	if err != nil {
		return nil, err
	}
	res := make([]types.Log, len(logs))
	for i, log := range logs {
		res[i] = *log
	}
	return res, nil
}

// SubscribeFilterLogs creates a background log filtering operation, returning a
// subscription immediately, which can be used to stream the found events.
func (b *SimulatedBackend) SubscribeFilterLogs(ctx context.Context, query XDPoSChain.FilterQuery, ch chan<- types.Log) (XDPoSChain.Subscription, error) {
	// Subscribe to contract events
	sink := make(chan []*types.Log)

	sub, err := b.events.SubscribeLogs(query, sink)
	if err != nil {
		return nil, err
	}
	// Since we're getting logs in batches, we need to flatten them into a plain stream
	return event.NewSubscription(func(quit <-chan struct{}) error {
		defer sub.Unsubscribe()
		for {
			select {
			case logs := <-sink:
				for _, log := range logs {
					select {
					case ch <- *log:
					case err := <-sub.Err():
						return err
					case <-quit:
						return nil
					}
				}
			case err := <-sub.Err():
				return err
			case <-quit:
				return nil
			}
		}
	}), nil
}

// AdjustTime adds a time shift to the simulated clock.
func (b *SimulatedBackend) AdjustTime(adjustment time.Duration) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	blocks, _ := core.GenerateChain(b.config, b.blockchain.CurrentBlock(), b.blockchain.Engine(), b.database, 1, func(number int, block *core.BlockGen) {
		// blocks, _ := core.GenerateChain(b.config, b.blockchain.CurrentBlock(), b.blockchain.Engine(), b.database, 1, func(number int, block *core.BlockGen) {
		for _, tx := range b.pendingBlock.Transactions() {
			block.AddTx(tx)
		}
		block.OffsetTime(int64(adjustment.Seconds()))
	})
	statedb, _ := b.blockchain.State()

	b.pendingBlock = blocks[0]
	b.pendingState, _ = state.New(b.pendingBlock.Root(), statedb.Database())

	return nil
}

func (b *SimulatedBackend) GetBlockChain() *core.BlockChain {
	return b.blockchain
}

// callmsg implements core.Message to allow passing it as a transaction simulator.
type callmsg struct {
	XDPoSChain.CallMsg
}

func (m callmsg) From() common.Address      { return m.CallMsg.From }
func (m callmsg) Nonce() uint64             { return 0 }
func (m callmsg) CheckNonce() bool          { return false }
func (m callmsg) To() *common.Address       { return m.CallMsg.To }
func (m callmsg) GasPrice() *big.Int        { return m.CallMsg.GasPrice }
func (m callmsg) Gas() uint64               { return m.CallMsg.Gas }
func (m callmsg) Value() *big.Int           { return m.CallMsg.Value }
func (m callmsg) Data() []byte              { return m.CallMsg.Data }
func (m callmsg) BalanceTokenFee() *big.Int { return m.CallMsg.BalanceTokenFee }

// filterBackend implements filters.Backend to support filtering for logs without
// taking bloom-bits acceleration structures into account.
type filterBackend struct {
	db ethdb.Database
	bc *core.BlockChain
}

func (fb *filterBackend) ChainDb() ethdb.Database  { return fb.db }
func (fb *filterBackend) EventMux() *event.TypeMux { panic("not supported") }

func (fb *filterBackend) HeaderByNumber(ctx context.Context, block rpc.BlockNumber) (*types.Header, error) {
	if block == rpc.LatestBlockNumber {
		return fb.bc.CurrentHeader(), nil
	}
	return fb.bc.GetHeaderByNumber(uint64(block.Int64())), nil
}

func (fb *filterBackend) GetReceipts(ctx context.Context, hash common.Hash) (types.Receipts, error) {
	return core.GetBlockReceipts(fb.db, hash, core.GetBlockNumber(fb.db, hash)), nil
}

func (fb *filterBackend) GetLogs(ctx context.Context, hash common.Hash) ([][]*types.Log, error) {
	receipts := core.GetBlockReceipts(fb.db, hash, core.GetBlockNumber(fb.db, hash))
	if receipts == nil {
		return nil, nil
	}
	logs := make([][]*types.Log, len(receipts))
	for i, receipt := range receipts {
		logs[i] = receipt.Logs
	}
	return logs, nil
}

func (fb *filterBackend) SubscribeTxPreEvent(ch chan<- core.TxPreEvent) event.Subscription {
	return event.NewSubscription(func(quit <-chan struct{}) error {
		<-quit
		return nil
	})
}
func (fb *filterBackend) SubscribeChainEvent(ch chan<- core.ChainEvent) event.Subscription {
	return fb.bc.SubscribeChainEvent(ch)
}
func (fb *filterBackend) SubscribeRemovedLogsEvent(ch chan<- core.RemovedLogsEvent) event.Subscription {
	return fb.bc.SubscribeRemovedLogsEvent(ch)
}
func (fb *filterBackend) SubscribeLogsEvent(ch chan<- []*types.Log) event.Subscription {
	return fb.bc.SubscribeLogsEvent(ch)
}

func (fb *filterBackend) BloomStatus() (uint64, uint64) { return 4096, 0 }
func (fb *filterBackend) ServiceFilter(ctx context.Context, ms *bloombits.MatcherSession) {
	panic("not supported")
}
