import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrowserProvider, Contract } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';
import { validateGrade, validateReason } from '../utils/validation';
import './CertificateUpdate.css';

const CertificateUpdate = ({ account, isInstitution }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    tokenId: '',
    newGrade: '',
    updateReason: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [updateHistory, setUpdateHistory] = useState([]);
  const [certificateDetails, setCertificateDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isInstitution) {
      navigate('/dashboard');
    }
  }, [isInstitution, navigate]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate token ID
    if (!formData.tokenId.trim()) {
      newErrors.tokenId = 'Certificate ID is required';
    } else if (!/^CERT-\d{6}$/.test(formData.tokenId)) {
      newErrors.tokenId = 'Invalid certificate ID format (e.g., CERT-000001)';
    }

    // Validate grade
    const gradeError = validateGrade(formData.newGrade);
    if (gradeError) {
      newErrors.newGrade = gradeError;
    }

    // Validate reason
    const reasonError = validateReason(formData.updateReason);
    if (reasonError) {
      newErrors.updateReason = reasonError;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const fetchCertificateDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );
      
      // Extract numeric ID from CERT-000001 format
      const numericId = parseInt(formData.tokenId.split('-')[1]);
      
      const details = await contract.getCertificateDetails(numericId);
      setCertificateDetails({
        currentGrade: details.grade,
        studentAddress: details.student,
        institution: details.institution,
        status: details.status
      });

      // Fetch update history
      const history = await contract.getCertificateUpdates(numericId);
      setUpdateHistory(history.map(update => ({
        grade: update.grade,
        reason: update.reason,
        timestamp: new Date(update.timestamp * 1000).toLocaleString(),
        updatedBy: update.updatedBy
      })));
    } catch (err) {
      setError('Failed to fetch certificate details. Please check the certificate ID.');
      console.error('Error fetching certificate details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      // First verify the certificate exists and get current details
      await fetchCertificateDetails();
      
      if (!certificateDetails) {
        setError('Certificate not found');
        return;
      }

      // Show confirmation dialog
      setShowConfirmation(true);
    } catch (err) {
      setError('Failed to process update. Please try again.');
      console.error('Error in update process:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const confirmUpdate = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );
      
      const numericId = parseInt(formData.tokenId.split('-')[1]);
      const tx = await contract.updateCertificate(
        numericId,
        parseInt(formData.newGrade),
        formData.updateReason
      );
      
      await tx.wait();
      
      // Refresh the history after successful update
      await fetchCertificateDetails();
      
      // Reset form
      setFormData({
        tokenId: '',
        newGrade: '',
        updateReason: ''
      });
      setShowConfirmation(false);
    } catch (err) {
      setError('Failed to update certificate. Please try again.');
      console.error('Error updating certificate:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatGrade = (grade) => {
    const letterGrades = ['F', 'D', 'C', 'B', 'A'];
    const index = Math.floor(grade / 20);
    return `${letterGrades[index]} (${grade}%)`;
  };

  return (
    <div className="certificate-update-container">
      <h2>Update Certificate</h2>
      
      <form onSubmit={handleSubmit} className="update-form">
        <div className="form-group">
          <label htmlFor="tokenId">Certificate ID</label>
          <input
            type="text"
            id="tokenId"
            name="tokenId"
            value={formData.tokenId}
            onChange={handleInputChange}
            placeholder="CERT-000001"
            className={errors.tokenId ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.tokenId && <span className="error-message">{errors.tokenId}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="newGrade">New Grade</label>
          <input
            type="number"
            id="newGrade"
            name="newGrade"
            value={formData.newGrade}
            onChange={handleInputChange}
            min="0"
            max="100"
            className={errors.newGrade ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.newGrade && <span className="error-message">{errors.newGrade}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="updateReason">Update Reason</label>
          <textarea
            id="updateReason"
            name="updateReason"
            value={formData.updateReason}
            onChange={handleInputChange}
            placeholder="Explain the reason for this grade update..."
            className={errors.updateReason ? 'error' : ''}
            disabled={isLoading}
          />
          {errors.updateReason && <span className="error-message">{errors.updateReason}</span>}
        </div>

        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={isLoading}
        >
          {isLoading ? 'Processing...' : 'Update Certificate'}
        </button>
      </form>

      {error && (
        <div className="error-container">
          <i className="fas fa-exclamation-circle"></i>
          <p>{error}</p>
        </div>
      )}

      {certificateDetails && (
        <div className="certificate-details">
          <h3>Current Certificate Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Current Grade:</span>
              <span className="detail-value">{formatGrade(certificateDetails.currentGrade)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Student:</span>
              <span className="detail-value">{certificateDetails.studentAddress}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status:</span>
              <span className={`status-badge ${certificateDetails.status.toLowerCase()}`}>
                {certificateDetails.status}
              </span>
            </div>
          </div>
        </div>
      )}

      {updateHistory.length > 0 && (
        <div className="update-history">
          <h3>Update History</h3>
          <div className="history-list">
            {updateHistory.map((update, index) => (
              <div key={index} className="history-item">
                <div className="history-header">
                  <span className="history-grade">{formatGrade(update.grade)}</span>
                  <span className="history-timestamp">{update.timestamp}</span>
                </div>
                <div className="history-reason">{update.reason}</div>
                <div className="history-updated-by">Updated by: {update.updatedBy}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showConfirmation && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Confirm Update</h3>
            <p>Are you sure you want to update this certificate?</p>
            <div className="update-details">
              <p><strong>Current Grade:</strong> {formatGrade(certificateDetails.currentGrade)}</p>
              <p><strong>New Grade:</strong> {formatGrade(parseInt(formData.newGrade))}</p>
              <p><strong>Reason:</strong> {formData.updateReason}</p>
            </div>
            <div className="modal-actions">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowConfirmation(false)}
                disabled={isLoading}
              >
                Cancel
              </button>
              <button 
                className="btn btn-primary"
                onClick={confirmUpdate}
                disabled={isLoading}
              >
                {isLoading ? 'Updating...' : 'Confirm Update'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CertificateUpdate; 