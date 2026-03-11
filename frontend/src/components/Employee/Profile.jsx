// components/Employee/Profile.jsx
import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Badge, Spinner, Alert, Tab, Nav, Table } from 'react-bootstrap';
import { 
  FaUserCircle, 
  FaCalendar, 
  FaBriefcase, 
  FaMoneyBill, 
  FaClock, 
  FaEnvelope, 
  FaIdCard,
  FaMapMarkerAlt,
  FaFileSignature,
  FaPhoneAlt,
  FaUmbrellaBeach,
  FaRupeeSign,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaEye
} from 'react-icons/fa';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import HolidayCalendar from './HolidayCalendar';

const Profile = () => {
    const { user } = useAuth();
    const { employeeUpdate, clearEmployeeUpdate, showNotification } = useNotification();
    
    const [employee, setEmployee] = useState(null);
    const [leaveBalance, setLeaveBalance] = useState({
        available: '0',
        total_accrued: '0',
        used: '0',
        pending: '0',
        completed_months_in_year: 0,
        message: ''
    });
    const [leaveRequests, setLeaveRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [imageError, setImageError] = useState(false);
    const [activeTab, setActiveTab] = useState('personal');

    useEffect(() => {
        if (user?.employeeId) {
            fetchEmployeeProfile();
            fetchLeaveBalance();
            fetchLeaveRequests();
        }
    }, [user]);

    // Listen for employee updates
    useEffect(() => {
        if (employeeUpdate && employeeUpdate.employeeId === user?.employeeId) {
            fetchEmployeeProfile();
            fetchLeaveBalance();
            clearEmployeeUpdate();
            showNotification('Your profile has been updated!', 'info');
        }
    }, [employeeUpdate, user?.employeeId]);

    const fetchEmployeeProfile = async () => {
        try {
            setLoading(true);
            
            let empData = user?.employeeData;
            if (!empData && user?.employeeId) {
                const response = await axios.get(`http://localhost:5000/api/employees/profile/${user?.employeeId}`);
                empData = response.data;
            }
            
            if (empData) {
                setEmployee(empData);
            }
        } catch (error) {
            console.error('Error fetching profile:', error);
            setError('Failed to load profile data');
            showNotification('Failed to load profile data', 'danger');
        } finally {
            setLoading(false);
        }
    };

    const fetchLeaveBalance = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/leaves/balance/${user?.employeeId}`);
            setLeaveBalance(response.data);
        } catch (error) {
            console.error('Error fetching leave balance:', error);
        }
    };

    const fetchLeaveRequests = async () => {
        try {
            const response = await axios.get(`http://localhost:5000/api/leaves?employee_id=${user?.employeeId}`);
            setLeaveRequests(response.data || []);
        } catch (error) {
            console.error('Error fetching leave requests:', error);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    const formatShortDate = (dateString) => {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });
    };

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    };

    const getLeaveStatusBadge = (status) => {
        switch(status) {
            case 'approved':
                return <Badge bg="success"><FaCheckCircle className="me-1" /> Approved</Badge>;
            case 'pending':
                return <Badge bg="warning"><FaHourglassHalf className="me-1" /> Pending</Badge>;
            case 'rejected':
                return <Badge bg="danger"><FaTimesCircle className="me-1" /> Rejected</Badge>;
            default:
                return <Badge bg="secondary">Unknown</Badge>;
        }
    };

    const handleImageError = () => {
        setImageError(true);
    };

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center vh-100">
                <div className="text-center">
                    <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
                    <p className="mt-3 text-muted small">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return <Alert variant="danger" className="m-4">{error}</Alert>;
    }

    if (!employee) {
        return <Alert variant="warning" className="m-4">No employee data found. Please contact admin.</Alert>;
    }

    return (
        <div className="p-4">
            <h4 className="mb-4">
                <FaUserCircle className="me-2 text-primary" />
                My Profile
            </h4>

            <Card className="mb-4 border-0 shadow-sm">
                <Card.Header className="bg-light py-2">
                    <Nav variant="tabs" defaultActiveKey="personal" onSelect={(k) => setActiveTab(k)}>
                        <Nav.Item>
                            <Nav.Link eventKey="personal" className="text-dark small">
                                Personal Information
                            </Nav.Link>
                        </Nav.Item>
                       
                        <Nav.Item>
                            <Nav.Link eventKey="bank" className="text-dark small">
                                Bank Details
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="salary" className="text-dark small">
                                Salary Information
                            </Nav.Link>
                        </Nav.Item>
                        <Nav.Item>
                            <Nav.Link eventKey="policy" className="text-dark small">
                                Contract Policy
                            </Nav.Link>
                        </Nav.Item>
                    </Nav>
                </Card.Header>
                <Card.Body className="p-3">
                    {activeTab === 'personal' && (
                        <Row>
                            <Col md={4}>
                                {/* Profile Card */}
                                <Card className="text-center mb-3 shadow-sm border-0">
                                    <Card.Body className="p-3">
                                        <div className="mb-2">
                                            {employee.profile_image && !imageError ? (
                                                <img 
                                                    src={`http://localhost:5000/uploads/profiles/${encodeURIComponent(employee.profile_image)}`}
                                                    alt="Profile"
                                                    className="rounded-circle border"
                                                    style={{ 
                                                        width: '100px', 
                                                        height: '100px', 
                                                        objectFit: 'cover',
                                                        border: '3px solid #4e73df'
                                                    }}
                                                    onError={handleImageError}
                                                />
                                            ) : (
                                                <FaUserCircle size={80} className="text-secondary" />
                                            )}
                                        </div>
                                        <h5 className="mb-1">{employee.first_name} {employee.middle_name} {employee.last_name}</h5>
                                        <p className="text-muted small mb-2">{employee.designation}</p>
                                        <Badge bg="dark" className="px-3 py-2 mb-2 small">{employee.employment_type}</Badge>
                                        
                                        <div className="text-start mt-2 small">
                                            <div className="d-flex align-items-center mb-1">
                                                <FaEnvelope className="text-dark me-2" size={10} />
                                                <small>{employee.email}</small>
                                            </div>
                                            <div className="d-flex align-items-center mb-1">
                                                <FaIdCard className="text-dark me-2" size={10} />
                                                <small>ID: {employee.employee_id}</small>
                                            </div>
                                            {employee.emergency_contact && (
                                                <div className="d-flex align-items-center">
                                                    <FaPhoneAlt className="text-dark me-2" size={10} />
                                                    <small>Emergency: {employee.emergency_contact}</small>
                                                </div>
                                            )}
                                        </div>
                                    </Card.Body>
                                </Card>
                            </Col>

                            <Col md={8}>
                                {/* Personal Information */}
                                <Card className="mb-3 shadow-sm border-0">
                                    <Card.Header className="bg-light py-2">
                                        <h6 className="mb-0 small fw-semibold">Personal Details</h6>
                                    </Card.Header>
                                    <Card.Body className="p-2">
                                        <Row className="g-2">
                                            <Col md={6}>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '100px' }}>Full Name:</span>
                                                    <span className="small">{employee.first_name} {employee.middle_name} {employee.last_name}</span>
                                                </div>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '100px' }}>Date of Birth:</span>
                                                    <span className="small">{formatDate(employee.dob)}</span>
                                                </div>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '100px' }}>Department:</span>
                                                    <span className="small">{employee.department}</span>
                                                </div>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '100px' }}>Designation:</span>
                                                    <span className="small">{employee.designation}</span>
                                                </div>
                                            </Col>
                                            <Col md={6}>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '130px' }}>Joining Date:</span>
                                                    <span className="small">{formatDate(employee.joining_date)}</span>
                                                </div>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '130px' }}>Reporting Manager:</span>
                                                    <span className="small">{employee.reporting_manager || 'N/A'}</span>
                                                </div>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '130px' }}>Employment Type:</span>
                                                    <span className="small">{employee.employment_type}</span>
                                                </div>
                                                <div className="d-flex mb-1">
                                                    <span className="text-muted small" style={{ minWidth: '130px' }}>Shift Timing:</span>
                                                    <span className="small">{employee.shift_timing || '9:00 AM - 6:00 PM'}</span>
                                                </div>
                                            </Col>
                                        </Row>
                                    </Card.Body>
                                </Card>

                                {/* Address Card */}
                                {employee.address && (
                                    <Card className="mb-3 shadow-sm border-0">
                                        <Card.Header className="bg-light py-2">
                                            <h6 className="mb-0 small fw-semibold">
                                                <FaMapMarkerAlt className="me-2" size={12} />
                                                Address
                                            </h6>
                                        </Card.Header>
                                        <Card.Body className="p-2">
                                            <p className="mb-0 small">{employee.address}</p>
                                        </Card.Body>
                                    </Card>
                                )}
                            </Col>
                        </Row>
                    )}

                    {activeTab === 'leave' && (
                        <Row>
                            <Col md={4}>
                                {/* Leave Balance Card */}
                                <Card className="mb-3 shadow-sm border-0">
                                    <Card.Header className="bg-primary text-white py-2">
                                        <h6 className="mb-0 small fw-semibold">
                                            <FaUmbrellaBeach className="me-2" size={12} />
                                            Leave Balance
                                        </h6>
                                    </Card.Header>
                                    <Card.Body className="p-3">
                                        <div className="text-center mb-3">
                                            <h1 className="display-4 text-primary fw-bold">{leaveBalance.available}</h1>
                                            <p className="text-muted small">Available Leaves</p>
                                        </div>
                                        
                                        <div className="mb-3">
                                            <div className="d-flex justify-content-between mb-1 small">
                                                <span className="text-muted">Total Accrued:</span>
                                                <span className="fw-semibold">{leaveBalance.total_accrued} days</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-1 small">
                                                <span className="text-muted">Used:</span>
                                                <span className="fw-semibold text-danger">{leaveBalance.used} days</span>
                                            </div>
                                            <div className="d-flex justify-content-between mb-2 small">
                                                <span className="text-muted">Pending:</span>
                                                <span className="fw-semibold text-warning">{leaveBalance.pending} days</span>
                                            </div>

                                            <div className="d-flex justify-content-between mb-2 small">
                                                <span className="text-muted">Months Completed (this year):</span>
                                                <span className="fw-semibold">{leaveBalance.completed_months_in_year || 0}</span>
                                            </div>

                                            {leaveBalance.message && (
                                                <div className="alert alert-info p-2 small mb-2" role="alert">
                                                    {leaveBalance.message}
                                                </div>
                                            )}

                                            <div className="progress" style={{ height: '6px' }}>
                                                <div 
                                                    className="progress-bar bg-success" 
                                                    style={{ width: `${(parseFloat(leaveBalance.used) / parseFloat(leaveBalance.total_accrued) * 100) || 0}%` }}
                                                ></div>
                                            </div>
                                            <small className="text-muted d-block text-center mt-1">
                                                {((parseFloat(leaveBalance.used) / parseFloat(leaveBalance.total_accrued) * 100) || 0).toFixed(1)}% used
                                            </small>
                                        </div>

                                        <Button 
                                            variant="primary" 
                                            size="sm" 
                                            className="w-100"
                                            onClick={() => window.location.href = '/apply-leave'}
                                        >
                                            Apply for Leave
                                        </Button>
                                    </Card.Body>
                                </Card>
                            </Col>

                            <Col md={8}>
                                {/* Leave History */}
                                <Card className="shadow-sm border-0">
                                    <Card.Header className="bg-light py-2">
                                        <h6 className="mb-0 small fw-semibold">Leave History</h6>
                                    </Card.Header>
                                    <Card.Body className="p-0">
                                        {leaveRequests.length > 0 ? (
                                            <div className="table-responsive">
                                                <Table hover size="sm" className="mb-0">
                                                    <thead className="bg-light">
                                                        <tr>
                                                            <th className="small text-dark">Leave Type</th>
                                                            <th className="small text-dark">Duration</th>
                                                            <th className="small text-dark">Date Range</th>
                                                            <th className="small text-dark">Days</th>
                                                            <th className="small text-dark">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {leaveRequests.map((leave, index) => (
                                                            <tr key={leave.id || index}>
                                                                <td className="small">
                                                                    <Badge bg="secondary" className="px-2 py-1">
                                                                        {leave.leave_type}
                                                                    </Badge>
                                                                </td>
                                                                <td className="small">{leave.leave_duration || 'Full Day'}</td>
                                                                <td className="small">
                                                                    {formatShortDate(leave.start_date)}
                                                                    {leave.start_date !== leave.end_date && ` - ${formatShortDate(leave.end_date)}`}
                                                                </td>
                                                                <td className="small fw-bold">{leave.days_count || 1}</td>
                                                                <td className="small">{getLeaveStatusBadge(leave.status)}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </Table>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4">
                                                <FaUmbrellaBeach size={30} className="text-muted mb-2 opacity-50" />
                                                <p className="text-muted small mb-0">No leave requests found</p>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>
                            </Col>
                        </Row>
                    )}

                    {activeTab === 'bank' && (
                        <Card className="border-0">
                            <Card.Body className="p-2">
                                <Row>
                                    <Col md={6}>
                                        <div className="d-flex mb-2">
                                            <span className="text-muted small" style={{ minWidth: '120px' }}>Account Name:</span>
                                            <span className="small fw-semibold">{employee.bank_account_name}</span>
                                        </div>
                                        <div className="d-flex mb-2">
                                            <span className="text-muted small" style={{ minWidth: '120px' }}>Account Number:</span>
                                            <span className="small fw-semibold">{employee.account_number}</span>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="d-flex mb-2">
                                            <span className="text-muted small" style={{ minWidth: '120px' }}>IFSC Code:</span>
                                            <span className="small fw-semibold">{employee.ifsc_code}</span>
                                        </div>
                                        <div className="d-flex mb-2">
                                            <span className="text-muted small" style={{ minWidth: '120px' }}>Branch Name:</span>
                                            <span className="small fw-semibold">{employee.branch_name}</span>
                                        </div>
                                    </Col>
                                </Row>
                            </Card.Body>
                        </Card>
                    )}

                    {activeTab === 'salary' && (
                        <Card className="border-0">
                            <Card.Body className="p-2">
                                <Row>
                                    <Col md={6}>
                                        <div className="d-flex mb-2">
                                            <span className="text-muted small" style={{ minWidth: '120px' }}>Gross Salary:</span>
                                            <span className="small fw-semibold text-primary">{formatCurrency(employee.gross_salary)}</span>
                                        </div>
                                    </Col>
                                    <Col md={6}>
                                        <div className="d-flex mb-2">
                                            <span className="text-muted small" style={{ minWidth: '120px' }}>In-hand Salary:</span>
                                            <span className="small fw-semibold text-success">{formatCurrency(employee.in_hand_salary)}</span>
                                        </div>
                                    </Col>
                                </Row>
                                <div className="mt-2 p-2 bg-light rounded small">
                                    <FaRupeeSign className="me-2 text-primary" size={10} />
                                    <span className="text-muted">Monthly Deduction: ₹200 (Fixed)</span>
                                </div>
                            </Card.Body>
                        </Card>
                    )}

                    {activeTab === 'policy' && (
                        <Card className="border-0">
                            <Card.Header className="bg-light py-2">
                                <h6 className="mb-0 small fw-semibold">
                                    <FaFileSignature className="me-2" size={12} />
                                    Employment Contract Policy
                                </h6>
                            </Card.Header>
                            <Card.Body className="p-3">
                                {employee.contract_policy ? (
                                    <div 
                                        className="bg-white p-3 rounded border"
                                        style={{ 
                                            maxHeight: '400px', 
                                            overflowY: 'auto',
                                            fontSize: '0.85rem',
                                            whiteSpace: 'pre-line',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        {employee.contract_policy}
                                    </div>
                                ) : (
                                    <div className="text-center py-4">
                                        <FaFileSignature size={30} className="text-muted mb-2 opacity-50" />
                                        <p className="text-muted small mb-0">No contract policy found</p>
                                    </div>
                                )}
                            </Card.Body>
                        </Card>
                    )}
                </Card.Body>
            </Card>

            {/* Holiday Calendar Card */}
            <Card className="mb-4 shadow-sm border-0">
                <Card.Body className="p-0">
                    <HolidayCalendar employeeRegion={employee.region || 'All'} />
                </Card.Body>
            </Card>
        </div>
    );
};

export default Profile;