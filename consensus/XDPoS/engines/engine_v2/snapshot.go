package engine_v2

import (
	"encoding/json"

	"github.com/XinFinOrg/XDPoSChain/common"
	"github.com/XinFinOrg/XDPoSChain/consensus"
	"github.com/XinFinOrg/XDPoSChain/ethdb"
	"github.com/XinFinOrg/XDPoSChain/log"
)

// Snapshot is the state of the smart contract validator list
// The validator list is used on next epoch master nodes
// If we don't have the snapshot, then we have to trace back the gap block smart contract state which is very costly
type SnapshotV2 struct {
	Number uint64      `json:"number"` // Block number where the snapshot was created
	Hash   common.Hash `json:"hash"`   // Block hash where the snapshot was created

	// MasterNodes will get assigned on updateM1
	NextEpochMasterNodes []common.Address `json:"masterNodes"` // Set of authorized master nodes at this moment for next epoch
}

// create new snapshot for next epoch to use
func newSnapshot(number uint64, hash common.Hash, masternodes []common.Address) *SnapshotV2 {
	snap := &SnapshotV2{
		Number:               number,
		Hash:                 hash,
		NextEpochMasterNodes: masternodes,
	}
	return snap
}

// loadSnapshot loads an existing snapshot from the database.
func loadSnapshot(db ethdb.Database, hash common.Hash) (*SnapshotV2, error) {
	blob, err := db.Get(append([]byte("XDPoS-V2-"), hash[:]...))
	if err != nil {
		return nil, err
	}
	snap := new(SnapshotV2)
	if err := json.Unmarshal(blob, snap); err != nil {
		return nil, err
	}

	return snap, nil
}

// store inserts the SnapshotV2 into the database.
func storeSnapshot(s *SnapshotV2, db ethdb.Database) error {
	blob, err := json.Marshal(s)
	if err != nil {
		return err
	}
	return db.Put(append([]byte("XDPoS-V2-"), s.Hash[:]...), blob)
}

// retrieves master nodes list in map type
func (s *SnapshotV2) GetMappedMasterNodes() map[common.Address]struct{} {
	ms := make(map[common.Address]struct{})
	for _, n := range s.NextEpochMasterNodes {
		ms[n] = struct{}{}
	}
	return ms
}

func (s *SnapshotV2) IsMasterNodes(address common.Address) bool {
	for _, n := range s.NextEpochMasterNodes {
		if n.String() == address.String() {
			return true
		}
	}
	return false
}

// snapshot retrieves the authorization snapshot at a given point in time.
func (x *XDPoS_v2) getSnapshot(chain consensus.ChainReader, number uint64, isGapNumber bool) (*SnapshotV2, error) {
	var gapBlockNum uint64
	if isGapNumber {
		gapBlockNum = number
	} else {
		gapBlockNum = number - number%x.config.Epoch - x.config.Gap
		// prevent overflow
		if number-number%x.config.Epoch < x.config.Gap {
			gapBlockNum = 0
		}
	}

	gapBlockHash := chain.GetHeaderByNumber(gapBlockNum).Hash()
	log.Debug("get snapshot from gap block", "number", gapBlockNum, "hash", gapBlockHash.Hex())

	// If an in-memory SnapshotV2 was found, use that
	if s, ok := x.snapshots.Get(gapBlockHash); ok {
		snap := s.(*SnapshotV2)
		log.Trace("Loaded snapshot from memory", "number", gapBlockNum, "hash", gapBlockHash)
		return snap, nil
	}
	// If an on-disk checkpoint snapshot can be found, use that
	snap, err := loadSnapshot(x.db, gapBlockHash)
	if err != nil {
		log.Error("Cannot find snapshot from last gap block", "err", err, "number", gapBlockNum, "hash", gapBlockHash)
		return nil, err
	}

	log.Trace("Loaded snapshot from disk", "number", gapBlockNum, "hash", gapBlockHash)
	x.snapshots.Add(snap.Hash, snap)
	return snap, nil
}

// snapshot retrieves the authorization snapshot at a given point in time.
func (x *XDPoS_v2) getSnapshotByHash(gapBlockHash common.Hash) (*SnapshotV2, error) {
	// If an in-memory SnapshotV2 was found, use that
	if s, ok := x.snapshots.Get(gapBlockHash); ok {
		snap := s.(*SnapshotV2)
		log.Trace("Loaded snapshot from memory", "hash", gapBlockHash)
		return snap, nil
	}
	// If an on-disk checkpoint snapshot can be found, use that
	snap, err := loadSnapshot(x.db, gapBlockHash)
	if err != nil {
		log.Error("Cannot find snapshot from last gap block", "err", err, "hash", gapBlockHash)
		return nil, err
	}

	log.Trace("Loaded snapshot from disk", "hash", gapBlockHash)
	x.snapshots.Add(snap.Hash, snap)
	return snap, nil
}
