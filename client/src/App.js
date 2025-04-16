import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import Navbar from './components/Navbar';
import LoadingSpinner from './components/LoadingSpinner';

// Pages
import Dashboard from './pages/Dashboard';
import CertificatesPage from './pages/CertificatesPage';
import IssueCertificatePage from './pages/IssueCertificatePage';
import VerifyCertificatePage from './pages/VerifyCertificatePage';
import UpdateCertificatePage from './pages/UpdateCertificatePage';
import InstitutionsPage from './pages/InstitutionsPage';
import HomePage from './pages/HomePage';
import CourseManagementPage from './pages/CourseManagementPage';

function App() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if MetaMask is installed
        if (window.ethereum) {
          // Request account access
          await window.ethereum.request({ method: 'eth_accounts' });
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, []);

  if (isLoading) {
    return (
      <div className="app-loading">
        <LoadingSpinner size="large" text="Initializing application..." />
      </div>
    );
  }

  return (
    <Router>
      <div className="App">
        <Navbar />
        <div className="main-content">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/dashboard" element={<Dashboard />}>
              <Route index element={<Navigate to="certificates" replace />} />
              <Route path="certificates" element={<CertificatesPage />} />
              <Route path="issue" element={<IssueCertificatePage />} />
              <Route path="verify" element={<VerifyCertificatePage />} />
              <Route path="update" element={<UpdateCertificatePage />} />
              <Route path="institutions" element={<InstitutionsPage />} />
              <Route path="courses" element={<CourseManagementPage />} />
            </Route>
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
