const LeaveYearlyService = require('../services/leaveYearlyService');
const db = require('../config/database');



// Get leave balance for employee
exports.getLeaveBalance = async (req, res) => {
    try {
        const { employee_id } = req.params;

        console.log('Fetching leave balance for employee:', employee_id);

        if (!employee_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Employee ID is required' 
            });
        }

        // Get employee joining date
        const [employee] = await db.query(
            'SELECT joining_date FROM employees WHERE employee_id = ?',
            [employee_id]
        );

        if (employee.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Employee not found' 
            });
        }

        const today = new Date();
        const joiningDate = new Date(employee[0].joining_date);

        console.log('Joining Date:', employee[0].joining_date);
        console.log('Current Date:', today);

        // ===== CORRECT ELIGIBILITY CALCULATION =====
        // Calculate total months from joining date (not calendar year based)
        let totalMonths = (today.getFullYear() - joiningDate.getFullYear()) * 12 
                        + (today.getMonth() - joiningDate.getMonth());
        
        // Adjust for day of month
        if (today.getDate() < joiningDate.getDate()) {
            totalMonths -= 1;
        }
        
        // Ensure not negative
        totalMonths = Math.max(0, totalMonths);

        // Calculate eligibility based on joining date + 6 months
        const sixMonthsFromJoining = new Date(joiningDate);
        sixMonthsFromJoining.setMonth(sixMonthsFromJoining.getMonth() + 6);
        
        // Check if today is on or after the eligibility date
        const isEligibleToApply = today >= sixMonthsFromJoining;

        // Format eligible from date (joining date + 6 months)
        const eligibleFromDate = sixMonthsFromJoining.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        console.log('Eligibility Check:', {
            joiningDate: joiningDate.toISOString(),
            sixMonthsFromJoining: sixMonthsFromJoining.toISOString(),
            today: today.toISOString(),
            totalMonthsFromJoining: totalMonths,  // Yeh sahi hoga
            isEligible: isEligibleToApply
        });

        // ===== ACCRUAL CALCULATION (Calendar year based - yeh sahi hai) =====
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        
        const joinYear = joiningDate.getFullYear();
        const joinMonth = joiningDate.getMonth() + 1;

        // Calculate completed months in CURRENT YEAR only (for accrual)
        let completedMonthsInCurrentYear = 0;
        
        if (currentYear > joinYear) {
            // Employee joined in previous year
            // Count all completed months in current year up to previous month
            for (let month = 1; month <= currentMonth; month++) {
                if (month < currentMonth) {
                    // Previous months are fully completed
                    completedMonthsInCurrentYear++;
                } else if (month === currentMonth) {
                    // Current month - check if it's complete
                    const lastDayOfMonth = new Date(currentYear, month, 0).getDate();
                    if (currentDay > lastDayOfMonth) {
                        completedMonthsInCurrentYear++;
                    }
                }
            }
        } else if (currentYear === joinYear) {
            // Employee joined in current year
            // Count months from join month up to previous month
            for (let month = joinMonth; month <= currentMonth; month++) {
                if (month < currentMonth) {
                    completedMonthsInCurrentYear++;
                } else if (month === currentMonth) {
                    const lastDayOfMonth = new Date(currentYear, month, 0).getDate();
                    if (currentDay > lastDayOfMonth) {
                        completedMonthsInCurrentYear++;
                    }
                }
            }
        }

        console.log('Completed months in current year (for accrual):', completedMonthsInCurrentYear);

        // Calculate accrued leaves for current year
        const totalAccrued = completedMonthsInCurrentYear * 1.5;

        console.log('Total accrued for current year:', totalAccrued);

        // Get current year balance from database
        let [balance] = await db.query(
            'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
            [employee_id, currentYear]
        );

        // If no balance record exists for current year, create one
        if (balance.length === 0) {
            console.log(`Creating new balance for ${employee_id} in ${currentYear}`);
            
            await db.query(
                `INSERT INTO leave_balance 
                 (employee_id, leave_year, total_accrued, total_used, total_pending, current_balance) 
                 VALUES (?, ?, ?, 0, 0, ?)`,
                [employee_id, currentYear, totalAccrued, totalAccrued]
            );
            
            [balance] = await db.query(
                'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
                [employee_id, currentYear]
            );
        }

        const currentBalance = balance[0];
        
        // Parse values to numbers
        const dbTotalAccrued = parseFloat(currentBalance.total_accrued) || 0;
        const totalUsed = parseFloat(currentBalance.total_used) || 0;
        const totalPending = parseFloat(currentBalance.total_pending) || 0;
        
        // Use the larger of database value or calculated value
        const finalTotalAccrued = Math.max(dbTotalAccrued, totalAccrued);
        
        // Calculate available using formula: Available = Total Accrued - Used - Pending
        const calculatedAvailable = finalTotalAccrued - totalUsed - totalPending;
        
        // Update database if needed
        if (dbTotalAccrued !== finalTotalAccrued) {
            console.log('Updating database with correct accrued:', finalTotalAccrued);
            await db.query(
                `UPDATE leave_balance 
                 SET total_accrued = ?, current_balance = ? 
                 WHERE employee_id = ? AND leave_year = ?`,
                [finalTotalAccrued, calculatedAvailable, employee_id, currentYear]
            );
        }

        const response = {
            success: true,
            employee_id,
            total_accrued: finalTotalAccrued.toFixed(1),
            used: totalUsed.toFixed(1),
            pending: totalPending.toFixed(1),
            available: calculatedAvailable.toFixed(1),
            monthly_accrual: 1.5,
            joining_date: employee[0].joining_date,
            months_completed: totalMonths,  // AB YEH SAHI HOGA - joining date se calculate
            completed_months_in_year: completedMonthsInCurrentYear,
            is_eligible: isEligibleToApply,
            eligible_from_date: eligibleFromDate,
            leave_year: currentYear,
            next_accrual_date: new Date(currentYear, currentMonth, 1).toISOString().split('T')[0],
            message: `Leaves for year ${currentYear} only. Previous year leaves expired on Dec 31.`
        };

        console.log('Sending response:', response);
        res.json(response);

    } catch (error) {
        console.error('Error in getLeaveBalance:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching leave balance',
            error: error.message
        });
    }
};

// Apply for leave
exports.applyLeave = async (req, res) => {
    try {
        console.log('='.repeat(50));
        console.log('LEAVE APPLICATION RECEIVED');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('='.repeat(50));

        const {
            leave_type,
            leave_duration,
            start_date,
            end_date,
            half_day_type,
            reason,
            reporting_manager
        } = req.body;

        const employee_id = req.headers['employee-id'] || req.body.employee_id;

        if (!employee_id) {
            return res.status(400).json({ 
                success: false, 
                message: 'Employee ID is required' 
            });
        }

        // Calculate number of days
        let numberOfDays = 1;
        
        if (leave_duration === 'Half Day') {
            numberOfDays = 0.5;
        } else if (leave_duration === 'Full Day' && start_date && end_date && start_date !== end_date) {
            const start = new Date(start_date);
            const end = new Date(end_date);
            const diffTime = Math.abs(end - start);
            numberOfDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        }

        console.log('Number of days requested:', numberOfDays);

        // Check if employee exists
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

        // Check if employee has completed 6 months from joining date
        const joiningDate = new Date(emp.joining_date);
        const today = new Date();
        const sixMonthsFromJoining = new Date(joiningDate);
        sixMonthsFromJoining.setMonth(sixMonthsFromJoining.getMonth() + 6);
        
        const isEligible = today >= sixMonthsFromJoining;

        console.log('Eligibility Check:', {
            joiningDate: joiningDate.toISOString(),
            sixMonthsFromJoining: sixMonthsFromJoining.toISOString(),
            today: today.toISOString(),
            isEligible,
            leave_type
        });

        // If not eligible, only allow Unpaid Leave
        if (!isEligible && leave_type !== 'Unpaid') {
            const eligibleDate = sixMonthsFromJoining.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            return res.status(403).json({ 
                success: false, 
                message: `During probation (until ${eligibleDate}), you can only apply for Unpaid Leave.` 
            });
        }

        // Get current year
        const currentYear = today.getFullYear();
        
        // Get or create leave balance
        let [balance] = await db.query(
            'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
            [employee_id, currentYear]
        );

        // If no balance record exists, create one
        if (balance.length === 0) {
            console.log('No balance record found, creating new one');
            
            // Calculate completed months in current year
            const currentMonth = today.getMonth() + 1;
            const currentDay = today.getDate();
            
            // Count completed months (months that are fully finished)
            let completedMonths = 0;
            for (let m = 1; m <= currentMonth; m++) {
                if (m < currentMonth) {
                    completedMonths++;
                } else if (m === currentMonth) {
                    // Check if current month is complete (past last day)
                    const lastDayOfMonth = new Date(currentYear, m, 0).getDate();
                    if (currentDay > lastDayOfMonth) {
                        completedMonths++;
                    }
                }
            }

            const initialAccrued = completedMonths * 1.5;

            await db.query(
                `INSERT INTO leave_balance 
                 (employee_id, leave_year, total_accrued, total_used, total_pending, current_balance) 
                 VALUES (?, ?, ?, 0, 0, ?)`,
                [employee_id, currentYear, initialAccrued, initialAccrued]
            );
            
            [balance] = await db.query(
                'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
                [employee_id, currentYear]
            );
        }

        const currentBalance = balance[0];
        
        // Parse values to numbers
        const totalAccrued = parseFloat(currentBalance.total_accrued) || 0;
        const totalUsed = parseFloat(currentBalance.total_used) || 0;
        const totalPending = parseFloat(currentBalance.total_pending) || 0;
        const available = parseFloat(currentBalance.current_balance) || 0;

        console.log('Current balance before application:', {
            totalAccrued,
            totalUsed,
            totalPending,
            available,
            requested: numberOfDays,
            leave_type
        });

        // Check if sufficient available balance (only for non-Unpaid leaves)
        if (leave_type !== 'Unpaid' && available < numberOfDays) {
            return res.status(400).json({ 
                success: false, 
                message: `Insufficient leave balance. Available: ${available.toFixed(1)} days, Requested: ${numberOfDays} days` 
            });
        }

        // Check for overlapping leaves
        const [overlapping] = await db.query(
            `SELECT * FROM leaves WHERE employee_id = ? 
             AND status != 'rejected'
             AND ((start_date BETWEEN ? AND ?) OR (end_date BETWEEN ? AND ?))`,
            [employee_id, start_date, end_date || start_date, start_date, end_date || start_date]
        );

        if (overlapping.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'You already have a leave application for this date range' 
            });
        }

        // Start transaction to ensure data consistency
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Insert leave application
            const [result] = await connection.query(
                `INSERT INTO leaves 
                (employee_id, leave_type, leave_duration, start_date, end_date, half_day_type, 
                 reason, reporting_manager, status, days_count, applied_by, applied_date) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, NOW())`,
                [
                    employee_id, 
                    leave_type || 'Annual', 
                    leave_duration || 'Full Day', 
                    start_date, 
                    end_date || start_date, 
                    half_day_type || null, 
                    reason, 
                    reporting_manager || null,
                    numberOfDays,
                    employee_id
                ]
            );

            console.log('Leave inserted with ID:', result.insertId);

            // Update balance only for non-Unpaid leaves
            if (leave_type !== 'Unpaid') {
                const newPending = totalPending + numberOfDays;
                const newAvailable = available - numberOfDays;

                console.log('Updating balance (non-Unpaid leave):', {
                    oldPending: totalPending,
                    newPending,
                    oldAvailable: available,
                    newAvailable
                });

                await connection.query(
                    `UPDATE leave_balance 
                     SET total_pending = ?, 
                         current_balance = ? 
                     WHERE employee_id = ? AND leave_year = ?`,
                    [newPending, newAvailable, employee_id, currentYear]
                );
            } else {
                console.log('Unpaid leave - No balance update required');
            }

            // Commit transaction
            await connection.commit();
            console.log('Transaction committed successfully');

            // Get updated balance (if needed)
            let newBalance = currentBalance;
            if (leave_type !== 'Unpaid') {
                const [updatedBalance] = await db.query(
                    'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
                    [employee_id, currentYear]
                );
                newBalance = updatedBalance[0];
            }

            console.log('Final status:', {
                leave_type,
                balance_updated: leave_type !== 'Unpaid'
            });

            res.status(201).json({
                success: true,
                message: 'Leave application submitted successfully',
                leaveId: result.insertId,
                balance: {
                    total_accrued: (parseFloat(newBalance.total_accrued) || 0).toFixed(1),
                    used: (parseFloat(newBalance.total_used) || 0).toFixed(1),
                    pending: (parseFloat(newBalance.total_pending) || 0).toFixed(1),
                    available: (parseFloat(newBalance.current_balance) || 0).toFixed(1),
                    leave_year: currentYear
                }
            });

        } catch (error) {
            await connection.rollback();
            console.error('Transaction failed, rolled back:', error);
            throw error;
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Error applying for leave:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to apply for leave',
            error: error.message
        });
    }
};

// Helper function to parse shift timing
const parseShiftTiming = (shiftString) => {
    // Default shift if not provided
    if (!shiftString) {
        return {
            startHour: 9,
            startMinute: 0,
            endHour: 18,
            endMinute: 0,
            totalHours: 9
        };
    }

    // Parse format like "9:00 AM - 6:00 PM" or "3:00 PM - 12:00 AM"
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

    // Calculate total hours
    let totalHours = endTime.hour - startTime.hour;
    if (totalHours < 0) totalHours += 24; // Handle overnight shifts
    totalHours += (endTime.minute - startTime.minute) / 60;

    return {
        startHour: startTime.hour,
        startMinute: startTime.minute,
        endHour: endTime.hour,
        endMinute: endTime.minute,
        totalHours: totalHours
    };
};

// Validate half-day based on shift and working hours - 5 HOURS RULE
const validateHalfDay = async (employee_id, leaveDate, halfDayType, shiftTiming) => {
    try {
        const date = new Date(leaveDate);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // Get attendance/working hours for this employee on this date
        const [attendance] = await db.query(
            `SELECT * FROM attendance 
             WHERE employee_id = ? 
             AND YEAR(attendance_date) = ? 
             AND MONTH(attendance_date) = ? 
             AND DAY(attendance_date) = ?`,
            [employee_id, year, month, day]
        );

        let hoursWorked = 0;
        let clockIn = null;
        let clockOut = null;

        if (attendance.length > 0) {
            // Calculate actual hours worked
            if (attendance[0].clock_in && attendance[0].clock_out) {
                const clockInTime = new Date(attendance[0].clock_in);
                const clockOutTime = new Date(attendance[0].clock_out);
                hoursWorked = (clockOutTime - clockInTime) / (1000 * 60 * 60);
            }
        }

        // Calculate total shift hours
        const totalShiftHours = shiftTiming.totalHours;

        // MINIMUM REQUIRED HOURS FOR HALF-DAY VALIDITY = 5 HOURS
        const MINIMUM_REQUIRED_HOURS = 5;

        let requiredHours = 0;
        let remainingHalf = '';

        if (halfDayType === 'First Half') {
            // Taking first half off, must work second half
            remainingHalf = 'Second Half';
            requiredHours = MINIMUM_REQUIRED_HOURS;
        } else if (halfDayType === 'Second Half') {
            // Taking second half off, must work first half
            remainingHalf = 'First Half';
            requiredHours = MINIMUM_REQUIRED_HOURS;
        }

        console.log('Half-day validation (5-hour rule):', {
            halfDayType,
            remainingHalf,
            requiredHours: requiredHours.toFixed(1),
            hoursWorked: hoursWorked.toFixed(1),
            shiftTiming,
            totalShiftHours: totalShiftHours.toFixed(1)
        });

        // Check if employee worked enough hours (at least 5 hours) in the remaining half
        if (hoursWorked >= requiredHours) {
            return {
                valid: true,
                message: `Valid half-day leave. You worked ${hoursWorked.toFixed(1)} hours in the ${remainingHalf} (minimum 5 hours required).`
            };
        } else {
            return {
                valid: false,
                message: `Insufficient work hours. You only worked ${hoursWorked.toFixed(1)} hours in the ${remainingHalf}. Minimum 5 hours required for half-day. Converting to full day.`
            };
        }

    } catch (error) {
        console.error('Error validating half-day:', error);
        return {
            valid: false,
            message: 'Unable to validate work hours. Converting to full day for compliance.'
        };
    }
};

// Get leaves
exports.getLeaves = async (req, res) => {
    try {
        const { employee_id, role } = req.query;

        let query = `
            SELECT l.*, e.first_name, e.last_name, e.department 
            FROM leaves l 
            JOIN employees e ON l.employee_id = e.employee_id
        `;
        let params = [];

        if (role === 'employee' && employee_id) {
            query += ' WHERE l.employee_id = ?';
            params = [employee_id];
        }

        query += ' ORDER BY l.applied_date DESC';

        const [leaves] = await db.query(query, params);
        res.json(leaves || []);

    } catch (error) {
        console.error('Error fetching leaves:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching leaves',
            error: error.message
        });
    }
};

// Update leave status (Admin only)
exports.updateLeaveStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, comments } = req.body;

        console.log('='.repeat(50));
        console.log('UPDATE LEAVE STATUS REQUEST');
        console.log('Leave ID:', id);
        console.log('Status:', status);
        console.log('Comments:', comments);
        console.log('='.repeat(50));

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status. Must be approved or rejected.' 
            });
        }

        // Get leave details before update
        const [leaveDetails] = await db.query(
            'SELECT * FROM leaves WHERE id = ?',
            [id]
        );

        if (leaveDetails.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Leave request not found' 
            });
        }

        const leave = leaveDetails[0];
        const oldStatus = leave.status;
        const currentYear = new Date().getFullYear();
        const leaveDays = parseFloat(leave.days_count) || 1;

        console.log('Leave details:', {
            id: leave.id,
            employee_id: leave.employee_id,
            oldStatus,
            newStatus: status,
            days: leaveDays
        });

        // Only process if it was pending
        if (oldStatus !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: 'This leave request is no longer pending' 
            });
        }

        // Get current balance
        const [balance] = await db.query(
            'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
            [leave.employee_id, currentYear]
        );

        if (balance.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Leave balance not found' 
            });
        }

        const currentBalance = balance[0];
        
        // Parse values
        const totalAccrued = parseFloat(currentBalance.total_accrued) || 0;
        const totalUsed = parseFloat(currentBalance.total_used) || 0;
        const totalPending = parseFloat(currentBalance.total_pending) || 0;
        const available = parseFloat(currentBalance.current_balance) || 0;

        console.log('Current balance before update:', {
            totalAccrued,
            totalUsed,
            totalPending,
            available
        });

        // Update leave status
        await db.query(
            'UPDATE leaves SET status = ?, admin_comments = ? WHERE id = ?',
            [status, comments || null, id]
        );

        if (status === 'approved') {
            // APPROVED: Move from pending to used
            // pending decreases by leaveDays
            // used increases by leaveDays
            // available stays the same (already deducted when applied)
            const newPending = totalPending - leaveDays;
            const newUsed = totalUsed + leaveDays;
            
            await db.query(
                `UPDATE leave_balance 
                 SET total_pending = ?, 
                     total_used = ? 
                 WHERE employee_id = ? AND leave_year = ?`,
                [newPending, newUsed, leave.employee_id, currentYear]
            );
            
            console.log('APPROVED - Balance updated:', {
                oldPending: totalPending,
                newPending,
                oldUsed: totalUsed,
                newUsed,
                available: available // unchanged
            });

        } else if (status === 'rejected') {
            // REJECTED: Move from pending back to available
            // pending decreases by leaveDays
            // available increases by leaveDays
            // used stays the same
            const newPending = totalPending - leaveDays;
            const newAvailable = available + leaveDays;
            
            await db.query(
                `UPDATE leave_balance 
                 SET total_pending = ?, 
                     current_balance = ? 
                 WHERE employee_id = ? AND leave_year = ?`,
                [newPending, newAvailable, leave.employee_id, currentYear]
            );
            
            console.log('REJECTED - Balance updated:', {
                oldPending: totalPending,
                newPending,
                oldAvailable: available,
                newAvailable,
                used: totalUsed // unchanged
            });
        }

        // Get updated balance
        const [updatedBalance] = await db.query(
            'SELECT * FROM leave_balance WHERE employee_id = ? AND leave_year = ?',
            [leave.employee_id, currentYear]
        );

        const newBalance = updatedBalance[0];

        // Get updated leave stats for admin dashboard
        const [pendingCount] = await db.query(
            'SELECT COUNT(*) as count FROM leaves WHERE status = "pending"'
        );
        
        const [approvedCount] = await db.query(
            'SELECT COUNT(*) as count FROM leaves WHERE status = "approved"'
        );
        
        const [rejectedCount] = await db.query(
            'SELECT COUNT(*) as count FROM leaves WHERE status = "rejected"'
        );
        
        const [totalCount] = await db.query(
            'SELECT COUNT(*) as count FROM leaves'
        );

        // Create notification for employee
        try {
            const notificationMessage = status === 'approved' 
                ? `Your leave application for ${new Date(leave.start_date).toLocaleDateString()} has been approved.`
                : `Your leave application for ${new Date(leave.start_date).toLocaleDateString()} has been rejected. ${comments ? 'Reason: ' + comments : ''}`;

            await db.query(
                'INSERT INTO notifications (employee_id, message, type, created_at) VALUES (?, ?, ?, NOW())',
                [leave.employee_id, notificationMessage, 'leave_' + status]
            );
            console.log('Notification created for employee');
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
        }

        res.json({
            success: true,
            message: `Leave ${status} successfully`,
            balance: {
                total_accrued: (parseFloat(newBalance.total_accrued) || 0).toFixed(1),
                used: (parseFloat(newBalance.total_used) || 0).toFixed(1),
                pending: (parseFloat(newBalance.total_pending) || 0).toFixed(1),
                available: (parseFloat(newBalance.current_balance) || 0).toFixed(1)
            },
            stats: {
                total: totalCount[0].count,
                pending: pendingCount[0].count,
                approved: approvedCount[0].count,
                rejected: rejectedCount[0].count
            },
            employee_id: leave.employee_id // Send employee_id so frontend knows who to refresh
        });

    } catch (error) {
        console.error('Error updating leave status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update leave status',
            error: error.message
        });
    }
};

// Get leave types
exports.getLeaveTypes = async (req, res) => {
    try {
        const [types] = await db.query('SELECT * FROM leave_types WHERE is_active = true');

        if (types.length === 0) {
            return res.json([
                { id: 1, name: 'Annual', description: 'Annual vacation leave' },
                { id: 2, name: 'Sick', description: 'Medical leave' },
                { id: 3, name: 'Personal', description: 'Personal time off' },
                { id: 4, name: 'Maternity', description: 'Maternity leave' },
                { id: 5, name: 'Paternity', description: 'Paternity leave' },
                { id: 6, name: 'Bereavement', description: 'Leave for family death' },
                { id: 7, name: 'Unpaid', description: 'Leave without pay' }
            ]);
        }

        res.json(types);
    } catch (error) {
        console.error('Error fetching leave types:', error);
        res.json([
            { id: 1, name: 'Annual', description: 'Annual vacation leave' },
            { id: 2, name: 'Sick', description: 'Medical leave' },
            { id: 3, name: 'Personal', description: 'Personal time off' },
            { id: 4, name: 'Maternity', description: 'Maternity leave' },
            { id: 5, name: 'Paternity', description: 'Paternity leave' },
            { id: 6, name: 'Bereavement', description: 'Leave for family death' },
            { id: 7, name: 'Unpaid', description: 'Leave without pay' }
        ]);
    }
};

// Manual accrual for testing
exports.manualAccrual = async (req, res) => {
    try {
        const { employee_id } = req.params;

        const result = await LeaveYearlyService.addMonthlyAccrual(employee_id);

        res.json(result);
    } catch (error) {
        console.error('Error in manual accrual:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add manual accrual',
            error: error.message
        });
    }
};

// Yearly reset (admin only)
exports.yearlyReset = async (req, res) => {
    try {
        const result = await LeaveYearlyService.resetAllForNewYear();
        res.json(result);
    } catch (error) {
        console.error('Error in yearly reset:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset yearly leaves',
            error: error.message
        });
    }
};