// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.9.0;
pragma experimental ABIEncoderV2;

import "./HeaderReader.sol";

contract Subnet {

  struct HeaderInfo {
    int number;
    uint64 round_num;
    int mainnet_num;
  }

  struct BlockLite {
    bytes32 block_hash;
    int number;
  }

  struct Validators {
    address[] set;
    int threshold;
  }

  mapping(bytes32 => uint256) header_tree; // padding 64 | uint64 number | uint64 round_num | uint64 mainnet_num
  mapping(uint64 => bytes32) height_tree;
  bytes32[] current_tree;
  bytes32[] next_tree;
  mapping(address => bool) lookup;
  mapping(address => bool) unique_addr;
  mapping(address => bool) masters;
  mapping(int => Validators) validators;
  Validators current_validators;
  bytes32 latest_current_epoch_block;
  bytes32 latest_next_epoch_block;
  uint64 GAP;
  uint64 EPOCH;

  // Function temp space
  bytes32 prev_hash;
  uint64 prev_rn;
  uint256 epoch_info = 0;
  bytes32 epoch_hash = 0;

  // Event types
  event SubnetEpochBlockAccepted(bytes32 block_hash, uint64 number);

  // Modifier
  modifier onlyMasters() {
    if (!masters[msg.sender]) revert("Masters Only");
    _;
  }

  constructor(
    address[] memory initial_validator_set,
    bytes memory block1,
    uint64 gap,
    uint64 epoch
  ) public {
    require(initial_validator_set.length > 0, "Validator Empty");
    bytes32 block1_header_hash = keccak256(block1);
    validators[1] = Validators({
      set: initial_validator_set,
      threshold: int256(initial_validator_set.length * 2 / 3)
    });
    current_validators = validators[1];
    setLookup(initial_validator_set);
    masters[msg.sender] = true;
    latest_current_epoch_block = block1_header_hash;
    GAP = gap;
    EPOCH = epoch;
  }

  function isMaster(address master) public view returns (bool) {
    return masters[master];
  }

  function addMaster(address master) public onlyMasters {
    masters[master] = true;
  }

  function removeMaster(address master) public onlyMasters {
    masters[master] = false;
  }

  /*
  * @description core function in the contract, it can be summarized into three steps:
  * 1. Verify subnet header meta information
  * 2. Verify subnet header certificates
  * 3. (Conditional) Update Committed Status for ancestor blocks
  * @param list of rlp-encoded block headers.
  */
  function receiveHeader(bytes[] memory headers) public onlyMasters {
    require(headers.length > 3, "Invalid Sequence");
    for (uint x = 0; x < headers.length; x++) {
      (
        bytes32 parent_hash,
        int number,
        uint64 round_number,
        uint64 prev_round_number,
        bytes32 signHash,
        bytes[] memory sigs
      ) = HeaderReader.getValidationParams(headers[x]);
    
      (
        address[] memory current,
        address[] memory next
      ) = HeaderReader.getEpoch(headers[x]);
      bytes32 block_hash = keccak256(headers[x]);
      if (x == 0) {
        if (header_tree[block_hash] != 0) revert("Repeated Block");
        if (current.length > 0 && next.length > 0) revert("Malformed Block");
        else if (current.length > 0) {
          if (prev_round_number < round_number - (round_number % EPOCH)) {
            int256 gap_number = number - number % int256(uint256(EPOCH)) - int256(uint256(GAP));
            // Edge case at the beginning
            if (gap_number < 0) {
              gap_number = 0;
            }
            gap_number = gap_number + 1;
            if (validators[gap_number].threshold > 0) {
              if (validators[gap_number].set.length != current.length) revert("Mismatched Validators");
              setLookup(validators[gap_number].set);
              current_validators = validators[gap_number];
              latest_current_epoch_block = block_hash;
              current_tree.push(block_hash); 
              } else revert("Missing Current Validators");
            } else revert("Invalid Current Block");
          } else if (next.length > 0) {
            if (uint64(uint256(number % int256(uint256(EPOCH)))) == EPOCH - GAP + 1) {

              (bool is_validator_unique, ) = checkUniqueness(next);
              if (!is_validator_unique) revert("Repeated Validator");

              validators[number] = Validators({
                set: next,
                threshold: int256(next.length * 2 / 3)
              });
              latest_next_epoch_block = block_hash;
              next_tree.push(block_hash);
            } else
              revert("Invalid Next Block");
          }
          epoch_info = uint256(number) << 128 | uint256(round_number) << 64 | uint256(block.number);
          epoch_hash = block_hash;
      }

      // Verify subnet header certificates
      address[] memory signer_list = new address[](sigs.length);
      for (uint i = 0; i < sigs.length; i++) {
        address signer = recoverSigner(signHash, sigs[i]);
        if (lookup[signer] != true) revert("Verification Fail");
        signer_list[i] = signer;
      }
      (bool is_unique, int unique_counter) = checkUniqueness(signer_list);
      if (!is_unique) revert("Verification Fail"); 
      if (unique_counter < current_validators.threshold) revert("Verification Fail");

      if (x > 0) {
        if (parent_hash != prev_hash) revert("Invalid Block Sequence");
      }
      if (x < headers.length - 1) prev_hash = block_hash;
      if (x > headers.length - 3) {
        if (round_number != prev_rn + 1) revert("Uncommitted Epoch Block");
      }
      if (x >= headers.length - 3) prev_rn = round_number;
    }
    header_tree[epoch_hash] = epoch_info;
    height_tree[uint64(epoch_info >> 128)] = epoch_hash;
    emit SubnetEpochBlockAccepted(epoch_hash, uint64(epoch_info >> 128));
  }

  function setLookup(address[] memory validator_set) internal {
    for (uint i = 0; i < current_validators.set.length; i++) {
      lookup[current_validators.set[i]] = false;
    }
    for (uint i = 0; i < validator_set.length; i++) {
      lookup[validator_set[i]] = true;
    }
  }

  function checkUniqueness(address[] memory list) 
    internal 
    returns (bool is_verified, int unique_counter) 
  {
    unique_counter = 0;
    is_verified = true;
    for (uint i = 0; i < list.length; i++) {
      if (!unique_addr[list[i]]) {
        unique_counter ++;
        unique_addr[list[i]]=true;
      } else {
        is_verified = false;
      }
    }
    for (uint i = 0; i < list.length; i++) {
      unique_addr[list[i]] = false;
    }
  }


  /// signature methods.
  function splitSignature(bytes memory sig)
    internal
    pure
    returns (uint8 v, bytes32 r, bytes32 s)
  {
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
    return (v+27, r, s);
  }

  function recoverSigner(bytes32 message, bytes memory sig)
    internal
    pure
    returns (address)
  {
    (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
    return ecrecover(message, v, r, s);
  }

  /*
  * @param subnet block hash.
  * @return HeaderInfo struct defined above.
  */
  function getHeader(bytes32 block_hash) public view returns (HeaderInfo memory) {
    return HeaderInfo({
      number: int256(uint256(uint64(header_tree[block_hash] >> 128))),
      round_num: uint64(header_tree[block_hash] >> 64),
      mainnet_num: int256(uint256(uint64(header_tree[block_hash])))
    });
  }

  /*
  * @param subnet block number.
  * @return BlockLite struct defined above.
  */
  function getHeaderByNumber(int number) public view returns (HeaderInfo memory, bytes32) {
    if (height_tree[uint64(uint(number))] == 0) {
      return (
        HeaderInfo({
          number: 0,
          round_num: 0,
          mainnet_num: 0
        }), 0
      );
    } else {
      bytes32 block_hash = height_tree[uint64(uint(number))];
      return (
        HeaderInfo({
          number: int(header_tree[block_hash] >> 128),
          round_num: uint64(header_tree[block_hash] >> 64),
          mainnet_num: int(uint(uint64(header_tree[block_hash])))
        }), block_hash
      );
    }
  }

  function getCurrentEpochBlockByIndex(int idx) public view returns (HeaderInfo memory) {
    if (uint256(idx) < current_tree.length) {
      return (
        HeaderInfo({
          number: int(header_tree[current_tree[uint256(idx)]] >> 128),
          round_num: uint64(header_tree[current_tree[uint256(idx)]] >> 64),
          mainnet_num: int(uint(uint64(header_tree[current_tree[uint256(idx)]])))
        })
      );
    } else {
      return (
        HeaderInfo({
          number: 0,
          round_num: 0,
          mainnet_num: 0
        })
      );
    }
  }

  function getNextEpochBlockByIndex(int idx) public view returns (HeaderInfo memory) {
    if (uint256(idx) < next_tree.length) {
      return (
        HeaderInfo({
          number: int(header_tree[next_tree[uint256(idx)]] >> 128),
          round_num: uint64(header_tree[next_tree[uint256(idx)]] >> 64),
          mainnet_num: int(uint(uint64(header_tree[next_tree[uint256(idx)]])))
        })
      );
    } else {
      return (
        HeaderInfo({
          number: 0,
          round_num: 0,
          mainnet_num: 0
        })
      );
    }
  }

  /*
  * @return pair of BlockLite structs defined above.
  */
  function getLatestBlocks() public view returns (BlockLite memory, BlockLite memory) {
    return (
      BlockLite({
        block_hash: latest_current_epoch_block,
        number: int(header_tree[latest_current_epoch_block] >> 128)
      }),
      BlockLite({
        block_hash: latest_next_epoch_block,
        number: int(header_tree[latest_next_epoch_block] >> 128)
    }));
  }

  /*
  * @return Validators struct defined above.
  */
  function getCurrentValidators() public view returns (Validators memory) {
    return current_validators;
  }

}