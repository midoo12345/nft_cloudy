import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ethers } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';

function InstitutionsPage() {
  // Get isAdmin from the context
  const { isAdmin } = useOutletContext();
  
  const [institutions, setInstitutions] = useState([]);
  const [newInstitution, setNewInstitution] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Log the isAdmin prop to debug
  useEffect(() => {
    console.log('InstitutionsPage rendered with isAdmin:', isAdmin);
  }, [isAdmin]);

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

      const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));
      
      const filter = contract.filters.RoleGranted(INSTITUTION_ROLE);
      const events = await contract.queryFilter(filter);
      
      const institutionAddresses = [...new Set(events.map(event => event.args.account))];
      
      const validInstitutions = [];
      for (const address of institutionAddresses) {
        const hasRole = await contract.hasRole(INSTITUTION_ROLE, address);
        if (hasRole) {
          validInstitutions.push(address);
        }
      }

      setInstitutions(validInstitutions);
    } catch (err) {
      console.error('Error loading institutions:', err);
      setError('Failed to load institutions');
    } finally {
      setLoading(false);
    }
  };

  const handleAddInstitution = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );

      const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));
      const tx = await contract.grantRole(INSTITUTION_ROLE, newInstitution);
      await tx.wait();

      setSuccess('Institution added successfully!');
      setNewInstitution('');
      await loadInstitutions();
    } catch (err) {
      console.error('Error adding institution:', err);
      setError(err.message || 'Failed to add institution');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveInstitution = async (address) => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );

      const INSTITUTION_ROLE = ethers.keccak256(ethers.toUtf8Bytes('INSTITUTION_ROLE'));
      const tx = await contract.revokeRole(INSTITUTION_ROLE, address);
      await tx.wait();

      setSuccess('Institution removed successfully!');
      await loadInstitutions();
    } catch (err) {
      console.error('Error removing institution:', err);
      setError(err.message || 'Failed to remove institution');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Manage Institutions</h1>
        <p className="page-description">
          {isAdmin 
            ? "Add or remove institutions that can issue certificates" 
            : "View institutions that can issue certificates"}
        </p>
      </div>

      {!isAdmin && (
        <div className="info-container card fade-in">
          <h2>View Only Mode</h2>
          <p>You have the institution role but not the admin role. You can view the list of institutions but cannot add or remove them.</p>
        </div>
      )}

      {isAdmin && (
        <div className="form-container card fade-in">
          <form onSubmit={handleAddInstitution}>
            <div className="form-group">
              <label className="form-label" htmlFor="newInstitution">
                Institution Address
              </label>
              <input
                type="text"
                id="newInstitution"
                className="form-input"
                value={newInstitution}
                onChange={(e) => setNewInstitution(e.target.value)}
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="form-actions">
              <button
                type="submit"
                className="button button-primary"
                disabled={loading}
              >
                {loading ? 'Adding...' : 'Add Institution'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="institutions-list card fade-in">
        <h2>Current Institutions</h2>
        {loading ? (
          <p>Loading institutions...</p>
        ) : institutions.length === 0 ? (
          <p>No institutions found</p>
        ) : (
          <ul className="institution-list">
            {institutions.map((address) => (
              <li key={address} className="institution-item">
                <span className="institution-address">{address}</span>
                {isAdmin && (
                  <button
                    className="button button-secondary"
                    onClick={() => handleRemoveInstitution(address)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default InstitutionsPage; 