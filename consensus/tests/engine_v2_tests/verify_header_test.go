package engine_v2_tests

import (
	"fmt"
	"math/big"
	"testing"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/accounts"
	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

func TestShouldVerifyBlock(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	config.XDPoS.V2.SkipV2Validation = false
	// Block 0 is the first v2 block with round of 0
	blockchain, _, _, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, 920, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	// Happy path
	happyPathHeader := blockchain.GetBlockByNumber(919).Header()
	err := adaptor.VerifyHeader(blockchain, happyPathHeader, true)
	assert.Nil(t, err)

	// Unhappy path

	nonEpochSwitchWithValidators := blockchain.GetBlockByNumber(902).Header()
	nonEpochSwitchWithValidators.Validators = []common.Address{acc1Addr}
	err = adaptor.VerifyHeader(blockchain, nonEpochSwitchWithValidators, true)
	assert.Equal(t, utils.ErrInvalidFieldInNonEpochSwitch, err)

	noValidatorBlock := blockchain.GetBlockByNumber(902).Header()
	noValidatorBlock.Validator = []byte{}
	err = adaptor.VerifyHeader(blockchain, noValidatorBlock, true)
	assert.Equal(t, consensus.ErrNoValidatorSignature, err)

	blockFromFuture := blockchain.GetBlockByNumber(902).Header()
	blockFromFuture.Time = big.NewInt(time.Now().Unix() + 10000)
	err = adaptor.VerifyHeader(blockchain, blockFromFuture, true)
	assert.Equal(t, consensus.ErrFutureBlock, err)

	invalidQcBlock := blockchain.GetBlockByNumber(902).Header()
	invalidQcBlock.Extra = []byte{2}
	err = adaptor.VerifyHeader(blockchain, invalidQcBlock, true)
	assert.Equal(t, utils.ErrInvalidV2Extra, err)

	// Epoch switch
	invalidAuthNonceBlock := blockchain.GetBlockByNumber(901).Header()
	invalidAuthNonceBlock.Nonce = types.BlockNonce{123}
	err = adaptor.VerifyHeader(blockchain, invalidAuthNonceBlock, true)
	assert.Equal(t, utils.ErrInvalidVote, err)

	emptyValidatorsBlock := blockchain.GetBlockByNumber(900).Header()
	emptyValidatorsBlock.Validators = []common.Address{}
	err = adaptor.VerifyHeader(blockchain, emptyValidatorsBlock, true)
	assert.Equal(t, utils.ErrEmptyEpochSwitchValidators, err)

	invalidValidatorsSignerBlock := blockchain.GetBlockByNumber(900).Header()
	invalidValidatorsSignerBlock.Validators = []common.Address{{123}}
	err = adaptor.VerifyHeader(blockchain, invalidValidatorsSignerBlock, true)
	assert.Equal(t, utils.ErrValidatorsNotLegit, err)

	// non-epoch switch
	invalidValidatorsExistBlock := blockchain.GetBlockByNumber(902).Header()
	invalidValidatorsExistBlock.Validators = []common.Address{{123}}
	err = adaptor.VerifyHeader(blockchain, invalidValidatorsExistBlock, true)
	assert.Equal(t, utils.ErrInvalidFieldInNonEpochSwitch, err)

	invalidPenaltiesExistBlock := blockchain.GetBlockByNumber(902).Header()
	invalidPenaltiesExistBlock.Penalties = []common.Address{{123}}
	err = adaptor.VerifyHeader(blockchain, invalidPenaltiesExistBlock, true)
	assert.Equal(t, utils.ErrInvalidFieldInNonGapPlusOneSwitch, err)

	merkleRoot := "b3e34cf1d3d80bcd2c5add880842892733e45979ddaf16e531f660fdf7ca5787"
	parentNotExistBlock := blockchain.GetBlockByNumber(901).Header()
	parentNotExistBlock.ParentHash = common.HexToHash(merkleRoot)
	err = adaptor.VerifyHeader(blockchain, parentNotExistBlock, true)
	assert.Equal(t, consensus.ErrUnknownAncestor, err)

	block901 := blockchain.GetBlockByNumber(901).Header()
	tooFastMinedBlock := blockchain.GetBlockByNumber(902).Header()
	tooFastMinedBlock.Time = big.NewInt(block901.Time.Int64() - 10)
	err = adaptor.VerifyHeader(blockchain, tooFastMinedBlock, true)
	assert.Equal(t, utils.ErrInvalidTimestamp, err)

	invalidDifficultyBlock := blockchain.GetBlockByNumber(902).Header()
	invalidDifficultyBlock.Difficulty = big.NewInt(2)
	err = adaptor.VerifyHeader(blockchain, invalidDifficultyBlock, true)
	assert.Equal(t, utils.ErrInvalidDifficulty, err)

	// Create an invalid QC round
	proposedBlockInfo := &types.BlockInfo{
		Hash:   blockchain.GetBlockByNumber(902).Hash(),
		Round:  types.Round(2),
		Number: blockchain.GetBlockByNumber(902).Number(),
	}
	voteForSign := &types.VoteForSign{
		ProposedBlockInfo: proposedBlockInfo,
		GapNumber:         450,
	}
	// Genrate QC
	signedHash, err := signFn(accounts.Account{Address: signer}, types.VoteSigHash(voteForSign).Bytes())
	if err != nil {
		panic(fmt.Errorf("Error generate QC by creating signedHash: %v", err))
	}
	// Sign from acc 1, 2, 3
	acc1SignedHash := SignHashByPK(acc1Key, types.VoteSigHash(voteForSign).Bytes())
	acc2SignedHash := SignHashByPK(acc2Key, types.VoteSigHash(voteForSign).Bytes())
	acc3SignedHash := SignHashByPK(acc3Key, types.VoteSigHash(voteForSign).Bytes())
	var signatures []types.Signature
	signatures = append(signatures, signedHash, acc1SignedHash, acc2SignedHash, acc3SignedHash)
	quorumCert := &types.QuorumCert{
		ProposedBlockInfo: proposedBlockInfo,
		Signatures:        signatures,
		GapNumber:         450,
	}

	extra := types.ExtraFields_v2{
		Round:      types.Round(2),
		QuorumCert: quorumCert,
	}
	extraInBytes, err := extra.EncodeToBytes()
	if err != nil {
		panic(fmt.Errorf("Error encode extra into bytes: %v", err))
	}

	invalidRoundBlock := blockchain.GetBlockByNumber(902).Header()
	invalidRoundBlock.Extra = extraInBytes
	err = adaptor.VerifyHeader(blockchain, invalidRoundBlock, true)
	assert.Equal(t, utils.ErrRoundInvalid, err)

	// Not valid validator
	coinbaseValidatorMismatchBlock := blockchain.GetBlockByNumber(902).Header()
	notQualifiedSigner, notQualifiedSignFn, err := getSignerAndSignFn(voterKey)
	assert.Nil(t, err)
	sealHeader(blockchain, coinbaseValidatorMismatchBlock, notQualifiedSigner, notQualifiedSignFn)
	err = adaptor.VerifyHeader(blockchain, coinbaseValidatorMismatchBlock, true)
	assert.Equal(t, utils.ErrCoinbaseAndValidatorMismatch, err)

	// Make the validators not legit by adding something to the validator
	validatorsNotLegit := blockchain.GetBlockByNumber(900).Header()
	validatorsNotLegit.Validators = append(validatorsNotLegit.Validators, acc1Addr)
	err = adaptor.VerifyHeader(blockchain, validatorsNotLegit, true)
	assert.Equal(t, utils.ErrValidatorsNotLegit, err)

	// Make the penalties not legit by adding something to the penalty
	penaltiesNotLegit := blockchain.GetBlockByNumber(901).Header()
	penaltiesNotLegit.Penalties = append(penaltiesNotLegit.Penalties, acc1Addr)
	err = adaptor.VerifyHeader(blockchain, penaltiesNotLegit, true)
	assert.Equal(t, utils.ErrInvalidFieldInNonGapPlusOneSwitch, err)
}

func TestConfigSwitchOnDifferentCertThreshold(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	config.XDPoS.V2.SkipV2Validation = false
	// Block 0 is the first v2 block with round of 0
	blockchain, _, _, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 915, config, nil)

	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	// Genrate 911 QC
	proposedBlockInfo := &types.BlockInfo{
		Hash:   blockchain.GetBlockByNumber(911).Hash(),
		Round:  types.Round(911),
		Number: blockchain.GetBlockByNumber(911).Number(),
	}
	voteForSign := &types.VoteForSign{
		ProposedBlockInfo: proposedBlockInfo,
		GapNumber:         450,
	}

	// Sign from acc 1, 2, 3
	acc1SignedHash := SignHashByPK(acc1Key, types.VoteSigHash(voteForSign).Bytes())
	acc2SignedHash := SignHashByPK(acc2Key, types.VoteSigHash(voteForSign).Bytes())
	acc3SignedHash := SignHashByPK(acc3Key, types.VoteSigHash(voteForSign).Bytes())
	var signaturesFirst []types.Signature
	signaturesFirst = append(signaturesFirst, acc1SignedHash, acc2SignedHash, acc3SignedHash)
	quorumCert := &types.QuorumCert{
		ProposedBlockInfo: proposedBlockInfo,
		Signatures:        signaturesFirst,
		GapNumber:         450,
	}

	extra := types.ExtraFields_v2{
		Round:      types.Round(912),
		QuorumCert: quorumCert,
	}
	extraInBytes, _ := extra.EncodeToBytes()

	// after 910 require 5 signs, but we only give 3 signs
	block912 := blockchain.GetBlockByNumber(912).Header()
	block912.Extra = extraInBytes
	err := adaptor.VerifyHeader(blockchain, block912, true)

	assert.Equal(t, utils.ErrInvalidQCSignatures, err)

	// Make we verification process use the corresponding config
	// Genrate 910 QC
	proposedBlockInfo = &types.BlockInfo{
		Hash:   blockchain.GetBlockByNumber(910).Hash(),
		Round:  types.Round(910),
		Number: blockchain.GetBlockByNumber(910).Number(),
	}
	voteForSign = &types.VoteForSign{
		ProposedBlockInfo: proposedBlockInfo,
		GapNumber:         450,
	}

	// Sign from acc 1, 2, 3
	acc1SignedHash = SignHashByPK(acc1Key, types.VoteSigHash(voteForSign).Bytes())
	acc2SignedHash = SignHashByPK(acc2Key, types.VoteSigHash(voteForSign).Bytes())
	acc3SignedHash = SignHashByPK(acc3Key, types.VoteSigHash(voteForSign).Bytes())

	var signaturesThr []types.Signature
	signaturesThr = append(signaturesThr, acc1SignedHash, acc2SignedHash, acc3SignedHash)
	quorumCert = &types.QuorumCert{
		ProposedBlockInfo: proposedBlockInfo,
		Signatures:        signaturesThr,
		GapNumber:         450,
	}

	extra = types.ExtraFields_v2{
		Round:      types.Round(911),
		QuorumCert: quorumCert,
	}
	extraInBytes, _ = extra.EncodeToBytes()

	// QC contains 910, so it requires 3 signatures, not use block number to determine which config to use
	block911 := blockchain.GetBlockByNumber(911).Header()
	block911.Extra = extraInBytes
	err = adaptor.VerifyHeader(blockchain, block911, true)

	// error ErrValidatorNotWithinMasternodes means verifyQC is passed and move to next verification process
	assert.Equal(t, utils.ErrValidatorNotWithinMasternodes, err)
}

func TestConfigSwitchOnDifferentMindPeriod(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	// Enable verify
	config.XDPoS.V2.SkipV2Validation = false
	// Block 0 is the first v2 block with round of 0
	blockchain, _, _, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 915, config, nil)

	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	// Genrate 911 QC
	proposedBlockInfo := &types.BlockInfo{
		Hash:   blockchain.GetBlockByNumber(911).Hash(),
		Round:  types.Round(11),
		Number: blockchain.GetBlockByNumber(911).Number(),
	}
	voteForSign := &types.VoteForSign{
		ProposedBlockInfo: proposedBlockInfo,
		GapNumber:         450,
	}

	// Sign from acc 1, 2, 3
	acc1SignedHash := SignHashByPK(acc1Key, types.VoteSigHash(voteForSign).Bytes())
	acc2SignedHash := SignHashByPK(acc2Key, types.VoteSigHash(voteForSign).Bytes())
	acc3SignedHash := SignHashByPK(acc3Key, types.VoteSigHash(voteForSign).Bytes())
	var signaturesFirst []types.Signature
	signaturesFirst = append(signaturesFirst, acc1SignedHash, acc2SignedHash, acc3SignedHash)
	quorumCert := &types.QuorumCert{
		ProposedBlockInfo: proposedBlockInfo,
		Signatures:        signaturesFirst,
		GapNumber:         450,
	}

	extra := types.ExtraFields_v2{
		Round:      types.Round(12),
		QuorumCert: quorumCert,
	}
	extraInBytes, _ := extra.EncodeToBytes()

	// after 910 require 5 signs, but we only give 3 signs
	block911 := blockchain.GetBlockByNumber(911).Header()
	block911.Extra = extraInBytes
	block911.Time = big.NewInt(blockchain.GetBlockByNumber(910).Time().Int64() + 2) //2 is previous config, should get the right config from round
	err := adaptor.VerifyHeader(blockchain, block911, true)

	assert.Equal(t, utils.ErrInvalidTimestamp, err)
}

func TestShouldFailIfNotEnoughQCSignatures(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	// Enable verify
	config.XDPoS.V2.SkipV2Validation = false
	// Block 0 is the first v2 block with round of 0
	blockchain, _, currentBlock, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, 902, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	parentBlock := blockchain.GetBlockByNumber(901)
	proposedBlockInfo := &types.BlockInfo{
		Hash:   parentBlock.Hash(),
		Round:  types.Round(1),
		Number: parentBlock.Number(),
	}
	voteForSign := &types.VoteForSign{
		ProposedBlockInfo: proposedBlockInfo,
		GapNumber:         450,
	}
	signedHash, err := signFn(accounts.Account{Address: signer}, types.VoteSigHash(voteForSign).Bytes())
	assert.Nil(t, err)
	var signatures []types.Signature
	// Duplicate the signatures
	signatures = append(signatures, signedHash, signedHash, signedHash, signedHash, signedHash, signedHash)
	quorumCert := &types.QuorumCert{
		ProposedBlockInfo: proposedBlockInfo,
		Signatures:        signatures,
		GapNumber:         450,
	}

	extra := types.ExtraFields_v2{
		Round:      types.Round(2),
		QuorumCert: quorumCert,
	}
	extraInBytes, err := extra.EncodeToBytes()
	if err != nil {
		panic(fmt.Errorf("Error encode extra into bytes: %v", err))
	}
	headerWithDuplicatedSignatures := currentBlock.Header()
	headerWithDuplicatedSignatures.Extra = extraInBytes
	// Happy path
	err = adaptor.VerifyHeader(blockchain, headerWithDuplicatedSignatures, true)
	assert.Equal(t, utils.ErrInvalidQCSignatures, err)

}

func TestShouldVerifyHeaders(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	// Enable verify
	config.XDPoS.V2.SkipV2Validation = false
	// Block 0 is the first v2 block with round of 0
	blockchain, _, _, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 20, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	// Happy path
	var happyPathHeaders []*types.Header
	happyPathHeaders = append(happyPathHeaders, blockchain.GetBlockByNumber(16).Header(), blockchain.GetBlockByNumber(17).Header(), blockchain.GetBlockByNumber(18).Header(), blockchain.GetBlockByNumber(19).Header())
	// Randomly set full verify
	var fullVerifies []bool
	fullVerifies = append(fullVerifies, false, true, true, false)
	_, results := adaptor.VerifyHeaders(blockchain, happyPathHeaders, fullVerifies)
	var verified []bool
	for {
		select {
		case result := <-results:
			if result != nil {
				panic("Error received while verifying headers")
			}
			verified = append(verified, true)
		case <-time.After(time.Duration(5) * time.Second): // It should be very fast to verify headers
			if len(verified) == len(happyPathHeaders) {
				return
			} else {
				panic("Suppose to have verified 4 block headers")
			}
		}
	}
}

func TestShouldVerifyHeadersEvenIfParentsNotYetWrittenIntoDB(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	// Enable verify
	config.XDPoS.V2.SkipV2Validation = false
	// Block 0 is the first v2 block with round of 0
	blockchain, _, block919, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, 919, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	var headersTobeVerified []*types.Header

	// Create block 920 but don't write into DB
	blockNumber := 920
	roundNumber := int64(blockNumber) + 19 // for current round turn this signer
	block920 := CreateBlock(blockchain, config, block919, blockNumber, roundNumber, signer.Hex(), signer, signFn, nil, nil, "")

	// Create block 921 and not write into DB as well
	blockNumber = 921
	roundNumber = int64(blockNumber) + 38
	block921 := CreateBlock(blockchain, config, block920, blockNumber, roundNumber, signer.Hex(), signer, signFn, nil, nil, "")

	headersTobeVerified = append(headersTobeVerified, block919.Header(), block920.Header(), block921.Header())
	// Randomly set full verify
	var fullVerifies []bool
	fullVerifies = append(fullVerifies, true, true, true)
	_, results := adaptor.VerifyHeaders(blockchain, headersTobeVerified, fullVerifies)

	var verified []bool
	for {
		select {
		case result := <-results:
			if result != nil {
				panic("Error received while verifying headers")
			}
			verified = append(verified, true)
		case <-time.After(time.Duration(5) * time.Second): // It should be very fast to verify headers
			if len(verified) == len(headersTobeVerified) {
				return
			} else {
				panic("Suppose to have verified 3 block headers")
			}
		}
	}
}
