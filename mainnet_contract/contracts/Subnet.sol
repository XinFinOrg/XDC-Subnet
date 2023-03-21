// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.9.0;
pragma experimental ABIEncoderV2;

import "./HeaderReader.sol";

contract Subnet {

  struct Header {
    bytes32 hash;
    int number;
    uint64 round_num;
    bytes32 parent_hash;
    bool finalized;
    uint mainnet_num;
    bytes src;
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
  mapping(int => Validators) validator_sets;
  mapping(address => bool) lookup;
  mapping(address => bool) unique_addr;
  mapping(address => bool) masters;
  int current_validator_set_pointer = 0;
  int current_subnet_height;
  bytes32 latest_block;
  bytes32 latest_finalized_block;

  // Event types
  event SubnetBlockAccepted(bytes32 block_hash, int number);
  event SubnetBlockFinalized(bytes32 block_hash, int number);

  // Modifier
  modifier onlyMasters() {
    if (!masters[msg.sender]) revert("Masters Only");
    _;
  }

  constructor(
    address[] memory initial_validator_set,
    int threshold,
    bytes memory genesis_header,
    bytes memory block1_header
  ) {
    require(initial_validator_set.length > 0, "Validator Empty");
    require(threshold > 0, "Invalid Threshold");
    bytes32 genesis_header_hash = keccak256(genesis_header);
    bytes32 block1_header_hash = keccak256(block1_header);
    (bytes32 ph, int n) = HeaderReader.getParentHashAndNumber(genesis_header);
    (bytes32 ph1, int n1, uint64 rn) = HeaderReader.getBlock1Params(block1_header);
    header_tree[genesis_header_hash] = Header({
      hash: genesis_header_hash,
      number: n,
      round_num: 0, 
      parent_hash: ph,
      finalized: true,
      mainnet_num: block.number,
      src: genesis_header
    });
    header_tree[block1_header_hash] = Header({
      hash: block1_header_hash,
      number: n1,
      round_num: rn, 
      parent_hash: ph1,
      finalized: true,
      mainnet_num: block.number,
      src: block1_header
    });
    validator_sets[0] = Validators({
      set: initial_validator_set,
      threshold: threshold
    });
    for (uint i = 0; i < initial_validator_set.length; i++) {
      lookup[initial_validator_set[i]] = true;
    }
    masters[msg.sender] = true;
    latest_block = block1_header_hash;
    latest_finalized_block = block1_header_hash;
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

  function reviseValidatorSet(address[] memory new_validator_set, int threshold, int subnet_block_height) public onlyMasters  {
    require(new_validator_set.length > 0, "Validator Empty");
    require(threshold > 0, "Invalid Threshold");
    require(subnet_block_height > 1, "Invalid Target Height");
    require(subnet_block_height >= current_validator_set_pointer, "Modify Past Validator");
    validator_sets[subnet_block_height] = Validators({
      set: new_validator_set,
      threshold: threshold
    });
  }
  // 939105
  function receiveHeader(bytes memory header) public onlyMasters { 
    (
      bytes32 parent_hash,
      int number,
      uint64 round_number,
      uint64 prev_round_number,
      bytes32 signHash,
      bytes[] memory sigs
    ) = HeaderReader.getValidationParams(header);
    // 765373
    require(number > 0, "Repeated Genesis");
    require(number > header_tree[latest_finalized_block].number, "Old Block");
    require(header_tree[parent_hash].hash != 0, "Parent Missing");
    require(header_tree[parent_hash].number + 1 == number, "Invalid N");
    require(header_tree[parent_hash].round_num < round_number, "Invalid RN");
    require(header_tree[parent_hash].round_num == prev_round_number, "Invalid PRN");
    // 755683
    bytes32 block_hash = keccak256(header);
    if (header_tree[block_hash].number > 0) 
      revert("Repeated Header");
    if (validator_sets[number].set.length > 0) {
      for (uint i = 0; i < validator_sets[current_validator_set_pointer].set.length; i++) {
        lookup[validator_sets[current_validator_set_pointer].set[i]] = false;
      }
      for (uint i = 0; i < validator_sets[number].set.length; i++) {
        lookup[validator_sets[number].set[i]] = true;
      }
      current_validator_set_pointer = number;
    }
    // 751255
    int unique_counter = 0;
    address[] memory signer_list = new address[](sigs.length);
    for (uint i = 0; i < sigs.length; i++) {
      address signer = recoverSigner(signHash, sigs[i]);
      if (lookup[signer] != true) {
        revert("Verification Fail");
      }
      if (!unique_addr[signer]) {
        unique_counter ++;
        unique_addr[signer]=true;
      } else {
        revert("Verification Fail");
      }
      signer_list[i] = signer;
    }
    for (uint i = 0; i < signer_list.length; i++) {
      unique_addr[signer_list[i]] = false;
    }
    if (unique_counter < validator_sets[current_validator_set_pointer].threshold) {
      revert("Verification Fail");
    }
    // 686855
    header_tree[block_hash] = Header({
      hash: block_hash,
      number: number,
      round_num: round_number,
      parent_hash: parent_hash,
      finalized: false,
      mainnet_num: block.number,
      src: header
    });
    // 179582
    emit SubnetBlockAccepted(block_hash, number);
    if (header_tree[block_hash].number > header_tree[latest_block].number) {
      latest_block = block_hash;
    }
    // 178035
    // Look for 3 consecutive round
    bytes32 curr_hash = block_hash;
    for (uint i = 0; i < 3; i++) {
      if (header_tree[curr_hash].parent_hash == 0) return;
      bytes32 prev_hash = header_tree[curr_hash].parent_hash;
      if (header_tree[curr_hash].round_num != header_tree[prev_hash].round_num+1) return;
      curr_hash = prev_hash;
    }
    latest_finalized_block = curr_hash;
    // Confirm all ancestor unconfirmed block
    while (header_tree[curr_hash].finalized != true) {
      header_tree[curr_hash].finalized = true;
      emit SubnetBlockFinalized(curr_hash, header_tree[curr_hash].number);
      curr_hash = header_tree[curr_hash].parent_hash;
    }
    // 166189
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

  function getHeader(bytes32 header_hash) public view returns (bytes memory) {
    return header_tree[header_hash].src;
  }
  
  function getHeaderConfirmationStatus(bytes32 header_hash) public view returns (bool) {
    return header_tree[header_hash].finalized;
  }

  function getMainnetBlockNumber(bytes32 header_hash) public view returns (uint) {
    return header_tree[header_hash].mainnet_num;
  }

  function getLatestBlocks() public view returns (BlockLite memory, BlockLite memory) {
    return (
      BlockLite({
        hash: latest_block,
        number: header_tree[latest_block].number
      }),
      BlockLite({
        hash: latest_finalized_block,
        number: header_tree[latest_finalized_block].number
      })
    );
  }

  function getValidatorSet(int height) public view returns (address[] memory res) {
    if (validator_sets[height].threshold == 0) {
      res = new address[](0);
    } else {
      res = validator_sets[height].set;
    }
  }

  function getValidatorThreshold(int height) public view returns (int res) {
    if (validator_sets[height].threshold == 0) {
      res = 0;
    } else {
      res = validator_sets[height].threshold;
    }
  }
}