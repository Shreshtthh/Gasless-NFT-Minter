const fs = require("fs");
const path = require("path");

const artifactPath = path.join(__dirname, "../artifacts/contracts/GaslessNFT.sol/GaslessNFT.json");
const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

// Create backend ABI directory
const backendDir = path.join(__dirname, "../../backend/src/abis");
if (!fs.existsSync(backendDir)) {
  fs.mkdirSync(backendDir, { recursive: true });
}

// Write ABI to backend
fs.writeFileSync(
  path.join(backendDir, "GaslessNFT.json"), 
  JSON.stringify(artifact.abi, null, 2)
);

console.log("✅ ABI copied to backend/src/abis/GaslessNFT.json");
