// components/Employee/Attendance.jsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Alert, Spinner, Badge,
  Row, Col, Modal, Table, Form, Tabs, Tab
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
  FaSun,
  FaCloudSun,
  FaChartLine,
  FaHistory,
  FaArrowLeft,
  FaArrowRight,
  FaUserCheck,
  FaUserClock
} from 'react-icons/fa';
import axios from 'axios';
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

// Register ChartJS components
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
  const [canClockInToday, setCanClockInToday] = useState(true);
  const [hasClockedOutToday, setHasClockedOutToday] = useState(false);

  // State for attendance reports
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

  const STORAGE_KEY = `attendance_session_${user?.employeeId}`;

  // Weekly off days (0 = Sunday, 6 = Saturday)
  const WEEKLY_OFF_DAYS = [0, 6];

  // Office coordinates
  const OFFICE_COORDS = {
    name: 'Viman Nagar Office',
    address: '8th Floor SkyVista, 805, Mhada Colony, Viman Nagar, Pune 411014',
    latitude: 18.56835629424307,
    longitude: 73.90856078144989,
    radius: 50 // meters
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

  // Check if user has already clocked out today
  const checkTodayStatus = (attendanceData) => {
    if (!attendanceData) return;

    const today = new Date().toDateString();
    const lastClockOut = attendanceData.last_clock_out;

    if (lastClockOut) {
      const lastClockOutDate = new Date(lastClockOut).toDateString();
      if (lastClockOutDate === today) {
        setHasClockedOutToday(true);
      }
    }
  };

  useEffect(() => {
    if (!user?.employeeId) return;

    // Load cached session
    const storedSession = loadSessionFromStorage();
    if (storedSession) {
      setActiveSession(storedSession);
    }

    fetchTodayAttendance();
    fetchAttendanceHistory();
    getCurrentLocation();

    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    // Add beforeunload event listener
    const handleBeforeUnload = (e) => {
      if (activeSession) {
        e.preventDefault();
        e.returnValue = 'You have an active session. Please clock out before leaving.';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(timer);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [user]);

  // Fetch attendance history when component mounts
  useEffect(() => {
    if (user?.employeeId) {
      fetchAttendanceHistory();
    }
  }, [user]);

  // Start heartbeat when active session exists
  useEffect(() => {
    if (activeSession && location) {
      const interval = setInterval(sendHeartbeat, 30000);
      setHeartbeatInterval(interval);

      return () => clearInterval(interval);
    }
  }, [activeSession, location]);

  const getCurrentLocation = () => {
    setLocationLoading(true);
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError('Geolocation is not supported by your browser');
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
          newLocation.latitude,
          newLocation.longitude,
          OFFICE_COORDS.latitude,
          OFFICE_COORDS.longitude
        );

        const isInOffice = distance <= OFFICE_COORDS.radius;

        setGeofenceInfo({
          distance: Math.round(distance * 100) / 100,
          isInOffice,
          requiredRadius: OFFICE_COORDS.radius
        });

        setLocationLoading(false);
      },
      (error) => {
        console.error('❌ Location error:', error);
        let errorMessage = 'Failed to get your location';

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'Please enable location access to mark attendance';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'Location information is unavailable';
            break;
          case error.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        setLocationError(errorMessage);
        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
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

  const fetchTodayAttendance = async () => {
    try {
      console.log('📊 Fetching today attendance for:', user.employeeId);

      const response = await axios.get(
        `http://localhost:5000/api/attendance/today/${user.employeeId}`
      );

      console.log('📊 Today attendance response:', response.data);

      const attendanceData = response.data.attendance;
      const serverSession = response.data.active_session;

      // If we have attendance data, set it
      if (attendanceData) {
        setAttendance(attendanceData);
        checkTodayStatus(attendanceData);
      }

      if (serverSession) {
        console.log('✅ Found active session from server:', serverSession);
        setActiveSession(serverSession);
        saveSessionToStorage(serverSession);
        setHasClockedOutToday(false);
      } else if (attendanceData?.clock_in && !attendanceData?.clock_out) {
        console.log('✅ Inferring session from attendance record');
        const inferredSession = {
          session_id: attendanceData.session_id || 'temp-' + Date.now(),
          clock_in_time: attendanceData.clock_in
        };
        setActiveSession(inferredSession);
        saveSessionToStorage(inferredSession);
        setHasClockedOutToday(false);
      } else {
        console.log('❌ No active session found');
        setActiveSession(null);
        clearSessionFromStorage();
      }

      return attendanceData;
    } catch (error) {
      console.error('Error fetching today attendance:', error);
      return null;
    }
  };

  const fetchAttendanceHistory = async () => {
    try {
      const today = new Date();
      // Create today at START of day in LOCAL timezone
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const endDate = todayStart;
      const startDate = new Date(todayStart);
      startDate.setDate(startDate.getDate() - 30);

      // Format dates as YYYY-MM-DD using local timezone
      const formatLocalDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const startDateStr = formatLocalDate(startDate);
      const endDateStr = formatLocalDate(endDate);
      const todayStr = formatLocalDate(todayStart);

      console.log('📅 Fetching attendance from', startDateStr, 'to', endDateStr);
      console.log('📅 Today is:', todayStr);

      const response = await axios.get(
        `http://localhost:5000/api/attendance/report?start=${startDateStr}&end=${endDateStr}&employee_id=${user.employeeId}`
      );

      console.log('📊 Attendance API Response:', response.data);

      let history = response.data.attendance || [];

      // Log all records to see what we're getting
      console.log('📊 Raw history records:');
      history.forEach(record => {
        console.log(`   - ${record.attendance_date}: clock_in=${record.clock_in ? 'Yes' : 'No'}`);
      });

      // Create a map to ensure each date has only ONE record
      const dateMap = new Map();

      history.forEach(record => {
        if (record.attendance_date) {
          // Extract just the date part
          let dateKey;
          if (record.attendance_date.includes('T')) {
            dateKey = record.attendance_date.split('T')[0];
          } else {
            dateKey = record.attendance_date;
          }

          // Only keep records within our date range
          if (dateKey >= startDateStr && dateKey <= endDateStr) {
            // If we already have a record for this date, keep the one with more data
            if (!dateMap.has(dateKey)) {
              dateMap.set(dateKey, record);
            } else {
              // If existing record has no clock_in but this one does, replace it
              const existing = dateMap.get(dateKey);
              if (!existing.clock_in && record.clock_in) {
                dateMap.set(dateKey, record);
              }
            }
          }
        }
      });

      // Convert map back to array
      let uniqueHistory = Array.from(dateMap.values());

      console.log('📊 Unique history records:');
      uniqueHistory.forEach(record => {
        console.log(`   - ${record.attendance_date}: clock_in=${record.clock_in ? 'Yes' : 'No'}`);
      });

      // Get today's attendance separately
      let todayAttendance = null;
      try {
        const todayResponse = await axios.get(
          `http://localhost:5000/api/attendance/today/${user.employeeId}`
        );
        todayAttendance = todayResponse.data.attendance;
        console.log('📊 Today attendance from separate call:', todayAttendance);
      } catch (todayError) {
        console.log('⚠️ Could not fetch today attendance separately');
      }

      // Merge today's attendance with history - but only if it's actually for today
      if (todayAttendance && todayAttendance.attendance_date) {
        const todayRecordDate = todayAttendance.attendance_date.split('T')[0];

        // Only use today's attendance if it's actually for today
        if (todayRecordDate === todayStr) {
          // Remove any existing record for today
          uniqueHistory = uniqueHistory.filter(record => {
            if (!record.attendance_date) return true;
            const recordDate = record.attendance_date.split('T')[0];
            return recordDate !== todayStr;
          });

          // Add today's attendance
          uniqueHistory.push(todayAttendance);

          console.log('📊 Added today\'s record for date:', todayStr);
        } else {
          console.log('⚠️ Today\'s attendance record has wrong date:', todayRecordDate, 'expected:', todayStr);
        }
      }

      // Generate complete calendar
      const completeHistory = generateLast30DaysAttendance(uniqueHistory, startDate, endDate);

      setAttendanceHistory(completeHistory);
      calculateMonthlyStats(completeHistory);
      updateChartData(completeHistory);

    } catch (error) {
      console.error('❌ Error fetching attendance history:', error);
      // Create empty history
      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const startDate = new Date(todayStart);
      startDate.setDate(startDate.getDate() - 30);
      const emptyHistory = generateLast30DaysAttendance([], startDate, todayStart);
      setAttendanceHistory(emptyHistory);
      calculateMonthlyStats(emptyHistory);
      updateChartData(emptyHistory);
    }
  };

  const generateLast30DaysAttendance = (history, startDate, endDate) => {
    const completeHistory = [];
    const today = new Date();

    // Format today using local date
    const todayYear = today.getFullYear();
    const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
    const todayDay = String(today.getDate()).padStart(2, '0');
    const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;

    console.log('📊 Today is (local):', todayStr);
    console.log('📊 History received:', history.map(h => ({
      date: h.attendance_date,
      clock_in: h.clock_in,
      clock_out: h.clock_out
    })));

    // Create a map of existing records
    const historyMap = {};
    history.forEach(record => {
      if (record.attendance_date) {
        // Extract date part only
        let dateKey;
        if (record.attendance_date.includes('T')) {
          dateKey = record.attendance_date.split('T')[0];
        } else {
          dateKey = record.attendance_date;
        }

        // Check if this record has clock_in but no clock_out (active session)
        const hasActiveSession = record.clock_in && !record.clock_out;

        historyMap[dateKey] = {
          ...record,
          hasActiveSession
        };

        console.log(`📊 Mapped record for ${dateKey}:`, {
          clock_in: record.clock_in,
          clock_out: record.clock_out,
          hasActiveSession
        });
      }
    });

    // Generate 30 days
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);

      // Format date as YYYY-MM-DD
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      const dayOfWeek = date.getDay();

      // Check if this is today
      const isToday = dateStr === todayStr;

      // Check if it's a weekly off day (0 = Sunday, 6 = Saturday)
      const isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;

      // Check if we have a record for this date
      const existingRecord = historyMap[dateStr];

      // Get day name
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

      if (existingRecord) {
        // We have a record for this date - USE THE ACTUAL RECORD
        let displayStatus = existingRecord.status;
        let displayClockOut = existingRecord.clock_out;
        let totalHours = existingRecord.total_hours;

        // If clocked in but not out, show as "Working"
        if (existingRecord.clock_in && !existingRecord.clock_out) {
          displayStatus = 'working';
          displayClockOut = 'Working';

          // Calculate current hours if this is today
          if (isToday && existingRecord.clock_in) {
            const clockIn = new Date(existingRecord.clock_in);
            const now = new Date();
            const currentHours = (now - clockIn) / (1000 * 60 * 60);
            totalHours = currentHours.toFixed(2);
          }
        }

        completeHistory.push({
          ...existingRecord,
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff: false, // If there's a record, it's not a weekly off
          displayDate: formatDate(dateStr),
          dayName: dayName,
          isToday: isToday,
          clock_in: existingRecord.clock_in,
          clock_out: displayClockOut === 'Working' ? null : existingRecord.clock_out,
          display_clock_out: displayClockOut,
          total_hours: totalHours,
          status: displayStatus,
          late_minutes: existingRecord.late_minutes || 0,
          late_display: existingRecord.late_display
        });

        // Log today's record specially
        if (isToday) {
          console.log('📊 TODAY\'S RECORD ADDED:', {
            clock_in: existingRecord.clock_in,
            clock_out: existingRecord.clock_out,
            status: displayStatus
          });
        }
      } else {
        // No record for this date
        let status = 'not_clocked';
        if (isWeeklyOff) {
          status = 'weekly_off';
        }

        completeHistory.push({
          date: dateStr,
          attendance_date: dateStr,
          dayOfWeek,
          isWeeklyOff,
          dayName: dayName,
          clock_in: null,
          clock_out: null,
          total_hours: null,
          status: status,
          late_minutes: 0,
          late_display: null,
          isToday: isToday
        });
      }
    }

    // Sort by date descending (today first)
    const sorted = completeHistory.sort((a, b) => {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });

    // Log the first few records to verify today's data
    console.log('📊 FINAL SORTED HISTORY (first 5):', sorted.slice(0, 5).map(h => ({
      date: h.date,
      isToday: h.isToday,
      clock_in: h.clock_in ? 'Yes' : 'No',
      clock_out: h.clock_out ? 'Yes' : 'No',
      status: h.status
    })));

    return sorted;
  };

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
      }
    });

    setMonthlyStats({
      totalDays: history.length,
      presentDays: present,
      absentDays: absent,
      halfDays: halfDays,
      weeklyOffDays: weeklyOff,
      leaves: leaves,
      totalHours: Math.round(totalHours * 10) / 10,
      averageHours: workingDaysCount > 0 ? Math.round((totalHours / workingDaysCount) * 10) / 10 : 0,
      lateDays: lateDays,
      totalLateMinutes: Math.round(totalLateMinutes * 10) / 10
    });
  };

  const updateChartData = (history) => {
    // Sort by date ascending for chart
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
      datasets: [
        {
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
        }
      ]
    });
  };

  const sendHeartbeat = async () => {
    try {
      if (activeSession && location) {
        await axios.post('http://localhost:5000/api/attendance/heartbeat', {
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

  const handleClockIn = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (!location) {
        throw new Error('Unable to get your location');
      }

      if (!geofenceInfo.isInOffice) {
        throw new Error(
          `You must be within ${OFFICE_COORDS.radius} meters of the office to clock in. ` +
          `You are currently ${geofenceInfo.distance} meters away.`
        );
      }

      const response = await axios.post('http://localhost:5000/api/attendance/clock-in', {
        employee_id: user.employeeId,
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy
      });

      console.log('✅ Clock-in response:', response.data);

      setMessage({
        type: 'success',
        text: response.data.message
      });

      setAttendance(prev => ({
        ...prev,
        clock_in: response.data.clock_in,
        late_minutes: response.data.late_minutes ?? prev?.late_minutes,
        late_display: response.data.late_display ?? prev?.late_display,
        status: response.data.status ?? prev?.status
      }));

      const session = {
        session_id: response.data.session_id,
        clock_in_time: response.data.clock_in
      };
      setActiveSession(session);
      saveSessionToStorage(session);
      setHasClockedOutToday(false);

      // Wait a moment for database to update
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh both today and history data
      await fetchTodayAttendance();
      await fetchAttendanceHistory();

    } catch (error) {
      console.error('Clock-in error:', error);
      setMessage({
        type: 'danger',
        text: error.response?.data?.message || error.message || 'Failed to clock in'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Check if there's an active session
      if (!activeSession) {
        console.log('No active session in state, checking local storage...');

        // Try to load from localStorage
        const storedSession = loadSessionFromStorage();

        if (!storedSession) {
          throw new Error('No active session found. Please clock in first.');
        }

        console.log('Found stored session:', storedSession);
        setActiveSession(storedSession);

        // Continue with the stored session
        const response = await axios.post('http://localhost:5000/api/attendance/clock-out', {
          employee_id: user.employeeId,
          session_id: storedSession.session_id,
          latitude: location?.latitude,
          longitude: location?.longitude,
          accuracy: location?.accuracy
        });

        handleClockOutResponse(response);
        return;
      }

      console.log('Using active session:', activeSession);

      const response = await axios.post('http://localhost:5000/api/attendance/clock-out', {
        employee_id: user.employeeId,
        session_id: activeSession.session_id,
        latitude: location?.latitude,
        longitude: location?.longitude,
        accuracy: location?.accuracy
      });

      handleClockOutResponse(response);

    } catch (error) {
      console.error('Clock-out error:', error);

      // Check if it's the specific "no active session" error
      if (error.response?.data?.error_type === 'NO_ACTIVE_SESSION') {
        // Clear invalid session
        setActiveSession(null);
        clearSessionFromStorage();

        setMessage({
          type: 'warning',
          text: 'Your session has expired. Please clock in again.'
        });
      } else {
        setMessage({
          type: 'danger',
          text: error.response?.data?.message || error.message || 'Failed to clock out'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClockOutResponse = (response) => {
    setMessage({
      type: 'success',
      text: response.data.message
    });

    // Update the main attendance record with the clock-out info
    setAttendance(prev => ({
      ...prev,
      clock_out: response.data.clock_out,  // Set the main clock_out field
      total_hours: response.data.total_hours,
      status: response.data.status,
      // Also keep last session info if needed for history
      last_session: {
        clock_out: response.data.clock_out,
        hours: response.data.total_hours,
        status: response.data.status
      }
    }));

    // Clear the active session so user can clock in again
    setActiveSession(null);
    clearSessionFromStorage();

    // Mark that user has clocked out today
    setHasClockedOutToday(true);

    // Refresh data
    fetchTodayAttendance();
    fetchAttendanceHistory();
  };
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
            At Office ({geofenceInfo.distance}m from center)
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

  const getAttendanceStatusBadge = (record) => {
    if (record.isWeeklyOff) {
      return <Badge bg="secondary"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    }

    if (!record.clock_in) {
      return <Badge bg="secondary"><FaClock className="me-1" size={10} /> Not Clocked</Badge>;
    }

    if (record.clock_in && !record.clock_out) {
      if (record.late_minutes > 0) {
        return (
          <Badge bg="warning" className="text-dark">
            <FaClock className="me-1" size={10} />
            Working (Late {formatLateTime(record.late_minutes)})
          </Badge>
        );
      }
      return <Badge bg="info"><FaClock className="me-1" size={10} /> Working</Badge>;
    }

    switch (record.status) {
      case 'present':
        if (record.late_minutes > 0) {
          return (
            <Badge bg="warning" className="text-dark">
              <FaCheckCircle className="me-1" size={10} />
              Present (Late {formatLateTime(record.late_minutes)})
            </Badge>
          );
        }
        return <Badge bg="success"><FaCheckCircle className="me-1" size={10} /> Present</Badge>;
      case 'half_day':
        if (record.late_minutes > 0) {
          return (
            <Badge bg="warning" className="text-dark">
              <FaCloudSun className="me-1" size={10} />
              Half Day (Late {formatLateTime(record.late_minutes)})
            </Badge>
          );
        }
        return <Badge bg="warning" className="text-dark"><FaCloudSun className="me-1" size={10} /> Half Day</Badge>;
      case 'on_leave':
        return <Badge bg="info"><FaSun className="me-1" size={10} /> Leave</Badge>;
      case 'absent':
        return <Badge bg="danger"><FaExclamationTriangle className="me-1" size={10} /> Absent</Badge>;
      case 'working':
        return <Badge bg="info"><FaClock className="me-1" size={10} /> Working</Badge>;
      default:
        return <Badge bg="secondary">Not Clocked</Badge>;
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

  const formatTime = (datetime) => {
    if (!datetime) return '--:--';
    try {
      return new Date(datetime).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch (error) {
      console.error('Error formatting time:', error);
      return '--:--';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';

    // Parse the date string (YYYY-MM-DD) and create date in local timezone
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatShortDate = (dateString) => {
    if (!dateString) return 'N/A';

    // Parse the date string (YYYY-MM-DD) and create date in local timezone
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getMonthName = (month) => {
    return new Date(2000, month - 1, 1).toLocaleString('default', { month: 'long' });
  };
  // Add this function after handleClockOutResponse
  const handleManualClockOut = async () => {
    setShowExitWarning(false);
    await handleClockOut();
  };

  // Determine which button to show
  const renderClockButton = () => {
    // If user has already clocked out today, show disabled Clock Out button
    if (hasClockedOutToday && !activeSession) {
      return (
        <Button
          variant="secondary"
          size="lg"
          className="w-100 py-2"
          disabled
          style={{ opacity: 0.6, fontSize: '0.09rem' }}
        >
          <FaSignOutAlt className="me-2" />
          Clock Out (Completed for Today)
        </Button>
      );
    }

    // If there's an active session, show Clock Out button
    if (activeSession) {
      return (
        <Button
          variant="warning"
          size="lg"
          className="w-100 py-3"
          onClick={handleClockOut}
          disabled={loading}
        >
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

    // Default - show Clock In button
    return (
      <Button
        variant="success"
        size="lg"
        className="w-100 py-3"
        onClick={handleClockIn}
        disabled={loading || !geofenceInfo?.isInOffice || locationLoading}
      >
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

  return (
    <div className="attendance-page p-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <h5 className="mb-4">
        <FaClock className="me-2 text-primary" />
        Attendance Management
      </h5>

      {/* Compact Current Status Card */}
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Body className="p-3">
          <Row className="align-items-center g-3">
            {/* Location Info - Compact */}
            <Col md={3}>
              <div className="d-flex align-items-center">
                {getLocationBadge()}
              </div>
              {geofenceInfo && (
                <small className="text-muted d-block mt-1">
                  <FaMapMarkerAlt className="me-1" size={10} />
                  Accuracy: ±{Math.round(location?.accuracy || 0)}m
                </small>
              )}
            </Col>

            {/* Time Display - Compact */}
            <Col md={3}>
              <div className="d-flex align-items-center justify-content-center">
                <div className="text-center">
                  <small className="text-muted d-block">Current Time</small>
                  <strong>{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
              </div>
            </Col>

            {/* Clock In/Out Times - Compact */}
            <Col md={3}>
              <Row className="g-2">
                <Col xs={6} className="text-center">
                  <small className="text-muted d-block">Clock In</small>
                  <strong className={attendance?.clock_in ? 'text-success' : 'text-muted'}>
                    {attendance?.clock_in ? formatTime(attendance.clock_in) : '--:--'}
                  </strong>
                  {attendance?.late_display && (
                    <small className="text-danger d-block" style={{ fontSize: '10px' }}>
                      Late {attendance.late_display}
                    </small>
                  )}
                </Col>
                <Col xs={6} className="text-center">
                  <small className="text-muted d-block">Clock Out</small>
                  <strong className={attendance?.clock_out ? 'text-warning' : 'text-muted'}>
                    {attendance?.clock_out ? formatTime(attendance.clock_out) : '--:--'}
                  </strong>
                  {attendance?.total_hours && (
                    <small className="text-success d-block" style={{ fontSize: '10px' }}>
                      {attendance.total_hours}h
                    </small>
                  )}
                </Col>
              </Row>
            </Col>

            {/* Single Button - Changes based on state */}
            <Col md={3}>
              <div className="d-flex justify-content-end">
                {renderClockButton()}
              </div>
            </Col>
          </Row>

          {/* Active Session Indicator */}
          {activeSession && (
            <div className="mt-2 text-success small text-center">
              <FaClock className="me-1" />
              Active since {formatTime(activeSession.clock_in_time)}
            </div>
          )}

          {/* Warning for outside office */}
          {geofenceInfo && !geofenceInfo.isInOffice && !activeSession && (
            <div className="mt-2 text-warning small text-center">
              <FaExclamationTriangle className="me-1" />
              You are {geofenceInfo.distance}m away from office. Need to be within {OFFICE_COORDS.radius}m to clock in.
            </div>
          )}

          {/* Success/Error Messages */}
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

      {/* Attendance Reports - Full Width */}
      <Row>
        <Col lg={12}>
          <Card className="border-0 shadow-sm">
            <Card.Header className="bg-white py-3">
              <div className="d-flex justify-content-between align-items-center">
                <h6 className="mb-0">
                  <FaHistory className="me-2 text-primary" />
                  Attendance Report - Last 30 Days
                </h6>
                <div className="d-flex align-items-center gap-2">
                  {/* Today's Status Badge - Detailed */}
                  {attendance?.clock_in ? (
                    attendance?.clock_out ? (
                      <Badge bg="success" className="px-3 py-2" style={{ fontSize: '0.85rem' }}>
                        <FaCheckCircle className="me-1" />
                        Today: {formatTime(attendance.clock_in)} - {formatTime(attendance.clock_out)} ({attendance.total_hours}h)
                      </Badge>
                    ) : (
                      <Badge bg="warning" className="px-3 py-2 text-dark" style={{ fontSize: '0.85rem' }}>
                        <FaClock className="me-1" />
                        Today: Working since {formatTime(attendance.clock_in)}
                        {attendance?.late_display && (
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

                  {/* Date Badge */}
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
            <Card.Body>
              <Tabs
                activeKey={activeTab}
                onSelect={(k) => setActiveTab(k)}
                className="mb-3"
              >
                <Tab eventKey="daily" title="Daily View">
                  <div className="table-responsive" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <Table hover size="sm" className="mb-0">
                      <thead className="bg-light sticky-top" style={{ top: 0, zIndex: 10 }}>
                        <tr>
                          <th className="small">Date</th>
                          <th className="small">Day</th>
                          <th className="small">Clock In</th>
                          <th className="small">Clock Out</th>
                          <th className="small">Hours</th>
                          <th className="small">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceHistory.map((record, index) => (
                          <tr
                            key={index}
                            className={`
                              ${record.isWeeklyOff ? 'bg-light' : ''} 
                              ${record.isToday ? 'table-primary fw-bold' : ''}
                            `}
                          >
                            <td className="small fw-semibold">
                              {formatShortDate(record.date)}
                              {record.isToday && <Badge bg="primary" className="ms-1" pill>Today</Badge>}
                            </td>
                            <td className="small">
                              {record.dayName}
                              {record.isWeeklyOff && <Badge bg="secondary" className="ms-1" pill>OFF</Badge>}
                            </td>
                            <td className="small">
                              {record.isWeeklyOff ? (
                                <span className="text-muted">-</span>
                              ) : record.clock_in ? (
                                <>
                                  {formatTime(record.clock_in)}
                                  {record.late_minutes > 0 && (
                                    <small className="text-danger d-block" style={{ fontSize: '9px' }}>
                                      ⏰ Late {formatLateTime(record.late_minutes)}
                                    </small>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted">--:--</span>
                              )}
                            </td>
                            <td className="small">
                              {record.isWeeklyOff ? (
                                <span className="text-muted">-</span>
                              ) : record.display_clock_out === 'Working' ? (
                                <Badge bg="info" pill size="sm">Working</Badge>
                              ) : record.clock_out ? (
                                formatTime(record.clock_out)
                              ) : record.clock_in ? (
                                <Badge bg="info" pill size="sm">Working</Badge>
                              ) : (
                                <span className="text-muted">--:--</span>
                              )}
                            </td>
                            <td className="small fw-bold">
                              {record.isWeeklyOff ? (
                                <span className="text-muted">-</span>
                              ) : record.total_hours ? (
                                record.total_hours + 'h'
                              ) : record.clock_in ? (
                                <Badge bg="info" pill size="sm">Active</Badge>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="small">{getAttendanceStatusBadge(record)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                  <div className="mt-2 text-muted small">
                    <FaInfoCircle className="me-1" size={10} />
                    Showing last 30 days from {formatShortDate(attendanceHistory[attendanceHistory.length - 1]?.date)} to {formatShortDate(attendanceHistory[0]?.date)}
                  </div>
                </Tab>

                <Tab eventKey="chart" title="Chart View">
                  <div style={{ height: '400px' }}>
                    <Line
                      data={chartData}
                      options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                          legend: {
                            display: false
                          },
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
                    <span><span style={{ color: 'rgb(220, 53, 69)' }}>●</span> Absent ({"<"}5 hrs)</span>
                  </div>
                </Tab>
              </Tabs>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Exit Warning Modal */}
      <Modal show={showExitWarning} onHide={() => setShowExitWarning(false)} centered>
        <Modal.Header closeButton className="bg-warning">
          <Modal.Title>⚠️ Active Session Detected</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>You have an active session. Would you like to clock out before leaving?</p>
          <p className="text-muted small">If you don't clock out, your attendance will not be recorded properly.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowExitWarning(false)}>
            Cancel
          </Button>
          <Button variant="warning" onClick={handleManualClockOut}>  {/* This function is missing */}
            <FaSignOutAlt className="me-2" />
            Clock Out Now
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Attendance;