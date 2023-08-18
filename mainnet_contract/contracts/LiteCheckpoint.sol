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
    mapping(bytes32 => bytes32) private unCommittedLastHash;
    mapping(bytes32 => uint256) private unCommittedTree; // padding uint64 | uint64 sequence | uint64 lastRoundNum | uint64 lastNum
    mapping(bytes32 => uint256) private headerTree; // padding uint64 | uint64 number | uint64 roundNum | int64 mainnetNum
    mapping(uint64 => bytes32) private heightTree;
    bytes32[] private currentTree;
    mapping(address => bool) private lookup;
    mapping(address => bool) private uniqueAddr;
    mapping(int256 => Validators) private validators;
    Validators private currentValidators;
    bytes32 private latestEpoch;
    bytes32 private latestFinalizedBlock;

    string public constant MODE = "lite";
    uint64 public epochNum;
    uint64 public immutable INIT_GAP;
    uint64 public immutable INIT_EPOCH;

    // Event types
    event SubnetEpochBlockAccepted(bytes32 blockHash, uint64 number);

    constructor(
        address[] memory initialValidatorSet,
        bytes memory block1,
        uint64 initGap,
        uint64 initEpoch
    ) {
        require(initialValidatorSet.length > 0, "Validator Empty");
        bytes32 block1HeaderHash = keccak256(block1);
        validators[1] = Validators({
            set: initialValidatorSet,
            threshold: int256((initialValidatorSet.length * 2 * 100) / 3)
        });
        currentValidators = validators[1];
        setLookup(initialValidatorSet);
        latestEpoch = block1HeaderHash;
        INIT_GAP = initGap;
        INIT_EPOCH = initEpoch;
    }

    /*
     * @description core function in the contract, it can be summarized into three steps:
     * 1. Verify subnet header meta information
     * 2. Verify subnet header certificates
     * 3. (Conditional) Update Committed Status for ancestor blocks
     * 4. header0 always is gap/epoch and next headers is commit header0
     * @param list of rlp-encoded block headers.
     */
    function receiveHeader(bytes[] calldata headers) external {
        require(
            headers.length > 0,
            "receiveHeader : Headers length must be greater than 0"
        );
        bytes memory header0 = headers[0];
        saveEpoch(header0);
        //for commit header0 util
        if (headers.length > 1) {
            bytes32 blockHash = keccak256(header0);
            commitHeader(blockHash, sliceBytes(headers, 1));
        }
    }

    function commitHeaderByNumber(
        uint256 number,
        bytes[] memory headers
    ) external {
        bytes32 epochHash = heightTree[uint64(number)];
        commitHeader(epochHash, headers);
    }

    /*
     * @description commit header
     * 1. (Conditional) Update Committed Status for ancestor blocks
     * @param epochHash the gap/epoch block hash that need to continue commit ，util gap/epoch block hash committed
     * @param headers list of rlp-encoded block headers.
     */
    function commitHeader(bytes32 epochHash, bytes[] memory headers) public {
        require(
            headers.length > 0,
            "commitHeader : Headers length must be greater than 0"
        );

        require(epochHash != 0, "Error epoch hash");
        bytes32 parenHash = unCommittedLastHash[epochHash];
        require(parenHash != 0, "EpochHash not found, may not have been saved");

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
                unchecked {
                    sequence++;
                }
            } else {
                sequence = 0;
            }

            lastNum = uint64(uint256(validationParams.number));
            lastRoundNum = uint64(validationParams.roundNumber);
            parenHash = blockHash;
            if (sequence >= 3) {
                break;
            }
        }

        if (sequence >= 3) {
            headerTree[epochHash] = clearLowest(headerTree[epochHash], 64);
            headerTree[epochHash] |= block.number;
            latestFinalizedBlock = epochHash;
            delete unCommittedTree[epochHash];
            delete unCommittedLastHash[epochHash];
        } else {
            unCommittedTree[epochHash] =
                (uint256(sequence) << 128) |
                (uint256(lastRoundNum) << 64) |
                uint256(lastNum);
            bytes32 blockHash = keccak256(headers[headers.length - 1]);
            unCommittedLastHash[epochHash] = blockHash;
        }
    }

    function saveEpoch(bytes memory header) private {
        HeaderReader.ValidationParams memory validationParams = HeaderReader
            .getValidationParams(header);

        (address[] memory current, address[] memory next) = HeaderReader
            .getEpoch(header);
        bytes32 blockHash = keccak256(header);

        if (headerTree[blockHash] != 0) {
            revert("Repeated Block blockhash");
        }
        if (current.length == 0 && next.length == 0) {
            revert(
                "Not is epoch block format -- current or next length greater than 0"
            );
        }
        if (current.length > 0 && next.length > 0) {
            revert("Malformed Block blockhash");
        }
        checkSig(validationParams);
        if (current.length > 0) {
            if (
                uint64(uint256(validationParams.number)) % INIT_EPOCH == 0 &&
                uint64(uint256(validationParams.number)) / INIT_EPOCH ==
                epochNum + 1
            ) {
                int256 gapNumber = validationParams.number -
                    (validationParams.number % int256(uint256(INIT_EPOCH))) -
                    int256(uint256(INIT_GAP));
                // Edge case at the beginning
                if (gapNumber < 0) {
                    gapNumber = 0;
                }
                unchecked {
                    epochNum++;
                    //add 1 to find last gap block for example gap=450 gapNumber= 1 | 451 | 1351
                    gapNumber++;
                }

                if (validators[gapNumber].threshold > 0) {
                    if (
                        !HeaderReader.areListsEqual(
                            validators[gapNumber].set,
                            current
                        )
                    ) {
                        revert("Mismatched Validators");
                    }

                    for (uint256 i = 0; i < current.length; i++) {}
                    setLookup(validators[gapNumber].set);
                    currentValidators = validators[gapNumber];
                    latestEpoch = blockHash;
                    currentTree.push(blockHash);
                } else {
                    revert("Missing Current Validators");
                }
            } else {
                revert("Invalid Current Block");
            }
        }

        if (next.length > 0) {
            if (
                uint64(
                    uint256(
                        validationParams.number % int256(uint256(INIT_EPOCH))
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
                    threshold: int256((next.length * 2 * 100) / 3)
                });
                latestEpoch = blockHash;
                currentTree.push(blockHash);
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
        emit SubnetEpochBlockAccepted(blockHash, uint64(epochInfo >> 128));
    }

    function sliceBytes(
        bytes[] calldata data,
        uint256 startIndex
    ) private pure returns (bytes[] memory) {
        require(startIndex < data.length, "Start index is out of range");

        bytes[] memory result = new bytes[](data.length - startIndex);

        for (uint256 i = startIndex; i < data.length; i++) {
            result[i - startIndex] = data[i];
        }

        return result;
    }

    function checkSig(
        HeaderReader.ValidationParams memory validationParams
    ) private {
        // Verify subnet header certificates
        address[] memory signerList = new address[](
            validationParams.sigs.length
        );
        for (uint256 i = 0; i < validationParams.sigs.length; i++) {
            address signer = HeaderReader.recoverSigner(
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
        if (uniqueCounter * 100 < currentValidators.threshold) {
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
                unchecked {
                    uniqueCounter++;
                }

                uniqueAddr[list[i]] = true;
            } else {
                isVerified = false;
            }
        }
        for (uint256 i = 0; i < list.length; i++) {
            uniqueAddr[list[i]] = false;
        }
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
                blockHash: latestEpoch,
                number: uint64(headerTree[latestEpoch] >> 128)
            }),
            BlockLite({
                blockHash: latestFinalizedBlock,
                number: uint64(headerTree[latestFinalizedBlock] >> 128)
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
