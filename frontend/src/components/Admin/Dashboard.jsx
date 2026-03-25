// src/components/Admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Table, Badge, Spinner, Alert, Form, Button,
  Modal, ButtonGroup
} from 'react-bootstrap';
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaCalendarAlt,
  FaBirthdayCake,
  FaTrophy,
  FaChartLine,
  FaBalanceScale,
  FaSearch,
  FaDownload,
  FaClock,
  FaExclamationTriangle,
  FaCheckCircle,
  FaInfoCircle,
  FaUmbrellaBeach,
  FaSyncAlt,
  FaRegClock,
  FaEye,
  FaEyeSlash,
  FaTimesCircle,
  FaFilter,
  FaBuilding,
  FaUserGraduate,
  FaChartBar,
  FaFileAlt
} from 'react-icons/fa';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
} from 'chart.js';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNavigate } from 'react-router-dom';
import { useNotification } from '../../context/NotificationContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Regularization Requests Component (Inline for completeness)
const RegularizationRequests = ({ onRequestCountChange }) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [approvedTime, setApprovedTime] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [filter, setFilter] = useState('pending');
  const [expandedRequest, setExpandedRequest] = useState(null);
  const { addNotification } = useNotification();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_PENDING_REGULARIZATIONS);
      const requestsData = response.data.requests || [];
      setRequests(requestsData);
      if (onRequestCountChange) {
        onRequestCountChange(requestsData.filter(r => r.status === 'pending').length);
      }
    } catch (error) {
      console.error('Error fetching regularization requests:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to fetch regularization requests'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async () => {
    if (!selectedRequest) return;
    if (!approvedTime) {
      setMessage({ type: 'warning', text: 'Please select clock-out time' });
      return;
    }

    setProcessing(true);
    try {
      await axios.put(
        API_ENDPOINTS.ATTENDANCE_APPROVE_REGULARIZATION(selectedRequest.id),
        {
          approved_clock_out_time: approvedTime,
          admin_notes: adminNotes
        }
      );

      setMessage({ type: 'success', text: 'Regularization request approved successfully!' });
      setShowApproveModal(false);
      setSelectedRequest(null);
      setApprovedTime('');
      setAdminNotes('');
      
      if (addNotification) {
        addNotification({
          employee_id: selectedRequest.employee_id,
          title: 'Regularization Request Approved',
          message: `Your regularization request for ${selectedRequest.attendance_date} has been approved.`,
          type: 'regularization_approved'
        });
      }
      
      fetchRequests();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error approving regularization:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to approve request'
      });
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest) return;

    setProcessing(true);
    try {
      await axios.put(
        API_ENDPOINTS.ATTENDANCE_REJECT_REGULARIZATION(selectedRequest.id),
        { rejection_reason: rejectionReason }
      );

      setMessage({ type: 'success', text: 'Regularization request rejected' });
      setShowRejectModal(false);
      setSelectedRequest(null);
      setRejectionReason('');
      
      if (addNotification) {
        addNotification({
          employee_id: selectedRequest.employee_id,
          title: 'Regularization Request Rejected',
          message: `Your regularization request for ${selectedRequest.attendance_date} has been rejected. Reason: ${rejectionReason || 'Not provided'}`,
          type: 'regularization_rejected'
        });
      }
      
      fetchRequests();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Error rejecting regularization:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || 'Failed to reject request'
      });
    } finally {
      setProcessing(false);
    }
  };

  const formatDateTime = (datetime) => {
    if (!datetime) return 'N/A';
    const date = new Date(datetime);
    return date.toLocaleString('en-US', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <Badge bg="warning" pill className="px-3 py-2">Pending</Badge>;
      case 'approved':
        return <Badge bg="success" pill className="px-3 py-2">Approved</Badge>;
      case 'rejected':
        return <Badge bg="danger" pill className="px-3 py-2">Rejected</Badge>;
      default:
        return <Badge bg="secondary" pill>{status}</Badge>;
    }
  };

  const getFilteredRequests = () => {
    if (filter === 'all') return requests;
    return requests.filter(req => req.status === filter);
  };

  const filteredRequests = getFilteredRequests();
  const pendingCount = requests.filter(r => r.status === 'pending').length;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
        <Spinner animation="border" variant="primary" />
      </div>
    );
  }

  return (
    <div>
      {message.text && (
        <Alert
          variant={message.type}
          onClose={() => setMessage({ type: '', text: '' })}
          dismissible
          className="mb-3"
        >
          {message.text}
        </Alert>
      )}

      <div className="d-flex flex-wrap gap-2 mb-3">
        <ButtonGroup size="sm">
          <Button
            variant={filter === 'pending' ? 'warning' : 'outline-secondary'}
            onClick={() => setFilter('pending')}
          >
            Pending ({requests.filter(r => r.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'approved' ? 'success' : 'outline-secondary'}
            onClick={() => setFilter('approved')}
          >
            Approved ({requests.filter(r => r.status === 'approved').length})
          </Button>
          <Button
            variant={filter === 'rejected' ? 'danger' : 'outline-secondary'}
            onClick={() => setFilter('rejected')}
          >
            Rejected ({requests.filter(r => r.status === 'rejected').length})
          </Button>
          <Button
            variant={filter === 'all' ? 'primary' : 'outline-secondary'}
            onClick={() => setFilter('all')}
          >
            All ({requests.length})
          </Button>
        </ButtonGroup>
        <Button variant="outline-primary" size="sm" onClick={fetchRequests} className="ms-auto">
          <FaSyncAlt className="me-1" size={12} />
          Refresh
        </Button>
      </div>

      {filteredRequests.length === 0 ? (
        <Card className="border-0 shadow-sm">
          <Card.Body className="text-center py-5">
            <FaRegClock size={50} className="text-muted mb-3 opacity-50" />
            <p className="text-muted mb-0">No regularization requests found</p>
            {filter !== 'all' && (
              <Button variant="link" size="sm" onClick={() => setFilter('all')} className="mt-2">
                View all requests
              </Button>
            )}
          </Card.Body>
        </Card>
      ) : (
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-0">
            <div className="table-responsive">
              <Table hover className="mb-0">
                <thead className="bg-light">
                  <tr className="small">
                    <th className="fw-normal text-center">#</th>
                    <th className="fw-normal">Employee</th>
                    <th className="fw-normal d-none d-md-table-cell">Department</th>
                    <th className="fw-normal">Date</th>
                    <th className="fw-normal">Clock In</th>
                    <th className="fw-normal">Requested Clock Out</th>
                    <th className="fw-normal">Status</th>
                    <th className="fw-normal text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRequests.map((request, index) => (
                    <React.Fragment key={request.id}>
                      <tr
                        className={expandedRequest === request.id ? 'table-active' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                      >
                        <td className="small text-center">{index + 1}</td>
                        <td className="small">
                          <div className="fw-semibold text-truncate" style={{ maxWidth: '120px' }}>
                            {request.employee_name}
                          </div>
                          <small className="text-muted">{request.employee_id}</small>
                        </td>
                        <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>
                          {request.department}
                        </td>
                        <td className="small">
                          <Badge bg="light" text="dark" pill className="px-2 py-1">
                            <FaCalendarAlt className="me-1" size={10} />
                            {formatDate(request.attendance_date)}
                          </Badge>
                        </td>
                        <td className="small">
                          <Badge bg="success" pill className="px-2 py-1">
                            <FaClock className="me-1" size={10} />
                            {formatDateTime(request.clock_in_time)}
                          </Badge>
                        </td>
                        <td className="small">
                          <Badge bg="warning" text="dark" pill className="px-2 py-1">
                            <FaRegClock className="me-1" size={10} />
                            {formatDateTime(request.requested_clock_out_time)}
                          </Badge>
                        </td>
                        <td>{getStatusBadge(request.status)}</td>
                        <td className="text-center">
                          {request.status === 'pending' && (
                            <div className="d-flex gap-2 justify-content-center">
                              <Button
                                variant="success"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequest(request);
                                  setApprovedTime(request.requested_clock_out_time);
                                  setShowApproveModal(true);
                                }}
                              >
                                <FaCheckCircle className="me-1" size={12} />
                                Approve
                              </Button>
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRequest(request);
                                  setShowRejectModal(true);
                                }}
                              >
                                <FaTimesCircle className="me-1" size={12} />
                                Reject
                              </Button>
                            </div>
                          )}
                          {request.status !== 'pending' && (
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedRequest(expandedRequest === request.id ? null : request.id);
                              }}
                            >
                              {expandedRequest === request.id ? (
                                <FaEyeSlash className="me-1" size={12} />
                              ) : (
                                <FaEye className="me-1" size={12} />
                              )}
                              Details
                            </Button>
                          )}
                        </td>
                      </tr>
                      {expandedRequest === request.id && (
                        <tr className="bg-light">
                          <td colSpan="8" className="p-3">
                            <Row className="g-3">
                              <Col xs={12} md={6}>
                                <div className="small">
                                  <strong>Reason:</strong>
                                  <p className="text-muted mb-0 mt-1">
                                    {request.reason || 'No reason provided'}
                                  </p>
                                </div>
                              </Col>
                              <Col xs={12} md={6}>
                                <div className="small">
                                  <strong>Requested At:</strong>
                                  <p className="text-muted mb-0 mt-1">
                                    {formatDateTime(request.created_at)}
                                  </p>
                                </div>
                              </Col>
                              {request.status === 'approved' && request.approved_clock_out_time && (
                                <>
                                  <Col xs={12} md={6}>
                                    <div className="small">
                                      <strong>Approved Clock Out:</strong>
                                      <p className="text-success mb-0 mt-1">
                                        {formatDateTime(request.approved_clock_out_time)}
                                      </p>
                                    </div>
                                  </Col>
                                  {request.admin_notes && (
                                    <Col xs={12} md={6}>
                                      <div className="small">
                                        <strong>Admin Notes:</strong>
                                        <p className="text-muted mb-0 mt-1">{request.admin_notes}</p>
                                      </div>
                                    </Col>
                                  )}
                                </>
                              )}
                              {request.status === 'rejected' && request.rejection_reason && (
                                <Col xs={12}>
                                  <div className="small">
                                    <strong>Rejection Reason:</strong>
                                    <p className="text-danger mb-0 mt-1">{request.rejection_reason}</p>
                                  </div>
                                </Col>
                              )}
                            </Row>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Approve Modal */}
      <Modal show={showApproveModal} onHide={() => setShowApproveModal(false)} centered size="lg">
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title className="h6">
            <FaCheckCircle className="me-2" />
            Approve Regularization Request
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedRequest && (
            <>
              <div className="mb-3 p-3 bg-light rounded">
                <Row className="g-3">
                  <Col xs={12} md={6}>
                    <div className="small">
                      <strong>Employee:</strong>
                      <p className="mb-0">{selectedRequest.employee_name}</p>
                      <small className="text-muted">{selectedRequest.employee_id}</small>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="small">
                      <strong>Date:</strong>
                      <p className="mb-0">{formatDate(selectedRequest.attendance_date)}</p>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="small">
                      <strong>Clock In Time:</strong>
                      <p className="mb-0 text-success">{formatDateTime(selectedRequest.clock_in_time)}</p>
                    </div>
                  </Col>
                  <Col xs={12} md={6}>
                    <div className="small">
                      <strong>Requested Clock Out:</strong>
                      <p className="mb-0 text-warning">{formatDateTime(selectedRequest.requested_clock_out_time)}</p>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="small">
                      <strong>Reason:</strong>
                      <p className="mb-0 text-muted">{selectedRequest.reason || 'No reason provided'}</p>
                    </div>
                  </Col>
                </Row>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Clock Out Time *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={approvedTime}
                  onChange={(e) => setApprovedTime(e.target.value)}
                  required
                />
                <small className="text-muted">
                  You can adjust the clock-out time if needed
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Admin Notes (Optional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Add any notes about this approval..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>

              <Alert variant="info" className="small">
                <FaInfoCircle className="me-2" />
                After approval, the employee's attendance will be updated automatically.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowApproveModal(false)}>
            Cancel
          </Button>
          <Button
            variant="success"
            size="sm"
            onClick={handleApprove}
            disabled={processing || !approvedTime}
          >
            {processing ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Processing...
              </>
            ) : (
              <>
                <FaCheckCircle className="me-2" />
                Approve Request
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Reject Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)} centered>
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title className="h6">
            <FaTimesCircle className="me-2" />
            Reject Regularization Request
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedRequest && (
            <>
              <div className="mb-3 p-3 bg-light rounded">
                <Row className="g-3">
                  <Col xs={12}>
                    <div className="small">
                      <strong>Employee:</strong>
                      <p className="mb-0">{selectedRequest.employee_name}</p>
                    </div>
                  </Col>
                  <Col xs={12}>
                    <div className="small">
                      <strong>Date:</strong>
                      <p className="mb-0">{formatDate(selectedRequest.attendance_date)}</p>
                    </div>
                  </Col>
                </Row>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Rejection Reason *</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Please provide a reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  required
                />
                <small className="text-muted">This will be sent to the employee</small>
              </div>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowRejectModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleReject}
            disabled={processing || !rejectionReason}
          >
            {processing ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Processing...
              </>
            ) : (
              <>
                <FaTimesCircle className="me-2" />
                Reject Request
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

// Main AdminDashboard Component
const AdminDashboard = () => {
  const navigate = useNavigate();
  const { todayEvents, fetchTodayEvents } = useNotification();

  const [stats, setStats] = useState({
    total: 0,
    present: 0,
    absent: 0,
    onLeave: 0,
    late: 0,
    early: 0,
    halfDay: 0,
    working: 0
  });

  const [recentEmployees, setRecentEmployees] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [employeeLeaveBalances, setEmployeeLeaveBalances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [departmentStats, setDepartmentStats] = useState({});
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [regularizationCount, setRegularizationCount] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('attendance');
  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);
  
  // New states for upcoming events
  const [allUpcomingBirthdays, setAllUpcomingBirthdays] = useState([]);
  const [allUpcomingAnniversaries, setAllUpcomingAnniversaries] = useState([]);
  const [displayBirthdays, setDisplayBirthdays] = useState([]);
  const [displayAnniversaries, setDisplayAnniversaries] = useState([]);
  const [showAllBirthdays, setShowAllBirthdays] = useState(false);
  const [showAllAnniversaries, setShowAllAnniversaries] = useState(false);

  // Chart data states
  const [attendanceTrend, setAttendanceTrend] = useState([]);
  const [departmentChartData, setDepartmentChartData] = useState({
    labels: [],
    datasets: [{
      data: [],
      backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40'],
      borderWidth: 0
    }]
  });

  useEffect(() => {
    fetchDashboardData();
    fetchTodayEvents();

    const timer = setInterval(() => {
      if (autoRefresh) {
        refreshAttendanceData();
        refreshLeaveRequests();
        fetchTodayEvents();
      }
    }, 30000);

    return () => clearInterval(timer);
  }, [autoRefresh]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      const employeesRes = await axios.get(API_ENDPOINTS.EMPLOYEES);
      let employees = [];
      if (employeesRes.data) {
        if (Array.isArray(employeesRes.data)) {
          employees = employeesRes.data;
        } else if (employeesRes.data.data && Array.isArray(employeesRes.data.data)) {
          employees = employeesRes.data.data;
        } else if (employeesRes.data.employees && Array.isArray(employeesRes.data.employees)) {
          employees = employeesRes.data.employees;
        }
      }

      console.log('Employees fetched:', employees.length);
      setTotalEmployees(employees.length);
      setStats(prevStats => ({ ...prevStats, total: employees.length }));

      fetchUpcomingEvents(employees);

      const balancesPromises = employees.map(async (emp) => {
        try {
          const balanceRes = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(emp.employee_id));
          return { ...emp, leaveBalance: balanceRes.data };
        } catch (error) {
          return { ...emp, leaveBalance: { available: '0', total_accrued: '0', used: '0', pending: '0' } };
        }
      });

      const employeesWithBalance = await Promise.all(balancesPromises);
      setEmployeeLeaveBalances(employeesWithBalance);

      await refreshLeaveRequests();
      await refreshAttendanceData();

      setRecentEmployees(employees.slice(-5));
      setLastUpdated(new Date());

      // Calculate department stats for chart
      const deptMap = {};
      employees.forEach(emp => {
        if (emp.department) {
          deptMap[emp.department] = (deptMap[emp.department] || 0) + 1;
        }
      });
      setDepartmentChartData({
        labels: Object.keys(deptMap),
        datasets: [{
          data: Object.values(deptMap),
          backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#36A2EB'],
          borderWidth: 0
        }]
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to load dashboard data' });
    } finally {
      setLoading(false);
    }
  };

  const fetchUpcomingEvents = (employees = null) => {
    try {
      const empList = employees || employeeLeaveBalances;
      const today = new Date();
      const currentYear = today.getFullYear();

      const birthdays = empList.filter(emp => emp.dob).map(emp => {
        const dob = new Date(emp.dob);
        const dobMonth = dob.getMonth() + 1;
        const dobDay = dob.getDate();
        let birthdayThisYear = new Date(currentYear, dobMonth - 1, dobDay);
        let diffDays = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          birthdayThisYear = new Date(currentYear + 1, dobMonth - 1, dobDay);
          diffDays = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
        }
        return {
          ...emp,
          daysLeft: diffDays,
          birthdayDate: `${dob.getDate().toString().padStart(2, '0')}/${dobMonth.toString().padStart(2, '0')}`,
          birthdayFull: dob
        };
      }).sort((a, b) => a.daysLeft - b.daysLeft);

      const anniversaries = empList.filter(emp => emp.joining_date).map(emp => {
        const joiningDate = new Date(emp.joining_date);
        const joiningMonth = joiningDate.getMonth() + 1;
        const joiningDay = joiningDate.getDate();
        let anniversaryThisYear = new Date(currentYear, joiningMonth - 1, joiningDay);
        let diffDays = Math.ceil((anniversaryThisYear - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) {
          anniversaryThisYear = new Date(currentYear + 1, joiningMonth - 1, joiningDay);
          diffDays = Math.ceil((anniversaryThisYear - today) / (1000 * 60 * 60 * 24));
        }
        let yearsCompleted = currentYear - joiningDate.getFullYear();
        if (anniversaryThisYear.getFullYear() > currentYear) {
          yearsCompleted = yearsCompleted + 1;
        }
        return {
          ...emp,
          daysLeft: diffDays,
          yearsCompleted: yearsCompleted,
          anniversaryDate: `${joiningDate.getDate().toString().padStart(2, '0')}/${joiningMonth.toString().padStart(2, '0')}`,
          joiningFull: joiningDate
        };
      }).sort((a, b) => a.daysLeft - b.daysLeft);

      setAllUpcomingBirthdays(birthdays);
      setAllUpcomingAnniversaries(anniversaries);
      setDisplayBirthdays(birthdays.slice(0, 5));
      setDisplayAnniversaries(anniversaries.slice(0, 5));
    } catch (error) {
      console.error('Error fetching upcoming events:', error);
    }
  };

  const refreshAttendanceData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceRes = await axios.get(`${API_ENDPOINTS.ATTENDANCE_REPORT}?start=${today}&end=${today}`);
      const attendanceData = attendanceRes.data.attendance || [];
      setTodayAttendance(attendanceData);
      updateStats(attendanceData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing attendance:', error);
    }
  };

  const refreshLeaveRequests = async () => {
    try {
      const leavesRes = await axios.get(API_ENDPOINTS.LEAVES);
      setLeaveRequests(leavesRes.data.filter(leave => leave.status === 'pending'));
    } catch (error) {
      console.error('Error refreshing leave requests:', error);
    }
  };

  const updateStats = (attendanceData) => {
    const total = totalEmployees;
    const present = attendanceData.filter(a => a.status === 'present').length;
    const halfDay = attendanceData.filter(a => a.status === 'half_day').length;
    const working = attendanceData.filter(a => a.status === 'working' || (a.clock_in && !a.clock_out)).length;
    const late = attendanceData.filter(a => parseFloat(a.late_minutes) > 0).length;
    const onLeave = attendanceData.filter(a => a.is_on_leave || a.status === 'on_leave').length;
    const totalPresent = present + halfDay + working;
    let absent = total - totalPresent - onLeave;
    absent = absent < 0 ? 0 : absent;

    setStats(prevStats => ({
      ...prevStats,
      total: total,
      present: totalPresent,
      absent: absent,
      onLeave: onLeave,
      late: late,
      halfDay: halfDay,
      working: working
    }));
  };

  const getFilteredEmployees = () => {
    let filtered = [...employeeLeaveBalances];
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(emp => emp.department === filterDepartment);
    }
    if (searchTerm) {
      filtered = filtered.filter(emp =>
        emp.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.employee_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.department?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.first_name || '').localeCompare(b.first_name || '');
      } else if (sortBy === 'balance') {
        return (parseFloat(b.leaveBalance?.available) || 0) - (parseFloat(a.leaveBalance?.available) || 0);
      } else if (sortBy === 'department') {
        return (a.department || '').localeCompare(b.department || '');
      }
      return 0;
    });
    return filtered;
  };

  const handleExport = async () => {
    if (!exportDateRange.start || !exportDateRange.end) {
      setMessage({ type: 'warning', text: 'Please select date range for export' });
      return;
    }

    setExporting(true);
    try {
      let url = '';
      switch (exportType) {
        case 'attendance':
          url = `${API_ENDPOINTS.REPORTS_ATTENDANCE}?start=${exportDateRange.start}&end=${exportDateRange.end}`;
          break;
        case 'leave':
          url = `${API_ENDPOINTS.REPORTS_LEAVE}?start=${exportDateRange.start}&end=${exportDateRange.end}`;
          break;
        case 'employees':
          url = API_ENDPOINTS.EXPORT_EMPLOYEES;
          break;
        default:
          url = API_ENDPOINTS.REPORTS_ATTENDANCE;
      }

      const response = await axios.get(url, { responseType: 'blob' });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${exportType}_report_${exportDateRange.start}_to_${exportDateRange.end}.xlsx`;
      link.click();
      URL.revokeObjectURL(link.href);
      setMessage({ type: 'success', text: 'Export completed successfully!' });
      setShowExportModal(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    } catch (error) {
      console.error('Export error:', error);
      setMessage({ type: 'danger', text: 'Failed to export data' });
    } finally {
      setExporting(false);
    }
  };

  const departments = ['all', ...new Set(employeeLeaveBalances.map(emp => emp.department).filter(Boolean))];
  const totalLeavesAvailable = employeeLeaveBalances.reduce((sum, emp) => sum + (parseFloat(emp.leaveBalance?.available) || 0), 0);
  const averageLeavesPerEmployee = employeeLeaveBalances.length > 0 ? (totalLeavesAvailable / employeeLeaveBalances.length).toFixed(1) : 0;
  const employeesWithLowBalance = employeeLeaveBalances.filter(emp => parseFloat(emp.leaveBalance?.available) < 3).length;

  const formatTime = (datetime) => {
    if (!datetime) return '--:--';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getStatusBadge = (record) => {
    if (record.is_on_leave || record.status === 'on_leave') {
      return <Badge bg="purple" style={{ backgroundColor: '#6f42c1' }}><FaUmbrellaBeach className="me-1" size={10} /> On Leave</Badge>;
    }
    if (!record.clock_in) return <Badge bg="secondary">Not Clocked</Badge>;
    if (!record.clock_out) return <Badge bg="info">Working</Badge>;
    if (record.status === 'present') return <Badge bg="success">Present</Badge>;
    if (record.status === 'half_day') return <Badge bg="warning">Half Day</Badge>;
    return <Badge bg="danger">Absent</Badge>;
  };

  const attendanceChartData = {
    labels: ['Present', 'Absent', 'On Leave', 'Half Day', 'Late'],
    datasets: [{
      data: [stats.present, stats.absent, stats.onLeave, stats.halfDay, stats.late],
      backgroundColor: ['#28a745', '#dc3545', '#6f42c1', '#ffc107', '#fd7e14'],
      borderWidth: 0
    }]
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" style={{ width: '3rem', height: '3rem' }} />
          <p className="mt-3 text-muted small">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const filteredEmployees = getFilteredEmployees();
  const hasCelebrations = todayEvents?.total > 0;

  return (
    <div className="p-2 p-md-3 p-lg-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="mb-1 d-flex align-items-center flex-wrap">
            <FaUsers className="me-2 text-dark" />
            <span>Admin Dashboard</span>
            {regularizationCount > 0 && (
              <Badge bg="danger" pill className="ms-2" style={{ fontSize: '12px' }}>
                {regularizationCount} Pending Regularizations
              </Badge>
            )}
          </h4>
          <p className="text-muted mb-0 small d-flex align-items-center flex-wrap">
            <FaClock className="me-1" size={12} />
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
            <Button variant="link" size="sm" className="ms-2 p-0 text-decoration-none" onClick={() => { refreshAttendanceData(); refreshLeaveRequests(); fetchTodayEvents(); fetchUpcomingEvents(); }}>
              <FaSyncAlt size={12} className="text-primary" />
            </Button>
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button variant="outline-success" size="sm" onClick={() => setShowExportModal(true)}>
            <FaDownload className="me-1" size={12} />
            Export
          </Button>
          <Form.Check type="switch" id="auto-refresh" label="Auto-refresh" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="mb-0" />
        </div>
      </div>

      {message.text && (
        <Alert variant={message.type} onClose={() => setMessage({ type: '', text: '' })} dismissible className="mb-4">
          {message.text}
        </Alert>
      )}

      {/* Tab Navigation */}
      <div className="mb-4">
        <ButtonGroup>
          <Button
            variant={activeTab === 'overview' ? 'primary' : 'outline-secondary'}
            onClick={() => setActiveTab('overview')}
          >
            <FaChartBar className="me-2" />
            Overview
          </Button>
          <Button
            variant={activeTab === 'regularization' ? 'warning' : 'outline-secondary'}
            onClick={() => setActiveTab('regularization')}
          >
            <FaRegClock className="me-2" />
            Regularization Requests
            {regularizationCount > 0 && (
              <Badge bg="danger" pill className="ms-2">
                {regularizationCount}
              </Badge>
            )}
          </Button>
        </ButtonGroup>
      </div>

      {activeTab === 'regularization' ? (
        <RegularizationRequests onRequestCountChange={setRegularizationCount} />
      ) : (
        <>
          {/* Today's Events Widget */}
          {hasCelebrations && (
            <Card className="mb-4 border-0 shadow-sm">
              <Card.Header className="bg-gradient text-white py-2" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <h6 className="mb-0 d-flex align-items-center">
                  <FaBirthdayCake className="me-2" size={14} />
                  <FaTrophy className="me-2" size={14} />
                  Today's Celebrations 🎉
                </h6>
              </Card.Header>
              <Card.Body className="p-3">
                <div className="d-flex flex-column flex-sm-row flex-wrap gap-2">
                  {todayEvents.birthdays?.map(emp => (
                    <Badge key={`birthday-${emp.id}`} bg="light" text="dark" className="p-2 d-flex align-items-center gap-2 shadow-sm w-100 w-sm-auto" style={{ borderLeft: '4px solid #ff6b6b', borderRadius: '8px' }}>
                      <FaBirthdayCake color="#ff6b6b" size={24} />
                      <div className="text-start">
                        <span className="small fw-bold d-block">{emp.first_name} {emp.last_name}</span>
                        <small className="text-muted">{emp.department}</small>
                        <small className="text-danger d-block">🎂 Birthday Today!</small>
                      </div>
                    </Badge>
                  ))}
                  {todayEvents.anniversaries?.map(emp => (
                    <Badge key={`anniversary-${emp.id}`} bg="light" text="dark" className="p-2 d-flex align-items-center gap-2 shadow-sm w-100 w-sm-auto" style={{ borderLeft: '4px solid #ffd700', borderRadius: '8px' }}>
                      <FaTrophy color="#ffd700" size={24} />
                      <div className="text-start">
                        <span className="small fw-bold d-block">{emp.first_name} {emp.last_name}</span>
                        <small className="text-muted">{emp.department}</small>
                        <small className="text-warning d-block">🏆 {emp.years} Year{emp.years > 1 ? 's' : ''} Anniversary!</small>
                      </div>
                    </Badge>
                  ))}
                </div>
                <div className="mt-3 pt-2 border-top small text-muted">
                  <span className="fw-semibold">Total Celebrations Today:</span>
                  <Badge bg="success" pill className="ms-1">{todayEvents.total}</Badge>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Quick Stats Cards */}
          <Row className="mb-4 g-2 g-md-3">
            <Col xs={12} sm={6} lg={3}>
              <Card className="border-0 shadow-sm bg-white h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-secondary mb-2 small">Total Employees</h6>
                      <h4 className="mb-0 fw-bold">{totalEmployees}</h4>
                      <small className="text-muted">Active employees</small>
                    </div>
                    <FaUsers size={30} className="text-secondary opacity-50" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Card className="border-0 shadow-sm bg-white h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-secondary mb-2 small">Present Today</h6>
                      <h4 className="mb-0 fw-bold">{stats.present}</h4>
                      <small className="text-muted">{stats.working} working now</small>
                    </div>
                    <FaUserCheck size={30} className="text-secondary opacity-50" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Card className="border-0 shadow-sm bg-white h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-secondary mb-2 small">On Leave / Half Day</h6>
                      <h4 className="mb-0 fw-bold">{stats.onLeave + stats.halfDay}</h4>
                      <small className="text-muted">{stats.halfDay} half day</small>
                    </div>
                    <FaUmbrellaBeach size={30} className="text-secondary opacity-50" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} sm={6} lg={3}>
              <Card className="border-0 shadow-sm bg-white h-100">
                <Card.Body>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <h6 className="text-secondary mb-2 small">Absent</h6>
                      <h4 className="mb-0 fw-bold">{stats.absent}</h4>
                      <small className="text-muted">{stats.late} late arrivals</small>
                    </div>
                    <FaUserTimes size={30} className="text-secondary opacity-50" />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Charts Row */}
          <Row className="mb-4 g-3">
            <Col xs={12} md={6}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white">
                  <h6 className="mb-0">Attendance Distribution</h6>
                </Card.Header>
                <Card.Body className="d-flex justify-content-center">
                  <div style={{ width: '250px', height: '250px' }}>
                    <Doughnut data={attendanceChartData} options={{ maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="border-0 shadow-sm h-100">
                <Card.Header className="bg-white">
                  <h6 className="mb-0">Department Distribution</h6>
                </Card.Header>
                <Card.Body className="d-flex justify-content-center">
                  <div style={{ width: '250px', height: '250px' }}>
                    <Doughnut data={departmentChartData} options={{ maintainAspectRatio: true, responsive: true, plugins: { legend: { position: 'bottom' } } }} />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Live Attendance Feed */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Header className="bg-light d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
              <h5 className="mb-0 text-dark d-flex align-items-center">
                <FaClock className="me-2 text-dark" />
                <span>Live Attendance Feed</span>
              </h5>
              <Badge bg="dark" className="px-3 py-2 ms-0 ms-sm-auto">{todayAttendance.length} Records</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Table striped size="sm" className="mb-0 align-middle">
                  <thead className="bg-light sticky-top">
                    <tr className="small">
                      <th className="fw-normal text-center">#</th>
                      <th className="fw-normal">Employee</th>
                      <th className="fw-normal d-none d-md-table-cell">Department</th>
                      <th className="fw-normal">Clock In</th>
                      <th className="fw-normal d-none d-sm-table-cell">Clock Out</th>
                      <th className="fw-normal">Status</th>
                     </tr>
                  </thead>
                  <tbody>
                    {todayAttendance.length > 0 ? (
                      todayAttendance.map((att, index) => (
                        <tr key={index}>
                          <td className="text-center">{index + 1}</td>
                          <td className="small">
                            <div className="text-truncate" style={{ maxWidth: '120px' }}>{att.first_name} {att.last_name}</div>
                            <small className="text-muted">{att.employee_id}</small>
                          </td>
                          <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>{att.department}</td>
                          <td className={`small ${att.clock_in ? 'text-success' : 'text-muted'}`}>
                            {formatTime(att.clock_in)}
                            {att.late_minutes > 0 && <Badge bg="danger" className="ms-1" pill>Late</Badge>}
                          </td>
                          <td className={`small d-none d-sm-table-cell ${att.clock_out ? 'text-danger' : 'text-muted'}`}>{formatTime(att.clock_out)}</td>
                          <td>{getStatusBadge(att)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="6" className="text-center py-4"><FaClock size={30} className="text-muted mb-2 opacity-50" /><p className="text-muted mb-0">No attendance records for today</p></td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {/* Pending Leave Requests */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Header className="bg-light d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
              <h5 className="mb-0 text-dark d-flex align-items-center"><FaCalendarAlt className="me-2" /><span>Pending Leave Requests</span></h5>
              <Badge bg="light" text="dark" className="px-3 py-2 ms-0 ms-sm-auto">{leaveRequests.length} Pending</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <Table striped size="sm" className="mb-0">
                  <thead className="bg-light sticky-top">
                    <tr className="small">
                      <th className="fw-normal text-center">#</th>
                      <th className="fw-normal">Employee</th>
                      <th className="fw-normal d-none d-md-table-cell">Leave Type</th>
                      <th className="fw-normal">Date Range</th>
                      <th className="fw-normal">Days</th>
                      <th className="fw-normal">Status</th>
                     </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.length > 0 ? (
                      leaveRequests.map((leave, index) => (
                        <tr key={leave.id}>
                          <td className="text-center">{index + 1}</td>
                          <td className="small">
                            <div className="text-truncate" style={{ maxWidth: '100px' }}>{leave.first_name} {leave.last_name}</div>
                            <small className="text-muted">{leave.employee_id}</small>
                          </td>
                          <td className="d-none d-md-table-cell"><Badge bg="secondary">{leave.leave_type}</Badge></td>
                          <td className="small">
                            <span className="text-nowrap">{new Date(leave.start_date).toLocaleDateString()}</span>
                            {leave.start_date !== leave.end_date && <span className="text-nowrap d-block">- {new Date(leave.end_date).toLocaleDateString()}</span>}
                          </td>
                          <td>{leave.days_count || 1}</td>
                          <td><Badge bg="warning">Pending</Badge></td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="6" className="text-center py-4"><FaCalendarAlt size={30} className="text-muted mb-2 opacity-50" /><p className="text-muted mb-0">No pending leave requests</p></td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {/* Employee Leave Balances */}
          <Card className="mb-4 border-0 shadow-sm">
            <Card.Header className="bg-white d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center py-3 gap-2">
              <h5 className="mb-0 d-flex align-items-center"><FaBalanceScale className="me-2 text-dark" /><span>Employee Leave Balances</span></h5>
              <div className="d-flex gap-2">
                <Badge bg="info" className="px-3 py-2">Avg: {averageLeavesPerEmployee} days</Badge>
                <Badge bg="warning" className="px-3 py-2">Low Balance: {employeesWithLowBalance}</Badge>
              </div>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3 g-2">
                <Col xs={12} md={4}>
                  <div className="d-flex align-items-center bg-light rounded-3 p-1">
                    <FaSearch className="ms-2 text-muted" size={14} />
                    <Form.Control type="text" placeholder="Search by name, ID, department..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="border-0 bg-transparent" size="sm" />
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <Form.Select size="sm" value={filterDepartment} onChange={(e) => setFilterDepartment(e.target.value)}>
                    <option value="all">All Departments</option>
                    {departments.filter(d => d !== 'all').map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </Form.Select>
                </Col>
                <Col xs={6} md={3}>
                  <Form.Select size="sm" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="name">Sort by Name</option>
                    <option value="balance">Sort by Balance</option>
                    <option value="department">Sort by Department</option>
                  </Form.Select>
                </Col>
              </Row>
              <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                <Table striped size="sm" className="mb-0">
                  <thead className="bg-light sticky-top">
                    <tr className="small">
                      <th className="fw-normal text-center">#</th>
                      <th className="fw-normal">Employee</th>
                      <th className="fw-normal d-none d-md-table-cell">Department</th>
                      <th className="fw-normal">Available</th>
                      <th className="fw-normal d-none d-sm-table-cell">Status</th>
                     </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((emp, index) => {
                        const available = parseFloat(emp.leaveBalance?.available) || 0;
                        const statusColor = available <= 0 ? 'danger' : available < 3 ? 'warning' : 'success';
                        return (
                          <tr key={emp.id}>
                            <td className="text-center">{index + 1}</td>
                            <td className="small">
                              <div className="text-truncate" style={{ maxWidth: '120px' }}>{emp.first_name} {emp.last_name}</div>
                              <small className="text-muted">{emp.employee_id}</small>
                            </td>
                            <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '100px' }}>{emp.department}</td>
                            <td><Badge bg={statusColor} pill>{available.toFixed(1)}</Badge></td>
                            <td className="d-none d-sm-table-cell">
                              {available <= 0 ? <Badge bg="danger" pill>No Leaves</Badge> : available < 3 ? <Badge bg="warning" pill>Low</Badge> : <Badge bg="success" pill>Good</Badge>}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr><td colSpan="5" className="text-center py-4"><p className="text-muted mb-0">No employees found</p></td></tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </>
      )}

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title className="h6"><FaFileAlt className="me-2" />Export Reports</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Report Type</Form.Label>
              <Form.Select value={exportType} onChange={(e) => setExportType(e.target.value)}>
                <option value="attendance">Attendance Report</option>
                <option value="leave">Leave Report</option>
                <option value="employees">Employees List</option>
              </Form.Select>
            </Form.Group>
            {exportType !== 'employees' && (
              <>
                <Form.Group className="mb-3">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control type="date" value={exportDateRange.start} onChange={(e) => setExportDateRange({ ...exportDateRange, start: e.target.value })} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>End Date</Form.Label>
                  <Form.Control type="date" value={exportDateRange.end} onChange={(e) => setExportDateRange({ ...exportDateRange, end: e.target.value })} />
                </Form.Group>
              </>
            )}
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowExportModal(false)}>Cancel</Button>
          <Button variant="success" size="sm" onClick={handleExport} disabled={exporting}>
            {exporting ? <><Spinner size="sm" animation="border" className="me-2" />Exporting...</> : <><FaDownload className="me-2" />Export</>}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;