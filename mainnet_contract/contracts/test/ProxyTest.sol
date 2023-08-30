// SPDX-License-Identifier: MIT
pragma solidity =0.8.19;

contract ProxyTest {
    struct BlockLite {
        bytes32 hash;
        int256 number;
    }

    function getHeaderByNumber(
        int256 number
    ) external pure returns (BlockLite memory) {
        return
            BlockLite({
                hash: 0x0000000000000000000000000000000000000000000000000000000000000666,
                number: 666
            });
    }
}
