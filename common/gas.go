package common

import (
	"math/big"
)

var MinGasPrice50x = big.NewInt(12500000000)
var GasPrice50x = big.NewInt(12500000000)

func GetGasFee(blockNumber, gas uint64) *big.Int {
	fee := new(big.Int).SetUint64(gas)
	fee = fee.Mul(fee, GasPrice50x)
	return fee
}

func GetGasPrice(number *big.Int) *big.Int {
	if number == nil {
		return new(big.Int).Set(TRC21GasPrice)
	}
	return new(big.Int).Set(GasPrice50x)
}

func GetMinGasPrice(number *big.Int) *big.Int {
	if number == nil {
		return new(big.Int).Set(MinGasPrice)
	}
	return new(big.Int).Set(MinGasPrice50x)
}
