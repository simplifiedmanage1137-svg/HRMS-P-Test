// components/Admin/EditEmployee.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Card, Row, Col, Spinner, Alert, Modal, Table, Badge, ProgressBar } from 'react-bootstrap';
import { FaSave, FaArrowLeft, FaFileAlt, FaFileImage, FaFilePdf, FaDownload, FaEye, FaUpload, FaTrash, FaPlus } from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext'; // 👈 Import this

const EditEmployee = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { showNotification } = useNotification(); // 👈 Add this

    // Form states
    const [formData, setFormData] = useState({
        first_name: '',
        middle_name: '',
        last_name: '',
        employee_id: '',
        email: '',
        phone: '',
        joining_date: '',
        designation: '',
        department: '',
        reporting_manager: '',
        employment_type: 'Full Time',
        shift_timing: '9:00 AM - 6:00 PM',
        in_hand_salary: '',
        gross_salary: '',
        bank_account_name: '',
        account_number: '',
        ifsc_code: '',
        branch_name: '',
        pan_number: '',
        aadhar_number: '',
        dob: '',
        address: '',
        city: '',
        state: '',
        pincode: '',
        blood_group: '',
        emergency_contact: '',
        contract_policy: ''
    });

    // UI states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Document states
    const [employeeDocuments, setEmployeeDocuments] = useState([]);
    const [docLoading, setDocLoading] = useState(false);
    const [showDocumentModal, setShowDocumentModal] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // New document upload states
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [selectedDocTypes, setSelectedDocTypes] = useState([]);
    const [showUploadModal, setShowUploadModal] = useState(false);

    const documentTypes = [
        { value: 'appointment_letter', label: 'Appointment Letter', icon: <FaFileAlt className="text-info" /> },
        { value: 'offer_letter', label: 'Offer Letter', icon: <FaFilePdf className="text-danger" /> },
        { value: 'contract_document', label: 'Contract Document', icon: <FaFileAlt className="text-secondary" /> },
        { value: 'aadhar_card', label: 'Aadhar Card', icon: <FaFileImage className="text-primary" /> },
        { value: 'pan_card', label: 'PAN Card', icon: <FaFileImage className="text-warning" /> },
        { value: 'bank_proof', label: 'Bank Proof', icon: <FaFileAlt className="text-info" /> },
        { value: 'education_certificates', label: 'Education Certificates', icon: <FaFileAlt className="text-success" /> },
        { value: 'experience_certificates', label: 'Experience Certificates', icon: <FaFileAlt className="text-secondary" /> },
        { value: 'resume', label: 'Resume', icon: <FaFileAlt className="text-primary" /> },
        { value: 'salary_slip', label: 'Salary Slip', icon: <FaFileAlt className="text-success" /> },
        { value: 'profile_image', label: 'Profile Image', icon: <FaFileImage className="text-info" /> }
    ];

    const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
    const employmentTypes = ['Full Time', 'Part Time', 'Contract', 'Intern', 'Probation'];
    const departments = ['IT', 'HR', 'Finance', 'Marketing', 'Sales', 'Operations', 'Administration', 'Legal'];

    useEffect(() => {
        if (id) {
            fetchEmployeeDetails();
        }
    }, [id]);

    const fetchEmployeeDetails = async () => {
        try {
            setLoading(true);
            console.log('📤 Fetching employee details for ID:', id);

            const response = await axios.get(API_ENDPOINTS.EMPLOYEE_BY_ID(id));
            console.log('✅ Employee data:', response.data);

            // Format dates for input fields
            const employee = response.data;
            setFormData({
                ...employee,
                joining_date: employee.joining_date ? employee.joining_date.split('T')[0] : '',
                dob: employee.dob ? employee.dob.split('T')[0] : ''
            });

            // After getting employee details, fetch documents
            if (employee.employee_id) {
                fetchEmployeeDocuments(employee.employee_id);
            } else {
                console.error('Employee ID not found in response');
            }

        } catch (error) {
            console.error('❌ Error fetching employee:', error);
            setError(error.response?.data?.message || 'Failed to load employee details');
            showNotification(error.response?.data?.message || 'Failed to load employee details', 'danger');
        } finally {
            setLoading(false);
        }
    };

    // Updated fetchEmployeeDocuments with better debugging
    const fetchEmployeeDocuments = async (employeeId) => {
        try {
            setDocLoading(true);
            console.log('📄 Fetching documents for employee ID:', employeeId);

            const response = await axios.get(API_ENDPOINTS.EMPLOYEE_DOCUMENTS(employeeId));
            console.log('✅ Documents response:', response.data);

            // Process documents - filter out null/empty values
            const docs = Object.entries(response.data)
                .filter(([key, value]) => value && value !== 'null' && value !== '')
                .map(([key, value]) => ({
                    type: key,
                    filename: value,
                    displayName: formatDocumentName(key),
                    icon: getDocumentIcon(key, value)
                }));

            console.log('📊 Processed documents:', docs);
            setEmployeeDocuments(docs);

        } catch (error) {
            console.error('❌ Error fetching documents:', error);
            setEmployeeDocuments([]);
        } finally {
            setDocLoading(false);
        }
    };

    const formatDocumentName = (type) => {
        const names = {
            'profile_image': 'Profile Image',
            'appointment_letter': 'Appointment Letter',
            'offer_letter': 'Offer Letter',
            'contract_document': 'Contract Document',
            'aadhar_card': 'Aadhar Card',
            'pan_card': 'PAN Card',
            'resume': 'Resume',
            'salary_slip': 'Salary Slip',
            'bank_proof': 'Bank Proof',
            'education_certificates': 'Education Certificates',
            'experience_certificates': 'Experience Certificates'
        };
        return names[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    };

    const getDocumentIcon = (type, filename) => {
        if (!filename) return <FaFileAlt className="text-secondary" size={20} />;

        const ext = filename.split('.').pop().toLowerCase();

        if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
            return <FaFileImage className="text-primary" size={20} />;
        }
        if (ext === 'pdf') {
            return <FaFilePdf className="text-danger" size={20} />;
        }
        return <FaFileAlt className="text-secondary" size={20} />;
    };

    const handleViewDocument = (doc) => {
        window.open(`${API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(formData.employee_id, doc.type)}?inline=true`, '_blank');
    };

    const handleDownloadDocument = async (doc) => {
        try {
            const response = await axios.get(
                API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(formData.employee_id, doc.type),
                {
                    responseType: 'blob',
                    headers: { 'Accept': '*/*' }
                }
            );

            const blob = new Blob([response.data], {
                type: response.headers['content-type'] || 'application/octet-stream'
            });

            const url = window.URL.createObjectURL(blob);
            const link = window.document.createElement('a');
            link.href = url;
            link.setAttribute('download', doc.filename);
            window.document.body.appendChild(link);
            link.click();

            setTimeout(() => {
                window.URL.revokeObjectURL(url);
                window.document.body.removeChild(link);
            }, 100);

            showNotification('Document downloaded successfully!', 'success');
        } catch (error) {
            console.error('Error downloading document:', error);
            showNotification(error.response?.data?.message || 'Failed to download document', 'danger');
        }
    };

    // ============== DOCUMENT UPLOAD FUNCTIONS ==============

    const addUploadRow = () => {
        setSelectedFiles([...selectedFiles, null]);
        setSelectedDocTypes([...selectedDocTypes, '']);
    };

    const removeUploadRow = (index) => {
        const newFiles = [...selectedFiles];
        const newTypes = [...selectedDocTypes];
        newFiles.splice(index, 1);
        newTypes.splice(index, 1);
        setSelectedFiles(newFiles);
        setSelectedDocTypes(newTypes);
    };

    const handleFileSelect = (index, file) => {
        const newFiles = [...selectedFiles];
        newFiles[index] = file;
        setSelectedFiles(newFiles);
    };

    const handleDocumentTypeChange = (index, value) => {
        const newTypes = [...selectedDocTypes];
        newTypes[index] = value;
        setSelectedDocTypes(newTypes);
    };

    // Updated uploadDocuments function with refresh
    const uploadDocuments = async () => {
        const validUploads = selectedFiles.reduce((acc, file, index) => {
            if (file && selectedDocTypes[index]) {
                acc.push({
                    file,
                    type: selectedDocTypes[index]
                });
            }
            return acc;
        }, []);

        if (validUploads.length === 0) {
            showNotification('Please select files and document types', 'warning');
            return;
        }

        setUploading(true);
        let successCount = 0;
        let failCount = 0;
        let uploadedTypes = [];

        for (let i = 0; i < validUploads.length; i++) {
            const upload = validUploads[i];

            // Create a new FormData object for each file
            const formDataObj = new FormData();
            formDataObj.append(upload.type, upload.file);

            try {
                setUploadProgress(Math.round(((i + 1) / validUploads.length) * 100));

                // Use formData.employee_id from state
                if (!formData.employee_id) {
                    console.error('Employee ID not found in form data');
                    failCount++;
                    continue;
                }

                const url = API_ENDPOINTS.EMPLOYEE_DOCUMENTS(formData.employee_id);
                console.log(`📤 Uploading to: ${url}`);
                console.log(`📄 Document type: ${upload.type}, File:`, upload.file.name);

                const response = await axios.post(url, formDataObj, {
                    headers: {
                        'Content-Type': 'multipart/form-data'
                    }
                });

                console.log('Upload response:', response.data);
                successCount++;
                uploadedTypes.push(upload.type);
            } catch (error) {
                console.error(`❌ Error uploading ${upload.type}:`, error);
                console.error('Error details:', error.response?.data);
                failCount++;
            }
        }

        if (successCount > 0) {
            showNotification(`${successCount} document(s) uploaded successfully!`, 'success');
            
            // 👇 IMPORTANT: Refresh documents list after successful upload
            console.log('🔄 Refreshing documents list...');
            await fetchEmployeeDocuments(formData.employee_id);
            
            // Close the upload modal
            setShowUploadModal(false);
        }
        
        if (failCount > 0) {
            showNotification(`${failCount} document(s) failed to upload`, 'danger');
        }

        setUploading(false);
        setSelectedFiles([]);
        setSelectedDocTypes([]);
        setUploadProgress(0);
    };

    // Updated handleDeleteDocument with refresh
    const handleDeleteDocument = async (doc) => {
        if (!window.confirm(`Are you sure you want to delete ${doc.displayName}?`)) {
            return;
        }

        try {
            await axios.delete(API_ENDPOINTS.EMPLOYEE_DOCUMENT_DELETE(formData.employee_id, doc.type));
            showNotification('Document deleted successfully!', 'success');
            
            // 👇 Refresh documents list after deletion
            await fetchEmployeeDocuments(formData.employee_id);
            
        } catch (error) {
            console.error('Error deleting document:', error);
            showNotification(error.response?.data?.message || 'Failed to delete document', 'danger');
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            await axios.put(API_ENDPOINTS.EMPLOYEE_BY_ID(id), formData);
            setSuccess('Employee updated successfully!');
            showNotification('Employee updated successfully!', 'success');

            // Redirect after 2 seconds
            setTimeout(() => {
                navigate('/admin/employees');
            }, 2000);

        } catch (error) {
            console.error('Error updating employee:', error);
            setError(error.response?.data?.message || 'Failed to update employee');
            showNotification(error.response?.data?.message || 'Failed to update employee', 'danger');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <p className="mt-3 text-muted">Loading employee details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container-fluid py-4">
            {/* Header */}
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => navigate('/admin/employees')}
                        className="me-3"
                    >
                        <FaArrowLeft className="me-2" /> Back
                    </Button>
                    <h4 className="d-inline-block mb-0">Edit Employee: {formData.first_name} {formData.last_name}</h4>
                </div>

                <Badge bg="info" className="px-3 py-2">
                    ID: {formData.employee_id}
                </Badge>
            </div>

            {/* Messages */}
            {error && (
                <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-3">
                    {error}
                </Alert>
            )}
            {success && (
                <Alert variant="success" onClose={() => setSuccess('')} dismissible className="mb-3">
                    {success}
                </Alert>
            )}

            {/* Edit Form */}
            <Form onSubmit={handleSubmit}>
                {/* Personal Information */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3">
                        <h5 className="mb-0">Personal Information</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">First Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="first_name"
                                        value={formData.first_name}
                                        onChange={handleChange}
                                        required
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Middle Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="middle_name"
                                        value={formData.middle_name}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Last Name <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="last_name"
                                        value={formData.last_name}
                                        onChange={handleChange}
                                        required
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Date of Birth</Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="dob"
                                        value={formData.dob}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Blood Group</Form.Label>
                                    <Form.Select
                                        name="blood_group"
                                        value={formData.blood_group}
                                        onChange={handleChange}
                                        size="sm"
                                    >
                                        <option value="">Select Blood Group</option>
                                        {bloodGroups.map(bg => (
                                            <option key={bg} value={bg}>{bg}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Contact Information */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3">
                        <h5 className="mb-0">Contact Information</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Email <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        required
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Phone</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="phone"
                                        value={formData.phone}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={12}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Address</Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={2}
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">City</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">State</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="state"
                                        value={formData.state}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Pincode</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="pincode"
                                        value={formData.pincode}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Employment Details */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3">
                        <h5 className="mb-0">Employment Details</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Designation <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="designation"
                                        value={formData.designation}
                                        onChange={handleChange}
                                        required
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Department <span className="text-danger">*</span></Form.Label>
                                    <Form.Select
                                        name="department"
                                        value={formData.department}
                                        onChange={handleChange}
                                        required
                                        size="sm"
                                    >
                                        <option value="">Select Department</option>
                                        {departments.map(dept => (
                                            <option key={dept} value={dept}>{dept}</option>
                                        ))}
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Joining Date <span className="text-danger">*</span></Form.Label>
                                    <Form.Control
                                        type="date"
                                        name="joining_date"
                                        value={formData.joining_date}
                                        onChange={handleChange}
                                        required
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Employment Type</Form.Label>
                                    <Form.Select
                                        name="employment_type"
                                        value={formData.employment_type}
                                        onChange={handleChange}
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
                                    <Form.Label className="fw-semibold">Shift Timing</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="shift_timing"
                                        value={formData.shift_timing}
                                        onChange={handleChange}
                                        placeholder="9:00 AM - 6:00 PM"
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Reporting Manager</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="reporting_manager"
                                        value={formData.reporting_manager}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Bank Details */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3">
                        <h5 className="mb-0">Bank Details</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Bank Account Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="bank_account_name"
                                        value={formData.bank_account_name}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Account Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="account_number"
                                        value={formData.account_number}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">IFSC Code</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="ifsc_code"
                                        value={formData.ifsc_code}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Row className="mb-3">
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Branch Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="branch_name"
                                        value={formData.branch_name}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">PAN Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="pan_number"
                                        value={formData.pan_number}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={4}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Aadhar Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="aadhar_number"
                                        value={formData.aadhar_number}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Salary Information */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3">
                        <h5 className="mb-0">Salary Information</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Gross Salary (₹)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="gross_salary"
                                        value={formData.gross_salary}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">In Hand Salary (₹)</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="in_hand_salary"
                                        value={formData.in_hand_salary}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Emergency Contact */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3">
                        <h5 className="mb-0">Emergency Contact</h5>
                    </Card.Header>
                    <Card.Body>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group>
                                    <Form.Label className="fw-semibold">Emergency Contact Number</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="emergency_contact"
                                        value={formData.emergency_contact}
                                        onChange={handleChange}
                                        size="sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>

                {/* Documents Section with Upload */}
                <Card className="shadow-sm mb-4">
                    <Card.Header className="bg-light py-3 d-flex justify-content-between align-items-center">
                        <h5 className="mb-0">Employee Documents</h5>
                        <div>
                            <Button
                                variant="success"
                                size="sm"
                                onClick={() => setShowUploadModal(true)}
                                className="me-2"
                            >
                                <FaUpload className="me-2" /> Upload New Document
                            </Button>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => setShowDocumentModal(true)}
                            >
                                <FaFileAlt className="me-2" /> View All ({employeeDocuments.length})
                            </Button>
                        </div>
                    </Card.Header>
                    <Card.Body>
                        {docLoading ? (
                            <div className="text-center py-3">
                                <Spinner animation="border" variant="primary" size="sm" />
                                <p className="mt-2 small text-muted">Loading documents...</p>
                            </div>
                        ) : employeeDocuments.length > 0 ? (
                            <Row>
                                {employeeDocuments.slice(0, 6).map((doc, index) => (
                                    <Col md={4} key={index} className="mb-3">
                                        <div className="d-flex align-items-center p-3 bg-light rounded border h-100">
                                            <div className="me-3 fs-4">
                                                {doc.icon}
                                            </div>
                                            <div className="flex-grow-1" style={{ minWidth: 0 }}>
                                                <div className="fw-semibold small text-truncate">{doc.displayName}</div>
                                                <small className="text-muted text-truncate d-block">{doc.filename}</small>
                                                <div className="mt-2">
                                                    <Button
                                                        variant="outline-info"
                                                        size="sm"
                                                        className="me-1"
                                                        onClick={() => handleViewDocument(doc)}
                                                        title="View"
                                                    >
                                                        <FaEye size={10} />
                                                    </Button>
                                                    <Button
                                                        variant="outline-success"
                                                        size="sm"
                                                        className="me-1"
                                                        onClick={() => handleDownloadDocument(doc)}
                                                        title="Download"
                                                    >
                                                        <FaDownload size={10} />
                                                    </Button>
                                                    <Button
                                                        variant="outline-danger"
                                                        size="sm"
                                                        onClick={() => handleDeleteDocument(doc)}
                                                        title="Delete"
                                                    >
                                                        <FaTrash size={10} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </Col>
                                ))}
                                {employeeDocuments.length > 6 && (
                                    <Col md={12} className="text-center mt-2">
                                        <small className="text-muted">
                                            +{employeeDocuments.length - 6} more documents. Click "View All" to see all.
                                        </small>
                                    </Col>
                                )}
                            </Row>
                        ) : (
                            <div className="text-center py-4">
                                <FaFileAlt size={40} className="text-muted mb-3 opacity-50" />
                                <p className="text-muted mb-2">No documents uploaded yet</p>
                                <Button
                                    variant="primary"
                                    size="sm"
                                    onClick={() => setShowUploadModal(true)}
                                >
                                    <FaUpload className="me-2" /> Upload First Document
                                </Button>
                            </div>
                        )}
                    </Card.Body>
                </Card>

                {/* Submit Button */}
                <div className="text-end mt-4">
                    <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        disabled={saving}
                        className="px-5"
                    >
                        {saving ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <FaSave className="me-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </Form>

            {/* Upload Documents Modal */}
            <Modal show={showUploadModal} onHide={() => setShowUploadModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-success text-white py-2">
                    <Modal.Title as="h6" className="mb-0 small fw-semibold">
                        <FaUpload className="me-2" size={14} />
                        Upload Documents for {formData.first_name} {formData.last_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    <div className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-3">
                            <h6 className="small fw-semibold mb-0">Select Documents to Upload</h6>
                            <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={addUploadRow}
                                disabled={uploading}
                            >
                                <FaPlus className="me-2" size={10} /> Add Another
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
                            <div className="text-center py-4">
                                <p className="text-muted small mb-3">No documents selected for upload</p>
                                <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={addUploadRow}
                                >
                                    <FaPlus className="me-2" size={10} /> Add Document to Upload
                                </Button>
                            </div>
                        )}

                        {uploading && (
                            <div className="mt-3">
                                <ProgressBar
                                    now={uploadProgress}
                                    label={`Uploading... ${uploadProgress}%`}
                                    striped
                                    animated
                                    size="sm"
                                />
                            </div>
                        )}

                        <div className="mt-3 small text-muted bg-light p-2 rounded">
                            <FaFileAlt className="me-2 text-primary" size={12} />
                            <small>
                                <strong>Note:</strong> Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB each)
                            </small>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowUploadModal(false)}>
                        Cancel
                    </Button>
                    <Button
                        variant="success"
                        size="sm"
                        onClick={uploadDocuments}
                        disabled={uploading || selectedFiles.length === 0 || selectedFiles.every(f => !f)}
                    >
                        {uploading ? (
                            <>
                                <Spinner size="sm" animation="border" className="me-2" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <FaUpload className="me-2" size={10} />
                                Upload Documents
                            </>
                        )}
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* View Documents Modal */}
            <Modal show={showDocumentModal} onHide={() => setShowDocumentModal(false)} size="lg" centered>
                <Modal.Header closeButton className="bg-info text-white py-2">
                    <Modal.Title as="h6" className="mb-0 small fw-semibold">
                        <FaFileAlt className="me-2" size={14} />
                        All Documents: {formData.first_name} {formData.last_name}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="p-3">
                    {docLoading ? (
                        <div className="text-center py-4">
                            <Spinner animation="border" variant="info" size="sm" />
                            <p className="mt-2 small text-muted">Loading documents...</p>
                        </div>
                    ) : employeeDocuments.length > 0 ? (
                        <div className="table-responsive">
                            <Table striped hover size="sm" className="mb-0">
                                <thead className="bg-light">
                                    <tr>
                                        <th className="small text-dark">Document Type</th>
                                        <th className="small text-dark">File Name</th>
                                        <th className="small text-dark text-center" style={{ width: '180px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {employeeDocuments.map((doc, index) => (
                                        <tr key={index}>
                                            <td>
                                                <div className="d-flex align-items-center">
                                                    {doc.icon}
                                                    <span className="ms-2 small fw-semibold">{doc.displayName}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <small className="text-muted">{doc.filename}</small>
                                            </td>
                                            <td className="text-center">
                                                <Button
                                                    variant="outline-info"
                                                    size="sm"
                                                    onClick={() => handleViewDocument(doc)}
                                                    className="me-2"
                                                    title="View Document"
                                                >
                                                    <FaEye size={12} className="me-1" />
                                                    View
                                                </Button>
                                                <Button
                                                    variant="outline-success"
                                                    size="sm"
                                                    onClick={() => handleDownloadDocument(doc)}
                                                    className="me-2"
                                                    title="Download Document"
                                                >
                                                    <FaDownload size={12} className="me-1" />
                                                    Download
                                                </Button>
                                                <Button
                                                    variant="outline-danger"
                                                    size="sm"
                                                    onClick={() => handleDeleteDocument(doc)}
                                                    title="Delete Document"
                                                >
                                                    <FaTrash size={12} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </Table>
                        </div>
                    ) : (
                        <div className="text-center py-4">
                            <FaFileAlt size={40} className="text-muted mb-3 opacity-50" />
                            <p className="text-muted small mb-3">No documents found for this employee</p>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => {
                                    setShowDocumentModal(false);
                                    setShowUploadModal(true);
                                }}
                            >
                                <FaUpload className="me-2" /> Upload Documents
                            </Button>
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer className="py-2">
                    <Button variant="secondary" size="sm" onClick={() => setShowDocumentModal(false)}>
                        Close
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default EditEmployee;