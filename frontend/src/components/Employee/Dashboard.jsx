// src/components/Employee/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Table, Badge, Spinner, Alert, Button, ProgressBar, Modal, ButtonGroup } from 'react-bootstrap';
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
  FaCloudSun,
  FaStar,
  FaStarHalfAlt,
  FaRegStar,
  FaLocationArrow,
  FaMapMarkerAlt,
  FaExclamationTriangle,
  FaUserTie,
  FaUserCog,
  FaSignInAlt,
  FaSignOutAlt
} from 'react-icons/fa';


import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useNavigate } from 'react-router-dom';
import { Bar, Doughnut } from 'react-chartjs-2';
import { holidays } from '../../data/holidays';
import EmployeeNotices from './EmployeeNotices';
import AnnouncementBanner from './AnnouncementBanner';
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
  // Attendance card state
  const [currentTime, setCurrentTime] = useState(new Date());
  const [attendance, setAttendance] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [hasClockedOutToday, setHasClockedOutToday] = useState(false);
  const [clockLoading, setClockLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const OFFICE_COORDS = { radius: 100 };
  const STORAGE_KEY = `attendance_session_${user?.employeeId}`;

  const saveSession = (s) => localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  const clearSession = () => localStorage.removeItem(STORAGE_KEY);

  const nowIST = () => {
    const now = new Date();
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${ist.getUTCFullYear()}-${p(ist.getUTCMonth()+1)}-${p(ist.getUTCDate())} ${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}:${p(ist.getUTCSeconds())}`;
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimeIST = (datetime) => {
    if (!datetime) return '--:--';
    try {
      let hourNum, minute;
      if (typeof datetime === 'string') {
        if (datetime.includes(' ') && !datetime.includes('T')) {
          const timePart = datetime.split(' ')[1];
          const parts = timePart.split(':');
          hourNum = parseInt(parts[0], 10);
          minute = parts[1] ? parts[1].padStart(2, '0') : '00';
        } else if (datetime.includes('T')) {
          const date = new Date(datetime);
          if (!isNaN(date.getTime())) {
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(date.getTime() + IST_OFFSET_MS);
            hourNum = istDate.getUTCHours();
            minute = String(istDate.getUTCMinutes()).padStart(2, '0');
          } else return '--:--';
        } else if (datetime.match(/^\d{2}:\d{2}:\d{2}$/)) {
          const parts = datetime.split(':');
          hourNum = parseInt(parts[0], 10);
          minute = parts[1];
        } else return '--:--';
      } else return '--:--';
      if (isNaN(hourNum)) return '--:--';
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
      return `${hour12}:${minute} ${ampm}`;
    } catch {
      return '--:--';
    }
  };

  const handleClockIn = async () => {
    setClockLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_IN, {
        employee_id: user.employeeId,
        latitude: null, longitude: null, accuracy: null
      });
      const clockInIST = response.data.clock_in_ist || response.data.clock_in;
      const newAttendance = {
        clock_in: clockInIST,
        clock_in_ist: clockInIST,
        clock_in_display: formatTimeIST(clockInIST),
        late_minutes: response.data.late_minutes || 0,
        late_display: response.data.late_display || null,
        status: 'working',
        attendance_date: response.data.attendance_date || nowIST().split(' ')[0],
        session_id: response.data.session_id
      };
      setAttendance(newAttendance);
      setTodayAttendance(newAttendance);
      const session = { session_id: response.data.session_id, clock_in_time: clockInIST };
      setActiveSession(session);
      saveSession(session);
      setHasClockedOutToday(false);
      setMessage({ type: 'success', text: response.data.message || 'Clocked in successfully!' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to clock in' });
    } finally {
      setClockLoading(false);
    }
  };

  const handleClockOut = async () => {
    setClockLoading(true);
    setMessage({ type: '', text: '' });
    try {
      const preCheck = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const serverSession = preCheck.data.active_session;
      if (!serverSession) {
        setActiveSession(null);
        clearSession();
        await fetchTodayAttendance();
        setClockLoading(false);
        return;
      }
      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_OUT, {
        employee_id: user.employeeId,
        session_id: serverSession.session_id,
        latitude: null, longitude: null, accuracy: null
      });
      const clockOutIST = response.data.clock_out_ist || response.data.clock_out;
      setAttendance(prev => ({
        ...prev,
        clock_out: clockOutIST,
        clock_out_display: formatTimeIST(clockOutIST),
        total_hours_display: response.data.total_hours_display,
        status: response.data.status
      }));
      setActiveSession(null);
      clearSession();
      setHasClockedOutToday(true);
      setMessage({ type: 'success', text: response.data.message || 'Clocked out successfully!' });
    } catch (error) {
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to clock out' });
    } finally {
      setClockLoading(false);
    }
  };

  const renderClockButton = () => {
    const hasOpenSession = !!activeSession || (!!attendance?.clock_in && !attendance?.clock_out);

    if (hasOpenSession) {
      return (
        <Button
          variant="warning"
          size="sm"
          className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill fw-semibold shadow-sm"
          onClick={handleClockOut}
          disabled={clockLoading}
        >
          {clockLoading
            ? <><Spinner size="sm" animation="border" /> Processing...</>
            : <><FaSignOutAlt size={14} /> Clock Out</>}
        </Button>
      );
    }
    return (
      <Button
        variant="success"
        size="sm"
        className="d-flex align-items-center gap-2 px-3 py-2 rounded-pill fw-semibold shadow-sm"
        onClick={handleClockIn}
        disabled={clockLoading}
      >
        {clockLoading
          ? <><Spinner size="sm" animation="border" /> Processing...</>
          : <><FaSignInAlt size={14} /> Clock In</>}
      </Button>
    );
  };

  const getLocationBadge = () => {
    return (
      <Badge bg="info" className="px-3 py-2 rounded-pill">
        <FaLocationArrow className="me-2" size={12} />
        Location Tracking Disabled
      </Badge>
    );
  };

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
    const [geofenceInfo, setGeofenceInfo] = useState(null);
  
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

  // Rating states - Separate for Manager and Admin
  const [managerRatings, setManagerRatings] = useState([]);
  const [adminRatings, setAdminRatings] = useState([]);
  const [managerAverage, setManagerAverage] = useState(null);
  const [adminAverage, setAdminAverage] = useState(null);
  const [showRatingHistory, setShowRatingHistory] = useState(false);
  const [activeRatingTab, setActiveRatingTab] = useState('manager');

  // Chart data
  const [attendanceChartData, setAttendanceChartData] = useState({
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Hours Worked',
        data: [0, 0, 0, 0, 0, 0, 0],
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(169, 169, 169, 0.6)',
          'rgba(169, 169, 169, 0.6)'
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

  // Helper functions for ratings
  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 1; i <= 5; i++) {
      if (i <= fullStars) {
        stars.push(<FaStar key={i} size={14} className="me-1 text-warning" />);
      } else if (i === fullStars + 1 && hasHalfStar) {
        stars.push(<FaStarHalfAlt key={i} size={14} className="me-1 text-warning" />);
      } else {
        stars.push(<FaRegStar key={i} size={14} className="me-1 text-secondary" />);
      }
    }
    return stars;
  };

  const getRatingLabel = (rating) => {
    if (rating >= 4.5) return 'Excellent';
    if (rating >= 3.5) return 'Good';
    if (rating >= 2.5) return 'Average';
    if (rating >= 1.5) return 'Below Average';
    return 'Needs Improvement';
  };

  const getRatingColor = (rating) => {
    if (rating >= 4) return 'success';
    if (rating >= 3) return 'info';
    if (rating >= 2) return 'warning';
    return 'danger';
  };

  useEffect(() => {
    if (user?.employeeId) {
      loadDashboardData();
      fetchEmployeeRatings();
    }
  }, [user]);

  const fetchEmployeeRatings = async () => {
    try {
      const response = await axios.get(`${API_ENDPOINTS.RATINGS}/employee/${user.employeeId}/history`);
      if (response.data.success) {
        setManagerRatings(response.data.manager_ratings || []);
        setAdminRatings(response.data.admin_ratings || []);
        setManagerAverage(response.data.manager_average);
        setAdminAverage(response.data.admin_average);
      }
    } catch (error) {
      console.error('Error fetching ratings:', error);
    }
  };

  const recalculateAttendanceStats = () => {
    if (!attendanceHistory || attendanceHistory.length === 0) return;

    let presentDays = 0;
    let absentDays = 0;
    let halfDays = 0;
    let weeklyOffDays = 0;
    let totalWorkingHours = 0;

    attendanceHistory.forEach(record => {
      const dateObj = new Date(record.attendance_date);
      const dayOfWeek = dateObj.getDay();
      const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;

      if (isWeeklyOff) {
        weeklyOffDays++;
      } else {
        if (record.status === 'present' || record.status === 'working' || record.clock_in) {
          presentDays++;
          if (record.total_hours) {
            totalWorkingHours += parseFloat(record.total_hours);
          }
        } else if (record.status === 'half_day') {
          halfDays++;
          presentDays++;
          if (record.total_hours) {
            totalWorkingHours += parseFloat(record.total_hours);
          }
        } else if (record.status === 'absent' || !record.clock_in) {
          absentDays++;
        }
      }
    });

    setStats(prev => ({
      ...prev,
      presentDays,
      absentDays,
      halfDays,
      weeklyOffDays,
      totalWorkingHours: Math.round(totalWorkingHours * 10) / 10
    }));
  };

  useEffect(() => {
    if (attendanceHistory.length > 0) {
      updateAttendanceChart();
      recalculateAttendanceStats();
    }
    if (leaveBalance) {
      updateLeaveChart();
    }
  }, [attendanceHistory, leaveBalance]);

  useEffect(() => {
    loadUpcomingHolidays();
  }, []);

  const loadUpcomingHolidays = () => {
    try {
      const today = new Date();
      const currentYear = today.getFullYear();

      const allHolidays = holidays.filter(h => {
        const holidayDate = new Date(h.date);
        return holidayDate >= today && holidayDate.getFullYear() <= currentYear + 1;
      });

      const sortedHolidays = allHolidays.sort((a, b) => new Date(a.date) - new Date(b.date));
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
      await Promise.all([
        fetchEmployeeData(),
        fetchLeaveBalance(),
        fetchCompOffHistory(),
        fetchLeaveRequests(),
        fetchTodayAttendance(),
        fetchAttendanceHistory(),
        fetchTodayEvents()
      ]);
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
    await fetchEmployeeRatings();
    setRefreshing(false);
    showNotification('Dashboard refreshed!', 'success');
  };

  const fetchEmployeeData = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.EMPLOYEE_PROFILE(user.employeeId));
      setEmployee(response.data);
    } catch (error) {
      console.error('Error fetching employee:', error);
      showNotification(error.response?.data?.message || 'Failed to load profile data', 'danger');
    }
  };

  const fetchLeaveBalance = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.LEAVE_BALANCE(user.employeeId));
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
      const response = await axios.get(`${API_ENDPOINTS.ATTENDANCE}/comp-off/${user.employeeId}/history`);
      setCompOffHistory(response.data.earnings || []);
      const earned = response.data.earnings?.filter(e => !e.is_used).length || 0;
      setStats(prev => ({
        ...prev,
        compOffEarned: earned
      }));
    } catch (error) {
      console.log('Comp-off history not available for employees');
      setCompOffHistory([]);
    }
  };

  const fetchLeaveRequests = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.LEAVES);
      const leaves = response.data || [];
      setLeaveRequests(leaves.slice(0, 5));
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
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      let attendanceData = response.data.attendance;
      const serverSession = response.data.active_session;

      if (attendanceData) {
        attendanceData.clock_in = attendanceData.clock_in_ist || attendanceData.clock_in;
        attendanceData.clock_out = attendanceData.clock_out_ist || attendanceData.clock_out;
        if (attendanceData.clock_in) attendanceData.clock_in_display = formatTimeIST(attendanceData.clock_in);
        if (attendanceData.clock_out) attendanceData.clock_out_display = formatTimeIST(attendanceData.clock_out);
        attendanceData.late_minutes = Number(attendanceData.late_minutes) || 0;

        setAttendance(attendanceData);
        setTodayAttendance(attendanceData);

        if (serverSession) {
          setActiveSession(serverSession);
          saveSession(serverSession);
          setHasClockedOutToday(false);
        } else if (attendanceData.clock_in && !attendanceData.clock_out) {
          setActiveSession({ session_id: attendanceData.session_id || 'inferred' });
          setHasClockedOutToday(false);
        } else {
          setActiveSession(null);
          clearSession();
          if (attendanceData.clock_out) setHasClockedOutToday(true);
        }
      } else {
        setAttendance(null);
        setTodayAttendance(null);
        if (!serverSession) { setActiveSession(null); clearSession(); }
      }
    } catch (error) {
      console.error('Error fetching today attendance:', error);
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let cycleStartDate, cycleEndDate;
      if (today.getDate() >= 26) {
        cycleStartDate = new Date(today.getFullYear(), today.getMonth(), 26);
        cycleEndDate = new Date(today.getFullYear(), today.getMonth() + 1, 25);
      } else {
        cycleStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 26);
        cycleEndDate = new Date(today.getFullYear(), today.getMonth(), 25);
      }

      const startDateStr = cycleStartDate.toISOString().split('T')[0];
      const fetchEndDate = today < cycleEndDate ? today : cycleEndDate;
      const endDateStr = fetchEndDate.toISOString().split('T')[0];

      const response = await axios.get(
        API_ENDPOINTS.ATTENDANCE_EMPLOYEE_REPORT(user.employeeId, startDateStr, endDateStr)
      );

      const attendance = response.data.attendance || [];
      setAttendanceHistory(attendance);

      let presentDays = 0, halfDays = 0, weeklyOff = 0, absent = 0;
      let totalWorkingDaysCount = 0;

      let d = new Date(cycleStartDate);
      while (d <= today) {
        const dateStr = d.toISOString().split('T')[0];
        const dow = d.getDay();
        const isWeeklyOff = dow === 0 || dow === 6;

        if (isWeeklyOff) {
          weeklyOff++;
        } else {
          totalWorkingDaysCount++;
          const record = attendance.find(r => r.attendance_date === dateStr);
          if (record && (record.clock_in || record.status === 'present')) {
            if (record.status === 'half_day') { halfDays++; presentDays++; }
            else { presentDays++; }
          } else {
            absent++;
          }
        }
        d.setDate(d.getDate() + 1);
      }

      const cycleLabel = `${cycleStartDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${cycleEndDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;

      setStats(prev => ({
        ...prev,
        presentDays,
        absentDays: absent,
        halfDays,
        weeklyOffDays: weeklyOff,
        totalWorkingDays: totalWorkingDaysCount,
        cycleLabel
      }));
    } catch (error) {
      console.error('Error fetching attendance history:', error);
      setAttendanceHistory([]);
    }
  };

  const updateAttendanceChart = () => {
    const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hoursByDay = [0, 0, 0, 0, 0, 0, 0];

    const today = new Date();
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);

    attendanceHistory.forEach(record => {
      if (!record.clock_in) return;
      const recDate = new Date(record.attendance_date);
      recDate.setHours(0, 0, 0, 0);
      const diffDays = Math.round((recDate - monday) / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= 6) {
        const hours = parseFloat(record.total_hours) || 0;
        hoursByDay[diffDays] = Math.round(hours * 10) / 10;
      }
    });

    setAttendanceChartData({
      labels: daysOfWeek,
      datasets: [{
        label: 'Hours Worked',
        data: hoursByDay,
        backgroundColor: [
          'rgba(54, 162, 235, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(54, 162, 235, 0.7)',
          'rgba(169, 169, 169, 0.5)',
          'rgba(169, 169, 169, 0.5)'
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
      }]
    });
  };

  const updateLeaveChart = () => {
    const used = parseFloat(leaveBalance.used) || 0;
    const pending = parseFloat(leaveBalance.pending) || 0;
    const totalAccrued = parseFloat(leaveBalance.total_accrued) || 0;

    // Probation mein available = 0 aata hai backend se
    // To available = total_accrued - used - pending calculate karo
    const available = Math.max(0, totalAccrued - used - pending);
    const total = used + available + pending;

    const hasData = total > 0;

    setLeaveChartData({
      labels: ['Used', 'Available', 'Pending'],
      datasets: [{
        data: hasData ? [used, available, pending] : [1, 1, 1],
        backgroundColor: hasData
          ? ['#dc3545', '#28a745', '#ffc107']
          : ['#e9ecef', '#e9ecef', '#e9ecef'],
        borderWidth: 0,
        borderRadius: 2
      }]
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
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f0f2f5', minHeight: '100vh' }}>

      {/* Main Attendance Card - Attractive Gradient */}
      <Card className="mb-4 border-0 shadow overflow-hidden" style={{ borderRadius: '16px' }}>
        <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', padding: '1px', borderRadius: '16px' }}>
          <Card.Body className="p-3 p-md-4" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)', borderRadius: '15px' }}>
            <Row className="align-items-center g-3">
              {/* Location */}
              <Col xs={12} md={3}>
                <div className="d-flex flex-column align-items-center align-items-md-start">
                  <small className="text-white-50 mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Location Status</small>
                  {getLocationBadge()}
                  {geofenceInfo && (
                    <small className="text-white-50 mt-1" style={{ fontSize: '10px' }}>
                      <FaMapMarkerAlt className="me-1" size={9} />
                      Accuracy: ±{Math.round(0)}m
                    </small>
                  )}
                </div>
              </Col>

              {/* Live Clock */}
              <Col xs={6} md={3}>
                <div className="text-center">
                  <small className="text-white-50 d-block mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Live Time</small>
                  <div className="text-white fw-bold" style={{ fontSize: '22px', fontVariantNumeric: 'tabular-nums', letterSpacing: '1px' }}>
                    {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <small className="text-white-50" style={{ fontSize: '10px' }}>
                    {currentTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </small>
                </div>
              </Col>

              {/* Clock In / Out Times */}
              <Col xs={6} md={3}>
                <div className="d-flex gap-3 justify-content-center">
                  <div className="text-center">
                    <small className="text-white d-block mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>In</small>
                    <div className={`text-white fw-bold ${attendance?.clock_in ? 'text-success' : 'text-white'}`} style={{ fontSize: '15px' }}>
                      {attendance?.clock_in
                        ? (attendance.clock_in_display || formatTimeIST(attendance.clock_in_ist || attendance.clock_in))
                        : '--:--'}
                    </div>
                    {attendance?.late_display && attendance?.late_minutes > 0 && (
                      <small className="text-danger d-block" style={{ fontSize: '9px' }}>
                        <FaExclamationTriangle size={7} className="me-1" />
                        Late {attendance.late_display}
                      </small>
                    )}
                  </div>
                  <div style={{ width: '1px', background: 'rgba(244, 244, 244, 0.15)', margin: '4px 0' }} />
                  <div className="text-center">
                    <small className="text-white d-block mb-1" style={{ fontSize: '10px', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Out</small>
                    <div className={`text-white fw-bold ${attendance?.clock_out ? 'text-warning' : 'text-white'}`} style={{ fontSize: '15px' }}>
                      {attendance?.clock_out
                        ? (attendance.clock_out_display || formatTimeIST(attendance.clock_out_ist || attendance.clock_out))
                        : '--:--'}
                    </div>
                    {attendance?.total_hours_display && (
                      <small className=" text-white text-success d-block" style={{ fontSize: '9px' }}>{attendance.total_hours_display}</small>
                    )}
                  </div>
                </div>
              </Col>

              {/* Action Button */}
              <Col xs={12} md={3}>
                <div className="d-flex justify-content-center justify-content-md-end">
                  {renderClockButton()}
                </div>
              </Col>
            </Row>

            {geofenceInfo && !geofenceInfo.isInOffice && !activeSession && (
              <div className="mt-3 text-warning small text-center" style={{ background: 'rgba(255,193,7,0.1)', borderRadius: '8px', padding: '8px' }}>
                <FaExclamationTriangle className="me-1" />
                You are {geofenceInfo.distance}m away. Need to be within {OFFICE_COORDS.radius}m to clock in.
              </div>
            )}
            {message.text && (
              <Alert variant={message.type} onClose={() => setMessage({ type: '', text: '' })} dismissible className="mt-3 mb-0 py-2 small">
                {message.text}
              </Alert>
            )}
          </Card.Body>
        </div>
      </Card>
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
          <Button variant="outline-primary" size="sm" onClick={refreshData} disabled={refreshing} className="d-inline-flex align-items-center">
            <FaSyncAlt className={`me-2 ${refreshing ? 'fa-spin' : ''}`} size={12} />
            Refresh
          </Button>
          <Badge bg="dark" className="p-2">ID: {user?.employeeId}</Badge>
          <Badge bg="info" className="p-2">{employee?.employment_type || 'Full Time'}</Badge>
        </div>
      </div>

      <AnnouncementBanner />
      <EmployeeNotices />

      {error && (
        <Alert variant="danger" onClose={() => setError('')} dismissible className="mb-3 py-2">
          <small>{error}</small>
        </Alert>
      )}

      {/* Today's Events Widget */}
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

      {/* Today's Status Card */}
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
              <Button variant="dark" size="sm" onClick={() => navigate('/attendance')} className="ms-0 ms-sm-auto w-20 w-sm-auto">
                View Details <FaArrowRight className="ms-2" size={10} />
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Statistics Cards - First Row with 3 Cards */}
      <Row className="mb-4 g-2 g-md-3">
        {/* Leave Balance Card */}
        <Col xs={12} sm={6} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">Leave Balance</p>
                  <h4 className="mb-0 fw-bold text-primary">
                    {leaveBalance.is_probation_complete ? parseFloat(leaveBalance.available).toFixed(1) : parseFloat(leaveBalance.total_accrued).toFixed(1)}
                  </h4>
                  <small className="text-muted text-truncate d-block">
                    {leaveBalance.is_probation_complete ? `Used: ${parseFloat(leaveBalance.used).toFixed(1)} | Pending: ${parseFloat(leaveBalance.pending).toFixed(1)}` : 'Earned (usable after probation)'}
                  </small>
                </div>
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle flex-shrink-0">
                  <FaUmbrellaBeach className="text-primary" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Present Days Card */}
        <Col xs={12} sm={6} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">Present Days</p>
                  <h4 className="mb-0 fw-bold text-success">{stats.presentDays || 0}</h4>
                  <small className="text-muted text-truncate d-block">
                    Absent: <span className="text-danger fw-semibold">{stats.absentDays || 0}</span>
                  </small>
                </div>
                <div className="bg-success bg-opacity-10 p-3 rounded-circle flex-shrink-0">
                  <FaCheckCircle className="text-success" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>

        {/* Comp-Off Balance Card */}
        <Col xs={12} sm={6} md={4}>
          <Card className="border-0 shadow-sm h-100">
            <Card.Body className="p-3">
              <div className="d-flex justify-content-between align-items-start">
                <div className="overflow-hidden">
                  <p className="text-muted small mb-1 text-truncate">Comp-Off Balance</p>
                  <h4 className="mb-0 fw-bold text-purple">{leaveBalance.comp_off_balance || 0}</h4>
                  <small className="text-muted text-truncate d-block">Earned on holidays</small>
                </div>
                <div className="bg-purple bg-opacity-10 p-3 rounded-circle flex-shrink-0">
                  <FaTrophy className="text-purple" size={24} />
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Ratings Card - Second Row */}
      {/* Ratings Card - Second Row */}
      <Row className="mb-4">
        <Col xs={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white p-0 border-bottom-0">
              <div className="d-flex">
                <button
                  className={`flex-grow-1 py-2 px-3 border-0 bg-transparent fw-semibold small ${activeRatingTab === 'manager' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                  onClick={() => setActiveRatingTab('manager')}
                  style={{ transition: 'all 0.2s' }}
                >
                  <FaUserTie className="me-1" size={12} />
                  Manager Rating
                  <Badge bg={activeRatingTab === 'manager' ? 'primary' : 'secondary'} className="ms-1" pill style={{ fontSize: '10px' }}>
                    {managerRatings.length}
                  </Badge>
                </button>
                <button
                  className={`flex-grow-1 py-2 px-3 border-0 bg-transparent fw-semibold small ${activeRatingTab === 'admin' ? 'text-primary border-bottom border-primary border-2' : 'text-muted'}`}
                  onClick={() => setActiveRatingTab('admin')}
                  style={{ transition: 'all 0.2s' }}
                >
                  <FaUserCog className="me-1" size={12} />
                  Admin Rating
                  <Badge bg={activeRatingTab === 'admin' ? 'primary' : 'secondary'} className="ms-1" pill style={{ fontSize: '10px' }}>
                    {adminRatings.length}
                  </Badge>
                </button>
              </div>
            </Card.Header>
            <Card.Body className="p-3">
              {activeRatingTab === 'manager' ? (
                // Manager Rating Content
                managerRatings.length > 0 ? (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-3">
                        <div className="text-center">
                          <div className="display-6 fw-bold text-info mb-0">
                            {managerAverage ? `${managerAverage}` : '0'}
                          </div>
                          <div className="d-flex justify-content-center" style={{ fontSize: '10px' }}>
                            {managerAverage && renderStars(parseFloat(managerAverage))}
                          </div>
                        </div>
                        <div>
                          <div className="small text-muted">Overall Rating</div>
                          <div className="small fw-semibold">Based on {managerRatings.length} review(s)</div>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none small"
                        onClick={() => setShowRatingHistory(true)}
                      >
                        View All <FaArrowRight size={10} />
                      </Button>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm table-borderless mb-0">
                        <tbody>
                          {managerRatings.slice(0, 3).map((rating, index) => (
                            <tr key={index} className="border-bottom">
                              <td style={{ width: '30%' }} className="py-2">
                                <small className="text-muted">{rating.month_name} {rating.year}</small>
                              </td>
                              <td style={{ width: '35%' }} className="py-2">
                                <div style={{ fontSize: '10px' }}>
                                  {renderStars(rating.rating)}
                                </div>
                              </td>
                              <td style={{ width: '35%' }} className="py-2">
                                <Badge bg={getRatingColor(rating.rating)} pill style={{ fontSize: '10px' }}>
                                  {rating.rating_label}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-3">
                    <FaUserTie size={30} className="text-muted mb-2 opacity-25" />
                    <p className="text-muted small mb-0">No manager ratings yet</p>
                  </div>
                )
              ) : (
                // Admin Rating Content
                adminRatings.length > 0 ? (
                  <>
                    <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
                      <div className="d-flex align-items-center gap-3">
                        <div className="text-center">
                          <div className="display-6 fw-bold text-success mb-0">
                            {adminAverage ? `${adminAverage}` : '0'}
                          </div>
                          <div className="d-flex justify-content-center" style={{ fontSize: '10px' }}>
                            {adminAverage && renderStars(parseFloat(adminAverage))}
                          </div>
                        </div>
                        <div>
                          <div className="small text-muted">Overall Rating</div>
                          <div className="small fw-semibold">Based on {adminRatings.length} review(s)</div>
                        </div>
                      </div>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none small"
                        onClick={() => setShowRatingHistory(true)}
                      >
                        View All <FaArrowRight size={10} />
                      </Button>
                    </div>

                    <div className="table-responsive">
                      <table className="table table-sm table-borderless mb-0">
                        <tbody>
                          {adminRatings.slice(0, 3).map((rating, index) => (
                            <tr key={index} className="border-bottom">
                              <td style={{ width: '30%' }} className="py-2">
                                <small className="text-muted">{rating.month_name} {rating.year}</small>
                              </td>
                              <td style={{ width: '35%' }} className="py-2">
                                <div style={{ fontSize: '10px' }}>
                                  {renderStars(rating.rating)}
                                </div>
                              </td>
                              <td style={{ width: '35%' }} className="py-2">
                                <Badge bg={getRatingColor(rating.rating)} pill style={{ fontSize: '10px' }}>
                                  {rating.rating_label}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-3">
                    <FaUserCog size={30} className="text-muted mb-2 opacity-25" />
                    <p className="text-muted small mb-0">No admin ratings yet</p>
                  </div>
                )
              )}
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
              <Badge bg="light" text="dark" className="ms-0 ms-sm-auto">This week's hours</Badge>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div style={{ height: '280px', position: 'relative' }}>
                <Bar
                  data={attendanceChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        callbacks: {
                          label: function (context) {
                            const value = context.raw;
                            const dayIndex = context.dataIndex;
                            if (dayIndex === 5 || dayIndex === 6) {
                              if (value > 0) {
                                return `  ${value}h (Worked on W-OFF)`;
                              }
                              return '  Weekly Off';
                            }
                            return `  ${value}h`;
                          }
                        }
                      }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        max: 10,
                        title: { display: true, text: 'Hours', font: { size: 10 } },
                        ticks: { stepSize: 1, callback: (value) => value + 'h' }
                      },
                      x: { ticks: { font: { size: 9 }, maxRotation: 45, minRotation: 45 } }
                    }
                  }}
                />
              </div>
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
                        legend: { position: 'bottom', labels: { font: { size: 10 } } },
                        tooltip: {
                          callbacks: {
                            label: (context) => {
                              const used = parseFloat(leaveBalance.used) || 0;
                              const available = parseFloat(leaveBalance.available) || 0;
                              const pending = parseFloat(leaveBalance.pending) || 0;
                              const total = used + available + pending;
                              if (total === 0) return ' No data';
                              return ` ${context.raw} days`;
                            }
                          }
                        }
                      },
                      cutout: '60%'
                    }}
                  />
                </div>
                <div className="ms-0 ms-md-4 mt-3 mt-md-0 w-100">
                  {(() => {
                    const used = parseFloat(leaveBalance.used) || 0;
                    const pending = parseFloat(leaveBalance.pending) || 0;
                    const totalAccrued = parseFloat(leaveBalance.total_accrued) || 0;
                    const available = Math.max(0, totalAccrued - used - pending);
                    return (
                      <>
                        <div className="mb-3">
                          <small className="text-muted d-block">Used</small>
                          <strong className="text-danger">{used.toFixed(1)} days</strong>
                          <ProgressBar now={totalAccrued > 0 ? (used / totalAccrued) * 100 : 0} variant="danger" style={{ height: '4px', maxWidth: '120px' }} />
                        </div>
                        <div className="mb-3">
                          <small className="text-muted d-block">Available</small>
                          <strong className="text-success">{available.toFixed(1)} days</strong>
                          <ProgressBar now={totalAccrued > 0 ? (available / totalAccrued) * 100 : 0} variant="success" style={{ height: '4px', maxWidth: '120px' }} />
                        </div>
                        <div>
                          <small className="text-muted d-block">Pending</small>
                          <strong className="text-warning">{pending.toFixed(1)} days</strong>
                          <ProgressBar now={totalAccrued > 0 ? (pending / totalAccrued) * 100 : 0} variant="warning" style={{ height: '4px', maxWidth: '120px' }} />
                        </div>
                      </>
                    );
                  })()}
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
              <Button variant="link" size="sm" onClick={() => navigate('/apply-leave')} className="text-decoration-none p-0">
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
                            <Badge bg={leave.leave_type === 'Comp-Off' ? 'purple' : 'secondary'} className="px-2 py-1 text-nowrap">
                              {leave.leave_type === 'Comp-Off' && '🎉 '}{leave.leave_type}
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
                          <Button variant="primary" size="sm" onClick={() => navigate('/apply-leave')}>
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
                      <Badge bg="info" pill>{holiday.daysLeft}d</Badge>
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
                        <Badge bg={item.is_used ? 'secondary' : 'success'} pill>{item.is_used ? 'Used' : `${item.comp_off_days}d`}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          )}

          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-2 py-md-3">
              <h6 className="mb-0 small">
                <FaBell className="me-2 text-primary" />
                Quick Actions
              </h6>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div className="d-grid gap-2">
                <Button variant="primary" onClick={() => navigate('/apply-leave')} className="d-flex align-items-center justify-content-between" size="sm">
                  <span><FaUmbrellaBeach className="me-2" size={12} /> Apply for Leave</span>
                  <FaArrowRight size={10} />
                </Button>
                <Button variant="outline-primary" onClick={() => navigate('/attendance')} className="d-flex align-items-center justify-content-between" size="sm">
                  <span><FaClock className="me-2" size={12} /> Mark Attendance</span>
                  <FaArrowRight size={10} />
                </Button>
                <Button variant="outline-success" onClick={() => navigate('/salary-slip')} className="d-flex align-items-center justify-content-between" size="sm">
                  <span><FaChartLine className="me-2" size={12} /> View Salary Slip</span>
                  <FaArrowRight size={10} />
                </Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Rating History Modal */}
      <Modal show={showRatingHistory} onHide={() => setShowRatingHistory(false)} centered size="lg">
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title className="h6">
            <FaStar className="me-2" /> My Performance Rating History
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-0">
          <div className="border-bottom">
            <ButtonGroup className="w-100" size="sm">
              <Button
                variant={activeRatingTab === 'manager' ? 'primary' : 'light'}
                onClick={() => setActiveRatingTab('manager')}
                className="rounded-0"
              >
                <FaUserTie className="me-1" /> Manager Ratings ({managerRatings.length})
              </Button>
              <Button
                variant={activeRatingTab === 'admin' ? 'primary' : 'light'}
                onClick={() => setActiveRatingTab('admin')}
                className="rounded-0"
              >
                <FaUserCog className="me-1" /> Admin Ratings ({adminRatings.length})
              </Button>
            </ButtonGroup>
          </div>
          <div className="table-responsive">
            <Table hover className="mb-0">
              <thead className="bg-light">
                <tr className="small">
                  <th className="fw-normal">Period</th>
                  <th className="fw-normal">Rating</th>
                  <th className="fw-normal">Comments</th>
                  <th className="fw-normal">Rated By</th>
                </tr>
              </thead>
              <tbody>
                {(activeRatingTab === 'manager' ? managerRatings : adminRatings).map((rating, index) => (
                  <tr key={index}>
                    <td className="small">{rating.month_name} {rating.year}</td>
                    <td className="small">
                      <div className="text-nowrap">
                        {renderStars(rating.rating)}
                      </div>
                      <small className={`text-${getRatingColor(rating.rating)}`}>{rating.rating_label}</small>
                    </td>
                    <td className="small">{rating.comments || '-'}</td>
                    <td className="small">
                      {rating.rater_name}
                      <Badge bg={rating.rater_role === 'Admin' ? 'success' : 'info'} pill className="ms-1">
                        {rating.rater_role}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {(activeRatingTab === 'manager' ? managerRatings.length === 0 : adminRatings.length === 0) && (
                  <tr>
                    <td colSpan="4" className="text-center py-4">
                      <FaStar size={40} className="text-muted mb-2 opacity-50" />
                      <p className="text-muted mb-0">No {activeRatingTab === 'manager' ? 'manager' : 'admin'} ratings found</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowRatingHistory(false)}>Close</Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default EmployeeDashboard;