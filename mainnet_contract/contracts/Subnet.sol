// SPDX-License-Identifier: MIT
pragma solidity >=0.4.21 <0.9.0;
pragma experimental ABIEncoderV2;

import "./HeaderReader.sol";

contract Subnet {

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
  mapping(address => bool) masters;
  mapping(int => Validators) validators;
  Validators current_validators;
  bytes32 latest_block;
  bytes32 latest_finalized_block;
  uint64 GAP;
  uint64 EPOCH;

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
    bytes memory genesis_header,
    bytes memory block1_header,
    uint64 gap,
    uint64 epoch
  ) public {
    require(initial_validator_set.length > 0, "Validator Empty");
    bytes32 genesis_header_hash = keccak256(genesis_header);
    bytes32 block1_header_hash = keccak256(block1_header);
    (bytes32 ph, int n) = HeaderReader.getParentHashAndNumber(genesis_header);
    (bytes32 ph1, int n1, uint64 rn) = HeaderReader.getBlock1Params(block1_header);
    require(n == 0 && n1 == 1, "Invalid Init Block");
    header_tree[genesis_header_hash] = Header({
      parent_hash: ph,
      mix: uint256(n) << 129 | uint256(block.number) << 1 | 1
    });
    header_tree[block1_header_hash] = Header({
      parent_hash: ph1,
      mix: uint256(n1) << 129 | uint256(rn) << 65 | uint256(block.number) << 1 | 1
    });
    validators[1] = Validators({
      set: initial_validator_set,
      threshold: int256(initial_validator_set.length * 2 / 3)
    });
    current_validators = validators[1];
    updateLookup(initial_validator_set);
    masters[msg.sender] = true;
    latest_block = block1_header_hash;
    latest_finalized_block = block1_header_hash;
    committed_blocks[0] = genesis_header_hash;
    committed_blocks[1] = block1_header_hash;
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

  function receiveHeader(bytes[] memory headers) public onlyMasters {
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
      
      require(number > 0, "Repeated Genesis");
      require(number > int256(uint256(uint64(header_tree[latest_finalized_block].mix >> 129))), "Old Block");
      require(header_tree[parent_hash].mix != 0, "Parent Missing");
      require(int256(uint256(uint64(header_tree[parent_hash].mix >> 129))) + 1 == number, "Invalid N");
      require(uint64(header_tree[parent_hash].mix >> 65) < round_number, "Invalid RN");
      require(uint64(header_tree[parent_hash].mix >> 65) == prev_round_number, "Invalid PRN");
      
      bytes32 block_hash = keccak256(headers[x]);
      if (header_tree[block_hash].mix > 0) 
        revert("Repeated Header");
      if (current.length > 0 && next.length > 0)
        revert("Malformed Block");
      else if (current.length > 0) {
        if (prev_round_number < round_number - (round_number % EPOCH)) {
          int256 gap_number = number - number % int256(uint256(EPOCH)) - int256(uint256(GAP));
          if (gap_number < 0) {
            gap_number = 0;
          }
          gap_number = gap_number + 1;
          if (validators[gap_number].threshold > 0) {
            if (validators[gap_number].set.length != current.length)
              revert("Mismatched Validators");
            for (uint i = 0; i < current_validators.set.length; i++) {
              lookup[current_validators.set[i]] = false;
            }
            for (uint i = 0; i < current.length; i++) {
              lookup[validators[gap_number].set[i]] = true;
            }
            current_validators = validators[gap_number];
          } else 
            revert("Invalid Current Block");
        } else
          revert("Invalid Current Block");
      } else if (next.length > 0) {
        if (uint64(uint256(number % int256(uint256(EPOCH)))) == EPOCH - GAP + 1) {
          for (uint i = 0; i < next.length; i++) {
            unique_addr[next[i]] = true;
          }
          for (uint i = 0; i < next.length; i++) {
            if (!unique_addr[next[i]]) 
              revert("Repeated Validator");
            else
              unique_addr[next[i]] = false;
          }
          validators[number] = Validators({
            set: next,
            threshold: int256(next.length * 2 / 3)
          });
        } else
          revert("Invalid Next Block");
      }

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
      if (unique_counter < current_validators.threshold) {
        revert("Verification Fail");
      }
      header_tree[block_hash] = Header({
        parent_hash: parent_hash,
        mix: uint256(number) << 129 | uint256(round_number) << 65 | uint256(block.number) << 1
      });
      emit SubnetBlockAccepted(block_hash, number);
      if (number > int256(uint256(uint64(header_tree[latest_block].mix >> 129)))) {
        latest_block = block_hash;
      }
      // Look for 3 consecutive round
      bool found_committed_flag = true;
      bytes32 curr_hash = block_hash;
      for (uint i = 0; i < 3; i++) {
        if (header_tree[curr_hash].parent_hash == 0) {
          found_committed_flag = false;
          break;
        }
        bytes32 prev_hash = header_tree[curr_hash].parent_hash;
        if (uint64(header_tree[curr_hash].mix >> 65) != uint64(header_tree[prev_hash].mix >> 65)+1) {
          found_committed_flag = false;
          break;
        } else {
          curr_hash = prev_hash;
        }
      }
      if (found_committed_flag == false) continue;
      latest_finalized_block = curr_hash;
      // Confirm all ancestor unconfirmed block
      while ((header_tree[curr_hash].mix & 1) != 1) {
        header_tree[curr_hash].mix |= 1;
        committed_blocks[int256(uint256(uint64(header_tree[curr_hash].mix >> 129)))] = curr_hash;
        emit SubnetBlockFinalized(curr_hash, int256(uint256(uint64(header_tree[curr_hash].mix >> 129))));
        curr_hash = header_tree[curr_hash].parent_hash;
      }
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

  function updateLookup(address[] memory initial_validator_set) internal {
    for (uint i = 0; i < initial_validator_set.length; i++) {
      lookup[initial_validator_set[i]] = true;
    }
  }

  function recoverSigner(bytes32 message, bytes memory sig)
    internal
    pure
    returns (address)
  {
    (uint8 v, bytes32 r, bytes32 s) = splitSignature(sig);
    return ecrecover(message, v, r, s);
  }

  function getHeader(bytes32 header_hash) public view returns (HeaderInfo memory) {
    return HeaderInfo({
      parent_hash: header_tree[header_hash].parent_hash,
      number: int256(uint256(uint64(header_tree[header_hash].mix >> 129))),
      round_num: uint64(header_tree[header_hash].mix >> 65),
      mainnet_num: int256(uint256(uint64(header_tree[header_hash].mix >> 1))),
      finalized: (header_tree[header_hash].mix & 1) == 1
    });
  }


  function getHeaderByNumber(int number) public view returns (BlockLite memory) {
    if (committed_blocks[number] == 0) {
      int block_num = int256(uint256(uint64(header_tree[latest_block].mix >> 129)));
      if (number > block_num) {
        return BlockLite({
          hash: bytes32(0),
          number: 0
        });
      }
      int num_gap =  block_num - number;
      bytes32 curr_hash = latest_block;
      for (int i = 0; i < num_gap; i++) {
        curr_hash = header_tree[curr_hash].parent_hash;
      }
      return BlockLite({
        hash: curr_hash,
        number: int256(uint256(uint64(header_tree[curr_hash].mix >> 129)))
      });
    } else {
      return BlockLite({
        hash: committed_blocks[number],
        number: int256(uint256(uint64(header_tree[committed_blocks[number]].mix >> 129)))
      });
    }
    
  }
  
  function getHeaderConfirmationStatus(bytes32 header_hash) public view returns (bool) {
    return (header_tree[header_hash].mix & 1 == 1);
  }

  function getMainnetBlockNumber(bytes32 header_hash) public view returns (uint) {
    return uint256(uint64(header_tree[header_hash].mix >> 1));
  }

  function getLatestBlocks() public view returns (BlockLite memory, BlockLite memory) {
    return (
        BlockLite({
        hash: latest_block,
        number: int256(uint256(uint64(header_tree[latest_block].mix >> 129)))
      }),
        BlockLite({
        hash: latest_finalized_block,
        number: int256(uint256(uint64(header_tree[latest_finalized_block].mix >> 129)))
    }));
  }

  function getCurrentValidators() public view returns (Validators memory) {
    return current_validators;
  }
}