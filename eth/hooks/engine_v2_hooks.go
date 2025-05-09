package hooks

import (
	"errors"
	"fmt"
	"math/big"
	"sort"
	"time"

	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus"
	"github.com/XinFinOrg/XDC-Subnet/consensus/XDPoS"
	"github.com/XinFinOrg/XDC-Subnet/contracts"
	"github.com/XinFinOrg/XDC-Subnet/core"
	"github.com/XinFinOrg/XDC-Subnet/core/state"
	"github.com/XinFinOrg/XDC-Subnet/core/types"
	"github.com/XinFinOrg/XDC-Subnet/eth/util"
	"github.com/XinFinOrg/XDC-Subnet/log"
	"github.com/XinFinOrg/XDC-Subnet/params"
)

func AttachConsensusV2Hooks(adaptor *XDPoS.XDPoS, bc *core.BlockChain, chainConfig *params.ChainConfig) {
	
	// Hook scans for bad masternodes and decide to penalty them
	// Subnet penalty is triggered at gap block, and stopped at previous gap block
	adaptor.EngineV2.HookPenalty = func(chain consensus.ChainReader, number *big.Int, currentHash common.Hash, candidates []common.Address, config *params.XDPoSConfig) ([]common.Address, error) {
		start := time.Now()
		blockHashes := []common.Hash{}
		blockNumbers := []uint64{}

		parentNumber := number.Uint64() - 1
		parentHash := currentHash
		// number is usually gap block, and parentNumber = gap -1. so stop = parentNumber -Epoch +1
		// get the previous gap block
		stopNumber := parentNumber + 1 - config.Epoch
		// prevent overflow
		if parentNumber+1 <= config.Epoch {
			stopNumber = 1
		}

		// check and wait the latest block is already in the disk
		// sometimes blocks are yet inserted into block
		for timeout := 0; ; timeout++ {
			parentHeader := chain.GetHeader(parentHash, parentNumber)
			if parentHeader != nil { // found the latest block in the disk
				break
			}
			log.Info("[V2 Hook Penalty] parentHeader is nil, wait block to be writen in disk", "parentNumber", parentNumber)
			time.Sleep(time.Second) // 1s

			if timeout > 30 { // wait over 30s
				log.Error("[V2 Hook Penalty] parentHeader is nil, wait too long not writen in to disk", "parentNumber", parentNumber)
				return []common.Address{}, fmt.Errorf("parentHeader is nil")
			}
		}

		penalties := []common.Address{}
		prevPenalties := []common.Address{}
		// get list block hash & stats total created block
		statMiners := map[common.Address]int{}

		for i := uint64(1); ; i++ {
			parentHeader := chain.GetHeader(parentHash, parentNumber)
			// the prev gapPlusOne block
			if parentNumber == stopNumber+1 {
				prevPenalties = parentHeader.Penalties
			}
			blockHashes = append(blockHashes, parentHash)
			blockNumbers = append(blockNumbers, parentNumber)
			miner := parentHeader.Coinbase // we can directly use coinbase, since it's verified
			statMiners[miner]++
			isEpochSwitch, _, err := adaptor.EngineV2.IsEpochSwitch(parentHeader)
			if err != nil {
				log.Error("[HookPenalty] isEpochSwitch", "err", err)
				return []common.Address{}, err
			}
			if isEpochSwitch || parentNumber <= stopNumber {
				log.Debug("[HookPenalty]", "isEpochSwitch", isEpochSwitch, "parentNumber", parentNumber, "stopNumber", stopNumber)
				preMasternodes := adaptor.EngineV2.GetMasternodes(chain, parentHeader)
				for _, addr := range preMasternodes {
					total, exist := statMiners[addr]
					if !exist {
						log.Info("[HookPenalty] Find a node do not create any block", "addr", addr.Hex())
						penalties = append(penalties, addr)
					} else {
						if total < common.MinimunMinerBlockPerEpoch {
							log.Info("[HookPenalty] Find a node does not create enough block", "addr", addr.Hex(), "total", total, "require", common.MinimunMinerBlockPerEpoch)
							penalties = append(penalties, addr)
						}
					}
				}
				// clear map
				statMiners = map[common.Address]int{}

				if parentNumber <= stopNumber {
					break
				}
			}

			parentNumber--
			parentHash = parentHeader.ParentHash
			log.Debug("[HookPenalty] listBlockHash", "i", i, "parentHash", parentHash, "parentNumber", parentNumber)
		}

		// Add previous penalty
		penalties = append(penalties, prevPenalties...)

		// Loop for each block to check signing tx, tx signer can be removed from penalty
		comebacks := map[common.Address]bool{}
		mapBlockHash := map[common.Hash]bool{}
		startRange := number.Uint64() - common.RangeReturnSigner + 1
		// to prevent overflow
		if number.Uint64() < common.RangeReturnSigner-1 {
			startRange = 0
		}
		// search signing tx, from small number to large one
		for i := len(blockNumbers) - 1; i >= 0; i-- {
			blockNumber := blockNumbers[i]
			if blockNumber < startRange {
				continue
			}
			bhash := blockHashes[i]
			if blockNumber%common.MergeSignRange == 0 {
				mapBlockHash[bhash] = true
			}
			signData, ok := adaptor.GetCachedSigningTxs(bhash)
			if !ok {
				block := chain.GetBlock(bhash, blockNumber)
				txs := block.Transactions()
				signData = adaptor.CacheSigningTxs(bhash, txs)
			}
			txs := signData.([]*types.Transaction)
			for _, tx := range txs {
				blkHash := common.BytesToHash(tx.Data()[len(tx.Data())-32:])
				from := *tx.From()
				if mapBlockHash[blkHash] {
					comebacks[from] = true
				}
			}
		}
		// dedup penalties and remove comebacks
		mapForDedup := map[common.Address]bool{}
		penaltiesDedup := []common.Address{}
		for _, p := range penalties {
			if !mapForDedup[p] && !comebacks[p] {
				penaltiesDedup = append(penaltiesDedup, p)
				mapForDedup[p] = true
				log.Info("[HookPenalty] Final penalty contains", "addr", p)
			}
		}
		// sort it to ensure same order for all nodes
		sort.Slice(penaltiesDedup, func(i, j int) bool {
			return penaltiesDedup[i].Hex() < penaltiesDedup[j].Hex()
		})

		log.Info("[HookPenalty] Time Calculated HookPenaltyV2 ", "block", number, "time", common.PrettyDuration(time.Since(start)))
		return penaltiesDedup, nil
	}

	// Hook calculates reward for masternodes
	adaptor.EngineV2.HookReward = func(chain consensus.ChainReader, stateBlock *state.StateDB, parentState *state.StateDB, header *types.Header) (map[string]interface{}, error) {
		number := header.Number.Uint64()
		foundationWalletAddr := chain.Config().XDPoS.FoudationWalletAddr
		if foundationWalletAddr == (common.Address{}) {
			log.Error("Foundation Wallet Address is empty", "error", foundationWalletAddr)
			return nil, errors.New("foundation wallet address is empty")
		}
		rewards := make(map[string]interface{})
		// skip hook reward if this is the first v2
		if number == chain.Config().XDPoS.V2.SwitchBlock.Uint64()+1 {
			return rewards, nil
		}
		start := time.Now()
		// Get reward inflation.
		chainReward := new(big.Int).Mul(new(big.Int).SetUint64(chain.Config().XDPoS.Reward), new(big.Int).SetUint64(params.Ether))
		chainReward = util.RewardInflation(chain, chainReward, number, common.BlocksPerYear)

		// Get signers/signing tx count
		totalSigner := new(uint64)
		signers, err := GetSigningTxCount(adaptor, chain, header, totalSigner)

		log.Debug("Time Get Signers", "block", header.Number.Uint64(), "time", common.PrettyDuration(time.Since(start)))
		if err != nil {
			log.Error("[HookReward] Fail to get signers count for reward checkpoint", "error", err)
			return nil, err
		}
		rewards["signers"] = signers
		rewardSigners, err := contracts.CalculateRewardForSigner(chainReward, signers, *totalSigner)
		if err != nil {
			log.Error("[HookReward] Fail to calculate reward for signers", "error", err)
			return nil, err
		}
		// Add reward for coin holders.
		voterResults := make(map[common.Address]interface{})
		if len(signers) > 0 {
			for signer, calcReward := range rewardSigners {
				err, rewards := contracts.CalculateRewardForHolders(foundationWalletAddr, parentState, signer, calcReward, number)
				if err != nil {
					log.Error("[HookReward] Fail to calculate reward for holders.", "error", err)
					return nil, err
				}
				if len(rewards) > 0 {
					for holder, reward := range rewards {
						stateBlock.AddBalance(holder, reward)
					}
				}
				voterResults[signer] = rewards
			}
		}
		rewards["rewards"] = voterResults
		log.Debug("Time Calculated HookReward ", "block", header.Number.Uint64(), "time", common.PrettyDuration(time.Since(start)))
		return rewards, nil
	}
}

// get signing transaction sender count
func GetSigningTxCount(c *XDPoS.XDPoS, chain consensus.ChainReader, header *types.Header, totalSigner *uint64) (map[common.Address]*contracts.RewardLog, error) {
	// header should be a new epoch switch block
	number := header.Number.Uint64()
	rewardEpochCount := 2
	signEpochCount := 1
	signers := make(map[common.Address]*contracts.RewardLog)
	mapBlkHash := map[uint64]common.Hash{}

	// prevent overflow
	if number == 0 {
		return signers, nil
	}

	data := make(map[common.Hash][]common.Address)
	epochCount := 0
	var masternodes []common.Address
	var startBlockNumber, endBlockNumber uint64
	for i := number - 1; ; i-- {
		header = chain.GetHeader(header.ParentHash, i)
		isEpochSwitch, _, err := c.IsEpochSwitch(header)
		if err != nil {
			return nil, err
		}
		if isEpochSwitch && i != chain.Config().XDPoS.V2.SwitchBlock.Uint64()+1 {
			epochCount += 1
			if epochCount == signEpochCount {
				endBlockNumber = header.Number.Uint64() - 1
			}
			if epochCount == rewardEpochCount {
				startBlockNumber = header.Number.Uint64() + 1
				masternodes = c.GetMasternodesFromCheckpointHeader(header)
				break
			}
		}
		mapBlkHash[i] = header.Hash()
		signData, ok := c.GetCachedSigningTxs(header.Hash())
		if !ok {
			log.Debug("Failed get from cached", "hash", header.Hash().String(), "number", i)
			block := chain.GetBlock(header.Hash(), i)
			txs := block.Transactions()
			signData = c.CacheSigningTxs(header.Hash(), txs)
		}
		txs := signData.([]*types.Transaction)
		for _, tx := range txs {
			blkHash := common.BytesToHash(tx.Data()[len(tx.Data())-32:])
			from := *tx.From()
			data[blkHash] = append(data[blkHash], from)
		}
		// prevent overflow
		if i == 0 {
			return signers, nil
		}
	}

	for i := startBlockNumber; i <= endBlockNumber; i++ {
		if i%common.MergeSignRange == 0 {
			addrs := data[mapBlkHash[i]]
			// Filter duplicate address.
			if len(addrs) > 0 {
				addrSigners := make(map[common.Address]bool)
				for _, masternode := range masternodes {
					for _, addr := range addrs {
						if addr == masternode {
							if _, ok := addrSigners[addr]; !ok {
								addrSigners[addr] = true
							}
							break
						}
					}
				}

				for addr := range addrSigners {
					_, exist := signers[addr]
					if exist {
						signers[addr].Sign++
					} else {
						signers[addr] = &contracts.RewardLog{Sign: 1, Reward: new(big.Int)}
					}
					*totalSigner++
				}
			}
		}
	}

	log.Info("Calculate reward at checkpoint", "startBlock", startBlockNumber, "endBlock", endBlockNumber)

	return signers, nil
}
