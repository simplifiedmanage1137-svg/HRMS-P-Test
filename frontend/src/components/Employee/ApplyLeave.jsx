// components/Employee/ApplyLeave.jsx
import React, { useState, useEffect } from 'react';
import { 
  Card, Form, Button, Row, Col, Alert, 
  Spinner, Badge, ProgressBar 
} from 'react-bootstrap';
import { 
  FaCalendarAlt, 
  FaPaperPlane, 
  FaTimes, 
  FaInfoCircle,
  FaUmbrellaBeach,
  FaClock,
  FaCheckCircle,
  FaExclamationTriangle,
  FaMoneyBillWave,
  FaHourglassHalf
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const ApplyLeave = () => {
  const { user } = useAuth();
  const { showNotification } = useNotification();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [leaveBalance, setLeaveBalance] = useState({
    available: 0,
    total_accrued: 0,
    used: 0,
    pending: 0,
    months_completed: 0,
    is_eligible: false,
    eligible_from_date: ''
  });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [employeeDetails, setEmployeeDetails] = useState({
    joining_date: '',
    reporting_manager: '',
    months_completed: 0
  });
  const [formData, setFormData] = useState({
    leave_type: 'Unpaid',
    leave_duration: 'Full Day',
    half_day_type: '',
    start_date: '',
    end_date: '',
    reason: '',
    reporting_manager: ''
  });
  const [calculatedDays, setCalculatedDays] = useState(1);
  const [errors, setErrors] = useState({});
  
  // Leave types based on eligibility
  const getAvailableLeaveTypes = () => {
    if (leaveBalance.is_eligible) {
      // After probation - all leave types available
      return [
        { value: 'Annual', label: 'Annual Leave', icon: '🌴' },
        { value: 'Sick', label: 'Sick Leave', icon: '🤒' },
        { value: 'Personal', label: 'Personal Leave', icon: '👤' },
        { value: 'Maternity', label: 'Maternity Leave', icon: '🤱' },
        { value: 'Paternity', label: 'Paternity Leave', icon: '👨‍👧' },
        { value: 'Bereavement', label: 'Bereavement Leave', icon: '💐' },
        { value: 'Unpaid', label: 'Unpaid Leave', icon: '💰' },
        { value: 'Compensatory Off', label: 'Compensatory Off', icon: '🕒' }
      ];
    } else {
      // During probation - only Unpaid leave available
      return [
        { value: 'Unpaid', label: 'Unpaid Leave (Only option during probation)', icon: '💰' }
      ];
    }
  };

  const [halfDayOptions] = useState([
    { value: 'first_half', label: 'First Half (9:00 AM - 1:00 PM)' },
    { value: 'second_half', label: 'Second Half (2:00 PM - 6:00 PM)' }
  ]);

  useEffect(() => {
    if (user?.employeeId) {
      fetchEmployeeDetails();
      fetchLeaveBalance();
      fetchRecentLeaves();
    }
  }, [user]);

  useEffect(() => {
    calculateDays();
  }, [formData.start_date, formData.end_date, formData.leave_duration]);

  useEffect(() => {
    // Reset leave type based on eligibility when balance updates
    if (!leaveBalance.is_eligible) {
      setFormData(prev => ({
        ...prev,
        leave_type: 'Unpaid'
      }));
    } else {
      // If eligible, default to Annual leave
      setFormData(prev => ({
        ...prev,
        leave_type: 'Annual'
      }));
    }
  }, [leaveBalance.is_eligible]);

  const fetchEmployeeDetails = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/employees/profile/${user.employeeId}`);
      
      // Calculate months completed from joining date
      const joiningDate = new Date(response.data.joining_date);
      const today = new Date();
      let months = (today.getFullYear() - joiningDate.getFullYear()) * 12 + 
                   (today.getMonth() - joiningDate.getMonth());
      
      // Adjust for day of month
      if (today.getDate() < joiningDate.getDate()) {
        months -= 1;
      }
      
      // Ensure not negative
      months = Math.max(0, months);
      
      setEmployeeDetails({
        joining_date: response.data.joining_date,
        reporting_manager: response.data.reporting_manager || '',
        months_completed: months
      });
      
      if (response.data.reporting_manager) {
        setFormData(prev => ({
          ...prev,
          reporting_manager: response.data.reporting_manager
        }));
      }
    } catch (error) {
      console.error('Error fetching employee details:', error);
    }
  };

// ApplyLeave.jsx mein fetchLeaveBalance function mein yeh add karo:

const fetchLeaveBalance = async () => {
  try {
    setLoading(true);
    const response = await axios.get(`http://localhost:5000/api/leaves/balance/${user.employeeId}`);
    
    console.log('🔍 LEAVE BALANCE RESPONSE:', response.data); // YEH DEKHO
    
    setLeaveBalance({
      available: response.data.available || 0,
      total_accrued: response.data.total_accrued || 0,
      used: response.data.used || 0,
      pending: response.data.pending || 0,
      months_completed: response.data.months_completed || 0,
      is_eligible: response.data.is_eligible || false,
      eligible_from_date: response.data.eligible_from_date || ''
    });
    
    setLoading(false);
  } catch (error) {
    console.error('Error fetching leave balance:', error);
    showNotification('Failed to load leave balance', 'danger');
    setLoading(false);
  }
};

  const fetchRecentLeaves = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/leaves?employee_id=${user.employeeId}`);
      setRecentLeaves(response.data.slice(0, 3));
    } catch (error) {
      console.error('Error fetching recent leaves:', error);
    }
  };

  const calculateDays = () => {
    if (!formData.start_date) {
      setCalculatedDays(0);
      return;
    }

    if (formData.leave_duration === 'Half Day') {
      setCalculatedDays(0.5);
      return;
    }

    if (!formData.end_date) {
      setCalculatedDays(1);
      return;
    }

    const start = new Date(formData.start_date);
    const end = new Date(formData.end_date);
    
    if (start > end) {
      setErrors(prev => ({
        ...prev,
        end_date: 'End date cannot be before start date'
      }));
      setCalculatedDays(0);
      return;
    }

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    setCalculatedDays(diffDays);
    setErrors(prev => ({ ...prev, end_date: '' }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }

    // Auto-set end date for half day
    if (name === 'leave_duration' && value === 'Half Day') {
      setFormData(prev => ({
        ...prev,
        end_date: prev.start_date || ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.leave_type) {
      newErrors.leave_type = 'Please select leave type';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'Start date is required';
    }

    if (formData.leave_duration === 'Half Day' && !formData.half_day_type) {
      newErrors.half_day_type = 'Please select which half';
    }

    if (formData.leave_duration === 'Full Day' && !formData.end_date) {
      newErrors.end_date = 'End date is required';
    }

    if (formData.start_date && formData.end_date && formData.start_date > formData.end_date) {
      newErrors.end_date = 'End date cannot be before start date';
    }

    if (!formData.reason) {
      newErrors.reason = 'Reason is required';
    } else if (formData.reason.length < 10) {
      newErrors.reason = 'Reason must be at least 10 characters';
    }

    // Check leave balance only for non-Unpaid leaves after probation
    if (leaveBalance.is_eligible && formData.leave_type !== 'Unpaid') {
      if (calculatedDays > leaveBalance.available) {
        newErrors.balance = `Insufficient leave balance. Available: ${leaveBalance.available} days`;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      showNotification('Please fix the errors in the form', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      const leaveData = {
        ...formData,
        employee_id: user.employeeId,
        days_count: calculatedDays,
        applied_date: new Date().toISOString().split('T')[0]
      };

      const response = await axios.post('http://localhost:5000/api/leaves/apply', leaveData, {
        headers: {
          'employee-id': user.employeeId
        }
      });

      if (response.data.success) {
        showNotification('Leave request submitted successfully!', 'success');
        
        // Reset form
        setFormData({
          leave_type: leaveBalance.is_eligible ? 'Annual' : 'Unpaid',
          leave_duration: 'Full Day',
          half_day_type: '',
          start_date: '',
          end_date: '',
          reason: '',
          reporting_manager: employeeDetails.reporting_manager
        });
        
        // Refresh data
        await fetchLeaveBalance();
        await fetchRecentLeaves();
        
        // Navigate back after short delay
        setTimeout(() => {
          navigate('/employee/dashboard');
        }, 2000);
      }
    } catch (error) {
      console.error('Error submitting leave:', error);
      showNotification(
        error.response?.data?.message || 'Failed to submit leave request',
        'danger'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate('/employee/dashboard');
  };

  const getLeaveBalanceColor = () => {
    if (!leaveBalance.is_eligible) return 'secondary';
    const percentage = (leaveBalance.used / leaveBalance.total_accrued) * 100;
    if (percentage >= 80) return 'danger';
    if (percentage >= 50) return 'warning';
    return 'success';
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatJoiningDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const calculateProgressToEligibility = () => {
    return Math.min(100, (leaveBalance.months_completed / 6) * 100);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted small">Loading leave application...</p>
        </div>
      </div>
    );
  }

  const availableLeaveTypes = getAvailableLeaveTypes();

  // Debug log
  console.log('Rendering with leaveBalance:', leaveBalance);

  return (
    <div className="p-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1">
            <FaUmbrellaBeach className="me-2 text-primary" />
            Apply for Leave
          </h4>
          <p className="text-muted mb-0 small">
            {leaveBalance.is_eligible 
              ? 'You can apply for any type of leave' 
              : 'During probation, only Unpaid Leave is available'}
          </p>
        </div>
        <Button 
          variant="outline-secondary" 
          size="sm"
          onClick={handleCancel}
        >
          <FaTimes className="me-2" size={12} />
          Cancel
        </Button>
      </div>

      <Row>
        {/* Main Form Column */}
        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">Leave Request Form</h6>
            </Card.Header>
            <Card.Body>
              {/* Probation Status Alert - Only show if NOT eligible */}
              {!leaveBalance.is_eligible && (
                <Alert variant="info" className="mb-4">
                  <div className="d-flex align-items-center">
                    <FaInfoCircle className="me-3 text-primary" size={20} />
                    <div>
                      <h6 className="alert-heading mb-1">Probation Period</h6>
                      <p className="mb-0 small">
                        You are currently in your probation period. Only <strong>Unpaid Leave</strong> is available.
                        After completing 6 months (from {leaveBalance.eligible_from_date || 'N/A'}), all leave types will be available.
                      </p>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Eligibility Progress Bar - Only show during probation */}
              {!leaveBalance.is_eligible && (
                <div className="mb-4">
                  <div className="d-flex justify-content-between mb-1 small">
                    <span className="text-muted">Progress to eligibility:</span>
                    <span className="fw-semibold">{leaveBalance.months_completed} / 6 months</span>
                  </div>
                  <ProgressBar 
                    now={calculateProgressToEligibility()} 
                    variant="info"
                    style={{ height: '8px' }}
                  />
                  <small className="text-muted d-block mt-1">
                    Eligible from: {leaveBalance.eligible_from_date || 'N/A'}
                  </small>
                </div>
              )}

              <Form onSubmit={handleSubmit}>
                {/* Leave Type */}
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold text-muted">
                    Leave Type <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Select
                    name="leave_type"
                    value={formData.leave_type}
                    onChange={handleChange}
                    size="sm"
                    isInvalid={!!errors.leave_type}
                  >
                    {availableLeaveTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.icon} {type.label}
                      </option>
                    ))}
                  </Form.Select>
                  {errors.leave_type && (
                    <Form.Control.Feedback type="invalid">
                      {errors.leave_type}
                    </Form.Control.Feedback>
                  )}
                  {!leaveBalance.is_eligible && (
                    <Form.Text className="text-muted">
                      <FaInfoCircle className="me-1" size={10} />
                      During probation, only Unpaid Leave is available. Paid leaves will be available after {leaveBalance.eligible_from_date || 'N/A'}
                    </Form.Text>
                  )}
                </Form.Group>

                {/* Leave Duration */}
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold text-muted">
                    Leave Duration <span className="text-danger">*</span>
                  </Form.Label>
                  <div>
                    <Form.Check
                      inline
                      type="radio"
                      label="Full Day"
                      name="leave_duration"
                      value="Full Day"
                      checked={formData.leave_duration === 'Full Day'}
                      onChange={handleChange}
                      className="me-3"
                    />
                    <Form.Check
                      inline
                      type="radio"
                      label="Half Day"
                      name="leave_duration"
                      value="Half Day"
                      checked={formData.leave_duration === 'Half Day'}
                      onChange={handleChange}
                    />
                  </div>
                </Form.Group>

                {/* Half Day Type */}
                {formData.leave_duration === 'Half Day' && (
                  <Form.Group className="mb-3">
                    <Form.Label className="small fw-semibold text-muted">
                      Select Half <span className="text-danger">*</span>
                    </Form.Label>
                    <Form.Select
                      name="half_day_type"
                      value={formData.half_day_type}
                      onChange={handleChange}
                      size="sm"
                      isInvalid={!!errors.half_day_type}
                    >
                      <option value="">Choose which half...</option>
                      {halfDayOptions.map(option => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Form.Select>
                    {errors.half_day_type && (
                      <Form.Control.Feedback type="invalid">
                        {errors.half_day_type}
                      </Form.Control.Feedback>
                    )}
                  </Form.Group>
                )}

                {/* Date Range */}
                <Row className="mb-3">
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        Start Date <span className="text-danger">*</span>
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="start_date"
                        value={formData.start_date}
                        onChange={handleChange}
                        size="sm"
                        isInvalid={!!errors.start_date}
                        min={new Date().toISOString().split('T')[0]}
                      />
                      {errors.start_date && (
                        <Form.Control.Feedback type="invalid">
                          {errors.start_date}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group>
                      <Form.Label className="small fw-semibold text-muted">
                        {formData.leave_duration === 'Half Day' ? 'Date' : 'End Date'} 
                        {formData.leave_duration === 'Full Day' && <span className="text-danger">*</span>}
                      </Form.Label>
                      <Form.Control
                        type="date"
                        name="end_date"
                        value={formData.end_date}
                        onChange={handleChange}
                        size="sm"
                        isInvalid={!!errors.end_date}
                        disabled={formData.leave_duration === 'Half Day'}
                        min={formData.start_date || new Date().toISOString().split('T')[0]}
                      />
                      {errors.end_date && (
                        <Form.Control.Feedback type="invalid">
                          {errors.end_date}
                        </Form.Control.Feedback>
                      )}
                    </Form.Group>
                  </Col>
                </Row>

                {/* Reason */}
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold text-muted">
                    Reason for Leave <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="reason"
                    value={formData.reason}
                    onChange={handleChange}
                    size="sm"
                    placeholder="Please provide detailed reason for your leave request..."
                    isInvalid={!!errors.reason}
                  />
                  {errors.reason && (
                    <Form.Control.Feedback type="invalid">
                      {errors.reason}
                    </Form.Control.Feedback>
                  )}
                  <Form.Text className="text-muted">
                    {formData.reason.length}/500 characters
                  </Form.Text>
                </Form.Group>

                {/* Reporting Manager */}
                <Form.Group className="mb-4">
                  <Form.Label className="small fw-semibold text-muted">
                    Reporting Manager
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="reporting_manager"
                    value={formData.reporting_manager}
                    onChange={handleChange}
                    size="sm"
                    placeholder="Your reporting manager"
                    readOnly
                    className="bg-light"
                  />
                </Form.Group>

                {/* Balance Error - Only show for non-Unpaid leaves after probation */}
                {errors.balance && leaveBalance.is_eligible && formData.leave_type !== 'Unpaid' && (
                  <Alert variant="danger" className="py-2 small">
                    <FaExclamationTriangle className="me-2" />
                    {errors.balance}
                  </Alert>
                )}

                {/* Info for Unpaid Leave during probation */}
                {!leaveBalance.is_eligible && formData.leave_type === 'Unpaid' && (
                  <Alert variant="info" className="py-2 small">
                    <FaMoneyBillWave className="me-2" />
                    Unpaid Leave will not deduct from your accrued leave balance.
                  </Alert>
                )}

                {/* Submit Buttons */}
                <div className="d-flex gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={submitting || (leaveBalance.is_eligible && formData.leave_type !== 'Unpaid' && calculatedDays > leaveBalance.available)}
                    className="px-4"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <FaPaperPlane className="me-2" size={12} />
                        Submit Request
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* Right Column - Leave Balance & Info */}
        <Col lg={4}>
          {/* Leave Balance Card */}
          <Card className="border-0 shadow-sm mb-3">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaInfoCircle className="me-2 text-primary" size={14} />
                Your Leave Balance
              </h6>
            </Card.Header>
            <Card.Body>
              {/* Status Badge */}
              <div className={`text-center mb-3 p-2 rounded ${leaveBalance.is_eligible ? 'bg-success bg-opacity-10' : 'bg-info bg-opacity-10'}`}>
                {leaveBalance.is_eligible ? (
                  <>
                    <FaCheckCircle className="text-success mb-2" size={24} />
                    <p className="small text-success fw-semibold mb-0">Probation Completed</p>
                    <p className="small text-muted mt-1">All leave types available</p>
                  </>
                ) : (
                  <>
                    <FaHourglassHalf className="text-info mb-2" size={24} />
                    <p className="small text-info fw-semibold mb-0">Probation Period</p>
                    <p className="small text-muted mt-1">Only Unpaid Leave available</p>
                  </>
                )}
              </div>

              {/* Leave Balance Display */}
              <div className="text-center mb-3">
                <h3 className={`display-6 fw-bold ${leaveBalance.is_eligible ? 'text-primary' : 'text-muted'}`}>
                  {leaveBalance.available}
                </h3>
                <p className="text-muted small">Available Leaves</p>
                {!leaveBalance.is_eligible && (
                  <Badge bg="secondary" className="mt-1">
                    Accruing but not usable yet
                  </Badge>
                )}
              </div>

              {/* Leave Balance Details */}
              <div className="mb-3">
                <div className="d-flex justify-content-between mb-1 small">
                  <span className="text-muted">Total Accrued:</span>
                  <span className="fw-semibold">{leaveBalance.total_accrued} days</span>
                </div>
                <div className="d-flex justify-content-between mb-1 small">
                  <span className="text-muted">Used:</span>
                  <span className="fw-semibold">{leaveBalance.used} days</span>
                </div>
                <div className="d-flex justify-content-between mb-2 small">
                  <span className="text-muted">Pending:</span>
                  <span className="fw-semibold">{leaveBalance.pending} days</span>
                </div>

                {/* Progress Bar - Only show if eligible or for display */}
                {leaveBalance.total_accrued > 0 && (
                  <>
                    <ProgressBar 
                      now={(leaveBalance.used / leaveBalance.total_accrued) * 100} 
                      variant={getLeaveBalanceColor()} 
                      style={{ height: '6px' }}
                    />
                    <small className="text-muted d-block text-center mt-1">
                      {((leaveBalance.used / leaveBalance.total_accrued) * 100 || 0).toFixed(1)}% used
                    </small>
                  </>
                )}
              </div>

              {/* Days Calculation Preview */}
              {calculatedDays > 0 && (
                <Alert variant="info" className="py-2 small mb-0">
                  <FaClock className="me-2" />
                  This request is for <strong>{calculatedDays} day{calculatedDays > 1 ? 's' : ''}</strong>
                  {leaveBalance.is_eligible && formData.leave_type !== 'Unpaid' && (
                    <>
                      <br />
                      <small>Balance after request: <strong>{leaveBalance.available - calculatedDays}</strong> days</small>
                    </>
                  )}
                  {(!leaveBalance.is_eligible || formData.leave_type === 'Unpaid') && (
                    <>
                      <br />
                      <small className="text-muted">Unpaid Leave - No deduction from balance</small>
                    </>
                  )}
                </Alert>
              )}

              {/* Joining Info */}
              <div className="mt-3 pt-2 border-top small text-muted">
                <p className="mb-1">
                  <strong>Joining Date:</strong> {formatJoiningDate(employeeDetails.joining_date)}
                </p>
                <p className="mb-1">
                  <strong>Months Completed:</strong> {leaveBalance.months_completed} / 6
                </p>
                {!leaveBalance.is_eligible ? (
                  <p className="mb-0 text-info">
                    <strong>Probation ends:</strong> {leaveBalance.eligible_from_date || 'N/A'}
                  </p>
                ) : (
                  <p className="mb-0 text-success">
                    <strong>Probation completed on:</strong> {leaveBalance.eligible_from_date}
                  </p>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Recent Leaves Card */}
          {recentLeaves.length > 0 && (
            <Card className="border-0 shadow-sm mb-3">
              <Card.Header className="bg-white py-3">
                <h6 className="mb-0">
                  <FaCalendarAlt className="me-2 text-primary" size={14} />
                  Recent Requests
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="list-group list-group-flush">
                  {recentLeaves.map((leave, index) => (
                    <div key={leave.id || index} className="list-group-item py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div>
                          <span className="small fw-semibold">
                            {leave.leave_type === 'Unpaid' ? '💰 ' : '🌴 '}
                            {leave.leave_type}
                          </span>
                          <br />
                          <small className="text-muted">
                            {formatDate(leave.start_date)}
                            {leave.start_date !== leave.end_date && ` - ${formatDate(leave.end_date)}`}
                          </small>
                        </div>
                        <Badge 
                          bg={
                            leave.status === 'approved' ? 'success' :
                            leave.status === 'pending' ? 'warning' : 'danger'
                          }
                          pill
                        >
                          {leave.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Info Card */}
          <Card className="border-0 shadow-sm bg-light">
            <Card.Body className="p-3">
              <h6 className="small fw-semibold mb-2">Leave Policy</h6>
              <ul className="small text-muted ps-3 mb-0">
                <li>
                  <strong>During Probation (First 6 months):</strong>
                  <ul className="ps-3 mt-1">
                    <li>Only Unpaid Leave is available</li>
                    <li>Leaves accrue at 1.5 days/month but cannot be used</li>
                    <li>Unpaid Leave doesn't deduct from accrued balance</li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>After Probation (6+ months):</strong>
                  <ul className="ps-3 mt-1">
                    <li>All leave types become available</li>
                    <li>Annual leaves: 1.5 days/month (18 days/year)</li>
                    <li>Can use previously accrued leaves</li>
                  </ul>
                </li>
                <li className="mt-2">Submit at least 3 days in advance</li>
                <li>Medical leaves require doctor's note</li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default ApplyLeave;