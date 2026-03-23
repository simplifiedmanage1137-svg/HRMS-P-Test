// src/components/Employee/Attendance.jsx
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
  FaHistory
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

  const STORAGE_KEY = `attendance_session_${user?.employeeId}`;

  const OFFICE_COORDS = {
    name: 'Viman Nagar Office',
    latitude: 18.56835629424307,
    longitude: 73.90856078144989,
    radius: 50
  };

  // Helper function to format time
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

  // Helper function to format short date
  const formatShortDate = (dateString) => {
    if (!dateString) return 'N/A';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  // Format late time in Hours, Minutes, Seconds format - FIXED to show hours when applicable
  const formatLateTime = (lateMinutes) => {
    // Handle null, undefined, or invalid values
    if (!lateMinutes || lateMinutes === 0 || lateMinutes === null || lateMinutes === undefined) {
      return null;
    }
    
    // Parse to number if it's a string
    let minutes = typeof lateMinutes === 'string' ? parseFloat(lateMinutes) : lateMinutes;
    
    // Check if it's a valid number
    if (isNaN(minutes) || minutes <= 0) {
      return null;
    }
    
    // Convert minutes to hours, minutes, seconds
    const totalMinutes = minutes;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);
    
    // Format based on what's available
    if (hours > 0) {
      if (remainingMinutes > 0 && seconds > 0) {
        return `${hours}h ${remainingMinutes}m ${seconds}s`;
      } else if (remainingMinutes > 0) {
        return `${hours}h ${remainingMinutes}m`;
      } else if (seconds > 0) {
        return `${hours}h ${seconds}s`;
      } else {
        return `${hours}h`;
      }
    } else if (remainingMinutes > 0) {
      if (seconds > 0) {
        return `${remainingMinutes}m ${seconds}s`;
      } else {
        return `${remainingMinutes}m`;
      }
    } else {
      return `${seconds}s`;
    }
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

  // Get attendance status badge with late display in Hours/Minutes/Seconds format
  const getAttendanceStatusBadge = (record) => {
    // Weekly off check
    if (record.isWeeklyOff) {
      return <Badge bg="secondary" className="px-2 py-1"><FaMoon className="me-1" size={10} /> W-OFF</Badge>;
    }

    // Not clocked in
    if (!record.clock_in) {
      return <Badge bg="secondary" className="px-2 py-1"><FaClock className="me-1" size={10} /> Not Clocked</Badge>;
    }

    const isLate = record.late_minutes > 0;
    // Get late display from record or format it
    let lateDisplay = record.late_display;
    if (isLate && !lateDisplay) {
      lateDisplay = formatLateTime(record.late_minutes);
    }
    
    // Working (clocked in but not out)
    if (record.clock_in && !record.clock_out) {
      if (isLate) {
        return (
          <Badge bg="danger" className="px-2 py-1 d-inline-flex align-items-center">
            <FaExclamationTriangle className="me-1" size={10} />
            Working {lateDisplay ? `(+${lateDisplay})` : '(Late)'}
          </Badge>
        );
      }
      return <Badge bg="info" className="px-2 py-1"><FaClock className="me-1" size={10} /> Working</Badge>;
    }

    // Present (clocked out)
    if (record.status === 'present') {
      if (isLate) {
        return (
          <Badge bg="danger" className="px-2 py-1 d-inline-flex align-items-center">
            <FaExclamationTriangle className="me-1" size={10} />
            Present {lateDisplay ? `(+${lateDisplay})` : '(Late)'}
          </Badge>
        );
      }
      return <Badge bg="success" className="px-2 py-1"><FaCheckCircle className="me-1" size={10} /> Present</Badge>;
    }

    // Half day
    if (record.status === 'half_day') {
      if (isLate) {
        return (
          <Badge bg="danger" className="px-2 py-1 d-inline-flex align-items-center">
            <FaExclamationTriangle className="me-1" size={10} />
            Half Day {lateDisplay ? `(+${lateDisplay})` : '(Late)'}
          </Badge>
        );
      }
      return <Badge bg="warning" className="text-dark px-2 py-1"><FaCloudSun className="me-1" size={10} /> Half Day</Badge>;
    }

    // Absent
    if (record.status === 'absent') {
      return <Badge bg="danger" className="px-2 py-1"><FaExclamationTriangle className="me-1" size={10} /> Absent</Badge>;
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
        // Ensure late_display is set with proper format
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

  // Generate last 30 days attendance with proper late display
  const generateLast30DaysAttendance = (history) => {
    const completeHistory = [];
    const today = new Date();

    const formatDateStr = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = formatDateStr(today);

    // Create map of existing records
    const historyMap = {};
    history.forEach(record => {
      if (record.attendance_date) {
        let dateKey = record.attendance_date.includes('T') 
          ? record.attendance_date.split('T')[0] 
          : record.attendance_date;
        
        // Ensure late_display is set with proper format
        if (record.late_minutes > 0 && !record.late_display) {
          record.late_display = formatLateTime(record.late_minutes);
        }
        
        historyMap[dateKey] = record;
      }
    });

    // Always use latest attendance state for today
    if (attendance && attendance.attendance_date === todayStr) {
      if (attendance.late_minutes > 0 && !attendance.late_display) {
        attendance.late_display = formatLateTime(attendance.late_minutes);
      }
      historyMap[todayStr] = attendance;
    }

    // Generate 30 days
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
        // Get late minutes and format display
        const lateMinutes = existingRecord.late_minutes || 0;
        let lateDisplay = existingRecord.late_display;
        
        // If late_display not set but late_minutes > 0, format it
        if (lateMinutes > 0 && !lateDisplay) {
          lateDisplay = formatLateTime(lateMinutes);
          console.log(`Formatting late for ${dateStr}: ${lateMinutes} minutes -> ${lateDisplay}`);
        }
        
        let displayStatus = existingRecord.status;
        let totalHoursDisplay = existingRecord.total_hours_display;
        let totalHours = existingRecord.total_hours;
        let clockOut = existingRecord.clock_out;

        // If this is today and user is working, calculate current hours
        if (isToday && existingRecord.clock_in && !existingRecord.clock_out) {
          displayStatus = 'working';
          clockOut = null;
          const clockIn = new Date(existingRecord.clock_in);
          const now = new Date();
          const diffMinutes = (now - clockIn) / (1000 * 60);
          const hours = Math.floor(diffMinutes / 60);
          const minutes = Math.round(diffMinutes % 60);
          totalHoursDisplay = `${hours}h ${minutes}m`;
          totalHours = diffMinutes / 60;
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
          status: displayStatus,
          late_minutes: lateMinutes,
          late_display: lateDisplay
        });
      } else {
        let status = 'not_clocked';
        if (isWeeklyOff) {
          status = 'weekly_off';
        }

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
          status: status,
          late_minutes: 0,
          late_display: null,
          isToday
        });
      }
    }

    // Log late records in final history
    const lateRecords = completeHistory.filter(r => r.late_minutes > 0);
    if (lateRecords.length > 0) {
      console.log('🔴 Late records in final history:', lateRecords.map(r => ({
        date: r.date,
        late_minutes: r.late_minutes,
        late_display: r.late_display
      })));
    }

    return completeHistory.sort((a, b) => b.date.localeCompare(a.date));
  };

  // Calculate monthly statistics
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
        if (record.total_hours) totalHours += parseFloat(record.total_hours);
        if (parseFloat(record.late_minutes) > 0) {
          lateDays++;
          totalLateMinutes += parseFloat(record.late_minutes);
        }
      } else if (record.status === 'half_day') {
        halfDays++;
        workingDaysCount++;
        if (record.total_hours) totalHours += parseFloat(record.total_hours);
        if (parseFloat(record.late_minutes) > 0) {
          lateDays++;
          totalLateMinutes += parseFloat(record.late_minutes);
        }
      } else if (record.status === 'absent') {
        absent++;
      } else if (record.status === 'on_leave') {
        leaves++;
      } else if (record.status === 'working' && parseFloat(record.late_minutes) > 0) {
        // Count working days with late as late days
        lateDays++;
        totalLateMinutes += parseFloat(record.late_minutes);
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

  // Fetch attendance history
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

      const response = await axios.get(
        `${API_ENDPOINTS.ATTENDANCE_REPORT}?start=${formatDate(startDate)}&end=${formatDate(endDate)}&employee_id=${user.employeeId}`
      );

      console.log('📊 Attendance history from API:', response.data.attendance?.length, 'records');
      
      // Log late records for debugging
      const lateRecords = response.data.attendance?.filter(r => r.late_minutes > 0) || [];
      console.log('📊 Late records from API:', lateRecords.map(r => ({
        date: r.attendance_date,
        late_minutes: r.late_minutes,
        late_display: r.late_display
      })));

      let history = response.data.attendance || [];
      const completeHistory = generateLast30DaysAttendance(history);
      
      // Log final history late records
      const finalLateRecords = completeHistory.filter(r => r.late_minutes > 0);
      console.log('📊 Final late records in history:', finalLateRecords.map(r => ({
        date: r.date,
        late_minutes: r.late_minutes,
        late_display: r.late_display
      })));
      
      setAttendanceHistory(completeHistory);
      calculateMonthlyStats(completeHistory);
      updateChartData(completeHistory);
    } catch (error) {
      console.error('Error fetching attendance history:', error);
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
      
      // Set attendance with late info
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

  // Debug effect to log attendance history late records
  useEffect(() => {
    const lateRecords = attendanceHistory.filter(r => r.late_minutes > 0);
    if (lateRecords.length > 0) {
      console.log('🔴 Late records in history:', lateRecords.map(r => ({
        date: r.date,
        late_display: r.late_display,
        late_minutes: r.late_minutes
      })));
    }
  }, [attendanceHistory]);

  return (
    <div className="p-2 p-md-3 p-lg-4" style={{ backgroundColor: '#f8f9fc', minHeight: '100vh' }}>
      <h5 className="mb-4 d-flex align-items-center">
        <FaClock className="me-2 text-primary" />
        Attendance Management
      </h5>

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
                          // Calculate late display for this record in Hours/Minutes/Seconds format
                          const hasLate = record.late_minutes > 0;
                          const lateDisplayText = hasLate ? (record.late_display || formatLateTime(record.late_minutes)) : null;
                          
                          return (
                            <tr
                              key={index}
                              className={`
                                ${record.isWeeklyOff ? 'bg-light' : ''} 
                                ${record.isToday ? 'table-primary fw-bold' : ''}
                                ${hasLate ? 'table-danger' : ''}
                              `}
                            >
                              <td className="small">
                                <div>
                                  <span className="fw-semibold">{formatShortDate(record.date)}</span>
                                  {record.isToday && <Badge bg="primary" className="ms-1" pill>Today</Badge>}
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
                                ) : record.clock_in ? (
                                  <div>
                                    <span className="text-nowrap">{formatTime(record.clock_in)}</span>
                                    {/* Late mark shown below clock-in time in Hours/Minutes/Seconds format */}
                                    {hasLate && lateDisplayText && (
                                      <div className="text-danger small mt-1" style={{ fontSize: '11px', fontWeight: '500' }}>
                                        <FaExclamationTriangle className="me-1" size={10} />
                                        Late by {lateDisplayText}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted">---</span>
                                )}
                              </td>
                              <td className="small">
                                {record.isWeeklyOff ? (
                                  <span className="text-muted">---</span>
                                ) : record.clock_out ? (
                                  <span className="text-nowrap">{formatTime(record.clock_out)}</span>
                                ) : record.clock_in ? (
                                  <Badge bg="info" pill size="sm">Working</Badge>
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
                                  <span className="text-nowrap">{record.total_hours}h</span>
                                ) : record.clock_in ? (
                                  <Badge bg="info" pill size="sm">Active</Badge>
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