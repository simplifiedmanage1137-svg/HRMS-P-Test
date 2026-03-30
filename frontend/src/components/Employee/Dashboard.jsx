// src/components/Employee/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Spinner, Alert, Button, ProgressBar } from 'react-bootstrap';
import {
  FaUserCircle,
  FaCalendarAlt,
  FaClock,
  FaUmbrellaBeach,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaEye,
  FaChartLine,
  FaHistory,
  FaArrowRight,
  FaBell,
  FaTrophy,
  FaBirthdayCake,
  FaSyncAlt,
  FaChartBar,
  FaInfoCircle,
  FaSun,
  FaMoon,
  FaCloudSun
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { holidays, getHolidaysByRegion } from '../../data/holidays';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement
);

const EmployeeDashboard = () => {
  const { user } = useAuth();
  const { showNotification, todayEvents, fetchTodayEvents } = useNotification();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [leaveBalance, setLeaveBalance] = useState({
    available: 0,
    total_accrued: 12,
    used: 0,
    pending: 0,
    comp_off_balance: 0,
    total_comp_off_earned: 0,
    total_comp_off_used: 0,
    is_eligible: false
  });
  const [compOffHistory, setCompOffHistory] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [upcomingHolidays, setUpcomingHolidays] = useState([]);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalLeaves: 0,
    approvedLeaves: 0,
    pendingLeaves: 0,
    rejectedLeaves: 0,
    presentDays: 0,
    absentDays: 0,
    workingDays: 22,
    lateDays: 0,
    weeklyOffDays: 0,
    totalLateMinutes: 0,
    compOffEarned: 0
  });

  // Chart data
  const [attendanceChartData, setAttendanceChartData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Hours Worked',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',   // Monday - Blue
          'rgba(54, 162, 235, 0.6)',   // Tuesday - Blue
          'rgba(54, 162, 235, 0.6)',   // Wednesday - Blue
          'rgba(54, 162, 235, 0.6)',   // Thursday - Blue
          'rgba(54, 162, 235, 0.6)',   // Friday - Blue
          'rgba(169, 169, 169, 0.6)',  // Saturday - Gray (W-OFF)
          'rgba(169, 169, 169, 0.6)'   // Sunday - Gray (W-OFF)
        ],
        borderColor: [
          'rgb(54, 162, 235)',
          'rgb(54, 162, 235)',
          'rgb(54, 162, 235)',
          'rgb(54, 162, 235)',
          'rgb(54, 162, 235)',
          'rgb(128, 128, 128)',
          'rgb(128, 128, 128)'
        ],
        borderWidth: 1,
        borderRadius: 5,
        barPercentage: 0.7,
        categoryPercentage: 0.8
      }
    ]
  });

  const [leaveChartData, setLeaveChartData] = useState({
    labels: ['Used', 'Available', 'Pending'],
    datasets: [
      {
        data: [0, 12, 0],
        backgroundColor: ['#dc3545', '#28a745', '#ffc107'],
        borderWidth: 0
      }
    ]
  });

  // Weekly off days (0 = Sunday, 6 = Saturday)
  const WEEKLY_OFF_DAYS = [0, 6];

  useEffect(() => {
    if (user?.employeeId) {
      loadDashboardData();
    }
  }, [user]);

  // Update charts when data changes
  useEffect(() => {
    if (attendanceHistory.length > 0) {
      updateAttendanceChart();
    }
    if (leaveBalance) {
      updateLeaveChart();
    }
  }, [attendanceHistory, leaveBalance]);

  // Load upcoming holidays from holidays.js
  useEffect(() => {
    loadUpcomingHolidays();
  }, []);

  const loadUpcomingHolidays = () => {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      // Get holidays for current year and next year
      const allHolidays = holidays.filter(h => {
        const holidayDate = new Date(h.date);
        return holidayDate >= today && holidayDate.getFullYear() <= currentYear + 1;
      });

      // Sort by date (ascending)
      const sortedHolidays = allHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));

      // Take only next 3 upcoming holidays
      const nextHolidays = sortedHolidays.slice(0, 3).map(holiday => {
        const holidayDate = new Date(holiday.date);
        const diffTime = holidayDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        return {
          date: holiday.date,
          name: holiday.name,
          region: holiday.region,
          daysLeft: diffDays,
          formattedDate: formatDate(holiday.date)
        };
      });

      setUpcomingHolidays(nextHolidays);
    } catch (error) {
      console.error('Error loading upcoming holidays:', error);
    }
  };

  const loadDashboardData = async () => {
    setLoading(true);
    setError('');

    try {
      // Fetch all data in parallel for better performance
      await Promise.all([
        fetchEmployeeData(),
        fetchLeaveBalance(),
        fetchCompOffHistory(),
        fetchLeaveRequests(),
        fetchTodayAttendance(),
        fetchAttendanceHistory(),
        fetchTodayEvents()
      ]);

      // Load upcoming holidays separately
      loadUpcomingHolidays();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load some dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
    showNotification('Dashboard refreshed!', 'success');
  };

  const fetchEmployeeData = async () => {
    try {
      // ✅ FIX: Use correct endpoint - EMPLOYEE_PROFILE, not ATTENDANCE_REPORT
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user.employeeId));
      console.log('📋 Employee data:', response.data);
      setEmployee(response.data);
    } catch (error) {
      console.error('Error fetching employee:', error);
      showNotification(error.response?.data?.message || 'Failed to load profile data', 'danger');
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      console.log('Fetching leave balance for:', user.employeeId);

      const response = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(user.employeeId));
      console.log('Leave balance response:', response.data);

      // ✅ FIX: Use correct field names from API response
      setLeaveBalance({
        available: parseFloat(response.data.available) || 0,
        total_accrued: parseFloat(response.data.total_accrued) || 0,
        used: parseFloat(response.data.used) || 0,
        pending: parseFloat(response.data.pending) || 0,
        comp_off_balance: parseFloat(response.data.comp_off_balance) || 0,
        total_comp_off_earned: parseFloat(response.data.total_comp_off_earned) || 0,
        total_comp_off_used: parseFloat(response.data.total_comp_off_used) || 0,
        is_eligible: response.data.is_probation_complete || response.data.is_eligible || false,
        months_completed: response.data.months_completed || 0,
        is_probation_complete: response.data.is_probation_complete || false
      });

    } catch (error) {
      console.error('Error fetching leave balance:', error);
      setLeaveBalance({
        available: 0,
        total_accrued: 0,
        used: 0,
        pending: 0,
        comp_off_balance: 0,
        total_comp_off_earned: 0,
        total_comp_off_used: 0,
        is_eligible: false,
        months_completed: 0,
        is_probation_complete: false
      });
      showNotification('Failed to load leave balance', 'info');
    }
  };

  const fetchCompOffHistory = async () => {
    try {
      // This endpoint might be admin-only, so wrap in try-catch
      const response = await axios.get(`${API_ENDPOINTS.ATTENDANCE}/comp-off/${user.employeeId}/history`);
      setCompOffHistory(response.data.earnings || []);

      const earned = response.data.earnings?.filter(e => !e.is_used).length || 0;
      setStats(prev => ({
        ...prev,
        compOffEarned: earned
      }));
    } catch (error) {
      // Silently fail for comp-off history - it's admin-only
      console.log('Comp-off history not available for employees');
      setCompOffHistory([]);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      // Don't pass employee_id in params - let the backend determine it from the token
      const response = await axios.get(API_ENDPOINTS.LEAVES);

      const leaves = response.data || [];
      console.log(`📋 Fetched ${leaves.length} leave requests for current employee`);

      // Log to verify we're only getting current employee's leaves
      leaves.forEach(leave => {
        console.log(`   - Leave: ${leave.leave_type} (${leave.status}) for date ${leave.start_date}`);
      });

      setLeaveRequests(leaves.slice(0, 5)); // Show only 5 most recent

      // Calculate leave stats
      setStats(prev => ({
        ...prev,
        totalLeaves: leaves.length,
        approvedLeaves: leaves.filter(l => l.status === 'approved').length,
        pendingLeaves: leaves.filter(l => l.status === 'pending').length,
        rejectedLeaves: leaves.filter(l => l.status === 'rejected').length
      }));
    } catch (error) {
      console.error('Error fetching leave requests:', error);
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      // ✅ FIX: Use employee-specific endpoint
      const url = `${API_ENDPOINTS.ATTENDANCE_EMPLOYEE_REPORT(user.employeeId, today, today)}`;
      console.log('📡 Today attendance URL:', url);

      const response = await axios.get(url);

      if (response.data.attendance && response.data.attendance.length > 0) {
        setTodayAttendance(response.data.attendance[0]);
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };


  const fetchAttendanceHistory = async () => {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();
      const currentMonth = today.getMonth(); // 0-11

      // Get first day of current month
      const startDate = new Date(currentYear, currentMonth, 1);
      // Get last day of current month
      const endDate = new Date(currentYear, currentMonth + 1, 0);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      console.log('📅 Fetching attendance for current month:', {
        start: startDateStr,
        end: endDateStr,
        month: currentMonth + 1,
        year: currentYear
      });

      // ✅ FIX: Use employee-specific endpoint instead of admin report
      const url = `${API_ENDPOINTS.ATTENDANCE_EMPLOYEE_REPORT(user.employeeId, startDateStr, endDateStr)}`;
      console.log('📡 API URL:', url);

      const response = await axios.get(url);
      console.log('📊 API Response:', response.data);

      const attendance = response.data.attendance || [];
      console.log('📊 Attendance records for current month:', attendance.length);

      // Calculate present days for current month only
      let presentDays = 0;
      let halfDays = 0;
      let weeklyOff = 0;
      let absent = 0;
      let totalWorkingHours = 0;

      // Get all dates in current month
      const daysInMonth = endDate.getDate();

      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(currentYear, currentMonth, day);
        const dayOfWeek = date.getDay();
        const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;

        // Find attendance record for this date
        const record = attendance.find(r => r.attendance_date === dateStr);

        if (isWeeklyOff) {
          weeklyOff++;
        } else if (record) {
          // Check if present (status 'present' or 'working' or clock_in exists)
          if (record.status === 'present' || record.status === 'working' || record.clock_in) {
            presentDays++;
            if (record.total_hours) {
              totalWorkingHours += parseFloat(record.total_hours);
            }
          } else if (record.status === 'half_day') {
            halfDays++;
            presentDays++; // Half day is also counted as present
            if (record.total_hours) {
              totalWorkingHours += parseFloat(record.total_hours);
            }
          } else if (record.status === 'absent') {
            absent++;
          }
        } else {
          // No record means absent
          absent++;
        }
      }

      const totalWorkingDays = daysInMonth - weeklyOff;

      console.log('📊 Monthly Stats:', {
        presentDays: presentDays,
        halfDays: halfDays,
        absentDays: absent,
        weeklyOff: weeklyOff,
        totalWorkingDays: totalWorkingDays,
        totalWorkingHours: Math.round(totalWorkingHours * 10) / 10
      });

      setStats(prev => ({
        ...prev,
        presentDays: presentDays,
        absentDays: absent,
        halfDays: halfDays,
        weeklyOffDays: weeklyOff,
        totalWorkingHours: Math.round(totalWorkingHours * 10) / 10,
        totalWorkingDays: totalWorkingDays
      }));

    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
      console.error('Error details:', error.response?.data);

      setStats(prev => ({
        ...prev,
        presentDays: 0,
        absentDays: 0,
        halfDays: 0,
        weeklyOffDays: 0,
        totalWorkingHours: 0,
        totalWorkingDays: 0
      }));
    }
  };

  const generateLast30DaysAttendance = (history, startDate, endDate) => {
    const completeHistory = [];
    const currentDate = new Date(endDate); // Start from today and go backwards

    // Generate 30 days from today backwards
    for (let i = 0; i < 30; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() - i);

      const dateStr = date.toISOString().split('T')[0];
      const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday

      // Check if it's a weekly off day
      const isWeeklyOff = WEEKLY_OFF_DAYS.includes(dayOfWeek);

      // Find if there's an attendance record for this date
      const existingRecord = history.find(h => {
        const recordDate = new Date(h.attendance_date).toISOString().split('T')[0];
        return recordDate === dateStr;
      });

      if (existingRecord) {
        // Use actual attendance data
        completeHistory.push({
          ...existingRecord,
          date: dateStr,
          dayOfWeek,
          isWeeklyOff: false,
          displayDate: formatDate(dateStr),
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          isToday: i === 0 // Mark today's date
        });
      } else {
        // Create a placeholder record for days without attendance
        completeHistory.push({
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff,
          dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
          clock_in: null,
          clock_out: null,
          total_hours: null,
          status: isWeeklyOff ? 'weekly_off' : 'absent',
          late_minutes: 0,
          late_display: null,
          isToday: i === 0 // Mark today's date
        });
      }
    }

    // Sort by date descending (today first)
    return completeHistory.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const updateAttendanceChart = () => {
    // Initialize hours for each day
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hoursByDay = [0, 0, 0, 0, 0, 0, 0];
    const workingDaysCount = [0, 0, 0, 0, 0, 0, 0];
    const backgroundColor = [
      'rgba(54, 162, 235, 0.6)',   // Monday - Blue
      'rgba(54, 162, 235, 0.6)',   // Tuesday - Blue
      'rgba(54, 162, 235, 0.6)',   // Wednesday - Blue
      'rgba(54, 162, 235, 0.6)',   // Thursday - Blue
      'rgba(54, 162, 235, 0.6)',   // Friday - Blue
      'rgba(169, 169, 169, 0.6)',  // Saturday - Gray (W-OFF)
      'rgba(169, 169, 169, 0.6)'   // Sunday - Gray (W-OFF)
    ];

    attendanceHistory.forEach(record => {
      if (record.clock_in && record.total_hours) {
        const date = new Date(record.attendance_date);
        const dayIndex = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

        // Adjust index for our array (Monday = 0)
        let adjustedIndex = dayIndex === 0 ? 6 : dayIndex - 1;

        hoursByDay[adjustedIndex] += parseFloat(record.total_hours);
        workingDaysCount[adjustedIndex]++;
      }
    });

    // Calculate average hours per day
    const avgHoursByDay = hoursByDay.map((total, index) =>
      workingDaysCount[index] > 0 ? Math.round((total / workingDaysCount[index]) * 10) / 10 : 0
    );

    setAttendanceChartData({
      labels: daysOfWeek.map((day, index) => {
        // Add W-OFF label for Saturday and Sunday
        if (index === 5) return 'Sat (W-OFF)';
        if (index === 6) return 'Sun (W-OFF)';
        return day;
      }),
      datasets: [
        {
          label: 'Average Working Hours',
          data: avgHoursByDay,
          backgroundColor: backgroundColor,
          borderColor: [
            'rgb(54, 162, 235)',
            'rgb(54, 162, 235)',
            'rgb(54, 162, 235)',
            'rgb(54, 162, 235)',
            'rgb(54, 162, 235)',
            'rgb(128, 128, 128)',
            'rgb(128, 128, 128)'
          ],
          borderWidth: 1,
          borderRadius: 5,
          barPercentage: 0.7,
          categoryPercentage: 0.8
        }
      ]
    });
  };

  const updateLeaveChart = () => {
    setLeaveChartData({
      labels: ['Used', 'Available', 'Pending'],
      datasets: [
        {
          data: [
            leaveBalance.used || 0,
            leaveBalance.available || 0,
            leaveBalance.pending || 0
          ],
          backgroundColor: ['#dc3545', '#28a745', '#ffc107'],
          borderWidth: 0
        }
      ]
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge bg="success" className="px-2 py-1"><FaCheckCircle className="me-1" size={10} /> Approved</Badge>;
      case 'pending':
        return <Badge bg="warning" className="px-2 py-1"><FaHourglassHalf className="me-1" size={10} /> Pending</Badge>;
      case 'rejected':
        return <Badge bg="danger" className="px-2 py-1"><FaTimesCircle className="me-1" size={10} /> Rejected</Badge>;
      default:
        return <Badge bg="secondary" className="px-2 py-1">Unknown</Badge>;
    }
  };

  const getAttendanceStatus = (record) => {
    if (!record) return <Badge bg="secondary">Not Marked</Badge>;

    const attendanceDate = new Date(record.attendance_date);
    const dayOfWeek = attendanceDate.getDay();

    // Check if it's a weekly off day
    if (WEEKLY_OFF_DAYS.includes(dayOfWeek)) {
      return <Badge bg="secondary"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    }

    if (!record.clock_in) return <Badge bg="secondary">Not Clocked</Badge>;

    if (record.clock_in && !record.clock_out) {
      // Check if late while working
      if (record.late_minutes > 0) {
        return (
          <Badge bg="warning">
            <FaClock className="me-1" size={10} />
            Working (Late {formatLateTime(record.late_minutes)})
          </Badge>
        );
      }
      return <Badge bg="info">Working</Badge>;
    }

    if (record.comp_off_awarded) {
      return (
        <Badge bg="purple">
          <FaTrophy className="me-1" size={10} />
          Comp-Off Earned
        </Badge>
      );
    }

    if (record.status === 'present') {
      if (record.late_minutes > 0) {
        return (
          <Badge bg="warning">
            <FaCheckCircle className="me-1" size={10} />
            Present (Late {formatLateTime(record.late_minutes)})
          </Badge>
        );
      }
      return <Badge bg="success"><FaCheckCircle className="me-1" size={10} /> Present</Badge>;
    }

    if (record.status === 'half_day') {
      if (record.late_minutes > 0) {
        return (
          <Badge bg="warning">
            <FaCloudSun className="me-1" size={10} />
            Half Day (Late {formatLateTime(record.late_minutes)})
          </Badge>
        );
      }
      return <Badge bg="warning"><FaCloudSun className="me-1" size={10} /> Half Day</Badge>;
    }

    return <Badge bg="secondary">Absent</Badge>;
  };

  const formatLateTime = (lateMinutes) => {
    if (!lateMinutes || lateMinutes <= 0) return null;

    const totalSeconds = Math.round(lateMinutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0 || (hours === 0 && minutes === 0)) parts.push(`${seconds}s`);

    return parts.join(' ');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
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

  const formatTime = (datetime) => {
    if (!datetime) return '-';
    return new Date(datetime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRegionBadge = (region) => {
    const colors = {
      'India': 'primary',
      'USA': 'danger',
      'Global': 'success'
    };
    return <Badge bg={colors[region] || 'secondary'}>{region}</Badge>;
  };

  const calculateLeavePercentage = () => {
    const used = leaveBalance.used || 0;
    const total = leaveBalance.total_accrued || 1;
    return ((used / total) * 100).toFixed(1);
  };

  const isTodayWeeklyOff = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    return WEEKLY_OFF_DAYS.includes(dayOfWeek);
  };

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      {/* Welcome Header with Refresh Button - Responsive */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-4 gap-3">
        <div>
          <h5 className="mb-1 d-flex align-items-center">
            <FaUserCircle className="me-2 text-primary" />
            Welcome back, {employee?.first_name || 'Employee'}!
          </h5>
          <p className="text-muted mb-0 small">
            {employee?.designation || 'Employee'} • {employee?.department || 'Department'}
          </p>
        </div>
        <div className="d-flex flex-wrap gap-2 ms-0 ms-md-auto">
          <Button
            variant="outline-primary"
            size="sm"
            onClick={refreshData}
            disabled={refreshing}
            className="d-inline-flex align-items-center"
          >
            <FaSyncAlt className={`me-2 ${refreshing ? 'fa-spin' : ''}`} size={12} />
            Refresh
          </Button>
          <Badge bg="dark" className="p-2">
            ID: {user?.employeeId}
          </Badge>
          <Badge bg="info" className="p-2">
            {employee?.employment_type || 'Full Time'}
          </Badge>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-3 py-2">
          <small>{error}</small>
        </Alert>
      )}

      {/* Today's Events Widget - Responsive */}
      {todayEvents?.total > 0 && (
        <Card className="mb-4 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Card.Body className="p-2 p-md-3 text-white">
            <div className="d-flex align-items-center mb-2">
              <FaBirthdayCake className="me-2" size={16} />
              <FaTrophy className="me-2" size={16} />
              <h6 className="mb-0 small">Today's Celebrations 🎉</h6>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {todayEvents.birthdays?.map(emp => (
                <Badge key={`birthday-${emp.id}`} bg="light" text="dark" className="p-2 small">
                  🎂 {emp.first_name} {emp.last_name} ({emp.department})
                </Badge>
              ))}
              {todayEvents.anniversaries?.map(emp => (
                <Badge key={`anniversary-${emp.id}`} bg="light" text="dark" className="p-2 small">
                  🏆 {emp.first_name} {emp.last_name} - {emp.years} Years
                </Badge>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Today's Status Card - Responsive */}
      {isTodayWeeklyOff() ? (
        <Card className="mb-4 border-0 shadow-sm bg-secondary bg-opacity-10">
          <Card.Body className="p-2 p-md-3">
            <div className="d-flex align-items-center">
              <FaSun size={24} className="me-3 text-secondary flex-shrink-0" />
              <div>
                <h6 className="mb-1 small">Today is Weekly Off</h6>
                <p className="mb-0 text-muted small">Enjoy your day off! No attendance required.</p>
              </div>
            </div>
          </Card.Body>
        </Card>
      ) : todayAttendance && (
        <Card className="mb-4 border-0 shadow-sm bg-white text-dark">
          <Card.Body className="p-2 p-md-3">
            <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-2">
              <div className="d-flex align-items-center">
                <FaClock size={24} className="me-3 opacity-75 flex-shrink-0" />
                <div>
                  <h6 className="mb-1 small">Today's Attendance</h6>
                  <p className="mb-0 small">
                    {todayAttendance.clock_in ? (
                      <>
                        In: <strong>{formatTime(todayAttendance.clock_in)}</strong>
                        {todayAttendance.late_display && (
                          <small className="text-danger ms-2">(Late {todayAttendance.late_display})</small>
                        )}
                        {todayAttendance.comp_off_awarded && (
                          <Badge bg="purple" className="ms-2">🎉 Comp-Off Earned</Badge>
                        )}
                        {todayAttendance.clock_out ? (
                          <> • Out: <strong>{formatTime(todayAttendance.clock_out)}</strong></>
                        ) : (
                          <Badge bg="light" text="dark" className="ms-2">Working</Badge>
                        )}
                      </>
                    ) : (
                      "Not clocked in yet"
                    )}
                  </p>
                </div>
              </div>
              <Button
                variant="dark"
                size="sm"
                onClick={() => navigate('/attendance')}
                className="ms-0 ms-sm-auto w-20 w-sm-auto"
              >
                View Details <FaArrowRight className="ms-2" size={10} />
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Statistics Cards - Responsive grid */}
      <Row className="mb-4 g-2 g-md-3">
        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">
                    {leaveBalance.is_probation_complete ? 'Leave Balance' : 'Accrued Leaves'}
                  </p>
                  <h4 className={`mb-0 fw-bold ${leaveBalance.is_probation_complete ? 'text-primary' : 'text-info'}`}>
                    {leaveBalance.is_probation_complete ? leaveBalance.available : leaveBalance.total_accrued}
                  </h4>
                  <small className="text-muted text-truncate d-block">
                    {leaveBalance.is_probation_complete ? 'Available days' : 'Earned (usable after probation)'}
                  </small>
                </div>
                <div className="bg-primary bg-opacity-10 p-2 rounded-circle flex-shrink-0">
                  <FaUmbrellaBeach className="text-primary" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">Present Days</p>
                  <h4 className="mb-0 fw-bold text-success">{stats.presentDays || 0}</h4>
                  <small className="text-muted text-truncate d-block">This month</small>
                </div>
                <div className="bg-success bg-opacity-10 p-2 rounded-circle flex-shrink-0">
                  <FaCheckCircle className="text-success" size={20} />
                </div>
              </div>
              {/* Optional: Show loading indicator while fetching */}
              {loading && <Spinner size="sm" animation="border" className="mt-2" />}
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">Comp-Off Balance</p>
                  <h4 className="mb-0 fw-bold text-purple">{leaveBalance.comp_off_balance || 0}</h4>
                  <small className="text-muted text-truncate d-block">Earned on holidays</small>
                </div>
                <div className="bg-purple bg-opacity-10 p-2 rounded-circle flex-shrink-0">
                  <FaTrophy className="text-purple" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col xs={12} sm={6} md={3}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">Upcoming Holiday</p>
                  {upcomingHolidays.length > 0 ? (
                    <>
                      <h6 className="mb-0 fw-bold text-truncate">{upcomingHolidays[0].name}</h6>
                      <small className="text-muted d-block text-truncate">{formatDate(upcomingHolidays[0].date)}</small>
                      <Badge bg="info" className="mt-1">
                        {upcomingHolidays[0].daysLeft} days left
                      </Badge>
                    </>
                  ) : (
                    <p className="mb-0 small">No upcoming holidays</p>
                  )}
                </div>
                <div className="bg-info bg-opacity-10 p-2 rounded-circle flex-shrink-0">
                  <FaCalendarAlt className="text-info" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-3 g-md-4">
        {/* Attendance Bar Chart */}
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-2 py-md-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
              <h6 className="mb-0 small d-flex align-items-center">
                <FaChartBar className="me-2 text-primary" />
                Weekly Attendance Summary
              </h6>
              <Badge bg="light" text="dark" className="ms-0 ms-sm-auto">Average hours per day</Badge>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div style={{ height: '280px', position: 'relative' }}>
                <Bar
                  data={attendanceChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false
                      },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        titleFont: { size: 11 },
                        bodyFont: { size: 10 },
                        padding: 6,
                        callbacks: {
                          label: function (context) {
                            const value = context.raw;
                            const dayIndex = context.dataIndex;
                            if (dayIndex === 5 || dayIndex === 6) {
                              return value > 0 ? `  ${value}h (Worked on W-OFF)` : '  Weekly Off';
                            }
                            return `  ${value}h`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                          display: true,
                          text: 'Hours',
                          color: '#6c757d',
                          font: { size: 10 },
                          padding: { top: 0, bottom: 5 }
                        },
                        grid: { color: 'rgba(0, 0, 0, 0.05)' },
                        ticks: {
                          stepSize: 1,
                          callback: function (value) { return value + 'h'; },
                          font: { size: 9 }
                        }
                      },
                      x: {
                        grid: { display: false },
                        ticks: {
                          font: { size: 9 },
                          maxRotation: 45,
                          minRotation: 45
                        }
                      }
                    },
                    barPercentage: 0.6,
                    categoryPercentage: 0.7
                  }}
                />
              </div>

              {/* Legend - Responsive */}
              <div className="mt-3 d-flex flex-wrap justify-content-center align-items-center gap-3 gap-md-4 small">
                <div className="d-flex align-items-center">
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(54, 162, 235, 0.6)', borderRadius: '3px', marginRight: '4px' }}></div>
                  <span className="text-muted">Working Days</span>
                </div>
                <div className="d-flex align-items-center">
                  <div style={{ width: '12px', height: '12px', backgroundColor: 'rgba(169, 169, 169, 0.6)', borderRadius: '3px', marginRight: '4px' }}></div>
                  <span className="text-muted">W-OFF</span>
                </div>
              </div>

              <div className="mt-2 text-center text-muted small">
                <FaInfoCircle className="me-1" size={8} />
                Avg hours per day (last 30 days)
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Leave Distribution Chart */}
        <Col lg={6}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Header className="bg-white py-2 py-md-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
              <h6 className="mb-0 small d-flex align-items-center">
                <FaUmbrellaBeach className="me-2 text-primary" />
                Leave Distribution
              </h6>
              <Badge bg="light" text="dark" className="ms-0 ms-sm-auto">Total: {leaveBalance.total_accrued} days</Badge>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div className="d-flex flex-column flex-md-row align-items-center" style={{ minHeight: '220px' }}>
                <div style={{ width: '100%', maxWidth: '250px', height: '200px' }}>
                  <Doughnut
                    data={leaveChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom',
                          labels: { font: { size: 10 } }
                        },
                        tooltip: {
                          callbacks: {
                            label: function (context) { return `${context.raw} days`; }
                          }
                        }
                      },
                      cutout: '60%'
                    }}
                  />
                </div>
                <div className="ms-0 ms-md-4 mt-3 mt-md-0 w-100">
                  <div className="mb-3">
                    <small className="text-muted d-block">Used</small>
                    <strong className="text-danger" style={{ fontSize: '1.1rem' }}>{leaveBalance.used} days</strong>
                    <ProgressBar now={(leaveBalance.used / leaveBalance.total_accrued) * 100} variant="danger" style={{ height: '4px', maxWidth: '120px' }} />
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Available</small>
                    <strong className="text-success" style={{ fontSize: '1.1rem' }}>{leaveBalance.available} days</strong>
                    <ProgressBar now={(leaveBalance.available / leaveBalance.total_accrued) * 100} variant="success" style={{ height: '4px', maxWidth: '120px' }} />
                  </div>
                  <div>
                    <small className="text-muted d-block">Pending</small>
                    <strong className="text-warning" style={{ fontSize: '1.1rem' }}>{leaveBalance.pending} days</strong>
                    <ProgressBar now={(leaveBalance.pending / leaveBalance.total_accrued) * 100} variant="warning" style={{ height: '4px', maxWidth: '120px' }} />
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Recent Leave Requests */}
        <Col lg={7}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-2 py-md-3 d-flex justify-content-between align-items-center">
              <h6 className="mb-0 small">
                <FaHistory className="me-2 text-primary" />
                Recent Leave Requests
              </h6>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate('/apply-leave')}
                className="text-decoration-none p-0"
              >
                View All <FaArrowRight className="ms-1" size={10} />
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="mb-0" size="sm">
                  <thead className="bg-light">
                    <tr>
                      <th className="small text-dark">Leave Type</th>
                      <th className="small text-dark d-none d-sm-table-cell">Duration</th>
                      <th className="small text-dark">Date Range</th>
                      <th className="small text-dark d-none d-md-table-cell">Days</th>
                      <th className="small text-dark">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaveRequests.length > 0 ? (
                      leaveRequests.map((leave, index) => (
                        <tr key={leave.id || index}>
                          <td className="small">
                            <Badge
                              bg={leave.leave_type === 'Comp-Off' ? 'purple' : 'secondary'}
                              className="px-2 py-1 text-nowrap"
                            >
                              {leave.leave_type === 'Comp-Off' && '🎉 '}
                              {leave.leave_type}
                            </Badge>
                          </td>
                          <td className="small d-none d-sm-table-cell">{leave.leave_duration || 'Full Day'}</td>
                          <td className="small">
                            <span className="text-nowrap">{formatDate(leave.start_date)}</span>
                            {leave.start_date !== leave.end_date && (
                              <span className="text-nowrap d-block d-sm-inline"> - {formatDate(leave.end_date)}</span>
                            )}
                          </td>
                          <td className="small fw-bold d-none d-md-table-cell">{leave.days_count || 1}</td>
                          <td className="small">{getStatusBadge(leave.status)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          <FaUmbrellaBeach size={24} className="text-muted mb-2 opacity-50" />
                          <p className="text-muted small mb-2">No leave requests found</p>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => navigate('/apply-leave')}
                          >
                            Apply for Leave
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Upcoming Holidays & Quick Actions */}
        <Col lg={5}>
          {/* Upcoming Holidays Card */}
          <Card className="border-0 shadow-sm mb-3">
            <Card.Header className="bg-white py-2 py-md-3 d-flex justify-content-between align-items-center">
              <h6 className="mb-0 small">
                <FaCalendarAlt className="me-2 text-primary" />
                Upcoming Holidays
              </h6>
              <Badge bg="light" text="dark">Next {upcomingHolidays.length}</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              {upcomingHolidays.length > 0 ? (
                <div className="list-group list-group-flush">
                  {upcomingHolidays.map((holiday, index) => (
                    <div key={index} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div style={{ maxWidth: '60%' }}>
                        <span className="fw-semibold small text-truncate d-block">{holiday.name}</span>
                        <small className="text-muted d-block">{formatDate(holiday.date)}</small>
                        <div className="mt-1">{getRegionBadge(holiday.region)}</div>
                      </div>
                      <Badge bg="info" pill>
                        {holiday.daysLeft}d
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-muted small mb-0">No upcoming holidays</p>
                </div>
              )}
            </Card.Body>
          </Card>

          {/* Comp-Off Summary Card */}
          {compOffHistory.length > 0 && (
            <Card className="border-0 shadow-sm mb-3">
              <Card.Header className="bg-purple text-white py-2">
                <h6 className="mb-0 small fw-semibold">
                  <FaTrophy className="me-2" size={12} />
                  Recent Comp-Off Earnings
                </h6>
              </Card.Header>
              <Card.Body className="p-0">
                <div className="list-group list-group-flush">
                  {compOffHistory.slice(0, 3).map((item, index) => (
                    <div key={index} className="list-group-item py-2">
                      <div className="d-flex justify-content-between align-items-center">
                        <div style={{ maxWidth: '70%' }}>
                          <small className="fw-semibold text-truncate d-block">{item.holiday_name}</small>
                          <small className="text-muted">{formatDate(item.attendance_date)}</small>
                        </div>
                        <Badge bg={item.is_used ? 'secondary' : 'success'} pill>
                          {item.is_used ? 'Used' : `${item.comp_off_days}d`}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Quick Actions Card */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-2 py-md-3">
              <h6 className="mb-0 small">
                <FaBell className="me-2 text-primary" />
                Quick Actions
              </h6>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  onClick={() => navigate('/apply-leave')}
                  className="d-flex align-items-center justify-content-between"
                  size="sm"
                >
                  <span><FaUmbrellaBeach className="me-2" size={12} /> Apply for Leave</span>
                  <FaArrowRight size={10} />
                </Button>
                <Button
                  variant="outline-primary"
                  onClick={() => navigate('/attendance')}
                  className="d-flex align-items-center justify-content-between"
                  size="sm"
                >
                  <span><FaClock className="me-2" size={12} /> Mark Attendance</span>
                  <FaArrowRight size={10} />
                </Button>
                <Button
                  variant="outline-success"
                  onClick={() => navigate('/salary-slip')}
                  className="d-flex align-items-center justify-content-between"
                  size="sm"
                >
                  <span><FaChartLine className="me-2" size={12} /> View Salary Slip</span>
                  <FaArrowRight size={10} />
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default EmployeeDashboard;