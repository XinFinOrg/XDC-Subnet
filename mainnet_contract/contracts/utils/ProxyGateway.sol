// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

import {ProxyAdmin, TransparentUpgradeableProxy} from "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import {ICheckpoint} from "../interfaces/ICheckpoint.sol";

contract ProxyGateway is ProxyAdmin {
    event CreateProxy(TransparentUpgradeableProxy proxy);

    TransparentUpgradeableProxy[] public proxies;

    function getProxiesLength() external view returns (uint256) {
        return proxies.length;
    }

    function createProxy(address logic, bytes memory data) public {
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            logic,
            address(this),
            data
        );
        proxies.push(proxy);
        emit CreateProxy(proxy);
    }

    function createFullProxy(
        address full,
        address[] memory initialValidatorSet,
        bytes memory genesisHeader,
        bytes memory block1Header,
        uint64 initGap,
        uint64 initEpoch
    ) public {
        require(
            keccak256(abi.encodePacked(ICheckpoint(full).MODE())) ==
                keccak256(abi.encodePacked("full")),
            "MODE must be full"
        );
        bytes memory data = abi.encodeWithSignature(
            "init(address[],bytes,bytes,uint64,uint64)",
            initialValidatorSet,
            genesisHeader,
            block1Header,
            initGap,
            initEpoch
        );
        createProxy(full, data);
    }

    function createLiteProxy(
        address lite,
        address[] memory initialValidatorSet,
        bytes memory block1,
        uint64 initGap,
        uint64 initEpoch
    ) public {
        require(
            keccak256(abi.encodePacked(ICheckpoint(lite).MODE())) ==
                keccak256(abi.encodePacked("lite")),
            "MODE must be lite"
        );
        bytes memory data = abi.encodeWithSignature(
            "init(address[],bytes,uint64,uint64)",
            initialValidatorSet,
            block1,
            initGap,
            initEpoch
        );
        createProxy(lite, data);
    }
}
