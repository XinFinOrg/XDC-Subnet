// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {HeaderReader} from "./libraries/HeaderReader.sol";

contract LiteCheckpoint {
    struct HeaderInfo {
        uint64 number;
        uint64 roundNum;
        int64 mainnetNum;
    }

    struct UnCommittedHeaderInfo {
        uint64 sequence;
        uint64 lastRoundNum;
        uint64 lastNum;
    }

    struct BlockLite {
        bytes32 blockHash;
        uint64 number;
    }

    struct Validators {
        address[] set;
        int256 threshold;
    }
    mapping(bytes32 => bytes32) unCommittedLastHash;
    mapping(bytes32 => uint256) unCommittedTree; // padding uint64 | uint64 sequence | uint64 lastRoundNum | uint64 lastNum
    mapping(bytes32 => uint256) headerTree; // padding uint64 | uint64 number | uint64 roundNum | int64 mainnetNum
    mapping(uint64 => bytes32) heightTree;
    bytes32[] currentTree;
    bytes32[] nextTree;
    mapping(address => bool) lookup;
    mapping(address => bool) uniqueAddr;
    mapping(int256 => Validators) validators;
    Validators currentValidators;
    bytes32 latestCurrentEpochBlock;
    bytes32 latestNextEpochBlock;
    uint64 GAP;
    uint64 EPOCH;

    // Event types
    event SubnetEpochBlockAccepted(bytes32 blockHash, uint64 number);

    constructor(
        address[] memory initialValidatorSet,
        bytes memory block1,
        uint64 gap,
        uint64 epoch
    ) {
        require(initialValidatorSet.length > 0, "Validator Empty");
        bytes32 block1HeaderHash = keccak256(block1);
        validators[1] = Validators({
            set: initialValidatorSet,
            threshold: int256((initialValidatorSet.length * 2) / 3)
        });
        currentValidators = validators[1];
        setLookup(initialValidatorSet);
        latestCurrentEpochBlock = block1HeaderHash;
        GAP = gap;
        EPOCH = epoch;
    }

    //Check if the blocks can be stored
    //params HexRLP array
    function checkHeaders(
        bytes[] calldata headers
    ) external view returns (bool[] memory) {
        bool[] memory result = new bool[](headers.length);
        for (uint256 i = 0; i < headers.length; i++) {
            result[i] = checkHeader(headers[i]);
        }
        return result;
    }

    //Check if the block can be stored
    //params HexRLP
    function checkHeader(bytes calldata header) public view returns (bool) {
        HeaderReader.ValidationParams memory validationParams = HeaderReader
            .getValidationParams(header);

        (address[] memory current, address[] memory next) = HeaderReader
            .getEpoch(header);
        bytes32 blockHash = keccak256(header);
        if (headerTree[blockHash] != 0) {
            return false;
        }
        if (current.length > 0 && next.length > 0) {
            return false;
        }

        if (
            current.length > 0 &&
            validationParams.prevRoundNumber <
            validationParams.roundNumber -
                (validationParams.roundNumber % EPOCH)
        ) {
            return true;
        }

        if (
            next.length > 0 &&
            uint64(uint256(validationParams.number % int256(uint256(EPOCH)))) ==
            EPOCH - GAP + 1
        ) {
            return true;
        }
        return false;
    }

    /*
     * @description core function in the contract, it can be summarized into three steps:
     * 1. Verify subnet header meta information
     * 2. Verify subnet header certificates
     * 3. (Conditional) Update Committed Status for ancestor blocks
     * @param list of rlp-encoded block headers.
     */
    function receiveHeader(bytes[] calldata headers) external {
        if (headers.length == 0) {
            revert("headers length must greater than 0");
        }
        bytes memory header0 = headers[0];
        HeaderReader.ValidationParams memory validationParams = HeaderReader
            .getValidationParams(header0);

        (address[] memory current, address[] memory next) = HeaderReader
            .getEpoch(header0);
        bytes32 blockHash = keccak256(header0);
        checkSig(validationParams);
        if (headerTree[blockHash] != 0) {
            revert("Repeated Block");
        }
        if (current.length > 0 && next.length > 0) {
            revert("Malformed Block");
        } else if (current.length > 0) {
            if (
                validationParams.prevRoundNumber <
                validationParams.roundNumber -
                    (validationParams.roundNumber % EPOCH)
            ) {
                int256 gapNumber = validationParams.number -
                    (validationParams.number % int256(uint256(EPOCH))) -
                    int256(uint256(GAP));
                // Edge case at the beginning
                if (gapNumber < 0) {
                    gapNumber = 0;
                }
                gapNumber = gapNumber + 1;
                if (validators[gapNumber].threshold > 0) {
                    if (validators[gapNumber].set.length != current.length) {
                        revert("Mismatched Validators");
                    }
                    setLookup(validators[gapNumber].set);
                    currentValidators = validators[gapNumber];
                    latestCurrentEpochBlock = blockHash;
                    currentTree.push(blockHash);
                } else {
                    revert("Missing Current Validators");
                }
            } else {
                revert("Invalid Current Block");
            }
        } else if (next.length > 0) {
            if (
                uint64(
                    uint256(validationParams.number % int256(uint256(EPOCH)))
                ) == EPOCH - GAP + 1
            ) {
                (bool isValidatorUnique, ) = checkUniqueness(next);
                if (!isValidatorUnique) revert("Repeated Validator");

                validators[validationParams.number] = Validators({
                    set: next,
                    threshold: int256((next.length * 2) / 3)
                });
                latestNextEpochBlock = blockHash;
                nextTree.push(blockHash);
            } else {
                revert("Invalid Next Block");
            }
        }
        uint256 epochInfo = (uint256(validationParams.number) << 128) |
            (uint256(validationParams.roundNumber) << 64) |
            uint256(uint64(int64(-1)));
        unCommittedLastHash[blockHash] = blockHash;
        unCommittedTree[blockHash] =
            (0 << 128) |
            (uint256(validationParams.roundNumber) << 64) |
            uint256(validationParams.number);

        headerTree[blockHash] = epochInfo;
        heightTree[uint64(epochInfo >> 128)] = blockHash;
        //for commit epoch
        if (headers.length > 1) {
            commitHeader(blockHash, sliceBytes(headers, 1));
        }
        emit SubnetEpochBlockAccepted(blockHash, uint64(epochInfo >> 128));
    }

    function sliceBytes(
        bytes[] calldata data,
        uint256 startIndex
    ) public pure returns (bytes[] memory) {
        require(startIndex < data.length, "Start index is out of range");

        bytes[] memory result = new bytes[](data.length - startIndex);

        for (uint i = startIndex; i < data.length; i++) {
            result[i - startIndex] = data[i];
        }

        return result;
    }

    function commitHeaderByNumber(
        uint256 number,
        bytes[] memory headers
    ) public {
        bytes32 epochHash = heightTree[uint64(number)];
        commitHeader(epochHash, headers);
    }

    /*
     * @description commit header
     * 1. (Conditional) Update Committed Status for ancestor blocks
     * @param list of rlp-encoded block headers.
     */
    function commitHeader(bytes32 epochHash, bytes[] memory headers) public {
        if (headers.length == 0) {
            revert("headers length must greater than 0");
        }
        bytes32 parenHash = unCommittedLastHash[epochHash];
        if (parenHash == 0) {
            revert("epochhash not found");
        }
        UnCommittedHeaderInfo memory uc = getUnCommittedHeader(epochHash);

        uint64 sequence = uc.sequence;
        uint64 lastRoundNum = uc.lastRoundNum;
        uint64 lastNum = uc.lastNum;

        for (uint256 x = 0; x < headers.length; x++) {
            HeaderReader.ValidationParams memory validationParams = HeaderReader
                .getValidationParams(headers[x]);
            bytes32 blockHash = keccak256(headers[x]);
            checkSig(validationParams);

            if (validationParams.parentHash != parenHash) {
                revert("Invalid Block Num Sequence");
            }

            if (validationParams.roundNumber == lastRoundNum + 1) {
                sequence++;
            } else {
                sequence = 0;
            }

            lastNum = uint64(uint256(validationParams.number));
            lastRoundNum = uint64(validationParams.roundNumber);
            parenHash = blockHash;
        }

        if (sequence >= 3) {
            headerTree[epochHash] = clearLowest(headerTree[epochHash], 64);
            headerTree[epochHash] |= block.number;
            unCommittedTree[epochHash] = 0;
            unCommittedLastHash[epochHash] = 0;
        } else {
            unCommittedTree[epochHash] =
                (uint256(sequence) << 128) |
                (uint256(lastRoundNum) << 64) |
                uint256(lastNum);
            bytes32 blockHash = keccak256(headers[headers.length - 1]);
            unCommittedLastHash[epochHash] = blockHash;
        }
    }

    function checkSig(
        HeaderReader.ValidationParams memory validationParams
    ) private {
        // Verify subnet header certificates
        address[] memory signerList = new address[](
            validationParams.sigs.length
        );
        for (uint256 i = 0; i < validationParams.sigs.length; i++) {
            address signer = recoverSigner(
                validationParams.signHash,
                validationParams.sigs[i]
            );
            if (lookup[signer] != true) {
                revert("Verification Fail : lookup[signer] != true");
            }

            signerList[i] = signer;
        }
        (bool isUnique, int256 uniqueCounter) = checkUniqueness(signerList);
        if (!isUnique) {
            revert("Verification Fail : !isUnique");
        }
        if (uniqueCounter < currentValidators.threshold) {
            revert(
                "Verification Fail : uniqueCounter < currentValidators.threshold"
            );
        }
    }

    function clearLowest(
        uint256 epochInfo,
        uint256 offset
    ) private pure returns (uint256) {
        uint256 mask = ~uint256((1 << offset) - 1);
        return epochInfo & mask;
    }

    function setLookup(address[] memory validatorSet) internal {
        for (uint256 i = 0; i < currentValidators.set.length; i++) {
            lookup[currentValidators.set[i]] = false;
        }
        for (uint256 i = 0; i < validatorSet.length; i++) {
            lookup[validatorSet[i]] = true;
        }
    }

    function checkUniqueness(
        address[] memory list
    ) internal returns (bool isVerified, int256 uniqueCounter) {
        uniqueCounter = 0;
        isVerified = true;
        for (uint256 i = 0; i < list.length; i++) {
            if (!uniqueAddr[list[i]]) {
                uniqueCounter++;
                uniqueAddr[list[i]] = true;
            } else {
                isVerified = false;
            }
        }
        for (uint256 i = 0; i < list.length; i++) {
            uniqueAddr[list[i]] = false;
        }
    }

    /// signature methods.
    function splitSignature(
        bytes memory sig
    ) internal pure returns (uint8 v, bytes32 r, bytes32 s) {
        require(sig.length == 65, "Invalid Signature");
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

    function getUnCommittedHeader(
        bytes32 blockHash
    ) public view returns (UnCommittedHeaderInfo memory) {
        return
            UnCommittedHeaderInfo({
                sequence: uint64(unCommittedTree[blockHash] >> 128),
                lastRoundNum: uint64(unCommittedTree[blockHash] >> 64),
                lastNum: uint64(unCommittedTree[blockHash])
            });
    }

    /*
     * @param subnet block hash.
     * @return HeaderInfo struct defined above.
     */
    function getHeader(
        bytes32 blockHash
    ) public view returns (HeaderInfo memory) {
        return
            HeaderInfo({
                number: uint64(headerTree[blockHash] >> 128),
                roundNum: uint64(headerTree[blockHash] >> 64),
                mainnetNum: int64(uint64(headerTree[blockHash]))
            });
    }

    /*
     * @param subnet block number.
     * @return BlockLite struct defined above.
     */
    function getHeaderByNumber(
        uint256 number
    ) public view returns (HeaderInfo memory, bytes32) {
        if (heightTree[uint64(number)] != 0) {
            bytes32 blockHash = heightTree[uint64(number)];
            return (
                HeaderInfo({
                    number: uint64(headerTree[blockHash] >> 128),
                    roundNum: uint64(headerTree[blockHash] >> 64),
                    mainnetNum: int64(uint64(headerTree[blockHash]))
                }),
                blockHash
            );
        } else {
            return (HeaderInfo({number: 0, roundNum: 0, mainnetNum: -1}), 0);
        }
    }

    function getCurrentEpochBlockByIndex(
        uint256 idx
    ) public view returns (HeaderInfo memory) {
        if (idx < currentTree.length) {
            return (
                HeaderInfo({
                    number: uint64(headerTree[currentTree[idx]] >> 128),
                    roundNum: uint64(headerTree[currentTree[idx]] >> 64),
                    mainnetNum: int64(uint64(headerTree[currentTree[idx]]))
                })
            );
        } else {
            return (HeaderInfo({number: 0, roundNum: 0, mainnetNum: -1}));
        }
    }

    function getNextEpochBlockByIndex(
        uint256 idx
    ) public view returns (HeaderInfo memory) {
        if (idx < nextTree.length) {
            return (
                HeaderInfo({
                    number: uint64(headerTree[nextTree[idx]] >> 128),
                    roundNum: uint64(headerTree[nextTree[idx]] >> 64),
                    mainnetNum: int64(uint64(headerTree[nextTree[idx]]))
                })
            );
        } else {
            return (HeaderInfo({number: 0, roundNum: 0, mainnetNum: -1}));
        }
    }

    /*
     * @return pair of BlockLite structs defined above.
     */
    function getLatestBlocks()
        public
        view
        returns (BlockLite memory, BlockLite memory)
    {
        return (
            BlockLite({
                blockHash: latestCurrentEpochBlock,
                number: uint64(headerTree[latestCurrentEpochBlock] >> 128)
            }),
            BlockLite({
                blockHash: latestNextEpochBlock,
                number: uint64(headerTree[latestNextEpochBlock] >> 128)
            })
        );
    }

    /*
     * @return Validators struct defined above.
     */
    function getCurrentValidators() public view returns (Validators memory) {
        return currentValidators;
    }
}
