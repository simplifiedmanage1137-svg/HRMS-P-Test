// src/components/Employee/EmployeeUpdateSection.jsx
import React, { useState, useEffect } from 'react';
import {
  Card, Button, Form, Alert, Spinner,
  Row, Col, Badge, Tab, Nav
} from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import {
  FaEdit,
  FaSave,
  FaTimes,
  FaInfoCircle,
  FaCheckCircle,
  FaExclamationTriangle,
  FaHourglassHalf,
  FaUser,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaUniversity,
  FaBriefcase,
  FaFileAlt
} from 'react-icons/fa';

const EmployeeUpdateSection = () => {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (user?.employeeId) {
      fetchPendingRequests();
    }
  }, [user]);

  const fetchPendingRequests = async () => {
    try {
      setFetching(true);
      const response = await axios.get(API_ENDPOINTS.ADMIN_UPDATES_EMPLOYEE_REQUESTS(user.employeeId));
      setPendingRequests(response.data);
      setMessage({ type: '', text: '' });
    } catch (error) {
      console.error('Error fetching requests:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to load update requests'
      });
    } finally {
      setFetching(false);
    }
  };

  const handleEdit = (request) => {
    setSelectedRequest(request);
    // Fetch current employee data
    fetchCurrentEmployeeData();
    setMessage({ type: '', text: '' });
  };

  const fetchCurrentEmployeeData = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user.employeeId));
      setFormData(response.data);
    } catch (error) {
      console.error('Error fetching employee data:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to load current employee data'
      });
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      await axios.post(API_ENDPOINTS.ADMIN_UPDATES_SUBMIT, {
        requestId: selectedRequest._id,
        updatedData: formData
      });

      setMessage({
        type: 'success',
        text: 'Update submitted successfully! Waiting for admin approval.'
      });

      // Clear selected request after successful submission
      setTimeout(() => {
        setSelectedRequest(null);
        fetchPendingRequests();
      }, 2000);

    } catch (error) {
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Error submitting update. Please try again.'
      });
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedRequest(null);
    setFormData({});
    setMessage({ type: '', text: '' });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge bg="warning" pill className="d-inline-flex align-items-center"><FaHourglassHalf className="me-1" /> Pending</Badge>;
      case 'approved':
        return <Badge bg="success" pill className="d-inline-flex align-items-center"><FaCheckCircle className="me-1" /> Approved</Badge>;
      case 'rejected':
        return <Badge bg="danger" pill className="d-inline-flex align-items-center"><FaExclamationTriangle className="me-1" /> Rejected</Badge>;
      default:
        return <Badge bg="secondary" pill>{status}</Badge>;
    }
  };

  if (fetching) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '400px' }}>
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted small">Loading update requests...</p>
        </div>
      </div>
    );
  }

  if (!pendingRequests.length && !selectedRequest) {
    return (
      <Card className="border-0 shadow-sm">
        <Card.Body className="text-center py-5">
          <div className="mb-3">
            <FaInfoCircle size={50} className="text-muted opacity-50" />
          </div>
          <h5 className="small">No Pending Update Requests</h5>
          <p className="text-muted small mb-0">
            You don't have any pending update requests from admin at the moment.
          </p>
        </Card.Body>
      </Card>
    );
  }

  return (
    <div className="p-2 p-md-3 p-lg-4">
      <h5 className="mb-4 d-flex align-items-center">
        <FaEdit className="me-2 text-primary" />
        Pending Update Requests
      </h5>

      {/* Message Alert */}
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-4 py-2"
        >
          <div className="d-flex align-items-center">
            {message.type === 'success' && <FaCheckCircle className="me-2 flex-shrink-0" />}
            {message.type === 'danger' && <FaExclamationTriangle className="me-2 flex-shrink-0" />}
            <span className="small">{message.text}</span>
          </div>
        </Alert>
      )}

      {selectedRequest ? (
        // Edit Form View
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-white py-2 py-md-3 d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
            <div>
              <h6 className="mb-1 small">Edit Your Information</h6>
              <small className="text-muted d-block">
                Request ID: #{selectedRequest._id?.slice(-6) || 'N/A'}
              </small>
            </div>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={handleCancel}
              className="d-inline-flex align-items-center ms-0 ms-md-auto"
            >
              <FaTimes className="me-2" size={12} />
              Cancel
            </Button>
          </Card.Header>
          <Card.Body className="p-2 p-md-3">
            <form onSubmit={handleSubmit}>
              {/* Tabs for different sections - Scrollable on mobile */}
              <Nav variant="tabs" className="mb-3 flex-nowrap overflow-auto" activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
                <Nav.Item>
                  <Nav.Link eventKey="pending" className="small text-nowrap">
                    <FaUser className="me-2" size={12} />
                    Personal
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="contact" className="small text-nowrap">
                    <FaEnvelope className="me-2" size={12} />
                    Contact
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="address" className="small text-nowrap">
                    <FaMapMarkerAlt className="me-2" size={12} />
                    Address
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="employment" className="small text-nowrap">
                    <FaBriefcase className="me-2" size={12} />
                    Employment
                  </Nav.Link>
                </Nav.Item>
                <Nav.Item>
                  <Nav.Link eventKey="bank" className="small text-nowrap">
                    <FaUniversity className="me-2" size={12} />
                    Bank
                  </Nav.Link>
                </Nav.Item>
              </Nav>

              {/* Personal Information Tab */}
              {activeTab === 'pending' && (
                <div>
                  <h6 className="mb-3 small">Personal Information</h6>
                  <Row className="g-2 mb-3">
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">First Name</Form.Label>
                        <Form.Control
                          type="text"
                          name="first_name"
                          value={formData.first_name || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Last Name</Form.Label>
                        <Form.Control
                          type="text"
                          name="last_name"
                          value={formData.last_name || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-2 mb-3">
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Date of Birth</Form.Label>
                        <Form.Control
                          type="date"
                          name="dob"
                          value={formData.dob || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Blood Group</Form.Label>
                        <Form.Select
                          name="blood_group"
                          value={formData.blood_group || ''}
                          onChange={handleInputChange}
                          size="sm"
                        >
                          <option value="">Select Blood Group</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Contact Information Tab */}
              {activeTab === 'contact' && (
                <div>
                  <h6 className="mb-3 small">Contact Information</h6>
                  <Row className="g-2 mb-3">
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Email</Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={formData.email || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Phone</Form.Label>
                        <Form.Control
                          type="tel"
                          name="phone"
                          value={formData.phone || ''}
                          onChange={handleInputChange}
                          size="sm"
                          placeholder="10 digit mobile number"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Address Tab */}
              {activeTab === 'address' && (
                <div>
                  <h6 className="mb-3 small">Address</h6>
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-semibold">Address</Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={2}
                      name="address"
                      value={formData.address || ''}
                      onChange={handleInputChange}
                      size="sm"
                      placeholder="Full address"
                    />
                  </Form.Group>

                  <Row className="g-2 mb-3">
                    <Col xs={12} md={4}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">City</Form.Label>
                        <Form.Control
                          type="text"
                          name="city"
                          value={formData.city || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">State</Form.Label>
                        <Form.Control
                          type="text"
                          name="state"
                          value={formData.state || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Pincode</Form.Label>
                        <Form.Control
                          type="text"
                          name="pincode"
                          value={formData.pincode || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              )}

              {/* Employment Details Tab */}
              {activeTab === 'employment' && (
                <div>
                  <h6 className="mb-3 small">Employment Details</h6>
                  <Row className="g-2 mb-3">
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Designation</Form.Label>
                        <Form.Control
                          type="text"
                          name="designation"
                          value={formData.designation || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Department</Form.Label>
                        <Form.Control
                          type="text"
                          name="department"
                          value={formData.department || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-2 mb-3">
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Employment Type</Form.Label>
                        <Form.Select
                          name="employment_type"
                          value={formData.employment_type || ''}
                          onChange={handleInputChange}
                          size="sm"
                        >
                          <option value="">Select Type</option>
                          <option value="Full Time">Full Time</option>
                          <option value="Part Time">Part Time</option>
                          <option value="Contract">Contract</option>
                          <option value="Intern">Intern</option>
                          <option value="Probation">Probation</option>
                        </Form.Select>
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Shift Timing</Form.Label>
                        <Form.Control
                          type="text"
                          name="shift_timing"
                          value={formData.shift_timing || ''}
                          onChange={handleInputChange}
                          size="sm"
                          placeholder="e.g., 9:00 AM - 6:00 PM"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-semibold">Reporting Manager</Form.Label>
                    <Form.Control
                      type="text"
                      name="reporting_manager"
                      value={formData.reporting_manager || ''}
                      onChange={handleInputChange}
                      size="sm"
                    />
                  </Form.Group>
                </div>
              )}

             // In EmployeeUpdateSection.jsx - Update the bank section
              {activeTab === 'bank' && (
                <div>
                  <h6 className="mb-3 small">Bank Details & ID Proofs</h6>
                  <Row className="g-2 mb-3">
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Bank Account Name</Form.Label>
                        <Form.Control
                          type="text"
                          name="bank_account_name"
                          value={formData.bank_account_name || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={6}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Account Number</Form.Label>
                        <Form.Control
                          type="text"
                          name="account_number"
                          value={formData.account_number || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  <Row className="g-2 mb-3">
                    <Col xs={12} md={4}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">IFSC Code</Form.Label>
                        <Form.Control
                          type="text"
                          name="ifsc_code"
                          value={formData.ifsc_code || ''}
                          onChange={handleInputChange}
                          size="sm"
                          placeholder="e.g., SBIN0001234"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">Branch Name</Form.Label>
                        <Form.Control
                          type="text"
                          name="branch_name"
                          value={formData.branch_name || ''}
                          onChange={handleInputChange}
                          size="sm"
                        />
                      </Form.Group>
                    </Col>
                    <Col xs={12} md={4}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">PAN Number</Form.Label>
                        <Form.Control
                          type="text"
                          name="pan_number"
                          value={formData.pan_number || ''}
                          onChange={handleInputChange}
                          size="sm"
                          placeholder="e.g., ABCDE1234F"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* ✅ Added Aadhar Card Field */}
                  <Row className="g-2 mb-3">
                    <Col xs={12}>
                      <Form.Group>
                        <Form.Label className="small fw-semibold">
                          <FaFileAlt className="me-1 text-primary" size={12} />
                          Aadhar Card Number
                        </Form.Label>
                        <Form.Control
                          type="text"
                          name="aadhar_number"
                          value={formData.aadhar_number || ''}
                          onChange={handleInputChange}
                          size="sm"
                          placeholder="12-digit Aadhar number (e.g., 1234 5678 9012)"
                          maxLength="14"
                        />
                        <Form.Text className="text-muted small">
                          Enter 12-digit Aadhar number (spaces and dashes will be auto-formatted)
                        </Form.Text>
                      </Form.Group>
                    </Col>
                  </Row>
                </div>
              )}

              <div className="text-center text-md-end mt-4">
                <Button
                  type="submit"
                  variant="success"
                  disabled={loading}
                  className="px-4 w-100 w-md-auto d-inline-flex align-items-center justify-content-center"
                  size="sm"
                >
                  {loading ? (
                    <>
                      <Spinner size="sm" animation="border" className="me-2" />
                      <span className="d-none d-sm-inline">Submitting...</span>
                    </>
                  ) : (
                    <>
                      <FaSave className="me-2" size={12} />
                      Submit Update for Approval
                    </>
                  )}
                </Button>
              </div>
            </form>
          </Card.Body>
        </Card>
      ) : (
        // List View of Pending Requests
        <Row className="g-3">
          {pendingRequests.map(request => (
            <Col xs={12} md={6} lg={4} key={request._id} className="mb-3">
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white py-2">
                  <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                    <small className="fw-semibold">Request #{request._id?.slice(-6)}</small>
                    {getStatusBadge(request.status)}
                  </div>
                </Card.Header>
                <Card.Body className="p-2 p-md-3">
                  <div className="mb-3">
                    <small className="text-muted d-block mb-2">Fields to Update:</small>
                    <div className="d-flex flex-wrap gap-1">
                      {request.requestedFields?.map(field => (
                        <Badge key={field} bg="light" text="dark" className="px-2 py-1 small">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="mb-2">
                    <small className="text-muted d-block">Requested on:</small>
                    <small className="fw-semibold d-block">{formatDate(request.createdAt)}</small>
                  </div>

                  {request.notes && (
                    <div className="bg-light p-2 rounded small mb-3">
                      <FaInfoCircle className="text-muted me-1 flex-shrink-0" size={10} />
                      <span className="text-wrap">{request.notes}</span>
                    </div>
                  )}

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-100 d-inline-flex align-items-center justify-content-center"
                    onClick={() => handleEdit(request)}
                  >
                    <FaEdit className="me-2" size={12} />
                    Edit Information
                  </Button>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default EmployeeUpdateSection;