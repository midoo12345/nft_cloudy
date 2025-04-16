import React, { useState } from 'react';
import { ethers } from 'ethers';
import contractAddress from '../config/contractAddress.json';
import contractABI from '../config/abi.json';

function VerifyCertificatePage() {
  const [tokenId, setTokenId] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setVerificationResult(null);

    try {
      if (!window.ethereum) {
        throw new Error('Ethereum provider is not available');
      }

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );

      // First get the certificate details
      const certificate = await contract.getCertificate(tokenId);
      console.log('Certificate data:', certificate); // Debug log
      
      // Check if certificate is already verified
      if (certificate[5]) { // isVerified is at index 5
        setVerificationResult({
          isValid: true,
          certificate: {
            studentAddress: certificate[0],
            institution: certificate[1],
            courseId: Number(certificate[2]), // Convert BigNumber to number
            completionDate: new Date(Number(certificate[3]) * 1000).toLocaleDateString(),
            grade: Number(certificate[4]), // Convert BigNumber to number
            isVerified: certificate[5],
            isRevoked: certificate[6],
            revocationReason: certificate[7],
            version: Number(certificate[8]), // Convert BigNumber to number
            lastUpdateDate: new Date(Number(certificate[9]) * 1000).toLocaleDateString(),
            updateReason: certificate[10]
          }
        });
        setError('This certificate is already verified.');
        return;
      }
      
      // Then verify the certificate
      const tx = await contract.verifyCertificate(tokenId);
      await tx.wait();
      
      setVerificationResult({
        isValid: true,
        certificate: {
          studentAddress: certificate[0],
          institution: certificate[1],
          courseId: Number(certificate[2]), // Convert BigNumber to number
          completionDate: new Date(Number(certificate[3]) * 1000).toLocaleDateString(),
          grade: Number(certificate[4]), // Convert BigNumber to number
          isVerified: true, // Set to true since we just verified it
          isRevoked: certificate[6],
          revocationReason: certificate[7],
          version: Number(certificate[8]), // Convert BigNumber to number
          lastUpdateDate: new Date(Number(certificate[9]) * 1000).toLocaleDateString(),
          updateReason: certificate[10]
        }
      });
    } catch (err) {
      console.error('Error verifying certificate:', err);
      if (err.message && err.message.includes('Certificate already verified')) {
        setError('This certificate is already verified.');
      } else {
        setError(err.message || 'Failed to verify certificate');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatGrade = (grade) => {
    if (grade >= 90) return 'A';
    if (grade >= 80) return 'B';
    if (grade >= 70) return 'C';
    if (grade >= 60) return 'D';
    return 'F';
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Verify Certificate</h1>
        <p className="page-description">Verify the authenticity of a certificate</p>
      </div>

      <div className="form-container card fade-in">
        <form onSubmit={handleVerify}>
          <div className="form-group">
            <label className="form-label" htmlFor="tokenId">
              Certificate ID (Token ID)
            </label>
            <input
              type="text"
              id="tokenId"
              className="form-input"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <div className="form-actions">
            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
            >
              {loading ? 'Verifying...' : 'Verify Certificate'}
            </button>
          </div>
        </form>

        {verificationResult && (
          <div className="verification-result card">
            <div className="verification-header">
              <h2>Certificate Details</h2>
              <div className={`status-badge ${verificationResult.isValid ? 'verified' : 'invalid'}`}>
                {verificationResult.isValid ? 'Verified' : 'Invalid'}
              </div>
            </div>
            
            <div className="certificate-details">
              <div className="detail-section">
                <h3>Basic Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Student Address:</span>
                  <span className="detail-value">{verificationResult.certificate.studentAddress}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Institution:</span>
                  <span className="detail-value">{verificationResult.certificate.institution}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Course ID:</span>
                  <span className="detail-value course-id">#{verificationResult.certificate.courseId}</span>
                </div>
              </div>

              <div className="detail-section">
                <h3>Academic Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Grade:</span>
                  <span className="grade-value">
                    <span className="grade-letter">{formatGrade(verificationResult.certificate.grade)}</span>
                    <span className="grade-percentage">({verificationResult.certificate.grade}%)</span>
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Completion Date:</span>
                  <span className="detail-value">{verificationResult.certificate.completionDate}</span>
                </div>
              </div>

              <div className="detail-section">
                <h3>Status Information</h3>
                <div className="detail-row">
                  <span className="detail-label">Verified:</span>
                  <span className={`status-value ${verificationResult.certificate.isVerified ? 'verified' : 'pending'}`}>
                    {verificationResult.certificate.isVerified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Revoked:</span>
                  <span className={`status-value ${verificationResult.certificate.isRevoked ? 'revoked' : 'active'}`}>
                    {verificationResult.certificate.isRevoked ? 'Yes' : 'No'}
                  </span>
                </div>
                {verificationResult.certificate.revocationReason && (
                  <div className="detail-row">
                    <span className="detail-label">Revocation Reason:</span>
                    <span className="detail-value">{verificationResult.certificate.revocationReason}</span>
                  </div>
                )}
              </div>

              <div className="detail-section">
                <h3>Version History</h3>
                <div className="detail-row">
                  <span className="detail-label">Version:</span>
                  <span className="detail-value">{verificationResult.certificate.version}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Last Update:</span>
                  <span className="detail-value">{verificationResult.certificate.lastUpdateDate}</span>
                </div>
                {verificationResult.certificate.updateReason && (
                  <div className="detail-row">
                    <span className="detail-label">Update Reason:</span>
                    <span className="detail-value">{verificationResult.certificate.updateReason}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifyCertificatePage; 