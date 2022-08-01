// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "../distributor/MuxDistributor.sol";

contract TestMuxDistributor is MuxDistributor {
    uint256 public mockBlockTime;

    function setBlockTime(uint256 mockBlockTime_) external {
        mockBlockTime = mockBlockTime_;
    }

    function _blockTime() internal view virtual override returns (uint256) {
        return mockBlockTime;
    }
}
