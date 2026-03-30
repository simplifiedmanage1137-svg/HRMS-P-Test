// src/components/Admin/AdminDashboard.jsx
import React, { useState, useEffect } from 'react';
import {
  Row, Col, Card, Table, Badge, Spinner, Alert, Form, Button,
  Modal, ButtonGroup, InputGroup
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
  FaFileAlt,
  FaTrash,
  FaSort,
  FaSortUp,
  FaSortDown,
  FaGift,
  FaStar,
  FaMedal,
  FaArrowLeft,
  FaArrowRight,
  FaHome,
  FaBriefcase,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaUser
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

// ============== REGULARIZATION REQUESTS COMPONENT ==============
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const { addNotification } = useNotification();

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_PENDING_REGULARIZATIONS);
      const requestsData = response.data.requests || [];
      console.log('📋 Regularization requests fetched:', requestsData.length);
      setRequests(requestsData);
      if (onRequestCountChange) {
        onRequestCountChange(requestsData.filter(r => r.status === 'pending').length);
      }
      setCurrentPage(1);
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
      const requestId = String(selectedRequest.id);
      console.log('📤 Approving request with ID:', requestId);

      const response = await axios.put(
        API_ENDPOINTS.ATTENDANCE_APPROVE_REGULARIZATION(requestId),
        {
          approved_clock_out_time: approvedTime,
          admin_notes: adminNotes
        }
      );

      console.log('✅ Approval response:', response.data);

      setMessage({ type: 'success', text: 'Regularization request approved successfully!' });

      // Remove approved request from state
      const updatedRequests = requests.filter(req => req.id !== selectedRequest.id);
      setRequests(updatedRequests);

      if (onRequestCountChange) {
        onRequestCountChange(updatedRequests.filter(r => r.status === 'pending').length);
      }

      setShowApproveModal(false);
      setSelectedRequest(null);
      setApprovedTime('');
      setAdminNotes('');

      // Clear employee's local session storage
      const employeeId = selectedRequest.employee_id;
      const storageKey = `attendance_session_${employeeId}`;
      localStorage.removeItem(storageKey);
      console.log(`✅ Cleared session storage for employee: ${employeeId}`);

      if (addNotification) {
        addNotification({
          employee_id: selectedRequest.employee_id,
          title: 'Regularization Request Approved',
          message: `Your regularization request for ${selectedRequest.attendance_date} has been approved. Please refresh your page to clock in.`,
          type: 'regularization_approved'
        });
      }

      await fetchRequests();
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);

    } catch (error) {
      console.error('Error approving regularization:', error);
      console.error('Error details:', error.response?.data);
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
      const requestId = String(selectedRequest.id);

      const response = await axios.put(
        API_ENDPOINTS.ATTENDANCE_REJECT_REGULARIZATION(requestId),
        { rejection_reason: rejectionReason }
      );

      console.log('❌ Regularization rejected:', response.data);

      setMessage({ type: 'success', text: 'Regularization request rejected' });

      const updatedRequests = requests.filter(req => req.id !== selectedRequest.id);
      setRequests(updatedRequests);

      if (onRequestCountChange) {
        onRequestCountChange(updatedRequests.filter(r => r.status === 'pending').length);
      }

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

      await fetchRequests();
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

  const getCurrentPageData = () => {
    const filtered = getFilteredRequests();
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filtered.slice(startIndex, startIndex + itemsPerPage);
  };

  const filteredRequests = getFilteredRequests();
  const currentPageData = getCurrentPageData();
  const totalPages = Math.ceil(filteredRequests.length / itemsPerPage);

  const goToPrevPage = () => {
    if (currentPage > 1) setCurrentPage(currentPage - 1);
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) setCurrentPage(currentPage + 1);
  };

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
            onClick={() => { setFilter('pending'); setCurrentPage(1); }}
          >
            Pending ({requests.filter(r => r.status === 'pending').length})
          </Button>
          <Button
            variant={filter === 'approved' ? 'success' : 'outline-secondary'}
            onClick={() => { setFilter('approved'); setCurrentPage(1); }}
          >
            Approved ({requests.filter(r => r.status === 'approved').length})
          </Button>
          <Button
            variant={filter === 'rejected' ? 'danger' : 'outline-secondary'}
            onClick={() => { setFilter('rejected'); setCurrentPage(1); }}
          >
            Rejected ({requests.filter(r => r.status === 'rejected').length})
          </Button>
          <Button
            variant={filter === 'all' ? 'primary' : 'outline-secondary'}
            onClick={() => { setFilter('all'); setCurrentPage(1); }}
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
        <>
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
                    {currentPageData.map((request, index) => {
                      const globalIndex = (currentPage - 1) * itemsPerPage + index + 1;
                      return (
                        <React.Fragment key={request.id}>
                          <tr
                            className={expandedRequest === request.id ? 'table-active' : ''}
                            style={{ cursor: 'pointer' }}
                            onClick={() => setExpandedRequest(expandedRequest === request.id ? null : request.id)}
                          >
                            <td className="small text-center">{globalIndex}</td>
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
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>

          {totalPages > 1 && (
            <div className="d-flex justify-content-between align-items-center mt-3">
              <div className="text-muted small">
                Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredRequests.length)} of {filteredRequests.length} requests
              </div>
              <ButtonGroup size="sm">
                <Button
                  variant="outline-secondary"
                  onClick={goToPrevPage}
                  disabled={currentPage === 1}
                >
                  <FaArrowLeft size={12} />
                </Button>
                <Button variant="outline-secondary" disabled>
                  Page {currentPage} of {totalPages}
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={goToNextPage}
                  disabled={currentPage === totalPages}
                >
                  <FaArrowRight size={12} />
                </Button>
              </ButtonGroup>
            </div>
          )}
        </>
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

// ============== MAIN ADMIN DASHBOARD COMPONENT ==============
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
  const [filteredAttendance, setFilteredAttendance] = useState([]);
  const [filteredLeaveRequests, setFilteredLeaveRequests] = useState([]);
  const [attendanceSearchTerm, setAttendanceSearchTerm] = useState('');
  const [leaveSearchTerm, setLeaveSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [totalEmployees, setTotalEmployees] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [regularizationCount, setRegularizationCount] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('attendance');
  const [exportDateRange, setExportDateRange] = useState({ start: '', end: '' });
  const [exporting, setExporting] = useState(false);

  // Birthday and Anniversary states
  const [allBirthdays, setAllBirthdays] = useState([]);
  const [allAnniversaries, setAllAnniversaries] = useState([]);
  const [birthdayFilter, setBirthdayFilter] = useState('all');
  const [anniversaryFilter, setAnniversaryFilter] = useState('all');
  const [birthdaySort, setBirthdaySort] = useState('date');
  const [anniversarySort, setAnniversarySort] = useState('date');
  const [birthdaySortOrder, setBirthdaySortOrder] = useState('asc');
  const [anniversarySortOrder, setAnniversarySortOrder] = useState('asc');
  const [birthdaySearch, setBirthdaySearch] = useState('');
  const [anniversarySearch, setAnniversarySearch] = useState('');
  const [birthdayDepartmentFilter, setBirthdayDepartmentFilter] = useState('all');
  const [anniversaryDepartmentFilter, setAnniversaryDepartmentFilter] = useState('all');

  // Chart data states
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

    const attendanceInterval = setInterval(() => {
      refreshAttendanceData();
    }, 60000);

    const leaveInterval = setInterval(() => {
      refreshLeaveRequests();
    }, 30000);

    return () => {
      clearInterval(attendanceInterval);
      clearInterval(leaveInterval);
    };
  }, []);

  useEffect(() => {
    if (!attendanceSearchTerm.trim()) {
      setFilteredAttendance(todayAttendance);
    } else {
      const searchLower = attendanceSearchTerm.toLowerCase();
      const filtered = todayAttendance.filter(att =>
        att.first_name?.toLowerCase().includes(searchLower) ||
        att.last_name?.toLowerCase().includes(searchLower) ||
        att.employee_id?.toLowerCase().includes(searchLower) ||
        `${att.first_name} ${att.last_name}`.toLowerCase().includes(searchLower)
      );
      setFilteredAttendance(filtered);
    }
  }, [attendanceSearchTerm, todayAttendance]);

  useEffect(() => {
    if (!leaveSearchTerm.trim()) {
      setFilteredLeaveRequests(leaveRequests);
    } else {
      const searchLower = leaveSearchTerm.toLowerCase();
      const filtered = leaveRequests.filter(leave =>
        leave.first_name?.toLowerCase().includes(searchLower) ||
        leave.last_name?.toLowerCase().includes(searchLower) ||
        leave.employee_id?.toLowerCase().includes(searchLower) ||
        `${leave.first_name} ${leave.last_name}`.toLowerCase().includes(searchLower)
      );
      setFilteredLeaveRequests(filtered);
    }
  }, [leaveSearchTerm, leaveRequests]);

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

      console.log('Total employees fetched:', employees.length);
      setTotalEmployees(employees.length);
      setStats(prevStats => ({ ...prevStats, total: employees.length }));

      fetchCompleteEvents(employees);

      // FIXED: Better error handling for leave balance
      const balancesPromises = employees.map(async (emp) => {
        try {
          const balanceRes = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(emp.employee_id));
          console.log(`Leave balance for ${emp.employee_id}:`, balanceRes.data);

          // Ensure we have all required fields with proper structure
          return {
            ...emp,
            leaveBalance: {
              available: parseFloat(balanceRes.data.available) || 0,
              total_accrued: parseFloat(balanceRes.data.total_accrued) || 0,
              used: parseFloat(balanceRes.data.used) || 0,
              pending: parseFloat(balanceRes.data.pending) || 0,
              comp_off_balance: parseFloat(balanceRes.data.comp_off_balance) || 0,
              months_completed: balanceRes.data.months_completed || 0,
              is_probation_complete: balanceRes.data.is_probation_complete || false,
              is_eligible: balanceRes.data.is_eligible || false
            }
          };
        } catch (error) {
          console.error(`Error fetching leave balance for ${emp.employee_id}:`, error);
          // Return default balance structure
          return {
            ...emp,
            leaveBalance: {
              available: 0,
              total_accrued: 0,
              used: 0,
              pending: 0,
              comp_off_balance: 0,
              months_completed: 0,
              is_probation_complete: false,
              is_eligible: false
            }
          };
        }
      });

      const employeesWithBalance = await Promise.all(balancesPromises);
      console.log('Employees with balance:', employeesWithBalance.map(e => ({
        name: `${e.first_name} ${e.last_name}`,
        available: e.leaveBalance?.available
      })));

      setEmployeeLeaveBalances(employeesWithBalance);

      await refreshLeaveRequests();
      await refreshAttendanceData();

      setRecentEmployees(employees.slice(-5));
      setLastUpdated(new Date());

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

  const handleRegularizationApproved = (employeeId) => {
    console.log(`Regularization approved for employee: ${employeeId}`);
    fetchDashboardData();
    refreshAttendanceData();
  };

  const fetchCompleteEvents = (employees = null) => {
    try {
      const empList = employees || employeeLeaveBalances;
      const today = new Date();
      const currentYear = today.getFullYear();

      const birthdays = empList.filter(emp => emp.dob).map(emp => {
        const dob = new Date(emp.dob);
        const dobMonth = dob.getMonth() + 1;
        const dobDay = dob.getDate();

        let birthdayThisYear = new Date(currentYear, dobMonth - 1, dobDay);
        let daysLeft = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
        let status = 'upcoming';

        if (daysLeft < 0) {
          status = 'passed';
          birthdayThisYear = new Date(currentYear + 1, dobMonth - 1, dobDay);
          daysLeft = Math.ceil((birthdayThisYear - today) / (1000 * 60 * 60 * 24));
        } else if (daysLeft === 0) {
          status = 'today';
        }

        const isThisMonth = dobMonth === today.getMonth() + 1;
        let age = currentYear - dob.getFullYear();

        return {
          ...emp,
          daysLeft: daysLeft,
          birthdayDate: `${dob.getDate().toString().padStart(2, '0')}/${dobMonth.toString().padStart(2, '0')}`,
          birthdayFull: dob,
          month: dobMonth,
          day: dobDay,
          status: status,
          isThisMonth: isThisMonth,
          age: age,
          birthYear: dob.getFullYear()
        };
      }).sort((a, b) => {
        if (a.month === b.month) return a.day - b.day;
        return a.month - b.month;
      });

      const anniversaries = empList.filter(emp => emp.joining_date).map(emp => {
        const joiningDate = new Date(emp.joining_date);
        const joiningMonth = joiningDate.getMonth() + 1;
        const joiningDay = joiningDate.getDate();
        let anniversaryThisYear = new Date(currentYear, joiningMonth - 1, joiningDay);
        let daysLeft = Math.ceil((anniversaryThisYear - today) / (1000 * 60 * 60 * 24));
        let status = 'upcoming';

        if (daysLeft < 0) {
          status = 'passed';
          anniversaryThisYear = new Date(currentYear + 1, joiningMonth - 1, joiningDay);
          daysLeft = Math.ceil((anniversaryThisYear - today) / (1000 * 60 * 60 * 24));
        } else if (daysLeft === 0) {
          status = 'today';
        }

        const yearsCompleted = currentYear - joiningDate.getFullYear();
        const isThisMonth = joiningMonth === today.getMonth() + 1;

        return {
          ...emp,
          daysLeft: daysLeft,
          yearsCompleted: yearsCompleted,
          anniversaryDate: `${joiningDate.getDate().toString().padStart(2, '0')}/${joiningMonth.toString().padStart(2, '0')}`,
          joiningFull: joiningDate,
          month: joiningMonth,
          day: joiningDay,
          status: status,
          isThisMonth: isThisMonth,
          joiningYear: joiningDate.getFullYear()
        };
      }).sort((a, b) => {
        if (a.month === b.month) return a.day - b.day;
        return a.month - b.month;
      });

      console.log('ALL Birthdays (sorted by month/day):', birthdays.length);
      console.log('ALL Anniversaries (sorted by month/day):', anniversaries.length);

      setAllBirthdays(birthdays);
      setAllAnniversaries(anniversaries);
    } catch (error) {
      console.error('Error fetching complete events:', error);
    }
  };

  const getFilteredBirthdays = () => {
    let filtered = [...allBirthdays];

    if (birthdaySearch) {
      const searchLower = birthdaySearch.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.first_name?.toLowerCase().includes(searchLower) ||
        emp.last_name?.toLowerCase().includes(searchLower) ||
        emp.employee_id?.toLowerCase().includes(searchLower) ||
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchLower)
      );
    }

    if (birthdayDepartmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.department === birthdayDepartmentFilter);
    }

    if (birthdayFilter === 'today') {
      filtered = filtered.filter(emp => emp.status === 'today');
    } else if (birthdayFilter === 'upcoming') {
      filtered = filtered.filter(emp => emp.status === 'upcoming');
    } else if (birthdayFilter === 'passed') {
      filtered = filtered.filter(emp => emp.status === 'passed');
    } else if (birthdayFilter === 'thisMonth') {
      filtered = filtered.filter(emp => emp.isThisMonth);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (birthdaySort === 'date') {
        if (a.month === b.month) comparison = a.day - b.day;
        else comparison = a.month - b.month;
      } else if (birthdaySort === 'name') {
        comparison = (a.first_name || '').localeCompare(b.first_name || '');
      } else if (birthdaySort === 'department') {
        comparison = (a.department || '').localeCompare(b.department || '');
      } else if (birthdaySort === 'month') {
        comparison = a.month - b.month;
      }
      return birthdaySortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const getFilteredAnniversaries = () => {
    let filtered = [...allAnniversaries];

    if (anniversarySearch) {
      const searchLower = anniversarySearch.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.first_name?.toLowerCase().includes(searchLower) ||
        emp.last_name?.toLowerCase().includes(searchLower) ||
        emp.employee_id?.toLowerCase().includes(searchLower) ||
        `${emp.first_name} ${emp.last_name}`.toLowerCase().includes(searchLower)
      );
    }

    if (anniversaryDepartmentFilter !== 'all') {
      filtered = filtered.filter(emp => emp.department === anniversaryDepartmentFilter);
    }

    if (anniversaryFilter === 'today') {
      filtered = filtered.filter(emp => emp.status === 'today');
    } else if (anniversaryFilter === 'upcoming') {
      filtered = filtered.filter(emp => emp.status === 'upcoming');
    } else if (anniversaryFilter === 'passed') {
      filtered = filtered.filter(emp => emp.status === 'passed');
    } else if (anniversaryFilter === 'thisMonth') {
      filtered = filtered.filter(emp => emp.isThisMonth);
    }

    filtered.sort((a, b) => {
      let comparison = 0;
      if (anniversarySort === 'date') {
        if (a.month === b.month) comparison = a.day - b.day;
        else comparison = a.month - b.month;
      } else if (anniversarySort === 'name') {
        comparison = (a.first_name || '').localeCompare(b.first_name || '');
      } else if (anniversarySort === 'department') {
        comparison = (a.department || '').localeCompare(b.department || '');
      } else if (anniversarySort === 'years') {
        comparison = b.yearsCompleted - a.yearsCompleted;
      } else if (anniversarySort === 'month') {
        comparison = a.month - b.month;
      }
      return anniversarySortOrder === 'asc' ? comparison : -comparison;
    });

    return filtered;
  };

  const refreshAttendanceData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const attendanceRes = await axios.get(`${API_ENDPOINTS.ATTENDANCE_REPORT}?start=${today}&end=${today}`);
      const attendanceData = attendanceRes.data.attendance || [];
      setTodayAttendance(attendanceData);
      setFilteredAttendance(attendanceData);
      updateStats(attendanceData);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error refreshing attendance:', error);
    }
  };

  const refreshLeaveRequests = async () => {
    try {
      const leavesRes = await axios.get(API_ENDPOINTS.LEAVES);
      const pendingLeaves = leavesRes.data.filter(leave => leave.status === 'pending');
      setLeaveRequests(pendingLeaves);
      setFilteredLeaveRequests(pendingLeaves);
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

    setStats({
      total,
      present: totalPresent,
      absent,
      onLeave,
      late,
      early: 0,
      halfDay,
      working
    });
  };

  const getFilteredEmployees = () => {
    let filtered = [...employeeLeaveBalances];

    if (filterDepartment !== 'all') {
      filtered = filtered.filter(emp => emp.department === filterDepartment);
    }

    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(emp =>
        emp.first_name?.toLowerCase().includes(searchLower) ||
        emp.last_name?.toLowerCase().includes(searchLower) ||
        emp.employee_id?.toLowerCase().includes(searchLower) ||
        emp.department?.toLowerCase().includes(searchLower)
      );
    }

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        return (a.first_name || '').localeCompare(b.first_name || '');
      } else if (sortBy === 'balance') {
        const balanceA = parseFloat(a.leaveBalance?.available) || 0;
        const balanceB = parseFloat(b.leaveBalance?.available) || 0;
        return balanceB - balanceA;
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
  const totalLeavesAvailable = employeeLeaveBalances.reduce((sum, emp) => {
    const available = parseFloat(emp.leaveBalance?.available) || 0;
    return sum + available;
  }, 0);

  const averageLeavesPerEmployee = employeeLeaveBalances.length > 0
    ? (totalLeavesAvailable / employeeLeaveBalances.length).toFixed(1)
    : 0;

  const employeesWithLowBalance = employeeLeaveBalances.filter(emp => {
    const available = parseFloat(emp.leaveBalance?.available) || 0;
    return available < 3;
  }).length;

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

  const uniqueDepartments = [...new Set(allBirthdays.map(emp => emp.department).filter(Boolean))];

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
  const filteredBirthdays = getFilteredBirthdays();
  const filteredAnniversaries = getFilteredAnniversaries();

  return (
    <div className="p-2 p-md-3 p-lg-4">
      {/* Header */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h4 className="mb-1 d-flex align-items-center flex-wrap">
            <FaUsers className="me-2 text-dark" />
            <span>Admin Dashboard</span>
            
          </h4>
          <p className="text-muted mb-0 small d-flex align-items-center flex-wrap">
            <FaClock className="me-1" size={12} />
            <span>Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </p>
        </div>

        {/* Only ONE set of buttons - Remove the duplicate */}
        <div className="d-flex gap-2">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={() => {
              fetchDashboardData();
              if (showNotification) {
                showNotification('Refreshing dashboard data...', 'info');
              }
            }}
          >
            <FaSyncAlt className="me-1" size={12} />
            Refresh
          </Button>
          <Button variant="outline-success" size="sm" onClick={() => setShowExportModal(true)}>
            <FaDownload className="me-1" size={12} />
            Export
          </Button>
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
            variant={activeTab === 'birthdays' ? 'info' : 'outline-secondary'}
            onClick={() => setActiveTab('birthdays')}
          >
            <FaBirthdayCake className="me-2" />
            Birthdays ({allBirthdays.length})
          </Button>
          <Button
            variant={activeTab === 'anniversaries' ? 'warning' : 'outline-secondary'}
            onClick={() => setActiveTab('anniversaries')}
          >
            <FaTrophy className="me-2" />
            Work Anniversaries ({allAnniversaries.length})
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
        <RegularizationRequests
          onRequestCountChange={setRegularizationCount}
        />
      ) : activeTab === 'birthdays' ? (
        // Birthdays Tab
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-gradient py-3" style={{ background: 'linear-gradient(135deg, #ff6b6b 0%, #ff8e8e 100%)' }}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h5 className="mb-1 text-white d-flex align-items-center">
                  <FaBirthdayCake className="me-2" size={20} />
                  Employee Birthdays
                </h5>
                <p className="mb-0 text-white-50 small">Complete list of all {allBirthdays.length} employee birthdays</p>
              </div>
              <Badge bg="light" text="dark" pill className="px-3 py-2">
                Total: {allBirthdays.length} Employees
              </Badge>
            </div>
          </Card.Header>
          <Card.Body className="p-3">
            <Row className="mb-3 g-2">
              <Col xs={12} md={3}>
                <div className="d-flex align-items-center bg-light rounded-3 p-1">
                  <FaSearch className="ms-2 text-muted" size={14} />
                  <Form.Control
                    type="text"
                    placeholder="Search by name or ID..."
                    value={birthdaySearch}
                    onChange={(e) => setBirthdaySearch(e.target.value)}
                    className="border-0 bg-transparent"
                    size="sm"
                  />
                </div>
              </Col>
              <Col xs={6} md={2}>
                <Form.Select size="sm" value={birthdayFilter} onChange={(e) => setBirthdayFilter(e.target.value)}>
                  <option value="all">All Birthdays</option>
                  <option value="today">Today's Birthdays</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="passed">Passed (This Year)</option>
                  <option value="thisMonth">This Month</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={2}>
                <Form.Select size="sm" value={birthdayDepartmentFilter} onChange={(e) => setBirthdayDepartmentFilter(e.target.value)}>
                  <option value="all">All Departments</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={6} md={2}>
                <Form.Select size="sm" value={birthdaySort} onChange={(e) => setBirthdaySort(e.target.value)}>
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="department">Sort by Dept</option>
                  <option value="month">Sort by Month</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={1}>
                <Button variant="outline-secondary" size="sm" onClick={() => setBirthdaySortOrder(birthdaySortOrder === 'asc' ? 'desc' : 'asc')} className="w-100">
                  {birthdaySortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
                </Button>
              </Col>
              <Col xs={12} md={2}>
                <Button variant="outline-danger" size="sm" onClick={() => {
                  setBirthdaySearch('');
                  setBirthdayFilter('all');
                  setBirthdayDepartmentFilter('all');
                  setBirthdaySort('date');
                  setBirthdaySortOrder('asc');
                }} className="w-100">
                  <FaFilter className="me-1" size={12} />
                  Clear
                </Button>
              </Col>
            </Row>

            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              <Table striped hover className="mb-0 align-middle">
                <thead className="bg-light sticky-top">
                  <tr className="small">
                    <th className="fw-normal text-center" style={{ width: '5%' }}>#</th>
                    <th className="fw-normal" style={{ width: '18%' }}>Employee</th>
                    <th className="fw-normal d-none d-md-table-cell" style={{ width: '12%' }}>Department</th>
                    <th className="fw-normal" style={{ width: '10%' }}>Birthday</th>
                    <th className="fw-normal" style={{ width: '10%' }}>Birth Year</th>
                    <th className="fw-normal" style={{ width: '12%' }}>Age</th>
                    <th className="fw-normal" style={{ width: '15%' }}>Days Left</th>
                    <th className="fw-normal" style={{ width: '10%' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBirthdays.length > 0 ? (
                    filteredBirthdays.map((emp, index) => (
                      <tr key={emp.id} className={emp.status === 'today' ? 'table-success' : ''}>
                        <td className="text-center">{index + 1}</td>
                        <td className="small">
                          <div className="fw-semibold text-truncate" style={{ maxWidth: '150px' }}>
                            {emp.first_name} {emp.last_name}
                          </div>
                          <small className="text-muted">{emp.employee_id}</small>
                        </td>
                        <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '120px' }}>
                          {emp.department}
                        </td>
                        <td className="small">
                          <Badge bg="light" text="dark" pill className="px-2 py-1">
                            <FaBirthdayCake className="me-1" size={10} />
                            {emp.birthdayDate}
                          </Badge>
                        </td>
                        <td className="small">
                          <span className="text-muted">{emp.birthYear}</span>
                        </td>
                        <td className="small">
                          <Badge bg="info" pill>{emp.age} years</Badge>
                        </td>
                        <td className="small">
                          {emp.status === 'today' ? (
                            <Badge bg="success" pill>🎉 Today!</Badge>
                          ) : emp.status === 'upcoming' ? (
                            emp.daysLeft <= 7 ? (
                              <Badge bg="warning" pill>In {emp.daysLeft} days</Badge>
                            ) : (
                              <Badge bg="info" pill>{emp.daysLeft} days</Badge>
                            )
                          ) : (
                            <Badge bg="secondary" pill>Passed</Badge>
                          )}
                        </td>
                        <td className="small">
                          {emp.status === 'today' ? (
                            <Badge bg="success" pill className="px-2 py-1">
                              <FaGift className="me-1" size={10} /> Today
                            </Badge>
                          ) : emp.status === 'upcoming' ? (
                            <Badge bg="info" pill>Upcoming</Badge>
                          ) : (
                            <Badge bg="secondary" pill>Passed</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        <FaBirthdayCake size={40} className="text-muted mb-2 opacity-50" />
                        <p className="text-muted mb-0">No birthdays found matching the filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
            {filteredBirthdays.length > 0 && (
              <div className="mt-3 text-center text-muted small">
                Showing {filteredBirthdays.length} of {allBirthdays.length} birthdays
              </div>
            )}
          </Card.Body>
        </Card>
      ) : activeTab === 'anniversaries' ? (
        // Anniversaries Tab
        <Card className="border-0 shadow-sm">
          <Card.Header className="bg-gradient py-3" style={{ background: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)' }}>
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <h5 className="mb-1 d-flex align-items-center">
                  <FaTrophy className="me-2" size={20} />
                  Work Anniversaries
                </h5>
                <p className="mb-0 text-muted small">Complete list of all {allAnniversaries.length} employee work anniversaries</p>
              </div>
              <Badge bg="dark" pill className="px-3 py-2">
                Total: {allAnniversaries.length} Employees
              </Badge>
            </div>
          </Card.Header>
          <Card.Body className="p-3">
            <Row className="mb-3 g-2">
              <Col xs={12} md={3}>
                <div className="d-flex align-items-center bg-light rounded-3 p-1">
                  <FaSearch className="ms-2 text-muted" size={14} />
                  <Form.Control
                    type="text"
                    placeholder="Search by name or ID..."
                    value={anniversarySearch}
                    onChange={(e) => setAnniversarySearch(e.target.value)}
                    className="border-0 bg-transparent"
                    size="sm"
                  />
                </div>
              </Col>
              <Col xs={6} md={2}>
                <Form.Select size="sm" value={anniversaryFilter} onChange={(e) => setAnniversaryFilter(e.target.value)}>
                  <option value="all">All Anniversaries</option>
                  <option value="today">Today's Anniversaries</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="passed">Passed (This Year)</option>
                  <option value="thisMonth">This Month</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={2}>
                <Form.Select size="sm" value={anniversaryDepartmentFilter} onChange={(e) => setAnniversaryDepartmentFilter(e.target.value)}>
                  <option value="all">All Departments</option>
                  {uniqueDepartments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs={6} md={2}>
                <Form.Select size="sm" value={anniversarySort} onChange={(e) => setAnniversarySort(e.target.value)}>
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Name</option>
                  <option value="department">Sort by Dept</option>
                  <option value="years">Sort by Years</option>
                  <option value="month">Sort by Month</option>
                </Form.Select>
              </Col>
              <Col xs={6} md={1}>
                <Button variant="outline-secondary" size="sm" onClick={() => setAnniversarySortOrder(anniversarySortOrder === 'asc' ? 'desc' : 'asc')} className="w-100">
                  {anniversarySortOrder === 'asc' ? <FaSortUp /> : <FaSortDown />}
                </Button>
              </Col>
              <Col xs={12} md={2}>
                <Button variant="outline-warning" size="sm" onClick={() => {
                  setAnniversarySearch('');
                  setAnniversaryFilter('all');
                  setAnniversaryDepartmentFilter('all');
                  setAnniversarySort('date');
                  setAnniversarySortOrder('asc');
                }} className="w-100">
                  <FaFilter className="me-1" size={12} />
                  Clear
                </Button>
              </Col>
            </Row>

            <div className="table-responsive" style={{ maxHeight: 'calc(100vh - 350px)', overflowY: 'auto' }}>
              <Table striped hover className="mb-0 align-middle">
                <thead className="bg-light sticky-top">
                  <tr className="small">
                    <th className="fw-normal text-center" style={{ width: '5%' }}>#</th>
                    <th className="fw-normal" style={{ width: '20%' }}>Employee</th>
                    <th className="fw-normal d-none d-md-table-cell" style={{ width: '15%' }}>Department</th>
                    <th className="fw-normal" style={{ width: '12%' }}>Joining Date</th>
                    <th className="fw-normal" style={{ width: '15%' }}>Years</th>
                    <th className="fw-normal" style={{ width: '15%' }}>Days Left</th>
                    <th className="fw-normal" style={{ width: '10%' }}>Status</th>
                    <th className="fw-normal" style={{ width: '8%' }}>Celebration</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAnniversaries.length > 0 ? (
                    filteredAnniversaries.map((emp, index) => (
                      <tr key={emp.id} className={emp.status === 'today' ? 'table-warning' : ''}>
                        <td className="text-center">{index + 1}</td>
                        <td className="small">
                          <div className="fw-semibold text-truncate" style={{ maxWidth: '150px' }}>
                            {emp.first_name} {emp.last_name}
                          </div>
                          <small className="text-muted">{emp.employee_id}</small>
                        </td>
                        <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '120px' }}>
                          {emp.department}
                        </td>
                        <td className="small">
                          <Badge bg="light" text="dark" pill className="px-2 py-1">
                            <FaCalendarAlt className="me-1" size={10} />
                            {formatDate(emp.joining_date)}
                          </Badge>
                        </td>
                        <td className="small">
                          <Badge bg="warning" pill className="px-2 py-1">
                            <FaStar className="me-1" size={10} />
                            {emp.yearsCompleted} Year{emp.yearsCompleted !== 1 ? 's' : ''}
                          </Badge>
                        </td>
                        <td className="small">
                          {emp.status === 'today' ? (
                            <Badge bg="success" pill>🎉 Today!</Badge>
                          ) : emp.daysLeft <= 7 ? (
                            <Badge bg="warning" pill>In {emp.daysLeft} days</Badge>
                          ) : (
                            <Badge bg="info" pill>{emp.daysLeft} days</Badge>
                          )}
                        </td>
                        <td className="small">
                          {emp.status === 'today' ? (
                            <Badge bg="success" pill className="px-2 py-1">
                              <FaTrophy className="me-1" size={10} /> Today
                            </Badge>
                          ) : emp.status === 'upcoming' ? (
                            <Badge bg="info" pill>Upcoming</Badge>
                          ) : (
                            <Badge bg="secondary" pill>Past</Badge>
                          )}
                        </td>
                        <td className="small">
                          {emp.yearsCompleted === 1 && <Badge bg="info" pill>1st Year 🎉</Badge>}
                          {emp.yearsCompleted === 5 && <Badge bg="primary" pill>5 Years 🏆</Badge>}
                          {emp.yearsCompleted === 10 && <Badge bg="success" pill>10 Years 🎊</Badge>}
                          {emp.yearsCompleted === 20 && <Badge bg="danger" pill>20 Years 👑</Badge>}
                          {![1, 5, 10, 20].includes(emp.yearsCompleted) && emp.yearsCompleted > 0 && (
                            <Badge bg="secondary" pill>{emp.yearsCompleted} Years</Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="text-center py-4">
                        <FaTrophy size={40} className="text-muted mb-2 opacity-50" />
                        <p className="text-muted mb-0">No anniversaries found matching the filters</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </Table>
            </div>
            {filteredAnniversaries.length > 0 && (
              <div className="mt-3 text-center text-muted small">
                Showing {filteredAnniversaries.length} of {allAnniversaries.length} anniversaries
              </div>
            )}
          </Card.Body>
        </Card>
      ) : (
        // Overview Tab Content
        <>
          {/* Today's Events Widget */}
          {todayEvents && todayEvents.total > 0 && (
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
                  <Button variant="link" size="sm" className="ms-3 p-0" onClick={() => setActiveTab('birthdays')}>
                    View All Birthdays →
                  </Button>
                  <Button variant="link" size="sm" className="ms-2 p-0" onClick={() => setActiveTab('anniversaries')}>
                    View All Anniversaries →
                  </Button>
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
              <div className="d-flex gap-2">
                <InputGroup size="sm" style={{ width: '250px' }}>
                  <InputGroup.Text><FaSearch size={12} /></InputGroup.Text>
                  <Form.Control type="text" placeholder="Search by name or ID..." value={attendanceSearchTerm} onChange={(e) => setAttendanceSearchTerm(e.target.value)} />
                  {attendanceSearchTerm && <Button variant="outline-secondary" onClick={() => setAttendanceSearchTerm('')} size="sm"><FaTimesCircle size={12} /></Button>}
                </InputGroup>
                <Badge bg="dark" className="px-3 py-2">{filteredAttendance.length} / {todayAttendance.length} Records</Badge>
              </div>
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
                    {filteredAttendance.length > 0 ? (
                      filteredAttendance.map((att, index) => (
                        <tr key={att.id || index}>
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
              <div className="d-flex gap-2">
                <InputGroup size="sm" style={{ width: '250px' }}>
                  <InputGroup.Text><FaSearch size={12} /></InputGroup.Text>
                  <Form.Control type="text" placeholder="Search by name or ID..." value={leaveSearchTerm} onChange={(e) => setLeaveSearchTerm(e.target.value)} />
                  {leaveSearchTerm && <Button variant="outline-secondary" onClick={() => setLeaveSearchTerm('')} size="sm"><FaTimesCircle size={12} /></Button>}
                </InputGroup>
                <Badge bg="light" text="dark" className="px-3 py-2">{filteredLeaveRequests.length} / {leaveRequests.length} Pending</Badge>
              </div>
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
                    {filteredLeaveRequests.length > 0 ? (
                      filteredLeaveRequests.map((leave, index) => (
                        <tr key={leave.id}>
                          <td className="text-center">{index + 1}</td>
                          <td className="small"><div className="text-truncate" style={{ maxWidth: '100px' }}>{leave.first_name} {leave.last_name}</div><small className="text-muted">{leave.employee_id}</small></td>
                          <td className="d-none d-md-table-cell"><Badge bg="secondary">{leave.leave_type}</Badge></td>
                          <td className="small"><span className="text-nowrap">{new Date(leave.start_date).toLocaleDateString()}</span>{leave.start_date !== leave.end_date && <span className="text-nowrap d-block">- {new Date(leave.end_date).toLocaleDateString()}</span>}</td>
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
              <h5 className="mb-0 d-flex align-items-center">
                <FaBalanceScale className="me-2 text-dark" />
                <span>Employee Leave Balances</span>
              </h5>
              <div className="d-flex gap-2">
                <Badge bg="info" className="px-3 py-2">
                  Avg: {averageLeavesPerEmployee} days
                </Badge>
                <Badge bg="warning" className="px-3 py-2">
                  Low Balance: {employeesWithLowBalance}
                </Badge>
              </div>
            </Card.Header>
            <Card.Body>
              <Row className="mb-3 g-2">
                <Col xs={12} md={4}>
                  <div className="d-flex align-items-center bg-light rounded-3 p-1">
                    <FaSearch className="ms-2 text-muted" size={14} />
                    <Form.Control
                      type="text"
                      placeholder="Search by name, ID, department..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="border-0 bg-transparent"
                      size="sm"
                    />
                  </div>
                </Col>
                <Col xs={6} md={3}>
                  <Form.Select
                    size="sm"
                    value={filterDepartment}
                    onChange={(e) => setFilterDepartment(e.target.value)}
                  >
                    <option value="all">All Departments</option>
                    {departments.filter(d => d !== 'all').map(dept => (
                      <option key={dept} value={dept}>{dept}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col xs={6} md={3}>
                  <Form.Select
                    size="sm"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="name">Sort by Name</option>
                    <option value="balance">Sort by Balance</option>
                    <option value="department">Sort by Department</option>
                  </Form.Select>
                </Col>
                <Col xs={12} md={2}>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setFilterDepartment('all');
                      setSortBy('name');
                    }}
                    className="w-100"
                  >
                    <FaSyncAlt className="me-1" size={12} />
                    Reset
                  </Button>
                </Col>
              </Row>

              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table striped hover size="sm" className="mb-0">
                  <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                    <tr className="small">
                      <th className="fw-normal text-center" style={{ width: '5%' }}>#</th>
                      <th className="fw-normal" style={{ width: '20%' }}>Employee</th>
                      <th className="fw-normal d-none d-md-table-cell" style={{ width: '15%' }}>Department</th>
                      <th className="fw-normal" style={{ width: '12%' }}>Total Accrued</th>
                      <th className="fw-normal" style={{ width: '10%' }}>Used</th>
                      <th className="fw-normal" style={{ width: '12%' }}>Available</th>
                      <th className="fw-normal" style={{ width: '12%' }}>Status</th>
                      <th className="fw-normal d-none d-lg-table-cell" style={{ width: '14%' }}>Probation</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((emp, index) => {
                        // Get values from leaveBalance
                        const totalAccrued = parseFloat(emp.leaveBalance?.total_accrued) || 0;
                        const used = parseFloat(emp.leaveBalance?.used) || 0;

                        // CRITICAL FIX: Calculate available = total_accrued - used
                        const available = Math.max(0, totalAccrued - used);

                        const isProbation = !emp.leaveBalance?.is_probation_complete && emp.leaveBalance?.months_completed < 6;
                        const monthsCompleted = emp.leaveBalance?.months_completed || 0;

                        let statusColor = 'success';
                        let statusText = 'Good';

                        if (available <= 0) {
                          statusColor = 'danger';
                          statusText = 'No Leaves';
                        } else if (available < 3) {
                          statusColor = 'warning';
                          statusText = 'Low';
                        }

                        return (
                          <tr key={emp.id} className={isProbation ? 'table-light' : ''}>
                            <td className="text-center small">{index + 1}</td>
                            <td className="small">
                              <div className="fw-semibold text-truncate" style={{ maxWidth: '150px' }} title={`${emp.first_name} ${emp.last_name}`}>
                                {emp.first_name} {emp.last_name}
                              </div>
                              <small className="text-muted">{emp.employee_id}</small>
                              {isProbation && (
                                <Badge bg="info" pill className="ms-1" style={{ fontSize: '8px' }}>
                                  Probation
                                </Badge>
                              )}
                            </td>
                            <td className="small d-none d-md-table-cell text-truncate" style={{ maxWidth: '120px' }} title={emp.department}>
                              {emp.department || 'N/A'}
                            </td>
                            <td className="small fw-bold text-primary">
                              {totalAccrued.toFixed(1)}
                            </td>
                            <td className="small text-danger">
                              {used.toFixed(1)}
                            </td>
                            <td className="small">
                              <Badge bg={statusColor} pill className="px-2 py-1">
                                {available.toFixed(1)}
                              </Badge>
                            </td>
                            <td>
                              {available <= 0 ? (
                                <Badge bg="danger" pill>No Leaves</Badge>
                              ) : available < 3 ? (
                                <Badge bg="warning" pill>Low</Badge>
                              ) : (
                                <Badge bg="success" pill>Good</Badge>
                              )}
                            </td>
                            <td className="small d-none d-lg-table-cell">
                              {isProbation ? (
                                <Badge bg="info" pill>
                                  {monthsCompleted}/6 months
                                </Badge>
                              ) : (
                                <Badge bg="success" pill>
                                  Completed
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="8" className="text-center py-4">
                          <p className="text-muted mb-0 small">No employees found</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>

              {/* Summary Footer */}
              {filteredEmployees.length > 0 && (
                <div className="mt-3 pt-2 border-top">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                    <small className="text-muted">
                      Showing {filteredEmployees.length} of {employeeLeaveBalances.length} employees
                    </small>
                    <div className="d-flex gap-3">
                      <small className="text-muted">
                        <Badge bg="success" pill className="me-1">&nbsp;</Badge>
                        Good Balance (&ge;3 days)
                      </small>
                      <small className="text-muted">
                        <Badge bg="warning" pill className="me-1">&nbsp;</Badge>
                        Low Balance (&lt;3 days)
                      </small>
                      <small className="text-muted">
                        <Badge bg="danger" pill className="me-1">&nbsp;</Badge>
                        No Balance (0 days)
                      </small>
                    </div>
                  </div>
                </div>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Export Modal */}
      <Modal show={showExportModal} onHide={() => setShowExportModal(false)} centered>
        <Modal.Header closeButton><Modal.Title className="h6"><FaFileAlt className="me-2" />Export Reports</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3"><Form.Label>Report Type</Form.Label><Form.Select value={exportType} onChange={(e) => setExportType(e.target.value)}><option value="attendance">Attendance Report</option><option value="leave">Leave Report</option><option value="employees">Employees List</option></Form.Select></Form.Group>
            {exportType !== 'employees' && (<><Form.Group className="mb-3"><Form.Label>Start Date</Form.Label><Form.Control type="date" value={exportDateRange.start} onChange={(e) => setExportDateRange({ ...exportDateRange, start: e.target.value })} /></Form.Group><Form.Group className="mb-3"><Form.Label>End Date</Form.Label><Form.Control type="date" value={exportDateRange.end} onChange={(e) => setExportDateRange({ ...exportDateRange, end: e.target.value })} /></Form.Group></>)}
          </Form>
        </Modal.Body>
        <Modal.Footer><Button variant="secondary" size="sm" onClick={() => setShowExportModal(false)}>Cancel</Button><Button variant="success" size="sm" onClick={handleExport} disabled={exporting}>{exporting ? <><Spinner size="sm" animation="border" className="me-2" />Exporting...</> : <><FaDownload className="me-2" />Export</>}</Button></Modal.Footer>
      </Modal>
    </div>
  );
};

export default AdminDashboard;