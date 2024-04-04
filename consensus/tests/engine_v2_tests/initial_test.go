package engine_v2_tests

import (
	"testing"

	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

func TestInitialFirstV2Block(t *testing.T) {
	blockchain, _, currentBlock, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 1, params.TestXDPoSMockChainConfig, nil)
	PrepareQCandProcess(t, blockchain, currentBlock)

	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	header := currentBlock.Header()

	snap, _ := adaptor.EngineV2.GetSnapshot(blockchain, currentBlock.Header())
	assert.NotNil(t, snap)

	err := adaptor.EngineV2.Initial(blockchain, header)
	assert.Nil(t, err)

	round, _, highQC, _, _, _ := adaptor.EngineV2.GetPropertiesFaker()
	blockInfo := &types.BlockInfo{
		Hash:   header.Hash(),
		Round:  types.Round(1),
		Number: header.Number,
	}
	expectedQuorumCert := &types.QuorumCert{
		ProposedBlockInfo: blockInfo,
		Signatures:        nil,
		GapNumber:         0,
	}
	assert.Equal(t, types.Round(2), round)
	assert.Equal(t, expectedQuorumCert, highQC)

	// Test snapshot
	snap, err = adaptor.EngineV2.GetSnapshot(blockchain, currentBlock.Header())
	assert.Nil(t, err)
	assert.Equal(t, uint64(0), snap.Number)

	// Test Running channels
	minePeriod := <-adaptor.MinePeriodCh
	assert.Equal(t, params.TestXDPoSMockChainConfig.XDPoS.V2.CurrentConfig.MinePeriod, minePeriod)

	t.Logf("Waiting %d secs for timeout to happen", params.TestXDPoSMockChainConfig.XDPoS.V2.CurrentConfig.TimeoutPeriod)
	timeoutMsg := <-adaptor.EngineV2.BroadcastCh
	assert.NotNil(t, timeoutMsg)
	assert.Equal(t, types.Round(2), timeoutMsg.(*types.Timeout).Round)
}

func TestSnapshotShouldAlreadyCreatedByUpdateM1(t *testing.T) {
	// insert new block with new extra fields
	blockchain, _, currentBlock, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 1800, params.TestXDPoSMockChainConfig, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	snap, err := adaptor.EngineV2.GetSnapshot(blockchain, currentBlock.Header())
	assert.Nil(t, err)
	assert.Equal(t, uint64(1350), snap.Number)
}
