// components/Admin/AddEmployee.jsx
import React, { useState, useEffect } from 'react';
import { Form, Button, Card, Row, Col, Alert, Spinner, Tab, Nav, ProgressBar } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import {
  FaSave,
  FaTimes,
  FaUpload,
  FaUserPlus,
  FaFileAlt,
  FaFilePdf,
  FaFileWord,
  FaFileImage,
  FaCalculator,
  FaFileSignature,
  FaCheckSquare,
  FaArrowRight,
  FaArrowLeft,
  FaCheckCircle
} from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';

// Default Contract Policy Template
const DEFAULT_CONTRACT_POLICY = `EMPLOYMENT CONTRACT

This Employment Agreement is made and entered into on this date between the Company and the Employee.

1. POSITION AND DUTIES
The Employee shall serve in the position as designated in the offer letter. The Employee agrees to perform all duties assigned by the Company and comply with all company policies and procedures.

2. COMPENSATION
The Employee shall receive monthly salary as specified in the offer letter, subject to applicable deductions and taxes. Salary shall be paid on the last working day of each month.

3. WORKING HOURS
The standard working hours are 9:00 AM to 6:00 PM, Monday through Friday, with a one-hour lunch break. The Employee may be required to work additional hours as necessary.

4. LEAVE POLICY
The Employee is entitled to annual leave as per company policy. Leave requests must be submitted at least 3 days in advance and approved by the reporting manager.

5. PROBATION PERIOD
The Employee shall undergo a probation period of 6 months from the date of joining. During this period, employment may be terminated by either party with 7 days notice.

6. CONFIDENTIALITY
The Employee shall maintain strict confidentiality of all company information, trade secrets, and client data during and after employment.

7. TERMINATION
Either party may terminate this agreement with 30 days written notice. The Company reserves the right to terminate employment immediately in cases of misconduct.

8. GOVERNING LAW
This agreement shall be governed by and construed in accordance with the laws of India.

By signing below, the Employee acknowledges that they have read, understood, and agree to abide by all terms and conditions stated in this Employment Contract.`;

const AddEmployee = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showNotification } = useNotification();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('personal');
  const [acceptPolicy, setAcceptPolicy] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);
  const [employeeId, setEmployeeId] = useState('');
  
  // Track completed tabs
  const [completedTabs, setCompletedTabs] = useState({
    personal: false,
    bank: false,
    salary: false,
    policy: false,
    documents: false
  });

  // Temporary storage for each tab's data
  const [tempPersonalData, setTempPersonalData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    joining_date: '',
    designation: '',
    department: '',
    reporting_manager: '',
    pan_number: '',
    aadhar_number: '',
    dob: '',
    address: '',
    blood_group: '',
    emergency_contact: '',
    employment_type: 'Full Time',
    shift_timing: '9:00 AM - 6:00 PM'
  });

  const [tempBankData, setTempBankData] = useState({
    bank_account_name: '',
    account_number: '',
    ifsc_code: '',
    branch_name: ''
  });

  const [tempSalaryData, setTempSalaryData] = useState({
    gross_salary: '',
    in_hand_salary: ''
  });

  const [tempPolicyData, setTempPolicyData] = useState({
    contract_policy: ''
  });

  // Document upload states
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedDocTypes, setSelectedDocTypes] = useState([]);

  const documentTypes = [
    { value: 'appointment_letter', label: 'Appointment Letter', icon: <FaFileWord className="text-info" /> },
    { value: 'offer_letter', label: 'Offer Letter', icon: <FaFilePdf className="text-danger" /> },
    { value: 'contract_document', label: 'Contract Document', icon: <FaFileAlt className="text-secondary" /> },
    { value: 'aadhar_card', label: 'Aadhar Card', icon: <FaFileImage className="text-primary" /> },
    { value: 'pan_card', label: 'PAN Card', icon: <FaFileImage className="text-warning" /> },
    { value: 'bank_proof', label: 'Bank Proof', icon: <FaFileAlt className="text-info" /> },
    { value: 'education_certificates', label: 'Education Certificates', icon: <FaFileAlt className="text-success" /> },
    { value: 'experience_certificates', label: 'Experience Certificates', icon: <FaFileAlt className="text-secondary" /> }
  ];

  const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Administration', 'Legal'];
  const employmentTypes = ['Full Time', 'Part Time', 'Freelancer', 'Contract Based', 'Intern', 'Probation'];
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // Set default contract policy when checkbox is checked
  useEffect(() => {
    if (acceptPolicy) {
      setTempPolicyData({
        contract_policy: DEFAULT_CONTRACT_POLICY
      });
    } else {
      setTempPolicyData({
        contract_policy: ''
      });
    }
  }, [acceptPolicy]);

  // Calculate in-hand salary whenever gross salary changes
  useEffect(() => {
    if (tempSalaryData.gross_salary) {
      const gross = parseFloat(tempSalaryData.gross_salary);
      if (!isNaN(gross) && gross > 0) {
        const inHand = gross - 200;
        setTempSalaryData(prev => ({
          ...prev,
          in_hand_salary: inHand.toString()
        }));
      }
    }
  }, [tempSalaryData.gross_salary]);

  // Handle input changes for personal tab
  const handlePersonalChange = (e) => {
    const { name, value } = e.target;
    setTempPersonalData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle input changes for bank tab
  const handleBankChange = (e) => {
    const { name, value } = e.target;
    setTempBankData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle input changes for salary tab
  const handleSalaryChange = (e) => {
    const { name, value } = e.target;
    setTempSalaryData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Validate personal tab
  const validatePersonalTab = () => {
    if (!tempPersonalData.first_name) return "First name is required";
    if (!tempPersonalData.last_name) return "Last name is required";
    if (!tempPersonalData.email) return "Email is required";
    if (!tempPersonalData.joining_date) return "Joining date is required";
    if (!tempPersonalData.designation) return "Designation is required";
    if (!tempPersonalData.department) return "Department is required";
    if (!tempPersonalData.pan_number) return "PAN number is required";
    if (!tempPersonalData.aadhar_number) return "Aadhar number is required";
    if (!tempPersonalData.dob) return "Date of birth is required";
    if (!tempPersonalData.address) return "Address is required";
    if (!tempPersonalData.emergency_contact) return "Emergency contact is required";
    
    if (tempPersonalData.pan_number.length !== 10) {
      return "PAN number must be 10 characters";
    }
    if (!/^\d{12}$/.test(tempPersonalData.aadhar_number)) {
      return "Aadhar number must be 12 digits";
    }
    if (!/^\d{10}$/.test(tempPersonalData.emergency_contact)) {
      return "Emergency contact must be 10 digits";
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(tempPersonalData.email)) {
      return "Please enter a valid email address";
    }
    
    return null;
  };

  // Validate bank tab
  const validateBankTab = () => {
    if (!tempBankData.bank_account_name) return "Bank account name is required";
    if (!tempBankData.account_number) return "Account number is required";
    if (!tempBankData.ifsc_code) return "IFSC code is required";
    if (!tempBankData.branch_name) return "Branch name is required";
    if (tempBankData.ifsc_code.length !== 11) {
      return "IFSC code must be 11 characters";
    }
    return null;
  };

  // Validate salary tab
  const validateSalaryTab = () => {
    if (!tempSalaryData.gross_salary) return "Gross salary is required";
    const gross = parseFloat(tempSalaryData.gross_salary);
    if (gross <= 200) {
      return "Gross salary must be greater than ₹200";
    }
    return null;
  };

  // Save current tab data
  const saveCurrentTab = () => {
    let validationError = null;

    switch(activeTab) {
      case 'personal':
        validationError = validatePersonalTab();
        if (!validationError) {
          setCompletedTabs(prev => ({ ...prev, personal: true }));
          showNotification('Personal information saved!', 'success');
        }
        break;

      case 'bank':
        validationError = validateBankTab();
        if (!validationError) {
          setCompletedTabs(prev => ({ ...prev, bank: true }));
          showNotification('Bank details saved!', 'success');
        }
        break;

      case 'salary':
        validationError = validateSalaryTab();
        if (!validationError) {
          setCompletedTabs(prev => ({ ...prev, salary: true }));
          showNotification('Salary information saved!', 'success');
        }
        break;

      case 'policy':
        if (!acceptPolicy) {
          validationError = "You must accept the contract policy";
        } else {
          setCompletedTabs(prev => ({ ...prev, policy: true }));
          showNotification('Policy accepted!', 'success');
        }
        break;

      default:
        break;
    }

    if (validationError) {
      setError(validationError);
      showNotification(validationError, 'danger');
      return false;
    }
    return true;
  };

  // Handle tab change
  const handleTabChange = (tab) => {
    if (activeTab !== tab) {
      const saved = saveCurrentTab();
      if (saved) {
        setActiveTab(tab);
        setError('');
      }
    }
  };

  // Handle next button
  const handleNext = () => {
    const tabs = ['personal', 'bank', 'salary', 'policy', 'documents'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      const saved = saveCurrentTab();
      if (saved) {
        setActiveTab(tabs[currentIndex + 1]);
        setError('');
      }
    }
  };

  // Handle previous button
  const handlePrevious = () => {
    const tabs = ['personal', 'bank', 'salary', 'policy', 'documents'];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  // Check if all tabs are completed
  const isAllTabsCompleted = () => {
    return completedTabs.personal && completedTabs.bank && 
           completedTabs.salary && completedTabs.policy;
  };

  // Generate employee ID on final submit
// AddEmployee.jsx - Fixed generateEmployeeId function

const generateEmployeeId = async () => {
  if (!tempPersonalData.joining_date) return null;
  
  const date = new Date(tempPersonalData.joining_date);
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  
  try {
    // Get all employees to check existing IDs
    const response = await axios.get('http://localhost:5000/api/employees');
    const employees = response.data;
    
    console.log('Total employees:', employees.length);
    
    // Filter employees with the same year and month prefix
    const prefix = `B2B${year}${month}`;
    const sameMonthEmployees = employees.filter(emp => {
      return emp.employee_id && emp.employee_id.startsWith(prefix);
    });
    
    console.log(`Found ${sameMonthEmployees.length} employees with prefix ${prefix}`);
    
    // Find the highest sequence number
    let maxSeq = 0;
    sameMonthEmployees.forEach(emp => {
      const id = emp.employee_id;
      if (id && id.length === 10) { // B2BYYMMSS format (B2B + YY + MM + SS = 10 chars)
        const seqStr = id.slice(-2); // Last 2 characters
        const seq = parseInt(seqStr, 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    });
    
    console.log('Current max sequence:', maxSeq);
    
    // Generate new sequence
    const newSeq = (maxSeq + 1).toString().padStart(2, '0');
    const newEmployeeId = `${prefix}${newSeq}`;
    
    console.log('Generated new employee ID:', newEmployeeId);
    return newEmployeeId;
    
  } catch (error) {
    console.error('Error generating employee ID:', error);
    
    // Fallback: Use timestamp to ensure uniqueness
    const timestamp = Date.now().toString().slice(-4);
    const randomSeq = Math.floor(1 + Math.random() * 99).toString().padStart(2, '0');
    return `B2B${year}${month}${randomSeq}`;
  }
};

  // ============== FIXED DOCUMENT UPLOAD FUNCTION ==============
  const uploadDocuments = async (empId) => {
    const validUploads = selectedFiles.reduce((acc, file, index) => {
      if (file && selectedDocTypes[index]) {
        acc.push({
          file,
          type: selectedDocTypes[index]
        });
      }
      return acc;
    }, []);

    if (validUploads.length === 0) return;

    setUploading(true);
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validUploads.length; i++) {
      const upload = validUploads[i];
      const formData = new FormData();
      formData.append(upload.type, upload.file);

      try {
        setUploadProgress(Math.round(((i + 1) / validUploads.length) * 100));
        
        // FIXED: Use the correct URL format - employee_id as path parameter, not in query
        const url = `http://localhost:5000/api/employees/${empId}/documents`;
        console.log(`Uploading to: ${url}`);
        console.log(`Document type: ${upload.type}, File:`, upload.file);
        
        const response = await axios.post(url, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        });
        
        console.log('Upload response:', response.data);
        successCount++;
      } catch (error) {
        console.error(`Error uploading ${upload.type}:`, error);
        console.error('Error response:', error.response?.data);
        console.error('Error status:', error.response?.status);
        failCount++;
      }
    }

    if (successCount > 0) {
      showNotification(`${successCount} document(s) uploaded successfully!`, 'success');
    }
    if (failCount > 0) {
      showNotification(`${failCount} document(s) failed to upload`, 'warning');
    }

    setUploading(false);
    setSelectedFiles([]);
    setSelectedDocTypes([]);
    setUploadProgress(0);
  };

  // Test API connection
  const testApiConnection = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/test');
      console.log('API Test:', response.data);
      return true;
    } catch (error) {
      console.error('API Test Failed:', error);
      return false;
    }
  };

  // Final submit handler
// AddEmployee.jsx - Update handleFinalSubmit with retry logic

// Final submit handler
const handleFinalSubmit = async (e) => {
  e.preventDefault();
  
  // Save current tab first
  const saved = saveCurrentTab();
  if (!saved) return;

  // Validate all tabs completed
  if (!isAllTabsCompleted()) {
    const errorMsg = "Please complete all required tabs before submitting";
    setError(errorMsg);
    showNotification(errorMsg, 'danger');
    return;
  }

  setSaving(true);
  setError('');

  try {
    // Test API connection first
    const apiWorks = await testApiConnection();
    if (!apiWorks) {
      throw new Error("Cannot connect to server. Please check if backend is running.");
    }

    // Generate employee ID with retry logic
    let empId = null;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (!empId && retryCount < maxRetries) {
      empId = await generateEmployeeId();
      if (!empId) {
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!empId) {
      throw new Error("Could not generate unique employee ID after multiple attempts");
    }
    
    setEmployeeId(empId);
    console.log('Final Employee ID:', empId);

    // Prepare data for API
    const employeeData = {
      first_name: tempPersonalData.first_name,
      middle_name: tempPersonalData.middle_name || null,
      last_name: tempPersonalData.last_name,
      employee_id: empId,
      email: tempPersonalData.email,
      joining_date: tempPersonalData.joining_date,
      designation: tempPersonalData.designation,
      department: tempPersonalData.department,
      reporting_manager: tempPersonalData.reporting_manager || null,
      employment_type: tempPersonalData.employment_type || 'Full Time',
      shift_timing: tempPersonalData.shift_timing || '9:00 AM - 6:00 PM',
      in_hand_salary: parseFloat(tempSalaryData.in_hand_salary) || 0,
      gross_salary: parseFloat(tempSalaryData.gross_salary) || 0,
      bank_account_name: tempBankData.bank_account_name,
      account_number: tempBankData.account_number,
      ifsc_code: tempBankData.ifsc_code,
      branch_name: tempBankData.branch_name,
      pan_number: tempPersonalData.pan_number,
      aadhar_number: tempPersonalData.aadhar_number,
      dob: tempPersonalData.dob,
      address: tempPersonalData.address,
      blood_group: tempPersonalData.blood_group || null,
      emergency_contact: tempPersonalData.emergency_contact,
      contract_policy: tempPolicyData.contract_policy || null
    };

    console.log('Submitting employee data:', JSON.stringify(employeeData, null, 2));
    setDebugInfo(employeeData);

    // Create employee
    const response = await axios.post('http://localhost:5000/api/employees', employeeData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log('Employee created:', response.data);

    setSuccess('Employee added successfully!');
    showNotification('Employee added successfully!', 'success');

    // Upload documents if any - NOW USING THE CORRECT empId
    if (selectedFiles.length > 0) {
      await uploadDocuments(empId);
    }

    // Navigate back after delay
    setTimeout(() => {
      navigate('/admin/employees');
    }, 2000);

  } catch (error) {
    console.error('Error adding employee:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    
    let errorMsg = 'Failed to add employee';
    
    if (error.response) {
      // Handle duplicate ID error specifically
      if (error.response.status === 400 && error.response.data?.error?.includes('Duplicate')) {
        errorMsg = 'Employee ID already exists. Please try again - a new ID will be generated.';
        // Clear the cached ID so a new one will be generated
        setEmployeeId('');
      } else {
        errorMsg = error.response.data?.message || 
                   error.response.data?.error || 
                   `Server error: ${error.response.status}`;
      }
    } else if (error.request) {
      errorMsg = 'No response from server. Please check if backend is running.';
    } else {
      errorMsg = error.message;
    }
    
    setError(errorMsg);
    showNotification(errorMsg, 'danger');
  } finally {
    setSaving(false);
  }
};

  // Add upload row
  const addUploadRow = () => {
    setSelectedFiles([...selectedFiles, null]);
    setSelectedDocTypes([...selectedDocTypes, '']);
  };

  // Remove upload row
  const removeUploadRow = (index) => {
    const newFiles = [...selectedFiles];
    const newTypes = [...selectedDocTypes];
    newFiles.splice(index, 1);
    newTypes.splice(index, 1);
    setSelectedFiles(newFiles);
    setSelectedDocTypes(newTypes);
  };

  // Handle file selection
  const handleFileSelect = (index, file) => {
    const newFiles = [...selectedFiles];
    newFiles[index] = file;
    setSelectedFiles(newFiles);
  };

  // Handle document type change
  const handleDocumentTypeChange = (index, value) => {
    const newTypes = [...selectedDocTypes];
    newTypes[index] = value;
    setSelectedDocTypes(newTypes);
  };

  return (
    <div className="p-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h5 className="mb-0">
          <FaUserPlus className="me-2 text-primary" size={20} />
          Add New Employee
        </h5>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/admin/employees')}
        >
          <FaTimes className="me-2" size={12} />
          Cancel
        </Button>
      </div>

      {/* Progress Indicators */}
      <div className="mb-4">
        <Row className="g-2">
          <Col md={2}>
            <div className={`p-2 rounded text-center small ${completedTabs.personal ? 'bg-success text-white' : 'bg-light'}`}>
              {completedTabs.personal ? <FaCheckCircle className="me-1" /> : '1.'} Personal
            </div>
          </Col>
          <Col md={2}>
            <div className={`p-2 rounded text-center small ${completedTabs.bank ? 'bg-success text-white' : 'bg-light'}`}>
              {completedTabs.bank ? <FaCheckCircle className="me-1" /> : '2.'} Bank
            </div>
          </Col>
          <Col md={2}>
            <div className={`p-2 rounded text-center small ${completedTabs.salary ? 'bg-success text-white' : 'bg-light'}`}>
              {completedTabs.salary ? <FaCheckCircle className="me-1" /> : '3.'} Salary
            </div>
          </Col>
          <Col md={2}>
            <div className={`p-2 rounded text-center small ${completedTabs.policy ? 'bg-success text-white' : 'bg-light'}`}>
              {completedTabs.policy ? <FaCheckCircle className="me-1" /> : '4.'} Policy
            </div>
          </Col>
          <Col md={2}>
            <div className="p-2 rounded text-center small bg-light">
              5. Documents
            </div>
          </Col>
          <Col md={2}>
            <div className={`p-2 rounded text-center small ${isAllTabsCompleted() ? 'bg-primary text-white' : 'bg-secondary text-white'}`}>
              Final Submit
            </div>
          </Col>
        </Row>
      </div>

      {/* Debug Info - Remove in production */}
      {debugInfo && (
        <Alert variant="info" className="mb-3">
          <details>
            <summary>Debug: Data being sent (Click to expand)</summary>
            <pre className="mt-2 small" style={{ maxHeight: '200px', overflow: 'auto' }}>
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </details>
        </Alert>
      )}

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-3">
          <small>{error}</small>
        </Alert>
      )}

      {success && (
        <Alert variant="success" onClose={() => setSuccess('')} dismissible className="mb-3">
          <small>{success}</small>
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light py-2">
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => handleTabChange(k)}>
            <Nav.Item>
              <Nav.Link eventKey="personal" className="text-dark small">
                Personal Information {completedTabs.personal && <FaCheckCircle className="ms-1 text-success" size={10} />}
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="bank" className="text-dark small">
                Bank Details {completedTabs.bank && <FaCheckCircle className="ms-1 text-success" size={10} />}
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="salary" className="text-dark small">
                Salary Information {completedTabs.salary && <FaCheckCircle className="ms-1 text-success" size={10} />}
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="policy" className="text-dark small">
                Contract Policy {completedTabs.policy && <FaCheckCircle className="ms-1 text-success" size={10} />}
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="documents" className="text-dark small">
                Documents
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>
        <Card.Body className="p-3">
          <Form>
            {activeTab === 'personal' && (
              <>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Email Address <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="email"
                        name="email"
                        value={tempPersonalData.email}
                        onChange={handlePersonalChange}
                        size="sm"
                        placeholder="employee@company.com"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        First Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="first_name"
                        value={tempPersonalData.first_name}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Middle Name
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="middle_name"
                        value={tempPersonalData.middle_name}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Last Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="last_name"
                        value={tempPersonalData.last_name}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Date of Joining <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="joining_date"
                        value={tempPersonalData.joining_date}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Designation <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="designation"
                        value={tempPersonalData.designation}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Department <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Select
                        name="department"
                        value={tempPersonalData.department}
                        onChange={handlePersonalChange}
                        size="sm"
                      >
                        <option value="">Select Department</option>
                        {departments.map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Reporting Manager
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="reporting_manager"
                        value={tempPersonalData.reporting_manager}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Employment Type
                      </Form.Label>
                      <Form.Select
                        name="employment_type"
                        value={tempPersonalData.employment_type}
                        onChange={handlePersonalChange}
                        size="sm"
                      >
                        {employmentTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Shift Timing
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="shift_timing"
                        value={tempPersonalData.shift_timing}
                        onChange={handlePersonalChange}
                        placeholder="e.g., 9:00 AM - 6:00 PM"
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        PAN Number <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="pan_number"
                        value={tempPersonalData.pan_number}
                        onChange={handlePersonalChange}
                        size="sm"
                        maxLength="10"
                        placeholder="ABCDE1234F"
                        style={{ textTransform: 'uppercase' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Aadhar Number <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="aadhar_number"
                        value={tempPersonalData.aadhar_number}
                        onChange={handlePersonalChange}
                        size="sm"
                        maxLength="12"
                        placeholder="123456789012"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Date of Birth <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="dob"
                        value={tempPersonalData.dob}
                        onChange={handlePersonalChange}
                        size="sm"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Blood Group
                      </Form.Label>
                      <Form.Select
                        name="blood_group"
                        value={tempPersonalData.blood_group}
                        onChange={handlePersonalChange}
                        size="sm"
                      >
                        <option value="">Select Blood Group</option>
                        {bloodGroups.map(bg => (
                          <option key={bg} value={bg}>{bg}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Emergency Contact <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="tel"
                        name="emergency_contact"
                        value={tempPersonalData.emergency_contact}
                        onChange={handlePersonalChange}
                        size="sm"
                        maxLength="10"
                        placeholder="10 digit mobile number"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold text-muted">
                    Address <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    name="address"
                    value={tempPersonalData.address}
                    onChange={handlePersonalChange}
                    size="sm"
                    placeholder="Full address"
                  />
                </Form.Group>
              </>
            )}

            {activeTab === 'bank' && (
              <>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Bank Account Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="bank_account_name"
                        value={tempBankData.bank_account_name}
                        onChange={handleBankChange}
                        size="sm"
                        placeholder="Name on bank account"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Account Number <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="account_number"
                        value={tempBankData.account_number}
                        onChange={handleBankChange}
                        size="sm"
                        placeholder="Bank account number"
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row className="mb-3">
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        IFSC Code <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="ifsc_code"
                        value={tempBankData.ifsc_code}
                        onChange={handleBankChange}
                        size="sm"
                        maxLength="11"
                        placeholder="SBIN0001234"
                        style={{ textTransform: 'uppercase' }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Branch Name <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="text"
                        name="branch_name"
                        value={tempBankData.branch_name}
                        onChange={handleBankChange}
                        size="sm"
                        placeholder="Bank branch name"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </>
            )}

            {activeTab === 'salary' && (
              <>
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Gross Salary (₹) <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="number"
                        name="gross_salary"
                        value={tempSalaryData.gross_salary}
                        onChange={handleSalaryChange}
                        size="sm"
                        min="201"
                        step="1000"
                        placeholder="Monthly gross salary"
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        In-hand Salary (₹)
                      </Form.Label>
                      <Form.Control
                        type="number"
                        name="in_hand_salary"
                        value={tempSalaryData.in_hand_salary}
                        readOnly
                        disabled
                        size="sm"
                        className="bg-light fw-bold text-success"
                      />
                      <Form.Text className="text-muted">
                        Auto-calculated (Gross - ₹200 deduction)
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>

                {tempSalaryData.gross_salary && (
                  <div className="mb-3 p-2 bg-light rounded small">
                    <FaCalculator className="me-2 text-primary" size={12} />
                    <strong>Calculation:</strong> ₹{parseFloat(tempSalaryData.gross_salary).toLocaleString()} - ₹200 = ₹{parseFloat(tempSalaryData.in_hand_salary).toLocaleString()}
                  </div>
                )}
              </>
            )}

            {activeTab === 'policy' && (
              <>
                <Card className="mb-4 border-0 bg-light">
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center mb-3">
                      <FaFileSignature className="text-primary me-2" size={20} />
                      <h6 className="small fw-semibold mb-0">Employment Contract Policy</h6>
                    </div>

                    <div 
                      className="bg-white p-3 rounded border mb-3"
                      style={{ 
                        maxHeight: '300px', 
                        overflowY: 'auto',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-line',
                        fontFamily: 'monospace'
                      }}
                    >
                      {DEFAULT_CONTRACT_POLICY}
                    </div>

                    <Form.Group className="mb-3">
                      <Form.Check
                        type="checkbox"
                        id="acceptPolicy"
                        label={
                          <span className="small">
                            <FaCheckSquare className="me-2 text-primary" size={14} />
                            I have read and agree to the terms and conditions of the Employment Contract Policy
                          </span>
                        }
                        checked={acceptPolicy}
                        onChange={(e) => setAcceptPolicy(e.target.checked)}
                      />
                    </Form.Group>
                  </Card.Body>
                </Card>
              </>
            )}

            {activeTab === 'documents' && (
              <div>
                <Card className="mb-4 border-0 bg-light">
                  <Card.Body className="p-3">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <h6 className="small fw-semibold mb-0">Upload Documents</h6>
                      <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={addUploadRow}
                        disabled={uploading}
                      >
                        + Add Another Document
                      </Button>
                    </div>

                    {selectedFiles.map((_, index) => (
                      <Row key={index} className="g-2 mb-2 align-items-center">
                        <Col md={4}>
                          <Form.Select
                            size="sm"
                            value={selectedDocTypes[index] || ''}
                            onChange={(e) => handleDocumentTypeChange(index, e.target.value)}
                            disabled={uploading}
                          >
                            <option value="">Select Document Type</option>
                            {documentTypes.map(doc => (
                              <option key={doc.value} value={doc.value}>
                                {doc.label}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={6}>
                          <Form.Control
                            type="file"
                            onChange={(e) => handleFileSelect(index, e.target.files[0])}
                            size="sm"
                            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                            disabled={uploading}
                          />
                        </Col>
                        <Col md={2}>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => removeUploadRow(index)}
                            disabled={uploading || selectedFiles.length === 1}
                          >
                            Remove
                          </Button>
                        </Col>
                      </Row>
                    ))}

                    {selectedFiles.length === 0 && (
                      <div className="text-center py-3">
                        <p className="text-muted small mb-2">No documents selected for upload</p>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={addUploadRow}
                        >
                          Add Document to Upload
                        </Button>
                      </div>
                    )}
                  </Card.Body>
                </Card>

                <div className="mt-3 small text-muted bg-light p-2 rounded">
                  <FaFileAlt className="me-2 text-primary" size={12} />
                  <small>
                    <strong>Note:</strong> You can upload multiple documents. Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG
                  </small>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="d-flex justify-content-between mt-4">
              <div>
                {activeTab !== 'personal' && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handlePrevious}
                  >
                    <FaArrowLeft className="me-2" size={10} />
                    Previous
                  </Button>
                )}
              </div>
              
              <div className="d-flex gap-2">
                {activeTab !== 'documents' ? (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleNext}
                  >
                    Save & Next
                    <FaArrowRight className="ms-2" size={10} />
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={handleFinalSubmit}
                    disabled={saving || uploading || !isAllTabsCompleted()}
                  >
                    {saving ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" size={12} />
                        Final Submit & Generate ID
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="mt-3">
                <ProgressBar
                  now={uploadProgress}
                  label={`Uploading documents... ${uploadProgress}%`}
                  striped
                  animated
                  size="sm"
                />
              </div>
            )}
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default AddEmployee;