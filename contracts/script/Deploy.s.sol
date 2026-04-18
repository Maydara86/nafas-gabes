// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {WasteMarketplace} from "../src/WasteMarketplace.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        WasteMarketplace marketplace = new WasteMarketplace();
        console.log("WasteMarketplace deployed at:", address(marketplace));

        vm.stopBroadcast();
    }
}
