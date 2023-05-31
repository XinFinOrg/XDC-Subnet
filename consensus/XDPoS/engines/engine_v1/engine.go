package engine_v1

import (
	"math/big"
	"sync"

	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus"

	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/consensus/clique"
	"github.com/XinFinOrg/XDC-Subnet/core/state"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/ethdb"
	"github.com/XinFinOrg/XDC-Subnet/params"
	lru "github.com/hashicorp/golang-lru"
)

const (
	// timeout waiting for M1
	waitPeriod = 10
	// timeout for checkpoint.
	waitPeriodCheckpoint = 20
)

// XDPoS is the delegated-proof-of-stake consensus engine proposed to support the
// Ethereum testnet following the Ropsten attacks.
type XDPoS_v1 struct {
	chainConfig *params.ChainConfig // Chain & network configuration

	config *params.XDPoSConfig // Consensus engine configuration parameters
	db     ethdb.Database      // Database to store and retrieve snapshot checkpoints

	recents             *lru.ARCCache // Snapshots for recent block to speed up reorgs
	signatures          *lru.ARCCache // Signatures of recent blocks to speed up mining
	validatorSignatures *lru.ARCCache // Signatures of recent blocks to speed up mining
	verifiedHeaders     *lru.ARCCache
	proposals           map[common.Address]bool // Current list of proposals we are pushing

	signer common.Address  // Ethereum address of the signing key
	signFn clique.SignerFn // Signer function to authorize hashes with
	lock   sync.RWMutex    // Protects the signer fields

	HookReward            func(chain consensus.ChainReader, state *state.StateDB, parentState *state.StateDB, header *types.Header) (error, map[string]interface{})
	HookPenalty           func(chain consensus.ChainReader, blockNumberEpoc uint64) ([]common.Address, error)
	HookPenaltyTIPSigning func(chain consensus.ChainReader, header *types.Header, candidate []common.Address) ([]common.Address, error)
	HookValidator         func(header *types.Header, signers []common.Address) ([]byte, error)
	HookVerifyMNs         func(header *types.Header, signers []common.Address) error

	HookGetSignersFromContract func(blockHash common.Hash) ([]common.Address, error)
}

/*
	V1 Block

SignerFn is a signer callback function to request a hash to be signed by a
backing account.
type SignerFn func(accounts.Account, []byte) ([]byte, error)

sigHash returns the hash which is used as input for the delegated-proof-of-stake
signing. It is the hash of the entire header apart from the 65 byte signature
contained at the end of the extra data.

Note, the method requires the extra data to be at least 65 bytes, otherwise it
panics. This is done to avoid accidentally using both forms (signature present
or not), which could be abused to produce different hashes for the same header.
*/
func (x *XDPoS_v1) SigHash(header *types.Header) (hash common.Hash) {
	return common.Hash{}
}

// New creates a XDPoS delegated-proof-of-stake consensus engine with the initial
// signers set to the ones provided by the user.
func New(chainConfig *params.ChainConfig, db ethdb.Database) *XDPoS_v1 {
	return &XDPoS_v1{}
}

// Author implements consensus.Engine, returning the Ethereum address recovered
// from the signature in the header's extra-data section.
func (x *XDPoS_v1) Author(header *types.Header) (common.Address, error) {
	return common.Address{}, nil
}

// VerifyHeader checks whether a header conforms to the consensus rules.
func (x *XDPoS_v1) VerifyHeader(chain consensus.ChainReader, header *types.Header, fullVerify bool) error {
	return nil
}

// VerifyHeaders is similar to VerifyHeader, but verifies a batch of headers. The
// method returns a quit channel to abort the operations and a results channel to
// retrieve the async verifications (the order is that of the input slice).
func (x *XDPoS_v1) VerifyHeaders(chain consensus.ChainReader, headers []*types.Header, fullVerifies []bool, abort <-chan struct{}, results chan<- error) {
}

func (x *XDPoS_v1) verifyHeaderWithCache(chain consensus.ChainReader, header *types.Header, parents []*types.Header, fullVerify bool) error {
	return nil
}

func (x *XDPoS_v1) IsAuthorisedAddress(chain consensus.ChainReader, header *types.Header, address common.Address) bool {
	return false
}

func (x *XDPoS_v1) GetSnapshot(chain consensus.ChainReader, header *types.Header) (*SnapshotV1, error) {
	return nil, nil
}

func (x *XDPoS_v1) GetAuthorisedSignersFromSnapshot(chain consensus.ChainReader, header *types.Header) ([]common.Address, error) {
	return nil, nil
}

func (x *XDPoS_v1) StoreSnapshot(snap *SnapshotV1) error {
	return nil
}

func (x *XDPoS_v1) GetMasternodes(chain consensus.ChainReader, header *types.Header) []common.Address {
	return []common.Address{}
}

func (x *XDPoS_v1) GetCurrentEpochSwitchBlock(blockNumber *big.Int) (uint64, uint64, error) {
	return 0, 0, nil
}

func (x *XDPoS_v1) GetPeriod() uint64 { return x.config.Period }

func (x *XDPoS_v1) YourTurn(chain consensus.ChainReader, parent *types.Header, signer common.Address) (bool, error) {
	return false, nil
}

func (x *XDPoS_v1) VerifyUncles(chain consensus.ChainReader, block *types.Block) error {
	return nil
}

// VerifySeal implements consensus.Engine, checking whether the signature contained
// in the header satisfies the consensus protocol requirements.
func (x *XDPoS_v1) VerifySeal(chain consensus.ChainReader, header *types.Header) error {
	return nil
}

func (x *XDPoS_v1) GetValidator(creator common.Address, chain consensus.ChainReader, header *types.Header) (common.Address, error) {
	return common.Address{}, nil
}

// Prepare implements consensus.Engine, preparing all the consensus fields of the
// header for running the transactions on top.
func (x *XDPoS_v1) Prepare(chain consensus.ChainReader, header *types.Header) error {
	return nil
}

// Update masternodes into snapshot. In V1, truncating ms[:MaxMasternodes] is done in this function.
func (x *XDPoS_v1) UpdateMasternodes(chain consensus.ChainReader, header *types.Header, ms []utils.Masternode) error {
	return nil
}

// Finalize implements consensus.Engine, ensuring no uncles are set, nor block
// rewards given, and returns the final block.
func (x *XDPoS_v1) Finalize(chain consensus.ChainReader, header *types.Header, state *state.StateDB, parentState *state.StateDB, txs []*types.Transaction, uncles []*types.Header, receipts []*types.Receipt) (*types.Block, error) {
	return nil, nil
}

// Authorize injects a private key into the consensus engine to mint new blocks
// with.
func (x *XDPoS_v1) Authorize(signer common.Address, signFn clique.SignerFn) {
	x.lock.Lock()
	defer x.lock.Unlock()

	x.signer = signer
	x.signFn = signFn
}

// Seal implements consensus.Engine, attempting to create a sealed block using
// the local signing credentials.
func (x *XDPoS_v1) Seal(chain consensus.ChainReader, block *types.Block, stop <-chan struct{}) (*types.Block, error) {
	return nil, nil
}

// CalcDifficulty is the difficulty adjustment algorithm. It returns the difficulty
// that a new block should have based on the previous blocks in the chain and the
// current signer.
func (x *XDPoS_v1) CalcDifficulty(chain consensus.ChainReader, time uint64, parent *types.Header) *big.Int {
	return nil
}

func (x *XDPoS_v1) RecoverSigner(header *types.Header) (common.Address, error) {
	return common.Address{}, nil
}

func (x *XDPoS_v1) RecoverValidator(header *types.Header) (common.Address, error) {
	return common.Address{}, nil
}

// Get master nodes over extra data of checkpoint block.
func (x *XDPoS_v1) GetMasternodesFromCheckpointHeader(checkpointHeader *types.Header) []common.Address {
	return []common.Address{}
}

func (x *XDPoS_v1) GetDb() ethdb.Database {
	return x.db
}

func NewFaker(db ethdb.Database, chainConfig *params.ChainConfig) *XDPoS_v1 {
	return &XDPoS_v1{}
}

// Epoch Switch is also known as checkpoint in v1
func (x *XDPoS_v1) IsEpochSwitch(header *types.Header) (bool, uint64, error) {
	return false, 0, nil
}
