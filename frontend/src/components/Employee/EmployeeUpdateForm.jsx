// src/components/Employee/EmployeeUpdateForm.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Form, Button, Card, Alert, Spinner, Row, Col } from 'react-bootstrap';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import EmployeeDocumentUpload from './EmployeeDocumentUpload';
import { FaSave, FaArrowLeft, FaUpload } from 'react-icons/fa';

const EmployeeUpdateForm = () => {
  const { requestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [formData, setFormData] = useState({});
  const [requestDetails, setRequestDetails] = useState(null);
  const [existingDocuments, setExistingDocuments] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info'); // 'info' or 'documents'


const fieldGroups = {
  personal: [
    { name: 'first_name', label: 'First Name', type: 'text', required: true },
    { name: 'middle_name', label: 'Middle Name', type: 'text' },
    { name: 'last_name', label: 'Last Name', type: 'text', required: true },
    { name: 'dob', label: 'Date of Birth', type: 'date' },
    { name: 'blood_group', label: 'Blood Group', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'] }
  ],
  contact: [
    { name: 'email', label: 'Email', type: 'email', required: true },
    { name: 'phone', label: 'Phone', type: 'tel' }
  ],
  address: [
    { name: 'address', label: 'Address', type: 'textarea' },
    { name: 'city', label: 'City', type: 'text' },
    { name: 'state', label: 'State', type: 'text' },
    { name: 'pincode', label: 'Pincode', type: 'text' }
  ],
  bank: [
    { name: 'bank_account_name', label: 'Account Holder Name', type: 'text' },
    { name: 'account_number', label: 'Account Number', type: 'text' },
    { name: 'ifsc_code', label: 'IFSC Code', type: 'text' },
    { name: 'branch_name', label: 'Branch Name', type: 'text' },
    { name: 'pan_number', label: 'PAN Number', type: 'text' },
    { name: 'aadhar_number', label: 'Aadhar Card Number', type: 'text', placeholder: '12-digit Aadhar number' }  // ✅ Added aadhar_number
  ],
  employment: [
    { name: 'designation', label: 'Designation', type: 'text' },
    { name: 'department', label: 'Department', type: 'text' },
    { name: 'employment_type', label: 'Employment Type', type: 'select', options: ['Full Time', 'Part Time', 'Contract', 'Intern', 'Probation'] },
    { name: 'shift_timing', label: 'Shift Timing', type: 'text', placeholder: 'e.g., 9:00 AM - 6:00 PM' },
    { name: 'reporting_manager', label: 'Reporting Manager', type: 'text' }
  ],
  emergency: [
    { name: 'emergency_contact', label: 'Emergency Contact Number', type: 'tel' }
  ],
  salary: [
    { name: 'gross_salary', label: 'Gross Salary', type: 'number' },
    { name: 'in_hand_salary', label: 'In-hand Salary', type: 'number' }
  ]
};
  // Also update the fieldIcons object
  const fieldIcons = {
    personal: { icon: '👤', label: 'Personal Information' },
    contact: { icon: '📞', label: 'Contact Details' },
    address: { icon: '🏠', label: 'Address' },
    bank: { icon: '🏦', label: 'Bank Details' },
    aadhar: { icon: '🆔', label: 'Aadhar Card' },  // ✅ NEW
    employment: { icon: '💼', label: 'Employment Details' },
    emergency: { icon: '🚑', label: 'Emergency Contact' },
    documents: { icon: '📄', label: 'Documents' },
    salary: { icon: '💰', label: 'Salary Information' }
  };

  useEffect(() => {
    if (requestId) {
      fetchRequestDetails();
      fetchCurrentData();
      fetchExistingDocuments();
    }
  }, [requestId]);

  const fetchRequestDetails = async () => {
    try {
      const response = await axios.get(`${API_ENDPOINTS.EMPLOYEE_UPDATES}/request/${requestId}`);
      setRequestDetails(response.data);
    } catch (error) {
      console.error('Error fetching request details:', error);
    }
  };

  const fetchCurrentData = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_UPDATES_CURRENT_DATA);
      setFormData(response.data);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      setError('Failed to load your data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingDocuments = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_DOCUMENTS(user.employeeId));
      setExistingDocuments(response.data);
    } catch (error) {
      console.error('Error fetching existing documents:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleInfoSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage('');
    setError('');

    try {
      const updatedData = {};
      if (requestDetails?.requested_fields) {
        requestDetails.requested_fields.forEach(category => {
          if (category !== 'documents') {
            const fields = fieldGroups[category] || [];
            fields.forEach(field => {
              if (formData[field.name] !== undefined) {
                updatedData[field.name] = formData[field.name];
              }
            });
          }
        });
      }

      const response = await axios.post(API_ENDPOINTS.EMPLOYEE_UPDATES_SUBMIT, {
        requestId,
        updatedData
      });

      setMessage('Update submitted for admin approval!');
      setTimeout(() => navigate('/employee/update-requests'), 2000);
    } catch (error) {
      console.error('❌ Error submitting:', error);
      setError(error.response?.data?.message || 'Failed to submit update. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDocumentComplete = () => {
    setMessage('Documents uploaded successfully! Waiting for admin approval.');
    setTimeout(() => navigate('/employee/update-requests'), 2000);
  };

  const isDocumentRequest = requestDetails?.is_document_update || false;
  const documentTypes = requestDetails?.document_types || [];
  const hasInfoFields = requestDetails?.requested_fields?.filter(f => f !== 'documents')?.length > 0;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading your data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-primary text-white py-2 py-md-3 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
          <div>
            <h5 className="mb-0 small">Update Your Information</h5>
            <small className="d-block">Request #{requestId}</small>
          </div>
          <Button
            variant="light"
            size="sm"
            onClick={() => navigate('/employee/update-requests')}
            className="d-inline-flex align-items-center ms-0 ms-md-auto"
          >
            <FaArrowLeft className="me-2" size={12} />
            Back to Requests
          </Button>
        </Card.Header>
        <Card.Body className="p-2 p-md-3 p-lg-4">
          {message && (
            <Alert variant="success" className="py-2 small mb-3">
              {message}
            </Alert>
          )}
          {error && (
            <Alert variant="danger" className="py-2 small mb-3">
              {error}
            </Alert>
          )}

          {/* Tab Navigation */}
          {(hasInfoFields || !isDocumentRequest) && isDocumentRequest && (
            <div className="d-flex border-bottom mb-4">
              {hasInfoFields && (
                <Button
                  variant={activeTab === 'info' ? 'primary' : 'light'}
                  size="sm"
                  onClick={() => setActiveTab('info')}
                  className="me-2 rounded-0 border-0"
                >
                  Information Update
                </Button>
              )}
              {isDocumentRequest && documentTypes.length > 0 && (
                <Button
                  variant={activeTab === 'documents' ? 'primary' : 'light'}
                  size="sm"
                  onClick={() => setActiveTab('documents')}
                  className="rounded-0 border-0"
                >
                  <FaUpload className="me-1" size={12} />
                  Document Upload ({documentTypes.length})
                </Button>
              )}
            </div>
          )}

          {/* Information Update Tab */}
          {activeTab === 'info' && hasInfoFields && (
            <Form onSubmit={handleInfoSubmit}>
              {requestDetails.requested_fields.map(category => {
                if (category === 'documents') return null;
                return (
                  <Card key={category} className="mb-4 border-0 bg-light">
                    <Card.Header className="bg-white py-2">
                      <h6 className="mb-0 small">
                        {fieldIcons[category]?.icon} {fieldIcons[category]?.label || category}
                      </h6>
                    </Card.Header>
                    <Card.Body className="p-2 p-md-3">
                      <Row className="g-2">
                        {fieldGroups[category]?.map(field => (
                          <Col key={field.name} xs={12} md={6} className="mb-2">
                            <Form.Group>
                              <Form.Label className="small fw-semibold">
                                {field.label}
                                {field.required && <span className="text-danger ms-1">*</span>}
                              </Form.Label>
                              {field.type === 'select' ? (
                                <Form.Select
                                  name={field.name}
                                  value={formData[field.name] || ''}
                                  onChange={handleChange}
                                  required={field.required}
                                  size="sm"
                                >
                                  <option value="">Select {field.label}</option>
                                  {field.options?.map(opt => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </Form.Select>
                              ) : field.type === 'textarea' ? (
                                <Form.Control
                                  as="textarea"
                                  rows={3}
                                  name={field.name}
                                  value={formData[field.name] || ''}
                                  onChange={handleChange}
                                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                                  required={field.required}
                                  size="sm"
                                />
                              ) : (
                                <Form.Control
                                  type={field.type}
                                  name={field.name}
                                  value={formData[field.name] || ''}
                                  onChange={handleChange}
                                  placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                                  required={field.required}
                                  size="sm"
                                />
                              )}
                            </Form.Group>
                          </Col>
                        ))}
                      </Row>
                    </Card.Body>
                  </Card>
                );
              })}

              <div className="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-4">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate('/employee/update-requests')}
                  className="order-2 order-sm-1"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting}
                  className="d-inline-flex align-items-center order-1 order-sm-2"
                >
                  {submitting ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      <span className="d-none d-sm-inline">Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" size={12} />
                      Submit for Approval
                    </>
                  )}
                </Button>
              </div>
            </Form>
          )}

          {/* Document Upload Tab */}
          {activeTab === 'documents' && isDocumentRequest && documentTypes.length > 0 && (
            <EmployeeDocumentUpload
              requestId={requestId}
              documentTypes={documentTypes}
              existingDocuments={existingDocuments}
              onComplete={handleDocumentComplete}
            />
          )}

          {/* If only document request */}
          {isDocumentRequest && !hasInfoFields && (
            <EmployeeDocumentUpload
              requestId={requestId}
              documentTypes={documentTypes}
              existingDocuments={existingDocuments}
              onComplete={handleDocumentComplete}
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default EmployeeUpdateForm;