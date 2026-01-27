// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Burnable.sol";

contract VeritasOrbiunToken is ERC1155, AccessControl, ERC1155Burnable {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    // Token IDs
    uint256 public constant VL_TOKEN = 1; // Veritas Lote (NFT)
    uint256 public constant OI_TOKEN = 2; // Orbiun Impact (SFT)
    
    struct TokenMetadata {
        string batchId;
        uint256 amountProcessed;
        uint256 carbonAvoided;
        string wasteType;
        string processingLocation;
        uint256 timestamp;
        bool isBurned;
        string ipfsHash;
    }
    
    mapping(uint256 => TokenMetadata) public tokenMetadata;
    mapping(string => bool) public batchIdExists;

    constructor() ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }

    function setURI(string memory newuri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    function mintVLToken(
        address to,
        string memory batchId,
        uint256 amountProcessed,
        string memory wasteType,
        string memory processingLocation,
        string memory ipfsHash
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(!batchIdExists[batchId], "Batch ID already exists");
        
        // In a real implementation, we would mint a unique ID per batch (NFT style)
        // For simplicity here we are using ID 1, but this should likely be auto-incrementing for VL tokens
        // Or use the batch hash as ID. 
        // Let's assume VL_TOKEN is a class, but we need unique NFTs. 
        // Refactoring to support unique IDs:
        uint256 newTokenId = uint256(keccak256(abi.encodePacked(batchId, block.timestamp)));
        
        _mint(to, newTokenId, 1, "");
        
        tokenMetadata[newTokenId] = TokenMetadata({
            batchId: batchId,
            amountProcessed: amountProcessed,
            carbonAvoided: 0, // Calculated separately or passed?
            wasteType: wasteType,
            processingLocation: processingLocation,
            timestamp: block.timestamp,
            isBurned: false,
            ipfsHash: ipfsHash
        });
        
        batchIdExists[batchId] = true;
        return newTokenId;
    }

    function mintOIToken(
        address to,
        string memory batchId,
        uint256 carbonAvoided,
        uint256 amount
    ) external onlyRole(MINTER_ROLE) {
        _mint(to, OI_TOKEN, amount, "");
        // Logic to link OI tokens to batch if needed
    }

    function burnToken(
        address from,
        uint256 tokenId,
        uint256 amount,
        string memory purpose
    ) external onlyRole(BURNER_ROLE) {
        burn(from, tokenId, amount);
        // Emit event with purpose (handled by standard Transfer/Burn logs + custom event)
        emit TokenBurned(from, tokenId, amount, purpose);
    }
    
    event TokenBurned(address indexed burner, uint256 indexed tokenId, uint256 amount, string purpose);

    // The following functions are overrides required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
