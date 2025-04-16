import React from 'react';
import { useOutletContext } from 'react-router-dom';
import CourseManagement from '../components/CourseManagement';

const CourseManagementPage = () => {
  const { isInstitution } = useOutletContext();

  if (!isInstitution) {
    return (
      <div className="page-container">
        <div className="error-message">
          Access denied. Only institutions can manage courses.
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <CourseManagement />
    </div>
  );
};

export default CourseManagementPage; 