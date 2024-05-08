package engine_v2_tests

import (
	"math/big"
	"testing"

	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/XinFinOrg/XDC-Subnet/rpc"
	"github.com/stretchr/testify/assert"
)

func TestGetMissedRoundsInEpochByBlockNumOnlyForV2Consensus(t *testing.T) {
	_, bc, _, _, _ := PrepareXDCTestBlockChainWith128Candidates(t, 1802, params.TestXDPoSMockChainConfig)

	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockNum := rpc.BlockNumber(123)

	data, err := engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.EqualError(t, err, "Not supported in the v1 consensus")
	assert.Nil(t, data)
}

func TestGetMissedRoundsInEpochByBlockNumReturnEmptyForV2(t *testing.T) {
	_, bc, cb, _, _ := PrepareXDCTestBlockChainWith128Candidates(t, 1802, params.TestXDPoSMockChainConfig)

	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockNum := rpc.BlockNumber(cb.NumberU64())

	data, err := engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(900), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))

	blockNum = rpc.BlockNumber(1800)

	data, err = engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(900), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))

	blockNum = rpc.BlockNumber(1801)

	data, err = engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(900), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))
}

func TestGetMissedRoundsInEpochByBlockNumReturnEmptyForV2FistEpoch(t *testing.T) {
	_, bc, _, _, _ := PrepareXDCTestBlockChainWith128Candidates(t, 1802, params.TestXDPoSMockChainConfig)

	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockNum := rpc.BlockNumber(901)

	data, err := engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(1), data.EpochRound)
	assert.Equal(t, big.NewInt(901), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))
}

func TestGetMissedRoundsInEpochByBlockNum(t *testing.T) {
	blockchain, bc, currentBlock, signer, signFn := PrepareXDCTestBlockChainWith128Candidates(t, 1802, params.TestXDPoSMockChainConfig)
	chainConfig := params.TestXDPoSMockChainConfig
	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockCoinBase := signer.Hex()

	startingBlockNum := currentBlock.Number().Int64() + 1
	// Skipped the round
	roundNumber := startingBlockNum - chainConfig.XDPoS.V2.SwitchBlock.Int64() + 2
	block := CreateBlock(blockchain, chainConfig, currentBlock, int(startingBlockNum), roundNumber, blockCoinBase, signer, signFn, nil, nil, "b345a8560bd51926803dd17677c9f0751193914a851a4ec13063d6bf50220b53")
	err := blockchain.InsertBlock(block)
	if err != nil {
		t.Fatal(err)
	}

	// Update Signer as there is no previous signer assigned
	err = UpdateSigner(blockchain)
	if err != nil {
		t.Fatal(err)
	}

	blockNum := rpc.BlockNumber(1803)

	data, err := engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(900), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 2, len(data.MissedRounds))
	assert.NotEmpty(t, data.MissedRounds[0].Miner)
	assert.Equal(t, data.MissedRounds[0].Round, types.Round(903))
	assert.Equal(t, data.MissedRounds[0].CurrentBlockNum, big.NewInt(1803))
	assert.Equal(t, data.MissedRounds[0].ParentBlockNum, big.NewInt(1802))
	assert.NotEmpty(t, data.MissedRounds[1].Miner)
	assert.Equal(t, data.MissedRounds[1].Round, types.Round(904))
	assert.Equal(t, data.MissedRounds[0].CurrentBlockNum, big.NewInt(1803))
	assert.Equal(t, data.MissedRounds[0].ParentBlockNum, big.NewInt(1802))

	assert.NotEqual(t, data.MissedRounds[0].Miner, data.MissedRounds[1].Miner)
}
