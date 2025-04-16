import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const Sidebar = ({ isAdmin, isInstitution }) => {
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 768);
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth <= 768);
  const location = useLocation();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobileView(mobile);
      
      // Auto-collapse on mobile
      if (mobile && !isCollapsed) {
        setIsCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isCollapsed]);

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (isMobileView) {
      setIsCollapsed(true);
    }
  }, [location, isMobileView]);

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {isMobileView && (
        <button 
          className={`sidebar-toggle ${isCollapsed ? '' : 'active'}`}
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <i className={`fas ${isCollapsed ? 'fa-bars' : 'fa-times'}`}></i>
        </button>
      )}
      
      <aside className={`sidebar ${isCollapsed && isMobileView ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <i className="fas fa-certificate"></i>
          <h2 className="sidebar-title">Certificate NFT</h2>
        </div>
        <nav className="sidebar-nav">
          <ul className="sidebar-menu">
            <li>
              <NavLink to="/dashboard" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`} end>
                <i className="fas fa-home"></i>
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/dashboard/certificates" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                <i className="fas fa-certificate"></i>
                <span>My Certificates</span>
              </NavLink>
            </li>
            {isInstitution && (
              <>
                <li>
                  <NavLink to="/dashboard/issue" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                    <i className="fas fa-plus-circle"></i>
                    <span>Issue Certificate</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/dashboard/update" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                    <i className="fas fa-edit"></i>
                    <span>Update Certificate</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/dashboard/courses" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                    <i className="fas fa-book"></i>
                    <span>Manage Courses</span>
                  </NavLink>
                </li>
                <li>
                  <NavLink to="/dashboard/verify" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                    <i className="fas fa-check-circle"></i>
                    <span>Verify Certificates</span>
                  </NavLink>
                </li>
              </>
            )}
            {isAdmin && (
              <li>
                <NavLink to="/dashboard/institutions" className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}>
                  <i className="fas fa-university"></i>
                  <span>Manage Institutions</span>
                </NavLink>
              </li>
            )}
          </ul>
        </nav>
        <div className="sidebar-footer">
          <p className="sidebar-version">v1.0.0</p>
        </div>
      </aside>
    </>
  );
};

export default Sidebar; 