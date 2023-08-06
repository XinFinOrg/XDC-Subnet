// Copyright 2019 The go-ethereum Authors
// This file is part of the go-ethereum library.
//
// The go-ethereum library is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// The go-ethereum library is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Lesser General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with the go-ethereum library. If not, see <http://www.gnu.org/licenses/>.

package core

import (
	"context"
	"errors"
	"fmt"

	"github.com/ethereum/go-ethereum/accounts"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/common/hexutil"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/signer/core/apitypes"
)

// sign receives a request and produces a signature
//
// Note, the produced signature conforms to the secp256k1 curve R, S and V values,
// where the V value will be 27 or 28 for legacy reasons, if legacyV==true.
func (api *SignerAPI) sign(req *SignDataRequest, legacyV bool) (hexutil.Bytes, error) {
	// We make the request prior to looking up if we actually have the account, to prevent
	// account-enumeration via the API
	res, err := api.UI.ApproveSignData(req)
	if err != nil {
		return nil, err
	}
	if !res.Approved {
		return nil, ErrRequestDenied
	}
	// Look up the wallet containing the requested signer
	account := accounts.Account{Address: req.Address.Address()}
	wallet, err := api.am.Find(account)
	if err != nil {
		return nil, err
	}
	pw, err := api.lookupOrQueryPassword(account.Address,
		"Password for signing",
		fmt.Sprintf("Please enter password for signing data with account %s", account.Address.Hex()))
	if err != nil {
		return nil, err
	}
	// Sign the data with the wallet
	signature, err := wallet.SignDataWithPassphrase(account, pw, req.ContentType, req.Rawdata)
	if err != nil {
		return nil, err
	}
	if legacyV {
		signature[64] += 27 // Transform V from 0/1 to 27/28 according to the yellow paper
	}
	return signature, nil
}

// SignTextWithValidator signs the given message which can be further recovered
// with the given validator.
// hash = keccak256("\x19\x00"${address}${data}).
func SignTextValidator(validatorData apitypes.ValidatorData) (hexutil.Bytes, string) {
	msg := fmt.Sprintf("\x19\x00%s%s", string(validatorData.Address.Bytes()), string(validatorData.Message))
	return crypto.Keccak256([]byte(msg)), msg
}

// SignTypedData signs EIP-712 conformant typed data
// hash = keccak256("\x19${byteVersion}${domainSeparator}${hashStruct(message)}")
// It returns
// - the signature,
// - and/or any error
func (api *SignerAPI) SignTypedData(ctx context.Context, addr common.MixedcaseAddress, typedData apitypes.TypedData) (hexutil.Bytes, error) {
	signature, _, err := api.signTypedData(ctx, addr, typedData, nil)
	return signature, err
}

// signTypedData is identical to the capitalized version, except that it also returns the hash (preimage)
// - the signature preimage (hash)
func (api *SignerAPI) signTypedData(ctx context.Context, addr common.MixedcaseAddress,
	typedData apitypes.TypedData, validationMessages *apitypes.ValidationMessages) (hexutil.Bytes, hexutil.Bytes, error) {
	domainSeparator, err := typedData.HashStruct("EIP712Domain", typedData.Domain.Map())
	if err != nil {
		return nil, nil, err
	}
	typedDataHash, err := typedData.HashStruct(typedData.PrimaryType, typedData.Message)
	if err != nil {
		return nil, nil, err
	}
	rawData := []byte(fmt.Sprintf("\x19\x01%s%s", string(domainSeparator), string(typedDataHash)))
	sighash := crypto.Keccak256(rawData)
	messages, err := typedData.Format()
	if err != nil {
		return nil, nil, err
	}
	req := &SignDataRequest{
		ContentType: apitypes.DataTyped.Mime,
		Rawdata:     rawData,
		Messages:    messages,
		Hash:        sighash,
		Address:     addr}
	if validationMessages != nil {
		req.Callinfo = validationMessages.Messages
	}
	signature, err := api.sign(req, true)
	if err != nil {
		api.UI.ShowError(err.Error())
		return nil, nil, err
	}
	return signature, sighash, nil
}

// EcRecover recovers the address associated with the given sig.
// Only compatible with `text/plain`
func (api *SignerAPI) EcRecover(ctx context.Context, data hexutil.Bytes, sig hexutil.Bytes) (common.Address, error) {
	// Returns the address for the Account that was used to create the signature.
	//
	// Note, this function is compatible with eth_sign and personal_sign. As such it recovers
	// the address of:
	// hash = keccak256("\x19${byteVersion}Ethereum Signed Message:\n${message length}${message}")
	// addr = ecrecover(hash, signature)
	//
	// Note, the signature must conform to the secp256k1 curve R, S and V values, where
	// the V value must be be 27 or 28 for legacy reasons.
	//
	// https://github.com/ethereum/go-ethereum/wiki/Management-APIs#personal_ecRecover
	if len(sig) != 65 {
		return common.Address{}, fmt.Errorf("signature must be 65 bytes long")
	}
	if sig[64] != 27 && sig[64] != 28 {
		return common.Address{}, fmt.Errorf("invalid Ethereum signature (V is not 27 or 28)")
	}
	sig[64] -= 27 // Transform yellow paper V from 27/28 to 0/1
	hash := accounts.TextHash(data)
	rpk, err := crypto.SigToPub(hash, sig)
	if err != nil {
		return common.Address{}, err
	}
	return crypto.PubkeyToAddress(*rpk), nil
}

// UnmarshalValidatorData converts the bytes input to typed data
func UnmarshalValidatorData(data interface{}) (apitypes.ValidatorData, error) {
	raw, ok := data.(map[string]interface{})
	if !ok {
		return apitypes.ValidatorData{}, errors.New("validator input is not a map[string]interface{}")
	}
	addr, ok := raw["address"].(string)
	if !ok {
		return apitypes.ValidatorData{}, errors.New("validator address is not sent as a string")
	}
	addrBytes, err := hexutil.Decode(addr)
	if err != nil {
		return apitypes.ValidatorData{}, err
	}
	if !ok || len(addrBytes) == 0 {
		return apitypes.ValidatorData{}, errors.New("validator address is undefined")
	}

	message, ok := raw["message"].(string)
	if !ok {
		return apitypes.ValidatorData{}, errors.New("message is not sent as a string")
	}
	messageBytes, err := hexutil.Decode(message)
	if err != nil {
		return apitypes.ValidatorData{}, err
	}
	if !ok || len(messageBytes) == 0 {
		return apitypes.ValidatorData{}, errors.New("message is undefined")
	}

	return apitypes.ValidatorData{
		Address: common.BytesToAddress(addrBytes),
		Message: messageBytes,
	}, nil
}
