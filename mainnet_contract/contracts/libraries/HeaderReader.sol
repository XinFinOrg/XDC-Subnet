// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

// HeaderReader is a helper library to read fields out of rlp-encoded blocks.
// It is mainly consisted of Solidity-RLP(https://github.com/hamdiallam/Solidity-RLP) and
// solidity-rlp-encode(https://github.com/bakaoh/solidity-rlp-encode)
library HeaderReader {
    // Solidity-RLP defined constants and struct
    uint8 private constant STRING_SHORT_START = 0x80;
    uint8 private constant STRING_LONG_START = 0xb8;
    uint8 private constant LIST_SHORT_START = 0xc0;
    uint8 private constant LIST_LONG_START = 0xf8;
    uint8 private constant WORD_SIZE = 32;

    struct RLPItem {
        uint256 len;
        uint256 memPtr;
    }

    struct ValidationParams {
        bytes32 parentHash;
        int256 number;
        uint64 roundNumber;
        uint64 prevRoundNumber;
        bytes32 signHash;
        bytes[] sigs;
    }

    /*
     * @param genesis rlp-encoded block header.
     * @return (parentHash, genesisNum) pair.
     */
    function getParentHashAndNumber(
        bytes memory header
    ) internal pure returns (bytes32, int256) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        return (toBytes32(toBytes(ls[0])), int256(toUint(ls[8])));
    }

    /*
     * @param block1 rlp-encoded header.
     * @return (parentHash, blockNum, blockRoundNum).
     */
    function getBlock1Params(
        bytes memory header
    ) internal pure returns (bytes32, int256, uint64) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        RLPItem[] memory extra = toList(
            toRlpItem(getExtraData(toBytes(ls[12])))
        );
        uint64 roundNumber = uint64(toUint(extra[0]));
        return (toBytes32(toBytes(ls[0])), int256(toUint(ls[8])), roundNumber);
    }

    function getSignerList(
        bytes memory header
    ) internal pure returns (address[] memory) {
        ValidationParams memory validationParams = getValidationParams(header);
        address[] memory signerList = new address[](
            validationParams.sigs.length
        );
        for (uint256 i = 0; i < validationParams.sigs.length; i++) {
            address signer = recoverSigner(
                validationParams.signHash,
                validationParams.sigs[i]
            );
            signerList[i] = signer;
        }
        return signerList;
    }

    /// signature methods.
    function splitSignature(
        bytes memory sig
    ) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65, "Invalid Signature : sig.length != 65");
        assembly {
            // first 32 bytes, after the length prefix.
            r := mload(add(sig, 32))
            // second 32 bytes.
            s := mload(add(sig, 64))
            // final byte (first byte of the next 32 bytes).
            v := byte(0, mload(add(sig, 96)))
        }
        // TOCHECK: v needs 27 more, may related with EIP1559
        return (v + 27, r, s);
    }

    function recoverSigner(
        bytes32 message,
        bytes memory sig
    ) internal pure returns (address) {
        (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
        address signer = ecrecover(message, v, r, s);
        require(signer != address(0), "ECDSA: invalid signature");
        return signer;
    }

    /*
     * @param rlp-encoded block header.
     * @return (parentHash, blockNum, blockRoundNum, signed hash, sigs).
     */
    function getValidationParams(
        bytes memory header
    ) internal pure returns (ValidationParams memory) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        RLPItem[] memory extra = toList(
            toRlpItem(getExtraData(toBytes(ls[12])))
        );
        uint64 roundNumber = uint64(toUint(extra[0]));
        RLPItem[] memory proposedBlock = toList(toList(extra[1])[0]);
        bytes32 parentHash = toBytes32(toBytes(proposedBlock[0]));
        uint64 parentRoundNumber = uint64(toUint(proposedBlock[1]));
        int256 parentNumber = int256(toUint(proposedBlock[2]));
        if (parentHash != toBytes32(toBytes(ls[0]))) {
            revert("Verification Failed");
        }
        RLPItem[] memory rawSigs = toList(toList(extra[1])[1]);
        bytes[] memory sigs = new bytes[](rawSigs.length);
        for (uint256 i = 0; i < rawSigs.length; i++) {
            sigs[i] = toBytes(rawSigs[i]);
        }
        bytes32 signHash = createSignHash(
            parentHash,
            parentRoundNumber,
            parentNumber,
            uint64(toUint(toList(extra[1])[2]))
        );
        return
            ValidationParams(
                toBytes32(toBytes(ls[0])),
                int256(toUint(ls[8])),
                roundNumber,
                parentRoundNumber,
                signHash,
                sigs
            );
    }

    /*
     * @param rlp-encoded block header.
     * @return (currentValidator list, nextValidator list).
     */
    function getEpoch(
        bytes memory header
    ) internal pure returns (address[] memory current, address[] memory next) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        RLPItem[] memory list0 = toList(ls[16]);
        if (list0.length > 0) {
            current = new address[](list0.length);
            for (uint256 i = 0; i < list0.length; i++) {
                current[i] = toAddress(list0[i]);
            }
        }
        RLPItem[] memory list1 = toList(ls[17]);

        if (list1.length > 0) {
            RLPItem[] memory list2 = toList(ls[18]);
            address[] memory uniqueAddr = new address[](list2.length);
            address[] memory penalty = new address[](list2.length);
            uint256 counter = 0;
            for (uint256 i = 0; i < list2.length; i++) {
                penalty[i] = toAddress(list2[i]);
                uniqueAddr[i] = penalty[i];
            }
            next = new address[](list1.length - list2.length);
            for (uint256 i = 0; i < list1.length; i++) {
                address temp = toAddress(list1[i]);
                if (!addressExist(uniqueAddr, temp)) {
                    next[counter] = temp;
                    counter++;
                }
            }
        }
    }

    /*
     * @param (list,addr)
     * @return does the address exist in the list
     */
    function addressExist(
        address[] memory list,
        address addr
    ) internal pure returns (bool) {
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == addr) return true;
        }
        return false;
    }

    /*
     * @param extra field bytes (version byte + rlp-encoded proposed info).
     * @return rlp-encoded proposed info.
     */
    function getExtraData(
        bytes memory extra
    ) internal pure returns (bytes memory) {
        bytes memory extraData = new bytes(extra.length - 1);
        uint256 extraDataPtr;
        uint256 extraPtr;
        assembly {
            extraDataPtr := add(extraData, 0x20)
        }
        assembly {
            extraPtr := add(extra, 0x21)
        }
        copy(extraPtr, extraDataPtr, extra.length - 1);
        return extraData;
    }

    /*
     * @param (parentHash, parentRoundNum, parentNum, gapNum).
     * @return hash of rlp-encoded of [[parentHash, parentRoundNum, parentNum], gapNum].
     */
    function createSignHash(
        bytes32 blockHash,
        uint64 roundNum,
        int256 number,
        uint64 gapNum
    ) internal pure returns (bytes32 signHash) {
        bytes[] memory x = new bytes[](3);
        x[0] = encodeBytes(abi.encodePacked(blockHash));
        x[1] = encodeUint(roundNum);
        x[2] = encodeUint(uint256(number));

        bytes[] memory y = new bytes[](2);
        y[0] = encodeList(x);
        y[1] = encodeUint(gapNum);
        signHash = keccak256(encodeList(y));
    }

    function toBytes32(bytes memory data) internal pure returns (bytes32 res) {
        assembly {
            res := mload(add(data, 32))
        }
    }

    /*
     * @param item RLP encoded bytes
     */
    function toRlpItem(
        bytes memory item
    ) internal pure returns (RLPItem memory) {
        uint256 memPtr;
        assembly {
            memPtr := add(item, 0x20)
        }
        return RLPItem(item.length, memPtr);
    }

    /*
     * @param the RLP item.
     * @return (memPtr, len) pair: location of the item's payload in memory.
     */
    function payloadLocation(
        RLPItem memory item
    ) internal pure returns (uint256, uint256) {
        uint256 offset = _payloadOffset(item.memPtr);
        uint256 memPtr = item.memPtr + offset;
        uint256 len = item.len - offset; // data length
        return (memPtr, len);
    }

    /*
     * @param the RLP item containing the encoded list.
     */
    function toList(
        RLPItem memory item
    ) internal pure returns (RLPItem[] memory) {
        require(isList(item), "item is not list");

        uint256 items = numItems(item);
        RLPItem[] memory result = new RLPItem[](items);

        uint256 memPtr = item.memPtr + _payloadOffset(item.memPtr);
        uint256 dataLen;
        for (uint256 i = 0; i < items; i++) {
            dataLen = _itemLength(memPtr);
            result[i] = RLPItem(dataLen, memPtr);
            memPtr = memPtr + dataLen;
        }

        return result;
    }

    // @return indicator whether encoded payload is a list. negate this function call for isData.
    function isList(RLPItem memory item) internal pure returns (bool) {
        if (item.len == 0) return false;

        uint8 byte0;
        uint256 memPtr = item.memPtr;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < LIST_SHORT_START) return false;
        return true;
    }

    function toUint(RLPItem memory item) internal pure returns (uint256) {
        require(
            item.len > 0 && item.len <= 33,
            "item.len > 0 && item.len <= 33"
        );
        uint256 memPtr;
        uint256 len;
        (memPtr, len) = payloadLocation(item);

        uint256 result;
        assembly {
            result := mload(memPtr)

            // shift to the correct location if neccesary
            if lt(len, 32) {
                result := div(result, exp(256, sub(32, len)))
            }
        }

        return result;
    }

    function toAddress(RLPItem memory item) internal pure returns (address) {
        // 1 byte for the length prefix
        require(item.len == 21, "item.len == 21");

        return address(uint160(toUint(item)));
    }

    // @return number of payload items inside an encoded list.
    function numItems(RLPItem memory item) internal pure returns (uint256) {
        if (item.len == 0) return 0;

        uint256 count = 0;
        uint256 currPtr = item.memPtr + _payloadOffset(item.memPtr);
        uint256 endPtr = item.memPtr + item.len;
        while (currPtr < endPtr) {
            currPtr = currPtr + _itemLength(currPtr); // skip over an item
            count++;
        }

        return count;
    }

    // @return entire rlp item byte length
    function _itemLength(uint256 memPtr) internal pure returns (uint256) {
        uint256 itemLen;
        uint256 byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }

        if (byte0 < STRING_SHORT_START) {
            itemLen = 1;
        } else if (byte0 < STRING_LONG_START) {
            itemLen = byte0 - STRING_SHORT_START + 1;
        } else if (byte0 < LIST_SHORT_START) {
            assembly {
                let byteLen := sub(byte0, 0xb7) // # of bytes the actual length is
                memPtr := add(memPtr, 1) // skip over the first byte

                /* 32 byte word size */
                let dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to get the len
                itemLen := add(dataLen, add(byteLen, 1))
            }
        } else if (byte0 < LIST_LONG_START) {
            itemLen = byte0 - LIST_SHORT_START + 1;
        } else {
            assembly {
                let byteLen := sub(byte0, 0xf7)
                memPtr := add(memPtr, 1)

                let dataLen := div(mload(memPtr), exp(256, sub(32, byteLen))) // right shifting to the correct length
                itemLen := add(dataLen, add(byteLen, 1))
            }
        }

        return itemLen;
    }

    // @return number of bytes until the data
    function _payloadOffset(uint256 memPtr) internal pure returns (uint256) {
        uint256 byte0;
        assembly {
            byte0 := byte(0, mload(memPtr))
        }
        if (byte0 < STRING_SHORT_START) {
            return 0;
        } else if (
            byte0 < STRING_LONG_START ||
            (byte0 >= LIST_SHORT_START && byte0 < LIST_LONG_START)
        ) {
            return 1;
        } else if (byte0 < LIST_SHORT_START) {
            // being explicit
            return byte0 - (STRING_LONG_START - 1) + 1;
        } else {
            return byte0 - (LIST_LONG_START - 1) + 1;
        }
    }

    function toBytes(RLPItem memory item) internal pure returns (bytes memory) {
        require(item.len > 0, "item.len > 0");
        uint256 memPtr;
        uint256 len;
        (memPtr, len) = payloadLocation(item);
        bytes memory result = new bytes(len);

        uint256 destPtr;
        assembly {
            destPtr := add(0x20, result)
        }

        copy(memPtr, destPtr, len);
        return result;
    }

    /*
     * @param src Pointer to source
     * @param dest Pointer to destination
     * @param len Amount of memory to copy from the source
     */
    function copy(uint256 src, uint256 dest, uint256 len) internal pure {
        if (len == 0) return;

        // copy as many word sizes as possible
        for (; len >= WORD_SIZE; len -= WORD_SIZE) {
            assembly {
                mstore(dest, mload(src))
            }

            src += WORD_SIZE;
            dest += WORD_SIZE;
        }

        if (len > 0) {
            // left over bytes. Mask is used to remove unwanted bytes from the word
            uint256 mask = 256 ** (WORD_SIZE - len) - 1;
            assembly {
                let srcpart := and(mload(src), not(mask)) // zero out src
                let destpart := and(mload(dest), mask) // retrieve the bytes
                mstore(dest, or(destpart, srcpart))
            }
        }
    }

    /**
     * @dev RLP encodes a byte string.
     * @param self The byte string to encode.
     * @return The RLP encoded string in bytes.
     */
    function encodeBytes(
        bytes memory self
    ) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (self.length == 1 && uint8(self[0]) < 128) {
            encoded = self;
        } else {
            encoded = concat(encodeLength(self.length, 128), self);
        }
        return encoded;
    }

    /**
     * @dev RLP encodes a list of RLP encoded byte byte strings.
     * @param self The list of RLP encoded byte strings.
     * @return The RLP encoded list of items in bytes.
     */
    function encodeList(
        bytes[] memory self
    ) internal pure returns (bytes memory) {
        bytes memory list = flatten(self);
        return concat(encodeLength(list.length, 192), list);
    }

    /**
     * @dev RLP encodes a uint.
     * @param self The uint to encode.
     * @return The RLP encoded uint in bytes.
     */
    function encodeUint(uint256 self) internal pure returns (bytes memory) {
        return encodeBytes(toBinary(self));
    }

    /**
     * @dev Encode the first byte, followed by the `len` in binary form if `length` is more than 55.
     * @param len The length of the string or the payload.
     * @param offset 128 if item is string, 192 if item is list.
     * @return RLP encoded bytes.
     */
    function encodeLength(
        uint256 len,
        uint256 offset
    ) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (len < 56) {
            encoded = new bytes(1);
            encoded[0] = bytes32(len + offset)[31];
        } else {
            uint256 lenLen;
            uint256 i = 1;
            while (len / i != 0) {
                lenLen++;
                i *= 256;
            }
            encoded = new bytes(lenLen + 1);
            encoded[0] = bytes32(lenLen + offset + 55)[31];
            for (i = 1; i <= lenLen; i++) {
                encoded[i] = bytes32((len / (256 ** (lenLen - i))) % 256)[31];
            }
        }
        return encoded;
    }

    /**
     * @dev Encode integer in big endian binary form with no leading zeroes.
     * @notice TODO: This should be optimized with assembly to save gas costs.
     * @param _x The integer to encode.
     * @return RLP encoded bytes.
     */
    function toBinary(uint256 _x) internal pure returns (bytes memory) {
        bytes memory b = new bytes(32);
        assembly {
            mstore(add(b, 32), _x)
        }
        uint256 i;
        for (i = 0; i < 32; i++) {
            if (b[i] != 0) {
                break;
            }
        }
        bytes memory res = new bytes(32 - i);
        for (uint256 j = 0; j < res.length; j++) {
            res[j] = b[i++];
        }
        return res;
    }

    /**
     * @dev Flattens a list of byte strings into one byte string.
     * @notice From: https://github.com/sammayo/solidity-rlp-encoder/blob/master/RLPEncode.sol.
     * @param _list List of byte strings to flatten.
     * @return The flattened byte string.
     */
    function flatten(
        bytes[] memory _list
    ) internal pure returns (bytes memory) {
        if (_list.length == 0) {
            return new bytes(0);
        }

        uint256 len;
        uint256 i;
        for (i = 0; i < _list.length; i++) {
            len += _list[i].length;
        }

        bytes memory flattened = new bytes(len);
        uint256 flattenedPtr;
        assembly {
            flattenedPtr := add(flattened, 0x20)
        }

        for (i = 0; i < _list.length; i++) {
            bytes memory item = _list[i];

            uint256 listPtr;
            assembly {
                listPtr := add(item, 0x20)
            }

            copy(listPtr, flattenedPtr, item.length);
            flattenedPtr += _list[i].length;
        }
        return flattened;
    }

    /**
     * @dev Concatenates two bytes.
     * @notice From: https://github.com/GNSPS/solidity-bytes-utils/blob/master/contracts/BytesLib.sol.
     * @param _preBytes First byte string.
     * @param _postBytes Second byte string.
     * @return Both byte string combined.
     */
    function concat(
        bytes memory _preBytes,
        bytes memory _postBytes
    ) internal pure returns (bytes memory) {
        bytes memory tempBytes;

        assembly {
            tempBytes := mload(0x40)

            let length := mload(_preBytes)
            mstore(tempBytes, length)

            let mc := add(tempBytes, 0x20)
            let end := add(mc, length)

            for {
                let cc := add(_preBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            length := mload(_postBytes)
            mstore(tempBytes, add(length, mload(tempBytes)))

            mc := end
            end := add(mc, length)

            for {
                let cc := add(_postBytes, 0x20)
            } lt(mc, end) {
                mc := add(mc, 0x20)
                cc := add(cc, 0x20)
            } {
                mstore(mc, mload(cc))
            }

            mstore(
                0x40,
                and(
                    add(add(end, iszero(add(length, mload(_preBytes)))), 31),
                    not(31)
                )
            )
        }
        return tempBytes;
    }

    function areListsEqual(
        address[] memory list1,
        address[] memory list2
    ) internal pure returns (bool) {
        if (list1.length != list2.length) {
            return false;
        }

        address[] memory sortedList1 = sortList(list1);
        address[] memory sortedList2 = sortList(list2);

        for (uint i = 0; i < sortedList1.length; i++) {
            if (sortedList1[i] != sortedList2[i]) {
                return false;
            }
        }

        return true;
    }

    function sortList(
        address[] memory arr
    ) internal pure returns (address[] memory) {
        uint len = arr.length;
        for (uint i = 0; i < len; i++) {
            for (uint j = 0; j < len - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    // swap arr[j] and arr[j+1]
                    address temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
        return arr;
    }
}
