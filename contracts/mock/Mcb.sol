// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.10;

import "@openzeppelin/contracts-upgradeable/token/ERC20/presets/ERC20PresetMinterPauserUpgradeable.sol";

contract Mcb is ERC20PresetMinterPauserUpgradeable {
    function initialize(string memory name, string memory symbol) public override initializer {
        __ERC20PresetMinterPauser_init(name, symbol);
        _mint(msg.sender, 3803143548671886899345095);
    }
}
