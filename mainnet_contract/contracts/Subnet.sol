// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {HeaderReader} from "./libraries/HeaderReader.sol";

contract Subnet {
    // Compressed subnet header information stored on chain
    struct Header {
        bytes32 parent_hash;
        uint256 mix; // padding 63 | uint64 number | uint64 round_num | uint64 mainnet_num | bool finalized
    }

    struct HeaderInfo {
        bytes32 parent_hash;
        int number;
        uint64 round_num;
        int mainnet_num;
        bool finalized;
    }

    struct Validators {
        address[] set;
        int threshold;
    }

    struct BlockLite {
        bytes32 hash;
        int number;
    }

    mapping(bytes32 => Header) header_tree;
    mapping(int => bytes32) committed_blocks;
    mapping(address => bool) lookup;
    mapping(address => bool) unique_addr;
    mapping(int => Validators) validators;
    Validators current_validators;
    bytes32 latest_block;
    bytes32 latest_finalized_block;
    uint64 GAP;
    uint64 EPOCH;

    // Event types
    event SubnetBlockAccepted(bytes32 block_hash, int number);
    event SubnetBlockFinalized(bytes32 block_hash, int number);

    constructor(
        address[] memory initial_validator_set,
        bytes memory genesis_header,
        bytes memory block1_header,
        uint64 gap,
        uint64 epoch
    ) {
        require(initial_validator_set.length > 0, "Validator Empty");

        bytes32 genesis_header_hash = keccak256(genesis_header);
        bytes32 block1_header_hash = keccak256(block1_header);
        (bytes32 ph, int n) = HeaderReader.getParentHashAndNumber(
            genesis_header
        );
        (bytes32 ph1, int n1, uint64 rn) = HeaderReader.getBlock1Params(
            block1_header
        );
        require(n == 0 && n1 == 1, "Invalid Init Block");
        header_tree[genesis_header_hash] = Header({
            parent_hash: ph,
            mix: (uint256(n) << 129) | (uint256(block.number) << 1) | 1
        });
        header_tree[block1_header_hash] = Header({
            parent_hash: ph1,
            mix: (uint256(n1) << 129) |
                (uint256(rn) << 65) |
                (uint256(block.number) << 1) |
                1
        });
        validators[1] = Validators({
            set: initial_validator_set,
            threshold: int256((initial_validator_set.length * 2) / 3)
        });
        current_validators = validators[1];
        setLookup(initial_validator_set);
        latest_block = block1_header_hash;
        latest_finalized_block = block1_header_hash;
        committed_blocks[0] = genesis_header_hash;
        committed_blocks[1] = block1_header_hash;
        GAP = gap;
        EPOCH = epoch;
    }

    /*
     * @description core function in the contract, it can be summarized into three steps:
     * 1. Verify subnet header meta information
     * 2. Verify subnet header certificates
     * 3. (Conditional) Update Committed Status for ancestor blocks
     * @param list of rlp-encoded block headers.
     */
    function receiveHeader(bytes[] calldata headers) public {
        for (uint x = 0; x < headers.length; x++) {
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
                            uint64(
                                header_tree[latest_finalized_block].mix >> 129
                            )
                        )
                    ),
                "Old Block"
            );
            require(
                header_tree[validationParams.parentHash].mix != 0,
                "Parent Missing"
            );
            require(
                int256(
                    uint256(
                        uint64(
                            header_tree[validationParams.parentHash].mix >> 129
                        )
                    )
                ) +
                    1 ==
                    validationParams.number,
                "Invalid N"
            );
            require(
                uint64(header_tree[validationParams.parentHash].mix >> 65) <
                    validationParams.roundNumber,
                "Invalid RN"
            );
            require(
                uint64(header_tree[validationParams.parentHash].mix >> 65) ==
                    validationParams.prevRoundNumber,
                "Invalid PRN"
            );

            bytes32 block_hash = keccak256(headers[x]);

            // If block is the epoch block, prepared for validators switch
            if (header_tree[block_hash].mix > 0) revert("Repeated Header");
            if (current.length > 0 && next.length > 0)
                revert("Malformed Block");
            else if (current.length > 0) {
                if (
                    validationParams.prevRoundNumber <
                    validationParams.roundNumber -
                        (validationParams.roundNumber % EPOCH)
                ) {
                    int256 gap_number = validationParams.number -
                        (validationParams.number % int256(uint256(EPOCH))) -
                        int256(uint256(GAP));
                    // Edge case at the beginning
                    if (gap_number < 0) {
                        gap_number = 0;
                    }
                    gap_number = gap_number + 1;
                    if (validators[gap_number].threshold > 0) {
                        if (validators[gap_number].set.length != current.length)
                            revert("Mismatched Validators");
                        setLookup(validators[gap_number].set);
                        current_validators = validators[gap_number];
                    } else revert("Missing Current Validators");
                } else revert("Invalid Current Block");
            } else if (next.length > 0) {
                if (
                    uint64(
                        uint256(
                            validationParams.number % int256(uint256(EPOCH))
                        )
                    ) == EPOCH - GAP + 1
                ) {
                    (bool is_validator_unique, ) = checkUniqueness(next);
                    if (!is_validator_unique) revert("Repeated Validator");

                    validators[validationParams.number] = Validators({
                        set: next,
                        threshold: int256((next.length * 2) / 3)
                    });
                } else revert("Invalid Next Block");
            }
            // Verify subnet header certificates
            address[] memory signer_list = new address[](
                validationParams.sigs.length
            );
            for (uint i = 0; i < validationParams.sigs.length; i++) {
                address signer = recoverSigner(
                    validationParams.signHash,
                    validationParams.sigs[i]
                );
                if (lookup[signer] != true) revert("Verification Fail");
                signer_list[i] = signer;
            }
            (bool is_unique, int unique_counter) = checkUniqueness(signer_list);
            if (!is_unique) revert("Verification Fail");
            if (unique_counter < current_validators.threshold)
                revert("Verification Fail");

            // Store subnet header
            header_tree[block_hash] = Header({
                parent_hash: validationParams.parentHash,
                mix: (uint256(validationParams.number) << 129) |
                    (uint256(validationParams.roundNumber) << 65) |
                    (uint256(0) << 1)
            });
            emit SubnetBlockAccepted(block_hash, validationParams.number);
            if (
                validationParams.number >
                int256(uint256(uint64(header_tree[latest_block].mix >> 129)))
            ) {
                latest_block = block_hash;
            }

            // Look for commitable ancestor block
            (bool is_committed, bytes32 committed_block) = checkCommittedStatus(
                block_hash
            );
            if (!is_committed) continue;
            latest_finalized_block = committed_block;

            // Confirm all ancestor unconfirmed block
            setCommittedStatus(committed_block);
        }
    }

    function setLookup(address[] memory validator_set) internal {
        for (uint i = 0; i < current_validators.set.length; i++) {
            lookup[current_validators.set[i]] = false;
        }
        for (uint i = 0; i < validator_set.length; i++) {
            lookup[validator_set[i]] = true;
        }
    }

    function setCommittedStatus(bytes32 start_block) internal {
        while ((header_tree[start_block].mix & 1) != 1) {
            header_tree[start_block].mix =
                (uint256(
                    int256(uint256(uint64(header_tree[start_block].mix >> 129)))
                ) << 129) |
                (uint256(uint64(header_tree[start_block].mix >> 65)) << 65) |
                (uint256(block.number) << 1) |
                1;
            committed_blocks[
                int256(uint256(uint64(header_tree[start_block].mix >> 129)))
            ] = start_block;
            emit SubnetBlockFinalized(
                start_block,
                int256(uint256(uint64(header_tree[start_block].mix >> 129)))
            );
            start_block = header_tree[start_block].parent_hash;
        }
    }

    function checkUniqueness(
        address[] memory list
    ) internal returns (bool is_unique, int unique_counter) {
        unique_counter = 0;
        is_unique = true;
        for (uint i = 0; i < list.length; i++) {
            if (!unique_addr[list[i]]) {
                unique_counter++;
                unique_addr[list[i]] = true;
            } else {
                is_unique = false;
            }
        }
        for (uint i = 0; i < list.length; i++) {
            unique_addr[list[i]] = false;
        }
    }

    function checkCommittedStatus(
        bytes32 block_hash
    ) internal view returns (bool is_committed, bytes32 committed_block) {
        is_committed = true;
        committed_block = block_hash;
        for (uint i = 0; i < 3; i++) {
            if (header_tree[committed_block].parent_hash == 0) {
                is_committed = false;
                break;
            }
            bytes32 prev_hash = header_tree[committed_block].parent_hash;
            if (
                uint64(header_tree[committed_block].mix >> 65) !=
                uint64(header_tree[prev_hash].mix >> 65) + 1
            ) {
                is_committed = false;
                break;
            } else {
                committed_block = prev_hash;
            }
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
        return ecrecover(message, v, r, s);
    }

    /*
     * @param subnet block hash.
     * @return HeaderInfo struct defined above.
     */
    function getHeader(
        bytes32 block_hash
    ) public view returns (HeaderInfo memory) {
        return
            HeaderInfo({
                parent_hash: header_tree[block_hash].parent_hash,
                number: int256(
                    uint256(uint64(header_tree[block_hash].mix >> 129))
                ),
                round_num: uint64(header_tree[block_hash].mix >> 65),
                mainnet_num: int256(
                    uint256(uint64(header_tree[block_hash].mix >> 1))
                ),
                finalized: (header_tree[block_hash].mix & 1) == 1
            });
    }

    /*
     * @param subnet block number.
     * @return BlockLite struct defined above.
     */
    function getHeaderByNumber(
        int number
    ) public view returns (BlockLite memory) {
        if (committed_blocks[number] == 0) {
            int block_num = int256(
                uint256(uint64(header_tree[latest_block].mix >> 129))
            );
            if (number > block_num) {
                return BlockLite({hash: bytes32(0), number: 0});
            }
            int num_gap = block_num - number;
            bytes32 curr_hash = latest_block;
            for (int i = 0; i < num_gap; i++) {
                curr_hash = header_tree[curr_hash].parent_hash;
            }
            return
                BlockLite({
                    hash: curr_hash,
                    number: int256(
                        uint256(uint64(header_tree[curr_hash].mix >> 129))
                    )
                });
        } else {
            return
                BlockLite({
                    hash: committed_blocks[number],
                    number: int256(
                        uint256(
                            uint64(
                                header_tree[committed_blocks[number]].mix >> 129
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
                hash: latest_block,
                number: int256(
                    uint256(uint64(header_tree[latest_block].mix >> 129))
                )
            }),
            BlockLite({
                hash: latest_finalized_block,
                number: int256(
                    uint256(
                        uint64(header_tree[latest_finalized_block].mix >> 129)
                    )
                )
            })
        );
    }

    /*
     * @return Validators struct defined above.
     */
    function getCurrentValidators() public view returns (Validators memory) {
        return current_validators;
    }
}
