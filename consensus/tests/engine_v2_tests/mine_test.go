package engine_v2_tests

import (
	"encoding/json"
	"fmt"
	"math/big"
	"testing"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/params"
	"github.com/stretchr/testify/assert"
)

func TestYourTurnInitialV2(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, parentBlock, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, int(config.XDPoS.Epoch)-1, config, nil)
	minePeriod := config.XDPoS.V2.CurrentConfig.MinePeriod
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	// Insert block 900
	t.Logf("Inserting block with propose at 900...")
	blockCoinbaseA := "0xaaa0000000000000000000000000000000000900"
	//Get from block validator error message
	merkleRoot := "1eaab4c8345e5f3d419c4b69e05216a7745ba659317c81e984b7acf63201aff8"
	header := &types.Header{
		Root:       common.HexToHash(merkleRoot),
		Number:     big.NewInt(int64(900)),
		ParentHash: parentBlock.Hash(),
		Coinbase:   common.HexToAddress(blockCoinbaseA),
		Extra:      parentBlock.Extra(),
	}
	block900, err := createBlockFromHeader(blockchain, header, nil, signer, signFn, config)
	if err != nil {
		t.Fatal(err)
	}
	err = blockchain.InsertBlock(block900)
	assert.Nil(t, err)
	time.Sleep(time.Duration(minePeriod) * time.Second)

	// YourTurn is called before mine first v2 block
	b, err := adaptor.YourTurn(blockchain, block900.Header(), common.HexToAddress("xdc0000000000000000000000000000000000003031"))
	assert.Nil(t, err)
	assert.False(t, b)
	b, err = adaptor.YourTurn(blockchain, block900.Header(), common.HexToAddress("xdc0000000000000000000000000000000000003132"))
	assert.Nil(t, err)
	// round=1, so masternode[1] has YourTurn = True
	assert.True(t, b)
	assert.Equal(t, adaptor.EngineV2.GetCurrentRoundFaker(), types.Round(900))

	snap, err := adaptor.EngineV2.GetSnapshot(blockchain, block900.Header())
	assert.Nil(t, err)
	assert.NotNil(t, snap)
}

func TestShouldMineOncePerRound(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, block910, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, 910, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	minePeriod := config.XDPoS.V2.CurrentConfig.MinePeriod

	// Make sure we seal the parentBlock 910
	_, err := adaptor.Seal(blockchain, block910, nil)
	assert.Nil(t, err)
	time.Sleep(time.Duration(minePeriod) * time.Second)
	merkleRoot := "1eaab4c8345e5f3d419c4b69e05216a7745ba659317c81e984b7acf63201aff8"

	header := &types.Header{
		Root:       common.HexToHash(merkleRoot),
		Number:     big.NewInt(int64(911)),
		ParentHash: block910.Hash(),
	}

	header.Extra = generateV2Extra(911, block910, signer, signFn, nil)

	block911, err := createBlockFromHeader(blockchain, header, nil, signer, signFn, blockchain.Config())
	if err != nil {
		t.Fatal(err)
	}

	_, err = adaptor.Seal(blockchain, block911, nil)
	assert.Nil(t, err)
	b, err := adaptor.YourTurn(blockchain, block910.Header(), signer)
	assert.False(t, b)
	assert.Equal(t, utils.ErrAlreadyMined, err)
}

func TestUpdateMasterNodes(t *testing.T) {
	b, err := json.Marshal(params.TestXDPoSMockChainConfig)
	assert.Nil(t, err)
	configString := string(b)

	var config params.ChainConfig
	err = json.Unmarshal([]byte(configString), &config)
	assert.Nil(t, err)
	// set switch to 0
	config.XDPoS.V2.SwitchBlock.SetUint64(0)
	blockchain, _, currentBlock, signer, signFn, _ := PrepareXDCTestBlockChainForV2Engine(t, int(config.XDPoS.Epoch+config.XDPoS.Gap)-1, &config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	x := adaptor.EngineV2
	snap, err := x.GetSnapshot(blockchain, currentBlock.Header())

	assert.Nil(t, err)
	assert.Equal(t, 450, int(snap.Number))

	// Insert block 1350
	t.Logf("Inserting block with propose at 1350...")
	blockCoinbaseA := "0xaaa0000000000000000000000000000000001350"
	// NOTE: voterAddr never exist in the Masternode list, but all acc1,2,3 already does
	tx, err := voteTX(37117, 0, voterAddr.String())
	if err != nil {
		t.Fatal(err)
	}
	//Get from block validator error message
	stateRoot := "14aa8934c9fcd31dfa8eb6272448c82bba62e1fd6fd3e049e9ef9be3748c7ba4"
	header := &types.Header{
		Root:       common.HexToHash(stateRoot),
		Number:     big.NewInt(int64(1350)),
		ParentHash: currentBlock.Hash(),
		Coinbase:   common.HexToAddress(blockCoinbaseA),
	}

	header.Extra = generateV2Extra(450, currentBlock, signer, signFn, nil)

	parentBlock, err := createBlockFromHeader(blockchain, header, []*types.Transaction{tx}, signer, signFn, &config)
	assert.Nil(t, err)
	err = blockchain.InsertBlock(parentBlock)
	assert.Nil(t, err)
	// 1350 is a gap block, need to update the snapshot
	err = blockchain.UpdateM1()
	assert.Nil(t, err)
	t.Logf("Inserting block from 1351 to 1800...")
	for i := 1351; i <= 1800; i++ {
		blockCoinbase := fmt.Sprintf("0xaaa000000000000000000000000000000000%4d", i)
		//Get from block validator error message
		header = &types.Header{
			Root:       common.HexToHash(stateRoot),
			Number:     big.NewInt(int64(i)),
			ParentHash: parentBlock.Hash(),
			Coinbase:   common.HexToAddress(blockCoinbase),
		}

		header.Extra = generateV2Extra(int64(i), currentBlock, signer, signFn, nil)

		block, err := createBlockFromHeader(blockchain, header, nil, signer, signFn, &config)
		if err != nil {
			t.Fatal(err)
		}
		err = blockchain.InsertBlock(block)
		assert.Nil(t, err)
		parentBlock = block
	}

	snap, err = x.GetSnapshot(blockchain, parentBlock.Header())

	assert.Nil(t, err)
	assert.True(t, snap.IsMasterNodes(voterAddr))
	assert.Equal(t, int(snap.Number), 1350)
}

func TestPrepareFail(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, currentBlock, signer, _, _ := PrepareXDCTestBlockChainForV2Engine(t, int(config.XDPoS.Epoch), config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)

	tstamp := time.Now().Unix()

	notReadyToProposeHeader := &types.Header{
		ParentHash: currentBlock.ParentHash(),
		Number:     big.NewInt(int64(901)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
		Coinbase:   signer,
	}

	err := adaptor.Prepare(blockchain, notReadyToProposeHeader)
	assert.Equal(t, consensus.ErrNotReadyToPropose, err)

	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(18), false)

	notReadyToMine := &types.Header{
		ParentHash: currentBlock.Hash(),
		Number:     big.NewInt(int64(901)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
		Coinbase:   signer,
	}
	// trigger initial which will set the highestQC
	_, err = adaptor.YourTurn(blockchain, currentBlock.Header(), signer)
	assert.Nil(t, err)
	err = adaptor.Prepare(blockchain, notReadyToMine)
	assert.Equal(t, consensus.ErrNotReadyToMine, err)

	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(19), false)
	header901WithoutCoinbase := &types.Header{
		ParentHash: currentBlock.Hash(),
		Number:     big.NewInt(int64(901)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
	}

	err = adaptor.Prepare(blockchain, header901WithoutCoinbase)
	assert.Equal(t, consensus.ErrCoinbaseMismatch, err)
}

func TestPrepareHappyPath(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, currentBlock, signer, _, _ := PrepareXDCTestBlockChainForV2Engine(t, int(config.XDPoS.Epoch)-1, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	// trigger initial
	_, err := adaptor.YourTurn(blockchain, currentBlock.Header(), signer)
	assert.Nil(t, err)

	tstamp := time.Now().Unix()

	header900 := &types.Header{
		ParentHash: currentBlock.Hash(),
		Number:     big.NewInt(int64(900)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
		Coinbase:   signer,
	}

	snap, err := adaptor.EngineV2.GetSnapshot(blockchain, header900)
	if err != nil {
		t.Fatal(err)
	}

	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(903), false) // round 903 is this signer's turn to mine
	err = adaptor.Prepare(blockchain, header900)
	assert.Nil(t, err)

	assert.Equal(t, snap.NextEpochMasterNodes, header900.Validators)

	var decodedExtraField types.ExtraFields_v2
	err = utils.DecodeBytesExtraFields(header900.Extra, &decodedExtraField)
	assert.Nil(t, err)
	assert.Equal(t, types.Round(903), decodedExtraField.Round)
	assert.Equal(t, types.Round(899), decodedExtraField.QuorumCert.ProposedBlockInfo.Round)
}

// test if we have 128 candidates, then snapshot will store all of them, and when preparing (and verifying) candidates is truncated to MaxMasternodes
func TestUpdateMultipleMasterNodes(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, currentBlock, signer, signFn := PrepareXDCTestBlockChainWith128Candidates(t, int(config.XDPoS.Epoch+config.XDPoS.Gap)-1, config)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	x := adaptor.EngineV2
	// Insert block 1350
	t.Logf("Inserting block with propose at 1350...")
	blockCoinbaseA := "0xaaa0000000000000000000000000000000001350"
	//Get from block validator error message
	merkleRoot := "5f6a0ed6ac6ae850b98fc00fab523a129a25dc64eb2a9bc475073d264989b876"
	parentBlock := CreateBlock(blockchain, config, currentBlock, 1350, 450, blockCoinbaseA, signer, signFn, nil, nil, merkleRoot)
	err := blockchain.InsertBlock(parentBlock)
	assert.Nil(t, err)
	// 1350 is a gap block, need to update the snapshot
	err = blockchain.UpdateM1()
	assert.Nil(t, err)
	// but we wait until 1800 to test the snapshot

	t.Logf("Inserting block from 1351 to 1800...")
	for i := 1351; i <= 1800; i++ {
		blockCoinbase := fmt.Sprintf("0xaaa000000000000000000000000000000000%4d", i)
		block := CreateBlock(blockchain, config, parentBlock, i, int64(i-900), blockCoinbase, signer, signFn, nil, nil, merkleRoot)
		err = blockchain.InsertBlock(block)
		assert.Nil(t, err)
		if i < 1800 {
			parentBlock = block
		}
		if i == 1800 {
			snap, err := x.GetSnapshot(blockchain, block.Header())

			assert.Nil(t, err)
			assert.Equal(t, 1350, int(snap.Number))
			assert.Equal(t, 128, len(snap.NextEpochMasterNodes)) // 128 is all masternode candidates, not limited by MaxMasternodes
		}
	}

	tstamp := time.Now().Unix()

	header1800 := &types.Header{
		ParentHash: parentBlock.Hash(),
		Number:     big.NewInt(int64(1800)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
		Coinbase:   voterAddr,
	}

	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(900), false)
	blockInfo := &types.BlockInfo{Hash: parentBlock.Hash(), Round: types.Round(900 - 1), Number: parentBlock.Number()}
	signature := []byte{1, 2, 3, 4, 5, 6, 7, 8}
	signatures := []types.Signature{signature}
	quorumCert := &types.QuorumCert{ProposedBlockInfo: blockInfo, Signatures: signatures, GapNumber: 1350}
	adaptor.EngineV2.ProcessQCFaker(blockchain, quorumCert)
	adaptor.EngineV2.AuthorizeFaker(voterAddr)
	err = adaptor.Prepare(blockchain, header1800)
	assert.Nil(t, err)
	assert.Equal(t, common.MaxMasternodes, len(header1800.Validators)) // although 128 masternode candidates, we can only pick MaxMasternodes
	assert.Equal(t, 0, len(header1800.Penalties))
}
