const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

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
        const [employee] = await db.query(
            'SELECT * FROM employees WHERE employee_id = ?',
            [employee_id]
        );

        if (employee.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const emp = employee[0];
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

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // ALWAYS create a new attendance record for each clock-in
            // This allows multiple sessions per day
            await connection.query(
                `INSERT INTO attendance 
                 (employee_id, attendance_date, clock_in, late_minutes, early_minutes,
                  latitude, longitude, location_accuracy, session_id, shift_time_used) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [employee_id, today, now, lateMinutes, earlyMinutes, latitude, longitude, accuracy, sessionId, shiftDisplay]
            );

            // Create active session
            await connection.query(
                `INSERT INTO attendance_sessions 
                 (employee_id, session_id, clock_in_time, last_heartbeat, is_active) 
                 VALUES (?, ?, ?, ?, true)
                 ON DUPLICATE KEY UPDATE
                 last_heartbeat = NOW(), is_active = true`,
                [employee_id, sessionId, now, now]
            );

            await connection.commit();
            connection.release();

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
            await connection.rollback();
            connection.release();
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

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 1. First, find the active session
            const [activeSessions] = await connection.query(
                `SELECT * FROM attendance_sessions 
                 WHERE session_id = ? 
                 AND employee_id = ? 
                 AND is_active = true`,
                [session_id, employee_id]
            );

            console.log(`Found ${activeSessions.length} active sessions`);

            if (activeSessions.length === 0) {
                // Try to find by employee_id only as fallback
                const [fallbackSessions] = await connection.query(
                    `SELECT * FROM attendance_sessions 
                     WHERE employee_id = ? 
                     AND is_active = true 
                     ORDER BY clock_in_time DESC 
                     LIMIT 1`,
                    [employee_id]
                );

                if (fallbackSessions.length === 0) {
                    await connection.rollback();
                    connection.release();

                    console.log('❌ No active session found for employee:', employee_id);

                    return res.status(400).json({
                        success: false,
                        message: 'No active clock-in session found. Please clock in first.',
                        error_type: 'NO_ACTIVE_SESSION'
                    });
                }

                console.log('Using fallback session:', fallbackSessions[0].session_id);

                // Use the fallback session
                const session = fallbackSessions[0];

                // Find attendance record for this session
                const [attendanceRecords] = await connection.query(
                    `SELECT * FROM attendance 
                     WHERE employee_id = ? 
                     AND session_id = ? 
                     AND clock_in IS NOT NULL 
                     AND clock_out IS NULL`,
                    [employee_id, session.session_id]
                );

                if (attendanceRecords.length === 0) {
                    await connection.rollback();
                    connection.release();

                    return res.status(400).json({
                        success: false,
                        message: 'No matching attendance record found for the active session.'
                    });
                }

                // Calculate hours and update using the found session
                const record = attendanceRecords[0];
                const clockIn = new Date(record.clock_in);
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
                await connection.query(
                    `UPDATE attendance 
                     SET clock_out = ?,
                         total_hours = ?,
                         status = ?,
                         latitude = COALESCE(?, latitude),
                         longitude = COALESCE(?, longitude),
                         location_accuracy = COALESCE(?, location_accuracy)
                     WHERE id = ?`,
                    [now, totalHoursRounded, status, latitude, longitude, accuracy, record.id]
                );

                // Deactivate session
                await connection.query(
                    `UPDATE attendance_sessions 
                     SET is_active = false,
                         clock_out_time = ?
                     WHERE id = ?`,
                    [now, session.id]
                );

                await connection.commit();
                connection.release();

                return res.json({
                    success: true,
                    message: `✅ Clocked out successfully. ${status === 'present' ? 'Full day' : status === 'half_day' ? 'Half day' : 'Absent'}`,
                    clock_out: now,
                    total_hours: totalHoursRounded,
                    status,
                    session_id: session.session_id
                });
            }

            // Use the primary session found
            const session = activeSessions[0];
            console.log('✅ Found active session:', session);

            // Find the corresponding attendance record
            const [attendanceRecords] = await connection.query(
                `SELECT * FROM attendance 
                 WHERE employee_id = ? 
                 AND session_id = ? 
                 AND clock_in IS NOT NULL 
                 AND clock_out IS NULL`,
                [employee_id, session_id]
            );

            if (attendanceRecords.length === 0) {
                // Try without session_id filter as fallback
                const [fallbackAttendance] = await connection.query(
                    `SELECT * FROM attendance 
                     WHERE employee_id = ? 
                     AND DATE(clock_in) = DATE(?)
                     AND clock_out IS NULL
                     ORDER BY clock_in DESC
                     LIMIT 1`,
                    [employee_id, session.clock_in_time]
                );

                if (fallbackAttendance.length === 0) {
                    await connection.rollback();
                    connection.release();

                    return res.status(400).json({
                        success: false,
                        message: 'No matching attendance record found for this session.'
                    });
                }

                const record = fallbackAttendance[0];

                // Calculate hours
                const clockIn = new Date(record.clock_in);
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

                // Update the record with session_id
                await connection.query(
                    `UPDATE attendance 
                     SET clock_out = ?,
                         total_hours = ?,
                         status = ?,
                         session_id = ?,
                         latitude = COALESCE(?, latitude),
                         longitude = COALESCE(?, longitude),
                         location_accuracy = COALESCE(?, location_accuracy)
                     WHERE id = ?`,
                    [now, totalHoursRounded, status, session_id, latitude, longitude, accuracy, record.id]
                );

                // Deactivate session
                await connection.query(
                    `UPDATE attendance_sessions 
                     SET is_active = false,
                         clock_out_time = ?
                     WHERE id = ?`,
                    [now, session.id]
                );

                await connection.commit();
                connection.release();

                return res.json({
                    success: true,
                    message: `✅ Clocked out successfully. ${status === 'present' ? 'Full day' : status === 'half_day' ? 'Half day' : 'Absent'}`,
                    clock_out: now,
                    total_hours: totalHoursRounded,
                    status,
                    session_id
                });
            }

            const record = attendanceRecords[0];

            // Calculate hours
            const clockIn = new Date(record.clock_in);
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
            await connection.query(
                `UPDATE attendance 
                 SET clock_out = ?,
                     total_hours = ?,
                     status = ?,
                     latitude = COALESCE(?, latitude),
                     longitude = COALESCE(?, longitude),
                     location_accuracy = COALESCE(?, location_accuracy)
                 WHERE id = ?`,
                [now, totalHoursRounded, status, latitude, longitude, accuracy, record.id]
            );

            // Deactivate session
            await connection.query(
                `UPDATE attendance_sessions 
                 SET is_active = false,
                     clock_out_time = ?
                 WHERE id = ?`,
                [now, session.id]
            );

            await connection.commit();
            connection.release();

            console.log('✅ Clock-out successful');

            res.json({
                success: true,
                message: `✅ Clocked out successfully. ${status === 'present' ? 'Full day' : status === 'half_day' ? 'Half day' : 'Absent'}`,
                clock_out: now,
                total_hours: totalHoursRounded,
                status,
                session_id
            });

        } catch (error) {
            await connection.rollback();
            connection.release();
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

// attendanceController.js - Add more detailed error logging

// attendanceController.js - Fixed getTodayAttendance
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
        const [employee] = await db.query(
            'SELECT * FROM employees WHERE employee_id = ?',
            [employee_id]
        );

        if (employee.length === 0) {
            console.log('❌ Employee not found:', employee_id);
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        console.log('✅ Employee found:', employee[0].first_name, employee[0].last_name);

        // Get today's attendance record
        console.log('📊 Querying attendance for date:', todayStr);
        const [todayAttendance] = await db.query(
            `SELECT a.*, e.first_name, e.last_name, e.shift_timing 
             FROM attendance a
             JOIN employees e ON a.employee_id = e.employee_id
             WHERE a.employee_id = ? AND DATE(a.attendance_date) = ?
             ORDER BY a.clock_in DESC
             LIMIT 1`,
            [employee_id, todayStr]
        );

        console.log('📊 Today attendance records found:', todayAttendance.length);

        // Get active session if any
        console.log('📊 Checking for active session');
        const [activeSession] = await db.query(
            'SELECT * FROM attendance_sessions WHERE employee_id = ? AND is_active = true',
            [employee_id]
        );
        
        console.log('📊 Active session found:', activeSession.length > 0);

        // Format the attendance data if it exists
        let formattedAttendance = null;
        
        if (todayAttendance.length > 0) {
            formattedAttendance = { ...todayAttendance[0] };
            
            // Convert attendance_date to YYYY-MM-DD string format if it's a Date object
            if (formattedAttendance.attendance_date) {
                // Check if it's a Date object and convert to string
                if (formattedAttendance.attendance_date instanceof Date) {
                    const d = formattedAttendance.attendance_date;
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    formattedAttendance.attendance_date = `${year}-${month}-${day}`;
                } 
                // If it's a string that contains 'T', split it
                else if (typeof formattedAttendance.attendance_date === 'string' && 
                         formattedAttendance.attendance_date.includes('T')) {
                    formattedAttendance.attendance_date = formattedAttendance.attendance_date.split('T')[0];
                }
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
            active_session: activeSession[0] || null,
            has_active_session: activeSession.length > 0,
            today_date: todayStr
        };

        console.log('📊 Sending response for date:', todayStr);
        res.json(response);

    } catch (error) {
        console.error('❌ Error in getTodayAttendance:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get attendance',
            error: error.message,
            error_code: error.code
        });
    }
};

// Fixed getAttendanceReport
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

        // Log the query parameters
        console.log('📊 Query params:', { start, end, employee_id });

        // Get attendance records
        let attendanceQuery = `
            SELECT a.*, e.first_name, e.last_name, e.department, e.shift_timing
            FROM attendance a
            JOIN employees e ON a.employee_id = e.employee_id
            WHERE DATE(a.attendance_date) BETWEEN ? AND ?
        `;
        let params = [start, end];

        if (employee_id) {
            attendanceQuery += ' AND a.employee_id = ?';
            params.push(employee_id);
        }

        attendanceQuery += ' ORDER BY a.attendance_date DESC, e.first_name';

        console.log('📊 Executing query:', attendanceQuery);
        console.log('📊 With params:', params);

        const [attendance] = await db.query(attendanceQuery, params);

        console.log(`📊 Found ${attendance.length} attendance records`);

        // Get leave records for the same period
        let leaveQuery = `
            SELECT l.*, e.first_name, e.last_name, e.department
            FROM leaves l
            JOIN employees e ON l.employee_id = e.employee_id
            WHERE l.status = 'approved'
            AND (
                (l.start_date BETWEEN ? AND ?) OR
                (l.end_date BETWEEN ? AND ?) OR
                (l.start_date <= ? AND l.end_date >= ?)
            )
        `;
        let leaveParams = [start, end, start, end, start, end];

        if (employee_id) {
            leaveQuery += ' AND l.employee_id = ?';
            leaveParams.push(employee_id);
        }

        console.log('📊 Executing leave query');
        const [leaves] = await db.query(leaveQuery, leaveParams);

        console.log(`📊 Found ${leaves.length} leave records`);

        // Combine attendance and leave data
        const combinedData = [];
        
        // Helper function to convert any date to YYYY-MM-DD string
        const formatDateToString = (date) => {
            if (!date) return null;
            
            if (date instanceof Date) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            
            if (typeof date === 'string') {
                if (date.includes('T')) {
                    return date.split('T')[0];
                }
                return date;
            }
            
            return String(date);
        };
        
        // First, add all attendance records
        attendance.forEach(record => {
            // Format the date properly
            const dateStr = formatDateToString(record.attendance_date);
            
            combinedData.push({
                ...record,
                attendance_date: dateStr,
                type: 'attendance'
            });
        });

        // Then add leave records for days without attendance
        leaves.forEach(leave => {
            const startDate = new Date(leave.start_date);
            const endDate = new Date(leave.end_date);
            
            // For each day in the leave period
            for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                // Check if this date already has an attendance record
                const existingAttendance = attendance.some(a => {
                    const aDate = formatDateToString(a.attendance_date);
                    return aDate === dateStr;
                });
                
                // If no attendance record for this date, add leave record
                if (!existingAttendance) {
                    combinedData.push({
                        type: 'leave',
                        employee_id: leave.employee_id,
                        first_name: leave.first_name,
                        last_name: leave.last_name,
                        department: leave.department,
                        attendance_date: dateStr,
                        leave_type: leave.leave_type,
                        leave_reason: leave.reason,
                        status: 'on_leave',
                        clock_in: null,
                        clock_out: null,
                        total_hours: 0,
                        late_minutes: 0,
                        early_minutes: 0
                    });
                }
            }
        });

        // Calculate statistics
        const stats = {
            total: combinedData.length,
            present: combinedData.filter(a => a.status === 'present').length,
            half_day: combinedData.filter(a => a.status === 'half_day').length,
            absent: combinedData.filter(a => a.status === 'absent').length,
            on_leave: combinedData.filter(a => a.status === 'on_leave').length,
            late: combinedData.filter(a => parseFloat(a.late_minutes || 0) > 0).length,
            early: combinedData.filter(a => parseFloat(a.early_minutes || 0) > 0).length
        };

        // Add formatted display to each record
        const combinedWithDetails = combinedData.map(record => {
            const recordWithDetails = { ...record };
            
            if (record.late_minutes && record.late_minutes > 0) {
                const totalSeconds = Math.round(record.late_minutes * 60);
                if (totalSeconds < 60) {
                    recordWithDetails.late_text = `${totalSeconds}s`;
                } else {
                    const mins = Math.floor(totalSeconds / 60);
                    const secs = totalSeconds % 60;
                    recordWithDetails.late_text = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
                }
            }
            
            if (record.early_minutes && record.early_minutes > 0) {
                const totalSeconds = Math.round(record.early_minutes * 60);
                if (totalSeconds < 60) {
                    recordWithDetails.early_text = `${totalSeconds}s`;
                } else {
                    const mins = Math.floor(totalSeconds / 60);
                    const secs = totalSeconds % 60;
                    recordWithDetails.early_text = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
                }
            }
            
            return recordWithDetails;
        });

        console.log(`📊 Returning ${combinedWithDetails.length} records`);
        
        res.json({
            success: true,
            stats,
            attendance: combinedWithDetails
        });

    } catch (error) {
        console.error('❌ Error in getAttendanceReport:', error);
        console.error('❌ Error stack:', error.stack);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error code:', error.code);
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get attendance report',
            error: error.message,
            error_code: error.code
        });
    }
};

// Heartbeat
exports.heartbeat = async (req, res) => {
    try {
        const { employee_id, session_id, latitude, longitude } = req.body;

        await db.query(
            `UPDATE attendance_sessions 
             SET last_heartbeat = NOW(), 
                 latitude = COALESCE(?, latitude),
                 longitude = COALESCE(?, longitude)
             WHERE employee_id = ? AND session_id = ? AND is_active = true`,
            [latitude, longitude, employee_id, session_id]
        );

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
        const [activeSessions] = await db.query(
            `SELECT COUNT(*) as count FROM attendance_sessions 
             WHERE is_active = true`
        );

        console.log(`📊 Active sessions: ${activeSessions[0].count}`);

        // Optional: Send alerts for sessions inactive for too long
        const timeoutMinutes = 60; // Alert after 60 minutes of no heartbeat
        const [inactiveSessions] = await db.query(
            `SELECT * FROM attendance_sessions 
             WHERE is_active = true 
             AND last_heartbeat < DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
            [timeoutMinutes]
        );

        for (const session of inactiveSessions) {
            console.log(`⚠️ Session ${session.session_id} for employee ${session.employee_id} has been inactive for ${timeoutMinutes}+ minutes`);

            // You could send a notification to admin here
            // But DO NOT auto clock-out
        }

        return {
            success: true,
            active: activeSessions[0].count,
            inactive: inactiveSessions.length
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
        const [employees] = await db.query('SELECT employee_id FROM employees');
        let markedCount = 0;
        let updatedCount = 0;

        for (const emp of employees) {
            // Check if employee has attendance record for today
            const [attendance] = await db.query(
                'SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?',
                [emp.employee_id, today]
            );

            // If no record exists, create absent record
            if (attendance.length === 0) {
                await db.query(
                    `INSERT INTO attendance 
                     (employee_id, attendance_date, status) 
                     VALUES (?, ?, 'absent')`,
                    [emp.employee_id, today]
                );
                markedCount++;
                console.log(`✅ Marked absent for employee ${emp.employee_id}`);
            }
            // If record exists but has clock_in and no clock_out, mark as half_day (they forgot to clock out)
            else if (attendance[0].clock_in && !attendance[0].clock_out) {
                await db.query(
                    `UPDATE attendance 
                     SET status = 'half_day',
                         total_hours = TIMESTAMPDIFF(HOUR, clock_in, NOW())
                     WHERE employee_id = ? AND attendance_date = ?`,
                    [emp.employee_id, today]
                );
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



