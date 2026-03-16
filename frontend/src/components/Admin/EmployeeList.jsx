// components/Admin/EmployeeList.jsx
import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Alert, Badge, Spinner } from 'react-bootstrap';
import { FaEdit, FaTrash, FaEye, FaPlus, FaDownload, FaFilePdf, FaFileImage, FaFileAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import EmployeeProfileView from './EmployeeProfileView';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [selectedEmployeeForDocs, setSelectedEmployeeForDocs] = useState(null);
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const navigate = useNavigate();
  const { user } = useAuth();
  const { employeeUpdate, showNotification } = useNotification();

  useEffect(() => {
    fetchEmployees();
  }, []);

  // Refresh employees when update occurs
  useEffect(() => {
    if (employeeUpdate) {
      fetchEmployees();
    }
  }, [employeeUpdate]);

  // EmployeeList.jsx - Updated fetchEmployees to get only active employees

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      // Add filter to get only active employees
      const response = await axios.get(`${API_ENDPOINTS.EMPLOYEES}?active=true`);

      console.log('🔍 API Response:', response);

      let employeesData = [];

      if (Array.isArray(response.data)) {
        employeesData = response.data;
      } else if (response.data && response.data.data && Array.isArray(response.data.data)) {
        employeesData = response.data.data;
      } else {
        employeesData = [];
      }

      // Filter out inactive employees on frontend as backup
      employeesData = employeesData.filter(emp => emp.is_active !== false);

      console.log('✅ Active employees:', employeesData.length);
      setEmployees(employeesData);
      setError('');
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      setError(error.response?.data?.message || 'Failed to load employees');
      showNotification(error.response?.data?.message || 'Failed to load employees', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeDocuments = async (employee) => {
    try {
      setDocLoading(true);
      setSelectedEmployeeForDocs(employee);

      console.log('Fetching documents for employee:', employee.employee_id);
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_DOCUMENTS(employee.employee_id));
      console.log('Documents received:', response.data);

      // Process documents - filter out null/empty values
      const docs = Object.entries(response.data)
        .filter(([key, value]) => value && value !== 'null' && value !== '')
        .map(([key, value]) => ({
          type: key,
          filename: value,
          displayName: formatDocumentName(key),
          icon: getDocumentIcon(key, value)
        }));

      console.log('Processed documents:', docs);
      setEmployeeDocuments(docs);
      setShowDocumentModal(true);
    } catch (error) {
      console.error('Error fetching documents:', error);
      showNotification(error.response?.data?.message || 'Failed to load documents', 'danger');
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

  // View Document Function - Using blob method
  const handleViewDocument = async (doc) => {
    try {
      if (!selectedEmployeeForDocs) {
        showNotification('Employee information not found', 'danger');
        return;
      }

      console.log('Viewing document:', doc);
      console.log('Employee ID:', selectedEmployeeForDocs.employee_id);

      setDocLoading(true);

      // Make API call with responseType blob (token will be sent automatically via axios)
      const response = await axios.get(
        API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(selectedEmployeeForDocs.employee_id, doc.type),
        {
          responseType: 'blob',
          params: { inline: true } // Tell backend to send inline disposition
        }
      );

      // Create blob from response
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream'
      });

      // Create object URL
      const url = window.URL.createObjectURL(blob);

      // Open in new tab
      window.open(url, '_blank');

      // Clean up after some time
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

    } catch (error) {
      console.error('Error viewing document:', error);
      showNotification(error.response?.data?.message || 'Failed to view document', 'danger');
    } finally {
      setDocLoading(false);
    }
  };

  // Download Document Function
  const handleDownloadDocument = async (doc) => {
    try {
      if (!selectedEmployeeForDocs) {
        showNotification('Employee information not found', 'danger');
        return;
      }

      setDocLoading(true);
      console.log('Downloading document:', doc);

      const response = await axios.get(
        API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(selectedEmployeeForDocs.employee_id, doc.type),
        {
          responseType: 'blob',
          headers: {
            'Accept': '*/*'
          }
        }
      );

      // Create blob from response
      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream'
      });

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = window.document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.filename);
      window.document.body.appendChild(link);
      link.click();

      // Clean up
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
        window.document.body.removeChild(link);
      }, 100);

      showNotification('Document downloaded successfully!', 'success');
    } catch (error) {
      console.error('Error downloading document:', error);
      showNotification(error.response?.data?.message || 'Failed to download document', 'danger');
    } finally {
      setDocLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;

    setDeleting(true);
    try {
      await axios.delete(API_ENDPOINTS.EMPLOYEE_DELETE(selectedEmployee.id));
      setShowDeleteModal(false);
      await fetchEmployees();
      showNotification(`Employee "${selectedEmployee.first_name} ${selectedEmployee.last_name}" deleted successfully!`, 'success');
      setSelectedEmployee(null);
    } catch (error) {
      console.error('Error deleting employee:', error);
      setError(error.response?.data?.message || 'Failed to delete employee');
      showNotification(error.response?.data?.message || 'Failed to delete employee', 'danger');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = (employee) => {
    if (user?.role === 'admin') {
      navigate(`/admin/edit-employee/${employee.id}`);
    }
  };

  const handleViewProfile = (employee) => {
    setSelectedEmployeeId(employee.id);
    setShowProfileModal(true);
  };

  const handleViewDocuments = (employee) => {
    fetchEmployeeDocuments(employee);
  };

  const handleDeleteClick = (employee) => {
    setSelectedEmployee(employee);
    setShowDeleteModal(true);
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedEmployee(null);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">
          Employee Management
        </h4>
        {user?.role === 'admin' && (
          <Button variant="dark" size="sm" onClick={() => navigate('/admin/add-employee')}>
            <FaPlus className="me-2" size={12} /> Add Employee
          </Button>
        )}
      </div>

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-3 py-2">
          <small>{error}</small>
        </Alert>
      )}

      <Card className="border-0 shadow-sm">
        <Card.Header className="bg-light py-2 d-flex justify-content-between align-items-center">
          <h5 className="mb-0 fw-semibold">
            Employee List
          </h5>
          <Badge bg="secondary" pill>
            Total: {employees.length} Employees
          </Badge>
        </Card.Header>
        <Card.Body className="p-0">
          {/* Table with Vertical Scroll */}
          <div className="table-responsive" style={{ maxHeight: '230px', overflowY: 'auto' }}>
            <Table hover striped className="mb-0 small">
              <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                <tr>
                  <th className="text-nowrap text-dark fw-normal">Sr No</th>
                  <th className="text-nowrap text-dark fw-normal">Employee ID</th>
                  <th className="text-nowrap text-dark fw-normal">Name</th>
                  <th className="text-nowrap text-dark fw-normal">Department</th>
                  <th className="text-nowrap text-dark fw-normal">Designation</th>
                  <th className="text-nowrap text-dark fw-normal">Employment Type</th>
                  <th className="text-nowrap text-dark fw-normal">Joining Date</th>
                  <th className="text-nowrap text-dark fw-normal">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.length > 0 ? (
                  employees.map((emp, index) => (
                    <tr key={emp.id}>
                      <td className='text-center'>{index + 1}</td>
                      <td>
                        <Badge bg="light" text="dark" className="small">
                          {emp.employee_id}
                        </Badge>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '150px' }} title={`${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`}>
                        {emp.first_name} {emp.middle_name} {emp.last_name}
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '120px' }} title={emp.department}>
                        {emp.department}
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '120px' }} title={emp.designation}>
                        {emp.designation}
                      </td>
                      <td>
                        <Badge bg={emp.employment_type === 'Full Time' ? 'success' : 'info'} className="px-2 py-1">
                          {emp.employment_type}
                        </Badge>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '100px' }} title={formatDate(emp.joining_date)}>
                        {formatDate(emp.joining_date)}
                      </td>
                      <td>
                        <div className="d-flex gap-2">
                          {/* View Profile Icon */}
                          <FaEye
                            size={14}
                            className="text-secondary"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleViewProfile(emp)}
                            title="View Full Profile"
                          />

                          {/* View Documents Icon */}
                          <FaFileAlt
                            size={14}
                            className="text-info"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleViewDocuments(emp)}
                            title="View Documents"
                          />

                          {/* Edit Icon - Only for admin */}
                          {user?.role === 'admin' && (
                            <FaEdit
                              size={14}
                              className="text-secondary"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleEdit(emp)}
                              title="Edit Employee"
                            />
                          )}

                          {/* Delete Icon - Only for admin */}
                          {user?.role === 'admin' && (
                            <FaTrash
                              size={14}
                              className="text-danger"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleDeleteClick(emp)}
                              title="Delete Employee"
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="text-center py-4">
                      <p className="text-muted small mb-3">No employees found</p>
                      {user?.role === 'admin' && (
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => navigate('/admin/add-employee')}
                        >
                          Add your first employee
                        </Button>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Employee Profile View Modal */}
      <EmployeeProfileView
        show={showProfileModal}
        onHide={() => setShowProfileModal(false)}
        employeeId={selectedEmployeeId}
      />

      {/* Documents View Modal */}
      <Modal show={showDocumentModal} onHide={() => setShowDocumentModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-info text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold">
            <FaFileAlt className="me-2" size={14} />
            Employee Documents: {selectedEmployeeForDocs?.first_name} {selectedEmployeeForDocs?.last_name}
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
                    <th className="small text-dark text-center">Actions</th>
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
                          title="Download Document"
                        >
                          <FaDownload size={12} className="me-1" />
                          Download
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
              <p className="text-muted small mb-0">No documents found for this employee</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowDocumentModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={handleCancelDelete} centered backdrop="static">
        <Modal.Header closeButton className="bg-danger text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold">
            <FaTrash className="me-2" size={12} />
            Confirm Delete
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <div className="text-center mb-3">
            <FaTrash size={40} className="text-danger mb-2" />
            <p className="mb-2">Are you sure you want to delete this employee?</p>
          </div>

          {selectedEmployee && (
            <div className="alert alert-warning py-2 small">
              <strong>Employee Details:</strong><br />
              Name: {selectedEmployee.first_name} {selectedEmployee.last_name}<br />
              ID: {selectedEmployee.employee_id}<br />
              Department: {selectedEmployee.department}
            </div>
          )}

          <p className="text-danger mb-0 small fw-bold">
            <small>⚠️ This action cannot be undone. All data associated with this employee will be permanently removed.</small>
          </p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleCancelDelete}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Deleting...
              </>
            ) : (
              <>
                <FaTrash className="me-2" size={10} />
                Yes, Delete Employee
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EmployeeList;