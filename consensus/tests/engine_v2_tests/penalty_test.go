package engine_v2_tests

import (
	"encoding/json"
	"testing"

	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/eth/hooks"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

func TestHookPenaltyV2TwoEpoch(t *testing.T) {
	b, err := json.Marshal(params.TestXDPoSMockChainConfig)
	assert.Nil(t, err)
	configString := string(b)

	var config params.ChainConfig
	err = json.Unmarshal([]byte(configString), &config)
	assert.Nil(t, err)
	// set V2 switch to 0
	config.XDPoS.V2.SwitchBlock.SetUint64(0)
	conf := &config
	blockchain, _, block1350, _, _ := PrepareXDCTestBlockChainWith128Candidates(t, int(config.XDPoS.Epoch+config.XDPoS.Gap), conf)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	hooks.AttachConsensusV2Hooks(adaptor, blockchain, conf)
	assert.NotNil(t, adaptor.EngineV2.HookPenalty)
	header001 := blockchain.GetHeaderByNumber(1)
	masternodes := adaptor.GetMasternodesFromCheckpointHeader(header001)
	header450 := blockchain.GetHeaderByNumber(450)
	penalty, err := adaptor.EngineV2.HookPenalty(blockchain, header450.Number, header450.ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 125, len(penalty)) // we have 4 miners created for all blocks, 3 is among 128 masternode candidates (test issue, no need to fix). So 125 candidates left are penalties
	// the following penalty across two epochs: 1349 - 901, 900 - 450
	penalty, err = adaptor.EngineV2.HookPenalty(blockchain, block1350.Header().Number, block1350.Header().ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 125, len(penalty)) // we have 4 miners created for all blocks, 3 is among 128 masternode candidates (test issue, no need to fix). So 125 candidates left are penalties
}
