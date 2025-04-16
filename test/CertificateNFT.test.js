const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-network-helpers");

async function deployCertificateNFTFixture() {
  const [owner, institution, student, instructor, unauthorized, otherAccount] = await ethers.getSigners();
  
  const CertificateNFT = await ethers.getContractFactory("CertificateNFT");
  const certificateNFT = await CertificateNFT.deploy();
  await certificateNFT.waitForDeployment();

  // Setup roles
  await certificateNFT.authorizeInstitution(institution.address);
  await certificateNFT.grantRole(await certificateNFT.INSTRUCTOR_ROLE(), instructor.address);

  return { certificateNFT, owner, institution, student, instructor, unauthorized, otherAccount };
}

describe("CertificateNFT", function () {
  let CertificateNFT;
  let certificateNFT;
  let owner;
  let institution;
  let student;
  let instructor;
  let unauthorized;
  let newOwner;

  beforeEach(async function () {
    [owner, institution, student, instructor, unauthorized, newOwner] = await ethers.getSigners();
    CertificateNFT = await ethers.getContractFactory("CertificateNFT");
    certificateNFT = await CertificateNFT.deploy();
    await certificateNFT.waitForDeployment();

    // Setup roles
    await certificateNFT.authorizeInstitution(institution.address);
    await certificateNFT.grantRole(await certificateNFT.INSTRUCTOR_ROLE(), instructor.address);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await certificateNFT.owner()).to.equal(owner.address);
    });

    it("Should have the correct name and symbol", async function () {
      expect(await certificateNFT.name()).to.equal("AcademicCertificate");
      expect(await certificateNFT.symbol()).to.equal("ACERT");
    });

    it("Should have transfers enabled by default", async function () {
      expect(await certificateNFT.transferEnabled()).to.be.true;
    });

    it("Should set up initial roles correctly", async function () {
      expect(await certificateNFT.hasRole(await certificateNFT.DEFAULT_ADMIN_ROLE(), owner.address)).to.be.true;
      expect(await certificateNFT.hasRole(await certificateNFT.INSTITUTION_ROLE(), institution.address)).to.be.true;
      expect(await certificateNFT.hasRole(await certificateNFT.INSTRUCTOR_ROLE(), instructor.address)).to.be.true;
    });
  });

  describe("Institution Management", function () {
    it("Should authorize institution correctly", async function () {
      const newInstitution = (await ethers.getSigners())[4];
      await expect(certificateNFT.authorizeInstitution(newInstitution.address))
        .to.emit(certificateNFT, "InstitutionAuthorized")
        .withArgs(newInstitution.address);
      
      expect(await certificateNFT.authorizedInstitutions(newInstitution.address)).to.be.true;
    });

    it("Should not allow unauthorized address to authorize institutions", async function () {
      const newInstitution = (await ethers.getSigners())[4];
      await expect(
        certificateNFT.connect(student).authorizeInstitution(newInstitution.address)
      ).to.be.revertedWithCustomError(certificateNFT, "OwnableUnauthorizedAccount")
        .withArgs(student.address);
    });

    it("Should not allow authorizing an already authorized institution", async function () {
      const newInstitution = (await ethers.getSigners())[4];
      await certificateNFT.authorizeInstitution(newInstitution.address);
      await expect(
        certificateNFT.authorizeInstitution(newInstitution.address)
      ).to.be.revertedWith("Institution already authorized");
    });

    it("Should revoke institution correctly", async function () {
      const newInstitution = (await ethers.getSigners())[4];
      await certificateNFT.authorizeInstitution(newInstitution.address);
      await expect(certificateNFT.revokeInstitution(newInstitution.address))
        .to.emit(certificateNFT, "InstitutionRevoked")
        .withArgs(newInstitution.address);
      
      expect(await certificateNFT.authorizedInstitutions(newInstitution.address)).to.be.false;
    });

    it("Should not allow revoking an unauthorized institution", async function () {
      const newInstitution = (await ethers.getSigners())[4];
      await expect(
        certificateNFT.revokeInstitution(newInstitution.address)
      ).to.be.revertedWith("Institution not authorized");
    });
  });

  describe("Certificate Issuance", function () {
    it("Should issue a certificate with correct data", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate and get the transaction
      const tx = await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Wait for transaction to be mined to get the actual timestamp
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);
      const actualTimestamp = block.timestamp;
      
      // Verify the event was emitted with the correct data
      await expect(tx)
        .to.emit(certificateNFT, "CertificateIssued")
        .withArgs(1, student.address, institution.address, courseId, actualTimestamp, grade);

      const cert = await certificateNFT.getCertificate(1);
      expect(cert.student).to.equal(student.address);
      expect(cert.institution).to.equal(institution.address);
      expect(cert.courseId).to.equal(courseId);
      expect(cert.grade).to.equal(grade);
      expect(cert.version).to.equal(1);
      expect(cert.isVerified).to.be.false;
      expect(cert.isRevoked).to.be.false;
    });

    it("Should not allow unauthorized address to issue certificates", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      await expect(
        certificateNFT.connect(student).issueCertificate(
          student.address,
          courseId,
          grade,
          certificateHash
        )
      ).to.be.revertedWith("Caller is not an institution");
    });

    it("Should not allow issuing certificate to zero address", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      await expect(
        certificateNFT.connect(institution).issueCertificate(
          ethers.ZeroAddress,
          courseId,
          grade,
          certificateHash
        )
      ).to.be.revertedWith("Invalid student address");
    });

    it("Should not allow issuing certificate with empty hash", async function () {
      const courseId = 1;
      const grade = 85;
      
      await expect(
        certificateNFT.connect(institution).issueCertificate(
          student.address,
          courseId,
          grade,
          ""
        )
      ).to.be.revertedWith("Invalid certificate hash");
    });

    it("Should not allow issuing certificate with invalid course ID", async function () {
      const courseId = 0;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      await expect(
        certificateNFT.connect(institution).issueCertificate(
          student.address,
          courseId,
          grade,
          certificateHash
        )
      ).to.be.revertedWith("Invalid course ID");
    });

    it("Should set initial transferability", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );

      expect(await certificateNFT.transferableCertificates(1)).to.be.true;
    });

    it("Should increment token IDs correctly", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue first certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Issue second certificate
      await certificateNFT.connect(institution).issueCertificate(
        instructor.address,
        courseId,
        grade,
        certificateHash
      );
      
      expect(await certificateNFT.ownerOf(1)).to.equal(student.address);
      expect(await certificateNFT.ownerOf(2)).to.equal(instructor.address);
    });
  });

  describe("Certificate Verification", function () {
    beforeEach(async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
    });

    it("Should verify certificate correctly", async function () {
      await expect(certificateNFT.connect(institution).verifyCertificate(1))
        .to.emit(certificateNFT, "CertificateVerified")
        .withArgs(1, institution.address);

      const cert = await certificateNFT.getCertificate(1);
      expect(cert.isVerified).to.be.true;
      expect(await certificateNFT.verifiedCertificates(1)).to.be.true;
    });

    it("Should not allow unauthorized address to verify certificates", async function () {
      await expect(
        certificateNFT.connect(unauthorized).verifyCertificate(1)
      ).to.be.revertedWith("Caller is not an institution");
    });

    it("Should not allow verification of non-existent certificate", async function () {
      await expect(
        certificateNFT.connect(institution).verifyCertificate(999)
      ).to.be.revertedWith("Certificate does not exist");
    });

    it("Should not allow verification of revoked certificate", async function () {
      await certificateNFT.connect(institution).revokeCertificate(1, "Test revocation");
      await expect(
        certificateNFT.connect(institution).verifyCertificate(1)
      ).to.be.revertedWith("Certificate is revoked");
    });

    it("Should not allow verification of already verified certificate", async function () {
      await certificateNFT.connect(institution).verifyCertificate(1);
      await expect(
        certificateNFT.connect(institution).verifyCertificate(1)
      ).to.be.revertedWith("Certificate already verified");
    });
  });

  describe("Certificate Updates", function () {
    beforeEach(async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
    });

    it("Should update certificate grade correctly", async function () {
      const newGrade = 90;
      const updateReason = "Grade correction";
      
      await expect(certificateNFT.connect(institution).updateCertificate(1, newGrade, updateReason))
        .to.emit(certificateNFT, "CertificateUpdated")
        .withArgs(1, newGrade, updateReason);

      const cert = await certificateNFT.getCertificate(1);
      expect(cert.grade).to.equal(newGrade);
      expect(cert.version).to.equal(2);
      expect(cert.updateReason).to.equal(updateReason);
      expect(cert.lastUpdateDate).to.be.gt(0);
    });

    it("Should not allow unauthorized address to update certificates", async function () {
      await expect(
        certificateNFT.connect(unauthorized).updateCertificate(1, 90, "Update attempt")
      ).to.be.revertedWith("Caller is not an institution");
    });

    it("Should not allow updates to non-existent certificate", async function () {
      await expect(
        certificateNFT.connect(institution).updateCertificate(999, 90, "Update attempt")
      ).to.be.revertedWith("Certificate does not exist");
    });

    it("Should not allow updates to revoked certificate", async function () {
      await certificateNFT.connect(institution).revokeCertificate(1, "Test revocation");
      await expect(
        certificateNFT.connect(institution).updateCertificate(1, 90, "Update attempt")
      ).to.be.revertedWith("Certificate is revoked");
    });
  });

  describe("Transfer Control", function () {
    beforeEach(async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
    });

    it("Should allow transfer when enabled", async function () {
      const newOwner = (await ethers.getSigners())[5];
      await certificateNFT.connect(student).transferFrom(student.address, newOwner.address, 1);
      expect(await certificateNFT.ownerOf(1)).to.equal(newOwner.address);
    });

    it("Should prevent transfer when disabled globally", async function () {
      await certificateNFT.setTransferEnabled(false);
      const newOwner = (await ethers.getSigners())[5];
      await expect(
        certificateNFT.connect(student).transferFrom(student.address, newOwner.address, 1)
      ).to.be.revertedWith("Transfers are disabled");
    });

    it("Should prevent transfer when certificate is not transferable", async function () {
      await certificateNFT.connect(institution).setCertificateTransferable(1, false);
      const newOwner = (await ethers.getSigners())[5];
      await expect(
        certificateNFT.connect(student).transferFrom(student.address, newOwner.address, 1)
      ).to.be.revertedWith("Certificate is not transferable");
    });

    it("Should allow setting certificate transferability by institution", async function () {
      await expect(certificateNFT.connect(institution).setCertificateTransferable(1, false))
        .to.emit(certificateNFT, "CertificateTransferabilityChanged")
        .withArgs(1, false);
      
      expect(await certificateNFT.transferableCertificates(1)).to.be.false;
    });

    it("Should not allow setting certificate transferability by unauthorized address", async function () {
      await expect(
        certificateNFT.connect(unauthorized).setCertificateTransferable(1, false)
      ).to.be.revertedWith("Caller is not an institution");
    });

    it("Should not allow setting transferability of non-existent certificate", async function () {
      await expect(
        certificateNFT.connect(institution).setCertificateTransferable(999, false)
      ).to.be.revertedWith("Certificate does not exist");
    });

    it("Should allow enabling/disabling global transfers by owner", async function () {
      await expect(certificateNFT.setTransferEnabled(false))
        .to.emit(certificateNFT, "TransferStatusChanged")
        .withArgs(false);
      
      expect(await certificateNFT.transferEnabled()).to.be.false;
      
      await expect(certificateNFT.setTransferEnabled(true))
        .to.emit(certificateNFT, "TransferStatusChanged")
        .withArgs(true);
      
      expect(await certificateNFT.transferEnabled()).to.be.true;
    });

    it("Should not allow enabling/disabling global transfers by unauthorized address", async function () {
      await expect(
        certificateNFT.connect(unauthorized).setTransferEnabled(false)
      ).to.be.revertedWithCustomError(certificateNFT, "OwnableUnauthorizedAccount")
        .withArgs(unauthorized.address);
    });
  });

  describe("Certificate Revocation", function () {
    beforeEach(async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
    });

    it("Should revoke certificate correctly", async function () {
      const reason = "Academic misconduct";
      await expect(certificateNFT.connect(institution).revokeCertificate(1, reason))
        .to.emit(certificateNFT, "CertificateRevoked")
        .withArgs(1, institution.address, reason);

      const cert = await certificateNFT.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
      expect(cert.revocationReason).to.equal(reason);
      expect(cert.version).to.equal(2);
      expect(cert.updateReason).to.equal("Certificate revoked");
    });

    it("Should not allow unauthorized address to revoke certificates", async function () {
      await expect(
        certificateNFT.connect(unauthorized).revokeCertificate(1, "Revocation attempt")
      ).to.be.revertedWith("Caller is not an institution");
    });

    it("Should not allow revocation of non-existent certificate", async function () {
      await expect(
        certificateNFT.connect(institution).revokeCertificate(999, "Revocation attempt")
      ).to.be.revertedWith("Certificate does not exist");
    });

    it("Should not allow revocation of already revoked certificate", async function () {
      await certificateNFT.connect(institution).revokeCertificate(1, "First revocation");
      await expect(
        certificateNFT.connect(institution).revokeCertificate(1, "Second revocation")
      ).to.be.revertedWith("Certificate already revoked");
    });
  });

  describe("Certificate Queries", function () {
    beforeEach(async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
    });

    it("Should return correct certificate data", async function () {
      const cert = await certificateNFT.getCertificate(1);
      
      // Check returned fields
      expect(cert.student).to.equal(student.address);
      expect(cert.institution).to.equal(institution.address);
      expect(cert.courseId).to.equal(1);
      expect(cert.grade).to.equal(85);
      expect(cert.isVerified).to.be.false;
      expect(cert.isRevoked).to.be.false;
      expect(cert.version).to.equal(1);
    });

    it("Should not allow querying non-existent certificate", async function () {
      await expect(
        certificateNFT.getCertificate(999)
      ).to.be.revertedWith("Certificate does not exist");
    });

    it("Should return correct data after updates", async function () {
      // Update certificate
      await certificateNFT.connect(institution).updateCertificate(1, 90, "Grade correction");
      
      const cert = await certificateNFT.getCertificate(1);
      expect(cert.grade).to.equal(90);
      expect(cert.version).to.equal(2);
      expect(cert.updateReason).to.equal("Grade correction");
    });

    it("Should return correct data after revocation", async function () {
      // Revoke certificate
      await certificateNFT.connect(institution).revokeCertificate(1, "Academic misconduct");
      
      const cert = await certificateNFT.getCertificate(1);
      expect(cert.isRevoked).to.be.true;
      expect(cert.revocationReason).to.equal("Academic misconduct");
      expect(cert.version).to.equal(2);
    });
  });

  describe("Version Control", function () {
    it("Should track certificate versions correctly", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue initial certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Update certificate
      await certificateNFT.connect(institution).updateCertificate(
        1,
        90,
        "Grade correction"
      );
      
      const cert = await certificateNFT.getCertificate(1);
      expect(cert.version).to.equal(2);
      expect(cert.updateReason).to.equal("Grade correction");
    });

    it("Should increment version on revocation", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Revoke certificate
      await certificateNFT.connect(institution).revokeCertificate(1, "Invalid data");
      
      const cert = await certificateNFT.getCertificate(1);
      expect(cert.version).to.equal(2);
      expect(cert.updateReason).to.equal("Certificate revoked");
    });
  });

  describe("Transfer Control", function () {
    it("Should enforce transfer restrictions", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Disable transfer for specific certificate
      await certificateNFT.connect(institution).setCertificateTransferable(1, false);
      
      // Attempt transfer should fail
      await expect(
        certificateNFT.connect(student).transferFrom(student.address, instructor.address, 1)
      ).to.be.revertedWith("Certificate is not transferable");
    });

    it("Should enforce global transfer restrictions", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Disable global transfers
      await certificateNFT.setTransferEnabled(false);
      
      // Attempt transfer should fail
      await expect(
        certificateNFT.connect(student).transferFrom(student.address, instructor.address, 1)
      ).to.be.revertedWith("Transfers are disabled");
    });

    it("Should allow transfer when both global and specific restrictions are enabled", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Ensure both restrictions are enabled
      await certificateNFT.setTransferEnabled(true);
      await certificateNFT.connect(institution).setCertificateTransferable(1, true);
      
      // Transfer should succeed
      await certificateNFT.connect(student).transferFrom(student.address, instructor.address, 1);
      expect(await certificateNFT.ownerOf(1)).to.equal(instructor.address);
    });
  });

  describe("Certificate Updates", function () {
    it("Should update certificate grade and track changes", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Update grade
      const newGrade = 90;
      const updateReason = "Grade correction";
      await certificateNFT.connect(institution).updateCertificate(1, newGrade, updateReason);
      
      const cert = await certificateNFT.getCertificate(1);
      expect(cert.grade).to.equal(newGrade);
      expect(cert.version).to.equal(2);
      expect(cert.updateReason).to.equal(updateReason);
    });

    it("Should not allow updates to revoked certificates", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Revoke certificate
      await certificateNFT.connect(institution).revokeCertificate(1, "Invalid data");
      
      // Attempt update should fail
      await expect(
        certificateNFT.connect(institution).updateCertificate(1, 90, "Grade correction")
      ).to.be.revertedWith("Certificate is revoked");
    });
  });

  describe("Role Management", function () {
    it("Should manage instructor roles correctly", async function () {
      const newInstructor = (await ethers.getSigners())[4];
      
      // Grant instructor role
      await certificateNFT.grantRole(await certificateNFT.INSTRUCTOR_ROLE(), newInstructor.address);
      expect(await certificateNFT.hasRole(await certificateNFT.INSTRUCTOR_ROLE(), newInstructor.address)).to.be.true;
      
      // Revoke instructor role
      await certificateNFT.revokeRole(await certificateNFT.INSTRUCTOR_ROLE(), newInstructor.address);
      expect(await certificateNFT.hasRole(await certificateNFT.INSTRUCTOR_ROLE(), newInstructor.address)).to.be.false;
    });

    it("Should enforce role-based access for certificate operations", async function () {
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      // Issue certificate as institution
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // Attempt update as instructor should fail
      await expect(
        certificateNFT.connect(instructor).updateCertificate(1, 90, "Grade correction")
      ).to.be.revertedWith("Caller is not an institution");
    });
  });

  describe("Integration Tests", function () {
    it("Should handle complete certificate lifecycle", async function () {
      // 1. Issue certificate
      const courseId = 1;
      const grade = 85;
      const certificateHash = "ipfs://QmTestHash";
      
      await certificateNFT.connect(institution).issueCertificate(
        student.address,
        courseId,
        grade,
        certificateHash
      );
      
      // 2. Verify certificate
      await certificateNFT.connect(institution).verifyCertificate(1);
      
      // 3. Update certificate
      await certificateNFT.connect(institution).updateCertificate(1, 90, "Grade correction");
      
      // 4. Transfer certificate
      await certificateNFT.connect(student).transferFrom(student.address, newOwner.address, 1);
      
      // 5. Revoke certificate
      await certificateNFT.connect(institution).revokeCertificate(1, "Academic misconduct");
      
      // Verify final state
      const cert = await certificateNFT.getCertificate(1);
      console.log("Expected newOwner address:", newOwner.address);
      console.log("Actual student address in cert:", cert.student);
      expect(cert.student).to.equal(newOwner.address);
      expect(cert.grade).to.equal(90);
      expect(cert.isVerified).to.be.true;
      expect(cert.isRevoked).to.be.true;
      expect(cert.version).to.equal(3);
    });
  });

  describe("Course Management", function () {
    it("Should allow institution to set course name", async function () {
      const { certificateNFT, institution } = await loadFixture(deployCertificateNFTFixture);
      
      // Set course name
      await certificateNFT.connect(institution).setCourseName(1, "Blockchain Development");
      
      // Verify course name
      const courseName = await certificateNFT.getCourseName(1);
      expect(courseName).to.equal("Blockchain Development");
    });

    it("Should not allow non-institution to set course name", async function () {
      const { certificateNFT, otherAccount } = await loadFixture(deployCertificateNFTFixture);
      
      // Attempt to set course name
      await expect(
        certificateNFT.connect(otherAccount).setCourseName(1, "Blockchain Development")
      ).to.be.revertedWith("Caller is not an institution");
    });

    it("Should not allow empty course name", async function () {
      const { certificateNFT, institution } = await loadFixture(deployCertificateNFTFixture);
      
      // Attempt to set empty course name
      await expect(
        certificateNFT.connect(institution).setCourseName(1, "")
      ).to.be.revertedWith("Course name cannot be empty");
    });

    it("Should not allow zero course ID", async function () {
      const { certificateNFT, institution } = await loadFixture(deployCertificateNFTFixture);
      
      // Attempt to set course name with ID 0
      await expect(
        certificateNFT.connect(institution).setCourseName(0, "Blockchain Development")
      ).to.be.revertedWith("Invalid course ID");
    });

    it("Should allow updating existing course name", async function () {
      const { certificateNFT, institution } = await loadFixture(deployCertificateNFTFixture);
      
      // Set initial course name
      await certificateNFT.connect(institution).setCourseName(1, "Blockchain Development");
      
      // Update course name
      await certificateNFT.connect(institution).setCourseName(1, "Advanced Blockchain Development");
      
      // Verify updated course name
      const courseName = await certificateNFT.getCourseName(1);
      expect(courseName).to.equal("Advanced Blockchain Development");
    });

    it("Should return empty string for non-existent course", async function () {
      const { certificateNFT } = await loadFixture(deployCertificateNFTFixture);
      
      // Get non-existent course name
      const courseName = await certificateNFT.getCourseName(999);
      expect(courseName).to.equal("");
    });

    it("Should allow anyone to read course names", async function () {
      const { certificateNFT, institution, otherAccount } = await loadFixture(deployCertificateNFTFixture);
      
      // Set course name
      await certificateNFT.connect(institution).setCourseName(1, "Blockchain Development");
      
      // Read course name from different account
      const courseName = await certificateNFT.connect(otherAccount).getCourseName(1);
      expect(courseName).to.equal("Blockchain Development");
    });
  });
}); 