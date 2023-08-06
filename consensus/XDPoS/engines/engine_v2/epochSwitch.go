package engine_v2

import (
	"fmt"
	"math/big"

	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/log"
)

// Given header and its hash, get epoch switch info from the epoch switch block of that epoch,
// header is allow to be nil.
func (x *XDPoS_v2) getEpochSwitchInfo(chain consensus.ChainReader, header *types.Header, hash common.Hash) (*types.EpochSwitchInfo, error) {
	e, ok := x.epochSwitches.Get(hash)
	if ok {
		epochSwitchInfo := e.(*types.EpochSwitchInfo)
		log.Debug("[getEpochSwitchInfo] cache hit", "number", epochSwitchInfo.EpochSwitchBlockInfo.Number, "hash", hash.Hex())
		return epochSwitchInfo, nil
	}
	h := header
	if h == nil {
		log.Debug("[getEpochSwitchInfo] header doesn't provide, get header by hash", "hash", hash.Hex())
		h = chain.GetHeaderByHash(hash)
		if h == nil {
			log.Warn("[getEpochSwitchInfo] can not find header from db", "hash", hash.Hex())
			return nil, fmt.Errorf("[getEpochSwitchInfo] can not find header from db hash %v", hash.Hex())
		}
	}
	isEpochSwitch, _, err := x.IsEpochSwitch(h)
	if err != nil {
		return nil, err
	}
	if isEpochSwitch {
		log.Debug("[getEpochSwitchInfo] header is epoch switch", "hash", hash.Hex(), "number", h.Number.Uint64())
		quorumCert, round, masternodes, err := x.getExtraFields(h)
		if err != nil {
			log.Error("[getEpochSwitchInfo] get extra field", "err", err, "number", h.Number.Uint64())
			return nil, err
		}

		snap, err := x.getSnapshot(chain, h.Number.Uint64(), false)
		if err != nil {
			log.Error("[getEpochSwitchInfo] get snapshot error", "err", err, "number", h.Number.Uint64())
			return nil, err
		}

		candidates := snap.NextEpochMasterNodes
		penalties := snap.NextEpochPenalties
		standbynodes := []common.Address{}
		if len(masternodes) != len(candidates) {
			standbynodes = candidates
			standbynodes = common.RemoveItemFromArray(standbynodes, masternodes)
			standbynodes = common.RemoveItemFromArray(standbynodes, penalties)
		}
		epochSwitchInfo := &types.EpochSwitchInfo{
			Penalties:    penalties,
			Standbynodes: standbynodes,
			Masternodes:  masternodes,
			EpochSwitchBlockInfo: &types.BlockInfo{
				Hash:   hash,
				Number: h.Number,
				Round:  round,
			},
		}
		if quorumCert != nil {
			epochSwitchInfo.EpochSwitchParentBlockInfo = quorumCert.ProposedBlockInfo
		}

		x.epochSwitches.Add(hash, epochSwitchInfo)
		return epochSwitchInfo, nil
	}
	epochSwitchInfo, err := x.getEpochSwitchInfo(chain, nil, h.ParentHash)
	if err != nil {
		log.Error("[getEpochSwitchInfo] recursive error", "err", err, "hash", hash.Hex(), "number", h.Number.Uint64())
		return nil, err
	}
	log.Debug("[getEpochSwitchInfo] get epoch switch info recursively", "hash", hash.Hex(), "number", h.Number.Uint64())
	x.epochSwitches.Add(hash, epochSwitchInfo)
	return epochSwitchInfo, nil
}

// IsEpochSwitchAtRound() is used by miner to check whether it mines a block in the same epoch with parent
func (x *XDPoS_v2) isEpochSwitchAtRound(_ types.Round, parentHeader *types.Header) (bool, uint64, error) {
	// in subnet, we don't use round to decide epoch switch
	blockNum := parentHeader.Number.Uint64() + 1
	return blockNum%x.config.Epoch == 0, blockNum / x.config.Epoch, nil
}

func (x *XDPoS_v2) GetCurrentEpochSwitchBlock(chain consensus.ChainReader, blockNum *big.Int) (uint64, uint64, error) {
	// in subnet, epoch switch block is whose block num % Epoch == 0
	num := blockNum.Uint64()
	currentCheckpointNumber := num - num%x.config.Epoch
	epochNum := num / x.config.Epoch
	return currentCheckpointNumber, epochNum, nil
}

func (x *XDPoS_v2) IsEpochSwitch(header *types.Header) (bool, uint64, error) {
	// in subnet, epoch switch block is whose block num % Epoch == 0
	num := header.Number.Uint64()
	epochNum := num / x.config.Epoch
	return num%x.config.Epoch == 0, epochNum, nil
}
