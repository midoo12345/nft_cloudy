export const validateGrade = (grade) => {
  if (!grade) {
    return 'Grade is required';
  }
  
  const numericGrade = parseInt(grade);
  if (isNaN(numericGrade)) {
    return 'Grade must be a number';
  }
  
  if (numericGrade < 0 || numericGrade > 100) {
    return 'Grade must be between 0 and 100';
  }
  
  return null;
};

export const validateReason = (reason) => {
  if (!reason) {
    return 'Update reason is required';
  }
  
  if (reason.length < 10) {
    return 'Reason must be at least 10 characters long';
  }
  
  if (reason.length > 500) {
    return 'Reason must not exceed 500 characters';
  }
  
  return null;
};

export const validateEthereumAddress = (address) => {
  if (!address) {
    return 'Address is required';
  }
  
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return 'Invalid Ethereum address';
  }
  
  return null;
}; 