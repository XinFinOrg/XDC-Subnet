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
	merkleRoot := "9c3a52a83fc19e3e1dfea86c4a9ac3735e23bdb4d9e5d949a54257c26bf2c5c1"
	header := &types.Header{
		Root:       common.HexToHash(merkleRoot),
		Number:     big.NewInt(int64(900)),
		ParentHash: parentBlock.Hash(),
		Coinbase:   common.HexToAddress(blockCoinbaseA),
		Extra:      common.Hex2Bytes("d7830100018358444388676f312e31352e38856c696e757800000000000000000278c350152e15fa6ffc712a5a73d704ce73e2e103d9e17ae3ff2c6712e44e25b09ac5ee91f6c9ff065551f0dcac6f00cae11192d462db709be3758ccef312ee5eea8d7bad5374c6a652150515d744508b61c1a4deb4e4e7bf057e4e3824c11fd2569bcb77a52905cda63b5a58507910bed335e4c9d87ae0ecdfafd400"),
	}
	block900, err := createBlockFromHeader(blockchain, header, nil, signer, signFn, config)
	if err != nil {
		t.Fatal(err)
	}
	err = blockchain.InsertBlock(block900)
	assert.Nil(t, err)
	time.Sleep(time.Duration(minePeriod) * time.Second)

	// YourTurn is called before mine first v2 block
	b, err := adaptor.YourTurn(blockchain, block900.Header(), common.HexToAddress("xdc0278C350152e15fa6FFC712a5A73D704Ce73E2E1"))
	assert.Nil(t, err)
	assert.False(t, b)
	b, err = adaptor.YourTurn(blockchain, block900.Header(), common.HexToAddress("xdc03d9e17Ae3fF2c6712E44e25B09Ac5ee91f6c9ff"))
	assert.Nil(t, err)
	// round=1, so masternode[1] has YourTurn = True
	assert.True(t, b)
	assert.Equal(t, adaptor.EngineV2.GetCurrentRoundFaker(), types.Round(1))

	snap, err := adaptor.EngineV2.GetSnapshot(blockchain, block900.Header())
	assert.Nil(t, err)
	assert.NotNil(t, snap)
	masterNodes := adaptor.EngineV1.GetMasternodesFromCheckpointHeader(block900.Header())
	for i := 0; i < len(masterNodes); i++ {
		assert.Equal(t, masterNodes[i].Hex(), snap.NextEpochMasterNodes[i].Hex())
	}
}

func TestShouldMineOncePerRound(t *testing.T) {
	config := params.TestXDPoSMockChainConfig
	blockchain, _, block910, signer, _, _ := PrepareXDCTestBlockChainForV2Engine(t, 910, config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	minePeriod := config.XDPoS.V2.CurrentConfig.MinePeriod

	// Make sure we seal the parentBlock 910
	_, err := adaptor.Seal(blockchain, block910, nil)
	assert.Nil(t, err)
	time.Sleep(time.Duration(minePeriod) * time.Second)
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
	stateRoot := "48974afaffb7b132394fc4d55f1fea1e370f24d85d56df8907f275e17e519f1b"
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
		ParentHash: currentBlock.Hash(),
		Number:     big.NewInt(int64(901)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
		Coinbase:   signer,
	}

	err := adaptor.Prepare(blockchain, notReadyToProposeHeader)
	assert.Equal(t, consensus.ErrNotReadyToPropose, err)

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

	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(4), false)
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
	blockchain, _, currentBlock, signer, _, _ := PrepareXDCTestBlockChainForV2Engine(t, int(config.XDPoS.Epoch), config, nil)
	adaptor := blockchain.Engine().(*XDPoS.XDPoS)
	// trigger initial
	_, err := adaptor.YourTurn(blockchain, currentBlock.Header(), signer)
	assert.Nil(t, err)

	tstamp := time.Now().Unix()

	header901 := &types.Header{
		ParentHash: currentBlock.Hash(),
		Number:     big.NewInt(int64(901)),
		GasLimit:   params.TargetGasLimit,
		Time:       big.NewInt(tstamp),
		Coinbase:   signer,
	}

	adaptor.EngineV2.SetNewRoundFaker(blockchain, types.Round(4), false)
	err = adaptor.Prepare(blockchain, header901)
	assert.Nil(t, err)

	snap, err := adaptor.EngineV2.GetSnapshot(blockchain, currentBlock.Header())
	if err != nil {
		t.Fatal(err)
	}

	assert.Equal(t, snap.NextEpochMasterNodes, header901.Validators)

	var decodedExtraField types.ExtraFields_v2
	err = utils.DecodeBytesExtraFields(header901.Extra, &decodedExtraField)
	assert.Nil(t, err)
	assert.Equal(t, types.Round(4), decodedExtraField.Round)
	assert.Equal(t, types.Round(0), decodedExtraField.QuorumCert.ProposedBlockInfo.Round)
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
	assert.Equal(t, common.MaxMasternodesV2, len(header1800.Validators)) // although 128 masternode candidates, we can only pick MaxMasternodes
	assert.Equal(t, 0, len(header1800.Penalties))
}
