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

func TestGetMissedRoundsInEpochByBlockNumReturnEmptyForV2(t *testing.T) {
	_, bc, cb, _, _ := PrepareXDCTestBlockChainWith128Candidates(t, 1802, params.TestXDPoSMockChainConfig)

	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockNum := rpc.BlockNumber(cb.NumberU64())

	data, err := engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(1800), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))

	blockNum = rpc.BlockNumber(1800)

	data, err = engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(1800), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))

	blockNum = rpc.BlockNumber(1801)

	data, err = engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(1800), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))
}

func TestGetMissedRoundsInEpochByBlockNumReturnEmptyForV2FistEpoch(t *testing.T) {
	_, bc, _, _, _ := PrepareXDCTestBlockChainWith128Candidates(t, 10, params.TestXDPoSMockChainConfig)

	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockNum := rpc.BlockNumber(2)

	data, err := engine.APIs(bc.GetBlockChain())[0].Service.(*XDPoS.API).GetMissedRoundsInEpochByBlockNum(&blockNum)

	assert.Nil(t, err)
	assert.Equal(t, types.Round(0), data.EpochRound)
	assert.Equal(t, big.NewInt(0), data.EpochBlockNumber)
	assert.Equal(t, 0, len(data.MissedRounds))
}

func TestGetMissedRoundsInEpochByBlockNum(t *testing.T) {
	blockchain, bc, currentBlock, signer, signFn := PrepareXDCTestBlockChainWith128Candidates(t, 1802, params.TestXDPoSMockChainConfig)
	chainConfig := params.TestXDPoSMockChainConfig
	engine := bc.GetBlockChain().Engine().(*XDPoS.XDPoS)
	blockCoinBase := signer.Hex()

	startingBlockNum := currentBlock.Number().Int64() + 1
	// Skipped the round
	roundNumber := startingBlockNum + 2
	block := CreateBlock(blockchain, chainConfig, currentBlock, int(startingBlockNum), roundNumber, blockCoinBase, signer, signFn, nil, nil, "c2bf7b59be5184fc1148be5db14692b2dc89a1b345895d3e8d0ee7b8a7607450")
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
	assert.Equal(t, types.Round(1800), data.EpochRound)
	assert.Equal(t, big.NewInt(1800), data.EpochBlockNumber)
	assert.Equal(t, 2, len(data.MissedRounds))
	assert.NotEmpty(t, data.MissedRounds[0].Miner)
	assert.Equal(t, data.MissedRounds[0].Round, types.Round(1803))
	assert.Equal(t, data.MissedRounds[0].CurrentBlockNum, big.NewInt(1803))
	assert.Equal(t, data.MissedRounds[0].ParentBlockNum, big.NewInt(1802))
	assert.NotEmpty(t, data.MissedRounds[1].Miner)
	assert.Equal(t, data.MissedRounds[1].Round, types.Round(1804))
	assert.Equal(t, data.MissedRounds[0].CurrentBlockNum, big.NewInt(1803))
	assert.Equal(t, data.MissedRounds[0].ParentBlockNum, big.NewInt(1802))

	assert.NotEqual(t, data.MissedRounds[0].Miner, data.MissedRounds[1].Miner)
}
