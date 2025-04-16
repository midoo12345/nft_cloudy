import React from 'react';
import { useOutletContext } from 'react-router-dom';    
import CertificateUpdate from '../components/CertificateUpdate';

function UpdateCertificatePage() {
  const { account, isInstitution } = useOutletContext();

  if (!isInstitution) {
    return (
      <div className="error-container">
        <div className="error">
          <i className="fas fa-exclamation-circle"></i>
          <p>You must be an institution to update certificates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Update Certificate</h1>
        <p className="page-description">Update an existing certificate's grade</p>
      </div>

      <div className="form-container">
        <CertificateUpdate account={account} isInstitution={isInstitution} />
      </div>
    </div>
  );
}

export default UpdateCertificatePage; 