import React from 'react';
import CertificateList from '../components/CertificateList';

function CertificatesPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">My Certificates</h1>
        <p className="page-description">View and manage your academic certificates</p>
      </div>
      <div className="content-container">
        <CertificateList />
      </div>
    </div>
  );
}

export default CertificatesPage; 