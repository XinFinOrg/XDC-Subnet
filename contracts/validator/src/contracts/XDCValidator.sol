// SPDX-License-Identifier: MIT
pragma solidity =0.4.26;

import {SafeMath} from "./libraries/SafeMath.sol";

contract XDCValidator {
    using SafeMath for uint256;

    event Vote(address _voter, address _candidate, uint256 _cap);
    event Unvote(address _voter, address _candidate, uint256 _cap);
    event Propose(address _owner, address _candidate, uint256 _cap);
    event Resign(address _owner, address _candidate);
    event Withdraw(address _owner, uint256 _blockNumber, uint256 _cap);
    event UploadedKYC(address _owner, string kycHash);
    event InvalidatedNode(address _masternodeOwner, address[] _masternodes);

    struct ValidatorState {
        address owner;
        bool isCandidate;
        uint256 cap;
        mapping(address => uint256) voters;
    }

    struct WithdrawState {
        mapping(uint256 => uint256) caps;
        uint256[] blockNumbers;
    }

    mapping(address => WithdrawState) private withdrawsState;

    mapping(address => ValidatorState) public validatorsState;
    mapping(address => address[]) public voters;

    // Mapping structures added for KYC feature.
    mapping(address => string[]) public kycString;
    mapping(address => uint256) public invalidKYCCount;
    mapping(address => mapping(address => bool)) public hasVotedInvalid;
    mapping(address => address[]) public ownerToCandidate;
    address[] public owners;

    address[] public candidates;

    uint256 public minCandidateNum;
    uint256 public minCandidateCap;
    uint256 public minVoterCap;
    uint256 public maxValidatorNumber;
    uint256 public candidateWithdrawDelay;
    uint256 public voterWithdrawDelay;

    address[] public grandMasters;
    mapping(address => bool) public grandMasterMap;

    modifier onlyValidCandidateCap() {
        // anyone can deposit X XDC to become a candidate
        require(msg.value >= minCandidateCap, "onlyValidCandidateCap");
        _;
    }

    modifier onlyValidVoterCap() {
        require(msg.value >= minVoterCap, "onlyValidVoterCap");
        _;
    }

    modifier onlyKYCWhitelisted() {
        require(
            kycString[msg.sender].length != 0 ||
                ownerToCandidate[msg.sender].length > 0,
            "onlyKYCWhitelisted"
        );
        _;
    }

    modifier onlyOwner(address _candidate) {
        require(validatorsState[_candidate].owner == msg.sender, "onlyOwner");
        _;
    }

    modifier onlyCandidate(address _candidate) {
        require(validatorsState[_candidate].isCandidate, "onlyCandidate");
        _;
    }

    modifier onlyValidCandidate(address _candidate) {
        require(validatorsState[_candidate].isCandidate, "onlyValidCandidate");
        _;
    }

    modifier onlyNotCandidate(address _candidate) {
        require(!validatorsState[_candidate].isCandidate, "onlyNotCandidate");
        _;
    }

    modifier onlyValidVote(address _candidate, uint256 _cap) {
        require(
            validatorsState[_candidate].voters[msg.sender] >= _cap,
            "onlyValidVote validatorsState[_candidate].voters[msg.sender] >= _cap is false"
        );
        if (validatorsState[_candidate].owner == msg.sender) {
            require(
                validatorsState[_candidate].voters[msg.sender].sub(_cap) >=
                    minCandidateCap,
                "onlyValidVote validatorsState[_candidate].voters[msg.sender] - (_cap) >= minCandidateCap is false"
            );
        }
        _;
    }

    modifier onlyValidWithdraw(uint256 _blockNumber, uint256 _index) {
        require(
            _blockNumber > 0,
            "onlyValidWithdraw _blockNumber > 0 is false"
        );
        require(
            block.number >= _blockNumber,
            "onlyValidWithdraw block.number >= _blockNumber is false"
        );
        require(
            withdrawsState[msg.sender].caps[_blockNumber] > 0,
            "onlyValidWithdraw withdrawsState[msg.sender].caps[_blockNumber] > 0 is false"
        );
        require(
            withdrawsState[msg.sender].blockNumbers[_index] == _blockNumber,
            "onlyValidWithdraw withdrawsState[msg.sender].blockNumbers[_index] == _blockNumber is false"
        );
        _;
    }

    modifier onlyGrandMaster() {
        require(grandMasterMap[msg.sender] == true, "onlyGrandMaster");
        _;
    }

    constructor(
        address[] memory _candidates,
        uint256[] memory _caps,
        address _firstOwner,
        uint256 _minCandidateCap,
        uint256 _minVoterCap,
        uint256 _maxValidatorNumber,
        uint256 _candidateWithdrawDelay,
        uint256 _voterWithdrawDelay,
        address[] memory _grandMasters,
        uint256 _minCandidateNum
    ) public {
        minCandidateNum = _minCandidateNum;
        minCandidateCap = _minCandidateCap;
        minVoterCap = _minVoterCap;
        maxValidatorNumber = _maxValidatorNumber;
        candidateWithdrawDelay = _candidateWithdrawDelay;
        voterWithdrawDelay = _voterWithdrawDelay;
        owners.push(_firstOwner);
        for (uint256 i = 0; i < _candidates.length; i++) {
            candidates.push(_candidates[i]);
            ValidatorState storage vs = validatorsState[_candidates[i]];
            vs.owner = _firstOwner;
            vs.isCandidate = true;
            vs.cap = _caps[i];
            voters[_candidates[i]].push(_firstOwner);
            ownerToCandidate[_firstOwner].push(_candidates[i]);
            validatorsState[_candidates[i]].voters[
                _firstOwner
            ] = minCandidateCap;
        }
        for (i = 0; i < _grandMasters.length; i++) {
            grandMasters.push(_grandMasters[i]);
            grandMasterMap[_grandMasters[i]] = true;
        }
    }

    // uploadKYC : anyone can upload a KYC; its not equivalent to becoming an owner.
    function uploadKYC(string kychash) external {
        kycString[msg.sender].push(kychash);
        emit UploadedKYC(msg.sender, kychash);
    }

    // propose : any non-candidate who has uploaded its KYC can become an owner by proposing a candidate.
    function propose(
        address _candidate
    )
        external
        payable
        onlyValidCandidateCap
        onlyNotCandidate(_candidate)
        onlyGrandMaster
    {
        uint256 cap = validatorsState[_candidate].cap.add(msg.value);
        candidates.push(_candidate);
        ValidatorState storage vs = validatorsState[_candidate];
        vs.owner = msg.sender;
        vs.isCandidate = true;
        vs.cap = cap;
        validatorsState[_candidate].voters[msg.sender] = validatorsState[
            _candidate
        ].voters[msg.sender].add(msg.value);

        if (ownerToCandidate[msg.sender].length == 0) {
            owners.push(msg.sender);
        }
        ownerToCandidate[msg.sender].push(_candidate);
        voters[_candidate].push(msg.sender);
        emit Propose(msg.sender, _candidate, msg.value);
    }

    function vote(
        address _candidate
    )
        external
        payable
        onlyValidVoterCap
        onlyValidCandidate(_candidate)
        onlyGrandMaster
    {
        validatorsState[_candidate].cap = validatorsState[_candidate].cap.add(
            msg.value
        );
        if (validatorsState[_candidate].voters[msg.sender] == 0) {
            voters[_candidate].push(msg.sender);
        }
        validatorsState[_candidate].voters[msg.sender] = validatorsState[
            _candidate
        ].voters[msg.sender].add(msg.value);
        emit Vote(msg.sender, _candidate, msg.value);
    }

    function getCandidates() public view returns (address[] memory) {
        return candidates;
    }

    function getGrandMasters() public view returns (address[] memory) {
        return grandMasters;
    }

    function getCandidateCap(address _candidate) public view returns (uint256) {
        return validatorsState[_candidate].cap;
    }

    function getCandidateOwner(
        address _candidate
    ) public view returns (address) {
        return validatorsState[_candidate].owner;
    }

    function getVoterCap(
        address _candidate,
        address _voter
    ) public view returns (uint256) {
        return validatorsState[_candidate].voters[_voter];
    }

    function getVoters(
        address _candidate
    ) public view returns (address[] memory) {
        return voters[_candidate];
    }

    function isCandidate(address _candidate) public view returns (bool) {
        return validatorsState[_candidate].isCandidate;
    }

    function getWithdrawBlockNumbers() public view returns (uint256[] memory) {
        return withdrawsState[msg.sender].blockNumbers;
    }

    function getWithdrawCap(
        uint256 _blockNumber
    ) public view returns (uint256) {
        return withdrawsState[msg.sender].caps[_blockNumber];
    }

    function unvote(
        address _candidate,
        uint256 _cap
    ) public onlyValidVote(_candidate, _cap) {
        validatorsState[_candidate].cap = validatorsState[_candidate].cap.sub(
            _cap
        );
        validatorsState[_candidate].voters[msg.sender] = validatorsState[
            _candidate
        ].voters[msg.sender].sub(_cap);

        // refund after delay X blocks
        uint256 withdrawBlockNumber = voterWithdrawDelay.add(block.number);
        withdrawsState[msg.sender].caps[withdrawBlockNumber] = withdrawsState[
            msg.sender
        ].caps[withdrawBlockNumber].add(_cap);
        withdrawsState[msg.sender].blockNumbers.push(withdrawBlockNumber);

        emit Unvote(msg.sender, _candidate, _cap);
    }

    function resign(
        address _candidate
    ) public onlyOwner(_candidate) onlyCandidate(_candidate) {
        validatorsState[_candidate].isCandidate = false;
        for (uint256 i = 0; i < candidates.length; i++) {
            if (candidates[i] == _candidate) {
                delete candidates[i];
                break;
            }
        }
        candidates = removeZeroAddresses(candidates);
        checkMinCandidateNum();
        uint256 cap = validatorsState[_candidate].voters[msg.sender];
        validatorsState[_candidate].cap = validatorsState[_candidate].cap.sub(
            cap
        );
        validatorsState[_candidate].voters[msg.sender] = 0;
        // refunding after resigning X blocks
        uint256 withdrawBlockNumber = candidateWithdrawDelay.add(block.number);
        withdrawsState[msg.sender].caps[withdrawBlockNumber] = withdrawsState[
            msg.sender
        ].caps[withdrawBlockNumber].add(cap);
        withdrawsState[msg.sender].blockNumbers.push(withdrawBlockNumber);
        emit Resign(msg.sender, _candidate);
    }

    function checkMinCandidateNum() private view {
        require(
            candidates.length >= minCandidateNum,
            "cadidates must greater than minCandidateNum"
        );
    }

    // voteInvalidKYC : any candidate can vote for invalid KYC i.e. a particular candidate's owner has uploaded a bad KYC.
    // On securing 75% votes against an owner ( not candidate ), owner & all its candidates will lose their funds.
    function voteInvalidKYC(
        address _invalidCandidate
    )
        public
        onlyValidCandidate(msg.sender)
        onlyValidCandidate(_invalidCandidate)
    {
        address candidateOwner = getCandidateOwner(msg.sender);
        address _invalidMasternode = getCandidateOwner(_invalidCandidate);
        require(
            !hasVotedInvalid[candidateOwner][_invalidMasternode],
            "!hasVotedInvalid[candidateOwner][_invalidMasternode]"
        );
        hasVotedInvalid[candidateOwner][_invalidMasternode] = true;
        invalidKYCCount[_invalidMasternode]++;
        if (
            (invalidKYCCount[_invalidMasternode] * 100) / getOwnerCount() >= 75
        ) {
            // 75% owners say that the KYC is invalid
            address[] memory allMasternodes = new address[](
                candidates.length - 1
            );
            uint256 count = 0;
            for (uint256 i = 0; i < candidates.length; i++) {
                if (getCandidateOwner(candidates[i]) == _invalidMasternode) {
                    // logic to remove cap.

                    allMasternodes[count++] = candidates[i];
                    delete candidates[i];

                    delete validatorsState[candidates[i]];
                    delete kycString[_invalidMasternode];
                    delete ownerToCandidate[_invalidMasternode];
                    delete invalidKYCCount[_invalidMasternode];
                }
            }
            candidates = removeZeroAddresses(candidates);
            checkMinCandidateNum();
            for (uint256 k = 0; k < owners.length; k++) {
                if (owners[k] == _invalidMasternode) {
                    delete owners[k];

                    break;
                }
            }
            owners = removeZeroAddresses(owners);
            emit InvalidatedNode(_invalidMasternode, allMasternodes);
        }
    }

    // invalidPercent : get votes against an owner in percentage.
    function invalidPercent(
        address _invalidCandidate
    ) public view onlyValidCandidate(_invalidCandidate) returns (uint256) {
        address _invalidMasternode = getCandidateOwner(_invalidCandidate);
        return ((invalidKYCCount[_invalidMasternode] * 100) / getOwnerCount());
    }

    // getOwnerCount : get count of total owners; accounts who own atleast one masternode.
    function getOwnerCount() public view returns (uint256) {
        return owners.length;
    }

    // getKYC : get KYC uploaded of the owner of the given masternode or the owner themselves
    function getLatestKYC(
        address _address
    ) public view returns (string memory) {
        if (isCandidate(_address)) {
            return
                kycString[getCandidateOwner(_address)][
                    kycString[getCandidateOwner(_address)].length - 1
                ];
        } else {
            return kycString[_address][kycString[_address].length - 1];
        }
    }

    function getHashCount(address _address) public view returns (uint256) {
        return kycString[_address].length;
    }

    function withdraw(
        uint256 _blockNumber,
        uint256 _index
    ) public onlyValidWithdraw(_blockNumber, _index) {
        uint256 cap = withdrawsState[msg.sender].caps[_blockNumber];
        delete withdrawsState[msg.sender].caps[_blockNumber];
        delete withdrawsState[msg.sender].blockNumbers[_index];
        (msg.sender).transfer(cap);
        emit Withdraw(msg.sender, _blockNumber, cap);
    }

    function getOwnerToCandidateLength(
        address _address
    ) external view returns (uint256) {
        return ownerToCandidate[_address].length;
    }

    function candidateCount() public view returns (uint256) {
        return candidates.length;
    }

    function removeZeroAddresses(
        address[] memory addresses
    ) private pure returns (address[] memory) {
        address[] memory newAddresses = new address[](addresses.length);
        uint256 j = 0;
        for (uint256 i = 0; i < addresses.length; i++) {
            if (addresses[i] != address(0)) {
                newAddresses[j] = addresses[i];
                j++;
            }
        }
        // Resize the array.
        assembly {
            mstore(newAddresses, j)
        }
        return newAddresses;
    }
}
