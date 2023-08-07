// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {HeaderReader} from "./libraries/HeaderReader.sol";

contract Checkpoint {
    // Compressed subnet header information stored on chain
    struct Header {
        int256 mainnetNum;
        bytes32 parentHash;
        uint256 mix; // padding 63 | uint64 number | uint64 roundNum | uint64 mainnetNum | bool finalized
    }

    struct HeaderInfo {
        bytes32 parentHash;
        int256 number;
        uint64 roundNum;
        int256 mainnetNum;
        bool finalized;
    }

    struct Validators {
        address[] set;
        int256 threshold;
    }

    struct BlockLite {
        bytes32 hash;
        int256 number;
    }

    mapping(bytes32 => Header) private headerTree;
    mapping(int256 => bytes32) private committedBlocks;
    mapping(address => bool) private lookup;
    mapping(address => bool) private uniqueAddr;
    mapping(int256 => Validators) private validators;
    Validators private currentValidators;
    bytes32 private latestBlock;
    bytes32 private latestFinalizedBlock;
    uint64 private epochNum;
    uint64 private immutable INIT_GAP;
    uint64 private immutable INIT_EPOCH;

    // Event types
    event SubnetBlockAccepted(bytes32 blockHash, int256 number);
    event SubnetBlockFinalized(bytes32 blockHash, int256 number);

    constructor(
        address[] memory initialValidatorSet,
        bytes memory genesisHeader,
        bytes memory block1Header,
        uint64 initGap,
        uint64 initEpoch
    ) {
        require(initialValidatorSet.length > 0, "Validator Empty");

        bytes32 genesisHeaderHash = keccak256(genesisHeader);
        bytes32 block1HeaderHash = keccak256(block1Header);
        (bytes32 ph, int256 n) = HeaderReader.getParentHashAndNumber(
            genesisHeader
        );
        (bytes32 ph1, int256 n1, uint64 rn) = HeaderReader.getBlock1Params(
            block1Header
        );
        require(n == 0 && n1 == 1, "Invalid Init Block");
        headerTree[genesisHeaderHash] = Header({
            parentHash: ph,
            mix: (uint256(n) << 129) |
                //stay here
                (uint256(block.number) << 1) |
                1,
            mainnetNum: int256(block.number)
        });
        headerTree[block1HeaderHash] = Header({
            parentHash: ph1,
            mix: (uint256(n1) << 129) |
                (uint256(rn) << 65) |
                //stay here
                (uint256(block.number) << 1) |
                1,
            mainnetNum: int256(block.number)
        });
        validators[1] = Validators({
            set: initialValidatorSet,
            threshold: int256((initialValidatorSet.length * 2) / 3)
        });
        currentValidators = validators[1];
        setLookup(initialValidatorSet);
        latestBlock = block1HeaderHash;
        latestFinalizedBlock = block1HeaderHash;
        committedBlocks[0] = genesisHeaderHash;
        committedBlocks[1] = block1HeaderHash;
        INIT_GAP = initGap;
        INIT_EPOCH = initEpoch;
    }

    /*
     * @description core function in the contract, it can be summarized into three steps:
     * 1. Verify subnet header meta information
     * 2. Verify subnet header certificates
     * 3. (Conditional) Update Committed Status for ancestor blocks
     * @param list of rlp-encoded block headers.
     */
    function receiveHeader(bytes[] calldata headers) public {
        for (uint256 x = 0; x < headers.length; x++) {
            HeaderReader.ValidationParams memory validationParams = HeaderReader
                .getValidationParams(headers[x]);

            (address[] memory current, address[] memory next) = HeaderReader
                .getEpoch(headers[x]);

            // Verify subnet header meta information
            require(validationParams.number > 0, "Repeated Genesis");
            require(
                validationParams.number >
                    int256(
                        uint256(
                            uint64(headerTree[latestFinalizedBlock].mix >> 129)
                        )
                    ),
                "Old Block"
            );
            require(
                headerTree[validationParams.parentHash].mix != 0,
                "Parent Missing"
            );
            require(
                int256(
                    uint256(
                        uint64(
                            headerTree[validationParams.parentHash].mix >> 129
                        )
                    )
                ) +
                    1 ==
                    validationParams.number,
                "Invalid N"
            );
            require(
                uint64(headerTree[validationParams.parentHash].mix >> 65) <
                    validationParams.roundNumber,
                "Invalid RN"
            );
            require(
                uint64(headerTree[validationParams.parentHash].mix >> 65) ==
                    validationParams.prevRoundNumber,
                "Invalid PRN"
            );

            bytes32 blockHash = keccak256(headers[x]);

            // If block is the INIT_EPOCH block, prepared for validators switch
            if (headerTree[blockHash].mix > 0) revert("Repeated Header");
            if (current.length > 0 && next.length > 0)
                revert("Malformed Block");
            else if (current.length > 0) {
                if (
                    uint64(uint256(validationParams.number)) % INIT_EPOCH ==
                    0 &&
                    uint64(uint256(validationParams.number)) / INIT_EPOCH ==
                    epochNum + 1
                ) {
                    int256 gapNumber = validationParams.number -
                        (validationParams.number %
                            int256(uint256(INIT_EPOCH))) -
                        int256(uint256(INIT_GAP));
                    // Edge case at the beginning
                    if (gapNumber < 0) {
                        gapNumber = 0;
                    }
                    unchecked {
                        epochNum++;
                        gapNumber++;
                    }

                    if (validators[gapNumber].threshold > 0) {
                        if (validators[gapNumber].set.length != current.length)
                            revert("Mismatched Validators");
                        setLookup(validators[gapNumber].set);
                        currentValidators = validators[gapNumber];
                    } else revert("Missing Current Validators");
                } else {
                    revert("Invalid Current Block");
                }
            } else if (next.length > 0) {
                if (
                    uint64(
                        uint256(
                            validationParams.number %
                                int256(uint256(INIT_EPOCH))
                        )
                    ) ==
                    INIT_EPOCH - INIT_GAP + 1 &&
                    uint64(uint256(validationParams.number)) / INIT_EPOCH ==
                    epochNum
                ) {
                    (bool isValidatorUnique, ) = checkUniqueness(next);
                    if (!isValidatorUnique) revert("Repeated Validator");

                    validators[validationParams.number] = Validators({
                        set: next,
                        threshold: int256((next.length * 2) / 3)
                    });
                } else revert("Invalid Next Block");
            }
            // Verify subnet header certificates
            address[] memory signerList = new address[](
                validationParams.sigs.length
            );
            for (uint256 i = 0; i < validationParams.sigs.length; i++) {
                address signer = recoverSigner(
                    validationParams.signHash,
                    validationParams.sigs[i]
                );
                if (lookup[signer] != true)
                    revert("Verification Fail : lookup[signer] is not true");
                signerList[i] = signer;
            }
            (bool isUnique, int256 uniqueCounter) = checkUniqueness(signerList);
            if (!isUnique) revert("Verification Fail : isUnique is false");
            if (uniqueCounter < currentValidators.threshold)
                revert(
                    "Verification Fail : uniqueCounter lower currentValidators.threshold"
                );

            // Store subnet header
            headerTree[blockHash] = Header({
                parentHash: validationParams.parentHash,
                mix: (uint256(validationParams.number) << 129) |
                    (uint256(validationParams.roundNumber) << 65),
                mainnetNum: int256(-1)
            });
            emit SubnetBlockAccepted(blockHash, validationParams.number);
            if (
                validationParams.number >
                int256(uint256(uint64(headerTree[latestBlock].mix >> 129)))
            ) {
                latestBlock = blockHash;
            }

            // Look for commitable ancestor block
            (bool isCommitted, bytes32 committedBlock) = checkCommittedStatus(
                blockHash
            );
            if (!isCommitted) continue;
            latestFinalizedBlock = committedBlock;

            // Confirm all ancestor unconfirmed block
            setCommittedStatus(committedBlock);
        }
    }

    function setLookup(address[] memory validatorSet) internal {
        for (uint256 i = 0; i < currentValidators.set.length; i++) {
            lookup[currentValidators.set[i]] = false;
        }
        for (uint256 i = 0; i < validatorSet.length; i++) {
            lookup[validatorSet[i]] = true;
        }
    }

    function setCommittedStatus(bytes32 startBlock) internal {
        while ((headerTree[startBlock].mix & 1) != 1 && startBlock != 0) {
            headerTree[startBlock].mix |= 1;
            //change mainnetNum value -1 to block.number
            headerTree[startBlock].mainnetNum = int256(block.number);
            committedBlocks[
                int256(uint256(uint64(headerTree[startBlock].mix >> 129)))
            ] = startBlock;
            emit SubnetBlockFinalized(
                startBlock,
                int256(uint256(uint64(headerTree[startBlock].mix >> 129)))
            );
            startBlock = headerTree[startBlock].parentHash;
        }
    }

    function checkUniqueness(
        address[] memory list
    ) internal returns (bool isUnique, int256 uniqueCounter) {
        uniqueCounter = 0;
        isUnique = true;
        for (uint256 i = 0; i < list.length; i++) {
            if (!uniqueAddr[list[i]]) {
                uniqueCounter++;
                uniqueAddr[list[i]] = true;
            } else {
                isUnique = false;
            }
        }
        for (uint256 i = 0; i < list.length; i++) {
            uniqueAddr[list[i]] = false;
        }
    }

    function checkCommittedStatus(
        bytes32 blockHash
    ) internal view returns (bool isCommitted, bytes32 committedBlock) {
        isCommitted = true;
        committedBlock = blockHash;
        for (uint256 i = 0; i < 2; i++) {
            bytes32 prevHash = headerTree[committedBlock].parentHash;

            if (prevHash == 0) {
                isCommitted = false;
                break;
            }

            if (
                uint64(headerTree[committedBlock].mix >> 65) !=
                uint64(headerTree[prevHash].mix >> 65) + uint64(1)
            ) {
                isCommitted = false;
                break;
            } else {
                committedBlock = prevHash;
            }
        }
        committedBlock = headerTree[committedBlock].parentHash;
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

    /*
     * @param subnet block hash.
     * @return HeaderInfo struct defined above.
     */
    function getHeader(
        bytes32 blockHash
    ) public view returns (HeaderInfo memory) {
        return
            HeaderInfo({
                parentHash: headerTree[blockHash].parentHash,
                number: int256(
                    uint256(uint64(headerTree[blockHash].mix >> 129))
                ),
                roundNum: uint64(headerTree[blockHash].mix >> 65),
                mainnetNum: headerTree[blockHash].mainnetNum,
                finalized: (headerTree[blockHash].mix & 1) == 1
            });
    }

    /*
     * @param subnet block number.
     * @return BlockLite struct defined above.
     */
    function getHeaderByNumber(
        int256 number
    ) public view returns (BlockLite memory) {
        if (committedBlocks[number] == 0) {
            int256 blockNum = int256(
                uint256(uint64(headerTree[latestBlock].mix >> 129))
            );
            if (number > blockNum) {
                return BlockLite({hash: bytes32(0), number: 0});
            }
            int256 numGap = blockNum - number;
            bytes32 currHash = latestBlock;
            for (int256 i = 0; i < numGap; i++) {
                currHash = headerTree[currHash].parentHash;
            }
            return
                BlockLite({
                    hash: currHash,
                    number: int256(
                        uint256(uint64(headerTree[currHash].mix >> 129))
                    )
                });
        } else {
            return
                BlockLite({
                    hash: committedBlocks[number],
                    number: int256(
                        uint256(
                            uint64(
                                headerTree[committedBlocks[number]].mix >> 129
                            )
                        )
                    )
                });
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
                hash: latestBlock,
                number: int256(
                    uint256(uint64(headerTree[latestBlock].mix >> 129))
                )
            }),
            BlockLite({
                hash: latestFinalizedBlock,
                number: int256(
                    uint256(uint64(headerTree[latestFinalizedBlock].mix >> 129))
                )
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
