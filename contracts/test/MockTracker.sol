// SPDX-License-Identifier: MIT

pragma solidity 0.8.10;

contract MockTracker {
    mapping(address => uint256) public averageStakedAmounts;
    mapping(address => uint256) public cumulativeRewards;

    function setAverageStakedAmounts(address _account, uint256 _amount) external {
        averageStakedAmounts[_account] = _amount;
    }

    function setCumulativeRewards(address _account, uint256 _amount) external {
        cumulativeRewards[_account] = _amount;
    }
}
