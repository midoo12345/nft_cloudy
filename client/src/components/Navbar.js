import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';

function Navbar() {
  const [account, setAccount] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstitution, setIsInstitution] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);
  const dropdownContentRef = useRef(null);

  // Format the account address for display
  const formatAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Check roles for the account
  const checkRoles = async (address) => {
    if (!window.ethereum || !address) return;
    
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        provider
      );

      const DEFAULT_ADMIN_ROLE = ethers.ZeroHash;
      const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));

      const [hasAdminRole, hasInstitutionRole] = await Promise.all([
        contract.hasRole(DEFAULT_ADMIN_ROLE, address),
        contract.hasRole(INSTITUTION_ROLE, address)
      ]);

      setIsAdmin(hasAdminRole);
      setIsInstitution(hasInstitutionRole);
    } catch (error) {
      console.error('Error checking roles:', error);
    }
  };

  // Check if wallet is connected and listen for account changes
  useEffect(() => {
    const handleAccountsChanged = async (accounts) => {
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await checkRoles(accounts[0]);
      } else {
        setAccount('');
        setIsAdmin(false);
        setIsInstitution(false);
      }
    };

    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            await checkRoles(accounts[0]);
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
        }
      }
    };

    checkWalletConnection();

    // Listen for account changes
    if (window.ethereum) {
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
        await checkRoles(accounts[0]);
      }
    } catch (error) {
      console.error('Error connecting wallet:', error);
    }
  };

  // Disconnect wallet
  const handleDisconnect = () => {
    setAccount('');
    setIsAdmin(false);
    setIsInstitution(false);
    setDropdownOpen(false);
  };

  // Switch account by requesting accounts and forcing MetaMask to show account selection dialog
  const handleSwitchAccount = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask!');
      return;
    }

    try {
      await window.ethereum.request({
        method: 'wallet_requestPermissions',
        params: [{ eth_accounts: {} }]
      });
      
      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      if (accounts.length > 0) {
        setAccount(accounts[0]);
        await checkRoles(accounts[0]);
      }
      
      setDropdownOpen(false);
    } catch (error) {
      console.error('Error switching account:', error);
    }
  };

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking inside the dropdown content
      if (dropdownContentRef.current && dropdownContentRef.current.contains(event.target)) {
        return;
      }
      
      // Don't close if clicking on the account address toggle
      if (event.target.closest('.account-address')) {
        return;
      }
      
      // Close if clicking outside the dropdown and not on account address
      if (dropdownOpen && !dropdownRef.current?.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-logo">
          <i className="fas fa-certificate"></i>
          <span>Certificate NFT</span>
        </Link>
      </div>

      <div className="navbar-menu-toggle" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
        <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
      </div>

      <div className={`navbar-actions ${isMobileMenuOpen ? 'active' : ''}`}>
        {account ? (
          <div className="account-info" ref={dropdownRef}>
            <div 
              className="account-address" 
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <i className="fas fa-wallet"></i>
              <span>{formatAddress(account)}</span>
              {isAdmin && <span className="role-badge admin">Admin</span>}
              {isInstitution && !isAdmin && <span className="role-badge institution">Institution</span>}
              {!isAdmin && !isInstitution && <span className="role-badge user">User</span>}
              <i className={`fas fa-chevron-down dropdown-icon ${dropdownOpen ? 'rotated' : ''}`}></i>
            </div>

            {dropdownOpen && (
              <div className="account-dropdown" ref={dropdownContentRef}>
                <div className="dropdown-header">
                  <div className="full-address">
                    <p>Connected Address:</p>
                    <p className="address-text">{account}</p>
                  </div>
                </div>
                <div className="dropdown-content">
                  <button 
                    className="dropdown-item" 
                    onClick={handleSwitchAccount}
                  >
                    <i className="fas fa-exchange-alt"></i>
                    <span>Switch Account</span>
                  </button>
                  <button 
                    className="dropdown-item disconnect" 
                    onClick={handleDisconnect}
                  >
                    <i className="fas fa-sign-out-alt"></i>
                    <span>Disconnect</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <button className="btn btn-primary" onClick={connectWallet}>
            <i className="fas fa-wallet"></i>
            <span>Connect Wallet</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export default Navbar; 