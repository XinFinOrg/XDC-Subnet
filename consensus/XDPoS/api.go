// Copyright (c) 2018 XDPoSChain
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program. If not, see <http://www.gnu.org/licenses/>.

package XDPoS

import (
	"encoding/base64"
	"math/big"

	"github.com/XinFinOrg/XDPoSChain/common"
	"github.com/XinFinOrg/XDPoSChain/consensus"
	"github.com/XinFinOrg/XDPoSChain/consensus/XDPoS/utils"
	"github.com/XinFinOrg/XDPoSChain/core/types"
	"github.com/XinFinOrg/XDPoSChain/rlp"
	"github.com/XinFinOrg/XDPoSChain/rpc"
)

// API is a user facing RPC API to allow controlling the signer and voting
// mechanisms of the proof-of-authority scheme.
type API struct {
	chain consensus.ChainReader
	XDPoS *XDPoS
}

type V2BlockInfo struct {
	Hash       common.Hash
	Round      types.Round
	Number     *big.Int
	ParentHash common.Hash
	Committed  bool
	EncodedRLP string
	Error      string
}

type NetworkInformation struct {
	NetworkId                  *big.Int
	XDCValidatorAddress        common.Address
	RelayerRegistrationAddress common.Address
	XDCXListingAddress         common.Address
	XDCZAddress                common.Address
	LendingAddress             common.Address
}

// GetSnapshot retrieves the state snapshot at a given block.
func (api *API) GetSnapshot(number *rpc.BlockNumber) (*utils.PublicApiSnapshot, error) {
	// Retrieve the requested block number (or current if none requested)
	var header *types.Header
	if number == nil || *number == rpc.LatestBlockNumber {
		header = api.chain.CurrentHeader()
	} else {
		header = api.chain.GetHeaderByNumber(uint64(number.Int64()))
	}
	// Ensure we have an actually valid block and return its snapshot
	if header == nil {
		return nil, utils.ErrUnknownBlock
	}
	return api.XDPoS.GetSnapshot(api.chain, header)
}

// GetSnapshotAtHash retrieves the state snapshot at a given block.
func (api *API) GetSnapshotAtHash(hash common.Hash) (*utils.PublicApiSnapshot, error) {
	header := api.chain.GetHeaderByHash(hash)
	if header == nil {
		return nil, utils.ErrUnknownBlock
	}
	return api.XDPoS.GetSnapshot(api.chain, header)
}

// GetSigners retrieves the list of authorized signers at the specified block.
func (api *API) GetSigners(number *rpc.BlockNumber) ([]common.Address, error) {
	// Retrieve the requested block number (or current if none requested)
	var header *types.Header
	if number == nil || *number == rpc.LatestBlockNumber {
		header = api.chain.CurrentHeader()
	} else {
		header = api.chain.GetHeaderByNumber(uint64(number.Int64()))
	}
	// Ensure we have an actually valid block and return the signers from its snapshot
	if header == nil {
		return nil, utils.ErrUnknownBlock
	}

	return api.XDPoS.GetAuthorisedSignersFromSnapshot(api.chain, header)
}

// GetSignersAtHash retrieves the state snapshot at a given block.
func (api *API) GetSignersAtHash(hash common.Hash) ([]common.Address, error) {
	header := api.chain.GetHeaderByHash(hash)
	if header == nil {
		return nil, utils.ErrUnknownBlock
	}
	return api.XDPoS.GetAuthorisedSignersFromSnapshot(api.chain, header)
}

// Get the latest v2 committed block information. Note: This only applies to v2 engine. it doesn't make sense for v1
func (api *API) GetLatestCommittedBlockHeader() *types.BlockInfo {
	return api.XDPoS.EngineV2.GetLatestCommittedBlockInfo()
}

func (api *API) GetV2BlockByHeader(header *types.Header, uncle bool) *V2BlockInfo {
	committed := false
	latestCommittedBlock := api.XDPoS.EngineV2.GetLatestCommittedBlockInfo()
	if latestCommittedBlock == nil {
		return &V2BlockInfo{
			Hash:  header.Hash(),
			Error: "can not find latest committed block from consensus",
		}
	}
	if header.Number.Uint64() <= latestCommittedBlock.Number.Uint64() {
		committed = true && !uncle
	}

	round, err := api.XDPoS.EngineV2.GetRoundNumber(header)

	if err != nil {
		return &V2BlockInfo{
			Hash:  header.Hash(),
			Error: err.Error(),
		}
	}

	encodeBytes, err := rlp.EncodeToBytes(header)
	if err != nil {
		return &V2BlockInfo{
			Hash:  header.Hash(),
			Error: err.Error(),
		}
	}

	block := &V2BlockInfo{
		Hash:       header.Hash(),
		ParentHash: header.ParentHash,
		Number:     header.Number,
		Round:      round,
		Committed:  committed,
		EncodedRLP: base64.StdEncoding.EncodeToString(encodeBytes),
	}
	return block
}

func (api *API) GetV2BlockByNumber(number *rpc.BlockNumber) *V2BlockInfo {
	var header *types.Header
	if number == nil || *number == rpc.LatestBlockNumber {
		header = api.chain.CurrentHeader()
	} else if *number == rpc.CommittedBlockNumber {
		hash := api.XDPoS.EngineV2.GetLatestCommittedBlockInfo().Hash
		header = api.chain.GetHeaderByHash(hash)
	} else {
		header = api.chain.GetHeaderByNumber(uint64(number.Int64()))
	}

	if header == nil {
		return &V2BlockInfo{
			Number: big.NewInt(number.Int64()),
			Error:  "can not find block from this number",
		}
	}

	uncle := false
	return api.GetV2BlockByHeader(header, uncle)
}

// Confirm V2 Block Committed Status
func (api *API) GetV2BlockByHash(blockHash common.Hash) *V2BlockInfo {
	header := api.chain.GetHeaderByHash(blockHash)
	if header == nil {
		return &V2BlockInfo{
			Hash:  blockHash,
			Error: "can not find block from this hash",
		}
	}

	// confirm this is on the main chain
	chainHeader := api.chain.GetHeaderByNumber(header.Number.Uint64())
	uncle := false
	if header.Hash() != chainHeader.Hash() {
		uncle = true
	}

	return api.GetV2BlockByHeader(header, uncle)
}

func (api *API) NetworkInformation() NetworkInformation {
	info := NetworkInformation{}
	info.NetworkId = api.chain.Config().ChainId
	info.XDCValidatorAddress = common.HexToAddress(common.MasternodeVotingSMC)
	if common.IsTestnet {
		info.LendingAddress = common.HexToAddress(common.LendingRegistrationSMCTestnet)
		info.RelayerRegistrationAddress = common.HexToAddress(common.RelayerRegistrationSMCTestnet)
		info.XDCXListingAddress = common.XDCXListingSMCTestNet
		info.XDCZAddress = common.TRC21IssuerSMCTestNet
	} else {
		info.LendingAddress = common.HexToAddress(common.LendingRegistrationSMC)
		info.RelayerRegistrationAddress = common.HexToAddress(common.RelayerRegistrationSMC)
		info.XDCXListingAddress = common.XDCXListingSMC
		info.XDCZAddress = common.TRC21IssuerSMC
	}
	return info
}
