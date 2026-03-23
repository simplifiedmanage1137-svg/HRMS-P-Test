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

// Helper function to parse time string (e.g., "3:00 PM" or "15:00")
const parseTimeString = (timeStr) => {
    if (!timeStr) return null;

    console.log('Parsing time string:', timeStr);
    
    // Handle "3:00 PM" or "03:00 PM" format
    const ampmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1]);
        const minute = parseInt(ampmMatch[2]);
        const ampm = ampmMatch[3].toUpperCase();
        
        console.log(`Found AMPM match - hour: ${hour}, minute: ${minute}, ampm: ${ampm}`);
        
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        
        console.log(`Converted to 24h: ${hour}:${minute}`);
        return { hour, minute };
    }
    
    // Handle military time "15:00"
    const militaryMatch = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        const hour = parseInt(militaryMatch[1]);
        const minute = parseInt(militaryMatch[2]);
        console.log(`Found military time: ${hour}:${minute}`);
        return { hour, minute };
    }
    
    console.log('No time format matched, using default 9:00');
    return { hour: 9, minute: 0 };
};

// Parse shift timing to get total hours
const parseShiftTiming = (shiftString) => {
    if (!shiftString) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

    const parts = shiftString.split('-');
    if (parts.length !== 2) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
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
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

    // Calculate exact total hours in minutes then convert
    const startTotalMinutes = (startTime.hour * 60) + startTime.minute;
    const endTotalMinutes = (endTime.hour * 60) + endTime.minute;
    let totalMinutes = endTotalMinutes - startTotalMinutes;

    if (totalMinutes < 0) totalMinutes += 24 * 60;

    const totalHours = totalMinutes / 60;

    return {
        startHour: startTime.hour,
        startMinute: startTime.minute,
        endHour: endTime.hour,
        endMinute: endTime.minute,
        totalHours: totalHours
    };
};

// Calculate overtime (only full hours count)
const calculateOvertime = (totalHours, shiftHours) => {
    const standardShiftHours = shiftHours || 9;

    // Only full hours above shift count as overtime
    const overtimeHours = Math.floor(Math.max(0, totalHours - standardShiftHours));
    const overtimeMinutes = overtimeHours * 60;

    return {
        overtimeHours,
        overtimeMinutes,
        hasOvertime: overtimeHours > 0,
        overtimeAmount: overtimeHours * 150 // ₹150 per hour
    };
};

// Check if a date is a holiday
const isHoliday = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const dayOfWeek = date.getDay();

    if (dayOfWeek === 0 || dayOfWeek === 6) {
        return {
            isHoliday: true,
            type: 'weekly_off',
            name: dayOfWeek === 0 ? 'Sunday' : 'Saturday'
        };
    }

    const holiday = holidays.find(h => h.date === dateStr);
    if (holiday) {
        return {
            isHoliday: true,
            type: 'public_holiday',
            name: holiday.name,
            region: holiday.region
        };
    }

    return { isHoliday: false };
};

// Calculate total working hours with exact minutes
const calculateTotalWorkingHours = (clockInTime, clockOutTime) => {
    if (!clockInTime || !clockOutTime) return 0;

    const clockIn = new Date(clockInTime);
    const clockOut = new Date(clockOutTime);

    const diffMs = clockOut - clockIn;
    const diffMinutes = diffMs / (1000 * 60);
    const totalHours = diffMinutes / 60;

    // Round to 2 decimal places for display
    return Math.round(totalHours * 100) / 100;
};

// Format late time for display
const formatLateTime = (lateMinutes) => {
    if (!lateMinutes || lateMinutes <= 0) return null;

    const totalMinutes = lateMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const remainingMinutes = Math.floor(totalMinutes % 60);
    const seconds = Math.round((totalMinutes - Math.floor(totalMinutes)) * 60);

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

// Clock In function - FIXED
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
        
        console.log('📋 Employee data:', {
            employee_id: emp.employee_id,
            first_name: emp.first_name,
            last_name: emp.last_name,
            shift_timing: emp.shift_timing,
            shift_timing_type: typeof emp.shift_timing
        });

        // Get current time in LOCAL timezone
        const now = new Date();

        // Get date components in LOCAL timezone
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const today = `${year}-${month}-${day}`;

        const currentTimeStr = now.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });

        const sessionId = generateSessionId();

        console.log('Employee:', emp.first_name, emp.last_name);
        console.log('Today date (LOCAL):', today);
        console.log('Clock in time (LOCAL):', now.toString());
        console.log('Clock in time (LOCAL formatted):', currentTimeStr);

        const holidayCheck = isHoliday(now);
        console.log('📅 Holiday check:', holidayCheck);

        // ========== FIXED SHIFT TIMING PARSING ==========
        let shiftHour = 9, shiftMinute = 0;
        let shiftDisplay = emp.shift_timing || '9:00 AM';
        
        // Parse shift timing to get start time
        if (emp.shift_timing) {
            console.log('🔍 Parsing shift timing:', emp.shift_timing);
            
            // Try to extract the start time from shift_timing (format like "3:00 PM - 12:00 AM")
            let startTimeStr = emp.shift_timing;
            
            // If it contains a dash, take the first part
            if (startTimeStr.includes('-')) {
                startTimeStr = startTimeStr.split('-')[0].trim();
                console.log('📅 Extracted start time:', startTimeStr);
            }
            
            // Parse the time string
            const timeMatch = startTimeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
            if (timeMatch) {
                let hour = parseInt(timeMatch[1]);
                const minute = parseInt(timeMatch[2]);
                const ampm = timeMatch[3].toUpperCase();
                
                console.log(`Found time match - hour: ${hour}, minute: ${minute}, ampm: ${ampm}`);
                
                if (ampm === 'PM' && hour !== 12) hour += 12;
                if (ampm === 'AM' && hour === 12) hour = 0;
                
                shiftHour = hour;
                shiftMinute = minute;
                console.log(`✅ Parsed shift start: ${shiftHour}:${shiftMinute} (${shiftHour.toString().padStart(2, '0')}:${shiftMinute.toString().padStart(2, '0')})`);
            } else {
                // Try military time
                const militaryMatch = startTimeStr.match(/(\d{1,2}):(\d{2})/);
                if (militaryMatch) {
                    shiftHour = parseInt(militaryMatch[1]);
                    shiftMinute = parseInt(militaryMatch[2]);
                    console.log(`✅ Parsed military shift start: ${shiftHour}:${shiftMinute}`);
                } else {
                    console.log(`⚠️ Could not parse shift timing: ${emp.shift_timing}, using default 9:00 AM`);
                }
            }
        }

        // Create shift start time for today using LOCAL time components
        const shiftStartTime = new Date(year, now.getMonth(), now.getDate(), shiftHour, shiftMinute, 0, 0);

        console.log(`⏰ Shift start time (LOCAL): ${shiftStartTime.toLocaleString()}`);
        console.log(`⏰ Shift start time (ISO): ${shiftStartTime.toISOString()}`);
        console.log(`⏰ Clock in time (LOCAL): ${now.toLocaleString()}`);
        console.log(`⏰ Clock in time (ISO): ${now.toISOString()}`);
        
        // Calculate exact late minutes
        const diffMs = now - shiftStartTime;
        const isLate = diffMs > 0;
        const isEarly = diffMs < 0;

        // Calculate exact minutes
        let lateMinutes = 0;
        let earlyMinutes = 0;

        if (isLate) {
            lateMinutes = diffMs / (1000 * 60);
            console.log(`❌ LATE DETECTED! Late by: ${lateMinutes} minutes`);
            console.log(`   = ${Math.floor(lateMinutes)} minutes and ${Math.round((lateMinutes % 1) * 60)} seconds`);
            console.log(`   Shift start: ${shiftStartTime.toLocaleTimeString()}`);
            console.log(`   Clock in: ${now.toLocaleTimeString()}`);
        } else if (isEarly) {
            earlyMinutes = Math.abs(diffMs) / (1000 * 60);
            console.log(`✅ EARLY: ${earlyMinutes} minutes early`);
        } else {
            console.log(`✅ ON TIME: Exactly at shift start`);
        }

        // Format late display for response
        let lateDisplay = null;
        if (isLate) {
            const totalSeconds = Math.floor(lateMinutes * 60);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            if (minutes === 0) {
                lateDisplay = `${seconds}s`;
            } else if (seconds === 0) {
                lateDisplay = `${minutes}m`;
            } else {
                lateDisplay = `${minutes}m ${seconds}s`;
            }
            console.log(`📊 Late display formatted: ${lateDisplay}`);
        }

        // Round to 2 decimal places for storage
        const lateMinutesToSave = isLate ? parseFloat(lateMinutes.toFixed(2)) : 0;
        const earlyMinutesToSave = isEarly ? parseFloat(earlyMinutes.toFixed(2)) : 0;

        console.log(`📊 FINAL VALUES TO SAVE:`);
        console.log(`   isLate: ${isLate}`);
        console.log(`   late_minutes: ${lateMinutesToSave}`);
        console.log(`   late_display: ${lateDisplay}`);
        console.log(`   shift_start: ${shiftHour}:${shiftMinute}`);
        console.log(`   shift_display: ${shiftDisplay}`);
        console.log(`   clock_in_time: ${currentTimeStr}`);

        try {
            // First, check if there's already an attendance record for today
            const { data: existingAttendance, error: checkError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('attendance_date', today)
                .limit(1);

            if (checkError) throw checkError;

            if (existingAttendance && existingAttendance.length > 0) {
                console.log('⚠️ Attendance record already exists for today!');
                return res.status(400).json({
                    success: false,
                    message: 'You have already clocked in today'
                });
            }

            // Insert attendance record with exact late minutes
            const attendanceData = {
                employee_id,
                attendance_date: today,
                clock_in: now.toISOString(),
                late_minutes: lateMinutesToSave,
                early_minutes: earlyMinutesToSave,
                latitude,
                longitude,
                location_accuracy: accuracy,
                session_id: sessionId,
                shift_time_used: shiftDisplay,
                is_holiday: holidayCheck.isHoliday,
                holiday_name: holidayCheck.name || null
            };

            console.log('📝 Inserting attendance with data:', JSON.stringify(attendanceData, null, 2));

            const { error: attendanceError } = await supabase
                .from('attendance')
                .insert([attendanceData]);

            if (attendanceError) {
                console.error('❌ Attendance insert error:', attendanceError);
                throw attendanceError;
            }

            console.log(`✅ Attendance record inserted successfully!`);
            console.log(`   late_minutes: ${lateMinutesToSave}`);
            console.log(`   late_display: ${lateDisplay}`);

            // Create or update session
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

            if (sessionError) {
                console.error('❌ Session insert error:', sessionError);
                // Don't throw here, attendance is already recorded
                console.log('⚠️ Session insert failed but attendance recorded');
            }

            // Format response message
            let status = 'On Time';
            let message = '✅ Clocked in on time';

            if (isLate) {
                status = 'Late';
                message = `⚠️ Clocked in (${lateDisplay} late)`;
                console.log(`⚠️ MARKED AS LATE: ${lateDisplay} (${lateMinutes} minutes)`);
            } else if (isEarly) {
                status = 'Early';
                const totalSeconds = Math.floor(earlyMinutes * 60);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;
                const earlyDisplay = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
                message = `⏰ Clocked in (${earlyDisplay} early)`;
            }

            if (holidayCheck.isHoliday) {
                message = `🏢 ${message} - Working on ${holidayCheck.name || holidayCheck.type}`;
            }

            const response = {
                success: true,
                message,
                clock_in: now,
                clock_in_time: currentTimeStr,
                shift_time: shiftDisplay,
                shift_start: `${shiftHour.toString().padStart(2, '0')}:${shiftMinute.toString().padStart(2, '0')}`,
                status,
                is_late: isLate,
                is_early: isEarly,
                session_id: sessionId,
                employee_name: `${emp.first_name} ${emp.last_name}`,
                attendance_date: today,
                is_holiday: holidayCheck.isHoliday,
                holiday_name: holidayCheck.name || null
            };

            if (isLate) {
                response.late_minutes = lateMinutesToSave;
                response.late_display = lateDisplay;
            }
            if (isEarly) {
                response.early_minutes = earlyMinutesToSave;
                response.early_display = earlyDisplay;
            }

            console.log('✅ Clock-in Response:', JSON.stringify(response, null, 2));
            console.log(`📊 Late minutes saved: ${lateMinutesToSave}, Display: ${lateDisplay}`);

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

// Clock out with exact working hours calculation
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
        console.log(`📅 Holiday check for ${today}:`, holidayCheck);

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

            console.log('Using fallback session:', fallbackSessions[0].session_id);
            session = fallbackSessions[0];

            // Find attendance record for this session
            const { data: attendanceRecords, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('session_id', session.session_id)
                .is('clock_out', null);

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
            console.log('✅ Found active session:', session);

            // Find the corresponding attendance record
            const { data: attendanceRecords, error: attendanceError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('session_id', session_id)
                .is('clock_out', null);

            if (attendanceError) {
                console.error('❌ Attendance record error:', attendanceError);
                throw attendanceError;
            }

            if (!attendanceRecords || attendanceRecords.length === 0) {
                // Try without session_id filter as fallback
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

        // Calculate exact hours with minutes precision
        const clockIn = new Date(attendanceRecord.clock_in);
        const totalMinutes = calculateTimeDifferenceInMinutes(clockIn, now);
        const totalHours = totalMinutes / 60;

        // Round to 2 decimal places for accurate display
        const totalHoursRounded = Math.round(totalHours * 100) / 100;
        const totalMinutesRounded = Math.round(totalMinutes);

        console.log(`📊 Hours calculated: ${totalHoursRounded} hours (${totalMinutesRounded} minutes)`);
        console.log(`   Clock In: ${clockIn.toLocaleTimeString()}`);
        console.log(`   Clock Out: ${now.toLocaleTimeString()}`);
        console.log(`   Difference: ${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`);

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

        const overtime = calculateOvertime(totalHoursRounded, shiftHours);

        console.log(`📊 Hours worked: ${totalHoursRounded}h, Shift: ${shiftHours}h, Overtime: ${overtime.overtimeHours}h`);

        let compOffAwarded = false;
        let compOffDays = 0;

        // Check if employee worked on a holiday (8+ hours)
        if (holidayCheck.isHoliday && totalHoursRounded >= 8) {
            compOffAwarded = true;
            compOffDays = 1.0;

            console.log(`🎉 Employee worked on ${holidayCheck.type}: ${holidayCheck.name}. Awarding ${compOffDays} comp-off day!`);

            try {
                // Insert into comp_off_earnings table
                const { error: compOffError } = await supabase
                    .from('comp_off_earnings')
                    .insert([{
                        employee_id,
                        attendance_date: today,
                        holiday_name: holidayCheck.name || holidayCheck.type,
                        hours_worked: totalHoursRounded,
                        comp_off_days: compOffDays,
                        is_used: false
                    }]);

                if (compOffError) {
                    console.error('❌ Error inserting comp-off earning:', compOffError);
                } else {
                    // Update employee's comp_off_balance
                    const { error: updateError } = await supabase
                        .from('employees')
                        .update({
                            comp_off_balance: supabase.raw('COALESCE(comp_off_balance, 0) + ?', [compOffDays]),
                            total_comp_off_earned: supabase.raw('COALESCE(total_comp_off_earned, 0) + ?', [compOffDays])
                        })
                        .eq('employee_id', employee_id);

                    if (updateError) {
                        console.error('❌ Error updating comp-off balance:', updateError);
                    }
                }
            } catch (compOffErr) {
                console.error('❌ Comp-off processing error:', compOffErr);
                // Continue even if comp-off fails
            }
        }

        // Save overtime earnings if any
        if (overtime.hasOvertime) {
            try {
                const { error: overtimeError } = await supabase
                    .from('overtime_earnings')
                    .insert([{
                        employee_id,
                        attendance_date: today,
                        overtime_minutes: overtime.overtimeMinutes,
                        overtime_hours: overtime.overtimeHours,
                        overtime_amount: overtime.overtimeAmount,
                        is_paid: false
                    }]);

                if (overtimeError) {
                    console.error('❌ Error inserting overtime earnings:', overtimeError);
                }
            } catch (overtimeErr) {
                console.error('❌ Overtime processing error:', overtimeErr);
                // Continue even if overtime fails
            }
        }

        // Determine status based on total minutes (not rounded hours)
        let status = 'present';
        if (totalMinutes < 240) { // Less than 4 hours
            status = 'absent';
        } else if (totalMinutes < 480) { // Less than 8 hours but >= 4 hours
            status = 'half_day';
        }

        console.log(`📊 Status: ${status} (based on ${totalMinutes} minutes)`);

        // Prepare update data with exact minutes
        const updateData = {
            clock_out: now.toISOString(),
            total_hours: totalHoursRounded,
            total_minutes: totalMinutesRounded,
            status: status,
            latitude: latitude || attendanceRecord.latitude,
            longitude: longitude || attendanceRecord.longitude,
            location_accuracy: accuracy || attendanceRecord.location_accuracy,
            is_holiday: holidayCheck.isHoliday || false,
            holiday_name: holidayCheck.name || null,
            comp_off_awarded: compOffAwarded || false,
            comp_off_days: compOffDays || 0,
            overtime_minutes: overtime.overtimeMinutes || 0,
            overtime_hours: overtime.overtimeHours || 0,
            overtime_amount: overtime.overtimeAmount || 0
        };

        console.log('📝 Updating attendance with:', {
            ...updateData,
            total_hours_display: `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`
        });

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

        // Format total hours for display
        const totalHoursDisplay = `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`;

        let message = '';
        if (compOffAwarded) {
            message = `✅ Clocked out successfully! 🎉 You earned ${compOffDays} Comp-Off day for working on ${holidayCheck.name || holidayCheck.type}! Total hours: ${totalHoursDisplay}`;
        } else if (overtime.hasOvertime) {
            message = `✅ Clocked out successfully! Total hours: ${totalHoursDisplay} (${overtime.overtimeHours} hour(s) overtime! ₹${overtime.overtimeAmount})`;
        } else {
            message = `✅ Clocked out successfully. Total hours: ${totalHoursDisplay} (${status === 'present' ? 'Full day' : status === 'half_day' ? 'Half day' : 'Absent'})`;
        }

        res.json({
            success: true,
            message,
            clock_out: now,
            total_hours: totalHoursRounded,
            total_minutes: totalMinutesRounded,
            total_hours_display: totalHoursDisplay,
            status,
            session_id: session.session_id,
            comp_off_awarded: compOffAwarded,
            comp_off_days: compOffDays,
            holiday_worked: holidayCheck.isHoliday ? holidayCheck.name || holidayCheck.type : null,
            overtime: {
                hours: overtime.overtimeHours,
                minutes: overtime.overtimeMinutes,
                amount: overtime.overtimeAmount,
                hasOvertime: overtime.hasOvertime
            }
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

// Get today's attendance - UPDATED with proper late display
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
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        console.log('📊 Today date:', todayStr);

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

        const { data: todayAttendance, error: attendanceError } = await supabase
            .from('attendance')
            .select(`
                *,
                employees!inner(first_name, last_name, shift_timing, comp_off_balance)
            `)
            .eq('employee_id', employee_id)
            .eq('attendance_date', todayStr)
            .order('clock_in', { ascending: false })
            .limit(1);

        if (attendanceError) throw attendanceError;

        console.log('📊 Today attendance records found:', todayAttendance?.length || 0);
        
        // Log the raw data from database to debug
        if (todayAttendance && todayAttendance.length > 0) {
            console.log('📊 RAW attendance record:', {
                id: todayAttendance[0].id,
                late_minutes: todayAttendance[0].late_minutes,
                clock_in: todayAttendance[0].clock_in,
                clock_out: todayAttendance[0].clock_out,
                attendance_date: todayAttendance[0].attendance_date
            });
        }

        const { data: activeSession, error: sessionError } = await supabase
            .from('attendance_sessions')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('is_active', true);

        if (sessionError) throw sessionError;

        console.log('📊 Active session found:', activeSession?.length || 0);

        let formattedAttendance = null;

        if (todayAttendance && todayAttendance.length > 0) {
            formattedAttendance = { ...todayAttendance[0] };

            if (formattedAttendance.employees) {
                formattedAttendance.first_name = formattedAttendance.employees.first_name;
                formattedAttendance.last_name = formattedAttendance.employees.last_name;
                formattedAttendance.shift_timing = formattedAttendance.employees.shift_timing;
                formattedAttendance.comp_off_balance = formattedAttendance.employees.comp_off_balance;
                delete formattedAttendance.employees;
            }

            // Format late minutes for display
            const rawLateMinutes = formattedAttendance.late_minutes;
            console.log(`📊 Raw late_minutes from DB: ${rawLateMinutes} (type: ${typeof rawLateMinutes})`);
            
            // Set late display if there are late minutes
            if (rawLateMinutes && parseFloat(rawLateMinutes) > 0) {
                formattedAttendance.late_display = formatLateTime(rawLateMinutes);
                formattedAttendance.late_minutes = parseFloat(rawLateMinutes);
                console.log(`✅ Set late_display: ${formattedAttendance.late_display} for ${rawLateMinutes} minutes`);
            } else {
                formattedAttendance.late_display = null;
                formattedAttendance.late_minutes = 0;
                console.log(`✅ No late minutes (${rawLateMinutes})`);
            }

            // Format early minutes if any
            if (formattedAttendance.early_minutes && formattedAttendance.early_minutes > 0) {
                const totalSeconds = Math.round(formattedAttendance.early_minutes * 60);
                const minutes = Math.floor(totalSeconds / 60);
                const seconds = totalSeconds % 60;

                if (minutes === 0) {
                    formattedAttendance.early_display = `Early ${seconds}s`;
                } else if (seconds === 0) {
                    formattedAttendance.early_display = `Early ${minutes}m`;
                } else {
                    formattedAttendance.early_display = `Early ${minutes}m ${seconds}s`;
                }
            }

            // Calculate current working hours if still working
            if (formattedAttendance.clock_in && !formattedAttendance.clock_out) {
                const clockIn = new Date(formattedAttendance.clock_in);
                const now = new Date();
                const currentMinutes = (now - clockIn) / (1000 * 60);
                const currentHours = currentMinutes / 60;
                formattedAttendance.current_hours = Math.round(currentHours * 100) / 100;

                const hours = Math.floor(currentMinutes / 60);
                const minutes = Math.round(currentMinutes % 60);
                formattedAttendance.current_hours_display = `${hours}h ${minutes}m`;
                formattedAttendance.total_hours_display = `${hours}h ${minutes}m`;
            } else if (formattedAttendance.total_minutes && formattedAttendance.total_minutes > 0) {
                const minutes = formattedAttendance.total_minutes;
                const hours = Math.floor(minutes / 60);
                const mins = Math.round(minutes % 60);
                formattedAttendance.total_hours_display = `${hours}h ${mins}m`;
            } else if (formattedAttendance.total_hours && formattedAttendance.total_hours > 0) {
                const totalHours = formattedAttendance.total_hours;
                const totalMinutes = totalHours * 60;
                const hours = Math.floor(totalMinutes / 60);
                const mins = Math.round(totalMinutes % 60);
                formattedAttendance.total_hours_display = `${hours}h ${mins}m`;
            }

            console.log('📊 Today\'s attendance:', {
                date: formattedAttendance.attendance_date,
                clock_in: formattedAttendance.clock_in ? new Date(formattedAttendance.clock_in).toLocaleTimeString() : 'No',
                clock_out: formattedAttendance.clock_out ? new Date(formattedAttendance.clock_out).toLocaleTimeString() : 'No',
                total_hours: formattedAttendance.total_hours_display || 'N/A',
                is_holiday: formattedAttendance.is_holiday,
                late_display: formattedAttendance.late_display,
                late_minutes: formattedAttendance.late_minutes
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

// Get attendance report with exact time calculations - UPDATED
exports.getAttendanceReport = async (req, res) => {
    try {
        const { start, end, employee_id } = req.query;

        console.log('📊 Getting attendance report from', start, 'to', end, 'for employee:', employee_id);

        if (!start || !end) {
            console.log('❌ Missing start or end date');
            return res.status(400).json({
                success: false,
                message: 'Start and end dates are required'
            });
        }

        let query = supabase
            .from('attendance')
            .select(`
                *,
                employees (
                    first_name, 
                    last_name, 
                    department, 
                    shift_timing,
                    comp_off_balance
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

        const formattedAttendance = (attendance || []).map(record => {
            const employee = record.employees || {};

            // Format total hours display
            let totalHoursDisplay = '0h 0m';
            if (record.total_minutes) {
                totalHoursDisplay = `${Math.floor(record.total_minutes / 60)}h ${Math.round(record.total_minutes % 60)}m`;
            } else if (record.total_hours) {
                const totalMinutes = record.total_hours * 60;
                totalHoursDisplay = `${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`;
            }

            // Format late minutes display
            let lateDisplay = null;
            let formattedLateMinutes = null;

            if (record.late_minutes && record.late_minutes > 0) {
                formattedLateMinutes = parseFloat(record.late_minutes);
                lateDisplay = formatLateTime(formattedLateMinutes);
                console.log(`📊 Record for ${record.attendance_date}: late_minutes=${formattedLateMinutes}, late_display=${lateDisplay}`);
            }

            return {
                id: record.id,
                employee_id: record.employee_id,
                attendance_date: record.attendance_date,
                clock_in: record.clock_in,
                clock_out: record.clock_out,
                total_hours: record.total_hours,
                total_minutes: record.total_minutes,
                total_hours_display: totalHoursDisplay,
                status: record.status,
                late_minutes: formattedLateMinutes,
                late_display: lateDisplay,
                early_minutes: record.early_minutes,
                shift_time_used: record.shift_time_used,
                is_holiday: record.is_holiday,
                holiday_name: record.holiday_name,
                comp_off_awarded: record.comp_off_awarded,
                comp_off_days: record.comp_off_days,
                overtime_minutes: record.overtime_minutes || 0,
                overtime_hours: record.overtime_hours || 0,
                overtime_amount: record.overtime_amount || 0,
                first_name: employee.first_name || '',
                last_name: employee.last_name || '',
                department: employee.department || '',
                shift_timing: employee.shift_timing || '',
                comp_off_balance: employee.comp_off_balance || 0,
                employees: undefined
            };
        });

        // Log records with late marks for debugging
        const lateRecords = formattedAttendance.filter(a => a.late_minutes > 0);
        console.log(`📊 Records with late marks: ${lateRecords.length}`);
        lateRecords.forEach(record => {
            console.log(`   ${record.attendance_date}: ${record.late_display} (${record.late_minutes} minutes)`);
        });

        // Calculate stats with exact minutes
        let totalWorkingMinutes = 0;
        formattedAttendance.forEach(a => {
            if (a.total_minutes) {
                totalWorkingMinutes += a.total_minutes;
            } else if (a.total_hours) {
                totalWorkingMinutes += a.total_hours * 60;
            }
        });

        const totalWorkingHours = totalWorkingMinutes / 60;

        res.json({
            success: true,
            attendance: formattedAttendance,
            stats: {
                total: formattedAttendance.length,
                present: formattedAttendance.filter(a => a.status === 'present').length,
                half_day: formattedAttendance.filter(a => a.status === 'half_day').length,
                absent: formattedAttendance.filter(a => a.status === 'absent').length,
                comp_off_earned: formattedAttendance.filter(a => a.comp_off_awarded).length,
                total_overtime_hours: formattedAttendance.reduce((sum, a) => sum + (a.overtime_hours || 0), 0),
                total_overtime_amount: formattedAttendance.reduce((sum, a) => sum + (a.overtime_amount || 0), 0),
                total_working_minutes: totalWorkingMinutes,
                total_working_hours: Math.round(totalWorkingHours * 100) / 100,
                total_working_hours_display: `${Math.floor(totalWorkingMinutes / 60)}h ${Math.round(totalWorkingMinutes % 60)}m`
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

// Check active sessions
exports.checkActiveSessions = async () => {
    try {
        const { count: activeCount, error: countError } = await supabase
            .from('attendance_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('is_active', true);

        if (countError) throw countError;

        console.log(`📊 Active sessions: ${activeCount}`);

        const timeoutMinutes = 60;
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

// Mark absent for employees who didn't punch in
exports.markAbsentAtDayEnd = async () => {
    try {
        const today = new Date().toISOString().split('T')[0];
        const now = new Date();

        console.log('📝 Running end-of-day absent marking for:', today);

        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('employee_id');

        if (empError) throw empError;

        let markedCount = 0;
        let updatedCount = 0;

        for (const emp of employees || []) {
            const { data: attendance, error: attError } = await supabase
                .from('attendance')
                .select('*')
                .eq('employee_id', emp.employee_id)
                .eq('attendance_date', today);

            if (attError) throw attError;

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
            else if (attendance[0].clock_in && !attendance[0].clock_out) {
                const clockIn = new Date(attendance[0].clock_in);
                const totalMinutes = calculateTimeDifferenceInMinutes(clockIn, now);
                const totalHours = totalMinutes / 60;

                const { error: updateError } = await supabase
                    .from('attendance')
                    .update({
                        status: 'half_day',
                        total_hours: totalHours,
                        total_minutes: totalMinutes
                    })
                    .eq('id', attendance[0].id);

                if (updateError) throw updateError;
                updatedCount++;
                console.log(`⚠️ Auto-marked half_day for employee ${emp.employee_id} (forgot to clock out) - ${Math.floor(totalMinutes / 60)}h ${Math.round(totalMinutes % 60)}m`);
            }
        }

        console.log(`✅ End-of-day absent marking completed. Marked ${markedCount} absent, updated ${updatedCount} half_day.`);
        return { success: true, message: `Marked ${markedCount} absent, ${updatedCount} half_day` };

    } catch (error) {
        console.error('Error marking absent:', error);
        return { success: false, error: error.message };
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
        res.status(500).json({
            success: false,
            message: 'Failed to fetch comp-off balance',
            error: error.message
        });
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

        res.json({
            success: true,
            earnings: data || []
        });

    } catch (error) {
        console.error('Error fetching comp-off history:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch comp-off history',
            error: error.message
        });
    }
};

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
            success: true,
            employee_id,
            month,
            year,
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
        res.status(500).json({
            success: false,
            message: 'Failed to fetch overtime summary',
            error: error.message
        });
    }
};

module.exports = exports;