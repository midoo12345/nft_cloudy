const hre = require("hardhat");
const { updateFrontendConfig } = require('./update-frontend');

async function main() {
  // Get the network
  const network = hre.network.name;
  console.log(`Deploying CertificateNFT contract to ${network} network...`);
  
  // Get the deployer's address
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Deploying contract with account: ${deployer.address}`);
  
  // Deploy the contract
  const CertificateNFT = await hre.ethers.getContractFactory("CertificateNFT");
  const certificateNFT = await CertificateNFT.deploy();
  
  await certificateNFT.waitForDeployment();
  
  const address = await certificateNFT.getAddress();
  console.log(`CertificateNFT deployed to: ${address} on ${network}`);
  console.log("You can now use this address in your frontend configuration");
  
  // Update the frontend config with the new contract address
  await updateFrontendConfig(network, address);
  
  // If not local, update the user on the next steps to verify the contract
  if (network !== "hardhat" && network !== "localhost") {
    console.log(`\nTo verify the contract on ${network} explorer:`);
    console.log(`npx hardhat verify --network ${network} ${address}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 