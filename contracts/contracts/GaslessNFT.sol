// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GaslessNFT
 * @dev ERC721 NFT contract optimized for gasless minting via Circle Gas Station
 * Features batch minting, metadata management, and gas-efficient operations
 */
contract GaslessNFT is ERC721, ERC721URIStorage, Ownable, ReentrancyGuard {
    
    // State variables
    uint256 private _tokenIdCounter = 1;
    string private _baseTokenURI;
    uint256 public maxSupply;
    uint256 public mintPrice;
    address public usdcToken;
    
    // Mappings
    mapping(address => bool) public authorizedMinters;
    mapping(address => uint256) public userMintCount;
    mapping(uint256 => string) public tokenMetadata;
    
    // Events
    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 timestamp);
    event BatchMinted(address indexed to, uint256[] tokenIds, uint256 timestamp);
    event AuthorizedMinterUpdated(address indexed minter, bool authorized);
    event BaseURIUpdated(string newBaseURI);
    event MintPriceUpdated(uint256 newPrice);
    
    // Custom errors
    error MaxSupplyExceeded();
    error UnauthorizedMinter();
    error InvalidTokenURI();
    error InsufficientPayment();
    error TransferFailed();
    
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        address _usdcToken
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
        usdcToken = _usdcToken;
    }
    
    modifier onlyAuthorizedMinter() {
        if (!authorizedMinters[msg.sender] && msg.sender != owner()) {
            revert UnauthorizedMinter();
        }
        _;
    }
    
    function mint(address to, string memory tokenURI_) 
        public 
        onlyAuthorizedMinter 
        nonReentrant 
        returns (uint256) 
    {
        if (_tokenIdCounter > maxSupply) {
            revert MaxSupplyExceeded();
        }
        
        if (bytes(tokenURI_).length == 0) {
            revert InvalidTokenURI();
        }
        
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI_);
        
        userMintCount[to]++;
        tokenMetadata[tokenId] = tokenURI_;
        
        emit NFTMinted(to, tokenId, tokenURI_, block.timestamp);
        
        return tokenId;
    }
    
    function batchMint(
        address[] memory recipients, 
        string[] memory tokenURIs
    ) 
        public 
        onlyAuthorizedMinter 
        nonReentrant 
        returns (uint256[] memory) 
    {
        require(recipients.length == tokenURIs.length, "Arrays length mismatch");
        require(recipients.length > 0, "Empty arrays");
        
        if (_tokenIdCounter + recipients.length - 1 > maxSupply) {
            revert MaxSupplyExceeded();
        }
        
        uint256[] memory tokenIds = new uint256[](recipients.length);
        
        for (uint256 i = 0; i < recipients.length; i++) {
            if (bytes(tokenURIs[i]).length == 0) {
                revert InvalidTokenURI();
            }
            
            uint256 tokenId = _tokenIdCounter;
            _tokenIdCounter++;
            
            _safeMint(recipients[i], tokenId);
            _setTokenURI(tokenId, tokenURIs[i]);
            
            userMintCount[recipients[i]]++;
            tokenMetadata[tokenId] = tokenURIs[i];
            tokenIds[i] = tokenId;
        }
        
        emit BatchMinted(recipients[0], tokenIds, block.timestamp);
        
        return tokenIds;
    }
    
    // Management functions
    function setAuthorizedMinter(address minter, bool authorized) public onlyOwner {
        authorizedMinters[minter] = authorized;
        emit AuthorizedMinterUpdated(minter, authorized);
    }
    
    function setBaseURI(string memory newBaseURI) public onlyOwner {
        _baseTokenURI = newBaseURI;
        emit BaseURIUpdated(newBaseURI);
    }
    
    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }
    
    // View functions
    function getCurrentTokenId() public view returns (uint256) {
        return _tokenIdCounter - 1;
    }
    
    function getRemainingSupply() public view returns (uint256) {
        uint256 currentId = _tokenIdCounter - 1;
        return maxSupply > currentId ? maxSupply - currentId : 0;
    }
    
    function getUserTokens(address user) public view returns (uint256[] memory) {
        uint256 balance = balanceOf(user);
        uint256[] memory tokens = new uint256[](balance);
        uint256 index = 0;
        
        for (uint256 i = 1; i < _tokenIdCounter; i++) {
            try this.ownerOf(i) returns (address owner) {
                if (owner == user) {
                    tokens[index] = i;
                    index++;
                }
            } catch {
                continue;
            }
        }
        
        return tokens;
    }
    
    function getStats() 
        public 
        view 
        returns (uint256 totalMinted, uint256 remainingSupply, uint256 currentPrice) 
    {
        totalMinted = _tokenIdCounter - 1;
        remainingSupply = getRemainingSupply();
        currentPrice = mintPrice;
    }
    
    // Required overrides - FIXED: Let ERC721URIStorage handle these automatically
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function tokenURI(uint256 tokenId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (string memory) 
    {
        return super.tokenURI(tokenId);
    }
    
    function supportsInterface(bytes4 interfaceId) 
        public 
        view 
        override(ERC721, ERC721URIStorage) 
        returns (bool) 
    {
        return super.supportsInterface(interfaceId);
    }
}
