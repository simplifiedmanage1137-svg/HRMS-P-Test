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
  const [hasIncompleteRecord, setHasIncompleteRecord] = useState(false);
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
  const [regularizationMinTime, setRegularizationMinTime] = useState('');
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

  // ========== CROSS-MIDNIGHT TIME CALCULATION FUNCTIONS ==========

  // Parse date time string to Date object
  const parseDateTime = (dateTimeStr) => {
    if (!dateTimeStr) return null;
    let cleanStr = dateTimeStr.trim();
    cleanStr = cleanStr.replace('T', ' ');
    cleanStr = cleanStr.split('+')[0];

    const [datePart, timePart] = cleanStr.split(' ');
    if (!datePart || !timePart) return null;

    const [year, month, day] = datePart.split('-').map(Number);
    const timeSegments = timePart.split(':');
    const hour = Number(timeSegments[0]);
    const minute = Number(timeSegments[1]);
    const second = Number(timeSegments[2] || 0);

    if ([year, month, day, hour, minute].some(isNaN)) {
      return null;
    }

    return new Date(year, month - 1, day, hour, minute, second);
  };

  // In Attendance.jsx - Update calculateTotalMinutesFixed function

  // Calculate total minutes between two times with proper cross-midnight support
  const calculateTotalMinutesFixed = (clockInStr, clockOutOrCurrentStr) => {
    if (!clockInStr || !clockOutOrCurrentStr) return 0;

    const parseDateTime = (dateTimeStr) => {
      let cleanStr = dateTimeStr.trim();
      cleanStr = cleanStr.replace('T', ' ');
      cleanStr = cleanStr.split('+')[0];

      const [datePart, timePart] = cleanStr.split(' ');
      if (!datePart || !timePart) return null;

      const [year, month, day] = datePart.split('-').map(Number);
      const timeSegments = timePart.split(':');
      const hour = Number(timeSegments[0]);
      const minute = Number(timeSegments[1]);
      const second = Number(timeSegments[2] || 0);

      if ([year, month, day, hour, minute].some(isNaN)) {
        return null;
      }

      return new Date(year, month - 1, day, hour, minute, second);
    };

    const clockInDate = parseDateTime(clockInStr);
    let clockOutDate = parseDateTime(clockOutOrCurrentStr);

    if (!clockInDate || !clockOutDate) return 0;

    // Calculate difference in milliseconds
    let diffMs = clockOutDate.getTime() - clockInDate.getTime();

    // If negative (crossed midnight), add 24 hours
    if (diffMs < 0) {
      diffMs += 24 * 60 * 60 * 1000;
    }

    const diffMinutes = diffMs / (1000 * 60);

    console.log(`⏱️ Time Diff: ${clockInStr} → ${clockOutOrCurrentStr} = ${diffMinutes} mins (${Math.floor(diffMinutes / 60)}h ${Math.round(diffMinutes % 60)}m)`);

    return diffMinutes;
  };

  // Helper function to get UTC milliseconds from IST string
  const toUTCMs = (val) => {
    if (!val) return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val.getTime();
    const s = String(val).trim();

    const clean = s.replace('T', ' ').substring(0, 19);
    const [datePart, timePart] = clean.split(' ');
    if (!datePart || !timePart) return null;

    const [y, mo, d] = datePart.split('-').map(Number);
    const [h, mi, sec = 0] = timePart.split(':').map(Number);
    if ([y, mo, d, h, mi].some(isNaN)) return null;

    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    return Date.UTC(y, mo - 1, d, h, mi, sec) - IST_OFFSET_MS;
  };

  // Function to get current time in IST format
  const nowIST = () => {
    const now = new Date();
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
    const istMs = now.getTime() + IST_OFFSET_MS;
    const ist = new Date(istMs);

    const y = ist.getUTCFullYear();
    const mo = String(ist.getUTCMonth() + 1).padStart(2, '0');
    const d = String(ist.getUTCDate()).padStart(2, '0');
    const h = String(ist.getUTCHours()).padStart(2, '0');
    const mi = String(ist.getUTCMinutes()).padStart(2, '0');
    const s = String(ist.getUTCSeconds()).padStart(2, '0');

    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
  };

  // Format time from IST string "YYYY-MM-DD HH:MM:SS" to display format
  const formatTimeIST = (datetime) => {
    if (!datetime) return '--:--';
    try {
      let hourNum, minute;
      if (typeof datetime === 'string') {
        // Handle "YYYY-MM-DD HH:MM:SS" format
        if (datetime.includes(' ') && !datetime.includes('T')) {
          const timePart = datetime.split(' ')[1];
          const parts = timePart.split(':');
          hourNum = parseInt(parts[0], 10);
          minute = parts[1] ? parts[1].padStart(2, '0') : '00';
        }
        // Handle UTC ISO format
        else if (datetime.includes('T')) {
          const date = new Date(datetime);
          if (!isNaN(date.getTime())) {
            // Convert to IST
            const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
            const istDate = new Date(date.getTime() + IST_OFFSET_MS);
            hourNum = istDate.getUTCHours();
            minute = String(istDate.getUTCMinutes()).padStart(2, '0');
          } else {
            return '--:--';
          }
        }
        // Handle just time string "HH:MM:SS"
        else if (datetime.match(/^\d{2}:\d{2}:\d{2}$/)) {
          const parts = datetime.split(':');
          hourNum = parseInt(parts[0], 10);
          minute = parts[1];
        } else {
          return '--:--';
        }
      } else {
        return '--:--';
      }
      if (isNaN(hourNum)) return '--:--';
      const ampm = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
      return `${hour12}:${minute} ${ampm}`;
    } catch {
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

    const totalSeconds = Math.floor(minutes * 60);
    const hours = Math.floor(totalSeconds / 3600);
    const remainingSeconds = totalSeconds % 3600;
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;

    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}m`);
    if (secs > 0 || (hours === 0 && mins === 0)) parts.push(`${secs}s`);

    return parts.join(' ');
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

  // Calculate status from total_hours: <5h = absent, 5-8:59h = half_day, 9h+ = present
  const getStatusFromHours = (totalHours) => {
    if (!totalHours || totalHours <= 0) return null;
    if (totalHours < 5) return 'absent';
    if (totalHours < 9) return 'half_day';
    return 'present';
  };

  const getAttendanceStatusBadge = (record) => {
    const today = new Date().toISOString().split('T')[0];
    const isToday = record.attendance_date === today;

    const lateFormatted = record.late_display || (record.late_minutes > 0 ? formatLateTime(record.late_minutes) : null);
    const lateText = lateFormatted ? ` (Late ${lateFormatted})` : '';

    if (record.isWeeklyOff) {
      return <Badge bg="secondary" className="px-2 py-1"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    }

    if (!record.clock_in) {
      return <Badge bg="secondary" className="px-2 py-1"><FaClock className="me-1" size={10} /> Not Clocked</Badge>;
    }

    // Today with active session (no clock out yet)
    if (isToday && record.clock_in && !record.clock_out) {
      if (record.late_minutes > 0) {
        return <Badge bg="warning" className="px-2 py-1 text-dark"><FaExclamationTriangle className="me-1" size={10} /> Working (Late{lateText})</Badge>;
      }
      return <Badge bg="info" className="px-2 py-1"><FaClock className="me-1" size={10} /> Working</Badge>;
    }

    // Clock in + clock out: calculate from hours
    if (record.clock_in && record.clock_out) {
      const totalHours = parseFloat(record.total_hours) || 0;
      const hoursStatus = getStatusFromHours(totalHours);

      if (hoursStatus === 'absent') {
        return <Badge bg="danger" className="px-2 py-1"><FaExclamationTriangle className="me-1" size={10} /> Absent ({totalHours.toFixed(1)}h)</Badge>;
      }
      if (hoursStatus === 'half_day') {
        return <Badge bg="warning" className="text-dark px-2 py-1"><FaCloudSun className="me-1" size={10} /> Half Day{lateText}</Badge>;
      }
      // present (9h+)
      if (record.late_minutes > 0) {
        return <Badge bg="warning" className="px-2 py-1 text-dark"><FaExclamationTriangle className="me-1" size={10} /> Present (Late{lateText})</Badge>;
      }
      return <Badge bg="success" className="px-2 py-1"><FaCheckCircle className="me-1" size={10} /> Present</Badge>;
    }

    // Clock in but no clock out (not today = missed)
    if (record.clock_in && !record.clock_out) {
      return <Badge bg="danger" className="px-2 py-1"><FaExclamationTriangle className="me-1" size={10} /> Missed CO</Badge>;
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
      let attendanceData = response.data.attendance;
      const serverSession = response.data.active_session;

      console.log('📊 Today attendance from API (FULL):', JSON.stringify(attendanceData, null, 2));
      console.log('📊 Attendance data keys:', attendanceData ? Object.keys(attendanceData) : 'No attendance data');

      if (attendanceData) {
        // CRITICAL: Log the raw values
        console.log('🔍 Raw clock_in_ist:', attendanceData.clock_in_ist);
        console.log('🔍 Raw clock_in:', attendanceData.clock_in);
        console.log('🔍 Raw clock_out_ist:', attendanceData.clock_out_ist);
        console.log('🔍 Raw clock_out:', attendanceData.clock_out);

        // Ensure we have both IST and ISO formats
        attendanceData.clock_in = attendanceData.clock_in_ist || attendanceData.clock_in;
        attendanceData.clock_out = attendanceData.clock_out_ist || attendanceData.clock_out;

        // Pre-format for display so card always shows correct time
        if (attendanceData.clock_in) {
          attendanceData.clock_in_display = formatTimeIST(attendanceData.clock_in);
        }
        if (attendanceData.clock_out) {
          attendanceData.clock_out_display = formatTimeIST(attendanceData.clock_out);
        }

        // Parse late minutes
        attendanceData.late_minutes = Number(attendanceData.late_minutes) || 0;
        attendanceData.late_display = attendanceData.late_display || (attendanceData.late_minutes > 0 ? formatLateTime(attendanceData.late_minutes) : null);
        attendanceData.is_late = attendanceData.late_minutes > 0;

        // Calculate real-time working hours for active session (cross-midnight support)
        if (attendanceData.clock_in && !attendanceData.clock_out) {
          const clockInStr = attendanceData.clock_in_ist || attendanceData.clock_in;
          const currentTimeIST = nowIST();

          console.log('🕐 Real-time calculation:', {
            clock_in: clockInStr,
            current_time: currentTimeIST
          });

          // Calculate total minutes using cross-midnight fixed function
          const totalMinutes = calculateTotalMinutesFixed(clockInStr, currentTimeIST);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);

          // Store all calculated values
          attendanceData.total_hours_display = `${hours}h ${minutes}m`;
          attendanceData.total_hours = parseFloat((totalMinutes / 60).toFixed(2));
          attendanceData.total_minutes = Math.round(totalMinutes);
          attendanceData.current_hours_display = `${hours}h ${minutes}m`;

          console.log('📊 Calculated hours:', {
            total_minutes: totalMinutes,
            total_hours_display: attendanceData.total_hours_display,
            total_hours: attendanceData.total_hours
          });
        }
        // If both clock-in and clock-out exist, calculate final hours
        else if (attendanceData.clock_in && attendanceData.clock_out) {
          const clockInStr = attendanceData.clock_in_ist || attendanceData.clock_in;
          const clockOutStr = attendanceData.clock_out_ist || attendanceData.clock_out;

          const totalMinutes = calculateTotalMinutesFixed(clockInStr, clockOutStr);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);

          attendanceData.total_hours_display = `${hours}h ${minutes}m`;
          attendanceData.total_hours = parseFloat((totalMinutes / 60).toFixed(2));
          attendanceData.total_minutes = Math.round(totalMinutes);
        }

        // Set status if not already set
        if (!attendanceData.status) {
          if (attendanceData.clock_in && !attendanceData.clock_out) {
            attendanceData.status = 'working';
          } else if (attendanceData.clock_in && attendanceData.clock_out) {
            const totalHours = attendanceData.total_hours || 0;
            if (totalHours >= 9) {
              attendanceData.status = 'present';
            } else if (totalHours >= 5) {
              attendanceData.status = 'half_day';
            } else {
              attendanceData.status = 'present';
            }
          }
        }

        // CRITICAL FIX: Create display versions of times
        if (attendanceData.clock_in_ist) {
          attendanceData.clock_in_display = formatTimeIST(attendanceData.clock_in_ist);
          console.log('✅ Set clock_in_display from clock_in_ist:', attendanceData.clock_in_display);
        } else if (attendanceData.clock_in) {
          attendanceData.clock_in_display = formatTimeIST(attendanceData.clock_in);
          console.log('✅ Set clock_in_display from clock_in:', attendanceData.clock_in_display);
        }

        if (attendanceData.clock_out_ist) {
          attendanceData.clock_out_display = formatTimeIST(attendanceData.clock_out_ist);
          console.log('✅ Set clock_out_display from clock_out_ist:', attendanceData.clock_out_display);
        } else if (attendanceData.clock_out) {
          attendanceData.clock_out_display = formatTimeIST(attendanceData.clock_out);
          console.log('✅ Set clock_out_display from clock_out:', attendanceData.clock_out_display);
        }

        // If still no display times, check if the raw values exist
        if (!attendanceData.clock_in_display && attendanceData.clock_in_ist) {
          // Try to parse manually
          const timeStr = attendanceData.clock_in_ist.split(' ')[1];
          const parts = timeStr.split(':');
          const hourNum = parseInt(parts[0], 10);
          const minute = parts[1];
          const ampm = hourNum >= 12 ? 'PM' : 'AM';
          const hour12 = hourNum % 12 === 0 ? 12 : hourNum % 12;
          attendanceData.clock_in_display = `${hour12}:${minute} ${ampm}`;
          console.log('✅ Manual clock_in_display:', attendanceData.clock_in_display);
        }

        // Update state
        setAttendance(attendanceData);

        // Update hasClockedOutToday flag
        if (attendanceData.clock_out) {
          setHasClockedOutToday(true);
        } else {
          setHasClockedOutToday(false);
        }
      } else {
        console.log('⚠️ No attendance data for today');
        // ✅ CRITICAL: Don't clear attendance/session if server has an active session
        // This handles cross-midnight: attendance_date is yesterday, but session is still active
        if (!serverSession) {
          setAttendance(null);
          setHasClockedOutToday(false);
        }
        // If serverSession exists but no todayAttendance = cross-midnight case
        // attendance state will be set by the serverSession block above via fetchTodayAttendance
      }

      // Handle server session
      if (serverSession) {
        // Active session exists (today or cross-midnight) → always show Clock Out
        setActiveSession(serverSession);
        saveSessionToStorage(serverSession);
        setHasClockedOutToday(false);
      }
      // If no server session but attendance has clock_in without clock_out
      else if (attendanceData?.clock_in && !attendanceData?.clock_out) {
        // cross-midnight: attendance_date may be yesterday but session still active
        const inferredSession = {
          session_id: attendanceData.session_id || 'temp-' + Date.now(),
          clock_in_time: attendanceData.clock_in,
          is_virtual: false
        };
        setActiveSession(inferredSession);
        saveSessionToStorage(inferredSession);
        setHasClockedOutToday(false);
      }
      else if (!serverSession && !attendanceData) {
        // Only clear session if server confirms no active session AND no attendance
        setActiveSession(null);
        clearSessionFromStorage();
        setHasClockedOutToday(false);
      }
      // ✅ If serverSession exists but attendanceData is null = cross-midnight
      // activeSession is already set above, attendance will show from previous day's state
      else if (serverSession && !attendanceData) {
        // Keep activeSession set (already done above)
        // attendance state remains as-is (previous day's data still in state)
        setHasClockedOutToday(false);
      }

      // Set up real-time interval for updating working hours every minute
      if (attendanceData?.clock_in && !attendanceData?.clock_out) {
        if (window.realTimeInterval) {
          clearInterval(window.realTimeInterval);
        }

        window.realTimeInterval = setInterval(() => {
          const clockInStr = attendanceData.clock_in_ist || attendanceData.clock_in;
          const currentTimeIST = nowIST();

          if (clockInStr && currentTimeIST) {
            const totalMinutes = calculateTotalMinutesFixed(clockInStr, currentTimeIST);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = Math.round(totalMinutes % 60);
            const totalHoursDisplay = `${hours}h ${minutes}m`;

            setAttendance(prev => ({
              ...prev,
              total_hours_display: totalHoursDisplay,
              total_hours: parseFloat((totalMinutes / 60).toFixed(2)),
              total_minutes: Math.round(totalMinutes),
              current_hours_display: totalHoursDisplay
            }));
          }
        }, 60000);

        return () => {
          if (window.realTimeInterval) {
            clearInterval(window.realTimeInterval);
            window.realTimeInterval = null;
          }
        };
      } else {
        if (window.realTimeInterval) {
          clearInterval(window.realTimeInterval);
          window.realTimeInterval = null;
        }
      }

      return attendanceData;
    } catch (error) {
      console.error('❌ Error fetching today attendance:', error);
      console.error('Error details:', error.response?.data);

      if (window.realTimeInterval) {
        clearInterval(window.realTimeInterval);
        window.realTimeInterval = null;
      }

      return null;
    }
  };

  // Add this function after fetchTodayAttendance and before return

  // In Attendance.jsx - Update fetchMissedClockOuts

  const fetchMissedClockOuts = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_MISSED_CLOCKOUTS(user.employeeId));
      const missedRecords = response.data.missed_clockouts || [];
      const hasActiveSession = response.data.has_active_session;

      console.log('📋 Missed clockouts:', missedRecords);
      console.log('📋 Has active session from API:', hasActiveSession);

      setMissedClockOuts(missedRecords);

      // ✅ If API says no active session, clear any stale virtual session
      if (!hasActiveSession && activeSession?.is_virtual) {
        // Check if the virtual session's attendance record is still incomplete
        const virtualAttendanceId = activeSession.attendance_id;
        const stillIncomplete = virtualAttendanceId && missedRecords.some(r =>
          r.id === virtualAttendanceId &&
          !r.has_clock_out &&
          !r.is_regularized &&
          r.is_today === true
        );
        if (!stillIncomplete) {
          setActiveSession(null);
          clearSessionFromStorage();
        }
      }

      // ✅ If there's an active session from API but local state is null, sync it
      if (hasActiveSession && !activeSession) {
        try {
          const todayRes = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
          if (todayRes.data.active_session) {
            setActiveSession(todayRes.data.active_session);
            saveSessionToStorage(todayRes.data.active_session);
          }
        } catch (_) {}
      }

      // ✅ Show regularization messages only for PAST dates
      const nowISTDateStr = nowIST().split(' ')[0];
      const eligibleRecords = missedRecords.filter(r =>
        r.can_regularize === true &&
        !r.is_regularized &&
        r.attendance_date !== nowISTDateStr
      );
      const pendingRecords = missedRecords.filter(r =>
        r.regularization_requested &&
        r.regularization_status === 'pending'
      );

      if (eligibleRecords.length > 0 && !sessionStorage.getItem('eligible_regularization_shown')) {
        sessionStorage.setItem('eligible_regularization_shown', 'true');
        setMessage({
          type: 'warning',
          text: `You have ${eligibleRecords.length} day(s) that need clock-out. Please request regularization.`
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

    if (regularizationMinTime && regularizationTime < regularizationMinTime) {
      setMessage({ type: 'danger', text: 'Clock-out time cannot be before clock-in time.' });
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
        reason: regularizationReason || 'Missed clock-out'
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

  // Add the generateLast30DaysAttendance function if missing
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

        // Calculate total hours with cross-midnight support
        if (clockInValue && clockOutValue) {
          const totalMinutes = calculateTotalMinutesFixed(clockInValue, clockOutValue);
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);
          totalHoursDisplay = `${hours}h ${minutes}m`;
          totalHours = totalMinutes / 60;
        } else if (clockInValue && !clockOutValue && isToday) {
          // Real-time calculation for today's active session
          const totalMinutes = calculateTotalMinutesFixed(clockInValue, nowIST());
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);
          currentHoursDisplay = `${hours}h ${minutes}m`;
          totalHoursDisplay = currentHoursDisplay;
          totalHours = totalMinutes / 60;
          displayStatus = 'working';
          clockOut = null;
          formattedClockOut = 'Working';
        } else if (clockInValue && !clockOutValue && !isToday) {
          // For previous days with missed clock-out, calculate up to current time
          // This ensures that if employee is still working (crossed midnight), 
          // the hours continue to update in real-time
          const totalMinutes = calculateTotalMinutesFixed(clockInValue, nowIST());
          const hours = Math.floor(totalMinutes / 60);
          const minutes = Math.round(totalMinutes % 60);

          // Check if the attendance date is from a previous day but still active
          // Show (Missed) only if the employee hasn't clocked out yet
          if (!clockOutValue) {
            totalHoursDisplay = `${hours}h ${minutes}m (Missed)`;
          } else {
            totalHoursDisplay = `${hours}h ${minutes}m`;
          }
          totalHours = totalMinutes / 60;
          // Keep the status as 'working' since they haven't clocked out
          if (!displayStatus && !clockOutValue) {
            displayStatus = 'working';
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
          id: null,
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff,
          dayName,
          isToday,
          clock_in: null,
          clock_out: null,
          formatted_clock_in: null,
          formatted_clock_out: null,
          total_hours: null,
          total_hours_display: null,
          current_hours_display: null,
          status: status,
          original_status: status,
          late_minutes: 0,
          late_display: null,
          is_regularized: false
        });
      }
    }

    return completeHistory.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Helper function to calculate current working hours (if needed)
  const calculateCurrentWorkingHours = (clockInStr) => {
    if (!clockInStr) return { display: '0h 0m', hours: 0, minutes: 0, totalMinutes: 0 };

    const totalMinutes = calculateTotalMinutesFixed(clockInStr, nowIST());
    const hours = Math.floor(totalMinutes / 60);
    const minutes = Math.round(totalMinutes % 60);

    return {
      display: `${hours}h ${minutes}m`,
      hours: hours,
      minutes: minutes,
      totalMinutes: totalMinutes
    };
  };

  // Parse shift timing for expected hours calculation
  const parseShiftTiming = (shiftString) => {
    if (!shiftString) {
      return { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, totalHours: 9 };
    }
    const parts = shiftString.split('-');
    if (parts.length !== 2) {
      return { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, totalHours: 9 };
    }
    const startPart = parts[0].trim();
    const endPart = parts[1].trim();

    const parseTime = (timeStr) => {
      const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (!match) return null;
      let hour = parseInt(match[1]);
      const minute = parseInt(match[2]);
      const ampm = match[3].toUpperCase();
      if (ampm === 'PM' && hour !== 12) hour += 12;
      if (ampm === 'AM' && hour === 12) hour = 0;
      return { hour, minute };
    };

    const startTime = parseTime(startPart);
    const endTime = parseTime(endPart);

    if (!startTime || !endTime) {
      return { startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, totalHours: 9 };
    }

    const startTotalMinutes = (startTime.hour * 60) + startTime.minute;
    const endTotalMinutes = (endTime.hour * 60) + endTime.minute;
    let totalMinutes = endTotalMinutes - startTotalMinutes;
    if (totalMinutes < 0) totalMinutes += 24 * 60;

    return {
      startHour: startTime.hour,
      startMinute: startTime.minute,
      endHour: endTime.hour,
      endMinute: endTime.minute,
      totalHours: totalMinutes / 60
    };
  };

  const calculateMonthlyStats = (history) => {
    let present = 0;
    let absent = 0;
    let halfDays = 0;
    let weeklyOff = 0;
    let totalHours = 0;
    let workingDaysCount = 0;

    history.forEach(record => {
      if (record.isWeeklyOff || record.status === 'weekly_off') {
        weeklyOff++;
      } else if (record.clock_in && record.clock_out) {
        // Hours-based calculation
        const hrs = parseFloat(record.total_hours) || 0;
        if (hrs >= 9) {
          present++;
          workingDaysCount++;
          totalHours += hrs;
        } else if (hrs >= 5) {
          halfDays++;
          workingDaysCount++;
          totalHours += hrs;
        } else {
          absent++;
        }
      } else if (record.clock_in && !record.clock_out) {
        // Active session (today) — count as working
        const hrs = parseFloat(record.total_hours) || 0;
        totalHours += hrs;
        workingDaysCount++;
      } else if (!record.clock_in && !record.isWeeklyOff) {
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

      let history = response.data.attendance || [];
      const completeHistory = generateLast30DaysAttendance(history);

      // Sync today's attendance to state if not already set
      const todayStr = formatDate(today);
      const todayRecord = history.find(r => r.attendance_date === todayStr);
      if (todayRecord && todayRecord.clock_in) {
        setAttendance(prev => {
          // Only update if not already set or missing display fields
          if (!prev || !prev.clock_in_display) {
            const clockIn = todayRecord.clock_in_ist || todayRecord.clock_in;
            const clockOut = todayRecord.clock_out_ist || todayRecord.clock_out;
            return {
              ...todayRecord,
              clock_in: clockIn,
              clock_out: clockOut,
              clock_in_display: clockIn ? formatTimeIST(clockIn) : null,
              clock_out_display: clockOut ? formatTimeIST(clockOut) : null,
              late_minutes: Number(todayRecord.late_minutes) || 0,
              late_display: todayRecord.late_display || null
            };
          }
          return prev;
        });
      } else if (!todayRecord) {
        // No record for today - but DON'T clear attendance if there's an open session
        // (cross-midnight: yesterday's record is still active)
        setAttendance(prev => {
          // Only clear if no active session and no open attendance
          if (prev && prev.attendance_date && prev.attendance_date !== todayStr) {
            // Keep it if clock_in exists without clock_out (cross-midnight active session)
            if (prev.clock_in && !prev.clock_out) return prev;
            return null;
          }
          return prev;
        });
      }

      // Salary cycle: today >= 26 → this month 26 to next month 25
      //               today < 26  → prev month 26 to this month 25
      const todayDay = today.getDate();
      const cycleStart = todayDay >= 26
        ? new Date(today.getFullYear(), today.getMonth(), 26)
        : new Date(today.getFullYear(), today.getMonth() - 1, 26);
      const cycleEnd = todayDay >= 26
        ? new Date(today.getFullYear(), today.getMonth() + 1, 25)
        : new Date(today.getFullYear(), today.getMonth(), 25);

      const periodHistory = completeHistory.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= cycleStart && recordDate <= cycleEnd;
      });

      setAttendanceHistory(completeHistory);
      calculateMonthlyStats(periodHistory.length > 0 ? periodHistory : completeHistory);
      updateChartData(periodHistory.length > 0 ? periodHistory : completeHistory);

    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
      const emptyHistory = generateLast30DaysAttendance([]);
      setAttendanceHistory(emptyHistory);
      calculateMonthlyStats([]);
      updateChartData([]);
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

  const [showPreviousDayClockOut, setShowPreviousDayClockOut] = useState({
    show: false,
    attendance_id: null,
    attendance_date: null,
    clock_in_time: null
  });

  const handleClockIn = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      console.log('🔍 Checking for incomplete attendance records before clock-in...');
      const missedResponse = await axios.get(API_ENDPOINTS.ATTENDANCE_MISSED_CLOCKOUTS(user.employeeId));
      const missedRecords = missedResponse.data.missed_clockouts || [];

      const incompleteRecord = missedRecords.find(r =>
        !r.has_clock_out &&
        !r.is_regularized &&
        !r.regularization_requested &&
        r.regularization_status !== 'rejected' &&
        (r.is_today === true || r.has_active_session === true)  // Block for today's OR any active session
      );

      if (incompleteRecord) {
        console.log('⚠️ Found incomplete attendance record:', incompleteRecord);
        setMessage({
          type: 'warning',
          text: `You have an incomplete attendance record from ${incompleteRecord.attendance_date}. Please clock out first.`
        });

        setShowPreviousDayClockOut({
          show: true,
          attendance_id: incompleteRecord.id,
          attendance_date: incompleteRecord.attendance_date,
          clock_in_time: incompleteRecord.clock_in_ist || incompleteRecord.clock_in
        });
        setLoading(false);
        return;
      }

      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_IN, {
        employee_id: user.employeeId,
        latitude: null,
        longitude: null,
        accuracy: null
      });

      console.log('✅ Clock-in response:', response.data);
      setMessage({ type: 'success', text: response.data.message });

      // ✅ CRITICAL FIX: Set attendance and session correctly
      const clockInIST = response.data.clock_in_ist || response.data.clock_in;
      const newSessionId = response.data.session_id;
      const newAttendanceDate = response.data.attendance_date || nowIST().split(' ')[0];

      // ✅ Clear old session FIRST before setting new one
      clearSessionFromStorage();
      setActiveSession(null);

      const newAttendance = {
        clock_in: clockInIST,
        clock_in_ist: clockInIST,
        clock_in_display: formatTimeIST(clockInIST),
        late_minutes: response.data.late_minutes || 0,
        late_display: response.data.late_display || formatLateTime(response.data.late_minutes),
        status: 'working',
        attendance_date: newAttendanceDate,
        session_id: newSessionId
      };
      setAttendance(newAttendance);

      // ✅ Set new session
      const session = {
        session_id: newSessionId,
        clock_in_time: clockInIST,
        is_virtual: false
      };
      setActiveSession(session);
      saveSessionToStorage(session);
      setHasClockedOutToday(false);

      // ✅ Force fetch today's attendance again to ensure consistency
      await fetchTodayAttendance();
      await fetchAttendanceHistory();
      await fetchMissedClockOuts();

    } catch (error) {
      console.error('❌ Clock-in error:', error);
      const errorData = error.response?.data;

      if (errorData?.has_missed_clockout && errorData?.attendance_date) {
        setMessage({
          type: 'warning',
          text: errorData.message || `You have an incomplete attendance record from ${errorData.attendance_date}.`
        });

        setShowPreviousDayClockOut({
          show: true,
          attendance_id: errorData.attendance_id,
          attendance_date: errorData.attendance_date,
          clock_in_time: errorData.clock_in_time
        });
      } else {
        setMessage({ type: 'danger', text: errorData?.message || error.message });
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousDayClockOut = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_ENDPOINTS.ATTENDANCE}/clock-out-missed`, {
        employee_id: user.employeeId,
        attendance_id: showPreviousDayClockOut.attendance_id,
        attendance_date: showPreviousDayClockOut.attendance_date
      });

      setMessage({ type: 'success', text: `Successfully clocked out for ${showPreviousDayClockOut.attendance_date}!` });
      setShowPreviousDayClockOut({ show: false, attendance_id: null, attendance_date: null, clock_in_time: null });

      // Clear active session since previous day is now clocked out
      setActiveSession(null);
      clearSessionFromStorage();
      setHasClockedOutToday(false); // Allow Clock In for new shift

      await fetchTodayAttendance();
      await fetchAttendanceHistory();
      await fetchMissedClockOuts();

    } catch (error) {
      console.error('Error clocking out for previous day:', error);
      setMessage({ type: 'danger', text: error.response?.data?.message || 'Failed to clock out for previous day' });
    } finally {
      setLoading(false);
    }
  };

  // In Attendance.jsx - Update handleClockOut function

  const handleClockOut = async () => {
    setLoading(true);
    try {
      // ✅ PRE-CHECK: Verify there's actually an active session on server
      const preCheckResponse = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const serverSession = preCheckResponse.data.active_session;
      const todayAtt = preCheckResponse.data.attendance;

      // If no active server session at all → nothing to clock out
      if (!serverSession) {
        setActiveSession(null);
        clearSessionFromStorage();
        if (todayAtt?.clock_out) {
          setHasClockedOutToday(true);
        }
        setMissedClockOuts([]);
        setLoading(false);
        return;
      }

      // Session ID comes from server (always trust server)
      const sessionId = serverSession.session_id;

      // Proceed with clock-out using server session
      const response = await axios.post(API_ENDPOINTS.ATTENDANCE_CLOCK_OUT, {
        employee_id: user.employeeId,
        session_id: sessionId,
        latitude: null,
        longitude: null,
        accuracy: null
      });

      setMessage({ type: 'success', text: response.data.message });

      // ✅ CRITICAL: Update attendance state to show clock_out
      setAttendance(prev => ({
        ...prev,
        clock_out: response.data.clock_out_ist || response.data.clock_out,
        clock_out_display: response.data.clock_out_ist ? formatTimeIST(response.data.clock_out_ist) : null,
        total_hours: response.data.total_hours,
        total_minutes: response.data.total_minutes,
        total_hours_display: response.data.total_hours_display,
        status: response.data.status
      }));

      // ✅ Clear session and set hasClockedOutToday = true
      setActiveSession(null);
      clearSessionFromStorage();
      setHasClockedOutToday(true);
      setMissedClockOuts([]);

      // ✅ Force refresh to get fresh state
      await fetchTodayAttendance();
      await fetchAttendanceHistory();
      await fetchMissedClockOuts();

      setLoading(false);
      return;

    } catch (error) {
      console.error('❌ Clock-out error:', error);
      const errData = error.response?.data;
      if (errData?.already_clocked_out || error.response?.status === 404) {
        // Stale session was fixed by backend — clear local state and show Clock In
        setActiveSession(null);
        clearSessionFromStorage();
        setHasClockedOutToday(false);
        setAttendance(null);
        setMissedClockOuts([]);
        await fetchTodayAttendance();
        await fetchMissedClockOuts();
        await fetchAttendanceHistory();
      } else if (error.response?.status === 400 && errData?.message?.includes('No active session')) {
        setActiveSession(null);
        clearSessionFromStorage();
        setHasClockedOutToday(false);
        await fetchTodayAttendance();
        await fetchMissedClockOuts();
      } else {
        setMessage({ type: 'danger', text: errData?.message || 'Failed to clock out' });
      }
      setLoading(false);
    }
  };

  const isValidSession = async () => {
    try {
      const currentSession = activeSession || loadSessionFromStorage();
      if (!currentSession || !currentSession.session_id) return false;

      // Virtual sessions: validate against missed clockouts
      if (currentSession.is_virtual) {
        if (!currentSession.attendance_id) return false;
        const missedResponse = await axios.get(API_ENDPOINTS.ATTENDANCE_MISSED_CLOCKOUTS(user.employeeId));
        const missedRecords = missedResponse.data.missed_clockouts || [];
        return missedRecords.some(r =>
          r.id === currentSession.attendance_id &&
          !r.has_clock_out &&
          !r.is_regularized &&
          r.is_today === true
        );
      }

      // Real sessions: check server
      const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
      const serverSession = response.data.active_session;

      // ✅ Any active server session = valid (handles cross-midnight where session_id may differ)
      if (serverSession) return true;

      // No server session = stale local session
      return false;
    } catch (error) {
      return false;
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      if (!activeSession) return;
      const valid = await isValidSession();
      setIsSessionValid(valid);
      if (!valid) {
        setActiveSession(null);
        clearSessionFromStorage();
        try {
          const res = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
          if (res.data.attendance?.clock_out) {
            setHasClockedOutToday(true);
            setMissedClockOuts([]);
          } else if (res.data.active_session) {
            // Server has active session but our local one was stale - re-sync
            setActiveSession(res.data.active_session);
            saveSessionToStorage(res.data.active_session);
            setHasClockedOutToday(false);
          }
        } catch (_) { }
      }
    };
    checkSession();
    const sessionCheckInterval = setInterval(checkSession, 30000);
    return () => clearInterval(sessionCheckInterval);
  }, [activeSession, user]);

  // Real-time update for today's working hours
  useEffect(() => {
    if (!attendance?.clock_in || attendance?.clock_out) return;

    const updateCurrentHours = () => {
      const clockInStr = attendance.clock_in_ist || attendance.clock_in;
      const currentTimeIST = nowIST();
      const totalMinutes = calculateTotalMinutesFixed(clockInStr, currentTimeIST);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = Math.round(totalMinutes % 60);

      setAttendance(prev => ({
        ...prev,
        total_hours_display: `${hours}h ${minutes}m`,
        total_hours: totalMinutes / 60,
        total_minutes: totalMinutes
      }));

      setAttendanceHistory(prevHistory => {
        const todayStr = formatDateStr(new Date());
        return prevHistory.map(record => {
          if (record.date === todayStr && record.isToday) {
            return {
              ...record,
              total_hours_display: `${hours}h ${minutes}m`,
              total_hours: totalMinutes / 60,
              current_hours_display: `${hours}h ${minutes}m`
            };
          }
          return record;
        });
      });
    };

    const interval = setInterval(updateCurrentHours, 60000);
    return () => clearInterval(interval);
  }, [attendance?.clock_in, attendance?.clock_out]);

  useEffect(() => {
    // Only create virtual session for TODAY's incomplete record
    // AND only if server confirms there's an active session
    if (!missedClockOuts.length || activeSession) return;

    const todayIncomplete = missedClockOuts.find(r =>
      !r.has_clock_out &&
      !r.is_regularized &&
      !r.regularization_requested &&
      r.regularization_status !== 'rejected' &&
      r.is_today === true &&
      r.has_active_session === true  // ✅ Only if server confirms active session
    );

    if (todayIncomplete) {
      const virtualSession = {
        session_id: `virtual-${todayIncomplete.id}-${Date.now()}`,
        clock_in_time: todayIncomplete.clock_in_ist || todayIncomplete.clock_in,
        is_virtual: true,
        attendance_id: todayIncomplete.id,
        attendance_date: todayIncomplete.attendance_date
      };
      setActiveSession(virtualSession);
      saveSessionToStorage(virtualSession);
    }
  }, [missedClockOuts]);

  const handleManualClockOut = async () => {
    setShowExitWarning(false);
    await handleClockOut();
  };

  const handleOpenRegularizationModal = (record) => {
    if (record.clock_out || record.clock_out_ist) {
      setMessage({ type: 'info', text: `Attendance for ${record.attendance_date} already has a clock-out time.` });
      return;
    }
    if (record.is_regularized) {
      setMessage({ type: 'info', text: `Attendance for ${record.attendance_date} has already been regularized.` });
      return;
    }
    if (record.regularization_requested && record.regularization_status !== 'rejected') {
      setMessage({ type: 'warning', text: `Regularization already requested for ${record.attendance_date}. Please wait for approval.` });
      return;
    }

    setSelectedMissedRecord(record);
    const [year, month, day] = record.attendance_date.split('-');
    setRegularizationTime(`${year}-${month}-${day}T18:00`);
    const clockInRaw = record.clock_in_ist || record.clock_in || '';
    if (clockInRaw) {
      const minDT = clockInRaw.includes('T') ? clockInRaw.slice(0, 16) : clockInRaw.replace(' ', 'T').slice(0, 16);
      setRegularizationMinTime(minDT);
    } else {
      setRegularizationMinTime(`${year}-${month}-${day}T00:00`);
    }
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

  // In Attendance.jsx - Replace renderClockButton function

  const renderClockButton = () => {
    const REGULARIZATION_THRESHOLD = 15;
    const currentHours = attendance?.total_hours || 0;

    // ✅ PRIMARY signal: active session from server
    const hasActiveSession = !!activeSession;

    // ✅ FALLBACK: attendance exists with clock_in but no clock_out (cross-midnight safety net)
    const hasOpenAttendance = !!attendance?.clock_in && !attendance?.clock_out;

    // Has employee fully clocked out today?
    const nowISTDateStr = nowIST().split(' ')[0];
    const attendanceIsToday = attendance?.attendance_date === nowISTDateStr;
    const isClockedOut = attendanceIsToday && !!attendance?.clock_in && !!attendance?.clock_out;

    // ✅ Show Clock Out if: active session OR open attendance (no clock_out yet)
    if (hasActiveSession || hasOpenAttendance) {
      // But first check if hours >= 15 for regularization
      if (currentHours >= REGULARIZATION_THRESHOLD) {
        return (
          <div className="text-center">
            <Button
              variant="warning"
              size="lg"
              className="w-100 py-3"
              onClick={() => {
                const pseudoRecord = {
                  id: attendance?.id,
                  attendance_date: attendance?.attendance_date,
                  clock_in: attendance?.clock_in,
                  clock_in_ist: attendance?.clock_in_ist,
                  clock_in_display: attendance?.clock_in_display,
                  has_clock_out: false,
                  is_regularized: false,
                  regularization_requested: false
                };
                handleOpenRegularizationModal(pseudoRecord);
              }}
              disabled={loading || submittingRequest}
            >
              {loading || submittingRequest ? (
                <><Spinner size="sm" animation="border" className="me-2" />Processing...</>
              ) : (
                <><FaRegClock className="me-2" />Request Regularization</>
              )}
            </Button>
            <small className="text-muted d-block mt-2">
              Working {currentHours.toFixed(1)}h — Exceeded {REGULARIZATION_THRESHOLD}h limit
            </small>
          </div>
        );
      }

      return (
        <div className="text-center">
          <Button variant="warning" size="lg" className="w-100 py-3" onClick={handleClockOut} disabled={loading}>
            {loading ? (
              <><Spinner size="sm" animation="border" className="me-2" />Processing...</>
            ) : (
              <><FaSignOutAlt className="me-2" />Clock Out</>
            )}
          </Button>
          {currentHours > 0 && (
            <small className="text-muted d-block mt-2">
              Working: {currentHours.toFixed(1)}h / {REGULARIZATION_THRESHOLD}h limit
            </small>
          )}
        </div>
      );
    }

    // ✅ If clocked out today (attendance today with clock_out) → Show Clock In
    if (isClockedOut || hasClockedOutToday) {
      return (
        <div className="text-center">
          <Button variant="success" size="lg" className="w-100 py-3" onClick={handleClockIn} disabled={loading}>
            {loading ? (
              <><Spinner size="sm" animation="border" className="me-2" />Processing...</>
            ) : (
              <><FaMapMarkerAlt className="me-2" />Clock In</>
            )}
          </Button>
          {isClockedOut && (
            <small className="text-success d-block mt-2">
              You have already clocked out today. You can clock in again for next shift.
            </small>
          )}
        </div>
      );
    }

    // ✅ Check for past date pending regularization (not today, no active session)
    const eligibleRegularization = missedClockOuts.some(r =>
      r.can_regularize === true &&
      !r.is_regularized &&
      r.attendance_date !== nowISTDateStr &&
      (!r.regularization_requested || r.regularization_status === 'rejected')
    );

    if (eligibleRegularization) {
      const eligibleRecord = missedClockOuts.find(r =>
        r.can_regularize === true &&
        !r.is_regularized &&
        r.attendance_date !== nowISTDateStr &&
        (!r.regularization_requested || r.regularization_status === 'rejected')
      );
      return (
        <div className="text-center">
          <Button
            variant="warning"
            size="lg"
            className="w-100 py-3"
            onClick={() => handleOpenRegularizationModal(eligibleRecord)}
            disabled={loading || submittingRequest}
          >
            {loading || submittingRequest ? (
              <><Spinner size="sm" animation="border" className="me-2" />Processing...</>
            ) : (
              <><FaRegClock className="me-2" />Request Regularization for {eligibleRecord?.attendance_date}</>
            )}
          </Button>
          <small className="text-muted d-block mt-2">
            {eligibleRecord?.total_hours_worked}h worked — Regularization required
          </small>
        </div>
      );
    }

    // ✅ DEFAULT: Clock In button
    return (
      <Button variant="success" size="lg" className="w-100 py-3" onClick={handleClockIn} disabled={loading}>
        {loading ? (
          <><Spinner size="sm" animation="border" className="me-2" />Processing...</>
        ) : (
          <><FaMapMarkerAlt className="me-2" />Clock In</>
        )}
      </Button>
    );
  };
  // In Attendance.jsx - Update the initialization useEffect

  useEffect(() => {
    if (!user?.employeeId) return;

    const initializeSession = async () => {
      try {
        const response = await axios.get(API_ENDPOINTS.ATTENDANCE_TODAY(user.employeeId));
        const todayAttendance = response.data.attendance;
        const serverSession = response.data.active_session;

        console.log('🔄 Initializing - Today attendance:', todayAttendance);
        console.log('🔄 Server session:', serverSession);

        // ✅ CASE 1: No active server session
        if (!serverSession) {
          // Only clear session if no open attendance either
          const hasOpenAtt = todayAttendance?.clock_in && !todayAttendance?.clock_out;
          if (!hasOpenAtt) {
            setActiveSession(null);
            clearSessionFromStorage();
          }

          if (todayAttendance?.clock_out) {
            setHasClockedOutToday(true);
            setAttendance(todayAttendance);
          } else if (hasOpenAtt) {
            // Has clock_in but no active session = cross-midnight or data inconsistency
            // Keep showing Clock Out button
            setHasClockedOutToday(false);
            setAttendance(todayAttendance);
            const inferredSession = {
              session_id: todayAttendance.session_id || 'temp-' + Date.now(),
              clock_in_time: todayAttendance.clock_in_ist || todayAttendance.clock_in,
              is_virtual: false
            };
            setActiveSession(inferredSession);
            saveSessionToStorage(inferredSession);
          } else {
            setHasClockedOutToday(false);
            setAttendance(null);
          }
          await fetchMissedClockOuts();
          await fetchTodayAttendance();
          getCurrentLocation();
          return;
        }

        // ✅ CASE 2: Active server session exists (today or cross-midnight)
        setHasClockedOutToday(false);
        setActiveSession(serverSession);
        saveSessionToStorage(serverSession);

      } catch (error) {
        console.error('Error initializing:', error);
        setActiveSession(null);
        clearSessionFromStorage();
        setHasClockedOutToday(false);
      }

      await fetchTodayAttendance();
      await fetchMissedClockOuts();
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
    if (!user?.employeeId) return;
    const interval = setInterval(() => {
      fetchAttendanceHistory();
      fetchMissedClockOuts();
    }, 60000);
    return () => clearInterval(interval);
  }, [user?.employeeId]);

  useEffect(() => {
    if (activeSession && location) {
      const interval = setInterval(sendHeartbeat, 30000);
      setHeartbeatInterval(interval);
      return () => clearInterval(interval);
    }
  }, [activeSession, location]);

  useEffect(() => {
    const handleRegularizationEvent = async () => {
      await fetchTodayAttendance();
      await fetchMissedClockOuts();
      await fetchAttendanceHistory();
      setActiveSession(null);
      clearSessionFromStorage();
      setHasClockedOutToday(false);
    };

    window.addEventListener('regularizationApproved', handleRegularizationEvent);
    return () => window.removeEventListener('regularizationApproved', handleRegularizationEvent);
  }, [user?.employeeId]);

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <h5 className="mb-4 d-flex align-items-center">
        <FaClock className="me-2 text-primary" />
        Attendance Management
      </h5>

      {/* Regularization Requests Section */}
      {missedClockOuts.length > 0 && !activeSession && (
        <>
          {missedClockOuts.some(r => r.can_regularize === true && (!r.regularization_requested || r.regularization_status === 'rejected') && !r.is_regularized) && (
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
                      {missedClockOuts.filter(r => r.can_regularize === true && (!r.regularization_requested || r.regularization_status === 'rejected') && !r.is_regularized).map(record => (
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
                      const firstEligible = missedClockOuts.find(r => r.can_regularize === true && (!r.regularization_requested || r.regularization_status === 'rejected') && !r.is_regularized);
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

      {/* Main Attendance Card */}
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
                    {attendance?.clock_in
                      ? (attendance.clock_in_display || formatTimeIST(attendance.clock_in_ist || attendance.clock_in))
                      : '--:--'}
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
                    {attendance?.clock_out
                      ? (attendance.clock_out_display || formatTimeIST(attendance.clock_out_ist || attendance.clock_out))
                      : '--:--'}
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

      {/* Stats Cards */}
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

      {/* Attendance History */}
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
                        Today: {formatTimeIST(attendance.clock_in_ist || attendance.clock_in)} - {formatTimeIST(attendance.clock_out_ist || attendance.clock_out)}
                      </Badge>
                    ) : (
                      <Badge bg="warning" className="px-3 py-2 text-dark" style={{ fontSize: '0.85rem' }}>
                        <FaClock className="me-1" />
                        Today: Working since {formatTimeIST(attendance.clock_in_ist || attendance.clock_in)}
                        {attendance?.total_hours_display && (
                          <small className="ms-1 text-success">({attendance.total_hours_display})</small>
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
                                  <span className="text-nowrap">
                                    {record.total_hours_display}
                                    {record.clock_in && !record.clock_out && !record.is_regularized && !record.isToday && (
                                      <span className="text-danger ms-1" style={{ fontSize: '10px' }}>(Missed)</span>
                                    )}
                                  </span>
                                ) : record.total_hours ? (
                                  <span className="text-nowrap">
                                    {record.total_hours.toFixed(1)}h
                                    {record.clock_in && !record.clock_out && !record.is_regularized && !record.isToday && (
                                      <span className="text-danger ms-1" style={{ fontSize: '10px' }}>(Missed)</span>
                                    )}
                                  </span>
                                ) : record.clock_in && !record.clock_out && isToday ? (
                                  // Real-time hours for today - FIXED
                                  <span className="text-nowrap text-info">
                                    {record.current_hours_display || calculateCurrentWorkingHours(record.clock_in)?.display || '0h 0m'}
                                  </span>
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

      {/* Modals */}
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
              <div className="mb-3"><label className="form-label fw-semibold">Select Clock Out Time *</label><input type="datetime-local" className="form-control" value={regularizationTime} min={regularizationMinTime} onChange={(e) => setRegularizationTime(e.target.value)} required /><small className="text-muted">Select the time you actually left work on {selectedMissedRecord?.attendance_date}</small></div>
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

      <Modal show={showPreviousDayClockOut.show} onHide={() => setShowPreviousDayClockOut({ show: false, attendance_id: null, attendance_date: null, clock_in_time: null })} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title className="h6">⚠️ Incomplete Attendance Detected</Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p>You have an incomplete attendance record from <strong>{showPreviousDayClockOut.attendance_date}</strong>.</p>
          <p className="text-muted small">Clock In Time: {showPreviousDayClockOut.clock_in_time ? formatTimeIST(showPreviousDayClockOut.clock_in_time) : 'Unknown'}</p>
          <p>Would you like to clock out for that day now?</p>
          <Alert variant="warning" className="small">
            <FaExclamationTriangle className="me-2" />
            If you don't clock out, your attendance for {showPreviousDayClockOut.attendance_date} will remain incomplete.
          </Alert>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="sm" onClick={() => setShowPreviousDayClockOut({ show: false, attendance_id: null, attendance_date: null, clock_in_time: null })}>
            Cancel
          </Button>
          <Button variant="warning" size="sm" onClick={handlePreviousDayClockOut}>
            <FaClock className="me-2" /> Clock Out for {showPreviousDayClockOut.attendance_date}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Attendance;