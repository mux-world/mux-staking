// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

import "../VotingEscrow.sol";

contract TestVotingEscrow is VotingEscrow {
    uint256 public mockBlockTime;

    function setBlockTime(uint256 mockBlockTime_) external {
        mockBlockTime = mockBlockTime_;
    }

    function _blockTime() internal view virtual override returns (uint256) {
        return mockBlockTime;
    }
}
