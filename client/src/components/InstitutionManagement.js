import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';

const InstitutionManagement = () => {
  const [institutions, setInstitutions] = useState([]);
  const [newInstitution, setNewInstitution] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));

  useEffect(() => {
    loadInstitutions();
  }, []);

  const loadInstitutions = async () => {
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        provider
      );

      // Get all events for role granting
      const filter = contract.filters.RoleGranted(INSTITUTION_ROLE);
      const events = await contract.queryFilter(filter);
      
      // Extract unique addresses from events
      const addresses = [...new Set(events.map(event => event.args.account))];
      setInstitutions(addresses);
    } catch (err) {
      console.error('Error loading institutions:', err);
      setError('Failed to load institutions');
    }
  };

  const grantInstitutionRole = async () => {
    if (!ethers.isAddress(newInstitution)) {
      setError('Please enter a valid Ethereum address');
      return;
    }

    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );

      const tx = await contract.grantRole(INSTITUTION_ROLE, newInstitution);
      await tx.wait();

      setSuccess('Institution role granted successfully');
      setNewInstitution('');
      loadInstitutions();
    } catch (err) {
      console.error('Error granting institution role:', err);
      setError(err.message || 'Failed to grant institution role');
    } finally {
      setLoading(false);
    }
  };

  const revokeInstitutionRole = async (address) => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );

      const tx = await contract.revokeRole(INSTITUTION_ROLE, address);
      await tx.wait();

      setSuccess('Institution role revoked successfully');
      loadInstitutions();
    } catch (err) {
      console.error('Error revoking institution role:', err);
      setError(err.message || 'Failed to revoke institution role');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="institution-management">
      <h2>Institution Management</h2>
      
      <div className="add-institution">
        <input
          type="text"
          value={newInstitution}
          onChange={(e) => setNewInstitution(e.target.value)}
          placeholder="Enter institution address"
          className="input-field"
        />
        <button 
          onClick={grantInstitutionRole}
          disabled={loading || !newInstitution}
          className="action-button"
        >
          {loading ? 'Granting...' : 'Grant Institution Role'}
        </button>
      </div>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="institutions-list">
        <h3>Current Institutions</h3>
        {institutions.length === 0 ? (
          <p>No institutions found</p>
        ) : (
          <ul>
            {institutions.map((address) => (
              <li key={address} className="institution-item">
                <span className="address">{address}</span>
                <button
                  onClick={() => revokeInstitutionRole(address)}
                  disabled={loading}
                  className="action-button revoke"
                >
                  Revoke Role
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default InstitutionManagement; 