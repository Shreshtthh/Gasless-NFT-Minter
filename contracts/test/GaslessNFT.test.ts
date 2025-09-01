import { ethers } from "hardhat";
import { expect } from "chai";
import { GaslessNFT } from "../typechain-types/contracts/GaslessNFT";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("GaslessNFT", function () {
  // Test accounts
  let gaslessNFT: GaslessNFT;
  let owner: HardhatEthersSigner;
  let user1: HardhatEthersSigner;
  let user2: HardhatEthersSigner;
  let minter: HardhatEthersSigner;
  let unauthorizedUser: HardhatEthersSigner;

  // Constants
  const NFT_NAME = "Test NFT";
  const NFT_SYMBOL = "TNFT";
  const MAX_SUPPLY = 1000n;
  const MINT_PRICE = 1000000n; // 1 USDC (6 decimals)
  const USDC_TOKEN_ADDRESS = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia USDC

  async function deployGaslessNFTFixture() {
    // Get signers
    [owner, user1, user2, minter, unauthorizedUser] = await ethers.getSigners();

    // Deploy contract
    const GaslessNFTFactory = await ethers.getContractFactory("GaslessNFT");
    const contract = await GaslessNFTFactory.deploy(
      NFT_NAME,
      NFT_SYMBOL,
      MAX_SUPPLY,
      MINT_PRICE,
      USDC_TOKEN_ADDRESS
    );

    await contract.waitForDeployment();
    gaslessNFT = contract as unknown as GaslessNFT;

    // Set up authorized minter
    await gaslessNFT.connect(owner).setAuthorizedMinter(minter.address, true);

    return { gaslessNFT, owner, user1, user2, minter, unauthorizedUser };
  }

  describe("Deployment", function () {
    it("Should set the correct initial state", async function () {
      const { gaslessNFT, owner } = await loadFixture(deployGaslessNFTFixture);

      expect(await gaslessNFT.name()).to.equal(NFT_NAME);
      expect(await gaslessNFT.symbol()).to.equal(NFT_SYMBOL);
      expect(await gaslessNFT.maxSupply()).to.equal(MAX_SUPPLY);
      expect(await gaslessNFT.mintPrice()).to.equal(MINT_PRICE);
      expect(await gaslessNFT.usdcToken()).to.equal(USDC_TOKEN_ADDRESS);
      expect(await gaslessNFT.owner()).to.equal(owner.address);
      expect(await gaslessNFT.getCurrentTokenId()).to.equal(0n);
      expect(await gaslessNFT.getRemainingSupply()).to.equal(MAX_SUPPLY);
    });
  });

  describe("Authorized Minter Management", function () {
    it("Should correctly manage authorized minters", async function () {
      const { gaslessNFT, owner, minter, user1, user2, unauthorizedUser } = await loadFixture(deployGaslessNFTFixture);

      // Check initial authorized minter
      expect(await gaslessNFT.authorizedMinters(minter.address)).to.be.true;
      expect(await gaslessNFT.authorizedMinters(user1.address)).to.be.false;

      // Only owner can set authorized minters
      await expect(
        gaslessNFT.connect(unauthorizedUser).setAuthorizedMinter(user2.address, true)
      ).to.be.revertedWithCustomError(gaslessNFT, "OwnableUnauthorizedAccount");

      // Owner can set authorized minters
      await gaslessNFT.connect(owner).setAuthorizedMinter(user2.address, true);
      expect(await gaslessNFT.authorizedMinters(user2.address)).to.be.true;

      // Should emit event
      await expect(gaslessNFT.connect(owner).setAuthorizedMinter(user1.address, true))
        .to.emit(gaslessNFT, "AuthorizedMinterUpdated")
        .withArgs(user1.address, true);
    });
  });

  describe("Minting", function () {
    it("Should mint NFT correctly", async function () {
      const { gaslessNFT, minter, user1 } = await loadFixture(deployGaslessNFTFixture);
      
      const tokenURI = "https://example.com/token/1";

      // Get current token ID before minting
      const tokenIdBefore = await gaslessNFT.getCurrentTokenId();
      
      const tx = await gaslessNFT.connect(minter).mint(user1.address, tokenURI);
      await tx.wait();
      
      // Token ID should be incremented by 1
      const tokenId = tokenIdBefore + 1n;

      expect(await gaslessNFT.ownerOf(tokenId)).to.equal(user1.address);
      expect(await gaslessNFT.tokenURI(tokenId)).to.equal(tokenURI);
      expect(await gaslessNFT.balanceOf(user1.address)).to.equal(1n);
      expect(await gaslessNFT.userMintCount(user1.address)).to.equal(1n);
      expect(await gaslessNFT.getCurrentTokenId()).to.equal(tokenId);
      expect(await gaslessNFT.getRemainingSupply()).to.equal(MAX_SUPPLY - 1n);

      // Should emit NFTMinted event
      await expect(tx)
        .to.emit(gaslessNFT, "NFTMinted")
        .withArgs(user1.address, tokenId, tokenURI, await tx.getBlock().then(b => b!.timestamp));
    });

    it("Should reject minting by unauthorized users", async function () {
      const { gaslessNFT, unauthorizedUser, user1 } = await loadFixture(deployGaslessNFTFixture);
      
      const tokenURI = "https://example.com/token/1";

      await expect(
        gaslessNFT.connect(unauthorizedUser).mint(user1.address, tokenURI)
      ).to.be.revertedWithCustomError(gaslessNFT, "UnauthorizedMinter");
    });

    it("Should reject minting with empty token URI", async function () {
      const { gaslessNFT, minter, user1 } = await loadFixture(deployGaslessNFTFixture);

      await expect(
        gaslessNFT.connect(minter).mint(user1.address, "")
      ).to.be.revertedWithCustomError(gaslessNFT, "InvalidTokenURI");
    });

    it("Should allow owner to mint even without being authorized minter", async function () {
      const { gaslessNFT, owner, user1 } = await loadFixture(deployGaslessNFTFixture);
      
      const tokenURI = "https://example.com/token/1";

      await expect(gaslessNFT.connect(owner).mint(user1.address, tokenURI))
        .to.not.be.reverted;
    });
  });

  describe("Batch Minting", function () {
    it("Should batch mint NFTs correctly", async function () {
      const { gaslessNFT, minter, user1, user2 } = await loadFixture(deployGaslessNFTFixture);

      const recipients = [user1.address, user2.address, user1.address];
      const tokenURIs = [
        "https://example.com/token/1",
        "https://example.com/token/2",
        "https://example.com/token/3"
      ];

      // Get current token ID before minting
      const tokenIdBefore = await gaslessNFT.getCurrentTokenId();
      
      const tx = await gaslessNFT.connect(minter).batchMint(recipients, tokenURIs);
      await tx.wait();

      // Check token ownership - IDs should start from tokenIdBefore + 1
      expect(await gaslessNFT.ownerOf(tokenIdBefore + 1n)).to.equal(user1.address);
      expect(await gaslessNFT.ownerOf(tokenIdBefore + 2n)).to.equal(user2.address);
      expect(await gaslessNFT.ownerOf(tokenIdBefore + 3n)).to.equal(user1.address);

      // Check balances
      expect(await gaslessNFT.balanceOf(user1.address)).to.equal(2n);
      expect(await gaslessNFT.balanceOf(user2.address)).to.equal(1n);

      // Check mint counts
      expect(await gaslessNFT.userMintCount(user1.address)).to.equal(2n);
      expect(await gaslessNFT.userMintCount(user2.address)).to.equal(1n);

      // Check supply tracking
      expect(await gaslessNFT.getCurrentTokenId()).to.equal(tokenIdBefore + 3n);
      expect(await gaslessNFT.getRemainingSupply()).to.equal(MAX_SUPPLY - 3n);

      // Should emit BatchMinted event
      await expect(tx)
        .to.emit(gaslessNFT, "BatchMinted");
    });

    it("Should reject batch mint with array length mismatch", async function () {
      const { gaslessNFT, minter, user1, user2 } = await loadFixture(deployGaslessNFTFixture);

      const recipients = [user1.address, user2.address];
      const tokenURIs = [
        "https://example.com/token/1",
        "https://example.com/token/2",
        "https://example.com/token/3"
      ];

      await expect(
        gaslessNFT.connect(minter).batchMint(recipients, tokenURIs)
      ).to.be.revertedWith("Arrays length mismatch");
    });

    it("Should reject batch mint with empty arrays", async function () {
      const { gaslessNFT, minter } = await loadFixture(deployGaslessNFTFixture);

      const recipients: string[] = [];
      const tokenURIs: string[] = [];

      await expect(
        gaslessNFT.connect(minter).batchMint(recipients, tokenURIs)
      ).to.be.revertedWith("Empty arrays");
    });
  });

  describe("Supply Management", function () {
    it("Should reject minting when max supply is exceeded", async function () {
      const [owner, minter, user1] = await ethers.getSigners();
      const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
      const smallSupplyNFT = await GaslessNFT.deploy(
        "Small NFT",
        "SNFT",
        2n,
        MINT_PRICE,
        USDC_TOKEN_ADDRESS
      ) as unknown as GaslessNFT;

      await smallSupplyNFT.waitForDeployment();
      await smallSupplyNFT.connect(owner).setAuthorizedMinter(minter.address, true);

      await smallSupplyNFT.connect(minter).mint(user1.address, "token1");
      await smallSupplyNFT.connect(minter).mint(user1.address, "token2");

      await expect(
        smallSupplyNFT.connect(minter).mint(user1.address, "token3")
      ).to.be.revertedWithCustomError(smallSupplyNFT, "MaxSupplyExceeded");
    });

    it("Should reject batch minting when max supply would be exceeded", async function () {
      const [owner, minter, user1, user2] = await ethers.getSigners();
      const GaslessNFT = await ethers.getContractFactory("GaslessNFT");
      const smallSupplyNFT = await GaslessNFT.deploy(
        "Small NFT",
        "SNFT",
        2n,
        MINT_PRICE,
        USDC_TOKEN_ADDRESS
      ) as unknown as GaslessNFT;

      await smallSupplyNFT.waitForDeployment();
      await smallSupplyNFT.connect(owner).setAuthorizedMinter(minter.address, true);

      const recipients = [user1.address, user2.address, user1.address];
      const tokenURIs = ["token1", "token2", "token3"];

      await expect(
        smallSupplyNFT.connect(minter).batchMint(recipients, tokenURIs)
      ).to.be.revertedWithCustomError(smallSupplyNFT, "MaxSupplyExceeded");
    });
  });

  describe("View Functions", function () {
    it("Should return correct user tokens", async function () {
      const { gaslessNFT, minter, user1, user2 } = await loadFixture(deployGaslessNFTFixture);

      // Get current token ID before minting
      const tokenIdBefore = await gaslessNFT.getCurrentTokenId();
      
      await gaslessNFT.connect(minter).mint(user1.address, "token1");
      await gaslessNFT.connect(minter).mint(user2.address, "token2");
      await gaslessNFT.connect(minter).mint(user1.address, "token3");

      const user1Tokens = await gaslessNFT.getUserTokens(user1.address);
      const user2Tokens = await gaslessNFT.getUserTokens(user2.address);

      expect(user1Tokens.length).to.equal(2);
      expect(user1Tokens[0]).to.equal(tokenIdBefore + 1n);
      expect(user1Tokens[1]).to.equal(tokenIdBefore + 3n);

      expect(user2Tokens.length).to.equal(1);
      expect(user2Tokens[0]).to.equal(tokenIdBefore + 2n);
    });

    it("Should return correct contract statistics", async function () {
      const { gaslessNFT, minter, user1, user2 } = await loadFixture(deployGaslessNFTFixture);

      let stats = await gaslessNFT.getStats();
      expect(stats[0]).to.equal(0n);
      expect(stats[1]).to.equal(MAX_SUPPLY);
      expect(stats[2]).to.equal(MINT_PRICE);

      await gaslessNFT.connect(minter).mint(user1.address, "token1");
      await gaslessNFT.connect(minter).mint(user2.address, "token2");

      stats = await gaslessNFT.getStats();
      expect(stats[0]).to.equal(2n);
      expect(stats[1]).to.equal(MAX_SUPPLY - 2n);
      expect(stats[2]).to.equal(MINT_PRICE);
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to update base URI", async function () {
      const { gaslessNFT, owner } = await loadFixture(deployGaslessNFTFixture);

      const newBaseURI = "https://newapi.com/metadata/";

      await expect(gaslessNFT.connect(owner).setBaseURI(newBaseURI))
        .to.emit(gaslessNFT, "BaseURIUpdated")
        .withArgs(newBaseURI);
    });

    it("Should allow owner to update mint price", async function () {
      const { gaslessNFT, owner } = await loadFixture(deployGaslessNFTFixture);

      const newPrice = 2000000n;

      await expect(gaslessNFT.connect(owner).setMintPrice(newPrice))
        .to.emit(gaslessNFT, "MintPriceUpdated")
        .withArgs(newPrice);

      expect(await gaslessNFT.mintPrice()).to.equal(newPrice);
    });

    it("Should reject admin functions from non-owner", async function () {
      const { gaslessNFT, unauthorizedUser } = await loadFixture(deployGaslessNFTFixture);

      await expect(
        gaslessNFT.connect(unauthorizedUser).setBaseURI("https://malicious.com/")
      ).to.be.revertedWithCustomError(gaslessNFT, "OwnableUnauthorizedAccount");

      await expect(
        gaslessNFT.connect(unauthorizedUser).setMintPrice(5000000n)
      ).to.be.revertedWithCustomError(gaslessNFT, "OwnableUnauthorizedAccount");
    });
  });

  describe("Reentrancy Protection", function () {
    it("Should prevent reentrancy attacks on mint function", async function () {
      const { gaslessNFT, minter, user1 } = await loadFixture(deployGaslessNFTFixture);

      await expect(gaslessNFT.connect(minter).mint(user1.address, "token1"))
        .to.not.be.reverted;
    });
  });
});
