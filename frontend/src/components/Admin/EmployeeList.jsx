// components/Admin/EmployeeList.jsx - Fixed Header
import React, { useState, useEffect } from 'react';
import { Table, Button, Card, Modal, Alert, Badge, Spinner, Form, InputGroup } from 'react-bootstrap';
import { FaEdit, FaTrash, FaEye, FaPlus, FaDownload, FaFilePdf, FaFileImage, FaFileAlt, FaSearch, FaTimes, FaSyncAlt } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import EmployeeProfileView from './EmployeeProfileView';

const EmployeeList = () => {
  const [employees, setEmployees] = useState([]);
  const [filteredEmployees, setFilteredEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
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

  // Filter employees whenever searchTerm or employees change
  useEffect(() => {
    filterEmployees();
  }, [searchTerm, employees]);

  // Refresh employees when update occurs
  useEffect(() => {
    if (employeeUpdate) {
      fetchEmployees();
    }
  }, [employeeUpdate]);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
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

      // Filter out inactive employees
      employeesData = employeesData.filter(emp => emp.is_active !== false);

      console.log('✅ Active employees:', employeesData.length);
      setEmployees(employeesData);
      setFilteredEmployees(employeesData);
      setError('');
    } catch (error) {
      console.error('❌ Error fetching employees:', error);
      setError(error.response?.data?.message || 'Failed to load employees');
      showNotification(error.response?.data?.message || 'Failed to load employees', 'danger');
    } finally {
      setLoading(false);
    }
  };

  const filterEmployees = () => {
    if (!searchTerm.trim()) {
      setFilteredEmployees(employees);
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();
    const filtered = employees.filter(emp => {
      const employeeId = (emp.employee_id || '').toLowerCase();
      const firstName = (emp.first_name || '').toLowerCase();
      const lastName = (emp.last_name || '').toLowerCase();
      const fullName = `${emp.first_name || ''} ${emp.last_name || ''}`.toLowerCase();
      const middleName = (emp.middle_name || '').toLowerCase();
      const department = (emp.department || '').toLowerCase();
      const designation = (emp.designation || '').toLowerCase();

      return employeeId.includes(searchLower) ||
             firstName.includes(searchLower) ||
             lastName.includes(searchLower) ||
             fullName.includes(searchLower) ||
             middleName.includes(searchLower) ||
             department.includes(searchLower) ||
             designation.includes(searchLower);
    });

    setFilteredEmployees(filtered);
    console.log(`🔍 Search: "${searchTerm}" found ${filtered.length} employees`);
  };

  const clearSearch = () => {
    setSearchTerm('');
  };

  const fetchEmployeeDocuments = async (employee) => {
    try {
      setDocLoading(true);
      setSelectedEmployeeForDocs(employee);

      console.log('Fetching documents for employee:', employee.employee_id);
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_DOCUMENTS(employee.employee_id));
      console.log('Documents received:', response.data);

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

  const handleViewDocument = async (doc) => {
    try {
      if (!selectedEmployeeForDocs) {
        showNotification('Employee information not found', 'danger');
        return;
      }

      console.log('Viewing document:', doc);
      console.log('Employee ID:', selectedEmployeeForDocs.employee_id);

      setDocLoading(true);

      const response = await axios.get(
        API_ENDPOINTS.EMPLOYEE_DOCUMENT_BY_TYPE(selectedEmployeeForDocs.employee_id, doc.type),
        {
          responseType: 'blob',
          params: { inline: true }
        }
      );

      const blob = new Blob([response.data], {
        type: response.headers['content-type'] || 'application/octet-stream'
      });

      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

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
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading employees...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 p-md-3 p-lg-4">
      {/* Header - Responsive */}
      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center mb-4 gap-3">
        <h4 className="mb-0">Employee Management</h4>
        {user?.role === 'admin' && (
          <Button variant="dark" size="sm" onClick={() => navigate('/admin/add-employee')} className="ms-0 ms-sm-auto">
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
        <Card.Header className="bg-light py-2">
          {/* FIXED: Single line header with Employee List and Search */}
          <div className="d-flex justify-content-between align-items-center gap-2">
            <h5 className="mb-0 fw-semibold text-nowrap">Employee List</h5>
            <div className="d-flex gap-2 flex-shrink-0">
              <InputGroup size="sm" style={{ width: '280px' }}>
                <InputGroup.Text className="bg-white">
                  <FaSearch size={12} className="text-muted" />
                </InputGroup.Text>
                <Form.Control
                  type="text"
                  placeholder="Search by ID, Name, Department..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-start-0"
                />
                {searchTerm && (
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={clearSearch}
                    className="border-start-0"
                  >
                    <FaTimes size={12} />
                  </Button>
                )}
              </InputGroup>
              <Button
                variant="outline-primary"
                size="sm"
                onClick={fetchEmployees}
                title="Refresh List"
                className="flex-shrink-0"
              >
                <FaSyncAlt size={12} />
              </Button>
            </div>
          </div>
        </Card.Header>
        <Card.Body className="p-0">
          {/* Search Result Summary */}
          {searchTerm && (
            <div className="px-3 py-2 bg-light border-bottom">
              <small className="text-muted">
                <FaSearch className="me-1" size={10} />
                Found <strong>{filteredEmployees.length}</strong> employee{filteredEmployees.length !== 1 ? 's' : ''} matching "{searchTerm}"
                <Button
                  variant="link"
                  size="sm"
                  onClick={clearSearch}
                  className="p-0 ms-2 text-decoration-none"
                >
                  Clear search
                </Button>
              </small>
            </div>
          )}

          {/* Table with Vertical Scroll */}
          <div 
            className="table-responsive" 
            style={{ 
              maxHeight: 'calc(100vh - 320px)', 
              minHeight: '400px',
              overflowY: 'auto',
              overflowX: 'auto'
            }}
          >
            <Table hover striped className="mb-0 small">
              <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                <tr>
                  <th className="text-nowrap text-dark fw-normal text-center" style={{ width: '5%' }}>Sr No</th>
                  <th className="text-nowrap text-dark fw-normal" style={{ width: '12%' }}>Employee ID</th>
                  <th className="text-nowrap text-dark fw-normal" style={{ width: '15%' }}>Name</th>
                  <th className="text-nowrap text-dark fw-normal d-none d-md-table-cell" style={{ width: '12%' }}>Department</th>
                  <th className="text-nowrap text-dark fw-normal d-none d-lg-table-cell" style={{ width: '15%' }}>Designation</th>
                  <th className="text-nowrap text-dark fw-normal d-none d-sm-table-cell" style={{ width: '10%' }}>Employment Type</th>
                  <th className="text-nowrap text-dark fw-normal d-none d-xl-table-cell" style={{ width: '10%' }}>Joining Date</th>
                  <th className="text-nowrap text-dark fw-normal text-center" style={{ width: '15%' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length > 0 ? (
                  filteredEmployees.map((emp, index) => (
                    <tr key={emp.id}>
                      <td className="text-center">{index + 1}</td>
                      <td>
                        <Badge bg="light" text="dark" className="small">
                          {emp.employee_id}
                        </Badge>
                      </td>
                      <td className="text-truncate" style={{ maxWidth: '150px' }} title={`${emp.first_name} ${emp.middle_name || ''} ${emp.last_name}`}>
                        {emp.first_name} {emp.middle_name} {emp.last_name}
                      </td>
                      <td className="text-truncate d-none d-md-table-cell" style={{ maxWidth: '120px' }} title={emp.department}>
                        {emp.department}
                      </td>
                      <td className="text-truncate d-none d-lg-table-cell" style={{ maxWidth: '150px' }} title={emp.designation}>
                        {emp.designation}
                      </td>
                      <td className="d-none d-sm-table-cell">
                        <Badge bg={emp.employment_type === 'Full Time' ? 'success' : 'info'} className="px-2 py-1">
                          {emp.employment_type === 'Full Time' ? 'Full Time' : emp.employment_type}
                        </Badge>
                      </td>
                      <td className="text-truncate d-none d-xl-table-cell" style={{ maxWidth: '100px' }} title={formatDate(emp.joining_date)}>
                        {formatDate(emp.joining_date)}
                      </td>
                      <td>
                        <div className="d-flex gap-2 gap-md-3 align-items-center justify-content-center flex-wrap">
                          <FaEye
                            size={14}
                            className="text-secondary"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleViewProfile(emp)}
                            title="View Full Profile"
                          />
                          <FaFileAlt
                            size={14}
                            className="text-info"
                            style={{ cursor: 'pointer' }}
                            onClick={() => handleViewDocuments(emp)}
                            title="View Documents"
                          />
                          {user?.role === 'admin' && (
                            <FaEdit
                              size={14}
                              className="text-secondary"
                              style={{ cursor: 'pointer' }}
                              onClick={() => handleEdit(emp)}
                              title="Edit Employee"
                            />
                          )}
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
                      {searchTerm ? (
                        <>
                          <FaSearch size={40} className="text-muted mb-3 opacity-50" />
                          <p className="text-muted small mb-2">No employees found matching "{searchTerm}"</p>
                          <Button
                            variant="link"
                            size="sm"
                            onClick={clearSearch}
                            className="text-decoration-none"
                          >
                            Clear search and show all employees
                          </Button>
                        </>
                      ) : (
                        <>
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
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
          
          {/* Scroll indicator */}
          {filteredEmployees.length > 15 && (
            <div className="text-center py-1 bg-light border-top">
              <small className="text-muted">
                <FaEye size={10} className="me-1" />
                Scroll to view all {filteredEmployees.length} employees
              </small>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Employee Profile View Modal */}
      <EmployeeProfileView
        show={showProfileModal}
        onHide={() => setShowProfileModal(false)}
        employeeId={selectedEmployeeId}
      />

      {/* Documents View Modal */}
      <Modal 
        show={showDocumentModal} 
        onHide={() => setShowDocumentModal(false)} 
        size="lg" 
        centered
        dialogClassName="mx-2 mx-md-auto"
      >
        <Modal.Header closeButton className="bg-info text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold d-flex align-items-center">
            <FaFileAlt className="me-2" size={14} />
            <span className="text-truncate">Documents: {selectedEmployeeForDocs?.first_name} {selectedEmployeeForDocs?.last_name}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2 p-md-3">
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
                    <th className="small text-dark d-none d-sm-table-cell">File Name</th>
                    <th className="small text-dark text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDocuments.map((doc, index) => (
                    <tr key={index}>
                      <td>
                        <div className="d-flex align-items-center">
                          {doc.icon}
                          <span className="ms-2 small fw-semibold text-truncate" style={{ maxWidth: '120px' }}>
                            {doc.displayName}
                          </span>
                        </div>
                      </td>
                      <td className="d-none d-sm-table-cell">
                        <small className="text-muted text-truncate d-block" style={{ maxWidth: '150px' }} title={doc.filename}>
                          {doc.filename}
                        </small>
                      </td>
                      <td className="text-center">
                        <div className="d-flex flex-column flex-sm-row gap-1 gap-sm-2 justify-content-center">
                          <Button
                            variant="outline-info"
                            size="sm"
                            onClick={() => handleViewDocument(doc)}
                            className="px-2 px-sm-3"
                            title="View Document"
                          >
                            <FaEye size={12} className="me-1" />
                            <span className="d-none d-sm-inline">View</span>
                          </Button>
                          <Button
                            variant="outline-success"
                            size="sm"
                            onClick={() => handleDownloadDocument(doc)}
                            className="px-2 px-sm-3"
                            title="Download Document"
                          >
                            <FaDownload size={12} className="me-1" />
                            <span className="d-none d-sm-inline">Download</span>
                          </Button>
                        </div>
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
      <Modal 
        show={showDeleteModal} 
        onHide={handleCancelDelete} 
        centered 
        backdrop="static"
        dialogClassName="mx-2 mx-md-auto"
      >
        <Modal.Header closeButton className="bg-danger text-white py-2">
          <Modal.Title as="h6" className="mb-0 small fw-semibold d-flex align-items-center">
            <FaTrash className="me-2" size={12} />
            Confirm Delete
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-2 p-md-3">
          <div className="text-center mb-3">
            <FaTrash size={40} className="text-danger mb-2" />
            <p className="mb-2">Are you sure you want to delete this employee?</p>
          </div>

          {selectedEmployee && (
            <div className="alert alert-warning py-2 small">
              <strong>Employee Details:</strong><br />
              <span className="d-block text-truncate">Name: {selectedEmployee.first_name} {selectedEmployee.last_name}</span>
              <span className="d-block">ID: {selectedEmployee.employee_id}</span>
              <span className="d-block text-truncate">Department: {selectedEmployee.department}</span>
            </div>
          )}

          <p className="text-danger mb-0 small fw-bold">
            <small>⚠️ This action cannot be undone. All data will be permanently removed.</small>
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
                <span className="d-none d-sm-inline">Deleting...</span>
              </>
            ) : (
              <>
                <FaTrash className="me-2" size={10} />
                <span className="d-none d-sm-inline">Yes, Delete</span>
                <span className="d-inline d-sm-none">Delete</span>
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EmployeeList;