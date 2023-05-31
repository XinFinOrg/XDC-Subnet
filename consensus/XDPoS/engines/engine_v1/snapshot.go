package engine_v1

import (
	"github.com/XinFinOrg/XDC-Subnet/common"
	"github.com/XinFinOrg/XDC-Subnet/consensus/clique"
	"github.com/XinFinOrg/XDC-Subnet/params"
	lru "github.com/hashicorp/golang-lru"
)

// Vote represents a single vote that an authorized signer made to modify the
// list of authorizations.
//type Vote struct {
//	Signer    common.Address `json:"signer"`    // Authorized signer that cast this vote
//	Block     uint64         `json:"block"`     // Block number the vote was cast in (expire old votes)
//	Address   common.Address `json:"address"`   // Account being voted on to change its authorization
//	Authorize bool           `json:"authorize"` // Whether to authorize or deauthorize the voted account
//}

// Tally is a simple vote tally to keep the current score of votes. Votes that
// go against the proposal aren't counted since it's equivalent to not voting.
//type Tally struct {
//	Authorize bool `json:"authorize"` // Whether the vote is about authorizing or kicking someone
//	Votes     int  `json:"votes"`     // Number of votes until now wanting to pass the proposal
//}

// Snapshot is the state of the authorization voting at a given point in time.
type SnapshotV1 struct {
	config   *params.XDPoSConfig // Consensus engine parameters to fine tune behavior
	sigcache *lru.ARCCache       // Cache of recent block signatures to speed up ecrecover

	Number  uint64                          `json:"number"`  // Block number where the snapshot was created
	Hash    common.Hash                     `json:"hash"`    // Block hash where the snapshot was created
	Signers map[common.Address]struct{}     `json:"signers"` // Set of authorized signers at this moment
	Recents map[uint64]common.Address       `json:"recents"` // Set of recent signers for spam protections
	Votes   []*clique.Vote                  `json:"votes"`   // List of votes cast in chronological order
	Tally   map[common.Address]clique.Tally `json:"tally"`   // Current vote tally to avoid recalculating
}
