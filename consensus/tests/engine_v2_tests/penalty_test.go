package engine_v2_tests

import (
	"testing"

	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/eth/hooks"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

/*
func TestHookPenaltyV2Comeback(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, _, signer, signFn := PrepareXDCTestBlockChainWithPenaltyForV2Engine(t, int(config.XDPoS.Epoch)*3, config)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	hooks.AttachConsensusV2Hooks(adaptor, blockchain, config)
	assert.NotNil(t, adaptor.EngineV2.HookPenalty)
	var extraField types.ExtraFields_v2
	// 901 is the first v2 block
	header901 := blockchain.GetHeaderByNumber(config.XDPoS.Epoch + 1)
	err := utils.DecodeBytesExtraFields(header901.Extra, &extraField)
	assert.Nil(t, err)
	masternodes := adaptor.GetMasternodesFromCheckpointHeader(header901)
	assert.Equal(t, 5, len(masternodes))
	header2100 := blockchain.GetHeaderByNumber(config.XDPoS.Epoch * 3)
	penalty, err := adaptor.EngineV2.HookPenalty(blockchain, big.NewInt(int64(config.XDPoS.Epoch*3)), header2100.ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	// miner (coinbase) is in comeback. so all addresses are in penalty
	assert.Equal(t, 2, len(penalty))
	header2085 := blockchain.GetHeaderByNumber(config.XDPoS.Epoch*3 - common.MergeSignRange)
	// forcely insert signing tx into cache, to cancel comeback. since no comeback, penalty is 3
	tx, err := signingTxWithSignerFn(header2085, 0, signer, signFn)
	assert.Nil(t, err)
	adaptor.CacheSigningTxs(header2085.Hash(), []*types.Transaction{tx})
	penalty, err = adaptor.EngineV2.HookPenalty(blockchain, big.NewInt(int64(config.XDPoS.Epoch*3)), header2100.ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 1, len(penalty))
}
*/
func TestHookPenaltyV2Jump(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	end := int(config.XDPoS.Epoch)*3 - common.MergeSignRange
	blockchain, _, _, _, _ := PrepareXDCTestBlockChainWithPenaltyForV2Engine(t, int(config.XDPoS.Epoch)*3, config)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	hooks.AttachConsensusV2Hooks(adaptor, blockchain, config)
	assert.NotNil(t, adaptor.EngineV2.HookPenalty)
	var extraField types.ExtraFields_v2
	// 901 is the first v2 block
	header901 := blockchain.GetHeaderByNumber(config.XDPoS.Epoch + 1)
	err := utils.DecodeBytesExtraFields(header901.Extra, &extraField)
	assert.Nil(t, err)
	masternodes := adaptor.GetMasternodesFromCheckpointHeader(header901)
	assert.Equal(t, 5, len(masternodes))
	header2685 := blockchain.GetHeaderByNumber(uint64(end))
	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(config.XDPoS.Epoch*3), false)
	// round 2685-2700 miss blocks, penalty should work as usual
	penalty, err := adaptor.EngineV2.HookPenalty(blockchain, header2685.Number, header2685.ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 2, len(penalty))
}

// Test calculate penalty under startRange blocks, currently is 150
func TestHookPenaltyV2LessThen150Blocks(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, _, _, _ := PrepareXDCTestBlockChainWithPenaltyForV2Engine(t, int(config.XDPoS.Epoch)*3, config)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	hooks.AttachConsensusV2Hooks(adaptor, blockchain, config)
	assert.NotNil(t, adaptor.EngineV2.HookPenalty)
	var extraField types.ExtraFields_v2
	// 901 is the first v2 block
	header901 := blockchain.GetHeaderByNumber(config.XDPoS.Epoch + 1)
	err := utils.DecodeBytesExtraFields(header901.Extra, &extraField)
	assert.Nil(t, err)
	masternodes := adaptor.GetMasternodesFromCheckpointHeader(header901)
	assert.Equal(t, 5, len(masternodes))
	header1900 := blockchain.GetHeaderByNumber(1900)
	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(config.XDPoS.Epoch*3), false)
	// penalty count from 1900
	penalty, err := adaptor.EngineV2.HookPenalty(blockchain, header1900.Number, header1900.ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 2, len(penalty))
}

func TestGetPenalties(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, _, _, _ := PrepareXDCTestBlockChainWithPenaltyForV2Engine(t, int(config.XDPoS.Epoch)*3, config)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	header2699 := blockchain.GetHeaderByNumber(2699)
	header1801 := blockchain.GetHeaderByNumber(1801)

	penalty2699 := adaptor.EngineV2.GetPenalties(blockchain, header2699)
	penalty1801 := adaptor.EngineV2.GetPenalties(blockchain, header1801)

	assert.Equal(t, 1, len(penalty2699))
	assert.Equal(t, 1, len(penalty1801))
}
