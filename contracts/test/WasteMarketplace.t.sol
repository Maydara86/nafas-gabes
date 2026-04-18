// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {WasteMarketplace} from "../src/WasteMarketplace.sol";

contract WasteMarketplaceTest is Test {
    WasteMarketplace public marketplace;
    address factory = address(0x1);
    address claimer = address(0x2);

    function setUp() public {
        marketplace = new WasteMarketplace();
    }

    function test_listWaste_creates_batch() public {
        vm.prank(factory);
        uint256 id = marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        assertEq(id, 1);
        assertEq(marketplace.batchCount(), 1);
        WasteMarketplace.WasteBatch memory batch = marketplace.getBatch(1);
        assertEq(batch.factory, factory);
        assertEq(batch.wasteType, "phosphogypsum");
        assertEq(batch.quantity, 1000);
        assertEq(batch.hazardLevel, 3);
        assertEq(uint8(batch.status), uint8(WasteMarketplace.Status.LISTED));
        assertEq(batch.claimer, address(0));
    }

    function test_listWaste_reverts_on_zero_quantity() public {
        vm.prank(factory);
        vm.expectRevert("Quantity must be > 0");
        marketplace.listWaste("phosphogypsum", 0, 3, "33.9312,10.1178");
    }

    function test_listWaste_reverts_on_zero_hazard() public {
        vm.prank(factory);
        vm.expectRevert("Hazard level 1-5");
        marketplace.listWaste("phosphogypsum", 1000, 0, "33.9312,10.1178");
    }

    function test_listWaste_reverts_on_hazard_above_5() public {
        vm.prank(factory);
        vm.expectRevert("Hazard level 1-5");
        marketplace.listWaste("phosphogypsum", 1000, 6, "33.9312,10.1178");
    }

    function test_listWaste_emits_BatchListed() public {
        vm.prank(factory);
        vm.expectEmit(true, true, false, true);
        emit WasteMarketplace.BatchListed(1, factory, "fluoride", 500);
        marketplace.listWaste("fluoride", 500, 4, "33.9300,10.1200");
    }

    function test_claimWaste_sets_claimer_and_status() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");

        vm.prank(claimer);
        marketplace.claimWaste(1);

        WasteMarketplace.WasteBatch memory batch = marketplace.getBatch(1);
        assertEq(batch.claimer, claimer);
        assertEq(uint8(batch.status), uint8(WasteMarketplace.Status.CLAIMED));
    }

    function test_claimWaste_reverts_if_factory_claims_own() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");

        vm.prank(factory);
        vm.expectRevert("Factory cannot claim own batch");
        marketplace.claimWaste(1);
    }

    function test_claimWaste_reverts_if_not_listed() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);

        vm.prank(address(0x3));
        vm.expectRevert("Not available");
        marketplace.claimWaste(1);
    }

    function test_claimWaste_reverts_on_nonexistent_batch() public {
        vm.prank(claimer);
        vm.expectRevert("Batch does not exist");
        marketplace.claimWaste(99);
    }

    function test_confirmCollection_only_factory() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);

        vm.prank(claimer);
        vm.expectRevert("Only factory can confirm");
        marketplace.confirmCollection(1);

        vm.prank(factory);
        marketplace.confirmCollection(1);
        assertEq(
            uint8(marketplace.getBatch(1).status),
            uint8(WasteMarketplace.Status.COLLECTED)
        );
    }

    function test_confirmCollection_reverts_if_not_claimed() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");

        vm.prank(factory);
        vm.expectRevert("Not claimed yet");
        marketplace.confirmCollection(1);
    }

    function test_markProcessed_only_claimer() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);
        vm.prank(factory);
        marketplace.confirmCollection(1);

        vm.prank(factory);
        vm.expectRevert("Only claimer can mark processed");
        marketplace.markProcessed(1, "algae");

        vm.prank(claimer);
        marketplace.markProcessed(1, "algae");

        WasteMarketplace.WasteBatch memory batch = marketplace.getBatch(1);
        assertEq(uint8(batch.status), uint8(WasteMarketplace.Status.PROCESSED));
        assertEq(batch.outputType, "algae");
    }

    function test_markProcessed_reverts_if_not_collected() public {
        vm.prank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        vm.prank(claimer);
        marketplace.claimWaste(1);

        vm.prank(claimer);
        vm.expectRevert("Not collected yet");
        marketplace.markProcessed(1, "algae");
    }

    function test_getAllBatches_returns_all() public {
        vm.startPrank(factory);
        marketplace.listWaste("phosphogypsum", 1000, 3, "33.9312,10.1178");
        marketplace.listWaste("fluoride", 500, 4, "33.9300,10.1200");
        vm.stopPrank();

        WasteMarketplace.WasteBatch[] memory all = marketplace.getAllBatches();
        assertEq(all.length, 2);
        assertEq(all[0].wasteType, "phosphogypsum");
        assertEq(all[1].wasteType, "fluoride");
    }

    function test_getAllBatches_empty_initially() public view {
        WasteMarketplace.WasteBatch[] memory all = marketplace.getAllBatches();
        assertEq(all.length, 0);
    }
}
