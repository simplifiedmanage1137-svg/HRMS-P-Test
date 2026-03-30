// src/components/Employee/ApplyLeave.jsx
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
  FaHourglassHalf,
  FaTrophy
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
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
    comp_off_balance: 0,
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

  const getAvailableLeaveTypes = () => {
    const types = [];

    // Always show Comp-Off if balance > 0
    if (leaveBalance.comp_off_balance > 0) {
      types.push({
        value: 'Comp-Off',
        label: `Comp-Off (${leaveBalance.comp_off_balance} days available)`,
        icon: '🎉',
        color: 'purple'
      });
    }

    // Always show Unpaid Leave
    types.push({ value: 'Unpaid', label: 'Unpaid Leave', icon: '💰' });

    // Only show paid leaves if probation is complete
    // ✅ FIX: Use is_probation_complete instead of is_eligible
    const isProbationComplete = leaveBalance.is_probation_complete || leaveBalance.is_eligible;

    if (isProbationComplete) {
      types.push(
        { value: 'Annual', label: 'Annual Leave', icon: '🌴' },
        { value: 'Sick', label: 'Sick Leave', icon: '🤒' },
        { value: 'Personal', label: 'Personal Leave', icon: '👤' },
        { value: 'Maternity', label: 'Maternity Leave', icon: '🤱' },
        { value: 'Paternity', label: 'Paternity Leave', icon: '👨‍👧' },
        { value: 'Bereavement', label: 'Bereavement Leave', icon: '💐' }
      );
    }

    return types;
  };

  const [halfDayOptions] = useState([
    { value: 'first_half', label: 'First Half (9:00 AM - 1:00 PM)' },
    { value: 'second_half', label: 'Second Half (2:00 PM - 6:00 PM)' }
  ]);

  useEffect(() => {
    if (user?.employeeId) {
      // Add timeout to prevent infinite loading
      const timeoutId = setTimeout(() => {
        if (loading) {
          console.log('Loading timeout - forcing stop');
          setLoading(false);
          showNotification('Loading took too long. Please refresh.', 'warning');
        }
      }, 10000);

      Promise.all([
        fetchEmployeeDetails(),
        fetchLeaveBalance(),
        fetchRecentLeaves()
      ]).finally(() => {
        clearTimeout(timeoutId);
      });
    }
  }, [user]);

  useEffect(() => {
    calculateDays();
  }, [formData.start_date, formData.end_date, formData.leave_duration]);

  useEffect(() => {
    // Reset leave type based on eligibility when balance updates
    if (!leaveBalance.is_eligible && !leaveBalance.is_probation_complete) {
      if (leaveBalance.comp_off_balance > 0) {
        setFormData(prev => ({
          ...prev,
          leave_type: 'Comp-Off'
        }));
      } else {
        setFormData(prev => ({
          ...prev,
          leave_type: 'Unpaid'
        }));
      }
    } else if (leaveBalance.is_eligible || leaveBalance.is_probation_complete) {
      // If eligible, default to Annual leave
      setFormData(prev => ({
        ...prev,
        leave_type: 'Annual'
      }));
    }
  }, [leaveBalance.is_eligible, leaveBalance.is_probation_complete, leaveBalance.comp_off_balance]);

  const fetchEmployeeDetails = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user.employeeId));

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
      showNotification('Failed to load employee details', 'danger');
      // Set default values on error
      setEmployeeDetails({
        joining_date: '',
        reporting_manager: '',
        months_completed: 0
      });
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      setLoading(true);
      console.log('📊 Fetching leave balance for employee:', user?.employeeId);

      const response = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(user?.employeeId));
      console.log('📊 Leave balance response:', response.data);

      // ✅ FIX: Use correct field names from API response with proper fallbacks
      const isProbationComplete = response.data.is_probation_complete === true || response.data.is_eligible === true;

      setLeaveBalance({
        available: parseFloat(response.data.available) || 0,
        total_accrued: parseFloat(response.data.total_accrued) || 0,
        used: parseFloat(response.data.used) || 0,
        pending: parseFloat(response.data.pending) || 0,
        comp_off_balance: parseFloat(response.data.comp_off_balance) || 0,
        total_comp_off_earned: parseFloat(response.data.total_comp_off_earned) || 0,
        total_comp_off_used: parseFloat(response.data.total_comp_off_used) || 0,
        completed_months_in_year: response.data.accrual_info?.months_this_year || 0,
        message: response.data.message || '',
        is_eligible: isProbationComplete,
        months_completed: response.data.months_completed || 0,
        is_probation_complete: isProbationComplete,
        eligible_from_date: response.data.eligible_from_date || ''
      });

      console.log('✅ Leave balance set successfully');
      setLoading(false);

    } catch (error) {
      console.error('❌ Error fetching leave balance:', error);
      console.error('Error details:', error.response?.data);

      // Set default values on error
      setLeaveBalance({
        available: 0,
        total_accrued: 0,
        used: 0,
        pending: 0,
        comp_off_balance: 0,
        total_comp_off_earned: 0,
        total_comp_off_used: 0,
        completed_months_in_year: 0,
        message: 'Failed to load leave balance',
        is_eligible: false,
        months_completed: 0,
        is_probation_complete: false,
        eligible_from_date: ''
      });
      setLoading(false);
      showNotification(error.response?.data?.message || 'Failed to load leave balance', 'danger');
    }
  };

  const fetchRecentLeaves = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.LEAVE_BY_EMPLOYEE(user.employeeId));
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

    // Check leave balance
    if (formData.leave_type === 'Comp-Off') {
      if (calculatedDays > leaveBalance.comp_off_balance) {
        newErrors.balance = `Insufficient Comp-Off balance. Available: ${leaveBalance.comp_off_balance} days`;
      }
    } else if (leaveBalance.is_eligible && formData.leave_type !== 'Unpaid') {
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
        employee_id: user.employeeId,  // This is already in the body
        days_count: calculatedDays,
        applied_date: new Date().toISOString().split('T')[0]
      };

      // REMOVE the custom headers - just use default axios instance
      const response = await axios.post(API_ENDPOINTS.LEAVE_APPLY, leaveData);

      if (response.data.success) {
        showNotification(
          formData.leave_type === 'Comp-Off'
            ? 'Comp-Off request submitted successfully!'
            : 'Leave request submitted successfully!',
          'success'
        );

        // Reset form
        setFormData({
          leave_type: leaveBalance.is_eligible ? 'Annual' : (leaveBalance.comp_off_balance > 0 ? 'Comp-Off' : 'Unpaid'),
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
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted small">Loading leave application...</p>
        </div>
      </div>
    );
  }

  const availableLeaveTypes = getAvailableLeaveTypes();

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      {/* Header - Responsive */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h5 className="mb-1 d-flex align-items-center">
            <FaUmbrellaBeach className="me-2 text-primary" />
            Apply for Leave
          </h5>
          <p className="text-muted mb-0 small">
            {leaveBalance.is_eligible
              ? 'You can apply for any type of leave'
              : leaveBalance.comp_off_balance > 0
                ? 'During probation, Comp-Off and Unpaid Leave are available'
                : 'During probation, only Unpaid Leave is available'}
          </p>
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
      </div>

      <Row className="g-3">
        {/* Main Form Column */}
        <Col lg={8}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-2 py-md-3">
              <h6 className="mb-0 small">Leave Request Form</h6>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              {/* Probation Status Alert */}
              {!leaveBalance.is_probation_complete && (
                <Alert variant="info" className="mb-4 py-2">
                  <div className="d-flex align-items-start">
                    <FaInfoCircle className="me-3 text-primary mt-1 flex-shrink-0" size={20} />
                    <div>
                      <h6 className="alert-heading mb-1 small">Probation Period</h6>
                      <p className="mb-0 small">
                        You are currently in your probation period.
                        {leaveBalance.comp_off_balance > 0 && (
                          <> You have <strong>{leaveBalance.comp_off_balance} Comp-Off days</strong> available from working on holidays.</>
                        )}
                        {' '}After completing 6 months (from {leaveBalance.eligible_from_date || 'N/A'}), all leave types will be available.
                      </p>
                    </div>
                  </div>
                </Alert>
              )}

              {/* Comp-Off Info Alert */}
              {leaveBalance.comp_off_balance > 0 && (
                <Alert variant="purple" className="mb-4 py-2" style={{ backgroundColor: '#f3e8ff', borderColor: '#d6b4ff' }}>
                  <div className="d-flex align-items-start">
                    <FaTrophy className="me-3 text-purple mt-1 flex-shrink-0" size={20} />
                    <div>
                      <h6 className="alert-heading mb-1 small">Comp-Off Available! 🎉</h6>
                      <p className="mb-0 small">
                        You have <strong>{leaveBalance.comp_off_balance} Comp-Off day(s)</strong> earned by working on holidays.
                        You can use these like regular leaves, even during probation.
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
                  {formData.leave_type === 'Comp-Off' && (
                    <Form.Text className="text-purple small d-block mt-1">
                      <FaTrophy className="me-1" size={10} />
                      Using Comp-Off leave - this won't affect your regular leave balance
                    </Form.Text>
                  )}
                </Form.Group>

                {/* Leave Duration */}
                <Form.Group className="mb-3">
                  <Form.Label className="small fw-semibold text-muted">
                    Leave Duration <span className="text-danger">*</span>
                  </Form.Label>
                  <div className="d-flex flex-wrap">
                    <Form.Check
                      type="radio"
                      label="Full Day"
                      name="leave_duration"
                      value="Full Day"
                      checked={formData.leave_duration === 'Full Day'}
                      onChange={handleChange}
                      className="me-3 mb-2"
                      id="full-day-radio"
                    />
                    <Form.Check
                      type="radio"
                      label="Half Day"
                      name="leave_duration"
                      value="Half Day"
                      checked={formData.leave_duration === 'Half Day'}
                      onChange={handleChange}
                      className="mb-2"
                      id="half-day-radio"
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
                <Row className="g-2 mb-3">
                  <Col sm={6}>
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
                  <Col sm={6}>
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
                  <Form.Text className="text-muted small">
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

                {/* Balance Error */}
                {errors.balance && (
                  <Alert variant="danger" className="py-2 small">
                    <FaExclamationTriangle className="me-2 flex-shrink-0" />
                    {errors.balance}
                  </Alert>
                )}

                {/* Submit Buttons */}
                <div className="d-flex flex-wrap gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={submitting || (
                      formData.leave_type === 'Comp-Off'
                        ? calculatedDays > leaveBalance.comp_off_balance
                        : (leaveBalance.is_eligible && formData.leave_type !== 'Unpaid' && calculatedDays > leaveBalance.available)
                    )}
                    className="px-4 d-inline-flex align-items-center"
                  >
                    {submitting ? (
                      <>
                        <Spinner size="sm" animation="border" className="me-2" />
                        <span className="d-none d-sm-inline">Submitting...</span>
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
            <Card.Header className="bg-white py-2 py-md-3">
              <h6 className="mb-0 small d-flex align-items-center">
                <FaInfoCircle className="me-2 text-primary" size={14} />
                Your Leave Balance
              </h6>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              {/* Status Badge */}
              {/* Status Badge */}
              <div className={`text-center mb-3 p-2 rounded ${leaveBalance.is_probation_complete ? 'bg-success bg-opacity-10' : 'bg-info bg-opacity-10'}`}>
                {leaveBalance.is_probation_complete ? (
                  <>
                    <FaCheckCircle className="text-success mb-2" size={24} />
                    <p className="small text-success fw-semibold mb-0">Probation Completed</p>
                    <p className="small text-muted mt-1">All leave types available</p>
                  </>
                ) : (
                  <>
                    <FaHourglassHalf className="text-info mb-2" size={24} />
                    <p className="small text-info fw-semibold mb-0">Probation Period</p>
                    <p className="small text-muted mt-1">
                      {leaveBalance.comp_off_balance > 0
                        ? 'Comp-Off & Unpaid Leave available'
                        : 'Only Unpaid Leave available'}
                    </p>
                  </>
                )}
              </div>

              {/* Comp-Off Balance Display */}
              {leaveBalance.comp_off_balance > 0 && (
                <div className="text-center mb-3 p-2 bg-purple bg-opacity-10 rounded">
                  <FaTrophy className="text-purple mb-2" size={24} />
                  <h5 className="text-purple fw-bold mb-0">{leaveBalance.comp_off_balance}</h5>
                  <p className="text-muted small">Comp-Off Days Available</p>
                  <Badge bg="purple" className="mt-1">
                    Earned by working on holidays
                  </Badge>
                </div>
              )}

              {/* Regular Leave Balance */}
              <div className="text-center mb-3">
                <h3 className={`display-6 fw-bold ${leaveBalance.is_probation_complete ? 'text-primary' : 'text-muted'}`}>
                  {leaveBalance.is_probation_complete ? leaveBalance.available : '0'}
                </h3>
                <p className="text-muted small">
                  {leaveBalance.is_probation_complete ? 'Available Leaves' : 'Leaves Available (During Probation)'}
                </p>
                {!leaveBalance.is_probation_complete && (
                  <>
                    <Badge bg="info" className="mt-1">
                      Accrued: {leaveBalance.total_accrued} days (usable after probation)
                    </Badge>
                    <div className="mt-2 small text-muted">
                      <FaInfoCircle className="me-1" size={10} />
                      You have earned {leaveBalance.total_accrued} leaves, but can only use them after completing 6 months.
                    </div>
                  </>
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
                  <div className="d-flex align-items-start">
                    <FaClock className="me-2 mt-1 flex-shrink-0" />
                    <div>
                      <span>This request is for <strong>{calculatedDays} day{calculatedDays > 1 ? 's' : ''}</strong></span>
                      {formData.leave_type === 'Comp-Off' ? (
                        <>
                          <br />
                          <small className="d-block">Comp-Off balance after request: <strong>{(leaveBalance.comp_off_balance - calculatedDays).toFixed(1)}</strong> days</small>
                        </>
                      ) : leaveBalance.is_eligible && formData.leave_type !== 'Unpaid' ? (
                        <>
                          <br />
                          <small className="d-block">Balance after request: <strong>{(leaveBalance.available - calculatedDays).toFixed(1)}</strong> days</small>
                        </>
                      ) : (
                        <>
                          <br />
                          <small className="text-muted d-block">Unpaid Leave - No deduction from balance</small>
                        </>
                      )}
                    </div>
                  </div>
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
              <Card.Header className="bg-white py-2 py-md-3">
                <h6 className="mb-0 small d-flex align-items-center">
                  <FaCalendarAlt className="me-2 text-primary" size={14} />
                  Recent Requests
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="list-group list-group-flush">
                  {recentLeaves.map((leave, index) => (
                    <div key={leave.id || index} className="list-group-item py-2">
                      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                        <div>
                          <span className="small fw-semibold d-block">
                            {leave.leave_type === 'Comp-Off' ? '🎉 ' :
                              leave.leave_type === 'Unpaid' ? '💰 ' : '🌴 '}
                            {leave.leave_type}
                          </span>
                          <small className="text-muted d-block">
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
                          className="ms-0 ms-sm-auto"
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
            <Card.Body className="p-2 p-md-3">
              <h6 className="small fw-semibold mb-2">Leave Policy</h6>
              <ul className="small text-muted ps-3 mb-0">
                <li>
                  <strong>Comp-Off Leave:</strong>
                  <ul className="ps-3 mt-1">
                    <li>Earned by working on holidays (8+ hours)</li>
                    <li>1 holiday work = 1 Comp-Off day</li>
                    <li>Can be used during probation period</li>
                    <li>Valid for 90 days from earning</li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>During Probation (First 6 months):</strong>
                  <ul className="ps-3 mt-1">
                    <li>Comp-Off and Unpaid Leave available</li>
                    <li>Regular leaves accrue but cannot be used</li>
                  </ul>
                </li>
                <li className="mt-2">
                  <strong>After Probation (6+ months):</strong>
                  <ul className="ps-3 mt-1">
                    <li>All leave types become available</li>
                    <li>Annual leaves: 1.5 days/month (18 days/year)</li>
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