import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import LoadingSpinner from '../components/LoadingSpinner';
import { ethers } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';

function Dashboard() {
  const navigate = useNavigate();
  const [account, setAccount] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInstitution, setIsInstitution] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const checkRoles = async (address) => {
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

  useEffect(() => {
    const checkWalletConnection = async () => {
      if (window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            await checkRoles(accounts[0]);
          } else {
            navigate('/');
          }
        } catch (error) {
          console.error('Error checking wallet connection:', error);
          navigate('/');
        }
      } else {
        navigate('/');
      }
      setIsLoading(false);
    };

    checkWalletConnection();

    // Listen for account changes
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          await checkRoles(accounts[0]);
        } else {
          setAccount('');
          setIsAdmin(false);
          setIsInstitution(false);
          navigate('/');
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      return () => {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      };
    }
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="dashboard-loading">
        <LoadingSpinner size="large" text="Loading dashboard..." />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="connect-wallet">
        <h2 className="connect-wallet-title">Please connect your wallet</h2>
        <p className="connect-wallet-description">You need to connect your wallet to access the dashboard.</p>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <div className="dashboard-container">
        <Sidebar isAdmin={isAdmin} isInstitution={isInstitution} />
        <main className="dashboard-main">
          <Outlet context={{ account, isAdmin, isInstitution }} />
        </main>
      </div>
    </div>
  );
}

export default Dashboard; 