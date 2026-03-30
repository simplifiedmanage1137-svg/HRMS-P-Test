// components/Admin/RegularizationRequests.jsx
import React, { useState, useEffect } from 'react';
import {
    Card, Table, Badge, Button, Modal, Form,
    Alert, Spinner, Row, Col, ButtonGroup
} from 'react-bootstrap';
import {
    FaCheckCircle, FaTimesCircle, FaClock, FaUser,
    FaCalendarAlt, FaInfoCircle, FaSyncAlt,
    FaRegClock, FaEye, FaEyeSlash, FaFilter,
    FaArrowLeft, FaArrowRight
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext';

const RegularizationRequests = ({ onRequestCountChange, onRegularizationApproved }) => {
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
            console.log('📡 Fetching pending regularization requests...');

            const response = await axios.get(API_ENDPOINTS.ATTENDANCE_PENDING_REGULARIZATIONS);
            console.log('📡 API Response:', response.data);

            let requestsData = response.data.requests || [];

            // ✅ Process requests to ensure IDs are strings
            const processedRequests = requestsData.map(req => ({
                ...req,
                id: String(req.id)
            }));

            console.log('📋 Processed requests count:', processedRequests.length);

            setRequests(processedRequests);

            if (onRequestCountChange) {
                const pendingCount = processedRequests.filter(r => r.status === 'pending').length;
                onRequestCountChange(pendingCount);
                console.log(`📊 Pending count updated: ${pendingCount}`);
            }

            setCurrentPage(1);

        } catch (error) {
            console.error('❌ Error fetching regularization requests:', error);
            console.error('Error details:', error.response?.data);
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
        console.log('Selected Request:', selectedRequest);
        console.log('Request ID being sent:', selectedRequest.id);
        console.log('Request ID type:', typeof selectedRequest.id);
        if (!selectedRequest) return;
        if (!approvedTime) {
            setMessage({ type: 'warning', text: 'Please select clock-out time' });
            return;
        }

        setProcessing(true);
        setMessage({ type: '', text: '' });

        try {
            const requestId = String(selectedRequest.id).trim();
            console.log('📤 Approving request with ID:', requestId);

            // ✅ Format the approved time correctly
            let formattedTime = approvedTime;
            if (approvedTime && !approvedTime.includes(':')) {
                formattedTime = `${approvedTime}:00`;
            }

            console.log('📤 Approved time:', formattedTime);
            console.log('📤 Admin notes:', adminNotes);

            // ✅ Make the API call
            const response = await axios.put(
                API_ENDPOINTS.ATTENDANCE_APPROVE_REGULARIZATION(requestId),
                {
                    approved_clock_out_time: formattedTime,
                    admin_notes: adminNotes || ''
                }
            );

            console.log('✅ Approval response:', response.data);

            // ✅ Show success message
            setMessage({
                type: 'success',
                text: 'Regularization request approved successfully!'
            });

            // ✅ CRITICAL: Fetch fresh data from backend to ensure consistency
            await fetchRequests();

            // ✅ Notify parent component
            if (onRegularizationApproved) {
                onRegularizationApproved(selectedRequest.employee_id);
            }

            // ✅ Close the modal and clear selection
            setShowApproveModal(false);
            setSelectedRequest(null);
            setApprovedTime('');
            setAdminNotes('');

            // ✅ Clear success message after 3 seconds
            setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 3000);

        } catch (error) {
            console.error('❌ Error approving regularization:', error);
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
        if (!rejectionReason) {
            setMessage({ type: 'warning', text: 'Please provide a rejection reason' });
            return;
        }

        setProcessing(true);
        setMessage({ type: '', text: '' });

        try {
            const requestId = String(selectedRequest.id).trim();
            console.log('📤 Rejecting request with ID:', requestId);

            const response = await axios.put(
                API_ENDPOINTS.ATTENDANCE_REJECT_REGULARIZATION(requestId),
                { rejection_reason: rejectionReason }
            );

            console.log('❌ Regularization rejected:', response.data);

            setMessage({ type: 'success', text: 'Regularization request rejected' });

            // ✅ CRITICAL: Fetch fresh data from backend
            await fetchRequests();

            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectionReason('');

            if (addNotification) {
                addNotification({
                    employee_id: selectedRequest.employee_id,
                    title: 'Regularization Request Rejected',
                    message: `Your regularization request for ${selectedRequest.attendance_date} has been rejected. Reason: ${rejectionReason}`,
                    type: 'regularization_rejected'
                });
            }

            setTimeout(() => {
                setMessage({ type: '', text: '' });
            }, 3000);

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

    const formatRequestedClockOutTime = (datetime) => {
        if (!datetime) return 'N/A';
        let value = String(datetime).trim();
        if (value.includes(' ') && !value.includes('T')) {
            const timePart = value.split(' ')[1];
            const [hour, minute] = timePart.split(':');
            const hourNum = parseInt(hour);
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const hour12 = hourNum % 12 || 12;
            return `${hour12}:${minute} ${ampm}`;
        }
        if (value.includes('T')) {
            const timePart = value.split('T')[1];
            const [hour, minute] = timePart.split(':');
            const hourNum = parseInt(hour);
            const ampm = hourNum >= 12 ? 'PM' : 'AM';
            const hour12 = hourNum % 12 || 12;
            return `${hour12}:${minute} ${ampm}`;
        }
        return datetime;
    };

    const toDatetimeLocal = (datetime) => {
        if (!datetime) return '';
        let value = String(datetime).trim();
        if (value.includes(' ') && !value.includes('T')) {
            const [datePart, timePart] = value.split(' ');
            const [hour, minute] = timePart.split(':');
            return `${datePart}T${hour}:${minute}`;
        }
        if (value.includes('T')) {
            const [datePart, timePart] = value.split('T');
            const [hour, minute] = (timePart || '').split(':');
            if (hour && minute) return `${datePart}T${hour}:${minute}`;
        }
        return '';
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
                    <div className="d-flex align-items-center">
                        {message.type === 'success' && <FaCheckCircle className="me-2 flex-shrink-0" size={14} />}
                        {message.type === 'danger' && <FaTimesCircle className="me-2 flex-shrink-0" size={14} />}
                        <span className="small">{message.text}</span>
                    </div>
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
                <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={fetchRequests}
                    className="ms-auto"
                    disabled={loading}
                >
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
                                                                {formatRequestedClockOutTime(request.requested_clock_out_time)}
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
                                                                            const localTime = toDatetimeLocal(request.requested_clock_out_time);
                                                                            setApprovedTime(localTime || '');
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
                                            <p className="mb-0 text-warning">{formatRequestedClockOutTime(selectedRequest.requested_clock_out_time)}</p>
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

export default RegularizationRequests;