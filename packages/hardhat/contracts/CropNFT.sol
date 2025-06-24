//SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title CropNFT
 * @dev ERC721 token representing crop lots for farmers
 * Any farmer can mint tokens with immutable URIs
 */
contract CropNFT is ERC721, ERC721URIStorage, Ownable {
    uint256 private _tokenIdCounter;
    
    // Mapping to store if a token has been minted (prevents URI changes)
    mapping(uint256 => bool) private _tokenMinted;

    event CropNFTMinted(uint256 indexed tokenId, address indexed farmer, string tokenURI);
    event CropNFTBurned(uint256 indexed tokenId, address indexed farmer);

    constructor(address _owner) ERC721("CropNFT", "CROP") Ownable(_owner) {
        _tokenIdCounter = 1; // Start token IDs at 1
    }

    /**
     * @dev Mint a new CropNFT with a specific URI
     * @param _tokenURI The metadata URI for the NFT (immutable once set)
     * @return tokenId The ID of the newly minted token
     */
    function mint(string memory _tokenURI) public returns (uint256) {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        _tokenMinted[tokenId] = true;
        
        emit CropNFTMinted(tokenId, msg.sender, _tokenURI);
        
        return tokenId;
    }

    /**
     * @dev Burn a CropNFT
     * @param tokenId The ID of the token to burn
     */
    function burn(uint256 tokenId) public {
        require(ownerOf(tokenId) == msg.sender, "CropNFT: caller is not the owner");
        
        _burn(tokenId);
        delete _tokenMinted[tokenId];
        
        emit CropNFTBurned(tokenId, msg.sender);
    }

    /**
     * @dev Override to prevent token URI changes after minting
     */
    function _setTokenURI(uint256 tokenId, string memory _tokenURI) internal override {
        require(!_tokenMinted[tokenId], "CropNFT: token URI is immutable");
        super._setTokenURI(tokenId, _tokenURI);
    }

    // Required overrides
    function tokenURI(uint256 tokenId) public view override(ERC721, ERC721URIStorage) returns (string memory) {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
} 