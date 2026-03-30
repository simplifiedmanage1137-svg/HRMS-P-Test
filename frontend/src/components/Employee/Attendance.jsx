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
  const [isSessionValid, setIsSessionValid] = useState(false);
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

  // Format time from IST string "YYYY-MM-DD HH:MM:SS" to display format
  const formatTimeIST = (datetime) => {
    if (!datetime) return '--:--';
    try {
      if (typeof datetime === 'string') {
        if (datetime.includes(' ') && !datetime.includes('T')) {
          const timePart = datetime.split(' ')[1];
          const [hour, minute] = timePart.split(':');
          const hourNum = parseInt(hour);
          const ampm = hourNum >= 12 ? 'PM' : 'AM';
          const hour12 = hourNum % 12 || 12;
          return `${hour12}:${minute.padStart(2, '0')} ${ampm}`;
        }
        if (datetime.includes('T')) {
          const match = datetime.match(/T(\d{2}):(\d{2}):(\d{2})/);
          if (match) {
            const hour = parseInt(match[1]);
            const minute = match[2];
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 || 12;
            return `${hour12}:${minute} ${ampm}`;
          }
        }
      }
      return '--:--';
    } catch (error) {
      return '--:--';
    }
  };

  // Parse local time string to Date object for calculation
  const parseLocalTime = (datetimeStr) => {
    if (!datetimeStr) return null;
    if (typeof datetimeStr !== 'string') return null;

    let value = datetimeStr.trim();
    if (value === '') return null;

    value = value.replace(/Z$/, '');
    value = value.replace(/[+-]\d{2}:?\d{2}$/, '');
    value = value.replace('T', ' ');

    const [datePart, timePart] = value.split(' ');
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split('-').map(Number);
    const timeSegments = timePart.split(':');
    const hour = Number(timeSegments[0]);
    const minute = Number(timeSegments[1]);
    const second = Number(timeSegments[2] || 0);

    if (![year, month, day, hour, minute].every(Number.isFinite)) {
      return null;
    }

    return new Date(year, month - 1, day, hour, minute, second);
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

  const formatDateStr = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatLateTime = (lateMinutes) => {
    if (!lateMinutes || lateMinutes <= 0) return null;
    let minutes = typeof lateMinutes === 'string' ? parseFloat(lateMinutes) : lateMinutes;
    if (isNaN(minutes) || minutes <= 0) return null;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.floor(minutes % 60);
    const seconds = Math.round((minutes - Math.floor(minutes)) * 60);
    let result = `${hours}h`;
    if (remainingMinutes > 0 || seconds > 0) result += ` ${remainingMinutes}m`;
    if (seconds > 0) result += ` ${seconds}s`;
    return `Late ${result}`;
  };

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

  const getAttendanceStatusBadge = (record) => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = record.attendance_date === today;

    if (record.isWeeklyOff) {
      return <Badge bg="secondary" className="px-2 py-1"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    }

    if (!record.clock_in) {
      return <Badge bg="secondary" className="px-2 py-1"><FaClock className="me-1" size={10} /> Not Clocked</Badge>;
    }

    if (isToday && record.clock_in && !record.clock_out) {
      if (record.late_minutes > 0) {
        return <Badge bg="warning" className="px-2 py-1 text-dark"><FaExclamationTriangle className="me-1" size={10} /> Late ({formatLateTime(record.late_minutes)})</Badge>;
      }
      return <Badge bg="info" className="px-2 py-1"><FaClock className="me-1" size={10} /> Working</Badge>;
    }

    if (record.status === 'present') {
      if (record.late_minutes > 0) {
        return <Badge bg="warning" className="px-2 py-1 text-dark"><FaExclamationTriangle className="me-1" size={10} /> Late ({formatLateTime(record.late_minutes)})</Badge>;
      }
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

  const saveSessionToStorage = (session) => {
    if (!user?.employeeId) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  };

  const clearSessionFromStorage = () => {
    if (!user?.employeeId) return;
    localStorage.removeItem(STORAGE_KEY);
  };

  const loadSessionFromStorage = () => {
    if (!user?.employeeId) return null;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  };

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

  const fetchTodayAttendance = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const attendanceData = response.data.attendance;
      const serverSession = response.data.active_session;

      console.log('📊 Today attendance from API:', attendanceData);

      if (attendanceData) {
        attendanceData.clock_in = attendanceData.clock_in_ist || attendanceData.clock_in;
        attendanceData.clock_out = attendanceData.clock_out_ist || attendanceData.clock_out;

        attendanceData.late_minutes = Number(attendanceData.late_minutes) || 0;
        attendanceData.late_display = attendanceData.late_display || (attendanceData.late_minutes > 0 ? formatLateTime(attendanceData.late_minutes) : null);
        attendanceData.is_late = attendanceData.late_minutes > 0;

        if (!attendanceData.status) {
          if (attendanceData.clock_in && !attendanceData.clock_out) {
            attendanceData.status = 'working';
          } else if (attendanceData.clock_in && attendanceData.clock_out) {
            attendanceData.status = 'present';
          }
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

      console.log('📋 Missed clockouts with hours:', missedRecords);

      setMissedClockOuts(missedRecords);

      const eligibleRecords = missedRecords.filter(
        record => record.can_regularize === true
      );

      const pendingRecords = missedRecords.filter(
        record => record.regularization_requested && record.regularization_status === 'pending'
      );

      const regularizedRecords = missedRecords.filter(
        record => record.is_regularized === true
      );

      console.log('📊 Summary:', {
        eligible: eligibleRecords.length,
        pending: pendingRecords.length,
        regularized: regularizedRecords.length,
        total: missedRecords.length
      });

      if (eligibleRecords.length > 0 && !sessionStorage.getItem('eligible_regularization_shown')) {
        sessionStorage.setItem('eligible_regularization_shown', 'true');
        setMessage({
          type: 'warning',
          text: `You have ${eligibleRecords.length} day(s) with completed ${eligibleRecords[0]?.expected_hours || 9}+ hours that need clock-out. Please request regularization.`
        });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
      }

      if (pendingRecords.length > 0) {
        setMessage({
          type: 'info',
          text: `You have ${pendingRecords.length} regularization request(s) pending approval.`
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

    if (!selectedMissedRecord.can_regularize) {
      setMessage({
        type: 'danger',
        text: `Cannot request regularization. You have only completed ${selectedMissedRecord.total_hours_worked} out of ${selectedMissedRecord.expected_hours} required hours.`
      });
      setShowRegularizationModal(false);
      setSelectedMissedRecord(null);
      return;
    }

    setSubmittingRequest(true);

    try {
      const selectedDateTime = regularizationTime;
      const [datePart, timePart] = selectedDateTime.split('T');
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');

      const localDateTimeStr = `${year}-${month}-${day} ${hour}:${minute}:00`;

      const requestData = {
        attendance_id: String(selectedMissedRecord.id),
        requested_clock_out_time: localDateTimeStr,
        attendance_date: selectedMissedRecord.attendance_date,
        reason: regularizationReason || 'Missed clock-out after completing full shift'
      };

      const url = API_ENDPOINTS.ATTENDANCE_REGULARIZATION_REQUEST(user.employeeId);
      await axios.post(url, requestData);

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
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to submit request' });
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const recoverActiveSession = async () => {
    try {
      const storedSession = loadSessionFromStorage();
      if (storedSession && storedSession.session_id) {
        setActiveSession(storedSession);
        return true;
      }

      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const serverSession = response.data.active_session;
      const todayAttendance = response.data.attendance;

      if (serverSession && serverSession.session_id) {
        setActiveSession(serverSession);
        saveSessionToStorage(serverSession);
        setHasClockedOutToday(false);
        return true;
      }

      if (todayAttendance && todayAttendance.clock_in && !todayAttendance.clock_out) {
        if (todayAttendance.session_id) {
          const recoveredSession = {
            session_id: todayAttendance.session_id,
            clock_in_time: todayAttendance.clock_in
          };
          setActiveSession(recoveredSession);
          saveSessionToStorage(recoveredSession);
          setHasClockedOutToday(false);
          return true;
        }

        const newSession = {
          session_id: `recovered-${todayAttendance.id}-${Date.now()}`,
          clock_in_time: todayAttendance.clock_in
        };
        setActiveSession(newSession);
        saveSessionToStorage(newSession);
        setHasClockedOutToday(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error recovering session:', error);
      return false;
    }
  };

  // Generate last 30 days attendance
  const generateLast30DaysAttendance = (history) => {
    const completeHistory = [];
    const today = new Date();
    const todayStr = formatDateStr(today);
    const historyMap = {};

    history.forEach(record => {
      if (record.attendance_date) {
        historyMap[record.attendance_date] = record;
      }
    });

    if (attendance && attendance.attendance_date === todayStr) {
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
        const lateMinutes = Number(existingRecord.late_minutes) || 0;
        let lateDisplay = existingRecord.late_display || (lateMinutes > 0 ? formatLateTime(lateMinutes) : null);
        let clockOut = existingRecord.clock_out_ist || existingRecord.clock_out;
        let displayStatus = existingRecord.status;
        let totalHoursDisplay = existingRecord.total_hours_display;
        let totalHours = existingRecord.total_hours;
        let currentHoursDisplay = null;
        let formattedClockIn = null;
        let formattedClockOut = null;

        const clockInValue = existingRecord.clock_in_ist || existingRecord.clock_in;
        const clockOutValue = existingRecord.clock_out_ist || existingRecord.clock_out;

        if (!displayStatus && clockInValue && !clockOutValue && isToday) {
          displayStatus = 'working';
        }

        if (clockInValue) {
          formattedClockIn = formatTimeIST(clockInValue);
        }

        if (clockOutValue) {
          formattedClockOut = formatTimeIST(clockOutValue);
        }

        if (clockInValue && clockOutValue) {
          const clockInTime = parseLocalTime(clockInValue);
          const clockOutTime = parseLocalTime(clockOutValue);

          if (clockInTime && clockOutTime && !isNaN(clockInTime.getTime()) && !isNaN(clockOutTime.getTime())) {
            const diffMs = clockOutTime - clockInTime;
            const diffMinutes = diffMs / (1000 * 60);
            const hours = Math.floor(Math.abs(diffMinutes) / 60);
            const minutes = Math.round(Math.abs(diffMinutes) % 60);

            totalHoursDisplay = `${hours}h ${minutes}m`;
            totalHours = diffMinutes / 60;
          }
        } else if (clockInValue && !clockOutValue && isToday) {
          const clockInTime = parseLocalTime(clockInValue);
          if (clockInTime && !isNaN(clockInTime.getTime())) {
            const now = new Date();
            const diffMinutes = (now - clockInTime) / (1000 * 60);
            const hours = Math.floor(diffMinutes / 60);
            const minutes = Math.round(diffMinutes % 60);
            currentHoursDisplay = `${hours}h ${minutes}m`;
            totalHoursDisplay = currentHoursDisplay;
            totalHours = diffMinutes / 60;
            displayStatus = 'working';
            clockOut = null;
            formattedClockOut = 'Working';
          }
        }

        let finalStatus = displayStatus;
        if (existingRecord.is_regularized) {
          finalStatus = 'present';
        }

        completeHistory.push({
          id: existingRecord.id,
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff: false,
          dayName,
          isToday,
          clock_in: clockInValue,
          clock_out: clockOutValue,
          formatted_clock_in: formattedClockIn,
          formatted_clock_out: formattedClockOut,
          total_hours: totalHours,
          total_hours_display: totalHoursDisplay,
          current_hours_display: currentHoursDisplay,
          status: finalStatus,
          original_status: displayStatus,
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
          formatted_clock_in: null,
          formatted_clock_out: null,
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

  const calculateMonthlyStats = (history) => {
    let present = 0;
    let absent = 0;
    let halfDays = 0;
    let weeklyOff = 0;
    let totalHours = 0;
    let workingDaysCount = 0;

    history.forEach(record => {
      if (record.isWeeklyOff) {
        weeklyOff++;
      } else if (record.status === 'present') {
        present++;
        workingDaysCount++;
        if (record.total_hours) totalHours += parseFloat(record.total_hours);
      } else if (record.status === 'half_day') {
        halfDays++;
        workingDaysCount++;
        if (record.total_hours) totalHours += parseFloat(record.total_hours);
      } else if (record.status === 'absent') {
        absent++;
      }
    });

    const averageHours = workingDaysCount > 0 ? Math.round((totalHours / workingDaysCount) * 10) / 10 : 0;

    setMonthlyStats({
      totalDays: history.length,
      presentDays: present,
      absentDays: absent,
      halfDays: halfDays,
      weeklyOffDays: weeklyOff,
      leaves: 0,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: averageHours,
      lateDays: 0,
      totalLateMinutes: 0
    });
  };

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
      const startDate = new Date(today);
      startDate.setDate(startDate.getDate() - 30);

      const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatDate(startDate);
      const endDateStr = formatDate(endDate);

      const response = await axios.get(
        API_ENDPOINTS.ATTENDANCE_EMPLOYEE_REPORT(user.employeeId, startDateStr, endDateStr)
      );

      console.log('✅ API Response Status:', response.status);
      console.log('📊 Total records:', response.data.attendance?.length || 0);

      if (response.data.attendance && response.data.attendance.length > 0) {
        console.log('🔍 Sample record:', {
          clock_in_ist: response.data.attendance[0].clock_in_ist,
          clock_out_ist: response.data.attendance[0].clock_out_ist,
          clock_in: response.data.attendance[0].clock_in,
          clock_out: response.data.attendance[0].clock_out
        });
      }

      let history = response.data.attendance || [];
      const completeHistory = generateLast30DaysAttendance(history);

      setAttendanceHistory(completeHistory);
      calculateMonthlyStats(completeHistory);
      updateChartData(completeHistory);

    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
      const emptyHistory = generateLast30DaysAttendance([]);
      setAttendanceHistory(emptyHistory);
      calculateMonthlyStats(emptyHistory);
      updateChartData(emptyHistory);
    }
  };

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

  const handleClockIn = async () => {
    setLoading(true);
    try {
      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_IN, {
        employee_id: user.employeeId,
        latitude: null,
        longitude: null,
        accuracy: null
      });

      console.log('✅ Clock-in response:', response.data);

      setMessage({ type: 'success', text: response.data.message });

      const newAttendance = {
        clock_in: response.data.clock_in_ist || response.data.clock_in,
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

  const handleClockOut = async () => {
    setLoading(true);
    try {
      let sessionId = activeSession?.session_id || loadSessionFromStorage()?.session_id;

      if (!sessionId) {
        try {
          const attendanceResponse = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
          const todayAttendance = attendanceResponse.data.attendance;
          if (todayAttendance && todayAttendance.session_id) {
            sessionId = todayAttendance.session_id;
          }
        } catch (error) {
          console.error('Error fetching today attendance:', error);
        }
      }

      if (!sessionId) {
        setMessage({ type: 'warning', text: 'No active session found. Please clock in first.' });
        setLoading(false);
        return;
      }

      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_OUT, {
        employee_id: user.employeeId,
        session_id: sessionId,
        latitude: null,
        longitude: null,
        accuracy: null
      });

      console.log('✅ Clock-out response:', response.data);

      setMessage({ type: 'success', text: response.data.message });

      setAttendance(prev => ({
        ...prev,
        clock_out: response.data.clock_out_ist || response.data.clock_out,
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
      console.error('❌ Clock-out error:', error);
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to clock out' });
    } finally {
      setLoading(false);
    }
  };

  const isValidSession = async () => {
    try {
      const currentSession = activeSession || loadSessionFromStorage();
      if (!currentSession || !currentSession.session_id) return false;
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const serverSession = response.data.active_session;
      if (serverSession && serverSession.session_id === currentSession.session_id) return true;
      const todayAttendance = response.data.attendance;
      if (todayAttendance && todayAttendance.clock_in && !todayAttendance.clock_out) return true;
      return false;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const valid = await isValidSession();
      setIsSessionValid(valid);
      if (!valid && activeSession) {
        setActiveSession(null);
        clearSessionFromStorage();
      }
    };
    checkSession();
    const sessionCheckInterval = setInterval(checkSession, 30000);
    return () => clearInterval(sessionCheckInterval);
  }, [activeSession, user]);

  const handleManualClockOut = async () => {
    setShowExitWarning(false);
    await handleClockOut();
  };

  const handleOpenRegularizationModal = (record) => {
    if (record.has_clock_out) {
      setMessage({
        type: 'info',
        text: `Attendance for ${record.attendance_date} already has a clock-out time. No regularization needed.`
      });
      return;
    }

    if (record.is_regularized) {
      setMessage({
        type: 'info',
        text: `Attendance for ${record.attendance_date} has already been regularized.`
      });
      return;
    }

    if (record.regularization_requested) {
      setMessage({
        type: 'warning',
        text: `You have already requested regularization for ${record.attendance_date}. Please wait for admin approval.`
      });
      return;
    }

    if (!record.can_regularize) {
      setMessage({
        type: 'danger',
        text: `You need to complete ${record.hours_needed} more hours before requesting regularization.`
      });
      return;
    }

    setSelectedMissedRecord(record);

    const [year, month, day] = record.attendance_date.split('-');
    const defaultDateTime = `${year}-${month}-${day}T18:00`;

    setRegularizationTime(defaultDateTime);
    setShowRegularizationModal(true);
  };

  const getLocationBadge = () => {
    return (
      <Badge bg="info" className="px-3 py-2">
        <FaLocationArrow className="me-2" />
        Location Tracking Disabled
      </Badge>
    );
  };

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
      <Button variant="success" size="lg" className="w-100 py-3" onClick={handleClockIn} disabled={loading}>
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

  // Session validation and cleanup on mount
  useEffect(() => {
    if (!user?.employeeId) return;

    const initializeSession = async () => {
      const stored = loadSessionFromStorage();

      if (stored && stored.session_id) {
        try {
          const { data: session, error } = await supabase
            .from('attendance_sessions')
            .select('is_active')
            .eq('session_id', stored.session_id)
            .eq('employee_id', user.employeeId)
            .single();

          if (error || !session || !session.is_active) {
            console.log('Stored session is invalid, clearing...');
            setActiveSession(null);
            clearSessionFromStorage();
            setHasClockedOutToday(false);
          } else {
            setActiveSession(stored);
          }
        } catch (error) {
          console.error('Error validating session:', error);
        }
      }

      // Also check today's attendance to determine if we should have active session
      try {
        const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
        const todayAttendance = response.data.attendance;
        
        // If today has clock_out, ensure no active session
        if (todayAttendance && todayAttendance.clock_out) {
          setHasClockedOutToday(true);
          if (activeSession) {
            setActiveSession(null);
            clearSessionFromStorage();
          }
        }
      } catch (error) {
        console.error('Error checking today attendance:', error);
      }

      fetchTodayAttendance();
      fetchMissedClockOuts();
      getCurrentLocation();
    };

    initializeSession();

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

  useEffect(() => {
    if (user?.employeeId) fetchAttendanceHistory();
  }, [user?.employeeId, attendance]);

  useEffect(() => {
    if (activeSession && location) {
      const interval = setInterval(sendHeartbeat, 30000);
      setHeartbeatInterval(interval);
      return () => clearInterval(interval);
    }
  }, [activeSession, location]);

  // Listen for regularization approved events
  useEffect(() => {
    const handleRegularizationEvent = () => {
      console.log('Regularization approved, refreshing session...');
      fetchTodayAttendance();
      fetchMissedClockOuts();
      fetchAttendanceHistory();
      // Clear any stale session
      setActiveSession(null);
      clearSessionFromStorage();
      setHasClockedOutToday(false);
    };
    
    window.addEventListener('regularizationApproved', handleRegularizationEvent);
    
    return () => {
      window.removeEventListener('regularizationApproved', handleRegularizationEvent);
    };
  }, []);

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <h5 className="mb-4 d-flex align-items-center">
        <FaClock className="me-2 text-primary" />
        Attendance Management
      </h5>

      {/* Regularization Requests Section */}
      {missedClockOuts.length > 0 && (
        <>
          {/* Eligible Records (Can Regularize) */}
          {missedClockOuts.some(r => r.can_regularize === true && !r.regularization_requested && !r.is_regularized) && (
            <Card className="mb-4 border-warning bg-warning bg-opacity-10">
              <Card.Body className="p-3">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div>
                    <FaExclamationTriangle className="text-warning me-2" size={20} />
                    <strong>Regularization Available!</strong>
                    <div className="small text-muted mt-1">
                      You have completed your full shift on the following day(s). Please request regularization to update your attendance:
                    </div>
                    <div className="mt-2">
                      {missedClockOuts.filter(r => r.can_regularize === true && !r.regularization_requested && !r.is_regularized).map(record => (
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
                          <span className="ms-1 text-success">
                            ({record.total_hours_worked}h worked / {record.expected_hours}h required)
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="warning"
                    size="sm"
                    onClick={() => {
                      const firstEligible = missedClockOuts.find(r => r.can_regularize === true && !r.regularization_requested && !r.is_regularized);
                      if (firstEligible) handleOpenRegularizationModal(firstEligible);
                    }}
                  >
                    <FaRegClock className="me-2" />
                    Request Regularization
                  </Button>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Pending Requests */}
          {missedClockOuts.some(r => r.regularization_requested && r.regularization_status === 'pending') && (
            <Card className="mb-4 border-info bg-info bg-opacity-10">
              <Card.Body className="p-3">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div>
                    <FaClock className="text-info me-2" size={20} />
                    <strong>Regularization Requests Pending</strong>
                    <div className="small text-muted mt-1">
                      Your regularization request(s) are pending admin approval:
                    </div>
                    <div className="mt-2">
                      {missedClockOuts.filter(r => r.regularization_requested && r.regularization_status === 'pending').map(record => (
                        <Badge
                          key={record.id}
                          bg="light"
                          text="dark"
                          className="me-2 mb-1 p-2"
                        >
                          <FaCalendarAlt className="me-1" size={10} />
                          {record.attendance_date}
                          <span className="ms-1 text-warning">(Pending Approval)</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}

          {/* Incomplete Hours (Not Yet Eligible) */}
          {missedClockOuts.some(r => !r.can_regularize && !r.regularization_requested && !r.is_regularized && r.total_hours_worked > 0) && (
            <Card className="mb-4 border-secondary bg-light">
              <Card.Body className="p-3">
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
                  <div>
                    <FaClock className="text-secondary me-2" size={20} />
                    <strong>Incomplete Work Days</strong>
                    <div className="small text-muted mt-1">
                      You need to complete {missedClockOuts[0]?.expected_hours || 9} hours before requesting regularization:
                    </div>
                    <div className="mt-2">
                      {missedClockOuts.filter(r => !r.can_regularize && !r.regularization_requested && !r.is_regularized && r.total_hours_worked > 0).map(record => (
                        <Badge
                          key={record.id}
                          bg="light"
                          text="dark"
                          className="me-2 mb-1 p-2"
                        >
                          <FaCalendarAlt className="me-1" size={10} />
                          {record.attendance_date}
                          <span className="ms-1 text-danger">
                            ({record.total_hours_worked}h / {record.expected_hours}h - Need {record.hours_needed}h more)
                          </span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </>
      )}

      {/* Rest of the component remains the same */}
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
                    {attendance ? formatTimeIST(attendance.clock_in_ist || attendance.clock_in) : '--:--'}
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
                    {attendance ? formatTimeIST(attendance.clock_out_ist || attendance.clock_out) : '--:--'}
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
            <Alert variant={message.type} onClose={() => setMessage({ type: '', text: '' })} dismissible className="mt-2 mb-0 py-2 small">
              {message.text}
            </Alert>
          )}
        </Card.Body>
      </Card>

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
                        Today: {formatTimeIST(attendance.clock_in_ist || attendance.clock_in)} - {formatTimeIST(attendance.clock_out_ist || attendance.clock_out)} ({attendance.total_hours_display || attendance.total_hours + 'h'})
                      </Badge>
                    ) : (
                      <Badge bg="warning" className="px-3 py-2 text-dark" style={{ fontSize: '0.85rem' }}>
                        <FaClock className="me-1" />
                        Today: Working since {formatTimeIST(attendance.clock_in_ist || attendance.clock_in)}
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
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Badge>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-2 p-md-3">
              <div className="mb-3 border-bottom">
                <Button variant={activeTab === 'daily' ? 'primary' : 'light'} size="sm" onClick={() => setActiveTab('daily')} className="me-2" style={{ borderBottom: activeTab === 'daily' ? '3px solid #0d6efd' : 'none', borderRadius: '4px 4px 0 0' }}>
                  Daily View
                </Button>
                <Button variant={activeTab === 'chart' ? 'primary' : 'light'} size="sm" onClick={() => setActiveTab('chart')} style={{ borderBottom: activeTab === 'chart' ? '3px solid #0d6efd' : 'none', borderRadius: '4px 4px 0 0' }}>
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
                            <tr key={index} className={`${record.isWeeklyOff ? 'bg-light' : ''} ${record.isToday ? 'table-primary fw-bold' : ''} ${hasLate ? 'table-danger' : ''} ${record.is_regularized ? 'table-info' : ''}`}>
                              <td className="small">
                                <div>
                                  <span className="fw-semibold">{formatShortDate(record.date)}</span>
                                  {record.isToday && <Badge bg="primary" className="ms-1" pill>Today</Badge>}
                                  {record.is_regularized && <Badge bg="info" className="ms-1" pill>Reg</Badge>}
                                </div>
                              </td>
                              <td className="small d-none d-sm-table-cell">
                                <div>
                                  {record.dayName}
                                  {record.isWeeklyOff && <Badge bg="secondary" className="ms-1" pill>OFF</Badge>}
                                </div>
                              </td>
                              <td className="small">
                                {record.isWeeklyOff ? (
                                  <span className="text-muted">---</span>
                                ) : record.formatted_clock_in ? (
                                  <span className="text-nowrap">{record.formatted_clock_in}</span>
                                ) : record.clock_in ? (
                                  <span className="text-nowrap">{formatTimeIST(record.clock_in)}</span>
                                ) : (
                                  <span className="text-muted">---</span>
                                )}
                              </td>
                              <td className="small">
                                {record.isWeeklyOff ? (
                                  <span className="text-muted">---</span>
                                ) : record.formatted_clock_out ? (
                                  <span className="text-nowrap">{record.formatted_clock_out}</span>
                                ) : record.clock_out ? (
                                  <span className="text-nowrap">{formatTimeIST(record.clock_out)}</span>
                                ) : record.clock_in && isToday ? (
                                  <Badge bg="info" pill size="sm">Working</Badge>
                                ) : record.clock_in && !record.clock_out && !isToday ? (
                                  <Badge bg="danger" pill size="sm">Missed</Badge>
                                ) : (
                                  <span className="text-muted">---</span>
                                )}
                              </td>
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
                    <Line data={chartData} options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${context.raw} hours` } } },
                      scales: { y: { beginAtZero: true, max: 10, title: { display: true, text: 'Hours' }, ticks: { stepSize: 1, callback: (value) => value + 'h' } } }
                    }} />
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

      <Modal show={showRegularizationModal} onHide={() => { setShowRegularizationModal(false); setSelectedMissedRecord(null); setRegularizationTime(''); setRegularizationReason(''); }} centered size="lg">
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title className="h6"><FaRegClock className="me-2" /> Request Regularization - {selectedMissedRecord?.attendance_date}</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedMissedRecord && (
            <>
              <div className="mb-4 p-3 bg-light rounded border">
                <div className="d-flex align-items-center mb-2"><FaInfoCircle className="text-primary me-2" /><strong className="small">Missed Clock-out Record</strong></div>
                <div className="row g-2">
                  <div className="col-12"><div className="small text-muted">Attendance Date</div><div className="fw-semibold"><FaCalendarAlt className="me-2 text-primary" size={12} /> {selectedMissedRecord.attendance_date}</div></div>
                  <div className="col-12"><div className="small text-muted">Clock In Time</div><div className="fw-semibold text-success"><FaClock className="me-2" size={12} /> {selectedMissedRecord.clock_in_display || formatTimeIST(selectedMissedRecord.clock_in_ist || selectedMissedRecord.clock_in)}</div></div>
                  {selectedMissedRecord.shift_timing && (<div className="col-12"><div className="small text-muted">Expected Shift</div><Badge bg="info" className="mt-1">{selectedMissedRecord.shift_timing}</Badge></div>)}
                </div>
              </div>
              <div className="mb-3"><label className="form-label fw-semibold">Select Clock Out Time *</label><input type="datetime-local" className="form-control" value={regularizationTime} onChange={(e) => setRegularizationTime(e.target.value)} required /><small className="text-muted">Select the time you actually left work on {selectedMissedRecord?.attendance_date}</small></div>
              <div className="mb-3"><label className="form-label fw-semibold">Reason (Optional)</label><textarea className="form-control" rows="3" placeholder="e.g., Forgot to clock out, System issue, Network problem, etc." value={regularizationReason} onChange={(e) => setRegularizationReason(e.target.value)} /></div>
              <Alert variant="info" className="small"><FaInfoCircle className="me-2" /><strong>Note:</strong> Your request will be reviewed by HR. Once approved, your attendance will be updated with the correct clock-out time.</Alert>
            </>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => { setShowRegularizationModal(false); setSelectedMissedRecord(null); }}>Cancel</Button>
          <Button variant="warning" size="sm" onClick={handleRegularizationRequest} disabled={submittingRequest || !regularizationTime}>{submittingRequest ? (<><Spinner size="sm" animation="border" className="me-2" /> Submitting...</>) : (<><FaRegClock className="me-2" /> Submit Request</>)}</Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showSuccessModal} onHide={() => setShowSuccessModal(false)} centered>
        <Modal.Header closeButton className="bg-success text-white"><Modal.Title className="h6">Request Submitted</Modal.Title></Modal.Header>
        <Modal.Body className="p-4 text-center"><FaCheckCircle className="text-success mb-3" size={50} /><p>{successMessage}</p><Button variant="success" size="sm" onClick={() => setShowSuccessModal(false)}>Close</Button></Modal.Body>
      </Modal>

      <Modal show={showExitWarning} onHide={() => setShowExitWarning(false)} centered>
        <Modal.Header closeButton className="bg-warning"><Modal.Title className="h6">⚠️ Active Session Detected</Modal.Title></Modal.Header>
        <Modal.Body className="p-3"><p className="small">You have an active session. Would you like to clock out before leaving?</p><p className="text-muted small">If you don't clock out, your attendance will not be recorded properly.</p></Modal.Body>
        <Modal.Footer className="py-2"><Button variant="secondary" size="sm" onClick={() => setShowExitWarning(false)}>Cancel</Button><Button variant="warning" size="sm" onClick={handleManualClockOut}><FaSignOutAlt className="me-2" /> Clock Out Now</Button></Modal.Footer>
      </Modal>
    </div>
  );
};

export default Attendance;