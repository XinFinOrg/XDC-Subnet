// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.9.0;
pragma experimental ABIEncoderV2;

// HeaderReader is a helper library to read fields out of rlp-encoded blocks.
// It is mainly consisted of Solidity-RLP(https://github.com/hamdiallam/Solidity-RLP) and
// solidity-rlp-encode(https://github.com/bakaoh/solidity-rlp-encode)
library HeaderReader {
    // Solidity-RLP defined constants and struct
    uint8 constant STRING_SHORT_START = 0x80;
    uint8 constant STRING_LONG_START = 0xb8;
    uint8 constant LIST_SHORT_START = 0xc0;
    uint8 constant LIST_LONG_START = 0xf8;
    uint8 constant WORD_SIZE = 32;

    struct RLPItem {
        uint256 len;
        uint256 memPtr;
    }

    struct ValidationParams {
        bytes32 parentHash;
        int number;
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
    ) public pure returns (bytes32, int) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        return (toBytes32(toBytes(ls[0])), int(toUint(ls[8])));
    }

    /*
     * @param block1 rlp-encoded header.
     * @return (parentHash, blockNum, blockRoundNum).
     */
    function getBlock1Params(
        bytes memory header
    ) public pure returns (bytes32, int, uint64) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        RLPItem[] memory extra = toList(
            toRlpItem(getExtraData(toBytes(ls[12])))
        );
        uint64 round_number = uint64(toUint(extra[0]));
        return (toBytes32(toBytes(ls[0])), int(toUint(ls[8])), round_number);
    }

    /*
     * @param rlp-encoded block header.
     * @return (parentHash, blockNum, blockRoundNum, signed hash, sigs).
     */
    function getValidationParams(
        bytes memory header
    ) public pure returns (ValidationParams memory) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        RLPItem[] memory extra = toList(
            toRlpItem(getExtraData(toBytes(ls[12])))
        );
        uint64 round_number = uint64(toUint(extra[0]));
        RLPItem[] memory proposed_block = toList(toList(extra[1])[0]);
        bytes32 parent_hash = toBytes32(toBytes(proposed_block[0]));
        uint64 parent_round_number = uint64(toUint(proposed_block[1]));
        int parent_number = int(toUint(proposed_block[2]));
        if (parent_hash != toBytes32(toBytes(ls[0]))) {
            revert("Verification Failed");
        }
        RLPItem[] memory raw_sigs = toList(toList(extra[1])[1]);
        bytes[] memory sigs = new bytes[](raw_sigs.length);
        for (uint i = 0; i < raw_sigs.length; i++) {
            sigs[i] = toBytes(raw_sigs[i]);
        }
        bytes32 signHash = createSignHash(
            parent_hash,
            parent_round_number,
            parent_number,
            uint64(toUint(toList(extra[1])[2]))
        );
        return
            ValidationParams(
                toBytes32(toBytes(ls[0])),
                int(toUint(ls[8])),
                round_number,
                parent_round_number,
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
    ) public pure returns (address[] memory current, address[] memory next) {
        RLPItem[] memory ls = toList(toRlpItem(header));
        RLPItem[] memory list0 = toList(ls[16]);
        if (list0.length > 0) {
            current = new address[](list0.length);
            for (uint i = 0; i < list0.length; i++) {
                current[i] = toAddress(list0[i]);
            }
        }
        RLPItem[] memory list1 = toList(ls[17]);

        if (list1.length > 0) {
            RLPItem[] memory list2 = toList(ls[18]);
            address[] memory unique_addr = new address[](list2.length);
            address[] memory penalty = new address[](list2.length);
            uint counter = 0;
            for (uint i = 0; i < list2.length; i++) {
                penalty[i] = toAddress(list2[i]);
                unique_addr[i] = penalty[i];
            }
            next = new address[](list1.length - list2.length);
            for (uint i = 0; i < list1.length; i++) {
                address temp = toAddress(list1[i]);
                if (!addressExist(unique_addr, temp)) {
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
    ) public pure returns (bool) {
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
    ) public pure returns (bytes memory) {
        bytes memory extraData = new bytes(extra.length - 1);
        uint extraDataPtr;
        uint extraPtr;
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
        bytes32 block_hash,
        uint64 round_num,
        int number,
        uint64 gap_num
    ) internal pure returns (bytes32 signHash) {
        bytes[] memory x = new bytes[](3);
        x[0] = encodeBytes(abi.encodePacked(block_hash));
        x[1] = encodeUint(round_num);
        x[2] = encodeUint(uint(number));

        bytes[] memory y = new bytes[](2);
        y[0] = encodeList(x);
        y[1] = encodeUint(gap_num);
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
        require(isList(item));

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
        require(item.len > 0 && item.len <= 33);
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
        require(item.len == 21);

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
        require(item.len > 0);
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
    function encodeUint(uint self) internal pure returns (bytes memory) {
        return encodeBytes(toBinary(self));
    }

    /**
     * @dev Encode the first byte, followed by the `len` in binary form if `length` is more than 55.
     * @param len The length of the string or the payload.
     * @param offset 128 if item is string, 192 if item is list.
     * @return RLP encoded bytes.
     */
    function encodeLength(
        uint len,
        uint offset
    ) internal pure returns (bytes memory) {
        bytes memory encoded;
        if (len < 56) {
            encoded = new bytes(1);
            encoded[0] = bytes32(len + offset)[31];
        } else {
            uint lenLen;
            uint i = 1;
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
    function toBinary(uint _x) internal pure returns (bytes memory) {
        bytes memory b = new bytes(32);
        assembly {
            mstore(add(b, 32), _x)
        }
        uint i;
        for (i = 0; i < 32; i++) {
            if (b[i] != 0) {
                break;
            }
        }
        bytes memory res = new bytes(32 - i);
        for (uint j = 0; j < res.length; j++) {
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

        uint len;
        uint i;
        for (i = 0; i < _list.length; i++) {
            len += _list[i].length;
        }

        bytes memory flattened = new bytes(len);
        uint flattenedPtr;
        assembly {
            flattenedPtr := add(flattened, 0x20)
        }

        for (i = 0; i < _list.length; i++) {
            bytes memory item = _list[i];

            uint listPtr;
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
}
