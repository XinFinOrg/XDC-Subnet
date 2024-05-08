package engine_v2

import (
	"fmt"

	"github.com/XinFinOrg/XDC-Subnet/accounts"
	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDC-Subnet/consensus"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/crypto"
	"github.com/XinFinOrg/XDC-Subnet/crypto/sha3"
	"github.com/XinFinOrg/XDC-Subnet/log"
	"github.com/XinFinOrg/XDC-Subnet/rlp"
	lru "github.com/hashicorp/golang-lru"
)

func sigHash(header *types.Header) (hash common.Hash) {
	hasher := sha3.NewKeccak256()

	err := rlp.Encode(hasher, []interface{}{
		header.ParentHash,
		header.UncleHash,
		header.Coinbase,
		header.Root,
		header.TxHash,
		header.ReceiptHash,
		header.Bloom,
		header.Difficulty,
		header.Number,
		header.GasLimit,
		header.GasUsed,
		header.Time,
		header.Extra,
		header.MixDigest,
		header.Nonce,
		header.Validators,
		header.Penalties,
	})
	if err != nil {
		log.Debug("Fail to encode", err)
	}
	hasher.Sum(hash[:0])
	return hash
}

func ecrecover(header *types.Header, sigcache *lru.ARCCache) (common.Address, error) {
	// If the signature's already cached, return that
	hash := header.Hash()
	if address, known := sigcache.Get(hash); known {
		return address.(common.Address), nil
	}

	// Recover the public key and the Ethereum address
	pubkey, err := crypto.Ecrecover(sigHash(header).Bytes(), header.Validator)
	if err != nil {
		return common.Address{}, err
	}
	var signer common.Address
	copy(signer[:], crypto.Keccak256(pubkey[1:])[12:])

	sigcache.Add(hash, signer)
	return signer, nil

}

// Get masternodes address from checkpoint Header. Only used for v1 last block
func decodeMasternodesFromHeaderExtra(checkpointHeader *types.Header) []common.Address {
	masternodes := make([]common.Address, (len(checkpointHeader.Extra)-utils.ExtraVanity-utils.ExtraSeal)/common.AddressLength)
	for i := 0; i < len(masternodes); i++ {
		copy(masternodes[i][:], checkpointHeader.Extra[utils.ExtraVanity+i*common.AddressLength:])
	}
	return masternodes
}

func UniqueSignatures(signatureSlice []types.Signature) ([]types.Signature, []types.Signature) {
	keys := make(map[string]bool)
	list := []types.Signature{}
	duplicates := []types.Signature{}
	for _, signature := range signatureSlice {
		hexOfSig := common.Bytes2Hex(signature)
		if _, value := keys[hexOfSig]; !value {
			keys[hexOfSig] = true
			list = append(list, signature)
		} else {
			duplicates = append(duplicates, signature)
		}
	}
	return list, duplicates
}

func (x *XDPoS_v2) signSignature(signingHash common.Hash) (types.Signature, error) {
	// Don't hold the signFn for the whole signing operation
	x.signLock.RLock()
	signer, signFn := x.signer, x.signFn
	x.signLock.RUnlock()

	signedHash, err := signFn(accounts.Account{Address: signer}, signingHash.Bytes())
	if err != nil {
		return nil, fmt.Errorf("Error %v while signing hash", err)
	}
	return signedHash, nil
}

func (x *XDPoS_v2) verifyMsgSignature(signedHashToBeVerified common.Hash, signature types.Signature, masternodes []common.Address) (bool, common.Address, error) {
	var signerAddress common.Address
	if len(masternodes) == 0 {
		return false, signerAddress, fmt.Errorf("Empty masternode list detected when verifying message signatures")
	}
	// Recover the public key and the Ethereum address
	pubkey, err := crypto.Ecrecover(signedHashToBeVerified.Bytes(), signature)
	if err != nil {
		return false, signerAddress, fmt.Errorf("Error while verifying message: %v", err)
	}

	copy(signerAddress[:], crypto.Keccak256(pubkey[1:])[12:])
	for _, mn := range masternodes {
		if mn == signerAddress {
			return true, signerAddress, nil
		}
	}

	log.Warn("[verifyMsgSignature] signer is not part of masternode list", "signer", signerAddress, "masternodes", masternodes)
	return false, signerAddress, nil
}

func (x *XDPoS_v2) getExtraFields(header *types.Header) (*types.QuorumCert, types.Round, []common.Address, error) {

	var masternodes []common.Address

	// last v1 block
	if header.Number.Cmp(x.config.V2.SwitchBlock) == 0 {
		masternodes = decodeMasternodesFromHeaderExtra(header)
		return nil, types.Round(0), masternodes, nil
	}

	// v2 block
	masternodes = x.GetMasternodesFromEpochSwitchHeader(header)
	var decodedExtraField types.ExtraFields_v2
	err := utils.DecodeBytesExtraFields(header.Extra, &decodedExtraField)
	if err != nil {
		log.Error("[getExtraFields] error on decode extra fields", "err", err, "extra", header.Extra)
		return nil, types.Round(0), masternodes, err
	}
	return decodedExtraField.QuorumCert, decodedExtraField.Round, masternodes, nil
}

func (x *XDPoS_v2) GetRoundNumber(header *types.Header) (types.Round, error) {
	// If not v2 yet, return 0
	if header.Number.Cmp(x.config.V2.SwitchBlock) <= 0 {
		return types.Round(0), nil
	} else {
		var decodedExtraField types.ExtraFields_v2
		err := utils.DecodeBytesExtraFields(header.Extra, &decodedExtraField)
		if err != nil {
			return types.Round(0), err
		}
		return decodedExtraField.Round, nil
	}
}

func (x *XDPoS_v2) GetSignersFromSnapshot(chain consensus.ChainReader, header *types.Header) ([]common.Address, error) {
	snap, err := x.getSnapshot(chain, header.Number.Uint64(), false)
	if err != nil {
		return nil, err
	}
	return snap.NextEpochMasterNodes, err
}

func (x *XDPoS_v2) CalculateMissingRounds(chain consensus.ChainReader, header *types.Header) (*utils.PublicApiMissedRoundsMetadata, error) {
	var missedRounds []utils.MissedRoundInfo
	switchInfo, err := x.getEpochSwitchInfo(chain, header, header.Hash())
	if err != nil {
		return nil, err
	}
	masternodes := switchInfo.Masternodes

	// Loop through from the epoch switch block to the current "header" block
	nextHeader := header
	for nextHeader.Number.Cmp(switchInfo.EpochSwitchBlockInfo.Number) > 0 {
		parentHeader := chain.GetHeaderByHash(nextHeader.ParentHash)
		parentRound, err := x.GetRoundNumber(parentHeader)
		if err != nil {
			return nil, err
		}
		currRound, err := x.GetRoundNumber(nextHeader)
		if err != nil {
			return nil, err
		}
		// This indicates that an increment in the round number is missing during the block production process.
		if parentRound+1 != currRound {
			// We need to iterate from the parentRound to the currRound to determine which miner did not perform mining.
			for i := parentRound + 1; i < currRound; i++ {
				leaderIndex := uint64(i) % x.config.Epoch % uint64(len(masternodes))
				whosTurn := masternodes[leaderIndex]
				missedRounds = append(
					missedRounds,
					utils.MissedRoundInfo{
						Round:            i,
						Miner:            whosTurn,
						CurrentBlockHash: nextHeader.Hash(),
						CurrentBlockNum:  nextHeader.Number,
						ParentBlockHash:  parentHeader.Hash(),
						ParentBlockNum:   parentHeader.Number,
					},
				)
			}
		}
		// Assign the pointer to the next one
		nextHeader = parentHeader
	}
	missedRoundsMetadata := &utils.PublicApiMissedRoundsMetadata{
		EpochRound:       switchInfo.EpochSwitchBlockInfo.Round,
		EpochBlockNumber: switchInfo.EpochSwitchBlockInfo.Number,
		MissedRounds:     missedRounds,
	}

	return missedRoundsMetadata, nil
}
