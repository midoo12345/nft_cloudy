import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Contract, BrowserProvider } from 'ethers';
import { contractAddress, contractABI } from '../config/contracts';
import { useOutletContext } from 'react-router-dom';
import LoadingSpinner from './LoadingSpinner';
import '../styles/course-management.css';

const ITEMS_PER_PAGE = 12;
const COURSES_CACHE_KEY = 'courses_cache';
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes in milliseconds

const CourseManagement = () => {
  const { isInstitution } = useOutletContext();
  const [courses, setCourses] = useState([]);
  const [newCourseName, setNewCourseName] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: 'id', direction: 'asc' });
  const [showModal, setShowModal] = useState(false);
  
  // Refs
  const courseListRef = useRef(null);

  // Initialize with cached data if available
  useEffect(() => {
    const cachedData = localStorage.getItem(COURSES_CACHE_KEY);
    
    if (cachedData) {
      try {
        const { data, timestamp } = JSON.parse(cachedData);
        const isExpired = Date.now() - timestamp > CACHE_EXPIRY;
        
        if (!isExpired && Array.isArray(data) && data.length > 0) {
          setCourses(data);
          console.log('Loaded from cache:', data.length, 'courses');
          // Still fetch fresh data in the background
          fetchCourses(true);
          return;
        }
      } catch (e) {
        console.error('Error parsing cached data:', e);
      }
    }
    
    // No valid cache, load fresh data
    fetchCourses();
  }, []);

  useEffect(() => {
    if (!isInstitution) {
      setError('Only institutions can manage courses');
    }
  }, [isInstitution]);

  // Reset to first page when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (error || success) {
      const timer = setTimeout(() => {
        setError('');
        setSuccess('');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error, success]);

  // Modal keyboard handling
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setShowModal(false);
      }
    };
    
    if (showModal) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent scrolling when modal is open
    } else {
      document.body.style.overflow = 'auto';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [showModal]);

  // Efficient course fetching
  const fetchCourses = async (isBackground = false) => {
    try {
      if (!isBackground) {
        setLoading(true);
      }
      
      setError('');
      
      const provider = new BrowserProvider(window.ethereum);
      const contract = new Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        provider
      );

      // Get courses directly
      // First get certificates to find course IDs
      const totalSupply = await contract.totalSupply();
      const totalCertificates = Number(totalSupply);
      
      // Set to hold unique course IDs
      const uniqueCourseIds = new Set();
      
      // Get course IDs from certificates (up to 100 certificates)
      const maxCertificatesToCheck = Math.min(totalCertificates, 100);
      for (let i = 0; i < maxCertificatesToCheck; i++) {
        try {
          const tokenId = await contract.tokenByIndex(i);
          const cert = await contract.getCertificate(tokenId);
          uniqueCourseIds.add(cert[2].toString());
        } catch (err) {
          console.warn(`Error getting certificate at index ${i}:`, err);
        }
      }
      
      // Check for courses without certificates
      // Try to find up to 100 courses
      for (let i = 1; i <= 100; i++) {
        try {
          const courseName = await contract.getCourseName(i.toString());
          if (courseName && courseName.trim()) {
            uniqueCourseIds.add(i.toString());
          }
        } catch (err) {
          // Ignore errors - just means this course ID doesn't exist
        }
      }
      
      // Process each course ID to get name
      const allCourses = [];
      for (const courseId of uniqueCourseIds) {
        try {
          const courseName = await contract.getCourseName(courseId);
          if (courseName && courseName.trim()) {
            allCourses.push({
              id: courseId,
              name: courseName
            });
          }
        } catch (err) {
          console.warn(`Error getting course name for ID ${courseId}:`, err);
        }
      }
      
      // Sort courses by ID
      allCourses.sort((a, b) => Number(a.id) - Number(b.id));
      
      // Update state and cache
      setCourses(allCourses);
      
      // Cache the fetched data
      localStorage.setItem(COURSES_CACHE_KEY, JSON.stringify({
        data: allCourses,
        timestamp: Date.now()
      }));
      
      console.log('Fetched and cached', allCourses.length, 'courses');
    } catch (err) {
      setError('Failed to fetch courses: ' + err.message);
      console.error('Error fetching courses:', err);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  };

  const validateInput = () => {
    const errors = {};
    let isValid = true;

    // Validate course name
    if (!newCourseName) {
      errors.courseName = 'Course name is required';
      isValid = false;
    } else if (newCourseName.trim().length === 0) {
      errors.courseName = 'Course name cannot be empty';
      isValid = false;
    } else if (newCourseName.trim().length < 3) {
      errors.courseName = 'Course name must be at least 3 characters long';
      isValid = false;
    } else {
      // Check if course name already exists (case-insensitive)
      const exists = courses.some(course => 
        course.name.toLowerCase() === newCourseName.trim().toLowerCase()
      );
      if (exists) {
        errors.courseName = 'Course name already exists';
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  const handleAddCourse = async (e) => {
    e.preventDefault();
    try {
      setError('');
      setSuccess('');
      setValidationErrors({});

      // Validate before proceeding with transaction
      const isValid = validateInput();
      if (!isValid) {
        return; // Stop if validation fails
      }

      setActionLoading(true);

      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new Contract(
        contractAddress.CertificateNFT,
        contractABI.CertificateNFT,
        signer
      );

      // We need to update the course name using setCourseName instead of addCourse
      // First, get the highest course ID to determine the next one
      let highestCourseId = 0;
      if (courses.length > 0) {
        // Find the highest existing course ID
        highestCourseId = Math.max(...courses.map(c => Number(c.id)));
      }
      
      // Use the next available ID
      const newCourseId = (highestCourseId + 1).toString();
      
      // Set the course name
      const tx = await contract.setCourseName(newCourseId, newCourseName.trim());
      await tx.wait();

      setSuccess('Course added successfully');
      setNewCourseName('');
      
      // Add the new course to the list without reloading
      setCourses(prevCourses => {
        const newCourses = [
          ...prevCourses, 
          { id: newCourseId, name: newCourseName.trim() }
        ].sort((a, b) => Number(a.id) - Number(b.id));
        
        // Update cache
        localStorage.setItem(COURSES_CACHE_KEY, JSON.stringify({
          data: newCourses,
          timestamp: Date.now()
        }));
        
        return newCourses;
      });
      
      // Close the modal
      setShowModal(false);
    } catch (err) {
      console.error('Error adding course:', err);
      // Handle user rejected transaction
      if (err.code === 'ACTION_REJECTED' || err.code === 4001 || err.message.includes('User denied')) {
        setError('Transaction was cancelled by user');
      } else if (err.message.includes("Caller is not an institution")) {
        setError('Only institutions can add or modify courses');
      } else {
        setError('Failed to add course: ' + err.message);
      }
      
      // Don't close modal on error unless it was a user cancellation
      if (err.code === 'ACTION_REJECTED' || err.code === 4001 || err.message.includes('User denied')) {
        setShowModal(false);
      }
    } finally {
      setActionLoading(false);
    }
  };

  // Debounced search handler
  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value);
  }, []);

  // Handle sort
  const handleSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  // Filtered courses based on search term
  const filteredCourses = useMemo(() => {
    if (!searchTerm.trim()) return courses;
    
    const searchLower = searchTerm.toLowerCase();
    return courses.filter(course => 
      course.id.toString().includes(searchTerm) || 
      course.name.toLowerCase().includes(searchLower)
    );
  }, [courses, searchTerm]);

  // Sorted courses based on sort config
  const sortedCourses = useMemo(() => {
    return [...filteredCourses].sort((a, b) => {
      if (sortConfig.key === 'id') {
        return sortConfig.direction === 'asc' 
          ? Number(a.id) - Number(b.id)
          : Number(b.id) - Number(a.id);
      } else {
        return sortConfig.direction === 'asc'
          ? a.name.localeCompare(b.name)
          : b.name.localeCompare(a.name);
      }
    });
  }, [filteredCourses, sortConfig]);

  // Paginated courses
  const paginatedCourses = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return sortedCourses.slice(start, end);
  }, [sortedCourses, currentPage]);

  // Total pages
  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(sortedCourses.length / ITEMS_PER_PAGE));
  }, [sortedCourses]);

  // Handle refresh courses
  const handleRefreshCourses = () => {
    fetchCourses();
  };

  // Render the Add Course Modal
  const renderAddCourseModal = () => {
    if (!showModal) return null;
    
    return (
      <div className="modal-overlay" onClick={() => !actionLoading && setShowModal(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Add New Course</h3>
            <button 
              className="modal-close" 
              onClick={() => !actionLoading && setShowModal(false)}
              disabled={actionLoading}
            >
              ×
            </button>
          </div>
          
          <form onSubmit={handleAddCourse} className="course-form">
            <div className="form-group">
              <label htmlFor="courseName">Course Name:</label>
              <input
                type="text"
                id="courseName"
                value={newCourseName}
                onChange={(e) => setNewCourseName(e.target.value)}
                placeholder="Enter course name"
                required
                autoFocus
                disabled={actionLoading}
                className={`form-input ${validationErrors.courseName ? 'error' : ''}`}
              />
              {validationErrors.courseName && (
                <div className="validation-error">{validationErrors.courseName}</div>
              )}
              <div className="form-help-text">
                A unique ID will be automatically generated for this course
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => !actionLoading && setShowModal(false)}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={actionLoading}>
                {actionLoading ? (
                  <div className="btn-loading-content">
                    <span className="spinner-small"></span>
                    Adding...
                  </div>
                ) : (
                  'Add Course'
                )}
              </button>
            </div>
            
            {actionLoading && (
              <div className="form-status-message">
                <div className="blockchain-status">
                  <span className="blockchain-icon">⛓️</span>
                  <span>Transaction in progress...</span>
                </div>
                <div className="blockchain-help-text">
                  Please wait while your transaction is being processed on the blockchain. 
                  This may take a few moments.
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="page-container">
      <div className="course-management-container">
        <div className="courses-header">
          <h2 className="card-title">Course Management</h2>
          <div className="courses-controls">
            <div className="search-box">
              <input
                type="text"
                className="search-input"
                placeholder="Search courses..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <div className="sort-controls">
              <button
                className={`sort-btn ${sortConfig.key === 'id' ? 'active' : ''}`}
                onClick={() => handleSort('id')}
                aria-label={`Sort by ID ${sortConfig.key === 'id' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : ''}`}
              >
                <span>ID</span>
                {sortConfig.key === 'id' && (
                  <span className="sort-icon">
                    {sortConfig.direction === 'asc' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/>
                      </svg>
                    )}
                  </span>
                )}
              </button>
              <button
                className={`sort-btn ${sortConfig.key === 'name' ? 'active' : ''}`}
                onClick={() => handleSort('name')}
                aria-label={`Sort by Name ${sortConfig.key === 'name' ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : ''}`}
              >
                <span>Name</span>
                {sortConfig.key === 'name' && (
                  <span className="sort-icon">
                    {sortConfig.direction === 'asc' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 15a.5.5 0 0 0 .5-.5V2.707l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4a.5.5 0 0 0-.708 0l-4 4a.5.5 0 1 0 .708.708L7.5 2.707V14.5a.5.5 0 0 0 .5.5z"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                        <path fillRule="evenodd" d="M8 1a.5.5 0 0 1 .5.5v11.793l3.146-3.147a.5.5 0 0 1 .708.708l-4 4a.5.5 0 0 1-.708 0l-4-4a.5.5 0 0 1 .708-.708L7.5 13.293V1.5A.5.5 0 0 1 8 1z"/>
                      </svg>
                    )}
                  </span>
                )}
              </button>
            </div>
            <div className="action-buttons">
              <button
                className="btn btn-secondary refresh-btn"
                onClick={handleRefreshCourses}
                disabled={loading}
                aria-label="Refresh courses"
              >
                {loading ? <LoadingSpinner size="small" /> : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                    <path fillRule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
                    <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466z"/>
                  </svg>
                )}
              </button>
              <button 
                className="btn btn-primary add-course-btn" 
                onClick={() => setShowModal(true)}
              >
                Add New Course
              </button>
            </div>
          </div>
        </div>
        
        <div className="message-container">
          {error && <div className="error-message fade-in">{error}</div>}
          {success && <div className="success-message fade-in">{success}</div>}
        </div>

        <div className="courses-section" ref={courseListRef}>
          {loading ? (
            <div className="loading-container">
              <LoadingSpinner size="medium" text="Loading courses..." />
            </div>
          ) : sortedCourses.length === 0 ? (
            <div className="no-data">
              {searchTerm 
                ? 'No courses match your search' 
                : 'No courses found. Click "Add New Course" to create one.'
              }
            </div>
          ) : (
            <>
              <div className="courses-stats">
                Showing {paginatedCourses.length} of {sortedCourses.length} courses
              </div>
              
              <div className="courses-grid">
                {paginatedCourses.map((course) => (
                  <div key={course.id} className="course-card">
                    <div className="course-id-badge">{course.id}</div>
                    <div className="course-name">{course.name}</div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="pagination">
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    aria-label="Go to first page"
                  >
                    « First
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    aria-label="Go to previous page"
                  >
                    ‹ Previous
                  </button>
                  <span className="page-info">
                    Page {currentPage} of {totalPages}
                  </span>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    aria-label="Go to next page"
                  >
                    Next ›
                  </button>
                  <button
                    className="pagination-btn"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    aria-label="Go to last page"
                  >
                    Last »
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {renderAddCourseModal()}
    </div>
  );
};

export default CourseManagement; 