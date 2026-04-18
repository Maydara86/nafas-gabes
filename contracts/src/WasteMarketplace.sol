// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract WasteMarketplace {
    enum Status { LISTED, CLAIMED, COLLECTED, PROCESSED }

    struct WasteBatch {
        uint256 id;
        address factory;
        address claimer;
        string wasteType;
        uint256 quantity;
        uint8 hazardLevel;
        string location;
        Status status;
        string outputType;
        uint256 listedAt;
    }

    mapping(uint256 => WasteBatch) public batches;
    uint256 public batchCount;

    event BatchListed(uint256 indexed id, address indexed factory, string wasteType, uint256 quantity);
    event BatchClaimed(uint256 indexed id, address indexed claimer);
    event BatchCollected(uint256 indexed id);
    event BatchProcessed(uint256 indexed id, string outputType);

    function listWaste(
        string calldata wasteType,
        uint256 quantity,
        uint8 hazardLevel,
        string calldata location
    ) external returns (uint256) {
        require(quantity > 0, "Quantity must be > 0");
        require(hazardLevel >= 1 && hazardLevel <= 5, "Hazard level 1-5");

        uint256 id = ++batchCount;
        batches[id] = WasteBatch({
            id: id,
            factory: msg.sender,
            claimer: address(0),
            wasteType: wasteType,
            quantity: quantity,
            hazardLevel: hazardLevel,
            location: location,
            status: Status.LISTED,
            outputType: "",
            listedAt: block.timestamp
        });

        emit BatchListed(id, msg.sender, wasteType, quantity);
        return id;
    }

    function claimWaste(uint256 batchId) external {
        WasteBatch storage batch = batches[batchId];
        require(batch.id != 0, "Batch does not exist");
        require(batch.status == Status.LISTED, "Not available");
        require(batch.factory != msg.sender, "Factory cannot claim own batch");

        batch.claimer = msg.sender;
        batch.status = Status.CLAIMED;

        emit BatchClaimed(batchId, msg.sender);
    }

    function confirmCollection(uint256 batchId) external {
        WasteBatch storage batch = batches[batchId];
        require(batch.id != 0, "Batch does not exist");
        require(batch.status == Status.CLAIMED, "Not claimed yet");
        require(batch.factory == msg.sender, "Only factory can confirm");

        batch.status = Status.COLLECTED;

        emit BatchCollected(batchId);
    }

    function markProcessed(uint256 batchId, string calldata outputType) external {
        WasteBatch storage batch = batches[batchId];
        require(batch.id != 0, "Batch does not exist");
        require(batch.status == Status.COLLECTED, "Not collected yet");
        require(batch.claimer == msg.sender, "Only claimer can mark processed");

        batch.outputType = outputType;
        batch.status = Status.PROCESSED;

        emit BatchProcessed(batchId, outputType);
    }

    function getBatch(uint256 id) external view returns (WasteBatch memory) {
        require(id >= 1 && id <= batchCount, "Batch does not exist");
        return batches[id];
    }

    // NOTE: unbounded loop — acceptable at demo scale (~20 batches) but will hit gas limits
    // at scale. For production, replace with pagination or an indexed event approach.
    function getAllBatches() external view returns (WasteBatch[] memory) {
        WasteBatch[] memory result = new WasteBatch[](batchCount);
        for (uint256 i = 1; i <= batchCount; i++) {
            result[i - 1] = batches[i];
        }
        return result;
    }
}
