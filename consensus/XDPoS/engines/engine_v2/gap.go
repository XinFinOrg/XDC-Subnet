package engine_v2

import "github.com/XinFinOrg/XDPoSChain/core/types"

// the block after gap block, whose NextEpoch validators should not be empty
func (x *XDPoS_v2) IsGapPlusOneBlock(header *types.Header) bool {
	return (header.Number.Uint64() % x.config.Epoch) == (x.config.Epoch - x.config.Gap + 1)
}
