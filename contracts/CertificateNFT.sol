// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract CertificateNFT is ERC721URIStorage, ERC721Enumerable, Ownable, AccessControl {
    // Replace Counters with a simple uint256
    uint256 private _tokenIds;

    bytes32 public constant INSTITUTION_ROLE = keccak256("INSTITUTION_ROLE");
    bytes32 public constant INSTRUCTOR_ROLE = keccak256("INSTRUCTOR_ROLE");

    struct AcademicCertificate {
        address studentAddress;      // Student's wallet
        address institutionAddress;  // Institution's wallet
        uint256 courseId;           // Unique course identifier
        uint256 completionDate;     // Completion timestamp
        uint256 grade;              // Numerical grade
        bool isVerified;            // Verification status
        string certificateHash;     // Hash of full certificate data
        bool isRevoked;             // Revocation status
        string revocationReason;    // Reason for revocation if revoked
        uint256 version;            // Certificate version number
        uint256 lastUpdateDate;     // Last update timestamp
        string updateReason;        // Reason for update
    }

    // Essential mappings
    mapping(uint256 => AcademicCertificate) public academicCertificates;
    mapping(address => bool) public authorizedInstitutions;
    mapping(uint256 => bool) public verifiedCertificates;
    mapping(uint256 => string) public courseNames;  // Course ID to name mapping
    
    // Transfer control
    bool public transferEnabled;   // Global transfer control
    mapping(uint256 => bool) public transferableCertificates;  // Per-certificate transfer control

    // Events
    event CertificateIssued(
        uint256 indexed tokenId,
        address indexed student,
        address indexed institution,
        uint256 courseId,
        uint256 completionDate,
        uint256 grade
    );

    event CertificateVerified(
        uint256 indexed tokenId,
        address indexed verifier
    );

    event CertificateRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        string reason
    );

    event CertificateUpdated(
        uint256 indexed tokenId,
        uint256 newGrade,
        string updateReason
    );

    event InstitutionAuthorized(address indexed institution);
    event InstitutionRevoked(address indexed institution);
    event TransferStatusChanged(bool enabled);
    event CertificateTransferabilityChanged(uint256 indexed tokenId, bool transferable);

    event CourseNameSet(
        uint256 indexed courseId,
        string name
    );

    constructor() ERC721("AcademicCertificate", "ACERT") Ownable(msg.sender) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(INSTITUTION_ROLE, msg.sender);
        transferEnabled = true; // Enable transfers by default
    }

    // Modifiers
    modifier onlyInstitution() {
        require(hasRole(INSTITUTION_ROLE, msg.sender), "Caller is not an institution");
        _;
    }

    modifier onlyInstructor() {
        require(hasRole(INSTRUCTOR_ROLE, msg.sender), "Caller is not an instructor");
        _;
    }

    // Transfer Control Functions
    function setTransferEnabled(bool _enabled) public onlyOwner {
        transferEnabled = _enabled;
        emit TransferStatusChanged(_enabled);
    }

    function setCertificateTransferable(uint256 tokenId, bool _transferable) public onlyInstitution {
        require(tokenExists(tokenId), "Certificate does not exist");
        transferableCertificates[tokenId] = _transferable;
        emit CertificateTransferabilityChanged(tokenId, _transferable);
    }

    // Institution Management
    function authorizeInstitution(address institution) public onlyOwner {
        require(!authorizedInstitutions[institution], "Institution already authorized");
        authorizedInstitutions[institution] = true;
        _grantRole(INSTITUTION_ROLE, institution);
        emit InstitutionAuthorized(institution);
    }

    function revokeInstitution(address institution) public onlyOwner {
        require(authorizedInstitutions[institution], "Institution not authorized");
        authorizedInstitutions[institution] = false;
        _revokeRole(INSTITUTION_ROLE, institution);
        emit InstitutionRevoked(institution);
    }

    // Certificate Management
    function issueCertificate(
        address student,
        uint256 courseId,
        uint256 grade,
        string memory certificateHash
    ) public onlyInstitution returns (uint256) {
        require(student != address(0), "Invalid student address");
        require(bytes(certificateHash).length > 0, "Invalid certificate hash");
        require(courseId > 0, "Invalid course ID");

        _tokenIds += 1;
        uint256 newTokenId = _tokenIds;

        _mint(student, newTokenId);

        academicCertificates[newTokenId] = AcademicCertificate({
            studentAddress: student,
            institutionAddress: msg.sender,
            courseId: courseId,
            completionDate: block.timestamp,
            grade: grade,
            isVerified: false,
            certificateHash: certificateHash,
            isRevoked: false,
            revocationReason: "",
            version: 1,
            lastUpdateDate: block.timestamp,
            updateReason: "Initial issuance"
        });

        // Set initial transferability
        transferableCertificates[newTokenId] = true;

        emit CertificateIssued(
            newTokenId,
            student,
            msg.sender,
            courseId,
            block.timestamp,
            grade
        );

        return newTokenId;
    }

    function verifyCertificate(uint256 tokenId) public onlyInstitution {
        require(tokenExists(tokenId), "Certificate does not exist");
        require(!academicCertificates[tokenId].isRevoked, "Certificate is revoked");
        require(!academicCertificates[tokenId].isVerified, "Certificate already verified");

        academicCertificates[tokenId].isVerified = true;
        verifiedCertificates[tokenId] = true;

        emit CertificateVerified(tokenId, msg.sender);
    }

    function revokeCertificate(uint256 tokenId, string memory reason) public onlyInstitution {
        require(tokenExists(tokenId), "Certificate does not exist");
        require(!academicCertificates[tokenId].isRevoked, "Certificate already revoked");

        academicCertificates[tokenId].isRevoked = true;
        academicCertificates[tokenId].revocationReason = reason;
        academicCertificates[tokenId].version += 1;
        academicCertificates[tokenId].lastUpdateDate = block.timestamp;
        academicCertificates[tokenId].updateReason = "Certificate revoked";

        emit CertificateRevoked(tokenId, msg.sender, reason);
    }

    function updateCertificate(
        uint256 tokenId,
        uint256 newGrade,
        string memory updateReason
    ) public onlyInstitution {
        require(tokenExists(tokenId), "Certificate does not exist");
        require(!academicCertificates[tokenId].isRevoked, "Certificate is revoked");
        
        AcademicCertificate storage cert = academicCertificates[tokenId];
        cert.grade = newGrade;
        cert.version += 1;
        cert.lastUpdateDate = block.timestamp;
        cert.updateReason = updateReason;
        
        emit CertificateUpdated(tokenId, newGrade, updateReason);
    }

    // View Functions
    function getCertificate(uint256 tokenId) public view returns (
        address student,
        address institution,
        uint256 courseId,
        uint256 completionDate,
        uint256 grade,
        bool isVerified,
        bool isRevoked,
        string memory revocationReason,
        uint256 version,
        uint256 lastUpdateDate,
        string memory updateReason
    ) {
        require(tokenExists(tokenId), "Certificate does not exist");
        AcademicCertificate memory cert = academicCertificates[tokenId];
        return (
            cert.studentAddress,
            cert.institutionAddress,
            cert.courseId,
            cert.completionDate,
            cert.grade,
            cert.isVerified,
            cert.isRevoked,
            cert.revocationReason,
            cert.version,
            cert.lastUpdateDate,
            cert.updateReason
        );
    }

    // Helper function to check if a token exists
    function tokenExists(uint256 tokenId) public view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }

    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        // Only check transfer restrictions if this is not a minting operation
        if (_ownerOf(tokenId) != address(0)) {
            require(transferEnabled, "Transfers are disabled");
            require(transferableCertificates[tokenId], "Certificate is not transferable");
            
            // Update the student address when transferring
            academicCertificates[tokenId].studentAddress = to;
        }
        
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage, ERC721Enumerable, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // Course Management
    function setCourseName(uint256 courseId, string memory name) public onlyInstitution {
        require(courseId > 0, "Invalid course ID");
        require(bytes(name).length > 0, "Course name cannot be empty");
        courseNames[courseId] = name;
        emit CourseNameSet(courseId, name);
    }

    function getCourseName(uint256 courseId) public view returns (string memory) {
        return courseNames[courseId];
    }
} 