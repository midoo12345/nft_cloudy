import React, { useState, useEffect, useCallback } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import { useOutletContext } from 'react-router-dom';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';
import './CertificateList.css';
import { Link } from 'react-router-dom';

const ITEMS_PER_PAGE = 10;
const SORT_OPTIONS = [
  { value: 'date-desc', label: 'Date (Newest First)' },
  { value: 'date-asc', label: 'Date (Oldest First)' },
  { value: 'grade-desc', label: 'Grade (Highest First)' },
  { value: 'grade-asc', label: 'Grade (Lowest First)' },
  { value: 'course-asc', label: 'Course Name (A-Z)' },
  { value: 'course-desc', label: 'Course Name (Z-A)' },
  { value: 'status', label: 'Status' }
];

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Certificates' },
  { value: 'verified', label: 'Verified' },
  { value: 'pending', label: 'Pending' },
  { value: 'revoked', label: 'Revoked' }
];

function CertificateList() {
  const { account, isInstitution } = useOutletContext();
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [transferData, setTransferData] = useState({
    tokenId: '',
    recipient: ''
  });
  const [revokeData, setRevokeData] = useState({
    tokenId: '',
    reason: ''
  });
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0,
    revoked: 0
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('date-desc');
  const [filterBy, setFilterBy] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  // Helper function to get the account address
  const getAccountAddress = useCallback(() => {
    if (!account) return '';
    return typeof account === 'string' ? account : account.address;
  }, [account]);

  const fetchCertificates = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      
      // Debug logging
      console.log('Contract Address:', contractAddress);
      console.log('Contract ABI:', contractABI);
      console.log('Account:', account);
      
      // Get the account address
      const accountAddress = getAccountAddress();
      
      // Check if account is valid
      if (!accountAddress) {
        console.error('Account is missing or invalid:', account);
        throw new Error('Account is not configured');
      }
      
      // Check if window.ethereum is available
      if (!window.ethereum) {
        console.error('Ethereum provider is not available');
        throw new Error('Ethereum provider is not available');
      }
      
      let provider;
      let contract;
      let networkName = 'hardhat'; // Default network name
      let contractAddr = contractAddress.CertificateNFT; // Default address
      
      try {
        provider = new BrowserProvider(window.ethereum);
        
        // Get the chainId to verify we're on the correct network
        const network = await provider.getNetwork();
        console.log('Connected to network:', network.name, 'ChainID:', network.chainId.toString());
        
        // Get the current network
        networkName = network.name.toLowerCase();
        
        // Get appropriate contract address for the current network
        if (contractAddress[networkName] && contractAddress[networkName].CertificateNFT) {
          contractAddr = contractAddress[networkName].CertificateNFT;
          console.log(`Using ${networkName} network address:`, contractAddr);
        } else {
          contractAddr = contractAddress.CertificateNFT;
          console.log(`Using default address for ${networkName}:`, contractAddr);
        }
        
        // Verify the contract address for the current network
        if (!contractAddr) {
          throw new Error(`No contract address configured for network: ${networkName}`);
        }
        
        // Verify the contract exists at the specified address
        const code = await provider.getCode(contractAddr);
        if (code === '0x') {
          console.warn('No contract code found at the specified address:', contractAddr);
          setError(`No contract found at ${contractAddr}. The contract might not be deployed on the ${networkName} network. Please deploy the contract to this network or switch to a network where it's already deployed.`);
          setLoading(false);
          return; // Exit early if no contract exists
        }
        
        console.log('Contract code length:', code.length);
        
        // Create contract instance with strict verification
        contract = new Contract(
          contractAddr,
          contractABI.CertificateNFT,
          provider
        );
        
        // Verify contract by calling a view function that should exist on any ERC721
        try {
          const name = await contract.name().catch(e => null);
          const symbol = await contract.symbol().catch(e => null);
          console.log('Contract name:', name, 'Symbol:', symbol);
          
          if (!name || !symbol) {
            console.warn('Could not retrieve basic ERC721 information');
          } else {
            console.log('Successfully verified ERC721 contract');
          }
        } catch (nameError) {
          console.error('Failed to verify ERC721 contract:', nameError);
          // Continue anyway, but log the warning
        }
        
        // Test if contract interface exists
        const supports = await contract.supportsInterface('0x80ac58cd').catch(err => {
          console.warn('Error checking interface support:', err);
          return null;
        });
        console.log('Contract supports ERC721 interface:', supports);
        
        if (supports === false) {
          setError('The contract at this address is not a valid ERC721 token. Please check your configuration.');
          setLoading(false);
          return; // Exit early if not an ERC721
        }
        
      } catch (providerError) {
        console.error('Provider or contract initialization error:', providerError);
        setError(`Network connection error: ${providerError.message}. Please make sure the contract is deployed on this network.`);
        setLoading(false);
        return; // Exit early on provider error
      }

      // Create contract instance with explicit error handling
      try {
        // Test if the contract has the required functions
        const hasBalanceOf = contract.interface.getFunction('balanceOf');
        const hasTotalSupply = contract.interface.getFunction('totalSupply');
        console.log('ABI functions check - balanceOf:', !!hasBalanceOf, 'totalSupply:', !!hasTotalSupply);
      } catch (contractError) {
        console.error('ABI error:', contractError);
      }

      let certs = [];

      if (isInstitution) {
        // Fetch certificates issued by the institution
        const totalCertificates = await contract.totalSupply();
        
        for (let i = 0; i < totalCertificates; i++) {
          const tokenId = await contract.tokenByIndex(i);
          const cert = await contract.getCertificate(tokenId);
          const courseName = await contract.getCourseName(cert[2]); // Get course name

          if (cert[1].toLowerCase() === accountAddress.toLowerCase()) {
            certs.push({
              id: tokenId,
              student: cert[0],
              institution: cert[1],
              courseId: cert[2],
              courseName: courseName || `Course #${cert[2]}`, // Use course name or fallback
              completionDate: new Date(Number(cert[3]) * 1000).toLocaleDateString(),
              grade: cert[4],
              isVerified: cert[5],
              isRevoked: cert[6],
              revocationReason: cert[7],
              version: cert[8],
              lastUpdateDate: new Date(Number(cert[9]) * 1000).toLocaleDateString(),
              updateReason: cert[10]
            });
          }
        }
      } else {
        // Fetch certificates owned by the user
        try {
          console.log("Fetching balance for address:", accountAddress);
          console.log("Using contract address in user section:", contractAddr);
          
          // Check if contract exists at the address - use contractAddr consistently
          const codeCheck = await provider.getCode(contractAddr);
          console.log("Contract code exists:", codeCheck !== "0x");
          
          // Get network info for debugging for consistency
          console.log("Using network:", networkName);
          
          // Try multiple methods to find user certificates
          let balance;
          let usingFallback = false;
          
          try {
            // Primary method - use balanceOf
            balance = await contract.balanceOf(accountAddress);
            console.log("Balance result from balanceOf:", balance);
          } catch (balanceError) {
            console.error("balanceOf error details:", balanceError);
            usingFallback = true;
            
            // Fallback method - iterate through all tokens 
            try {
              console.log("Using fallback method to find user certificates");
              
              // Instead of relying on totalSupply, try a direct approach
              let isValidContract = false;
              
              try {
                // Try to check if we can get the name of the token to verify it's a valid contract
                const name = await contract.name();
                console.log("Contract name:", name);
                isValidContract = true;
              } catch (nameError) {
                console.error("Could not get contract name:", nameError);
                throw new Error("The contract on this network is not compatible with your ABI. Please deploy the correct contract or switch to a network where it's deployed.");
              }
              
              if (!isValidContract) {
                throw new Error("Invalid contract. Please verify the contract address.");
              }
              
              try {
                const totalSupply = await contract.totalSupply();
                console.log("Total supply:", totalSupply);
                
                // Find tokens owned by user by checking all tokens
                for (let i = 0; i < totalSupply; i++) {
                  try {
                    const tokenId = await contract.tokenByIndex(i);
                    const owner = await contract.ownerOf(tokenId);
                    
                    if (owner.toLowerCase() === accountAddress.toLowerCase()) {
                      const cert = await contract.getCertificate(tokenId);
                      const courseName = await contract.getCourseName(cert[2]);
                      
                      certs.push({
                        id: tokenId,
                        student: cert[0],
                        institution: cert[1],
                        courseId: cert[2],
                        courseName: courseName || `Course #${cert[2]}`,
                        completionDate: new Date(Number(cert[3]) * 1000).toLocaleDateString(),
                        grade: cert[4],
                        isVerified: cert[5],
                        isRevoked: cert[6],
                        revocationReason: cert[7],
                        version: cert[8],
                        lastUpdateDate: new Date(Number(cert[9]) * 1000).toLocaleDateString(),
                        updateReason: cert[10]
                      });
                    }
                  } catch (tokenError) {
                    console.warn("Error checking token:", i, tokenError.message);
                    // Continue with next token
                  }
                }
              } catch (totalSupplyError) {
                console.error("Error getting totalSupply:", totalSupplyError);
                throw new Error("Cannot access totalSupply. The contract may not be properly deployed on this network.");
              }
              
              console.log("Found certificates through fallback:", certs.length);
              
              // Skip the regular processing since we've already built the certificates list
              balance = 0;
            } catch (fallbackError) {
              console.error("Fallback method failed:", fallbackError);
              setError(`${fallbackError.message || "Contract error"} - Please verify you're connected to the correct network where the contract is deployed.`);
              // No need to rethrow, we'll display the error to the user
            }
          }
          
          // Only proceed with normal processing if we're not using the fallback
          if (!usingFallback && balance && balance > 0) {
            for (let i = 0; i < balance; i++) {
              try {
                const tokenId = await contract.tokenOfOwnerByIndex(accountAddress, i);
                const cert = await contract.getCertificate(tokenId);
                const courseName = await contract.getCourseName(cert[2]);
      
                certs.push({
                  id: tokenId,
                  student: cert[0],
                  institution: cert[1],
                  courseId: cert[2],
                  courseName: courseName || `Course #${cert[2]}`,
                  completionDate: new Date(Number(cert[3]) * 1000).toLocaleDateString(),
                  grade: cert[4],
                  isVerified: cert[5],
                  isRevoked: cert[6],
                  revocationReason: cert[7],
                  version: cert[8],
                  lastUpdateDate: new Date(Number(cert[9]) * 1000).toLocaleDateString(),
                  updateReason: cert[10]
                });
              } catch (tokenError) {
                console.error("Error processing token at index:", i, tokenError);
                // Continue with next token
              }
            }
          } else if (!usingFallback) {
            console.log("User has no certificates or balance is not available");
          }
        } catch (balanceError) {
          console.error("Error in balance section:", balanceError);
          setError(`Could not get your certificates: ${balanceError.message}`);
          // Continue with empty certificates list
        }
      }
      
      // Calculate stats
      const stats = certs.reduce((acc, cert) => {
        acc.total++;
        if (cert.isRevoked) acc.revoked++;
        else if (cert.isVerified) acc.verified++;
        else acc.pending++;
        return acc;
      }, { total: 0, verified: 0, pending: 0, revoked: 0 });

      setStats(stats);
      setCertificates(certs);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      setError(`Failed to fetch certificates: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [account, isInstitution, getAccountAddress]);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const formatGrade = (grade) => {
    if (grade >= 90) return 'A';
    if (grade >= 80) return 'B';
    if (grade >= 70) return 'C';
    if (grade >= 60) return 'D';
    return 'F';
  };

  const generateCertificateId = (tokenId) => {
    return `CERT-${String(tokenId).padStart(6, '0')}`;
  };

  const verifyCertificate = async (tokenId) => {
    try {
      setLoading(true);
      setError('');
      
      // Get the account address
      const accountAddress = getAccountAddress();
      
      if (!window.ethereum) {
        throw new Error('Ethereum provider is not available');
      }
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Get the current network
      const network = await provider.getNetwork();
      const networkName = network.name.toLowerCase();
      
      // Get appropriate contract address for the current network
      let contractAddr;
      if (contractAddress[networkName] && contractAddress[networkName].CertificateNFT) {
        contractAddr = contractAddress[networkName].CertificateNFT;
      } else {
        contractAddr = contractAddress.CertificateNFT;
      }
      
      const contract = new Contract(
        contractAddr,
        contractABI.CertificateNFT,
        signer
      );
      
      // Use accountAddress in the transaction
      console.log(`Verifying certificate ${tokenId} with account ${accountAddress}`);
      
      const tx = await contract.verifyCertificate(tokenId);
      await tx.wait();
      
      fetchCertificates();
    } catch (err) {
      console.error('Error verifying certificate:', err);
      setError('Failed to verify certificate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const transferCertificate = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get the account address
      const accountAddress = getAccountAddress();
      
      if (!window.ethereum) {
        throw new Error('Ethereum provider is not available');
      }
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Get the current network
      const network = await provider.getNetwork();
      const networkName = network.name.toLowerCase();
      
      // Get appropriate contract address for the current network
      let contractAddr;
      if (contractAddress[networkName] && contractAddress[networkName].CertificateNFT) {
        contractAddr = contractAddress[networkName].CertificateNFT;
      } else {
        contractAddr = contractAddress.CertificateNFT;
      }
      
      const contract = new Contract(
        contractAddr,
        contractABI.CertificateNFT,
        signer
      );
      
      const tx = await contract.transferFrom(
        accountAddress,
        transferData.recipient,
        transferData.tokenId
      );
      await tx.wait();
      
      fetchCertificates();
    } catch (err) {
      console.error('Error transferring certificate:', err);
      setError('Failed to transfer certificate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const revokeCertificate = async (tokenId, reason) => {
    try {
      setLoading(true);
      setError('');
      
      // Get the account address
      const accountAddress = getAccountAddress();
      
      if (!window.ethereum) {
        throw new Error('Ethereum provider is not available');
      }
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      // Get the current network
      const network = await provider.getNetwork();
      const networkName = network.name.toLowerCase();
      
      // Get appropriate contract address for the current network
      let contractAddr;
      if (contractAddress[networkName] && contractAddress[networkName].CertificateNFT) {
        contractAddr = contractAddress[networkName].CertificateNFT;
      } else {
        contractAddr = contractAddress.CertificateNFT;
      }
      
      const contract = new Contract(
        contractAddr,
        contractABI.CertificateNFT,
        signer
      );
      
      // Use accountAddress in the transaction
      console.log(`Revoking certificate ${tokenId} with account ${accountAddress}`);
      
      const tx = await contract.revokeCertificate(tokenId, reason);
      await tx.wait();
      
      fetchCertificates();
    } catch (err) {
      console.error('Error revoking certificate:', err);
      setError('Failed to revoke certificate: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (e) => {
    setSortBy(e.target.value);
    setCurrentPage(1);
  };

  const handleFilter = (e) => {
    setFilterBy(e.target.value);
    setCurrentPage(1);
  };

  const handleSearch = (e) => {
    setSearchQuery(e.target.value);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const filteredCerts = filterAndSortCertificates();
      const csvContent = [
        ['Certificate ID', 'Student Address', 'Course Name', 'Course ID', 'Grade', 'Status', 'Issue Date', 'Last Update'],
        ...filteredCerts.map(cert => [
          generateCertificateId(cert.id),
          cert.student,
          cert.courseName,
          cert.courseId.toString(),
          formatGrade(cert.grade),
          cert.isRevoked ? 'Revoked' : cert.isVerified ? 'Verified' : 'Pending',
          cert.completionDate,
          cert.lastUpdateDate
        ])
      ].map(row => row.join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `certificates_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } catch (err) {
      console.error("Export error:", err);
      setError("Failed to export certificates");
    } finally {
      setExporting(false);
    }
  };

  const filterAndSortCertificates = () => {
    let filtered = [...certificates];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(cert => 
        generateCertificateId(cert.id).toLowerCase().includes(query) ||
        cert.student.toLowerCase().includes(query) ||
        cert.courseName.toLowerCase().includes(query) ||
        cert.courseId.toString().includes(query)
      );
    }

    // Apply status filter
    if (filterBy !== 'all') {
      filtered = filtered.filter(cert => {
        if (filterBy === 'verified') return cert.isVerified && !cert.isRevoked;
        if (filterBy === 'pending') return !cert.isVerified && !cert.isRevoked;
        if (filterBy === 'revoked') return cert.isRevoked;
        return true;
      });
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.completionDate) - new Date(a.completionDate);
        case 'date-asc':
          return new Date(a.completionDate) - new Date(b.completionDate);
        case 'grade-desc':
          return b.grade - a.grade;
        case 'grade-asc':
          return a.grade - b.grade;
        case 'course-asc':
          return a.courseName.localeCompare(b.courseName);
        case 'course-desc':
          return b.courseName.localeCompare(a.courseName);
        case 'status':
          return (a.isVerified === b.isVerified) ? 0 : a.isVerified ? -1 : 1;
        default:
          return 0;
      }
    });

    return filtered;
  };

  const paginatedCertificates = () => {
    const filtered = filterAndSortCertificates();
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };

  const totalPages = Math.ceil(filterAndSortCertificates().length / ITEMS_PER_PAGE);

  const renderEmptyState = () => (
    <div className="empty-state">
      <i className="fas fa-certificate empty-state-icon"></i>
      <h3 className="empty-state-title">No Certificates Found</h3>
      <p className="empty-state-description">
        {isInstitution
          ? "You haven't issued any certificates yet. Start by creating a new certificate for your students."
          : "You don't have any certificates yet. Certificates issued to you will appear here."}
      </p>
      {isInstitution && (
        <Link to="/dashboard/issue" className="btn btn-primary">
          Issue New Certificate
        </Link>
      )}
    </div>
  );

  if (loading) return <div className="loading">Loading certificates...</div>;
  if (error) {
    return (
      <div className="error-container">
        <div className="error-message">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
          <button onClick={fetchCertificates} className="btn btn-primary">
            Retry
          </button>
        </div>
      </div>
    );
  }
  if (!account) return <div className="warning">Please connect your wallet to view certificates</div>;

  return (
    <div className="certificate-list-container">
      <div className="certificate-list-header">
        <h2>{isInstitution ? 'Issued Certificates' : 'My Certificates'}</h2>
        
        <div className="certificate-list-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search certificates..."
              value={searchQuery}
              onChange={handleSearch}
              className="search-input"
            />
            <i className="fas fa-search"></i>
          </div>

          <div className="filter-controls">
            <select value={filterBy} onChange={handleFilter} className="filter-select">
              {FILTER_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select value={sortBy} onChange={handleSort} className="sort-select">
              {SORT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button 
              onClick={handleExport} 
              disabled={exporting}
              className="btn btn-secondary"
            >
              {exporting ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>

        {isInstitution && (
          <div className="certificate-stats">
            <div className="stat-card">
              <span className="stat-label">Total</span>
              <span className="stat-value">{stats.total}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Verified</span>
              <span className="stat-value">{stats.verified}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Pending</span>
              <span className="stat-value">{stats.pending}</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Revoked</span>
              <span className="stat-value">{stats.revoked}</span>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="certificate-list-skeleton">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="certificate-card-skeleton">
              <div className="skeleton-header"></div>
              <div className="skeleton-content">
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
                <div className="skeleton-line"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {paginatedCertificates().length === 0 ? (
            renderEmptyState()
          ) : (
            <>
              <div className="certificate-list">
                {paginatedCertificates().map((certificate) => (
                  <div key={certificate.id} className="certificate-card">
                    <div className="certificate-header">
                      <div className="certificate-id">{generateCertificateId(certificate.id)}</div>
                      <div className={`status-badge ${certificate.isRevoked ? 'revoked' : certificate.isVerified ? 'verified' : 'pending'}`}>
                        {certificate.isRevoked ? 'Revoked' : certificate.isVerified ? 'Verified' : 'Pending'}
                      </div>
                    </div>
                    
                    <div className="certificate-details">
                      <div className="detail-row">
                        <span className="detail-label">Student Address:</span>
                        <span className="detail-value">{certificate.student}</span>
                      </div>
                      <div className="detail-row course-row">
                        <span className="detail-label">Course:</span>
                        <span className="detail-value">
                          {certificate.courseName}
                          <span className="course-id">ID: {certificate.courseId.toString()}</span>
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Issue Date:</span>
                        <span className="detail-value">{certificate.completionDate}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Grade:</span>
                        <span className="grade-value">
                          <span className="grade-letter">{formatGrade(certificate.grade)}</span>
                          <span className="grade-percentage">({certificate.grade}%)</span>
                        </span>
                      </div>
                      {certificate.revocationReason && (
                        <div className="detail-row">
                          <span className="detail-label">Revocation Reason:</span>
                          <span className="detail-value">{certificate.revocationReason}</span>
                        </div>
                      )}
                    </div>

                    <div className="certificate-actions">
                      {!certificate.isVerified && !certificate.isRevoked && isInstitution && (
                        <button 
                          className="btn btn-primary"
                          onClick={() => verifyCertificate(certificate.id)}
                        >
                          Verify
                        </button>
                      )}
                      {!certificate.isRevoked && isInstitution && (
                        <button 
                          className="btn btn-danger"
                          onClick={() => {
                            const reason = prompt('Enter reason for revocation:');
                            if (reason) revokeCertificate(certificate.id, reason);
                          }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Transfer Modal */}
      {transferData.tokenId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Transfer Certificate</h3>
            <div className="form-group">
              <input
                type="text"
                value={transferData.recipient}
                onChange={(e) => setTransferData({ ...transferData, recipient: e.target.value })}
                placeholder="Recipient Address"
                className="form-input"
              />
            </div>
            <div className="modal-actions">
              <button
                onClick={transferCertificate}
                className="btn btn-primary"
                disabled={loading || !transferData.recipient}
              >
                Transfer
              </button>
              <button
                onClick={() => setTransferData({ tokenId: '', recipient: '' })}
                className="btn btn-secondary"
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revoke Modal */}
      {revokeData.tokenId && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Revoke Certificate</h3>
            <div className="form-group">
              <label className="form-label">Reason for revocation:</label>
              <input
                type="text"
                value={revokeData.reason}
                onChange={(e) => setRevokeData({ ...revokeData, reason: e.target.value })}
                placeholder="Reason for revocation"
                className="form-input"
              />
            </div>
            <div className="modal-actions">
              <button 
                onClick={() => revokeCertificate(revokeData.tokenId, revokeData.reason)} 
                className="btn btn-danger"
                disabled={loading || !revokeData.reason}
              >
                Confirm Revocation
              </button>
              <button 
                onClick={() => setRevokeData({ tokenId: '', reason: '' })}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CertificateList;