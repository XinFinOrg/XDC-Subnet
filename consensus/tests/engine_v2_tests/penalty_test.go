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
	blockchain, _, block1348, signer, signFn := PrepareXDCTestBlockChainWith128Candidates(t, int(config.XDPoS.Epoch+config.XDPoS.Gap-2), conf)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	hooks.AttachConsensusV2Hooks(adaptor, blockchain, conf)
	assert.NotNil(t, adaptor.EngineV2.HookPenalty)
	header001 := blockchain.GetHeaderByNumber(1)
	masternodes := adaptor.GetMasternodesFromCheckpointHeader(header001)
	header450 := blockchain.GetHeaderByNumber(450)
	penalty, err := adaptor.EngineV2.HookPenalty(blockchain, header450.Number, header450.ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 0, len(penalty)) // we have all rounds, so no penalty

	block1349 := CreateBlock(blockchain, conf, block1348, 1349, 1358, signer.Hex(), signer, signFn, nil, nil, "5f6a0ed6ac6ae850b98fc00fab523a129a25dc64eb2a9bc475073d264989b876")
	err = blockchain.InsertBlock(block1349)
	assert.Nil(t, err)
	block1350 := CreateBlock(blockchain, conf, block1349, 1350, 1359, signer.Hex(), signer, signFn, nil, nil, "5f6a0ed6ac6ae850b98fc00fab523a129a25dc64eb2a9bc475073d264989b876")
	// the following penalty across two epochs: 1349 - 901, 900 - 450
	penalty, err = adaptor.EngineV2.HookPenalty(blockchain, block1350.Header().Number, block1350.Header().ParentHash, masternodes, config.XDPoS)
	assert.Nil(t, err)
	assert.Equal(t, 9, len(penalty)) // round 1349 - 1357 has no-show, total 9 masternodes
	// we have 4 miners created for all blocks, 3 is among 128 masternode candidates (test issue, no need to fix). So 125 candidates left are penalties
}
