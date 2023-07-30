package engine_v2_tests

import (
	"crypto/ecdsa"
	"encoding/json"
	"math/big"
	"testing"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/accounts"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

func TestProcessQcShallSetForensicsCommittedQc(t *testing.T) {
	blockchain, _, currentBlock, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, 905, params.TestXDPoSMockChainConfig, nil)
	// PrepareQCandProcess(t, blockchain, currentBlock)

	engineV2 := blockchain.Engine().(*XDPoS.XDPoS).EngineV2

	// Assuming we are getting block 906 which have QC pointing at block 905
	blockInfo := &types.BlockInfo{
		Hash:   currentBlock.Hash(),
		Round:  types.Round(905),
		Number: big.NewInt(905),
	}
	voteForSign := &types.VoteForSign{
		ProposedBlockInfo: blockInfo,
		GapNumber:         450,
	}
	voteSigningHash := types.VoteSigHash(voteForSign)

	// Set round to 905
	engineV2.SetNewRoundFaker(blockchain, types.Round(905), false)
	// Create one vote messages which will not reach vote pool threshold
	signedHash, err := signFn(accounts.Account{Address: signer}, voteSigningHash.Bytes())
	assert.Nil(t, err)
	voteMsg := &types.Vote{
		ProposedBlockInfo: blockInfo,
		Signature:         signedHash,
		GapNumber:         450,
	}

	err = engineV2.VoteHandler(blockchain, voteMsg)
	assert.Nil(t, err)

	// Create a vote message that should trigger vote pool hook, but master-signed votes is not enough
	signedHash = SignHashByPK(acc2Key, voteSigningHash.Bytes())
	assert.Nil(t, err)
	voteMsg = &types.Vote{
		ProposedBlockInfo: blockInfo,
		Signature:         signedHash,
		GapNumber:         450,
	}
	err = engineV2.VoteHandler(blockchain, voteMsg)
	assert.Nil(t, err)

	// Create a vote message that should trigger vote pool hook, and master-signed votes is enough and increment the round to 6
	signedHash = SignHashByPK(acc3Key, voteSigningHash.Bytes())
	voteMsg = &types.Vote{
		ProposedBlockInfo: blockInfo,
		Signature:         signedHash,
		GapNumber:         450,
	}

	err = engineV2.VoteHandler(blockchain, voteMsg)
	assert.Nil(t, err)

	time.Sleep(5000 * time.Millisecond)
	assert.Equal(t, 3, len(engineV2.GetForensicsFaker().HighestCommittedQCs))
}

func TestSetCommittedQCsInOrder(t *testing.T) {
	blockchain, _, currentBlock, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 905, params.TestXDPoSMockChainConfig, nil)
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()

	var headers []types.Header
	var decodedExtraField types.ExtraFields_v2
	// Decode the qc1 and qc2
	err := utils.DecodeBytesExtraFields(currentBlock.Header().Extra, &decodedExtraField)
	assert.Nil(t, err)
	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(903), *blockchain.GetHeaderByNumber(902)), *decodedExtraField.QuorumCert)
	assert.NotNil(t, err)
	assert.Equal(t, "headers shall be on the same chain and in the right order", err.Error())

	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(903), *blockchain.GetHeaderByNumber(904)), *decodedExtraField.QuorumCert)
	assert.Nil(t, err)
	assert.Equal(t, 3, len(forensics.HighestCommittedQCs))

	// Test previous blocks
	err = utils.DecodeBytesExtraFields(blockchain.GetHeaderByNumber(904).Extra, &decodedExtraField)
	assert.Nil(t, err)
	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(902), *blockchain.GetHeaderByNumber(903)), *decodedExtraField.QuorumCert)
	assert.Nil(t, err)
	assert.Equal(t, 3, len(forensics.HighestCommittedQCs))
}

// Happty path
func TestForensicsMonitoring(t *testing.T) {
	blockchain, _, currentBlock, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 915, params.TestXDPoSMockChainConfig, nil)
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()
	var decodedCurrentblockExtraField types.ExtraFields_v2
	// Decode the QC from latest block
	err := utils.DecodeBytesExtraFields(currentBlock.Header().Extra, &decodedCurrentblockExtraField)
	assert.Nil(t, err)
	incomingQC := decodedCurrentblockExtraField.QuorumCert
	// Now, let's try set committed blocks, where the highestedCommitted blocks are 905, 906 and 907
	var headers []types.Header
	var decodedBlock905ExtraField types.ExtraFields_v2
	err = utils.DecodeBytesExtraFields(blockchain.GetHeaderByNumber(905).Extra, &decodedBlock905ExtraField)
	assert.Nil(t, err)

	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(903), *blockchain.GetHeaderByNumber(904)), *decodedBlock905ExtraField.QuorumCert)
	assert.Nil(t, err)
	var newIncomingQcHeaders []types.Header
	newIncomingQcHeaders = append(newIncomingQcHeaders, *blockchain.GetHeaderByNumber(913), *blockchain.GetHeaderByNumber(914))
	err = forensics.ForensicsMonitoring(blockchain, blockchain.Engine().(*XDPoS.XDPoS).EngineV2, newIncomingQcHeaders, *incomingQC)
	assert.Nil(t, err)
}

func TestForensicsMonitoringNotOnSameChainButHaveSameRoundQC(t *testing.T) {
	var numOfForks = new(int)
	*numOfForks = 10
	var forkRoundDifference = new(int)
	*forkRoundDifference = 1
	blockchain, _, _, _, _, currentForkBlock := PrepareXDCTestBlockChainForV2Engine(t, 915, params.TestXDPoSMockChainConfig, &ForkedBlockOptions{numOfForkedBlocks: numOfForks, forkedRoundDifference: forkRoundDifference})
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()

	// Now, let's try set committed blocks, where the highestedCommitted blocks are 913, 914 and 915
	var headers []types.Header
	var decodedBlock915ExtraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(blockchain.GetHeaderByNumber(915).Extra, &decodedBlock915ExtraField)
	assert.Nil(t, err)
	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(913), *blockchain.GetHeaderByNumber(914)), *decodedBlock915ExtraField.QuorumCert)
	assert.Nil(t, err)

	var decodedExtraField types.ExtraFields_v2
	// Decode the QC from forking chain
	err = utils.DecodeBytesExtraFields(currentForkBlock.Header().Extra, &decodedExtraField)
	assert.Nil(t, err)

	incomingQC := decodedExtraField.QuorumCert

	var forkedHeaders []types.Header
	parentOfForkedHeader := blockchain.GetBlockByHash(currentForkBlock.ParentHash()).Header()
	grandParentOfForkedHeader := blockchain.GetBlockByHash(parentOfForkedHeader.ParentHash).Header()
	forkedHeaders = append(forkedHeaders, *grandParentOfForkedHeader, *parentOfForkedHeader)

	// Set up forensics events trigger
	forensicsEventCh := make(chan types.ForensicsEvent)
	forensics.SubscribeForensicsEvent(forensicsEventCh)

	err = forensics.ForensicsMonitoring(blockchain, blockchain.Engine().(*XDPoS.XDPoS).EngineV2, forkedHeaders, *incomingQC)
	assert.Nil(t, err)

	// Check SendForensicProof triggered
	for {
		select {
		case forensics := <-forensicsEventCh:
			assert.NotNil(t, forensics.ForensicsProof)
			assert.Equal(t, "QC", forensics.ForensicsProof.ForensicsType)
			content := &types.ForensicsContent{}
			json.Unmarshal([]byte(forensics.ForensicsProof.Content), &content)
			assert.False(t, content.AcrossEpoch)
			assert.Equal(t, types.Round(913), content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Round)
			assert.Equal(t, uint64(913), content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Number.Uint64())
			assert.Equal(t, 9, len(content.SmallerRoundInfo.HashPath))
			assert.Equal(t, 5, len(content.SmallerRoundInfo.SignerAddresses))
			assert.Equal(t, types.Round(913), content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Round)
			assert.Equal(t, uint64(912), content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Number.Uint64())
			assert.Equal(t, 8, len(content.LargerRoundInfo.HashPath))
			assert.Equal(t, 5, len(content.LargerRoundInfo.SignerAddresses))
			return
		case <-time.After(5 * time.Second):
			t.FailNow()
		}
	}
}

func TestForensicsMonitoringNotOnSameChainDoNotHaveSameRoundQC(t *testing.T) {
	var numOfForks = new(int)
	*numOfForks = 10
	var forkRoundDifference = new(int)
	*forkRoundDifference = 10
	var forkedChainSignersKey []*ecdsa.PrivateKey
	forkedChainSignersKey = append(forkedChainSignersKey, acc1Key)
	blockchain, _, _, _, _, currentForkBlock := PrepareXDCTestBlockChainForV2Engine(t, 915, params.TestXDPoSMockChainConfig, &ForkedBlockOptions{numOfForkedBlocks: numOfForks, forkedRoundDifference: forkRoundDifference, signersKey: forkedChainSignersKey})
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()

	// Now, let's try set committed blocks, where the highestedCommitted blocks are 913, 914 and 915
	var headers []types.Header
	var decodedBlock915ExtraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(blockchain.GetHeaderByNumber(915).Extra, &decodedBlock915ExtraField)
	assert.Nil(t, err)
	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(913), *blockchain.GetHeaderByNumber(914)), *decodedBlock915ExtraField.QuorumCert)
	assert.Nil(t, err)

	var decodedExtraField types.ExtraFields_v2
	// Decode the QC from forking chain
	err = utils.DecodeBytesExtraFields(currentForkBlock.Header().Extra, &decodedExtraField)
	assert.Nil(t, err)

	incomingQC := decodedExtraField.QuorumCert
	var forkedHeaders []types.Header
	parentOfForkedHeader := blockchain.GetBlockByHash(currentForkBlock.ParentHash()).Header()
	grandParentOfForkedHeader := blockchain.GetBlockByHash(parentOfForkedHeader.ParentHash).Header()
	forkedHeaders = append(forkedHeaders, *grandParentOfForkedHeader, *parentOfForkedHeader)

	// Set up forensics events trigger
	forensicsEventCh := make(chan types.ForensicsEvent)
	forensics.SubscribeForensicsEvent(forensicsEventCh)

	err = forensics.ForensicsMonitoring(blockchain, blockchain.Engine().(*XDPoS.XDPoS).EngineV2, forkedHeaders, *incomingQC)
	assert.Nil(t, err)
	// Check SendForensicProof triggered
	for {
		select {
		case forensics := <-forensicsEventCh:
			assert.NotNil(t, forensics.ForensicsProof)
			assert.Equal(t, "QC", forensics.ForensicsProof.ForensicsType)
			content := &types.ForensicsContent{}
			json.Unmarshal([]byte(forensics.ForensicsProof.Content), &content)

			assert.False(t, content.AcrossEpoch)
			assert.Equal(t, types.Round(914), content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Round)
			assert.Equal(t, uint64(914), content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Number.Uint64())
			assert.Equal(t, 10, len(content.SmallerRoundInfo.HashPath))
			assert.Equal(t, 5, len(content.SmallerRoundInfo.SignerAddresses))
			assert.Equal(t, types.Round(916), content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Round)
			assert.Equal(t, uint64(906), content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Number.Uint64())
			assert.Equal(t, 2, len(content.LargerRoundInfo.HashPath))
			assert.Equal(t, 2, len(content.LargerRoundInfo.SignerAddresses))
			return
		case <-time.After(5 * time.Second):
			t.FailNow()
		}
	}
}

// "prone to attack" test where the "across epoch" field is true
func TestForensicsAcrossEpoch(t *testing.T) {
	var numOfForks = new(int)
	*numOfForks = 10
	var forkRoundDifference = new(int)
	*forkRoundDifference = 10
	var forkedChainSignersKey []*ecdsa.PrivateKey
	forkedChainSignersKey = append(forkedChainSignersKey, acc1Key)
	blockchain, _, _, _, _, currentForkBlock := PrepareXDCTestBlockChainForV2Engine(t, 1801, params.TestXDPoSMockChainConfig, &ForkedBlockOptions{numOfForkedBlocks: numOfForks, forkedRoundDifference: forkRoundDifference, signersKey: forkedChainSignersKey})
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()

	// Now, let's try set committed blocks, where the highestedCommitted blocks are 1799, 1800 and 1801
	var headers []types.Header
	var decodedBlock1801ExtraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(blockchain.GetHeaderByNumber(1801).Extra, &decodedBlock1801ExtraField)
	assert.Nil(t, err)
	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(1799), *blockchain.GetHeaderByNumber(1800)), *decodedBlock1801ExtraField.QuorumCert)
	assert.Nil(t, err)

	var decodedExtraField types.ExtraFields_v2
	// Decode the QC from forking chain
	err = utils.DecodeBytesExtraFields(currentForkBlock.Header().Extra, &decodedExtraField)
	assert.Nil(t, err)

	incomingQC := decodedExtraField.QuorumCert
	var forkedHeaders []types.Header
	parentOfForkedHeader := blockchain.GetBlockByHash(currentForkBlock.ParentHash()).Header()
	grandParentOfForkedHeader := blockchain.GetBlockByHash(parentOfForkedHeader.ParentHash).Header()
	forkedHeaders = append(forkedHeaders, *grandParentOfForkedHeader, *parentOfForkedHeader)

	// Set up forensics events trigger
	forensicsEventCh := make(chan types.ForensicsEvent)
	forensics.SubscribeForensicsEvent(forensicsEventCh)

	err = forensics.ForensicsMonitoring(blockchain, blockchain.Engine().(*XDPoS.XDPoS).EngineV2, forkedHeaders, *incomingQC)
	assert.Nil(t, err)
	// Check SendForensicProof triggered
	for {
		select {
		case forensics := <-forensicsEventCh:
			assert.NotNil(t, forensics.ForensicsProof)
			assert.Equal(t, "QC", forensics.ForensicsProof.ForensicsType)
			content := &types.ForensicsContent{}
			json.Unmarshal([]byte(forensics.ForensicsProof.Content), &content)

			idToCompare := content.DivergingBlockHash + ":" + content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Hash.Hex() + ":" + content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Hash.Hex()
			assert.Equal(t, idToCompare, forensics.ForensicsProof.Id)
			assert.True(t, content.AcrossEpoch)
			assert.Equal(t, types.Round(1800), content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Round)
			assert.Equal(t, uint64(1800), content.SmallerRoundInfo.QuorumCert.ProposedBlockInfo.Number.Uint64())
			assert.Equal(t, 10, len(content.SmallerRoundInfo.HashPath))
			assert.Equal(t, 5, len(content.SmallerRoundInfo.SignerAddresses))
			assert.Equal(t, types.Round(1802), content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Round)
			assert.Equal(t, uint64(1792), content.LargerRoundInfo.QuorumCert.ProposedBlockInfo.Number.Uint64())
			assert.Equal(t, 2, len(content.LargerRoundInfo.HashPath))
			assert.Equal(t, 2, len(content.LargerRoundInfo.SignerAddresses))
			return
		case <-time.After(5 * time.Second):
			t.FailNow()
		}
	}
}

func TestVoteEquivocationSameRound(t *testing.T) {
	var numOfForks = new(int)
	*numOfForks = 1
	blockchain, _, currentBlock, signer, signFn, currentForkBlock := PrepareXDCTestBlockChainForV2Engine(t, 901, params.TestXDPoSMockChainConfig, &ForkedBlockOptions{numOfForkedBlocks: numOfForks})
	engineV2 := blockchain.Engine().(*XDPoS.XDPoS).EngineV2
	// Set up forensics events trigger
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()
	forensicsEventCh := make(chan types.ForensicsEvent)
	forensics.SubscribeForensicsEvent(forensicsEventCh)
	// Set round to 905
	engineV2.SetNewRoundFaker(blockchain, types.Round(905), false)

	blockInfo := &types.BlockInfo{
		Hash:   currentBlock.Hash(),
		Round:  types.Round(905),
		Number: big.NewInt(901),
	}
	voteForSign := &types.VoteForSign{
		ProposedBlockInfo: blockInfo,
		GapNumber:         450,
	}
	voteSigningHash := types.VoteSigHash(voteForSign)
	signedHash, err := signFn(accounts.Account{Address: signer}, voteSigningHash.Bytes())
	assert.Nil(t, err)
	voteMsg := &types.Vote{
		ProposedBlockInfo: blockInfo,
		Signature:         signedHash,
		GapNumber:         450,
	}
	err = engineV2.VoteHandler(blockchain, voteMsg)
	assert.Nil(t, err)
	blockInfo = &types.BlockInfo{
		Hash:   currentForkBlock.Hash(),
		Round:  types.Round(905),
		Number: big.NewInt(901),
	}
	voteForSign = &types.VoteForSign{
		ProposedBlockInfo: blockInfo,
		GapNumber:         450,
	}
	voteSigningHash = types.VoteSigHash(voteForSign)
	signedHash, err = signFn(accounts.Account{Address: signer}, voteSigningHash.Bytes())
	assert.Nil(t, err)
	voteMsg = &types.Vote{
		ProposedBlockInfo: blockInfo,
		Signature:         signedHash,
		GapNumber:         450,
	}
	err = engineV2.VoteHandler(blockchain, voteMsg)
	assert.Nil(t, err)
	for {
		select {
		case msg := <-forensicsEventCh:
			assert.NotNil(t, msg.ForensicsProof)
			assert.Equal(t, "Vote", msg.ForensicsProof.ForensicsType)
			content := &types.VoteEquivocationContent{}
			json.Unmarshal([]byte(msg.ForensicsProof.Content), &content)
			assert.Equal(t, types.Round(905), content.SmallerRoundVote.ProposedBlockInfo.Round)
			assert.Equal(t, types.Round(905), content.LargerRoundVote.ProposedBlockInfo.Round)
			return
		case <-time.After(5 * time.Second):
			t.FailNow()
		}
	}
}

func TestVoteEquivocationDifferentRound(t *testing.T) {
	var numOfForks = new(int)
	*numOfForks = 10
	var forkRoundDifference = new(int)
	*forkRoundDifference = 1
	var forkedChainSignersKey []*ecdsa.PrivateKey
	forkedChainSignersKey = append(forkedChainSignersKey, acc1Key)
	blockchain, _, _, _, _, currentForkBlock := PrepareXDCTestBlockChainForV2Engine(t, 915, params.TestXDPoSMockChainConfig, &ForkedBlockOptions{numOfForkedBlocks: numOfForks, forkedRoundDifference: forkRoundDifference, signersKey: forkedChainSignersKey})
	forensics := blockchain.Engine().(*XDPoS.XDPoS).EngineV2.GetForensicsFaker()

	// Now, let's try set committed blocks, where the highestedCommitted blocks are 913, 914 and 915
	var headers []types.Header
	var decodedBlock915ExtraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(blockchain.GetHeaderByNumber(915).Extra, &decodedBlock915ExtraField)
	assert.Nil(t, err)
	err = forensics.SetCommittedQCs(append(headers, *blockchain.GetHeaderByNumber(913), *blockchain.GetHeaderByNumber(914)), *decodedBlock915ExtraField.QuorumCert)
	assert.Nil(t, err)

	// find fork block 913
	forkBlock913 := blockchain.GetBlockByHash(blockchain.GetBlockByHash(currentForkBlock.ParentHash()).ParentHash())
	var decodedExtraField types.ExtraFields_v2
	// Decode the QC from forking chain
	err = utils.DecodeBytesExtraFields(forkBlock913.Header().Extra, &decodedExtraField)
	assert.Nil(t, err)

	incomingQC := decodedExtraField.QuorumCert
	// choose just one vote from it
	voteForSign := &types.VoteForSign{ProposedBlockInfo: incomingQC.ProposedBlockInfo, GapNumber: incomingQC.GapNumber}
	voteForSign.ProposedBlockInfo.Round = types.Round(916)
	signature := SignHashByPK(acc1Key, types.VoteSigHash(voteForSign).Bytes())
	incomingVote := &types.Vote{ProposedBlockInfo: voteForSign.ProposedBlockInfo, Signature: signature, GapNumber: voteForSign.GapNumber}
	// Set up forensics events trigger
	forensicsEventCh := make(chan types.ForensicsEvent)
	forensics.SubscribeForensicsEvent(forensicsEventCh)

	err = forensics.ProcessVoteEquivocation(blockchain, blockchain.Engine().(*XDPoS.XDPoS).EngineV2, incomingVote)
	assert.Nil(t, err)
	// Check SendForensicProof triggered
	for {
		select {
		case msg := <-forensicsEventCh:
			assert.NotNil(t, msg.ForensicsProof)
			assert.Equal(t, "Vote", msg.ForensicsProof.ForensicsType)
			content := &types.VoteEquivocationContent{}
			json.Unmarshal([]byte(msg.ForensicsProof.Content), &content)
			assert.Equal(t, types.Round(914), content.SmallerRoundVote.ProposedBlockInfo.Round)
			assert.Equal(t, types.Round(916), content.LargerRoundVote.ProposedBlockInfo.Round)
			assert.Equal(t, acc1Addr, content.Signer)
			return
		case <-time.After(5 * time.Second):
			t.FailNow()
		}
	}
}
