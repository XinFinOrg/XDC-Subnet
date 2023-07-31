package engine_v2_tests

import (
	"math/big"
	"testing"

	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

func TestSyncInfoShouldSuccessfullyUpdateByQC(t *testing.T) {
	// Block 0 is the first v2 block with starting round of 0
	blockchain, _, currentBlock, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 5, params.TestXDPoSMockChainConfig, nil)
	engineV2 := blockchain.Engine().(*XDPoS.XDPoS).EngineV2

	var extraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(currentBlock.Extra(), &extraField)
	if err != nil {
		t.Fatal("Fail to decode extra data", err)
	}

	syncInfoMsg := &types.SyncInfo{
		HighestQuorumCert: extraField.QuorumCert,
		HighestTimeoutCert: &types.TimeoutCert{
			Round:      types.Round(2),
			Signatures: []types.Signature{},
		},
	}

	err = engineV2.SyncInfoHandler(blockchain, syncInfoMsg)
	if err != nil {
		t.Fatal(err)
	}
	round, _, highestQuorumCert, _, _, highestCommitBlock := engineV2.GetPropertiesFaker()
	// QC is parent block's qc, which is pointing at round 4, hence 4 + 1 = 5
	assert.Equal(t, types.Round(5), round)
	assert.Equal(t, extraField.QuorumCert, highestQuorumCert)
	assert.Equal(t, types.Round(2), highestCommitBlock.Round)
	assert.Equal(t, big.NewInt(2), highestCommitBlock.Number)
}

func TestSyncInfoShouldSuccessfullyUpdateByTC(t *testing.T) {
	// Block 0 is the first v2 block with starting round of 0
	blockchain, _, currentBlock, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 5, params.TestXDPoSMockChainConfig, nil)
	engineV2 := blockchain.Engine().(*XDPoS.XDPoS).EngineV2

	var extraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(currentBlock.Extra(), &extraField)
	if err != nil {
		t.Fatal("Fail to decode extra data", err)
	}

	highestTC := &types.TimeoutCert{
		Round:      types.Round(6),
		Signatures: []types.Signature{},
	}

	syncInfoMsg := &types.SyncInfo{
		HighestQuorumCert:  extraField.QuorumCert,
		HighestTimeoutCert: highestTC,
	}

	err = engineV2.SyncInfoHandler(blockchain, syncInfoMsg)
	if err != nil {
		t.Fatal(err)
	}
	round, _, highestQuorumCert, _, _, _ := engineV2.GetPropertiesFaker()
	assert.Equal(t, types.Round(7), round)
	assert.Equal(t, extraField.QuorumCert, highestQuorumCert)
}

func TestSkipVerifySyncInfoIfBothQcTcNotQualified(t *testing.T) {
	blockchain, _, _, _, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 5, params.TestXDPoSMockChainConfig, nil)
	engineV2 := blockchain.Engine().(*XDPoS.XDPoS).EngineV2

	// Make the Highest QC in syncInfo point to an old block to simulate it's no longer qualified
	parentBlock := blockchain.GetBlockByNumber(3)
	var extraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(parentBlock.Extra(), &extraField)
	if err != nil {
		t.Fatal("Fail to decode extra data", err)
	}

	highestTC := &types.TimeoutCert{
		Round:      types.Round(5),
		Signatures: []types.Signature{},
	}

	syncInfoMsg := &types.SyncInfo{
		HighestQuorumCert:  extraField.QuorumCert,
		HighestTimeoutCert: highestTC,
	}

	engineV2.SetPropertiesFaker(syncInfoMsg.HighestQuorumCert, syncInfoMsg.HighestTimeoutCert)

	verified, err := engineV2.VerifySyncInfoMessage(blockchain, syncInfoMsg)
	assert.False(t, verified)
	assert.Nil(t, err)
}
