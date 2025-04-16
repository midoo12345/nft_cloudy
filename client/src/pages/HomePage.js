import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';

function HomePage() {
  const [account, setAccount] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstitution, setIsInstitution] = useState(false);
  
  // Format the account address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Check if wallet is connected and get roles
  useEffect(() => {
    const checkWalletAndRoles = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            const currentAccount = accounts[0];
            setAccount(currentAccount);

            // Check roles
            const provider = new ethers.BrowserProvider(window.ethereum);
            const contract = new ethers.Contract(
              contractAddress.CertificateNFT,
              contractABI.CertificateNFT,
              provider
            );

            const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
            const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));

            const [hasAdminRole, hasInstitutionRole] = await Promise.all([
              contract.hasRole(DEFAULT_ADMIN_ROLE, currentAccount),
              contract.hasRole(INSTITUTION_ROLE, currentAccount)
            ]);

            setIsAdmin(hasAdminRole);
            setIsInstitution(hasInstitutionRole);
          }
        } catch (error) {
          console.error('Error checking wallet and roles:', error);
        }
      }
    };

    checkWalletAndRoles();

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await checkWalletAndRoles();
        } else {
          setAccount('');
          setIsAdmin(false);
          setIsInstitution(false);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, []);

  // Connect wallet
  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        
        // Check roles after connecting
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          contractAddress.CertificateNFT,
          contractABI.CertificateNFT,
          provider
        );

        const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
        const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));

        const [hasAdminRole, hasInstitutionRole] = await Promise.all([
          contract.hasRole(DEFAULT_ADMIN_ROLE, accounts[0]),
          contract.hasRole(INSTITUTION_ROLE, accounts[0])
        ]);

        setIsAdmin(hasAdminRole);
        setIsInstitution(hasInstitutionRole);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Secure Academic Credentials on the Blockchain</h1>
          <p className="hero-description">
            Issue, verify, and manage tamper-proof certificates with NFT technology
          </p>
          {!account ? (
            <button onClick={connectWallet} className="hero-cta-button">
              <i className="fas fa-wallet"></i> Connect Wallet to Get Started
            </button>
          ) : (
            <Link to="/dashboard" className="hero-cta-button">
              <i className="fas fa-columns"></i> Go to Dashboard
            </Link>
          )}
        </div>
        <div className="hero-image">
          <div className="certificate-graphic">
            <div className="certificate-image">
              <i className="fas fa-certificate fa-5x"></i>
              <div className="certificate-stamp">
                <i className="fas fa-check-circle"></i>
              </div>
            </div>
            <div className="blockchain-nodes">
              <div className="node node-1"></div>
              <div className="node node-2"></div>
              <div className="node node-3"></div>
              <div className="connection connection-1"></div>
              <div className="connection connection-2"></div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Key Features</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">
              <i className="fas fa-shield-alt"></i>
            </div>
            <h3>Secure & Immutable</h3>
            <p>Certificates stored on blockchain cannot be tampered with or forged</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h3>Easy Verification</h3>
            <p>Instantly verify the authenticity of any certificate</p>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">
              <i className="fas fa-university"></i>
            </div>
            <h3>Institution Management</h3>
            <p>Add trusted institutions authorized to issue certificates</p>
          </div>
        </div>
      </section>

      {/* Account Info Section - Shown if connected */}
      {account && (
        <section className="account-section">
          <div className="account-card">
            <h2>Account Information</h2>
            <div className="account-details">
              <div className="account-item">
                <span className="account-label">Address:</span>
                <span className="account-value">{formatAddress(account)}</span>
              </div>
              <div className="account-item">
                <span className="account-label">Role:</span>
                <div className="role-badges">
                  {isAdmin && <span className="role-badge admin">Admin</span>}
                  {isInstitution && <span className="role-badge institution">Institution</span>}
                  {!isAdmin && !isInstitution && <span className="role-badge user">User</span>}
                </div>
              </div>
            </div>
            <Link to="/dashboard" className="button button-primary">
              Go to Dashboard
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

export default HomePage; 