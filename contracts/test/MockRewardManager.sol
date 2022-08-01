// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

contract MockRewardManager {
    uint256 public poolOwnedRate;
    uint256 public votingEscrowedRate;

    function vault() external view returns (address) {
        return address(this);
    }

    function setPoolOwnedRate(uint256 _poolOwnedRate) external {
        poolOwnedRate = _poolOwnedRate;
    }

    function setVotingEscrowedRate(uint256 _votingEscrowedRate) external {
        votingEscrowedRate = _votingEscrowedRate;
    }
}
