const fs = require('fs');
const path = require('path');

async function updateContractInfo() {
  try {
    // Read the contract artifacts
    const artifactPath = path.join(__dirname, '../artifacts/contracts/CertificateNFT.sol/CertificateNFT.json');
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // Get the deployed contract address from the deployment receipt
    const deploymentReceiptPath = path.join(__dirname, '../deployments/localhost/CertificateNFT.json');
    const deploymentReceipt = JSON.parse(fs.readFileSync(deploymentReceiptPath, 'utf8'));
    const contractAddress = deploymentReceipt.address;

    // Read the current contracts.json
    const contractsConfigPath = path.join(__dirname, '../client/src/config/contracts.json');
    const contractsConfig = JSON.parse(fs.readFileSync(contractsConfigPath, 'utf8'));

    // Update the contract information
    contractsConfig.CertificateNFT = {
      address: contractAddress,
      abi: artifact.abi
    };

    // Write back to contracts.json
    fs.writeFileSync(contractsConfigPath, JSON.stringify(contractsConfig, null, 2));
    console.log('Contract information updated successfully!');
    console.log('Contract Address:', contractAddress);
  } catch (error) {
    console.error('Error updating contract information:', error);
    console.error('Make sure you have:');
    console.error('1. Deployed the contract (npx hardhat run scripts/deploy.js --network localhost)');
    console.error('2. Compiled the contract (npx hardhat compile)');
  }
}

updateContractInfo(); 