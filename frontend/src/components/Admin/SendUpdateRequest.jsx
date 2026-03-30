// src/components/Admin/SendUpdateRequest.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Form, Button, Alert, Spinner, Badge,
  Row, Col, InputGroup
} from 'react-bootstrap';
import {
  FaPaperPlane, FaUser, FaInfoCircle, FaCheckCircle,
  FaTimesCircle, FaSearch, FaFilter, FaBriefcase,
  FaEnvelope, FaPhone, FaMapMarkerAlt, FaUniversity,
  FaCalendarAlt, FaClock, FaUserTie, FaFileAlt,
  FaCreditCard, FaHeartbeat, FaFilePdf, FaFileWord,
  FaFileImage, FaUpload, FaTimes
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const SendUpdateRequest = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  // In SendUpdateRequest.jsx - Update the fieldOptions array
  const fieldOptions = [
    {
      value: 'personal',
      label: 'Personal Information',
      icon: <FaUser className="text-primary" />,
      fields: ['first_name', 'last_name', 'dob', 'blood_group']
    },
    {
      value: 'contact',
      label: 'Contact Details',
      icon: <FaEnvelope className="text-info" />,
      fields: ['email', 'phone']
    },
    {
      value: 'address',
      label: 'Address',
      icon: <FaMapMarkerAlt className="text-danger" />,
      fields: ['address', 'city', 'state', 'pincode']
    },
    {
      value: 'bank',
      label: 'Bank Details & ID Proofs',
      icon: <FaUniversity className="text-warning" />,
      fields: ['bank_account_name', 'account_number', 'ifsc_code', 'branch_name', 'pan_number', 'aadhar_number']  // ✅ Added aadhar_number
    },
    {
      value: 'employment',
      label: 'Employment Details',
      icon: <FaBriefcase className="text-secondary" />,
      fields: ['designation', 'department', 'employment_type', 'shift_timing', 'reporting_manager']
    },
    {
      value: 'emergency',
      label: 'Emergency Contact',
      icon: <FaHeartbeat className="text-danger" />,
      fields: ['emergency_contact']
    },
    {
      value: 'documents',
      label: 'Documents (Upload/Re-upload)',
      icon: <FaFileAlt className="text-success" />,
      fields: ['documents'],
      isDocument: true
    },
    {
      value: 'salary',
      label: 'Salary Information',
      icon: <FaCreditCard className="text-success" />,
      fields: ['gross_salary', 'in_hand_salary']
    }
  ];

  // Document types for upload requests
  const documentTypes = [
    { value: 'profile_image', label: 'Profile Image', icon: <FaFileImage className="text-primary" />, accept: 'image/*' },
    { value: 'appointment_letter', label: 'Appointment Letter', icon: <FaFileWord className="text-info" />, accept: '.pdf,.doc,.docx' },
    { value: 'offer_letter', label: 'Offer Letter', icon: <FaFilePdf className="text-danger" />, accept: '.pdf,.doc,.docx' },
    { value: 'contract_document', label: 'Contract Document', icon: <FaFileAlt className="text-secondary" />, accept: '.pdf,.doc,.docx' },
    { value: 'aadhar_card', label: 'Aadhar Card', icon: <FaFileImage className="text-primary" />, accept: 'image/*,.pdf' },
    { value: 'pan_card', label: 'PAN Card', icon: <FaFileImage className="text-warning" />, accept: 'image/*,.pdf' },
    { value: 'bank_proof', label: 'Bank Proof', icon: <FaFileAlt className="text-info" />, accept: '.pdf,.jpg,.png' },
    { value: 'education_certificates', label: 'Education Certificates', icon: <FaFileAlt className="text-success" />, accept: '.pdf,.doc,.docx' },
    { value: 'experience_certificates', label: 'Experience Certificates', icon: <FaFileAlt className="text-secondary" />, accept: '.pdf,.doc,.docx' }
  ];

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Apply filters whenever searchTerm, departmentFilter, or employees change
  useEffect(() => {
    applyFilters();
  }, [searchTerm, departmentFilter, employees]);

  const fetchEmployees = async () => {
    try {
      setFetching(true);
      console.log('📡 Fetching employees from:', API_ENDPOINTS.ADMIN_UPDATES_EMPLOYEES);

      const response = await axios.get(API_ENDPOINTS.ADMIN_UPDATES_EMPLOYEES);

      console.log('✅ API Response:', response);

      let employeesData = [];

      if (Array.isArray(response.data)) {
        employeesData = response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        employeesData = response.data.data;
      } else if (response.data && response.data.employees && Array.isArray(response.data.employees)) {
        employeesData = response.data.employees;
      } else {
        employeesData = [];
      }

      console.log(`✅ Loaded ${employeesData.length} employees`);
      setEmployees(employeesData);
      setFilteredEmployees(employeesData);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      console.error('Error response:', error.response?.data);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to load employees'
      });
    } finally {
      setFetching(false);
    }
  };

  const applyFilters = () => {
    console.log('🔍 Applying filters - Search:', searchTerm, 'Department:', departmentFilter);

    let filtered = [...employees];

    // Apply search filter
    if (searchTerm && searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase().trim();
      filtered = filtered.filter(emp => {
        const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
        const employeeId = (emp.employee_id || '').toLowerCase();
        const department = (emp.department || '').toLowerCase();
        const designation = (emp.designation || '').toLowerCase();

        return fullName.includes(term) ||
          employeeId.includes(term) ||
          department.includes(term) ||
          designation.includes(term);
      });
      console.log(`🔍 Search filter: ${filtered.length} employees found`);
    }

    // Apply department filter
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.department === departmentFilter);
      console.log(`🔍 Department filter: ${filtered.length} employees found`);
    }

    setFilteredEmployees(filtered);

    // Clear selected employee if current selection is not in filtered list
    if (selectedEmployee && !filtered.some(emp => emp.employee_id === selectedEmployee)) {
      setSelectedEmployee('');
    }
  };

  const departments = ['all', ...new Set(employees.map(emp => emp.department).filter(Boolean))];

  const handleFieldChange = (field) => {
    setSelectedFields(prev =>
      prev.includes(field)
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );

    // If unselecting documents, clear selected documents
    if (field === 'documents' && selectedFields.includes('documents')) {
      setSelectedDocuments([]);
    }
  };

  const handleDocumentChange = (docType) => {
    setSelectedDocuments(prev =>
      prev.includes(docType)
        ? prev.filter(d => d !== docType)
        : [...prev, docType]
    );
  };

  const handleSelectAll = () => {
    if (selectedFields.length === fieldOptions.length) {
      setSelectedFields([]);
      setSelectedDocuments([]);
    } else {
      setSelectedFields(fieldOptions.map(f => f.value));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedEmployee) {
      setMessage({
        type: 'danger',
        text: 'Please select an employee'
      });
      return;
    }

    if (selectedFields.length === 0) {
      setMessage({
        type: 'danger',
        text: 'Please select at least one field to update'
      });
      return;
    }

    // Validate document selection
    const isDocumentSelected = selectedFields.includes('documents');
    if (isDocumentSelected && selectedDocuments.length === 0) {
      setMessage({
        type: 'danger',
        text: 'Please select at least one document type to request'
      });
      return;
    }

    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Get full field list for selected categories
      const fieldsToUpdate = [];
      selectedFields.forEach(category => {
        const categoryObj = fieldOptions.find(f => f.value === category);
        if (categoryObj && !categoryObj.isDocument) {
          fieldsToUpdate.push(...categoryObj.fields);
        }
      });

      const requestData = {
        employee_id: selectedEmployee,
        requested_fields: selectedFields,
        requested_field_names: fieldsToUpdate,
        notes: `Please update your ${selectedFields.map(f => {
          const fieldObj = fieldOptions.find(opt => opt.value === f);
          return fieldObj?.label || f;
        }).join(', ')} information.`
      };

      // Add document types if documents field is selected
      if (isDocumentSelected) {
        requestData.document_types = selectedDocuments;
      }

      console.log('📤 Sending request data:', requestData);

      const response = await axios.post(API_ENDPOINTS.ADMIN_UPDATES_SEND_REQUEST, requestData);

      setMessage({
        type: 'success',
        text: `Update request sent successfully! ${isDocumentSelected ? `Document upload requested for: ${selectedDocuments.map(d => documentTypes.find(doc => doc.value === d)?.label).join(', ')}` : ''}`
      });

      // Reset form
      setSelectedEmployee('');
      setSelectedFields([]);
      setSelectedDocuments([]);
      setSearchTerm('');
      setDepartmentFilter('all');

      // Refresh employee list
      await fetchEmployees();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 3000);

    } catch (error) {
      console.error('Error sending request:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Error sending request'
      });
    } finally {
      setLoading(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDepartmentFilter('all');
    setSelectedEmployee('');
  };

  // Get selected employee details for display
  const getSelectedEmployeeDetails = () => {
    if (!selectedEmployee) return null;
    return filteredEmployees.find(emp => emp.employee_id === selectedEmployee);
  };

  const selectedEmpDetails = getSelectedEmployeeDetails();

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      {/* Header - Responsive */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <h5 className="mb-0 d-flex align-items-center">
          <FaPaperPlane className="me-2 text-primary" />
          Send Update Request to Employee
        </h5>
        <Badge bg="info" pill className="px-3 py-2 ms-0 ms-md-auto">
          {filteredEmployees.length} Employees Available
        </Badge>
      </div>

      {/* Message Alert */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4 py-2"
        >
          <div className="d-flex align-items-center">
            {message.type === 'success' && <FaCheckCircle className="me-2 flex-shrink-0" size={14} />}
            {message.type === 'danger' && <FaTimesCircle className="me-2 flex-shrink-0" size={14} />}
            <span className="small">{message.text}</span>
          </div>
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light py-2 py-md-3">
          <h6 className="mb-0">Request Information Update</h6>
        </Card.Header>
        <Card.Body className="p-2 p-md-3">
          <Form onSubmit={handleSubmit}>
            {/* Employee Selection with Search */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-semibold small d-flex align-items-center">
                <FaUser className="me-2 text-primary" size={14} />
                Select Employee
              </Form.Label>

              {/* Search and Filter - Responsive */}
              <Row className="mb-3 g-2">
                <Col xs={12} md={6}>
                  <InputGroup size="sm">
                    <InputGroup.Text className="bg-light border-0">
                      <FaSearch size={12} className="text-muted" />
                    </InputGroup.Text>
                    <Form.Control
                      type="text"
                      placeholder="Search by name, ID, department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-0 bg-light"
                    />
                    {searchTerm && (
                      <Button
                        variant="outline-secondary"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="border-0"
                      >
                        <FaTimes size={12} />
                      </Button>
                    )}
                  </InputGroup>
                </Col>
                <Col xs={12} md={4}>
                  <Form.Select
                    size="sm"
                    value={departmentFilter}
                    onChange={(e) => setDepartmentFilter(e.target.value)}
                    className="bg-light border-0"
                  >
                    <option value="all">All Departments</option>
                    {departments.filter(d => d !== 'all').map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={12} md={2}>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearFilters}
                    className="w-100"
                    disabled={!searchTerm && departmentFilter === 'all'}
                  >
                    Clear Filters
                  </Button>
                </Col>
              </Row>

              {/* Employee Dropdown */}
              <Form.Select
                size="sm"
                value={selectedEmployee}
                onChange={(e) => setSelectedEmployee(e.target.value)}
                required
                disabled={fetching}
                className="mb-2"
              >
                <option value="">-- Choose an employee --</option>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map(emp => (
                    <option key={emp.employee_id} value={emp.employee_id}>
                      {emp.first_name} {emp.last_name} - {emp.designation || 'N/A'} ({emp.employee_id})
                    </option>
                  ))
                ) : (
                  <option disabled>No employees found matching your search</option>
                )}
              </Form.Select>

              {/* Show selected employee details */}
              {selectedEmpDetails && (
                <div className="mt-2 p-2 bg-light rounded">
                  <div className="d-flex align-items-center gap-2 flex-wrap">
                    <Badge bg="primary" pill>
                      <FaUser className="me-1" size={10} />
                      {selectedEmpDetails.first_name} {selectedEmpDetails.last_name}
                    </Badge>
                    <Badge bg="info" pill>
                      ID: {selectedEmpDetails.employee_id}
                    </Badge>
                    <Badge bg="secondary" pill>
                      {selectedEmpDetails.department || 'N/A'}
                    </Badge>
                  </div>
                </div>
              )}

              {/* Filter Info */}
              {(searchTerm || departmentFilter !== 'all') && (
                <div className="mt-2 d-flex flex-wrap align-items-center gap-2">
                  <small className="text-muted">Found <strong>{filteredEmployees.length}</strong> employee{filteredEmployees.length !== 1 ? 's' : ''}:</small>
                  {departmentFilter !== 'all' && (
                    <Badge bg="info" className="px-2 py-1">
                      Dept: {departmentFilter}
                    </Badge>
                  )}
                  {searchTerm && (
                    <Badge bg="info" className="px-2 py-1">
                      Search: "{searchTerm}"
                    </Badge>
                  )}
                </div>
              )}

              {fetching && (
                <div className="text-center py-2">
                  <Spinner size="sm" animation="border" variant="primary" />
                  <small className="ms-2 text-muted">Loading employees...</small>
                </div>
              )}
            </Form.Group>

            {/* Fields Selection */}
            <Form.Group className="mb-4">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-2 gap-2">
                <Form.Label className="fw-semibold small mb-0 d-flex align-items-center">
                  <FaInfoCircle className="me-2 text-primary" size={14} />
                  Select Fields to Update
                </Form.Label>
                <Button
                  variant="outline-secondary"
                  size="sm"
                  onClick={handleSelectAll}
                  className="ms-0 ms-sm-auto"
                >
                  {selectedFields.length === fieldOptions.length ? 'Deselect All' : 'Select All'}
                </Button>
              </div>

              <Row className="g-2">
                {fieldOptions.map(field => (
                  <Col xs={12} sm={6} lg={3} key={field.value} className="mb-2">
                    <div className={`p-2 rounded border h-100 ${selectedFields.includes(field.value) ? 'bg-primary bg-opacity-10 border-primary' : ''}`}>
                      <Form.Check
                        type="checkbox"
                        id={field.value}
                        checked={selectedFields.includes(field.value)}
                        onChange={() => handleFieldChange(field.value)}
                        label={
                          <span className="d-flex align-items-center">
                            <span className="me-2 flex-shrink-0">{field.icon}</span>
                            <span className="small text-wrap">{field.label}</span>
                          </span>
                        }
                      />
                    </div>
                  </Col>
                ))}
              </Row>
            </Form.Group>

            {/* Document Types Selection - Show only when Documents is selected */}
            {selectedFields.includes('documents') && (
              <Form.Group className="mb-4">
                <div className="d-flex align-items-center mb-2">
                  <FaUpload className="me-2 text-success" size={14} />
                  <Form.Label className="fw-semibold small mb-0">
                    Select Documents to Request <span className="text-danger">*</span>
                  </Form.Label>
                </div>
                <div className="bg-light p-2 p-md-3 rounded" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  <Row className="g-2">
                    {documentTypes.map(doc => (
                      <Col xs={12} sm={6} md={4} key={doc.value} className="mb-2">
                        <Form.Check
                          type="checkbox"
                          id={doc.value}
                          checked={selectedDocuments.includes(doc.value)}
                          onChange={() => handleDocumentChange(doc.value)}
                          label={
                            <span className="d-flex align-items-center">
                              <span className="me-2 flex-shrink-0">{doc.icon}</span>
                              <span className="small text-truncate" style={{ maxWidth: '130px' }} title={doc.label}>
                                {doc.label}
                              </span>
                            </span>
                          }
                        />
                      </Col>
                    ))}
                  </Row>
                  <div className="mt-2 p-2 bg-white rounded small text-muted">
                    <FaInfoCircle className="me-1" size={12} />
                    <strong>Note:</strong> Employee will be able to upload/re-upload these documents when they accept the request.
                    <br />
                    <small>Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG (Max 10MB per file)</small>
                  </div>
                </div>
              </Form.Group>
            )}

            {/* Selected Fields Summary */}
            {selectedFields.length > 0 && (
              <div className="mb-4 p-2 p-md-3 bg-light rounded">
                <div className="d-flex align-items-center mb-2">
                  <FaCheckCircle className="text-success me-2 flex-shrink-0" size={14} />
                  <small className="fw-semibold">Selected fields to update:</small>
                </div>
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {selectedFields.map(field => {
                    const fieldObj = fieldOptions.find(f => f.value === field);
                    return (
                      <Badge
                        key={field}
                        bg="info"
                        className="px-2 px-md-3 py-1 py-md-2 d-flex align-items-center"
                      >
                        <span className="me-1">{fieldObj?.icon}</span>
                        <span className="small">{fieldObj?.label}</span>
                      </Badge>
                    );
                  })}
                </div>

                {/* Document Types Summary */}
                {selectedFields.includes('documents') && selectedDocuments.length > 0 && (
                  <>
                    <div className="d-flex align-items-center mt-2">
                      <FaUpload className="text-success me-2 flex-shrink-0" size={12} />
                      <small className="fw-semibold">Documents to upload:</small>
                    </div>
                    <div className="d-flex flex-wrap gap-2 mt-1">
                      {selectedDocuments.map(doc => {
                        const docObj = documentTypes.find(d => d.value === doc);
                        return (
                          <Badge
                            key={doc}
                            bg="success"
                            className="px-2 px-md-3 py-1 py-md-2 d-flex align-items-center"
                          >
                            <span className="me-1">{docObj?.icon}</span>
                            <span className="small">{docObj?.label}</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </>
                )}

                <small className="text-muted d-block mt-2 small">
                  Total fields to update: {
                    selectedFields.reduce((total, field) => {
                      const fieldObj = fieldOptions.find(f => f.value === field);
                      if (fieldObj?.isDocument) return total + selectedDocuments.length;
                      return total + (fieldObj?.fields.length || 0);
                    }, 0)
                  }
                </small>
              </div>
            )}

            {/* Submit Button */}
            <div className="text-center text-md-end">
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={loading || fetching || !selectedEmployee || selectedFields.length === 0}
                className="px-4 w-100 w-md-auto"
              >
                {loading ? (
                  <>
                    <Spinner size="sm" animation="border" className="me-2" />
                    <span className="d-none d-sm-inline">Sending Request...</span>
                  </>
                ) : (
                  <>
                    <FaPaperPlane className="me-2" size={12} />
                    Send Update Request
                  </>
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* Info Card */}
      <Card className="border-0 shadow-sm mt-4 bg-light">
        <Card.Body className="p-2 p-md-3">
          <div className="d-flex align-items-start gap-2">
            <FaInfoCircle className="text-primary me-2 me-md-3 mt-1 flex-shrink-0" size={20} />
            <div>
              <h6 className="mb-2 small fw-bold">About Update Requests</h6>
              <p className="small text-muted mb-1">
                • <strong>Information Update:</strong> Sends a request for employee to update their information fields.
              </p>
              <p className="small text-muted mb-1">
                • <strong>Document Upload:</strong> Sends a request for employee to upload or re-upload specific documents.
              </p>
              <p className="small text-muted mb-1">
                • Employees can accept the request and update their information or upload documents.
              </p>
              <p className="small text-muted mb-1">
                • Once submitted by employee, you can review and approve/reject the changes in "Update Approvals".
              </p>
              <p className="small text-muted mb-0">
                • Track all pending requests in the "Update Approvals" section.
              </p>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default SendUpdateRequest;