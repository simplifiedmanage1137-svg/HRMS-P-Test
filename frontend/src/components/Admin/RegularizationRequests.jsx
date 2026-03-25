import React, { useState, useEffect } from 'react';
import {
    Card, Table, Badge, Button, Modal, Form,
    Alert, Spinner, Row, Col, ButtonGroup
} from 'react-bootstrap';
import {
    FaCheckCircle, FaTimesCircle, FaClock, FaUser,
    FaCalendarAlt, FaInfoCircle, FaSyncAlt,
    FaRegClock, FaEye, FaEyeSlash, FaFilter
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNotification } from '../../context/NotificationContext';

const RegularizationRequests = () => {
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
            console.log('📋 Regularization requests fetched:', response.data.requests?.length || 0);
            setRequests(response.data.requests || []);
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
        // Auto-refresh every 30 seconds
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
            const response = await axios.put(
                API_ENDPOINTS.ATTENDANCE_APPROVE_REGULARIZATION(selectedRequest.id),
                {
                    approved_clock_out_time: approvedTime,
                    admin_notes: adminNotes
                }
            );

            console.log('✅ Regularization approved:', response.data);

            setMessage({ type: 'success', text: 'Regularization request approved successfully!' });

            // Close modals and clear selections
            setShowApproveModal(false);
            setSelectedRequest(null);
            setApprovedTime('');
            setAdminNotes('');

            // Add notification for employee
            if (addNotification) {
                addNotification({
                    employee_id: selectedRequest.employee_id,
                    title: 'Regularization Request Approved',
                    message: `Your regularization request for ${selectedRequest.attendance_date} has been approved.`,
                    type: 'regularization_approved'
                });
            }

            // IMPORTANT: Fetch fresh data to update the list
            await fetchRequests();

            // Clear success message after 3 seconds
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
            const response = await axios.put(
                API_ENDPOINTS.ATTENDANCE_REJECT_REGULARIZATION(selectedRequest.id),
                { rejection_reason: rejectionReason }
            );

            console.log('❌ Regularization rejected:', response.data);

            setMessage({ type: 'success', text: 'Regularization request rejected' });
            setShowRejectModal(false);
            setSelectedRequest(null);
            setRejectionReason('');

            // Add notification for employee
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
        try {
            const date = new Date(datetime);
            // Check if date is valid
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleString('en-US', {
                day: '2-digit',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        } catch (error) {
            return 'N/A';
        }
    };

    const formatRequestedClockOutTime = (datetime) => {
        if (!datetime) return 'N/A';
        let value = String(datetime).trim();

        // preserve raw local format
        value = value.replace('T', ' ');

        // If includes seconds, trim to minutes for display
        const trimmed = value.replace(/:\d{2}$/,'');

        return trimmed;
    };

    const toDatetimeLocal = (datetime) => {
        if (!datetime) return '';
        let value = String(datetime).trim().replace(' ', 'T');

        // If seconds exist, remove them
        if (value.match(/\.\d{3}Z$/)) {
            // ISO with timezone
            const date = new Date(value);
            if (isNaN(date.getTime())) return '';
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hour = String(date.getHours()).padStart(2, '0');
            const minute = String(date.getMinutes()).padStart(2, '0');
            return `${year}-${month}-${day}T${hour}:${minute}`;
        }

        if (value.includes('T')) {
            const [datePart, timePart] = value.split('T');
            const [hour, minute] = (timePart || '').split(':');
            if (hour && minute) return `${datePart}T${hour}:${minute}`;
        }

        return '';
    };


    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            if (isNaN(date.getTime())) return 'N/A';
            return date.toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return 'N/A';
        }
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

    if (loading) {
        return (
            <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '300px' }}>
                <Spinner animation="border" variant="primary" />
            </div>
        );
    }

    return (
        <div className="p-3 p-md-4">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
                <div>
                    <h5 className="mb-1 d-flex align-items-center">
                        <FaRegClock className="me-2 text-warning" />
                        Regularization Requests
                    </h5>
                    <p className="text-muted mb-0 small">
                        Manage employee requests for missed clock-outs
                    </p>
                </div>
                <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={fetchRequests}
                    className="d-flex align-items-center"
                >
                    <FaSyncAlt className="me-2" size={12} />
                    Refresh
                </Button>
            </div>

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

            {/* Filter Buttons */}
            <div className="mb-3">
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
            </div>

            {filteredRequests.length === 0 ? (
                <Card className="border-0 shadow-sm">
                    <Card.Body className="text-center py-5">
                        <FaRegClock size={50} className="text-muted mb-3 opacity-50" />
                        <p className="text-muted mb-0">No regularization requests found</p>
                        {filter !== 'all' && (
                            <Button
                                variant="link"
                                size="sm"
                                onClick={() => setFilter('all')}
                                className="mt-2"
                            >
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
                                                                    setApprovedTime(toDatetimeLocal(request.requested_clock_out_time));
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
                                                            {request.status === 'approved' && (
                                                                <>
                                                                    <Col xs={12} md={6}>
                                                                        <div className="small">
                                                                            <strong>Approved Clock Out:</strong>
                                                                            <p className="text-success mb-0 mt-1">
                                                                                {formatDateTime(request.approved_clock_out_time)}
                                                                            </p>
                                                                        </div>
                                                                    </Col>
                                                                    <Col xs={12} md={6}>
                                                                        <div className="small">
                                                                            <strong>Admin Notes:</strong>
                                                                            <p className="text-muted mb-0 mt-1">
                                                                                {request.admin_notes || 'No notes'}
                                                                            </p>
                                                                        </div>
                                                                    </Col>
                                                                </>
                                                            )}
                                                            {request.status === 'rejected' && (
                                                                <Col xs={12}>
                                                                    <div className="small">
                                                                        <strong>Rejection Reason:</strong>
                                                                        <p className="text-danger mb-0 mt-1">
                                                                            {request.rejection_reason || 'No reason provided'}
                                                                        </p>
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