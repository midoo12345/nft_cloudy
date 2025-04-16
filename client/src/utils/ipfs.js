import PINATA_CONFIG from '../config/pinata';

/**
 * Helper function to generate a custom file name
 * @param {string} courseId - The course ID
 * @param {string} studentAddress - The student's address
 * @param {string} fileType - The type of file (e.g., 'cert' or 'meta')
 * @returns {string} - Custom formatted file name
 */
const generateCustomFileName = (courseId, studentAddress, fileType) => {
  // Use the correct file extension based on the fileType
  const extension = fileType === 'meta' ? 'json' : 'png';
  // Truncate student address to first 8 characters
  const shortAddress = studentAddress.substring(0, 8);
  // No timestamp for cleaner filenames
  return `${courseId}-${shortAddress}-${fileType}.${extension}`;
};

/**
 * Upload a file to IPFS using Pinata's API
 * @param {File|Blob} file - The file to upload
 * @param {Function} onProgress - Progress callback
 * @param {string} courseId - The course ID for file naming
 * @param {string} studentAddress - The student's address for file naming
 * @param {string} fileType - The type of file (e.g., 'cert' for certificate, 'meta' for metadata)
 * @param {string} groupId - Optional group ID to associate the file with
 * @returns {Promise<string>} - CID of the uploaded file
 */
export const uploadToIPFS = async (file, onProgress = () => {}, courseId, studentAddress, fileType, groupId = null) => {
  try {
    console.log(`Uploading file to IPFS via Pinata: ${file.name || 'unnamed file'}`);
    
    // Generate the custom file name
    const customFileName = generateCustomFileName(courseId, studentAddress, fileType);

    // Start progress simulation
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 0.1;
      if (progress < 0.9) {
        onProgress(progress);
      } else {
        clearInterval(progressInterval);
      }
    }, 500);

    // Create form data
    const formData = new FormData();
    formData.append('file', file, customFileName);  // Use custom file name
    
    // Enhanced metadata with course and group information 
    // Include more fields to ensure grouping works
    const metadata = JSON.stringify({
      name: customFileName,
      keyvalues: {
        courseId: courseId,
        studentAddress: studentAddress.substring(0, 8),
        fileType: fileType,
        timestamp: new Date().toISOString(),
        // Store the groupId directly in metadata for easier filtering
        groupId: groupId || courseId,
        courseGroup: groupId || courseId,  // Additional field for redundancy
        belongsToGroup: "true" // Explicit flag for filtering
      }
    });
    formData.append('pinataMetadata', metadata);
    
    // Basic pinata options
    const options = JSON.stringify({
      cidVersion: 1
    });
    formData.append('pinataOptions', options);
    
    // Try the browser-based upload to Pinata with JWT
    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
      },
      body: formData
    });
    
    // Clear the progress interval
    clearInterval(progressInterval);
    
    if (!response.ok) {
      const errorData = await response.text();
      console.error('Pinata API error response:', errorData);
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    const cid = data.IpfsHash;
    
    console.log(`File uploaded to IPFS with CID: ${cid} (metadata already contains group info)`);
    
    // Only attempt to add to group if the CID isn't found in our first attempt
    // Make an attempt to add the file to the group using API calls
    try {
      // Instead of trying all methods, we'll just update the metadata directly
      // This is more likely to succeed and is consistent with our approach
      const updateResponse = await fetch('https://api.pinata.cloud/pinning/hashMetadata', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        },
        body: JSON.stringify({
          ipfsPinHash: cid,
          name: customFileName,
          keyvalues: {
            courseId: courseId,
            studentAddress: studentAddress.substring(0, 8),
            fileType: fileType,
            timestamp: new Date().toISOString(),
            groupId: groupId || courseId,
            courseGroup: groupId || courseId,
            belongsToGroup: "true"
          }
        })
      });
      
      if (updateResponse.ok) {
        console.log(`Successfully reinforced file metadata with group info`);
      }
    } catch (metadataError) {
      console.warn(`Metadata update error (non-critical): ${metadataError.message}`);
      // Non-critical error - the file was already uploaded with metadata
    }
    
    onProgress(1.0);
    return cid;
  } catch (error) {
    console.error("Error uploading to IPFS via Pinata:", error);
    
    // If Pinata fails, try using the IPFS HTTP client or another service as fallback
    try {
      console.log("Pinata upload failed, trying fallback method...");
      
      // Start progress simulation again
      let progress = 0;
      const progressInterval = setInterval(() => {
        progress += 0.1;
        if (progress < 0.9) {
          onProgress(progress);
        } else {
          clearInterval(progressInterval);
        }
      }, 300);
      
      // Re-generate the custom file name for the fallback method
      const customFileName = generateCustomFileName(courseId, studentAddress, fileType);
      
      // Create form data for NFT.Storage as fallback
      const formData = new FormData();
      formData.append('file', file, customFileName);  // Use custom file name for fallback upload
      
      // Using NFT.Storage as a fallback
      const NFT_STORAGE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6ZXRocjoweDM0MTczM2Q0NzQ0MTcxYkEwN0M3N0ZmQTVBZjBCQTgzOTU2MEJFODQiLCJpc3MiOiJuZnQtc3RvcmFnZSIsImlhdCI6MTY4NzI4MDQzNTQxNiwibmFtZSI6IkJsb2NrRXNjcm93M0QifQ.EBEYiS20I5EpcTtv1Y_xJhkWFPNbhROA7d6HZyoNyvs';
      
      const fallbackResponse = await fetch('https://api.nft.storage/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NFT_STORAGE_KEY}`
        },
        body: formData
      });
      
      clearInterval(progressInterval);
      
      if (!fallbackResponse.ok) {
        throw new Error(`Fallback HTTP error: ${fallbackResponse.status}`);
      }
      
      const fallbackData = await fallbackResponse.json();
      const fallbackCid = fallbackData.value.cid;
      
      console.log(`File uploaded to IPFS with fallback service. CID: ${fallbackCid}`);
      onProgress(1.0);
      return fallbackCid;
    } catch (fallbackError) {
      console.error("Fallback upload also failed:", fallbackError);
      throw new Error(`All IPFS upload methods failed. Original error: ${error.message}`);
    }
  }
};

/**
 * Upload JSON metadata to IPFS
 * @param {Object} data - The metadata object
 * @param {Function} onProgress - Progress callback
 * @param {string} courseId - The course ID for file naming
 * @param {string} studentAddress - The student's address for file naming
 * @param {string} groupId - Optional group ID to associate the metadata with
 * @returns {Promise<string>} - CID of the uploaded metadata
 */
export const uploadJSONToIPFS = async (data, onProgress = () => {}, courseId, studentAddress, groupId = null) => {
  try {
    console.log('Uploading JSON metadata to IPFS via Pinata');
    
    // Generate the custom file name for metadata
    const customFileName = generateCustomFileName(courseId, studentAddress, 'meta');

    // Start progress simulation
    let progress = 0;
    const progressInterval = setInterval(() => {
      progress += 0.1;
      if (progress < 0.9) {
        onProgress(progress);
      } else {
        clearInterval(progressInterval);
      }
    }, 500);
    
    // Convert to JSON string
    const jsonString = JSON.stringify(data);
    
    // Method 1: Try direct JSON upload to Pinata with group info included in metadata
    try {
      // Enhanced metadata with course and group information
      const pinataMetadata = {
        name: customFileName,
        keyvalues: {
          courseId: courseId,
          studentAddress: studentAddress.substring(0, 8),
          fileType: 'metadata',
          timestamp: new Date().toISOString(),
          // Store the groupId directly in metadata for easier filtering
          groupId: groupId || courseId,
          courseGroup: groupId || courseId,  // Additional field for redundancy
          belongsToGroup: "true" // Explicit flag for filtering
        }
      };
      
      // Basic pinata options
      const pinataOptions = {
        cidVersion: 1
      };
      
      // Include the groupId in the content itself
      const enhancedData = {
        ...data,
        _pinataMetadata: {
          groupId: groupId || courseId,
          courseId: courseId,
          timestamp: new Date().toISOString()
        }
      };
      
      const requestBody = {
        pinataContent: enhancedData,
        pinataMetadata: pinataMetadata,
        pinataOptions: pinataOptions
      };
      
      const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        },
        body: JSON.stringify(requestBody)
      });
      
      clearInterval(progressInterval);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Pinata JSON upload error:', errorText);
        throw new Error('Failed to upload JSON to Pinata');
      }
      
      const responseData = await response.json();
      const cid = responseData.IpfsHash;
      
      console.log(`JSON uploaded to IPFS with CID: ${cid} (metadata already contains group info)`);
      
      // No need to try adding to group again - the metadata already contains the group info
      // This avoids the timing issue where the file might not be found immediately after upload
      
      onProgress(1.0);
      return cid;
    } catch (jsonError) {
      console.warn("Direct JSON upload failed, trying file method:", jsonError);
      
      // Method 2: Convert to file and upload
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], customFileName, { type: 'application/json' });
      
      return await uploadToIPFS(file, onProgress, courseId, studentAddress, 'meta', groupId);
    }
  } catch (error) {
    console.error("Error uploading JSON to IPFS:", error);
    throw new Error(`IPFS JSON upload failed: ${error.message}`);
  }
};

/**
 * Creates a new Pinata group for a course if it doesn't exist
 * @param {string} courseId - The course ID  
 * @param {string} courseName - The name of the course
 * @returns {Promise<string>} - Group ID for the course
 */
export const createOrGetCourseGroup = async (courseId, courseName) => {
  try {
    // Create a simple and consistent group name for this course
    const groupName = `Course-${courseId}-${courseName.replace(/\s+/g, '-')}`;
    
    console.log(`Setting up course group: ${groupName}`);
    
    // Generate a deterministic ID for this course as fallback
    const courseGroupId = `course-${courseId}-${courseName.substring(0, 20).replace(/\s+/g, '-').toLowerCase()}`;
    
    // First attempt: Try the v3 API for groups
    try {
      // Try listing groups to see if our group already exists
      const listGroupsResponse = await fetch('https://api.pinata.cloud/data/pinList?metadata[name]=Course', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        }
      });
      
      if (listGroupsResponse.ok) {
        const groupData = await listGroupsResponse.json();
        const existingGroupFile = groupData.rows?.find(file => 
          file.metadata?.name === `${groupName}-marker` || 
          file.metadata?.name?.includes(groupName)
        );
        
        if (existingGroupFile) {
          console.log(`Found existing group marker for ${groupName}`);
          // Use either the stored groupId or the file hash as the group identifier
          const groupId = existingGroupFile.metadata?.keyvalues?.groupId || existingGroupFile.ipfs_pin_hash;
          return groupId;
        }
      }
      
      // If we couldn't find an existing group, create a new one using the legacy API
      console.log(`Creating new group marker for ${groupName}`);
      
      // Create a group marker file in Pinata
      const createMarkerResponse = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        },
        body: JSON.stringify({
          pinataContent: {
            type: "course-group",
            courseId: courseId,
            courseName: courseName,
            created: new Date().toISOString()
          },
          pinataMetadata: {
            name: `${groupName}-marker`,
            keyvalues: {
              type: "course-group",
              courseId: courseId,
              groupId: courseGroupId,
              isGroupMarker: "true"
            }
          }
        })
      });
      
      if (createMarkerResponse.ok) {
        const data = await createMarkerResponse.json();
        console.log(`Created course group marker in Pinata with CID: ${data.IpfsHash}`);
        return courseGroupId;
      }
    } catch (apiError) {
      console.warn(`Error with Pinata API: ${apiError.message}`);
    }
    
    // Second attempt: Try using the legacy API to create a pinning group
    try {
      console.log(`Attempting to create pinning group with legacy API: ${groupName}`);
      const legacyResponse = await fetch('https://api.pinata.cloud/pinning/createPinGroup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        },
        body: JSON.stringify({
          name: groupName
        })
      });
      
      if (legacyResponse.ok) {
        const legacyData = await legacyResponse.json();
        console.log(`Created pinning group with Pinata legacy API: ${legacyData.id}`);
        return legacyData.id;
      } else {
        const errorText = await legacyResponse.text();
        console.error(`Failed to create group with legacy API: ${errorText}`);
      }
    } catch (legacyError) {
      console.warn(`Error with Pinata legacy API: ${legacyError.message}`);
    }
    
    // If neither API worked, return our consistent ID
    console.log(`Using fallback method for group tracking: ${courseGroupId}`);
    return courseGroupId;
  } catch (error) {
    console.error("Error creating/getting course group:", error);
    return `course-${courseId}`;
  }
};

/**
 * Adds an existing file to a Pinata group
 * @param {string} cid - The CID of the file to add to the group
 * @param {string} groupId - The ID of the group to add the file to
 * @returns {Promise<boolean>} - True if successful
 */
export const addFileToGroup = async (cid, groupId) => {
  try {
    console.log(`Attempting to add file ${cid} to group ${groupId}`);
    let success = false;
    
    // Method 1: Try the pinning API to add to group (legacy)
    try {
      console.log(`Attempting legacy pinning group API...`);
      const legacyResponse = await fetch('https://api.pinata.cloud/pinning/addHashToPinGroup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        },
        body: JSON.stringify({
          hashToPin: cid,
          pinGroupId: groupId
        })
      });
      
      if (legacyResponse.ok) {
        console.log(`Successfully added file to group using legacy pinning API!`);
        success = true;
      } else {
        console.log(`Legacy pinning API failed: ${await legacyResponse.text()}`);
      }
    } catch (legacyError) {
      console.warn(`Error with legacy pinning API: ${legacyError.message}`);
    }
    
    // Method 2: Try the new v3 API if available
    if (!success) {
      try {
        console.log(`Attempting to find file ID first...`);
        // First we need to get the file's ID using the CID
        const filesResponse = await fetch('https://api.pinata.cloud/data/pinList?status=pinned', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
          }
        });
        
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          const rows = filesData.rows || [];
          const fileObj = rows.find(row => row.ipfs_pin_hash === cid);
          
          if (fileObj) {
            console.log(`Found file ID: ${fileObj.id} for CID: ${cid}`);
            
            // Try the v3 API with the file ID
            try {
              const v3Response = await fetch(`https://api.pinata.cloud/pinning/addPinToGroup`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
                },
                body: JSON.stringify({
                  pinataApiPinCID: cid,
                  pinataApiPinGroupID: groupId
                })
              });
              
              if (v3Response.ok) {
                console.log(`Successfully added file to group using API!`);
                success = true;
              } else {
                console.log(`API failed: ${await v3Response.text()}`);
              }
            } catch (v3Error) {
              console.warn(`Error with v3 API: ${v3Error.message}`);
            }
          } else {
            console.log(`Could not find file with CID: ${cid}`);
          }
        }
      } catch (idError) {
        console.warn(`Error finding file ID: ${idError.message}`);
      }
    }
    
    // Method 3: Update metadata as a fallback
    if (!success) {
      try {
        console.log(`Falling back to metadata update...`);
        const filesResponse = await fetch('https://api.pinata.cloud/data/pinList?status=pinned', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
          }
        });
        
        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          const rows = filesData.rows || [];
          const fileObj = rows.find(row => row.ipfs_pin_hash === cid);
          
          if (fileObj) {
            // Update metadata to include group info
            const updateResponse = await fetch('https://api.pinata.cloud/pinning/hashMetadata', {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
              },
              body: JSON.stringify({
                ipfsPinHash: cid,
                name: fileObj.metadata?.name || `File-${cid.substring(0, 8)}`,
                keyvalues: {
                  ...(fileObj.metadata?.keyvalues || {}),
                  groupId: groupId,
                  courseGroup: groupId
                }
              })
            });
            
            if (updateResponse.ok) {
              console.log(`Successfully updated file metadata with group info`);
              success = true;
            } else {
              console.log(`Metadata update failed: ${await updateResponse.text()}`);
            }
          }
        }
      } catch (metadataError) {
        console.warn(`Error updating metadata: ${metadataError.message}`);
      }
    }
    
    return success;
  } catch (error) {
    console.error(`Error adding file to group: ${error.message}`);
    return false;
  }
};

/**
 * Lists all files in a course group (using metadata filters)
 * @param {string} groupId - The ID of the group to list files from
 * @returns {Promise<Array>} - Array of file objects
 */
export const listCourseFiles = async (groupId) => {
  try {
    console.log(`Fetching files for group ${groupId} using metadata filter`);
    
    // Using multiple metadata fields to ensure we catch all files in the group
    const query = `metadata[keyvalues]={"$or":[` +
      `{"groupId":{"value":"${groupId}","op":"eq"}},` +
      `{"courseGroup":{"value":"${groupId}","op":"eq"}},` +
      `{"courseId":{"value":"${groupId.replace(/^course-/, '')}","op":"eq"}}` +
      `]}`;
    
    // Using standard pinList endpoint with an expanded metadata filter
    const response = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&${query}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
      }
    });

    if (!response.ok) {
      console.error(`Failed to list files in group: ${await response.text()}`);
      return [];
    }

    const data = await response.json();
    const files = data.rows || [];
    console.log(`Found ${files.length} files with group metadata for ${groupId}`);
    return files;
  } catch (error) {
    console.error(`Error listing files in group: ${error.message}`);
    return [];
  }
};

/**
 * Find all certificates for a specific course
 * @param {string} courseId - The course ID to find certificates for
 * @returns {Promise<Array>} - Array of certificate files and metadata
 */
export const getCourseGroupCertificates = async (courseId) => {
  try {
    console.log(`Looking for certificates for course ${courseId}`);
    
    // First, determine if we have a course-* ID or just a number
    const courseGroupId = courseId.startsWith('course-') ? courseId : `course-${courseId}`;
    
    // Try to get all pins with our expanded metadata filter
    const query = `metadata[keyvalues]={"$or":[` +
      `{"groupId":{"value":"${courseGroupId}","op":"eq"}},` +
      `{"courseGroup":{"value":"${courseGroupId}","op":"eq"}},` +
      `{"courseId":{"value":"${courseId}","op":"eq"}}` +
      `]}`;
      
    const groupsResponse = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned&${query}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
      }
    });

    if (!groupsResponse.ok) {
      throw new Error(`Failed to fetch pins: ${groupsResponse.status}`);
    }

    // Get all files that match our course criteria
    const data = await groupsResponse.json();
    const courseFiles = data.rows || [];

    if (courseFiles.length === 0) {
      // Try a fallback approach with a simpler query
      console.log(`No files found with OR query, trying simple filename-based search...`);
      
      const fallbackResponse = await fetch(`https://api.pinata.cloud/data/pinList?status=pinned`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${PINATA_CONFIG.jwt}`
        }
      });
      
      if (fallbackResponse.ok) {
        const fallbackData = await fallbackResponse.json();
        const fallbackRows = fallbackData.rows || [];
        
        // Filter files that belong to this course based on name or metadata
        const filteredFiles = fallbackRows.filter(file => {
          // Check filename
          if (file.metadata?.name && file.metadata.name.includes(`${courseId}-`)) {
            return true;
          }
          
          // Check keyvalues
          if (file.metadata?.keyvalues) {
            return (
              file.metadata.keyvalues.courseId === courseId || 
              file.metadata.keyvalues.groupId === courseGroupId ||
              file.metadata.keyvalues.courseGroup === courseGroupId
            );
          }
          
          return false;
        });
        
        if (filteredFiles.length > 0) {
          console.log(`Found ${filteredFiles.length} files for course ${courseId} using fallback approach`);
          return filteredFiles;
        }
      }
      
      console.log(`No files found for course ${courseId}`);
      return [];
    }

    console.log(`Found ${courseFiles.length} files for course ${courseId}`);
    return courseFiles;
  } catch (error) {
    console.error(`Error getting course certificates: ${error.message}`);
    return [];
  }
};
