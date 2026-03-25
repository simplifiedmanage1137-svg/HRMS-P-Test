import React, { useState, useEffect } from 'react';
import {
  Card, Button, Alert, Spinner, Badge,
  Row, Col, Modal, Table
} from 'react-bootstrap';
import {
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaClock,
  FaMapMarkerAlt,
  FaBuilding,
  FaHome,
  FaLocationArrow,
  FaSignOutAlt,
  FaCalendarAlt,
  FaMoon,
  FaCloudSun,
  FaHistory,
  FaRegClock
} from 'react-icons/fa';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [geofenceInfo, setGeofenceInfo] = useState(null);
  const [heartbeatInterval, setHeartbeatInterval] = useState(null);
  const [showExitWarning, setShowExitWarning] = useState(false);
  const [hasClockedOutToday, setHasClockedOutToday] = useState(false);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [monthlyStats, setMonthlyStats] = useState({
    totalDays: 0,
    presentDays: 0,
    absentDays: 0,
    halfDays: 0,
    weeklyOffDays: 0,
    leaves: 0,
    totalHours: 0,
    averageHours: 0,
    lateDays: 0,
    totalLateMinutes: 0
  });
  const [activeTab, setActiveTab] = useState('daily');
  const [chartData, setChartData] = useState({
    labels: [],
    datasets: [
      {
        label: 'Hours Worked',
        data: [],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: 'rgb(75, 192, 192)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  });

  // Regularization states
  const [missedClockOuts, setMissedClockOuts] = useState([]);
  const [showRegularizationModal, setShowRegularizationModal] = useState(false);
  const [selectedMissedRecord, setSelectedMissedRecord] = useState(null);
  const [regularizationTime, setRegularizationTime] = useState('');
  const [regularizationReason, setRegularizationReason] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const STORAGE_KEY = `attendance_session_${user?.employeeId}`;

  const OFFICE_COORDS = {
    name: 'Viman Nagar Office',
    latitude: 18.56835629424307,
    longitude: 73.90856078144989,
    radius: 50
  };

  // Helper function to format time
  // Helper function to format time - improved
  const formatTime = (datetime) => {
    if (!datetime) return '--:--';
    try {
      const date = new Date(datetime);
      if (isNaN(date.getTime())) return '--:--';
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      return '--:--';
    }
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return 'N/A';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Helper function to format date for string comparison
  const formatDateStr = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Format late time in Hours, Minutes, Seconds format
  const formatLateTime = (lateMinutes) => {
    if (!lateMinutes || lateMinutes === 0 || lateMinutes === null || lateMinutes === undefined) {
      return null;
    }

    let minutes = typeof lateMinutes === 'string' ? parseFloat(lateMinutes) : lateMinutes;

    if (isNaN(minutes) || minutes <= 0) {
      return null;
    }

    const totalMinutes = minutes;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);

    // Always include hours, even if 0
    let result = `${hours}h`;

    if (remainingMinutes > 0 || seconds > 0) {
      result += ` ${remainingMinutes}m`;
    }

    if (seconds > 0) {
      result += ` ${seconds}s`;
    }

    return `Late ${result}`;
  };

  // Calculate distance between two coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  // Update the getAttendanceStatusBadge function
  const getAttendanceStatusBadge = (record) => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = record.attendance_date === today;

    // Weekly off
    if (record.isWeeklyOff) {
      return <Badge bg="secondary" className="px-2 py-1"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    }

    // No clock-in
    if (!record.clock_in) {
      return <Badge bg="secondary" className="px-2 py-1"><FaClock className="me-1" size={10} /> Not Clocked</Badge>;
    }

    // Today's active session
    if (isToday && record.clock_in && !record.clock_out) {
      return <Badge bg="info" className="px-2 py-1"><FaClock className="me-1" size={10} /> Working</Badge>;
    }

    // Past dates - show final status (NO LATE TIME)
    if (record.status === 'present') {
      return <Badge bg="success" className="px-2 py-1"><FaCheckCircle className="me-1" size={10} /> Present</Badge>;
    }

    if (record.status === 'half_day') {
      return <Badge bg="warning" className="text-dark px-2 py-1"><FaCloudSun className="me-1" size={10} /> Half Day</Badge>;
    }

    if (record.status === 'absent') {
      return <Badge bg="danger" className="px-2 py-1"><FaExclamationTriangle className="me-1" size={10} /> Absent</Badge>;
    }

    if (record.is_regularized) {
      return <Badge bg="info" className="px-2 py-1"><FaCheckCircle className="me-1" size={10} /> Regularized</Badge>;
    }

    return <Badge bg="secondary" className="px-2 py-1">Not Clocked</Badge>;
  };


  // Save session to local storage
  const saveSessionToStorage = (session) => {
    if (!user?.employeeId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  };

  // Clear session from local storage
  const clearSessionFromStorage = () => {
    if (!user?.employeeId) return;
    localStorage.removeItem(STORAGE_KEY);
  };

  // Load session from local storage
  const loadSessionFromStorage = () => {
    if (!user?.employeeId) return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

  // Send heartbeat to server
  const sendHeartbeat = async () => {
    try {
      if (activeSession && location) {
        await axios.post(API_ENDPOINTS.ATTENDANCE_HEARTBEAT, {
          employee_id: user.employeeId,
          session_id: activeSession.session_id,
          latitude: location.latitude,
          longitude: location.longitude
        });
      }
    } catch (error) {
      console.error('Heartbeat failed:', error);
    }
  };

  // Fetch today's attendance
  const fetchTodayAttendance = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const attendanceData = response.data.attendance;
      const serverSession = response.data.active_session;

      console.log('📊 Today attendance from API:', attendanceData);

      if (attendanceData) {
        if (attendanceData.late_minutes > 0 && !attendanceData.late_display) {
          attendanceData.late_display = formatLateTime(attendanceData.late_minutes);
        }
        setAttendance(attendanceData);
        if (attendanceData.clock_out) {
          setHasClockedOutToday(true);
        }
      }

      if (serverSession) {
        setActiveSession(serverSession);
        saveSessionToStorage(serverSession);
        setHasClockedOutToday(false);
      } else if (attendanceData?.clock_in && !attendanceData?.clock_out) {
        const inferredSession = {
          session_id: attendanceData.session_id || 'temp-' + Date.now(),
          clock_in_time: attendanceData.clock_in
        };
        setActiveSession(inferredSession);
        saveSessionToStorage(inferredSession);
        setHasClockedOutToday(false);
      } else {
        setActiveSession(null);
        clearSessionFromStorage();
      }

      return attendanceData;
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      return null;
    }
  };

  const fetchMissedClockOuts = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_MISSED_CLOCKOUTS(user.employeeId));
      const missedRecords = response.data.missed_clockouts || [];

      console.log('📋 Missed clock-outs fetched:', missedRecords.length);

      // Log all records to debug
      missedRecords.forEach((record, index) => {
        console.log(`\n📅 Record ${index + 1}:`);
        console.log(`   ID: ${record.id}`);
        console.log(`   Attendance Date: ${record.attendance_date}`);
        console.log(`   Clock In: ${new Date(record.clock_in).toLocaleString()}`);
        console.log(`   Is Regularized: ${record.is_regularized}`);
        console.log(`   Regularization Requested: ${record.regularization_requested}`);
        console.log(`   Regularization Status: ${record.regularization_status}`);
        console.log(`   Should Show Button: ${!record.is_regularized && !record.regularization_requested}`);
      });

      setMissedClockOuts(missedRecords);

      // Filter records that need regularization (not regularized AND not requested)
      const needRegularization = missedRecords.filter(
        record => !record.is_regularized && !record.regularization_requested
      );

      console.log('📋 Records needing regularization:', needRegularization.length);

      if (needRegularization.length > 0 && !sessionStorage.getItem('missed_clockout_shown')) {
        sessionStorage.setItem('missed_clockout_shown', 'true');
        setMessage({
          type: 'warning',
          text: `You have ${needRegularization.length} missed clock-out(s) from previous days. Please request regularization to update your attendance.`
        });
      }
    } catch (error) {
      console.error('Error fetching missed clock-outs:', error);
    }
  };

  const handleRegularizationRequest = async () => {
    if (!regularizationTime) {
      setMessage({ type: 'danger', text: 'Please select clock-out time' });
      return;
    }

    if (!selectedMissedRecord) {
      setMessage({ type: 'danger', text: 'No record selected' });
      return;
    }

    setSubmittingRequest(true);

    try {
      console.log('='.repeat(60));
      console.log('📝 Processing Regularization Request');
      console.log('Selected missed record:', {
        id: selectedMissedRecord.id,
        attendance_date: selectedMissedRecord.attendance_date,
        clock_in: selectedMissedRecord.clock_in
      });

      // Parse the selected datetime-local value
      const selectedDateTime = regularizationTime;
      console.log('Selected datetime string:', selectedDateTime);

      // IMPORTANT: Parse the datetime-local value WITHOUT timezone conversion
      // The datetime-local input gives us "YYYY-MM-DDThh:mm" in local time
      // We need to send this exact date and time to the server
      const [datePart, timePart] = selectedDateTime.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');

      // Create a date string that represents the local time
      // Format: YYYY-MM-DD HH:MM:SS
      const localDateTimeStr = `${year}-${month}-${day} ${hour}:${minute}:00`;

      console.log('Local datetime string:', localDateTimeStr);

      // Get the clock-in time from the missed record
      const clockInTime = new Date(selectedMissedRecord.clock_in);

      console.log('📅 Selected Record Details:');
      console.log('  - Attendance Date:', selectedMissedRecord.attendance_date);
      console.log('  - Clock In (local):', clockInTime.toLocaleString());
      console.log('  - Selected Time (local):', localDateTimeStr);

      console.log('✅ Validations passed!');

      // Prepare request data - send the local datetime string
      const requestData = {
        attendance_id: String(selectedMissedRecord.id),
        requested_clock_out_time: localDateTimeStr, // Send as local datetime string
        attendance_date: selectedMissedRecord.attendance_date,
        reason: regularizationReason || 'Missed clock-out'
      };

      console.log('📤 Sending request to server:', requestData);

      const url = API_ENDPOINTS.ATTENDANCE_REGULARIZATION_REQUEST(user.employeeId);
      console.log('📤 Request URL:', url);

      const response = await axios.post(url, requestData);

      console.log('✅ Success response:', response.data);

      setSuccessMessage(`Regularization request for ${selectedMissedRecord.attendance_date} submitted successfully! HR will review your request.`);
      setShowSuccessModal(true);
      setShowRegularizationModal(false);
      setSelectedMissedRecord(null);
      setRegularizationTime('');
      setRegularizationReason('');

      await fetchMissedClockOuts();
      await fetchAttendanceHistory();
      setMessage({ type: '', text: '' });

    } catch (error) {
      console.error('❌ Error submitting regularization:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      let errorMessage = 'Failed to submit request. ';
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      setMessage({
        type: 'danger',
        text: errorMessage
      });

      setTimeout(() => {
        setMessage({ type: '', text: '' });
      }, 5000);
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Add this function to check and recover active session
  const recoverActiveSession = async () => {
    try {
      console.log('🔍 Checking for active session...');

      // First check if there's an active session in local storage
      const storedSession = loadSessionFromStorage();
      if (storedSession) {
        console.log('✅ Found stored session:', storedSession);
        setActiveSession(storedSession);
        return;
      }

      // If no stored session, check with server
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const serverSession = response.data.active_session;

      if (serverSession) {
        console.log('✅ Found active session on server:', serverSession);
        setActiveSession(serverSession);
        saveSessionToStorage(serverSession);
        setHasClockedOutToday(false);
      } else {
        // Check if today's attendance has clock_in but no clock_out
        const todayAttendance = response.data.attendance;
        if (todayAttendance && todayAttendance.clock_in && !todayAttendance.clock_out) {
          console.log('⚠️ Found attendance with clock_in but no clock_out, creating session...');

          // Create a session for this attendance
          const newSession = {
            session_id: todayAttendance.session_id || 'recovered-' + Date.now(),
            clock_in_time: todayAttendance.clock_in
          };

          setActiveSession(newSession);
          saveSessionToStorage(newSession);
          setHasClockedOutToday(false);
        }
      }
    } catch (error) {
      console.error('Error recovering session:', error);
    }
  };

  // Initial load effects - COMPLETE VERSION
  useEffect(() => {
    if (!user?.employeeId) return;

    const initAttendance = async () => {
      try {
        console.log('🔄 Initializing attendance component...');

        // First, load stored session from local storage
        const stored = loadSessionFromStorage();
        if (stored) {
          console.log('📱 Found stored session:', stored);
          setActiveSession(stored);
        }

        // Fetch today's attendance
        await fetchTodayAttendance();

        // Fetch missed clock-outs
        await fetchMissedClockOuts();

        // Recover active session if needed
        await recoverActiveSession();

        // Get current location
        getCurrentLocation();

        console.log('✅ Attendance initialization complete');
      } catch (error) {
        console.error('❌ Error during initialization:', error);
      }
    };

    initAttendance();

    // Set up timer for current time display
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // Set up beforeunload warning
    const handleBeforeUnload = (e) => {
      if (activeSession) {
        e.preventDefault();
        e.returnValue = 'You have an active session. Please clock out.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      clearInterval(timer);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]); // Only re-run when user changes

  // Generate last 30 days attendance - FIXED HOURS CALCULATION
  const generateLast30DaysAttendance = (history) => {
    const completeHistory = [];
    const today = new Date();
    const todayStr = formatDateStr(today);
    const historyMap = {};

    history.forEach(record => {
      if (record.attendance_date) {
        let dateKey = record.attendance_date;
        if (record.late_minutes > 0 && !record.late_display) {
          record.late_display = formatLateTime(record.late_minutes);
        }
        historyMap[dateKey] = record;
      }
    });

    if (attendance && attendance.attendance_date === todayStr) {
      if (attendance.late_minutes > 0 && !attendance.late_display) {
        attendance.late_display = formatLateTime(attendance.late_minutes);
      }
      historyMap[todayStr] = attendance;
    }

    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = formatDateStr(date);
      const dayOfWeek = date.getDay();
      const isToday = dateStr === todayStr;
      const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const existingRecord = historyMap[dateStr];

      if (existingRecord) {
        const lateMinutes = existingRecord.late_minutes || 0;
        let lateDisplay = existingRecord.late_display;
        let clockOut = existingRecord.clock_out;
        let displayStatus = existingRecord.status;
        let totalHoursDisplay = existingRecord.total_hours_display;
        let totalHours = existingRecord.total_hours;
        let currentHoursDisplay = null;

        // Calculate hours correctly from clock_in and clock_out
        if (existingRecord.clock_in) {
          if (existingRecord.clock_out) {
            // For completed records, calculate hours from clock_in and clock_out
            const clockIn = new Date(existingRecord.clock_in);
            const clockOutDate = new Date(existingRecord.clock_out);

            // Calculate difference in milliseconds
            const diffMs = clockOutDate - clockIn;
            const diffMinutes = diffMs / (1000 * 60);
            const hours = Math.floor(diffMinutes / 60);
            const minutes = Math.round(diffMinutes % 60);

            // Format the display
            totalHoursDisplay = `${hours}h ${minutes}m`;
            totalHours = diffMinutes / 60;

            console.log(`Hours calculation for ${dateStr}:`, {
              clock_in: clockIn.toLocaleString(),
              clock_out: clockOutDate.toLocaleString(),
              diff_minutes: diffMinutes,
              hours: hours,
              minutes: minutes,
              display: totalHoursDisplay
            });
          } else if (isToday) {
            // For today's active session, calculate current hours
            const clockIn = new Date(existingRecord.clock_in);
            const now = new Date();
            const diffMinutes = (now - clockIn) / (1000 * 60);
            const hours = Math.floor(diffMinutes / 60);
            const minutes = Math.round(diffMinutes % 60);
            currentHoursDisplay = `${hours}h ${minutes}m`;
            totalHoursDisplay = currentHoursDisplay;
            totalHours = diffMinutes / 60;
            displayStatus = 'working';
            clockOut = null;
          }
        }

        completeHistory.push({
          id: existingRecord.id,
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff: false,
          dayName,
          isToday,
          clock_in: existingRecord.clock_in,
          clock_out: clockOut,
          total_hours: totalHours,
          total_hours_display: totalHoursDisplay,
          current_hours_display: currentHoursDisplay,
          status: displayStatus,
          late_minutes: lateMinutes,
          late_display: lateDisplay,
          is_regularized: existingRecord.is_regularized || false
        });
      } else {
        let status = 'not_clocked';
        if (isWeeklyOff) status = 'weekly_off';
        completeHistory.push({
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff,
          dayName,
          clock_in: null,
          clock_out: null,
          total_hours: null,
          total_hours_display: null,
          current_hours_display: null,
          status: status,
          late_minutes: 0,
          late_display: null,
          isToday,
          is_regularized: false
        });
      }
    }
    return completeHistory.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Calculate monthly statistics - FIXED
  const calculateMonthlyStats = (history) => {
    let present = 0;
    let absent = 0;
    let halfDays = 0;
    let weeklyOff = 0;
    let leaves = 0;
    let totalHours = 0;
    let lateDays = 0;
    let totalLateMinutes = 0;
    let workingDaysCount = 0;

    history.forEach(record => {
      if (record.isWeeklyOff) {
        weeklyOff++;
      } else if (record.status === 'present') {
        present++;
        workingDaysCount++;
        if (record.total_hours) {
          totalHours += parseFloat(record.total_hours);
        }
        if (parseFloat(record.late_minutes) > 0) {
          lateDays++;
          totalLateMinutes += parseFloat(record.late_minutes);
        }
      } else if (record.status === 'half_day') {
        halfDays++;
        workingDaysCount++;
        if (record.total_hours) {
          totalHours += parseFloat(record.total_hours);
        }
        if (parseFloat(record.late_minutes) > 0) {
          lateDays++;
          totalLateMinutes += parseFloat(record.late_minutes);
        }
      } else if (record.status === 'absent') {
        absent++;
      } else if (record.status === 'on_leave') {
        leaves++;
      } else if (record.status === 'working' && parseFloat(record.late_minutes) > 0) {
        lateDays++;
        totalLateMinutes += parseFloat(record.late_minutes);
      }
    });

    const averageHours = workingDaysCount > 0 ? Math.round((totalHours / workingDaysCount) * 10) / 10 : 0;

    setMonthlyStats({
      totalDays: history.length,
      presentDays: present,
      absentDays: absent,
      halfDays: halfDays,
      weeklyOffDays: weeklyOff,
      leaves: leaves,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: averageHours,
      lateDays: lateDays,
      totalLateMinutes: Math.round(totalLateMinutes * 10) / 10
    });

    console.log('Monthly stats calculated:', {
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: averageHours,
      workingDaysCount: workingDaysCount
    });
  };

  // Update chart data
  const updateChartData = (history) => {
    const sortedHistory = [...history].sort((a, b) => new Date(a.date) - new Date(b.date));
    const labels = [];
    const data = [];

    sortedHistory.forEach(record => {
      if (!record.isWeeklyOff && record.status !== 'weekly_off') {
        labels.push(formatShortDate(record.date));
        data.push(record.total_hours ? parseFloat(record.total_hours) : 0);
      }
    });

    setChartData({
      labels: labels.slice(-15),
      datasets: [{
        label: 'Hours Worked',
        data: data.slice(-15),
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.1)',
        tension: 0.4,
        fill: true,
        pointBackgroundColor: data.slice(-15).map(v => v >= 8 ? 'rgb(40, 167, 69)' : v >= 5 ? 'rgb(255, 193, 7)' : 'rgb(220, 53, 69)'),
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 5,
        pointHoverRadius: 7
      }]
    });
  };

  const fetchAttendanceHistory = async () => {
    try {
      const today = new Date();
      const endDate = new Date(today);
      endDate.setHours(23, 59, 59, 999);
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);
      startDate.setHours(0, 0, 0, 0);

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      console.log('📊 Fetching attendance history for employee:', user.employeeId);
      console.log('📅 Date range:', startDateStr, 'to', endDateStr);
      console.log('🔗 URL:', API_ENDPOINTS.ATTENDANCE_EMPLOYEE_REPORT(user.employeeId, startDateStr, endDateStr));

      const response = await axios.get(
        API_ENDPOINTS.ATTENDANCE_EMPLOYEE_REPORT(user.employeeId, startDateStr, endDateStr)
      );

      console.log('✅ Attendance history response status:', response.status);
      console.log('📊 Attendance records found:', response.data.attendance?.length || 0);
      let history = response.data.attendance || [];
      const completeHistory = generateLast30DaysAttendance(history);

      setAttendanceHistory(completeHistory);
      calculateMonthlyStats(completeHistory);
      updateChartData(completeHistory);

    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);

      // Show user-friendly error message
      if (error.response?.status === 403) {
        setMessage({
          type: 'warning',
          text: 'Unable to fetch attendance history. Please contact HR if issue persists.'
        });
      } else if (error.response?.status === 401) {
        setMessage({
          type: 'danger',
          text: 'Session expired. Please login again.'
        });
      } else if (error.response?.status === 404) {
        setMessage({
          type: 'warning',
          text: 'Attendance report endpoint not found. Please contact administrator.'
        });
      } else {
        setMessage({
          type: 'danger',
          text: error.response?.data?.message || 'Failed to fetch attendance history'
        });
      }

      // Clear error message after 5 seconds
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);

      // Set empty history to avoid UI errors
      const emptyHistory = generateLast30DaysAttendance([]);
      setAttendanceHistory(emptyHistory);
      calculateMonthlyStats(emptyHistory);
      updateChartData(emptyHistory);
    }
  };

  // Get current location
  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported');
      setLocationLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const newLocation = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: position.timestamp
        };
        setLocation(newLocation);

        const distance = calculateDistance(
          newLocation.latitude, newLocation.longitude,
          OFFICE_COORDS.latitude, OFFICE_COORDS.longitude
        );

        setGeofenceInfo({
          distance: Math.round(distance * 100) / 100,
          isInOffice: distance <= OFFICE_COORDS.radius,
          requiredRadius: OFFICE_COORDS.radius
        });
        setLocationLoading(false);
      },
      (error) => {
        let errorMessage = 'Failed to get location';
        if (error.code === error.PERMISSION_DENIED) errorMessage = 'Please enable location access';
        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle clock in
  const handleClockIn = async () => {
    setLoading(true);
    try {
      if (!location) throw new Error('Unable to get location');
      if (!geofenceInfo?.isInOffice) {
        throw new Error(`Must be within ${OFFICE_COORDS.radius}m of office. Currently ${geofenceInfo.distance}m away.`);
      }

      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_IN, {
        employee_id: user.employeeId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      });

      console.log('✅ Clock-in response:', response.data);

      setMessage({ type: 'success', text: response.data.message });

      const newAttendance = {
        clock_in: response.data.clock_in,
        late_minutes: response.data.late_minutes || 0,
        late_display: response.data.late_display || formatLateTime(response.data.late_minutes),
        status: response.data.status,
        attendance_date: new Date().toISOString().split('T')[0]
      };
      setAttendance(newAttendance);

      const session = { session_id: response.data.session_id, clock_in_time: response.data.clock_in };
      setActiveSession(session);
      saveSessionToStorage(session);
      setHasClockedOutToday(false);

      await fetchTodayAttendance();
      await fetchAttendanceHistory();
    } catch (error) {
      setMessage({ type: 'danger', text: error.response?.data?.message || error.message });
    } finally {
      setLoading(false);
    }
  };

  // Handle clock out
  const handleClockOut = async () => {
    setLoading(true);
    try {
      const sessionToUse = activeSession || loadSessionFromStorage();
      if (!sessionToUse) throw new Error('No active session found');

      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_OUT, {
        employee_id: user.employeeId,
        session_id: sessionToUse.session_id,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy
      });

      setMessage({ type: 'success', text: response.data.message });
      setAttendance(prev => ({
        ...prev,
        clock_out: response.data.clock_out,
        total_hours: response.data.total_hours,
        total_minutes: response.data.total_minutes,
        total_hours_display: response.data.total_hours_display,
        status: response.data.status
      }));
      setActiveSession(null);
      clearSessionFromStorage();
      setHasClockedOutToday(true);

      await fetchTodayAttendance();
      await fetchAttendanceHistory();
    } catch (error) {
      if (error.response?.data?.error_type === 'NO_ACTIVE_SESSION') {
        setActiveSession(null);
        clearSessionFromStorage();
        setMessage({ type: 'warning', text: 'Session expired. Please clock in again.' });
      } else {
        setMessage({ type: 'danger', text: error.response?.data?.message || error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle manual clock out
  const handleManualClockOut = async () => {
    setShowExitWarning(false);
    await handleClockOut();
  };

  const handleOpenRegularizationModal = (record) => {
    console.log('='.repeat(60));
    console.log('🔍 Opening regularization modal for record:');
    console.log('Record ID:', record.id);
    console.log('Attendance Date:', record.attendance_date);
    console.log('Clock In (raw):', record.clock_in);
    console.log('Clock In (parsed):', new Date(record.clock_in).toLocaleString());

    setSelectedMissedRecord(record);

    // IMPORTANT: Use the attendance_date from the record, not today's date
    // Parse the attendance_date string (format: "2026-03-24")
    const [year, month, day] = record.attendance_date.split('-');

    // Set default to 6:00 PM on that specific date
    const defaultDateTime = `${year}-${month}-${day}T18:00`;

    console.log('Default datetime set to:', defaultDateTime);
    console.log('For date:', record.attendance_date);

    setRegularizationTime(defaultDateTime);
    setShowRegularizationModal(true);
  };

  // Get location badge
  const getLocationBadge = () => {
    if (locationLoading) {
      return (
        <Badge bg="secondary" className="px-3 py-2">
          <Spinner size="sm" animation="border" className="me-2" />
          Getting location...
        </Badge>
      );
    }

    if (locationError) {
      return (
        <Badge bg="danger" className="px-3 py-2">
          <FaExclamationTriangle className="me-2" />
          {locationError}
        </Badge>
      );
    }

    if (geofenceInfo) {
      if (geofenceInfo.isInOffice) {
        return (
          <Badge bg="success" className="px-3 py-2">
            <FaBuilding className="me-2" />
            At Office ({geofenceInfo.distance}m)
          </Badge>
        );
      } else {
        return (
          <Badge bg="warning" className="px-3 py-2">
            <FaHome className="me-2" />
            Outside Office ({geofenceInfo.distance}m away)
          </Badge>
        );
      }
    }

    return (
      <Badge bg="secondary" className="px-3 py-2">
        <FaLocationArrow className="me-2" />
        Location unknown
      </Badge>
    );
  };

  // Render clock button
  const renderClockButton = () => {
    if (hasClockedOutToday && !activeSession) {
      return (
        <Button variant="secondary" size="lg" className="w-100 py-2" disabled>
          <FaSignOutAlt className="me-2" />
          Clock Out (Completed)
        </Button>
      );
    }

    if (activeSession) {
      return (
        <Button variant="warning" size="lg" className="w-100 py-3" onClick={handleClockOut} disabled={loading}>
          {loading ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Processing...
            </>
          ) : (
            <>
              <FaSignOutAlt className="me-2" />
              Clock Out
            </>
          )}
        </Button>
      );
    }

    return (
      <Button variant="success" size="lg" className="w-100 py-3" onClick={handleClockIn} disabled={loading || !geofenceInfo?.isInOffice || locationLoading}>
        {loading ? (
          <>
            <Spinner size="sm" animation="border" className="me-2" />
            Processing...
          </>
        ) : (
          <>
            <FaMapMarkerAlt className="me-2" />
            Clock In
          </>
        )}
      </Button>
    );
  };

  // Initial load effects
  useEffect(() => {
    if (!user?.employeeId) return;
    const stored = loadSessionFromStorage();
    if (stored) setActiveSession(stored);
    fetchTodayAttendance();
    fetchMissedClockOuts();
    getCurrentLocation();

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    const handleBeforeUnload = (e) => {
      if (activeSession) {
        e.preventDefault();
        e.returnValue = 'You have an active session. Please clock out.';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      clearInterval(timer);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Fetch attendance history when user or attendance changes
  useEffect(() => {
    if (user?.employeeId) fetchAttendanceHistory();
  }, [user?.employeeId, attendance]);

  // Set up heartbeat interval
  useEffect(() => {
    if (activeSession && location) {
      const interval = setInterval(sendHeartbeat, 30000);
      setHeartbeatInterval(interval);
      return () => clearInterval(interval);
    }
  }, [activeSession, location]);

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <h5 className="mb-4 d-flex align-items-center">
        <FaClock className="me-2 text-primary" />
        Attendance Management
      </h5>

      {/* Missed Clock-outs Alert with Regularization Button */}
      {missedClockOuts.length > 0 && missedClockOuts.some(r => !r.is_regularized && !r.regularization_requested) && (
        <Card className="mb-4 border-warning bg-warning bg-opacity-10">
          <Card.Body className="p-3">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
              <div>
                <FaExclamationTriangle className="text-warning me-2" size={20} />
                <strong>Missed Clock-out Detected!</strong>
                <div className="small text-muted mt-1">
                  You have {missedClockOuts.filter(r => !r.is_regularized && !r.regularization_requested).length} incomplete attendance record(s):
                </div>
                <div className="mt-2">
                  {missedClockOuts.filter(r => !r.is_regularized && !r.regularization_requested).map(record => (
                    <Badge
                      key={record.id}
                      bg="light"
                      text="dark"
                      className="me-2 mb-1 p-2"
                      style={{ cursor: 'pointer' }}
                      onClick={() => handleOpenRegularizationModal(record)}
                    >
                      <FaCalendarAlt className="me-1" size={10} />
                      {record.attendance_date}
                      <span className="ms-1 text-muted">
                        (Clock-in: {record.clock_in ? new Date(record.clock_in).toLocaleTimeString() : 'N/A'})
                      </span>
                    </Badge>
                  ))}
                </div>
              </div>
              <Button
                variant="warning"
                size="sm"
                onClick={() => {
                  const firstMissed = missedClockOuts.find(r => !r.is_regularized && !r.regularization_requested);
                  if (firstMissed) {
                    handleOpenRegularizationModal(firstMissed);
                  }
                }}
              >
                <FaRegClock className="me-2" />
                Request Regularization
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* Current Status Card */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-2 p-md-3">
          <Row className="align-items-center g-3">
            <Col xs={12} md={3}>
              <div className="d-flex justify-content-center justify-content-md-start">
                {getLocationBadge()}
              </div>
              {geofenceInfo && (
                <small className="text-muted d-block text-center text-md-start mt-1">
                  <FaMapMarkerAlt className="me-1" size={10} />
                  Accuracy: ±{Math.round(location?.accuracy || 0)}m
                </small>
              )}
            </Col>

            <Col xs={6} md={3}>
              <div className="text-center">
                <small className="text-muted d-block">Current Time</small>
                <strong>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong>
              </div>
            </Col>

            <Col xs={6} md={3}>
              <Row className="g-2">
                <Col xs={6} className="text-center">
                  <small className="text-muted d-block">Clock In</small>
                  <strong className={attendance?.clock_in ? 'text-success' : 'text-muted'}>
                    {attendance?.clock_in ? formatTime(attendance.clock_in) : '--:--'}
                  </strong>
                  {attendance?.late_display && attendance.late_minutes > 0 && (
                    <small className="text-danger d-block" style={{ fontSize: '10px' }}>
                      <FaExclamationTriangle className="me-1" size={8} />
                      Late {attendance.late_display}
                    </small>
                  )}
                </Col>
                <Col xs={6} className="text-center">
                  <small className="text-muted d-block">Clock Out</small>
                  <strong className={attendance?.clock_out ? 'text-warning' : 'text-muted'}>
                    {attendance?.clock_out ? formatTime(attendance.clock_out) : '--:--'}
                  </strong>
                  {attendance?.total_hours_display && (
                    <small className="text-success d-block" style={{ fontSize: '10px' }}>
                      {attendance.total_hours_display}
                    </small>
                  )}
                </Col>
              </Row>
            </Col>

            <Col xs={12} md={3}>
              <div className="d-flex justify-content-center justify-content-md-end">
                {renderClockButton()}
              </div>
            </Col>
          </Row>

          {geofenceInfo && !geofenceInfo.isInOffice && !activeSession && (
            <div className="mt-2 text-warning small text-center">
              <FaExclamationTriangle className="me-1" />
              You are {geofenceInfo.distance}m away from office. Need to be within {OFFICE_COORDS.radius}m to clock in.
            </div>
          )}

          {message.text && (
            <Alert
              variant={message.type}
              onClose={() => setMessage({ type: '', text: '' })}
              dismissible
              className="mt-2 mb-0 py-2 small"
            >
              {message.text}
            </Alert>
          )}
        </Card.Body>
      </Card>

      {/* Monthly Stats Summary */}
      <Row className="mb-3 g-2">
        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm bg-light">
            <Card.Body className="p-2 text-center">
              <small className="text-muted d-block">Present Days</small>
              <h6 className="mb-0 fw-bold">{monthlyStats.presentDays}</h6>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm bg-light">
            <Card.Body className="p-2 text-center">
              <small className="text-muted d-block">Absent Days</small>
              <h6 className="mb-0 fw-bold">{monthlyStats.absentDays}</h6>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm bg-light">
            <Card.Body className="p-2 text-center">
              <small className="text-muted d-block">Total Hours</small>
              <h6 className="mb-0 fw-bold">{monthlyStats.totalHours}h</h6>
            </Card.Body>
          </Card>
        </Col>
        <Col xs={6} md={3}>
          <Card className="border-0 shadow-sm bg-light">
            <Card.Body className="p-2 text-center">
              <small className="text-muted d-block">Avg Hours/Day</small>
              <h6 className="mb-0 fw-bold">{monthlyStats.averageHours}h</h6>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Attendance Reports */}
      <Row>
        <Col lg={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-2 py-md-3">
              <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
                <h6 className="mb-0 small d-flex align-items-center">
                  <FaHistory className="me-2 text-primary" />
                  Attendance Report - Last 30 Days
                </h6>
                <div className="d-flex flex-wrap gap-2">
                  {attendance?.clock_in ? (
                    attendance?.clock_out ? (
                      <Badge bg="success" className="px-3 py-2" style={{ fontSize: '0.85rem' }}>
                        <FaCheckCircle className="me-1" />
                        Today: {formatTime(attendance.clock_in)} - {formatTime(attendance.clock_out)} ({attendance.total_hours_display || attendance.total_hours + 'h'})
                      </Badge>
                    ) : (
                      <Badge bg="warning" className="px-3 py-2 text-dark" style={{ fontSize: '0.85rem' }}>
                        <FaClock className="me-1" />
                        Today: Working since {formatTime(attendance.clock_in)}
                        {attendance?.late_display && attendance.late_minutes > 0 && (
                          <small className="ms-1 text-danger">(Late {attendance.late_display})</small>
                        )}
                      </Badge>
                    )
                  ) : (
                    <Badge bg="secondary" className="px-3 py-2" style={{ fontSize: '0.85rem' }}>
                      <FaClock className="me-1" />
                      Today: Not Clocked In
                    </Badge>
                  )}

                  <Badge bg="info" className="px-3 py-2" style={{ fontSize: '0.85rem' }}>
                    <FaCalendarAlt className="me-1" size={12} />
                    {new Date().toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })}
                  </Badge>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div className="mb-3 border-bottom">
                <Button
                  variant={activeTab === 'daily' ? 'primary' : 'light'}
                  size="sm"
                  onClick={() => setActiveTab('daily')}
                  className="me-2"
                  style={{
                    borderBottom: activeTab === 'daily' ? '3px solid #0d6efd' : 'none',
                    borderRadius: '4px 4px 0 0'
                  }}
                >
                  Daily View
                </Button>
                <Button
                  variant={activeTab === 'chart' ? 'primary' : 'light'}
                  size="sm"
                  onClick={() => setActiveTab('chart')}
                  style={{
                    borderBottom: activeTab === 'chart' ? '3px solid #0d6efd' : 'none',
                    borderRadius: '4px 4px 0 0'
                  }}
                >
                  Chart View
                </Button>
              </div>

              {activeTab === 'daily' ? (
                <>
                  <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <Table hover size="sm" className="mb-0">
                      <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                        <tr>
                          <th style={{ width: '15%' }} className="small">Date</th>
                          <th style={{ width: '10%' }} className="small d-none d-sm-table-cell">Day</th>
                          <th style={{ width: '20%' }} className="small">Clock In</th>
                          <th style={{ width: '20%' }} className="small">Clock Out</th>
                          <th style={{ width: '15%' }} className="small">Hours</th>
                          <th style={{ width: '20%' }} className="small">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceHistory.map((record, index) => {
                          const hasLate = record.late_minutes > 0;
                          const today = new Date().toISOString().split('T')[0];
                          const isToday = record.attendance_date === today;

                          return (
                            <tr key={index} className={`
                ${record.isWeeklyOff ? 'bg-light' : ''} 
                ${record.isToday ? 'table-primary fw-bold' : ''}
                ${hasLate ? 'table-danger' : ''}
                ${record.is_regularized ? 'table-info' : ''}
            `}>
                              {/* Date Column */}
                              <td className="small">
                                <div>
                                  <span className="fw-semibold">{formatShortDate(record.date)}</span>
                                  {record.isToday && <Badge bg="primary" className="ms-1" pill>Today</Badge>}
                                  {record.is_regularized && <Badge bg="info" className="ms-1" pill>Reg</Badge>}
                                </div>
                              </td>

                              {/* Day Column */}
                              <td className="small d-none d-sm-table-cell">
                                <div>
                                  {record.dayName}
                                  {record.isWeeklyOff && <Badge bg="secondary" className="ms-1" pill>OFF</Badge>}
                                </div>
                              </td>

                              {/* Clock In Column */}
                              <td className="small">
                                {record.isWeeklyOff ? (
                                  <span className="text-muted">---</span>
                                ) : record.clock_in ? (
                                  <div>
                                    <span className="text-nowrap">{formatTime(record.clock_in)}</span>
                                  </div>
                                ) : (
                                  <span className="text-muted">---</span>
                                )}
                              </td>

                              {/* Clock Out Column */}
                              <td className="small">
                                {record.isWeeklyOff ? (
                                  <span className="text-muted">---</span>
                                ) : record.clock_out ? (
                                  <span className="text-nowrap">{formatTime(record.clock_out)}</span>
                                ) : record.clock_in && isToday ? (
                                  <Badge bg="info" pill size="sm">Working</Badge>
                                ) : record.clock_in && !record.clock_out && !isToday ? (
                                  <Badge bg="danger" pill size="sm">Missed</Badge>
                                ) : (
                                  <span className="text-muted">---</span>
                                )}
                              </td>

                              {/* Hours Column */}
                              <td className="small fw-bold">
                                {record.isWeeklyOff ? (
                                  <span className="text-muted">-</span>
                                ) : record.total_hours_display ? (
                                  <span className="text-nowrap">{record.total_hours_display}</span>
                                ) : record.total_hours ? (
                                  <span className="text-nowrap">{record.total_hours.toFixed(1)}h</span>
                                ) : record.clock_in && !record.clock_out && isToday ? (
                                  <span className="text-nowrap text-info">{record.current_hours_display || '0h 0m'}</span>
                                ) : (
                                  '-'
                                )}
                              </td>

                              {/* Status Column */}
                              <td className="small">
                                <div className="text-truncate" style={{ maxWidth: '120px' }}>
                                  {getAttendanceStatusBadge(record)}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </div>
                  <div className="mt-2 text-muted small">
                    <FaInfoCircle className="me-1" size={10} />
                    Showing last 30 days from {attendanceHistory.length > 0 ? formatShortDate(attendanceHistory[attendanceHistory.length - 1]?.date) : 'N/A'} to {attendanceHistory.length > 0 ? formatShortDate(attendanceHistory[0]?.date) : 'N/A'}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ height: '300px' }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: { display: false },
                          tooltip: {
                            callbacks: {
                              label: function (context) {
                                return `${context.raw} hours`;
                              }
                            }
                          }
                        },
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 10,
                            title: {
                              display: true,
                              text: 'Hours'
                            },
                            ticks: {
                              stepSize: 1,
                              callback: function (value) {
                                return value + 'h';
                              }
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <div className="mt-2 text-center text-muted small">
                    <span className="me-3"><span style={{ color: 'rgb(40, 167, 69)' }}>●</span> Full Day (8+ hrs)</span>
                    <span className="me-3"><span style={{ color: 'rgb(255, 193, 7)' }}>●</span> Half Day (5-8 hrs)</span>
                    <span><span style={{ color: 'rgb(220, 53, 69)' }}>●</span> Absent ({'<'}5 hrs)</span>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Regularization Modal */}
      <Modal show={showRegularizationModal} onHide={() => {
        setShowRegularizationModal(false);
        setSelectedMissedRecord(null);
        setRegularizationTime('');
        setRegularizationReason('');
      }} centered size="lg">
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title className="h6">
            <FaRegClock className="me-2" />
            Request Regularization - {selectedMissedRecord?.attendance_date}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedMissedRecord && (
            <>
              {/* Show the actual missed record details */}
              <div className="mb-4 p-3 bg-light rounded border">
                <div className="d-flex align-items-center mb-2">
                  <FaInfoCircle className="text-primary me-2" />
                  <strong className="small">Missed Clock-out Record</strong>
                </div>
                <div className="row g-2">
                  <div className="col-12">
                    <div className="small text-muted">Attendance Date</div>
                    <div className="fw-semibold">
                      <FaCalendarAlt className="me-2 text-primary" size={12} />
                      {selectedMissedRecord.attendance_date}
                    </div>
                  </div>
                  <div className="col-12">
                    <div className="small text-muted">Clock In Time</div>
                    <div className="fw-semibold text-success">
                      <FaClock className="me-2" size={12} />
                      {selectedMissedRecord.clock_in_display || new Date(selectedMissedRecord.clock_in).toLocaleString()}
                    </div>
                  </div>
                  {selectedMissedRecord.shift_timing && (
                    <div className="col-12">
                      <div className="small text-muted">Expected Shift</div>
                      <Badge bg="info" className="mt-1">
                        {selectedMissedRecord.shift_timing}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>

              {/* Date/Time selection for clock-out */}
              <div className="mb-3">
                <label className="form-label fw-semibold">Select Clock Out Time *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={regularizationTime}
                  onChange={(e) => {
                    const selectedValue = e.target.value;
                    console.log('Selected datetime (local):', selectedValue);
                    setRegularizationTime(selectedValue);
                  }}
                  required
                />
                <small className="text-muted">
                  Select the time you actually left work on {selectedMissedRecord?.attendance_date}
                </small>
              </div>

              <div className="mb-3">
                <label className="form-label fw-semibold">Reason (Optional)</label>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="e.g., Forgot to clock out, System issue, Network problem, etc."
                  value={regularizationReason}
                  onChange={(e) => setRegularizationReason(e.target.value)}
                />
              </div>

              <Alert variant="info" className="small">
                <FaInfoCircle className="me-2" />
                <strong>Note:</strong> Your request will be reviewed by HR. Once approved, your attendance will be updated with the correct clock-out time.
              </Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => {
            setShowRegularizationModal(false);
            setSelectedMissedRecord(null);
          }}>
            Cancel
          </Button>
          <Button
            variant="warning"
            size="sm"
            onClick={handleRegularizationRequest}
            disabled={submittingRequest || !regularizationTime}
          >
            {submittingRequest ? (
              <>
                <Spinner size="sm" animation="border" className="me-2" />
                Submitting...
              </>
            ) : (
              <>
                <FaRegClock className="me-2" />
                Submit Request
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Success Modal */}
      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title className="h6">Request Submitted</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4 text-center">
          <FaCheckCircle className="text-success mb-3" size={50} />
          <p>{successMessage}</p>
          <Button variant="success" size="sm" onClick={() => setShowSuccessModal(false)}>
            Close
          </Button>
        </Modal.Body>
      </Modal>

      {/* Exit Warning Modal */}
      <Modal show={showExitWarning} onHide={() => setShowExitWarning(false)} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title className="h6">⚠️ Active Session Detected</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-3">
          <p className="small">You have an active session. Would you like to clock out before leaving?</p>
          <p className="text-muted small">If you don't clock out, your attendance will not be recorded properly.</p>
        </Modal.Body>
        <Modal.Footer className="py-2">
          <Button variant="secondary" size="sm" onClick={() => setShowExitWarning(false)}>
            Cancel
          </Button>
          <Button variant="warning" size="sm" onClick={handleManualClockOut}>
            <FaSignOutAlt className="me-2" />
            Clock Out Now
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Attendance;