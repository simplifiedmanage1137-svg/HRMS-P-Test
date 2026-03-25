const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { holidays } = require('../data/holidays');

// Generate unique session ID
const generateSessionId = () => {
    return uuidv4();
};

// Helper function to calculate time difference in minutes
const calculateTimeDifferenceInMinutes = (date1, date2) => {
    const diffMs = Math.abs(date2 - date1);
    const diffMinutes = diffMs / (1000 * 60);
    return diffMinutes;
};

// Helper function to parse time string
const parseTimeString = (timeStr) => {
    if (!timeStr) return null;
    const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1]);
        const minute = parseInt(ampmMatch[2]);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        return { hour, minute };
    }
    const militaryMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        return { hour: parseInt(militaryMatch[1]), minute: parseInt(militaryMatch[2]) };
    }
    return { hour: 9, minute: 0 };
};

// Parse shift timing
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

// Calculate overtime
const calculateOvertime = (totalHours, shiftHours) => {
    const standardShiftHours = shiftHours || 9;
    const overtimeHours = Math.floor(Math.max(0, totalHours - standardShiftHours));
    return {
        overtimeHours,
        overtimeMinutes: overtimeHours * 60,
        hasOvertime: overtimeHours > 0,
        overtimeAmount: overtimeHours * 150
    };
};

// Local datetime parser
const parseLocalDateTime = (datetime) => {
    if (!datetime) return null;
    if (datetime instanceof Date) return datetime;
    let value = String(datetime).trim();
    if (value === '') return null;
    const localString = value.replace(' ', 'T');
    let parsed = new Date(localString);
    if (isNaN(parsed.getTime())) {
        const [datePart, timePart] = localString.split('T');
        if (datePart && timePart) {
            const [year, month, day] = datePart.split('-').map(Number);
            const [hour, minute, second] = timePart.split(':').map((x, idx) => Number(x) || (idx === 2 ? 0 : 0));
            parsed = new Date(year, month - 1, day, hour || 0, minute || 0, second || 0);
        }
    }
    return parsed;
};

// Check if a date is a holiday
const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return { isHoliday: true, type: 'weekly_off', name: dayOfWeek === 0 ? 'Sunday' : 'Saturday' };
    }
    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
        return { isHoliday: true, type: 'public_holiday', name: holiday.name, region: holiday.region };
    }
    return { isHoliday: false };
};

// Format late time for display
const formatLateTime = (lateMinutes) => {
    if (!lateMinutes || lateMinutes <= 0) return null;
    const totalMinutes = lateMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);
    if (hours > 0) {
        if (remainingMinutes > 0 && seconds > 0) return `${hours}h ${remainingMinutes}m ${seconds}s`;
        if (remainingMinutes > 0) return `${hours}h ${remainingMinutes}m`;
        if (seconds > 0) return `${hours}h ${seconds}s`;
        return `${hours}h`;
    }
    if (remainingMinutes > 0) {
        if (seconds > 0) return `${remainingMinutes}m ${seconds}s`;
        return `${remainingMinutes}m`;
    }
    return `${seconds}s`;
};

// Auto-close stale sessions
exports.autoCloseStaleSessions = async () => {
    try {
        console.log('🕐 Running auto-close stale sessions check...');
        const cutoffTime = new Date();
        cutoffTime.setHours(cutoffTime.getHours() - 24);
        const { data: staleSessions, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('*, employees(shift_timing)')
            .eq('is_active', true)
            .lt('clock_in_time', cutoffTime.toISOString());
        if (sessionError) throw sessionError;
        let closedCount = 0;
        for (const session of staleSessions || []) {
            const { data: attendanceRecords } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', session.employee_id)
                .eq('session_id', session.session_id)
                .is('clock_out', null);
            if (attendanceRecords && attendanceRecords.length > 0) {
                const attendance = attendanceRecords[0];
                const clockInTime = new Date(attendance.clock_in);
                const shiftTiming = parseShiftTiming(session.employees?.shift_timing);
                const shiftEndTime = new Date(clockInTime);
                shiftEndTime.setHours(shiftTiming.endHour, shiftTiming.endMinute, 0, 0);
                let autoClockOutTime = shiftEndTime;
                if (autoClockOutTime > new Date()) {
                    autoClockOutTime = new Date(clockInTime);
                    autoClockOutTime.setHours(autoClockOutTime.getHours() + 24);
                }
                const totalMinutes = calculateTimeDifferenceInMinutes(clockInTime, autoClockOutTime);
                const totalHours = totalMinutes / 60;
                let status = 'half_day';
                if (totalMinutes >= 480) status = 'present';
                else if (totalMinutes < 240) status = 'absent';
                await supabase
                    .from('attendance')
                    .update({
                        clock_out: autoClockOutTime.toISOString(),
                        total_hours: Math.round(totalHours * 100) / 100,
                        total_minutes: Math.round(totalMinutes),
                        status: status,
                        auto_closed: true
                    })
                    .eq('id', attendance.id);
                await supabase
                    .from('attendance_sessions')
                    .update({ is_active: false, clock_out_time: autoClockOutTime.toISOString() })
                    .eq('id', session.id);
                closedCount++;
            }
        }
        return { success: true, closedCount };
    } catch (error) {
        console.error('Error auto-closing stale sessions:', error);
        return { success: false, error: error.message };
    }
};

// Clock In function
exports.clockIn = async (req, res) => {
    try {
        const { employee_id, latitude, longitude, accuracy } = req.body;
        if (!employee_id) {
            return res.status(400).json({ success: false, message: 'Employee ID is required' });
        }
        const { data: employees } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employee_id);
        if (!employees || employees.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        const emp = employees[0];
        const { data: activeSessions } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('is_active', true);
        if (activeSessions && activeSessions.length > 0) {
            const activeSession = activeSessions[0];
            const sessionDate = new Date(activeSession.clock_in_time);
            const today = new Date();
            if (sessionDate.toISOString().split('T')[0] !== today.toISOString().split('T')[0]) {
                const { data: attendanceRecords } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('session_id', activeSession.session_id)
                    .is('clock_out', null);
                if (attendanceRecords && attendanceRecords.length > 0) {
                    const attendance = attendanceRecords[0];
                    const clockInTime = new Date(attendance.clock_in);
                    const autoCloseTime = new Date(clockInTime);
                    autoCloseTime.setHours(23, 59, 59, 999);
                    const totalMinutes = calculateTimeDifferenceInMinutes(clockInTime, autoCloseTime);
                    const totalHours = totalMinutes / 60;
                    await supabase
                        .from('attendance')
                        .update({
                            clock_out: autoCloseTime.toISOString(),
                            total_hours: Math.round(totalHours * 100) / 100,
                            total_minutes: Math.round(totalMinutes),
                            status: totalMinutes >= 480 ? 'present' : 'half_day',
                            auto_closed: true
                        })
                        .eq('id', attendance.id);
                }
                await supabase
                    .from('attendance_sessions')
                    .update({ is_active: false, clock_out_time: new Date().toISOString() })
                    .eq('id', activeSession.id);
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'You have already clocked in today. Please clock out first.'
                });
            }
        }
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;
        const sessionId = generateSessionId();
        const holidayCheck = isHoliday(now);
        let shiftHour = 9, shiftMinute = 0;
        let shiftDisplay = emp.shift_timing || '9:00 AM';
        if (emp.shift_timing) {
            let startTimeStr = emp.shift_timing;
            if (startTimeStr.includes('-')) {
                startTimeStr = startTimeStr.split('-')[0].trim();
            }
            const timeMatch = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (timeMatch) {
                let hour = parseInt(timeMatch[1]);
                const minute = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toUpperCase();
                if (ampm === 'PM' && hour !== 12) hour += 12;
                if (ampm === 'AM' && hour === 12) hour = 0;
                shiftHour = hour;
                shiftMinute = minute;
            }
        }
        const shiftStartTime = new Date(year, now.getMonth(), now.getDate(), shiftHour, shiftMinute, 0, 0);
        const diffMs = now - shiftStartTime;
        const isLate = diffMs > 0;
        const isEarly = diffMs < 0;
        let lateMinutes = 0, earlyMinutes = 0;
        if (isLate) lateMinutes = diffMs / (1000 * 60);
        else if (isEarly) earlyMinutes = Math.abs(diffMs) / (1000 * 60);
        let lateDisplay = null;
        if (isLate) {
            const totalSeconds = Math.floor(lateMinutes * 60);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            if (minutes === 0) lateDisplay = `${seconds}s`;
            else if (seconds === 0) lateDisplay = `${minutes}m`;
            else lateDisplay = `${minutes}m ${seconds}s`;
        }
        const lateMinutesToSave = isLate ? parseFloat(lateMinutes.toFixed(2)) : 0;
        const earlyMinutesToSave = isEarly ? parseFloat(earlyMinutes.toFixed(2)) : 0;
        const { data: existingAttendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('attendance_date', today)
            .limit(1);
        if (existingAttendance && existingAttendance.length > 0) {
            if (existingAttendance[0].clock_in && !existingAttendance[0].clock_out) {
                return res.status(400).json({
                    success: false,
                    message: 'You have an incomplete attendance record from today. Please clock out or request regularization.',
                    has_missed_clockout: true,
                    attendance_id: existingAttendance[0].id
                });
            }
            return res.status(400).json({ success: false, message: 'You have already clocked in today' });
        }
        await supabase.from('attendance').insert([{
            employee_id, attendance_date: today, clock_in: now.toISOString(),
            late_minutes: lateMinutesToSave, early_minutes: earlyMinutesToSave,
            latitude, longitude, location_accuracy: accuracy, session_id: sessionId,
            shift_time_used: shiftDisplay, is_holiday: holidayCheck.isHoliday,
            holiday_name: holidayCheck.name || null
        }]);
        await supabase.from('attendance_sessions').insert([{
            employee_id, session_id: sessionId, clock_in_time: now.toISOString(),
            last_heartbeat: now.toISOString(), is_active: true, latitude, longitude,
            location_accuracy: accuracy
        }]);
        let message = '✅ Clocked in on time';
        if (isLate) message = `⚠️ Clocked in (${lateDisplay} late)`;
        else if (isEarly) message = `⏰ Clocked in (${Math.floor(earlyMinutes)}m early)`;
        const response = {
            success: true, message, clock_in: now, shift_time: shiftDisplay,
            shift_start: `${shiftHour.toString().padStart(2, '0')}:${shiftMinute.toString().padStart(2, '0')}`,
            is_late: isLate, is_early: isEarly, session_id: sessionId,
            employee_name: `${emp.first_name} ${emp.last_name}`, attendance_date: today,
            is_holiday: holidayCheck.isHoliday
        };
        if (isLate) {
            response.late_minutes = lateMinutesToSave;
            response.late_display = lateDisplay;
        }
        res.json(response);
    } catch (error) {
        console.error('❌ Clock-in error:', error);
        res.status(500).json({ success: false, message: 'Failed to clock in', error: error.message });
    }
};

// In attendanceController.js - Fix the clockOut function
exports.clockOut = async (req, res) => {
    try {
        console.log('='.repeat(70));
        console.log('📍 CLOCK-OUT REQUEST');
        console.log('Time:', new Date().toISOString());
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { employee_id, session_id, latitude, longitude, accuracy } = req.body;

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        if (!session_id) {
            return res.status(400).json({
                success: false,
                message: 'Session ID is required. Please clock in first.'
            });
        }

        const now = new Date();
        const today = now.toISOString().split('T')[0];
        const holidayCheck = isHoliday(now);

        console.log(`🔍 Looking for active session: ${session_id} for employee: ${employee_id}`);

        // 1. First, find the active session
        const { data: activeSessions, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('session_id', session_id)
            .eq('employee_id', employee_id)
            .eq('is_active', true);

        if (sessionError) {
            console.error('❌ Session query error:', sessionError);
            throw sessionError;
        }

        console.log(`Found ${activeSessions?.length || 0} active sessions`);

        let session;
        let attendanceRecord;

        if (!activeSessions || activeSessions.length === 0) {
            // Try to find by employee_id only as fallback
            console.log('⚠️ No session found with given session_id, trying fallback...');

            const { data: fallbackSessions, error: fallbackError } = await supabase
                .from('attendance_sessions')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('is_active', true)
                .order('clock_in_time', { ascending: false })
                .limit(1);

            if (fallbackError) {
                console.error('❌ Fallback session error:', fallbackError);
                throw fallbackError;
            }

            if (!fallbackSessions || fallbackSessions.length === 0) {
                console.log('❌ No active session found for employee:', employee_id);
                return res.status(400).json({
                    success: false,
                    message: 'No active clock-in session found. Please clock in first.',
                    error_type: 'NO_ACTIVE_SESSION'
                });
            }

            console.log('✅ Using fallback session:', fallbackSessions[0].session_id);
            session = fallbackSessions[0];

            // Find attendance record for this session
            const { data: attendanceRecords, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('session_id', session.session_id)
                .is('clock_out', null)
                .order('clock_in', { ascending: false })
                .limit(1);

            if (attendanceError) {
                console.error('❌ Attendance record error:', attendanceError);
                throw attendanceError;
            }

            if (!attendanceRecords || attendanceRecords.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No matching attendance record found for the active session.'
                });
            }

            attendanceRecord = attendanceRecords[0];
        } else {
            session = activeSessions[0];
            console.log('✅ Found active session:', session.session_id);

            // Find the corresponding attendance record
            const { data: attendanceRecords, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('session_id', session_id)
                .is('clock_out', null)
                .order('clock_in', { ascending: false })
                .limit(1);

            if (attendanceError) {
                console.error('❌ Attendance record error:', attendanceError);
                throw attendanceError;
            }

            if (!attendanceRecords || attendanceRecords.length === 0) {
                // Try without session_id filter as fallback
                console.log('⚠️ No attendance record with session_id, trying fallback...');

                const { data: fallbackAttendance, error: fallbackError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .is('clock_out', null)
                    .order('clock_in', { ascending: false })
                    .limit(1);

                if (fallbackError) {
                    console.error('❌ Fallback attendance error:', fallbackError);
                    throw fallbackError;
                }

                if (!fallbackAttendance || fallbackAttendance.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No matching attendance record found for this session.'
                    });
                }

                attendanceRecord = fallbackAttendance[0];
                console.log('✅ Found fallback attendance record:', attendanceRecord.id);
            } else {
                attendanceRecord = attendanceRecords[0];
            }
        }

        console.log('✅ Found attendance record:', {
            id: attendanceRecord.id,
            clock_in: attendanceRecord.clock_in,
            attendance_date: attendanceRecord.attendance_date
        });

        // Calculate exact hours with minutes precision
        const clockIn = new Date(attendanceRecord.clock_in);
        const diffMs = now - clockIn;
        const totalMinutes = diffMs / (1000 * 60);
        const totalHours = totalMinutes / 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        const totalHoursDisplay = `${hours}h ${minutes}m`;

        console.log(`📊 Hours calculated: ${totalHours.toFixed(2)} hours (${totalMinutes.toFixed(0)} minutes)`);
        console.log(`   Clock In: ${clockIn.toLocaleTimeString()}`);
        console.log(`   Clock Out: ${now.toLocaleTimeString()}`);
        console.log(`   Difference: ${hours}h ${minutes}m`);

        // Get employee shift timing to calculate overtime
        const { data: employee, error: empError } = await supabase
            .from('employees')
            .select('shift_timing')
            .eq('employee_id', employee_id)
            .single();

        if (empError) {
            console.error('❌ Employee fetch error:', empError);
            // Continue with default shift timing
        }

        const shiftTiming = parseShiftTiming(employee?.shift_timing);
        const shiftHours = shiftTiming.totalHours || 9;
        const overtime = calculateOvertime(totalHours, shiftHours);

        // Determine status based on total minutes
        let status = 'present';
        if (totalMinutes < 240) { // Less than 4 hours
            status = 'absent';
        } else if (totalMinutes < 480) { // Less than 8 hours but >= 4 hours
            status = 'half_day';
        }

        // Prepare update data
        const updateData = {
            clock_out: now.toISOString(),
            total_hours: Math.round(totalHours * 100) / 100,
            total_minutes: Math.round(totalMinutes),
            total_hours_display: totalHoursDisplay,
            status: status,
            latitude: latitude || attendanceRecord.latitude,
            longitude: longitude || attendanceRecord.longitude,
            location_accuracy: accuracy || attendanceRecord.location_accuracy,
            is_holiday: holidayCheck.isHoliday || false,
            holiday_name: holidayCheck.name || null,
            overtime_minutes: overtime.overtimeMinutes || 0,
            overtime_hours: overtime.overtimeHours || 0,
            overtime_amount: overtime.overtimeAmount || 0
        };

        console.log('📝 Updating attendance with:', updateData);

        // Update attendance record
        const { error: updateAttendanceError } = await supabase
            .from('attendance')
            .update(updateData)
            .eq('id', attendanceRecord.id);

        if (updateAttendanceError) {
            console.error('❌ Update attendance error:', updateAttendanceError);
            throw updateAttendanceError;
        }

        // Deactivate session
        const { error: updateSessionError } = await supabase
            .from('attendance_sessions')
            .update({
                is_active: false,
                clock_out_time: now.toISOString()
            })
            .eq('id', session.id);

        if (updateSessionError) {
            console.error('❌ Update session error:', updateSessionError);
            throw updateSessionError;
        }

        console.log('✅ Clock-out successful');

        res.json({
            success: true,
            message: `✅ Clocked out successfully. Total hours: ${totalHoursDisplay}`,
            clock_out: now,
            total_hours: Math.round(totalHours * 100) / 100,
            total_minutes: Math.round(totalMinutes),
            total_hours_display: totalHoursDisplay,
            status,
            session_id: session.session_id,
            overtime: overtime
        });

    } catch (error) {
        console.error('❌ Clock-out error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error details:', error.details || error.hint || 'No details');

        res.status(500).json({
            success: false,
            message: 'Failed to clock out',
            error: error.message,
            error_type: 'SERVER_ERROR',
            details: error.details || error.hint
        });
    }
};

// Get today's attendance
exports.getTodayAttendance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        if (!employee_id) return res.status(400).json({ success: false, message: 'Employee ID is required' });
        const now = new Date();
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const { data: employees } = await supabase.from('employees').select('*').eq('employee_id', employee_id);
        if (!employees || employees.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found' });
        }
        const { data: todayAttendance } = await supabase
            .from('attendance')
            .select('*, employees!inner(first_name, last_name, shift_timing, comp_off_balance)')
            .eq('employee_id', employee_id)
            .eq('attendance_date', todayStr)
            .order('clock_in', { ascending: false })
            .limit(1);
        const { data: activeSession } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('is_active', true);
        let formattedAttendance = null;
        if (todayAttendance && todayAttendance.length > 0) {
            formattedAttendance = { ...todayAttendance[0] };
            if (formattedAttendance.employees) {
                formattedAttendance.first_name = formattedAttendance.employees.first_name;
                formattedAttendance.last_name = formattedAttendance.employees.last_name;
                formattedAttendance.shift_timing = formattedAttendance.employees.shift_timing;
                delete formattedAttendance.employees;
            }
            if (formattedAttendance.late_minutes > 0) {
                formattedAttendance.late_display = formatLateTime(formattedAttendance.late_minutes);
            }
            if (formattedAttendance.clock_in && !formattedAttendance.clock_out) {
                const clockIn = new Date(formattedAttendance.clock_in);
                const nowDate = new Date();
                const diffMinutes = (nowDate - clockIn) / (1000 * 60);
                const hours = Math.floor(diffMinutes / 60);
                const minutes = Math.round(diffMinutes % 60);
                formattedAttendance.total_hours_display = `${hours}h ${minutes}m`;
            } else if (formattedAttendance.total_minutes) {
                const minutes = formattedAttendance.total_minutes;
                formattedAttendance.total_hours_display = `${Math.floor(minutes / 60)}h ${Math.round(minutes % 60)}m`;
            }
        }
        res.json({
            success: true,
            attendance: formattedAttendance,
            active_session: activeSession && activeSession.length > 0 ? activeSession[0] : null,
            has_active_session: activeSession && activeSession.length > 0,
            today_date: todayStr
        });
    } catch (error) {
        console.error('❌ Error in getTodayAttendance:', error);
        res.status(500).json({ success: false, message: 'Failed to get attendance', error: error.message });
    }
};

// Get attendance report
exports.getAttendanceReport = async (req, res) => {
    try {
        const { start, end, employee_id } = req.query;
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Start and end dates are required' });
        }
        let query = supabase
            .from('attendance')
            .select('*, employees(first_name, last_name, department, shift_timing, comp_off_balance)')
            .gte('attendance_date', start)
            .lte('attendance_date', end);
        if (employee_id) query = query.eq('employee_id', employee_id);
        query = query.order('attendance_date', { ascending: false });
        const { data: attendance, error: attendanceError } = await query;
        if (attendanceError) throw attendanceError;
        const formattedAttendance = (attendance || []).map(record => {
            const employee = record.employees || {};
            let totalHoursDisplay = '0h 0m';
            if (record.total_minutes) {
                totalHoursDisplay = `${Math.floor(record.total_minutes / 60)}h ${Math.round(record.total_minutes % 60)}m`;
            } else if (record.total_hours) {
                const totalMinutes = record.total_hours * 60;
                totalHoursDisplay = `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`;
            }
            let lateDisplay = null;
            if (record.late_minutes && record.late_minutes > 0) {
                lateDisplay = formatLateTime(parseFloat(record.late_minutes));
            }
            return {
                id: record.id, employee_id: record.employee_id, attendance_date: record.attendance_date,
                clock_in: record.clock_in, clock_out: record.clock_out,
                total_hours: record.total_hours, total_minutes: record.total_minutes,
                total_hours_display: totalHoursDisplay, status: record.status,
                late_minutes: record.late_minutes ? parseFloat(record.late_minutes) : null,
                late_display: lateDisplay, early_minutes: record.early_minutes,
                shift_time_used: record.shift_time_used, is_holiday: record.is_holiday,
                holiday_name: record.holiday_name, comp_off_awarded: record.comp_off_awarded,
                comp_off_days: record.comp_off_days, is_regularized: record.is_regularized || false,
                first_name: employee.first_name || '', last_name: employee.last_name || '',
                department: employee.department || ''
            };
        });
        let totalWorkingMinutes = 0;
        formattedAttendance.forEach(a => {
            if (a.total_minutes) totalWorkingMinutes += a.total_minutes;
            else if (a.total_hours) totalWorkingMinutes += a.total_hours * 60;
        });
        res.json({
            success: true,
            attendance: formattedAttendance,
            stats: {
                total: formattedAttendance.length,
                present: formattedAttendance.filter(a => a.status === 'present').length,
                half_day: formattedAttendance.filter(a => a.status === 'half_day').length,
                absent: formattedAttendance.filter(a => a.status === 'absent').length,
                total_working_minutes: totalWorkingMinutes,
                total_working_hours: Math.round((totalWorkingMinutes / 60) * 100) / 100,
                total_working_hours_display: `${Math.floor(totalWorkingMinutes / 60)}h ${Math.round(totalWorkingMinutes % 60)}m`
            }
        });
    } catch (error) {
        console.error('❌ Error in getAttendanceReport:', error);
        res.status(500).json({ success: false, message: 'Failed to get attendance report', error: error.message });
    }
};

// Get missed clock-outs
exports.getMissedClockOuts = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { data: missedRecords, error } = await supabase
            .from('attendance')
            .select('*, employees!inner(first_name, last_name, shift_timing)')
            .eq('employee_id', employee_id)
            .not('clock_in', 'is', null)
            .is('clock_out', null)
            .order('attendance_date', { ascending: false });
        if (error) throw error;
        const formattedRecords = (missedRecords || []).map(record => {
            const clockInTime = new Date(record.clock_in);
            return {
                id: record.id,
                attendance_date: record.attendance_date,
                clock_in: record.clock_in,
                clock_in_display: clockInTime.toLocaleString(),
                shift_timing: record.employees?.shift_timing,
                employee_name: `${record.employees?.first_name} ${record.employees?.last_name}`,
                is_regularized: record.is_regularized || false,
                regularization_requested: record.regularization_requested || false,
                regularization_status: record.regularization_status || 'pending'
            };
        });
        res.json({ success: true, missed_clockouts: formattedRecords });
    } catch (error) {
        console.error('Error fetching missed clock-outs:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch missed clock-outs', error: error.message });
    }
};

// Request regularization
exports.requestRegularization = async (req, res) => {
    try {
        const { attendance_id, requested_clock_out_time, reason, attendance_date } = req.body;
        const { employee_id } = req.params;
        if (!attendance_id || !requested_clock_out_time) {
            return res.status(400).json({ success: false, message: 'Attendance ID and clock-out time are required' });
        }
        const { data: attendance } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('id', attendance_id)
            .maybeSingle();
        if (!attendance) {
            return res.status(404).json({ success: false, message: 'Attendance record not found' });
        }
        if (attendance.clock_out) {
            return res.status(400).json({ success: false, message: 'This attendance record already has a clock-out time' });
        }
        if (attendance.regularization_requested) {
            return res.status(400).json({ success: false, message: 'Regularization already requested for this record' });
        }
        const requestedTime = parseLocalDateTime(requested_clock_out_time);
        if (!requestedTime || isNaN(requestedTime.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format' });
        }
        const { data: request, error: reqError } = await supabase
            .from('regularization_requests')
            .insert([{
                employee_id, attendance_id: String(attendance_id),
                attendance_date: attendance_date || attendance.attendance_date,
                clock_in_time: attendance.clock_in,
                requested_clock_out_time: requested_clock_out_time,
                reason: reason || 'Missed clock-out', status: 'pending',
                created_at: new Date().toISOString()
            }])
            .select()
            .single();
        if (reqError) {
            return res.status(500).json({ success: false, message: 'Failed to create regularization request', error: reqError.message });
        }
        await supabase
            .from('attendance')
            .update({
                regularization_requested: true,
                regularization_request_id: request.id,
                regularization_status: 'pending'
            })
            .eq('id', attendance.id);
        res.json({
            success: true,
            message: 'Regularization request submitted successfully! HR will review your request.',
            request: { id: request.id, attendance_date: request.attendance_date, requested_clock_out_time: request.requested_clock_out_time, status: request.status }
        });
    } catch (error) {
        console.error('❌ Error requesting regularization:', error);
        res.status(500).json({ success: false, message: 'Failed to submit regularization request', error: error.message });
    }
};

// Approve regularization
exports.approveRegularization = async (req, res) => {
    try {
        const { request_id } = req.params;
        const { approved_clock_out_time, admin_notes } = req.body;
        const { data: request } = await supabase
            .from('regularization_requests')
            .select('*')
            .eq('id', request_id)
            .single();
        if (!request) {
            return res.status(404).json({ success: false, message: 'Regularization request not found' });
        }
        let clockOutTime;
        if (approved_clock_out_time) {
            clockOutTime = parseLocalDateTime(approved_clock_out_time);
        } else {
            clockOutTime = parseLocalDateTime(request.requested_clock_out_time);
        }
        if (!clockOutTime || isNaN(clockOutTime.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid approved clock-out time format' });
        }
        const clockInTime = new Date(request.clock_in_time);
        const diffMs = clockOutTime - clockInTime;
        const totalMinutes = diffMs / (1000 * 60);
        const totalHours = totalMinutes / 60;
        const hours = Math.floor(totalMinutes / 60);
        const minutes = Math.round(totalMinutes % 60);
        const totalHoursDisplay = `${hours}h ${minutes}m`;
        let status = 'half_day';
        if (totalMinutes >= 480) status = 'present';
        else if (totalMinutes < 240) status = 'absent';
        await supabase
            .from('attendance')
            .update({
                clock_out: clockOutTime.toISOString(),
                total_hours: Math.round(totalHours * 100) / 100,
                total_minutes: Math.round(totalMinutes),
                total_hours_display: totalHoursDisplay,
                status: status,
                is_regularized: true,
                regularization_status: 'approved',
                regularization_approved_by: req.user?.id,
                regularization_approved_at: new Date().toISOString(),
                regularization_notes: admin_notes
            })
            .eq('id', request.attendance_id);
        await supabase
            .from('regularization_requests')
            .update({
                status: 'approved',
                approved_clock_out_time: clockOutTime.toISOString(),
                approved_by: req.user?.id,
                approved_at: new Date().toISOString(),
                admin_notes: admin_notes
            })
            .eq('id', request_id);
        res.json({
            success: true,
            message: 'Regularization request approved successfully',
            attendance: {
                id: request.attendance_id,
                attendance_date: request.attendance_date,
                clock_in: request.clock_in_time,
                clock_out: clockOutTime,
                total_hours: Math.round(totalHours * 100) / 100,
                total_hours_display: totalHoursDisplay,
                status
            }
        });
    } catch (error) {
        console.error('Error approving regularization:', error);
        res.status(500).json({ success: false, message: 'Failed to approve regularization', error: error.message });
    }
};

// Reject regularization
exports.rejectRegularization = async (req, res) => {
    try {
        const { request_id } = req.params;
        const { rejection_reason } = req.body;
        const { data: request } = await supabase
            .from('regularization_requests')
            .select('*')
            .eq('id', request_id)
            .single();
        if (!request) {
            return res.status(404).json({ success: false, message: 'Regularization request not found' });
        }
        await supabase
            .from('attendance')
            .update({
                regularization_status: 'rejected',
                regularization_rejection_reason: rejection_reason
            })
            .eq('id', request.attendance_id);
        await supabase
            .from('regularization_requests')
            .update({
                status: 'rejected',
                rejection_reason: rejection_reason,
                rejected_at: new Date().toISOString(),
                rejected_by: req.user?.id
            })
            .eq('id', request_id);
        res.json({ success: true, message: 'Regularization request rejected' });
    } catch (error) {
        console.error('Error rejecting regularization:', error);
        res.status(500).json({ success: false, message: 'Failed to reject regularization', error: error.message });
    }
};

// Get pending regularization requests
exports.getPendingRegularizations = async (req, res) => {
    try {
        const { data: requests } = await supabase
            .from('regularization_requests')
            .select('*')
            .order('created_at', { ascending: false });
        const formattedRequests = [];
        for (const req of (requests || [])) {
            const { data: employee } = await supabase
                .from('employees')
                .select('employee_id, first_name, last_name, department, designation')
                .eq('employee_id', req.employee_id)
                .single();
            formattedRequests.push({
                id: req.id,
                employee_id: req.employee_id,
                employee_name: employee ? `${employee.first_name || ''} ${employee.last_name || ''}`.trim() : req.employee_id,
                department: employee?.department || 'N/A',
                attendance_date: req.attendance_date,
                attendance_id: req.attendance_id,
                clock_in_time: req.clock_in_time,
                requested_clock_out_time: req.requested_clock_out_time,
                reason: req.reason,
                status: req.status,
                created_at: req.created_at
            });
        }
        res.json({ success: true, requests: formattedRequests });
    } catch (error) {
        console.error('❌ Error in getPendingRegularizations:', error);
        res.json({ success: true, requests: [] });
    }
};

// Heartbeat
exports.heartbeat = async (req, res) => {
    try {
        const { employee_id, session_id, latitude, longitude } = req.body;
        await supabase
            .from('attendance_sessions')
            .update({ last_heartbeat: new Date().toISOString(), latitude, longitude })
            .eq('employee_id', employee_id)
            .eq('session_id', session_id)
            .eq('is_active', true);
        res.json({ success: true, timestamp: new Date() });
    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, message: 'Heartbeat failed' });
    }
};

// Get employee attendance report
exports.getEmployeeAttendanceReport = async (req, res) => {
    try {
        const { start, end } = req.query;
        const { employee_id } = req.params;
        if (req.user?.employeeId !== employee_id && req.user?.role !== 'admin') {
            return res.status(403).json({ success: false, message: 'Access denied' });
        }
        if (!start || !end) {
            return res.status(400).json({ success: false, message: 'Start and end dates are required' });
        }
        const { data: attendance } = await supabase
            .from('attendance')
            .select('*, employees!inner(first_name, last_name, department, shift_timing, comp_off_balance)')
            .eq('employee_id', employee_id)
            .gte('attendance_date', start)
            .lte('attendance_date', end)
            .order('attendance_date', { ascending: false });
        const formattedAttendance = (attendance || []).map(record => {
            const employee = record.employees || {};
            let totalHoursDisplay = '0h 0m';
            if (record.total_minutes) {
                totalHoursDisplay = `${Math.floor(record.total_minutes / 60)}h ${Math.round(record.total_minutes % 60)}m`;
            } else if (record.total_hours) {
                const totalMinutes = record.total_hours * 60;
                totalHoursDisplay = `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`;
            }
            let lateDisplay = null;
            if (record.late_minutes && record.late_minutes > 0) {
                lateDisplay = formatLateTime(parseFloat(record.late_minutes));
            }
            return {
                id: record.id, employee_id: record.employee_id, attendance_date: record.attendance_date,
                clock_in: record.clock_in, clock_out: record.clock_out,
                total_hours: record.total_hours, total_minutes: record.total_minutes,
                total_hours_display: totalHoursDisplay, status: record.status,
                late_minutes: record.late_minutes ? parseFloat(record.late_minutes) : null,
                late_display: lateDisplay, early_minutes: record.early_minutes,
                is_holiday: record.is_holiday, comp_off_awarded: record.comp_off_awarded,
                is_regularized: record.is_regularized || false,
                first_name: employee.first_name || '', last_name: employee.last_name || '',
                department: employee.department || ''
            };
        });
        let totalWorkingMinutes = 0;
        formattedAttendance.forEach(a => {
            if (a.total_minutes) totalWorkingMinutes += a.total_minutes;
            else if (a.total_hours) totalWorkingMinutes += a.total_hours * 60;
        });
        res.json({
            success: true,
            attendance: formattedAttendance,
            stats: {
                total: formattedAttendance.length,
                present: formattedAttendance.filter(a => a.status === 'present').length,
                half_day: formattedAttendance.filter(a => a.status === 'half_day').length,
                absent: formattedAttendance.filter(a => a.status === 'absent').length,
                total_working_minutes: totalWorkingMinutes,
                total_working_hours: Math.round((totalWorkingMinutes / 60) * 100) / 100,
                total_working_hours_display: `${Math.floor(totalWorkingMinutes / 60)}h ${Math.round(totalWorkingMinutes % 60)}m`
            }
        });
    } catch (error) {
        console.error('❌ Error in getEmployeeAttendanceReport:', error);
        res.status(500).json({ success: false, message: 'Failed to get attendance report', error: error.message });
    }
};

// ============== ADD MISSING FUNCTIONS ==============

// Get overtime summary
exports.getOvertimeSummary = async (req, res) => {
    try {
        const { employee_id, month, year } = req.params;
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        const { data: overtime, error } = await supabase
            .from('overtime_earnings')
            .select('*')
            .eq('employee_id', employee_id)
            .gte('attendance_date', startDateStr)
            .lte('attendance_date', endDateStr)
            .order('attendance_date', { ascending: true });
        if (error) throw error;
        const totalMinutes = overtime?.reduce((sum, record) => sum + (record.overtime_minutes || 0), 0) || 0;
        const totalHours = overtime?.reduce((sum, record) => sum + (record.overtime_hours || 0), 0) || 0;
        const totalAmount = overtime?.reduce((sum, record) => sum + (record.overtime_amount || 0), 0) || 0;
        res.json({
            success: true, employee_id, month, year,
            overtime: overtime || [],
            summary: {
                total_days: overtime?.length || 0,
                total_minutes: totalMinutes,
                total_hours: totalHours,
                total_hours_display: `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`,
                total_amount: totalAmount,
                average_per_day: overtime?.length > 0 ? (totalHours / overtime.length).toFixed(2) : 0
            }
        });
    } catch (error) {
        console.error('Error fetching overtime summary:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch overtime summary', error: error.message });
    }
};

// Get comp-off balance
exports.getCompOffBalance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { data, error } = await supabase
            .from('employees')
            .select('comp_off_balance, total_comp_off_earned, total_comp_off_used')
            .eq('employee_id', employee_id)
            .single();
        if (error) throw error;
        res.json({
            success: true,
            comp_off_balance: data.comp_off_balance || 0,
            total_earned: data.total_comp_off_earned || 0,
            total_used: data.total_comp_off_used || 0
        });
    } catch (error) {
        console.error('Error fetching comp-off balance:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comp-off balance', error: error.message });
    }
};

// Get comp-off history
exports.getCompOffHistory = async (req, res) => {
    try {
        const { employee_id } = req.params;
        const { data, error } = await supabase
            .from('comp_off_earnings')
            .select('*')
            .eq('employee_id', employee_id)
            .order('attendance_date', { ascending: false });
        if (error) throw error;
        res.json({ success: true, earnings: data || [] });
    } catch (error) {
        console.error('Error fetching comp-off history:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch comp-off history', error: error.message });
    }
};

// Mark absent at day end
exports.markAbsentAtDayEnd = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();
        const { data: employees } = await supabase.from('employees').select('employee_id');
        let markedCount = 0, updatedCount = 0;
        for (const emp of employees || []) {
            const { data: attendance } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', emp.employee_id)
                .eq('attendance_date', today);
            if (!attendance || attendance.length === 0) {
                await supabase.from('attendance').insert([{ employee_id: emp.employee_id, attendance_date: today, status: 'absent' }]);
                markedCount++;
            } else if (attendance[0].clock_in && !attendance[0].clock_out) {
                const clockIn = new Date(attendance[0].clock_in);
                const totalMinutes = calculateTimeDifferenceInMinutes(clockIn, now);
                const totalHours = totalMinutes / 60;
                await supabase
                    .from('attendance')
                    .update({ status: 'half_day', total_hours: totalHours, total_minutes: totalMinutes })
                    .eq('id', attendance[0].id);
                updatedCount++;
            }
        }
        return { success: true, message: `Marked ${markedCount} absent, ${updatedCount} half_day` };
    } catch (error) {
        console.error('Error marking absent:', error);
        return { success: false, error: error.message };
    }
};

module.exports = exports;