const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');

// Generate unique session ID
const generateSessionId = () => {
    return uuidv4();
};

// Helper function to parse time string (e.g., "3:00 PM" or "15:00")
const parseTimeString = (timeStr) => {
    if (!timeStr) return null;

    console.log('Parsing time string:', timeStr);

    // Handle format like "3:00 PM - 12:00 AM"
    const parts = timeStr.split('-');
    let startTimeStr = timeStr;
    if (parts.length > 0) {
        startTimeStr = parts[0].trim();
    }

    // Try to parse time
    let hour = 9, minute = 0;

    // Check for AM/PM format (e.g., "3:00 PM")
    const ampmMatch = startTimeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (ampmMatch) {
        hour = parseInt(ampmMatch[1]);
        minute = parseInt(ampmMatch[2]);
        const ampm = ampmMatch[3].toUpperCase();

        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;

        return { hour, minute };
    }

    // Check for 24-hour format (e.g., "15:00")
    const militaryMatch = startTimeStr.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        hour = parseInt(militaryMatch[1]);
        minute = parseInt(militaryMatch[2]);
        return { hour, minute };
    }

    return { hour, minute };
};

// Clock in
exports.clockIn = async (req, res) => {
    try {
        console.log('='.repeat(70));
        console.log('📍 CLOCK-IN REQUEST');
        console.log('Time:', new Date().toISOString());
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { employee_id, latitude, longitude, accuracy } = req.body;

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        // Get employee details
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employee_id);

        if (empError) throw empError;

        if (!employees || employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const emp = employees[0];
        const now = new Date();

        // Get today's date in LOCAL timezone
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const currentTimeStr = now.toTimeString().split(' ')[0];
        const sessionId = generateSessionId();

        console.log('Employee:', emp.first_name, emp.last_name);
        console.log('Today date (LOCAL):', today);
        console.log('Clock in time:', now.toString());

        // Parse shift time from employee profile
        let shiftHour = 9, shiftMinute = 0;
        let shiftDisplay = emp.shift_timing || '9:00 AM';

        if (emp.shift_timing) {
            const parsedTime = parseTimeString(emp.shift_timing);
            if (parsedTime) {
                shiftHour = parsedTime.hour;
                shiftMinute = parsedTime.minute;
            }
        }

        // Create shift start datetime for today
        const shiftStartTime = new Date(now);
        shiftStartTime.setHours(shiftHour, shiftMinute, 0, 0);

        // Calculate difference
        const diffMs = now - shiftStartTime;
        const isLate = diffMs > 0;
        const isEarly = diffMs < 0;
        const lateMinutes = isLate ? diffMs / (1000 * 60) : 0;
        const earlyMinutes = isEarly ? Math.abs(diffMs) / (1000 * 60) : 0;

        // Start transaction - Supabase doesn't support transactions directly
        // We'll use a series of operations with error handling
        
        try {
            // ALWAYS create a new attendance record for each clock-in
            const { error: attendanceError } = await supabase
                .from('attendance')
                .insert([{
                    employee_id,
                    attendance_date: today,
                    clock_in: now.toISOString(),
                    late_minutes: lateMinutes,
                    early_minutes: earlyMinutes,
                    latitude,
                    longitude,
                    location_accuracy: accuracy,
                    session_id: sessionId,
                    shift_time_used: shiftDisplay
                }]);

            if (attendanceError) throw attendanceError;

            // Check if session already exists
            const { data: existingSession, error: checkError } = await supabase
                .from('attendance_sessions')
                .select('*')
                .eq('session_id', sessionId);

            if (checkError) throw checkError;

            if (existingSession && existingSession.length === 0) {
                // Create new session
                const { error: sessionError } = await supabase
                    .from('attendance_sessions')
                    .insert([{
                        employee_id,
                        session_id: sessionId,
                        clock_in_time: now.toISOString(),
                        last_heartbeat: now.toISOString(),
                        is_active: true,
                        latitude,
                        longitude,
                        location_accuracy: accuracy
                    }]);

                if (sessionError) throw sessionError;
            } else {
                // Update existing session
                const { error: sessionError } = await supabase
                    .from('attendance_sessions')
                    .update({
                        last_heartbeat: now.toISOString(),
                        is_active: true,
                        latitude,
                        longitude,
                        location_accuracy: accuracy
                    })
                    .eq('session_id', sessionId);

                if (sessionError) throw sessionError;
            }

            // Prepare response message
            let status = 'On Time';
            let message = '✅ Clocked in on time';
            let lateDisplay = null;
            let earlyDisplay = null;

            if (isLate) {
                status = 'Late';
                const lateSeconds = Math.round(lateMinutes * 60);

                if (lateSeconds < 60) {
                    lateDisplay = `${lateSeconds} second${lateSeconds !== 1 ? 's' : ''}`;
                } else {
                    const minutes = Math.floor(lateSeconds / 60);
                    const seconds = lateSeconds % 60;
                    lateDisplay = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                }
                message = `⚠️ Clocked in (${lateDisplay} late)`;
            } else if (isEarly) {
                status = 'Early';
                const earlySeconds = Math.round(earlyMinutes * 60);

                if (earlySeconds < 60) {
                    earlyDisplay = `${earlySeconds} second${earlySeconds !== 1 ? 's' : ''}`;
                } else {
                    const minutes = Math.floor(earlySeconds / 60);
                    const seconds = earlySeconds % 60;
                    earlyDisplay = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                }
                message = `⏰ Clocked in (${earlyDisplay} early)`;
            }

            const response = {
                success: true,
                message,
                clock_in: now,
                clock_in_time: currentTimeStr,
                shift_time: shiftDisplay,
                status,
                is_late: isLate,
                is_early: isEarly,
                session_id: sessionId,
                employee_name: `${emp.first_name} ${emp.last_name}`,
                attendance_date: today
            };

            if (isLate) {
                response.late_minutes = lateMinutes;
                response.late_display = lateDisplay;
            }
            if (isEarly) {
                response.early_minutes = earlyMinutes;
                response.early_display = earlyDisplay;
            }

            console.log('✅ Response:', response.message, 'for date:', today);
            res.json(response);

        } catch (error) {
            console.error('❌ Transaction error:', error);
            throw error;
        }

    } catch (error) {
        console.error('❌ Clock-in error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to clock in',
            error: error.message
        });
    }
};

// Clock out
exports.clockOut = async (req, res) => {
    try {
        console.log('='.repeat(70));
        console.log('📍 CLOCK-OUT REQUEST');
        console.log('Time:', new Date().toISOString());
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(70));

        const { employee_id, session_id, latitude, longitude, accuracy } = req.body;

        // Validate required fields
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

        console.log(`🔍 Looking for active session: ${session_id} for employee: ${employee_id}`);

        try {
            // 1. First, find the active session
            const { data: activeSessions, error: sessionError } = await supabase
                .from('attendance_sessions')
                .select('*')
                .eq('session_id', session_id)
                .eq('employee_id', employee_id)
                .eq('is_active', true);

            if (sessionError) throw sessionError;

            console.log(`Found ${activeSessions?.length || 0} active sessions`);

            let session;
            let attendanceRecord;

            if (!activeSessions || activeSessions.length === 0) {
                // Try to find by employee_id only as fallback
                const { data: fallbackSessions, error: fallbackError } = await supabase
                    .from('attendance_sessions')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('is_active', true)
                    .order('clock_in_time', { ascending: false })
                    .limit(1);

                if (fallbackError) throw fallbackError;

                if (!fallbackSessions || fallbackSessions.length === 0) {
                    console.log('❌ No active session found for employee:', employee_id);

                    return res.status(400).json({
                        success: false,
                        message: 'No active clock-in session found. Please clock in first.',
                        error_type: 'NO_ACTIVE_SESSION'
                    });
                }

                console.log('Using fallback session:', fallbackSessions[0].session_id);
                session = fallbackSessions[0];

                // Find attendance record for this session
                const { data: attendanceRecords, error: attendanceError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('session_id', session.session_id)
                    .is('clock_out', null);

                if (attendanceError) throw attendanceError;

                if (!attendanceRecords || attendanceRecords.length === 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'No matching attendance record found for the active session.'
                    });
                }

                attendanceRecord = attendanceRecords[0];
            } else {
                // Use the primary session found
                session = activeSessions[0];
                console.log('✅ Found active session:', session);

                // Find the corresponding attendance record
                const { data: attendanceRecords, error: attendanceError } = await supabase
                    .from('attendance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('session_id', session_id)
                    .is('clock_out', null);

                if (attendanceError) throw attendanceError;

                if (!attendanceRecords || attendanceRecords.length === 0) {
                    // Try without session_id filter as fallback
                    const { data: fallbackAttendance, error: fallbackError } = await supabase
                        .from('attendance')
                        .select('*')
                        .eq('employee_id', employee_id)
                        .is('clock_out', null)
                        .order('clock_in', { ascending: false })
                        .limit(1);

                    if (fallbackError) throw fallbackError;

                    if (!fallbackAttendance || fallbackAttendance.length === 0) {
                        return res.status(400).json({
                            success: false,
                            message: 'No matching attendance record found for this session.'
                        });
                    }

                    attendanceRecord = fallbackAttendance[0];
                } else {
                    attendanceRecord = attendanceRecords[0];
                }
            }

            // Calculate hours
            const clockIn = new Date(attendanceRecord.clock_in);
            const totalMs = now - clockIn;
            const totalHours = totalMs / (1000 * 60 * 60);
            const totalHoursRounded = Math.round(totalHours * 100) / 100;

            // Determine status
            let status = 'present';
            if (totalHours < 4) {
                status = 'absent';
            } else if (totalHours < 8) {
                status = 'half_day';
            }

            console.log(`📊 Hours worked: ${totalHoursRounded}, Status: ${status}`);

            // Update attendance record
            const { error: updateAttendanceError } = await supabase
                .from('attendance')
                .update({
                    clock_out: now.toISOString(),
                    total_hours: totalHoursRounded,
                    status: status,
                    latitude: latitude || attendanceRecord.latitude,
                    longitude: longitude || attendanceRecord.longitude,
                    location_accuracy: accuracy || attendanceRecord.location_accuracy
                })
                .eq('id', attendanceRecord.id);

            if (updateAttendanceError) throw updateAttendanceError;

            // Deactivate session
            const { error: updateSessionError } = await supabase
                .from('attendance_sessions')
                .update({
                    is_active: false,
                    clock_out_time: now.toISOString()
                })
                .eq('id', session.id);

            if (updateSessionError) throw updateSessionError;

            console.log('✅ Clock-out successful');

            res.json({
                success: true,
                message: `✅ Clocked out successfully. ${status === 'present' ? 'Full day' : status === 'half_day' ? 'Half day' : 'Absent'}`,
                clock_out: now,
                total_hours: totalHoursRounded,
                status,
                session_id: session.session_id
            });

        } catch (error) {
            throw error;
        }

    } catch (error) {
        console.error('❌ Clock-out error:', error);
        console.error('Error stack:', error.stack);

        res.status(500).json({
            success: false,
            message: 'Failed to clock out',
            error: error.message,
            error_type: 'SERVER_ERROR'
        });
    }
};

// Get today's attendance
exports.getTodayAttendance = async (req, res) => {
    try {
        const { employee_id } = req.params;
        
        console.log('📊 getTodayAttendance called with employee_id:', employee_id);

        if (!employee_id) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID is required'
            });
        }

        const now = new Date();
        // Format today as YYYY-MM-DD using LOCAL date
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        console.log('📊 Today date:', todayStr);

        // First check if employee exists
        console.log('📊 Checking if employee exists with ID:', employee_id);
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employee_id);

        if (empError) throw empError;

        if (!employees || employees.length === 0) {
            console.log('❌ Employee not found:', employee_id);
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const employee = employees[0];
        console.log('✅ Employee found:', employee.first_name, employee.last_name);

        // Get today's attendance record
        const { data: todayAttendance, error: attendanceError } = await supabase
            .from('attendance')
            .select(`
                *,
                employees!inner(first_name, last_name, shift_timing)
            `)
            .eq('employee_id', employee_id)
            .eq('attendance_date', todayStr)
            .order('clock_in', { ascending: false })
            .limit(1);

        if (attendanceError) throw attendanceError;

        console.log('📊 Today attendance records found:', todayAttendance?.length || 0);

        // Get active session if any
        const { data: activeSession, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('is_active', true);

        if (sessionError) throw sessionError;
        
        console.log('📊 Active session found:', activeSession?.length || 0);

        // Format the attendance data if it exists
        let formattedAttendance = null;
        
        if (todayAttendance && todayAttendance.length > 0) {
            formattedAttendance = { ...todayAttendance[0] };
            
            // Add employee details
            if (formattedAttendance.employees) {
                formattedAttendance.first_name = formattedAttendance.employees.first_name;
                formattedAttendance.last_name = formattedAttendance.employees.last_name;
                formattedAttendance.shift_timing = formattedAttendance.employees.shift_timing;
                delete formattedAttendance.employees;
            }
            
            // Calculate late display if applicable
            if (formattedAttendance.late_minutes && formattedAttendance.late_minutes > 0) {
                const lateSeconds = Math.round(formattedAttendance.late_minutes * 60);
                formattedAttendance.late_display = lateSeconds < 60 ?
                    `${lateSeconds}s` :
                    `${Math.floor(lateSeconds / 60)}m ${lateSeconds % 60}s`;
            }
            
            // Calculate current hours if working
            if (formattedAttendance.clock_in && !formattedAttendance.clock_out) {
                const clockIn = new Date(formattedAttendance.clock_in);
                const now = new Date();
                const currentHours = (now - clockIn) / (1000 * 60 * 60);
                formattedAttendance.current_hours = currentHours.toFixed(2);
            }
            
            console.log('📊 Today\'s attendance:', {
                date: formattedAttendance.attendance_date,
                clock_in: formattedAttendance.clock_in ? 'Yes' : 'No',
                clock_out: formattedAttendance.clock_out ? 'Yes' : 'No'
            });
        }

        const response = {
            success: true,
            attendance: formattedAttendance,
            active_session: activeSession && activeSession.length > 0 ? activeSession[0] : null,
            has_active_session: activeSession && activeSession.length > 0,
            today_date: todayStr
        };

        console.log('📊 Sending response for date:', todayStr);
        res.json(response);

    } catch (error) {
        console.error('❌ Error in getTodayAttendance:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error message:', error.message);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get attendance',
            error: error.message
        });
    }
};

// Get attendance report
exports.getAttendanceReport = async (req, res) => {
    try {
        const { start, end, employee_id } = req.query;
        
        console.log('📊 Getting attendance report from', start, 'to', end, 'for employee:', employee_id);
        
        // Validate required parameters
        if (!start || !end) {
            console.log('❌ Missing start or end date');
            return res.status(400).json({
                success: false,
                message: 'Start and end dates are required'
            });
        }

        // Get attendance records - SIMPLIFIED QUERY
        let query = supabase
            .from('attendance')
            .select(`
                *,
                employees (
                    first_name, 
                    last_name, 
                    department, 
                    shift_timing
                )
            `)
            .gte('attendance_date', start)
            .lte('attendance_date', end);

        if (employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        query = query.order('attendance_date', { ascending: false });

        const { data: attendance, error: attendanceError } = await query;

        if (attendanceError) {
            console.error('❌ Attendance query error:', attendanceError);
            throw attendanceError;
        }

        console.log(`📊 Found ${attendance?.length || 0} attendance records`);

        // Format attendance records
        const formattedAttendance = (attendance || []).map(record => {
            // Get employee details from the nested object
            const employee = record.employees || {};
            
            return {
                id: record.id,
                employee_id: record.employee_id,
                attendance_date: record.attendance_date,
                clock_in: record.clock_in,
                clock_out: record.clock_out,
                total_hours: record.total_hours,
                status: record.status,
                late_minutes: record.late_minutes,
                early_minutes: record.early_minutes,
                shift_time_used: record.shift_time_used,
                // Employee details flattened
                first_name: employee.first_name || '',
                last_name: employee.last_name || '',
                department: employee.department || '',
                shift_timing: employee.shift_timing || '',
                // Remove nested object
                employees: undefined
            };
        });

        // Return directly without leave data for now
        res.json({
            success: true,
            attendance: formattedAttendance,
            stats: {
                total: formattedAttendance.length,
                present: formattedAttendance.filter(a => a.status === 'present').length,
                half_day: formattedAttendance.filter(a => a.status === 'half_day').length,
                absent: formattedAttendance.filter(a => a.status === 'absent').length
            }
        });

    } catch (error) {
        console.error('❌ Error in getAttendanceReport:', error);
        console.error('❌ Error details:', error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get attendance report',
            error: error.message,
            details: error.details || error.hint
        });
    }
};

// Heartbeat
exports.heartbeat = async (req, res) => {
    try {
        const { employee_id, session_id, latitude, longitude } = req.body;

        const { error } = await supabase
            .from('attendance_sessions')
            .update({
                last_heartbeat: new Date().toISOString(),
                latitude: latitude,
                longitude: longitude
            })
            .eq('employee_id', employee_id)
            .eq('session_id', session_id)
            .eq('is_active', true);

        if (error) throw error;

        res.json({ success: true, timestamp: new Date() });

    } catch (error) {
        console.error('Heartbeat error:', error);
        res.status(500).json({ success: false, message: 'Heartbeat failed' });
    }
};

// Check active sessions (for monitoring only, no auto clock-out)
exports.checkActiveSessions = async () => {
    try {
        // This function now only monitors, doesn't auto clock-out
        const { count: activeCount, error: countError } = await supabase
            .from('attendance_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (countError) throw countError;

        console.log(`📊 Active sessions: ${activeCount}`);

        // Optional: Send alerts for sessions inactive for too long
        const timeoutMinutes = 60; // Alert after 60 minutes of no heartbeat
        const timeoutDate = new Date();
        timeoutDate.setMinutes(timeoutDate.getMinutes() - timeoutMinutes);

        const { data: inactiveSessions, error: inactiveError } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('is_active', true)
            .lt('last_heartbeat', timeoutDate.toISOString());

        if (inactiveError) throw inactiveError;

        for (const session of inactiveSessions || []) {
            console.log(`⚠️ Session ${session.session_id} for employee ${session.employee_id} has been inactive for ${timeoutMinutes}+ minutes`);
            // You could send a notification to admin here
            // But DO NOT auto clock-out
        }

        return {
            success: true,
            active: activeCount,
            inactive: inactiveSessions?.length || 0
        };

    } catch (error) {
        console.error('Error checking active sessions:', error);
        return { success: false, error: error.message };
    }
};

// Mark absent for employees who didn't punch in at end of day
exports.markAbsentAtDayEnd = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        console.log('📝 Running end-of-day absent marking for:', today);

        // Get all employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('employee_id');

        if (empError) throw empError;

        let markedCount = 0;
        let updatedCount = 0;

        for (const emp of employees || []) {
            // Check if employee has attendance record for today
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', emp.employee_id)
                .eq('attendance_date', today);

            if (attError) throw attError;

            // If no record exists, create absent record
            if (!attendance || attendance.length === 0) {
                const { error: insertError } = await supabase
                    .from('attendance')
                    .insert([{
                        employee_id: emp.employee_id,
                        attendance_date: today,
                        status: 'absent'
                    }]);

                if (insertError) throw insertError;
                markedCount++;
                console.log(`✅ Marked absent for employee ${emp.employee_id}`);
            }
            // If record exists but has clock_in and no clock_out, mark as half_day (they forgot to clock out)
            else if (attendance[0].clock_in && !attendance[0].clock_out) {
                const clockIn = new Date(attendance[0].clock_in);
                const totalHours = (now - clockIn) / (1000 * 60 * 60);
                
                const { error: updateError } = await supabase
                    .from('attendance')
                    .update({
                        status: 'half_day',
                        total_hours: totalHours
                    })
                    .eq('id', attendance[0].id);

                if (updateError) throw updateError;
                updatedCount++;
                console.log(`⚠️ Auto-marked half_day for employee ${emp.employee_id} (forgot to clock out)`);
            }
        }

        console.log(`✅ End-of-day absent marking completed. Marked ${markedCount} absent, updated ${updatedCount} half_day.`);
        return { success: true, message: `Marked ${markedCount} absent, ${updatedCount} half_day` };

    } catch (error) {
        console.error('Error marking absent:', error);
        return { success: false, error: error.message };
    }
};