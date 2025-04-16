import React from 'react';
import { useOutletContext } from 'react-router-dom';    
import CertificateForm from '../components/CertificateForm';
import '../styles/pages.css';

function IssueCertificatePage() {
  const { isInstitution } = useOutletContext();

  if (!isInstitution) {
    return (
      <div className="error-container">
        <div className="error">
          <i className="fas fa-exclamation-circle"></i>
          <p>You must be an institution to issue certificates.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Issue Certificate</h1>
        <p className="page-description">Create a new certificate for a student</p>
      </div>

      <div className="form-container">
        <CertificateForm />
      </div>
    </div>
  );
}

export default IssueCertificatePage; 