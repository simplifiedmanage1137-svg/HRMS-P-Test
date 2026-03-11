// components/Employee/Dashboard.jsx
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
import axios from 'axios';
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
    pending: 0
  });
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
    totalLateMinutes: 0
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
      const response = await axios.get(`http://localhost:5000/api/employees/profile/${user.employeeId}`);
      setEmployee(response.data);
    } catch (error) {
      console.error('Error fetching employee:', error);
      showNotification('Failed to load profile data', 'danger');
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      console.log('Fetching leave balance for:', user.employeeId);
      
      const response = await axios.get(`http://localhost:5000/api/leaves/balance/${user.employeeId}`);
      console.log('Leave balance response:', response.data);
      
      // Ensure we have valid numbers
      const balance = {
        available: parseFloat(response.data.available) || 0,
        total_accrued: parseFloat(response.data.total_accrued) || 12,
        used: parseFloat(response.data.used) || 0,
        pending: parseFloat(response.data.pending) || 0
      };
      
      setLeaveBalance(balance);
      
    } catch (error) {
      console.error('Error fetching leave balance:', error);
      
      // Set default values if API fails
      setLeaveBalance({
        available: 12,
        total_accrued: 12,
        used: 0,
        pending: 0
      });
      
      showNotification('Using default leave balance', 'info');
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const response = await axios.get(`http://localhost:5000/api/leaves?employee_id=${user.employeeId}`);
      const leaves = response.data || [];
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
      const response = await axios.get(
        `http://localhost:5000/api/attendance/report?start=${today}&end=${today}&employee_id=${user.employeeId}`
      );
      
      if (response.data.attendance && response.data.attendance.length > 0) {
        setTodayAttendance(response.data.attendance[0]);
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days
      
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      const response = await axios.get(
        `http://localhost:5000/api/attendance/report?start=${startDateStr}&end=${endDateStr}&employee_id=${user.employeeId}`
      );
      
      const attendance = response.data.attendance || [];
      
      // Generate complete calendar for the last 30 days
      const completeHistory = generateLast30DaysAttendance(attendance, startDate, endDate);
      
      setAttendanceHistory(completeHistory);
      
      // Calculate attendance stats
      let present = 0;
      let absent = 0;
      let halfDays = 0;
      let weeklyOff = 0;
      let lateDays = 0;
      let totalLateMinutes = 0;
      
      completeHistory.forEach(record => {
        if (record.isWeeklyOff) {
          weeklyOff++;
        } else if (record.status === 'present' || record.status === 'working') {
          present++;
          if (parseFloat(record.late_minutes) > 0) {
            lateDays++;
            totalLateMinutes += parseFloat(record.late_minutes);
          }
        } else if (record.status === 'half_day') {
          halfDays++;
          if (parseFloat(record.late_minutes) > 0) {
            lateDays++;
            totalLateMinutes += parseFloat(record.late_minutes);
          }
        } else if (record.status === 'absent') {
          absent++;
        }
      });
      
      setStats(prev => ({
        ...prev,
        presentDays: present,
        absentDays: absent,
        halfDays: halfDays,
        weeklyOffDays: weeklyOff,
        lateDays: lateDays,
        totalLateMinutes: totalLateMinutes
      }));
    } catch (error) {
      console.error('Error fetching attendance history:', error);
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
    switch(status) {
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
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="text-center">
          <Spinner animation="border" variant="primary" />
          <p className="mt-3 text-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      {/* Welcome Header with Refresh Button */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h4 className="mb-1">
            <FaUserCircle className="me-2 text-primary" />
            Welcome back, {employee?.first_name || 'Employee'}!
          </h4>
          <p className="text-muted mb-0 small">
            {employee?.designation || 'Employee'} • {employee?.department || 'Department'}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button 
            variant="outline-primary" 
            size="sm" 
            onClick={refreshData}
            disabled={refreshing}
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
        <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-3">
          {error}
        </Alert>
      )}

      {/* Today's Events Widget */}
      {todayEvents?.total > 0 && (
        <Card className="mb-4 border-0 shadow-sm" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
          <Card.Body className="p-3 text-white">
            <div className="d-flex align-items-center mb-2">
              <FaBirthdayCake className="me-2" size={20} />
              <FaTrophy className="me-2" size={20} />
              <h6 className="mb-0">Today's Celebrations 🎉</h6>
            </div>
            <div className="d-flex flex-wrap gap-2">
              {todayEvents.birthdays?.map(emp => (
                <Badge key={`birthday-${emp.id}`} bg="light" text="dark" className="p-2">
                  🎂 {emp.first_name} {emp.last_name} ({emp.department})
                </Badge>
              ))}
              {todayEvents.anniversaries?.map(emp => (
                <Badge key={`anniversary-${emp.id}`} bg="light" text="dark" className="p-2">
                  🏆 {emp.first_name} {emp.last_name} - {emp.years} Years
                </Badge>
              ))}
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Today's Status Card */}
      {isTodayWeeklyOff() ? (
        <Card className="mb-4 border-0 shadow-sm bg-secondary bg-opacity-10">
          <Card.Body>
            <div className="d-flex align-items-center">
              <FaSun size={30} className="me-3 text-secondary" />
              <div>
                <h6 className="mb-1">Today is Weekly Off</h6>
                <p className="mb-0 text-muted small">Enjoy your day off! No attendance required.</p>
              </div>
            </div>
          </Card.Body>
        </Card>
      ) : todayAttendance && (
        <Card className="mb-4 border-0 shadow-sm bg-white text-dark">
          <Card.Body>
            <div className="d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center">
                <FaClock size={30} className="me-3 opacity-75" />
                <div>
                  <h6 className="mb-1">Today's Attendance</h6>
                  <p className="mb-0">
                    {todayAttendance.clock_in ? (
                      <>
                        In: <strong>{formatTime(todayAttendance.clock_in)}</strong>
                        {todayAttendance.late_display && (
                          <small className="text-danger ms-2">(Late {todayAttendance.late_display})</small>
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
                variant="light" 
                size="sm"
                onClick={() => navigate('/attendance')}
              >
                View Details <FaArrowRight className="ms-2" size={10} />
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Statistics Cards */}
      <Row className="mb-4 g-3">
        <Col md={3}>
          <Card className="border-0 shadow-sm h-70">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted small mb-1">Leave Balance</p>
                  <h4 className="mb-0 fw-bold text-primary">{leaveBalance.available}</h4>
                  <small className="text-muted">Available days</small>
                </div>
                <div className="bg-primary bg-opacity-10 p-2 rounded-circle">
                  <FaUmbrellaBeach className="text-primary" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm h-70">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted small mb-1">Present Days</p>
                  <h4 className="mb-0 fw-bold text-success">{stats.presentDays}</h4>
                  <small className="text-muted">Last 30 days</small>
                </div>
                <div className="bg-success bg-opacity-10 p-2 rounded-circle">
                  <FaCheckCircle className="text-success" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm h-70">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted small mb-1">Late Days</p>
                  <h4 className="mb-0 fw-bold text-warning">{stats.lateDays}</h4>
                  <small className="text-muted">Last 30 days</small>
                  {stats.totalLateMinutes > 0 && (
                    <small className="text-danger d-block">
                      Total: {formatLateTime(stats.totalLateMinutes)}
                    </small>
                  )}
                </div>
                <div className="bg-warning bg-opacity-10 p-2 rounded-circle">
                  <FaClock className="text-warning" size={20} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        <Col md={3}>
          <Card className="border-0 shadow-sm h-70">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <p className="text-muted small mb-1">Upcoming Holiday</p>
                  {upcomingHolidays.length > 0 ? (
                    <>
                      <h6 className="mb-0 fw-bold">{upcomingHolidays[0].name}</h6>
                      <small className="text-muted">{formatDate(upcomingHolidays[0].date)}</small>
                      <Badge bg="info" className="ms-2">
                        {upcomingHolidays[0].daysLeft} days left
                      </Badge>
                    </>
                  ) : (
                    <p className="mb-0">No upcoming holidays</p>
                  )}
                </div>
                <div className="bg-info bg-opacity-10 p-3 rounded-circle">
                  <FaCalendarAlt className="text-info" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      <Row className="g-4">
        {/* Attendance Bar Chart */}
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <FaChartBar className="me-2 text-primary" />
                Weekly Attendance Summary
              </h6>
              <Badge bg="light" text="dark">Average hours per day</Badge>
            </Card.Header>
            <Card.Body>
              <div style={{ height: '320px', position: 'relative' }}>
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
                        titleFont: {
                          size: 12,
                          weight: 'bold'
                        },
                        bodyFont: {
                          size: 11
                        },
                        padding: 8,
                        callbacks: {
                          label: function(context) {
                            const value = context.raw;
                            const dayIndex = context.dataIndex;
                            if (dayIndex === 5 || dayIndex === 6) {
                              return value > 0 ? `  ${value} hours (Worked on W-OFF)` : '  Weekly Off - No work';
                            }
                            return `  ${value} hours`;
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
                          font: {
                            size: 11,
                            weight: 'normal',
                            family: 'sans-serif'
                          },
                          padding: { top: 0, bottom: 10 }
                        },
                        grid: {
                          color: 'rgba(0, 0, 0, 0.05)',
                          drawBorder: true,
                          lineWidth: 0.5
                        },
                        ticks: {
                          stepSize: 1,
                          callback: function(value) {
                            return value + 'h';
                          },
                          color: '#495057',
                          font: {
                            size: 10,
                            weight: 'normal',
                            family: 'sans-serif'
                          },
                          padding: 5,
                          maxTicksLimit: 10
                        },
                        border: {
                          display: true,
                          color: '#dee2e6'
                        }
                      },
                      x: {
                        grid: {
                          display: false,
                          drawBorder: true
                        },
                        ticks: {
                          color: '#495057',
                          font: {
                            size: 10,
                            weight: function(context) {
                              return (context.index === 5 || context.index === 6) ? 'bold' : 'normal';
                            },
                            family: 'sans-serif'
                          },
                          maxRotation: 0,
                          minRotation: 0,
                          padding: 5
                        },
                        border: {
                          display: true,
                          color: '#dee2e6'
                        }
                      }
                    },
                    layout: {
                      padding: {
                        top: 10,
                        bottom: 10,
                        left: 5,
                        right: 10
                      }
                    },
                    barPercentage: 0.6,
                    categoryPercentage: 0.7
                  }}
                />
              </div>
              
              {/* Legend with better formatting */}
              <div className="mt-3 d-flex justify-content-center align-items-center gap-4 small">
                <div className="d-flex align-items-center">
                  <div 
                    style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: 'rgba(54, 162, 235, 0.6)',
                      borderRadius: '3px',
                      marginRight: '6px',
                      border: '1px solid rgb(54, 162, 235)'
                    }}
                  ></div>
                  <span className="text-muted">Working Days</span>
                </div>
                <div className="d-flex align-items-center">
                  <div 
                    style={{ 
                      width: '16px', 
                      height: '16px', 
                      backgroundColor: 'rgba(169, 169, 169, 0.6)',
                      borderRadius: '3px',
                      marginRight: '6px',
                      border: '1px solid rgb(128, 128, 128)'
                    }}
                  ></div>
                  <span className="text-muted fw-semibold">W-OFF (Weekly Off)</span>
                </div>
              </div>
              
              {/* Additional info note */}
              <div className="mt-2 text-center text-muted small">
                <FaInfoCircle className="me-1" size={10} />
                Average working hours per day (based on last 30 days)
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Leave Distribution Chart */}
        <Col md={6}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <FaUmbrellaBeach className="me-2 text-primary" />
                Leave Distribution
              </h6>
              <Badge bg="light" text="dark">Total: {leaveBalance.total_accrued} days</Badge>
            </Card.Header>
            <Card.Body>
              <div className="d-flex align-items-center" style={{ height: '250px' }}>
                <div style={{ width: '60%', height: '250px' }}>
                  <Doughnut 
                    data={leaveChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          position: 'bottom'
                        },
                        tooltip: {
                          callbacks: {
                            label: function(context) {
                              return `${context.raw} days`;
                            }
                          }
                        }
                      },
                      cutout: '60%'
                    }}
                  />
                </div>
                <div className="ms-4">
                  <div className="mb-3">
                    <small className="text-muted d-block">Used</small>
                    <strong className="text-danger" style={{ fontSize: '1.2rem' }}>{leaveBalance.used} days</strong>
                    <ProgressBar 
                      now={(leaveBalance.used / leaveBalance.total_accrued) * 100} 
                      variant="danger" 
                      style={{ height: '4px', width: '100px' }} 
                    />
                  </div>
                  <div className="mb-3">
                    <small className="text-muted d-block">Available</small>
                    <strong className="text-success" style={{ fontSize: '1.2rem' }}>{leaveBalance.available} days</strong>
                    <ProgressBar 
                      now={(leaveBalance.available / leaveBalance.total_accrued) * 100} 
                      variant="success" 
                      style={{ height: '4px', width: '100px' }} 
                    />
                  </div>
                  <div>
                    <small className="text-muted d-block">Pending</small>
                    <strong className="text-warning" style={{ fontSize: '1.2rem' }}>{leaveBalance.pending} days</strong>
                    <ProgressBar 
                      now={(leaveBalance.pending / leaveBalance.total_accrued) * 100} 
                      variant="warning" 
                      style={{ height: '4px', width: '100px' }} 
                    />
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Recent Leave Requests */}
        <Col md={7}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <FaHistory className="me-2 text-primary" />
                Recent Leave Requests
              </h6>
              <Button 
                variant="link" 
                size="sm" 
                onClick={() => navigate('/apply-leave')}
                className="text-decoration-none"
              >
                View All <FaArrowRight className="ms-1" size={10} />
              </Button>
            </Card.Header>
            <Card.Body className="p-0">
              <div className="table-responsive">
                <Table hover className="mb-0">
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
                    {leaveRequests.length > 0 ? (
                      leaveRequests.map((leave, index) => (
                        <tr key={leave.id || index}>
                          <td className="small">
                            <Badge bg="secondary" className="px-2 py-1">
                              {leave.leave_type}
                            </Badge>
                          </td>
                          <td className="small">{leave.leave_duration || 'Full Day'}</td>
                          <td className="small">
                            {formatDate(leave.start_date)}
                            {leave.start_date !== leave.end_date && ` - ${formatDate(leave.end_date)}`}
                          </td>
                          <td className="small fw-bold">{leave.days_count || 1}</td>
                          <td className="small">{getStatusBadge(leave.status)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="text-center py-4">
                          <FaUmbrellaBeach size={30} className="text-muted mb-2 opacity-50" />
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
        <Col md={5}>
          {/* Upcoming Holidays Card */}
          <Card className="border-0 shadow-sm mb-3">
            <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
              <h6 className="mb-0">
                <FaCalendarAlt className="me-2 text-primary" />
                Upcoming Holidays
              </h6>
              <Badge bg="light" text="dark">
                Next {upcomingHolidays.length}
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              {upcomingHolidays.length > 0 ? (
                <div className="list-group list-group-flush">
                  {upcomingHolidays.map((holiday, index) => (
                    <div key={index} className="list-group-item d-flex justify-content-between align-items-center py-2">
                      <div>
                        <span className="fw-semibold small">{holiday.name}</span>
                        <br />
                        <small className="text-muted">{formatDate(holiday.date)}</small>
                        <div className="mt-1">
                          {getRegionBadge(holiday.region)}
                        </div>
                      </div>
                      <Badge bg="info" pill>
                        {holiday.daysLeft} {holiday.daysLeft === 1 ? 'day' : 'days'} left
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

          {/* Quick Actions Card */}
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <h6 className="mb-0">
                <FaBell className="me-2 text-primary" />
                Quick Actions
              </h6>
            </Card.Header>
            <Card.Body>
              <div className="d-grid gap-2">
                <Button 
                  variant="primary" 
                  onClick={() => navigate('/apply-leave')}
                  className="d-flex align-items-center justify-content-between"
                >
                  <span><FaUmbrellaBeach className="me-2" /> Apply for Leave</span>
                  <FaArrowRight size={12} />
                </Button>
                <Button 
                  variant="outline-primary" 
                  onClick={() => navigate('/attendance')}
                  className="d-flex align-items-center justify-content-between"
                >
                  <span><FaClock className="me-2" /> Mark Attendance</span>
                  <FaArrowRight size={12} />
                </Button>
                <Button 
                  variant="outline-success" 
                  onClick={() => navigate('/salary-slip')}
                  className="d-flex align-items-center justify-content-between"
                >
                  <span><FaChartLine className="me-2" /> View Salary Slip</span>
                  <FaArrowRight size={12} />
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