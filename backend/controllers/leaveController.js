const LeaveYearlyService = require('../services/leaveYearlyService');
const supabase = require('../config/supabase');

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
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('joining_date')
            .eq('employee_id', employee_id);

        if (empError) throw empError;

        if (!employees || employees.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Employee not found' 
            });
        }

        const today = new Date();
        const joiningDate = new Date(employees[0].joining_date);

        console.log('Joining Date:', employees[0].joining_date);
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
            totalMonthsFromJoining: totalMonths,
            isEligible: isEligibleToApply
        });

        // ===== ACCRUAL CALCULATION (Calendar year based) =====
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
        let { data: balance, error: balanceError } = await supabase
            .from('leave_balance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('leave_year', currentYear);

        if (balanceError) throw balanceError;

        // If no balance record exists for current year, create one
        if (!balance || balance.length === 0) {
            console.log(`Creating new balance for ${employee_id} in ${currentYear}`);
            
            const { data: newBalance, error: insertError } = await supabase
                .from('leave_balance')
                .insert([{
                    employee_id,
                    leave_year: currentYear,
                    total_accrued: totalAccrued,
                    total_used: 0,
                    total_pending: 0,
                    current_balance: totalAccrued
                }])
                .select();

            if (insertError) throw insertError;
            
            balance = newBalance;
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
            const { error: updateError } = await supabase
                .from('leave_balance')
                .update({
                    total_accrued: finalTotalAccrued,
                    current_balance: calculatedAvailable
                })
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear);

            if (updateError) throw updateError;
        }

        const response = {
            success: true,
            employee_id,
            total_accrued: finalTotalAccrued.toFixed(1),
            used: totalUsed.toFixed(1),
            pending: totalPending.toFixed(1),
            available: calculatedAvailable.toFixed(1),
            monthly_accrual: 1.5,
            joining_date: employees[0].joining_date,
            months_completed: totalMonths,
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
        let { data: balance, error: balanceError } = await supabase
            .from('leave_balance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('leave_year', currentYear);

        if (balanceError) throw balanceError;

        // If no balance record exists, create one
        if (!balance || balance.length === 0) {
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

            const { data: newBalance, error: insertError } = await supabase
                .from('leave_balance')
                .insert([{
                    employee_id,
                    leave_year: currentYear,
                    total_accrued: initialAccrued,
                    total_used: 0,
                    total_pending: 0,
                    current_balance: initialAccrued
                }])
                .select();

            if (insertError) throw insertError;
            
            balance = newBalance;
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
        const { data: overlapping, error: overlapError } = await supabase
            .from('leaves')
            .select('*')
            .eq('employee_id', employee_id)
            .neq('status', 'rejected')
            .or(`and(start_date.gte.${start_date},start_date.lte.${end_date || start_date}),and(end_date.gte.${start_date},end_date.lte.${end_date || start_date})`);

        if (overlapError) throw overlapError;

        if (overlapping && overlapping.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'You already have a leave application for this date range' 
            });
        }

        // Insert leave application
        const { data: leaveData, error: insertError } = await supabase
            .from('leaves')
            .insert([{
                employee_id,
                leave_type: leave_type || 'Annual',
                leave_duration: leave_duration || 'Full Day',
                start_date,
                end_date: end_date || start_date,
                half_day_type: half_day_type || null,
                reason,
                reporting_manager: reporting_manager || null,
                status: 'pending',
                days_count: numberOfDays,
                applied_by: employee_id,
                applied_date: new Date().toISOString()
            }])
            .select();

        if (insertError) throw insertError;

        console.log('Leave inserted with ID:', leaveData[0].id);

        // Update balance only for non-Unpaid leaves
        let newBalanceData = currentBalance;
        
        if (leave_type !== 'Unpaid') {
            const newPending = totalPending + numberOfDays;
            const newAvailable = available - numberOfDays;

            console.log('Updating balance (non-Unpaid leave):', {
                oldPending: totalPending,
                newPending,
                oldAvailable: available,
                newAvailable
            });

            const { data: updatedBalance, error: updateError } = await supabase
                .from('leave_balance')
                .update({
                    total_pending: newPending,
                    current_balance: newAvailable
                })
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear)
                .select();

            if (updateError) throw updateError;
            
            newBalanceData = updatedBalance[0];
        } else {
            console.log('Unpaid leave - No balance update required');
        }

        console.log('Final status:', {
            leave_type,
            balance_updated: leave_type !== 'Unpaid'
        });

        res.status(201).json({
            success: true,
            message: 'Leave application submitted successfully',
            leaveId: leaveData[0].id,
            balance: {
                total_accrued: (parseFloat(newBalanceData.total_accrued) || 0).toFixed(1),
                used: (parseFloat(newBalanceData.total_used) || 0).toFixed(1),
                pending: (parseFloat(newBalanceData.total_pending) || 0).toFixed(1),
                available: (parseFloat(newBalanceData.current_balance) || 0).toFixed(1),
                leave_year: currentYear
            }
        });

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
        const { data: attendance, error: attError } = await supabase
            .from('attendance')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('attendance_date', leaveDate);

        if (attError) throw attError;

        let hoursWorked = 0;
        let clockIn = null;
        let clockOut = null;

        if (attendance && attendance.length > 0) {
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

        console.log('📋 Fetching leaves with params:', { employee_id, role });

        // Simple query first - just get leaves without join
        let query = supabase
            .from('leaves')
            .select('*');

        // Apply employee filter if needed
        if (role === 'employee' && employee_id) {
            query = query.eq('employee_id', employee_id);
        }

        // Order by applied_date descending
        query = query.order('applied_date', { ascending: false });

        const { data: leaves, error } = await query;

        if (error) {
            console.error('❌ Error fetching leaves:', error);
            throw error;
        }

        console.log(`✅ Found ${leaves?.length || 0} leaves`);

        // If no leaves, return empty array
        if (!leaves || leaves.length === 0) {
            return res.json([]);
        }

        // Now get employee details for each leave
        const formattedLeaves = [];

        for (const leave of leaves) {
            try {
                // Fetch employee details for this leave
                const { data: employee, error: empError } = await supabase
                    .from('employees')
                    .select('first_name, last_name, department, designation')
                    .eq('employee_id', leave.employee_id)
                    .single();

                if (empError) {
                    console.warn(`⚠️ Could not fetch employee details for ${leave.employee_id}:`, empError.message);
                }

                formattedLeaves.push({
                    id: leave.id,
                    employee_id: leave.employee_id,
                    leave_type: leave.leave_type,
                    leave_duration: leave.leave_duration,
                    start_date: leave.start_date,
                    end_date: leave.end_date,
                    half_day_type: leave.half_day_type,
                    reason: leave.reason,
                    reporting_manager: leave.reporting_manager,
                    status: leave.status,
                    applied_date: leave.applied_date,
                    days_count: leave.days_count,
                    admin_comments: leave.admin_comments,
                    created_at: leave.created_at,
                    updated_at: leave.updated_at,
                    first_name: employee?.first_name || '',
                    last_name: employee?.last_name || '',
                    department: employee?.department || '',
                    designation: employee?.designation || ''
                });
            } catch (empErr) {
                console.error(`❌ Error processing leave ${leave.id}:`, empErr);
                formattedLeaves.push({
                    ...leave,
                    first_name: '',
                    last_name: '',
                    department: '',
                    designation: ''
                });
            }
        }

        res.json(formattedLeaves);

    } catch (error) {
        console.error('❌ Error in getLeaves:', error);
        console.error('Error details:', error);
        
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
        const { data: leaveDetails, error: fetchError } = await supabase
            .from('leaves')
            .select('*')
            .eq('id', id);

        if (fetchError) throw fetchError;

        if (!leaveDetails || leaveDetails.length === 0) {
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
        const { data: balance, error: balanceError } = await supabase
            .from('leave_balance')
            .select('*')
            .eq('employee_id', leave.employee_id)
            .eq('leave_year', currentYear);

        if (balanceError) throw balanceError;

        if (!balance || balance.length === 0) {
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
        const { error: updateError } = await supabase
            .from('leaves')
            .update({
                status,
                admin_comments: comments || null
            })
            .eq('id', id);

        if (updateError) throw updateError;

        let newBalanceData = currentBalance;

        if (status === 'approved') {
            // APPROVED: Move from pending to used
            const newPending = totalPending - leaveDays;
            const newUsed = totalUsed + leaveDays;
            
            const { data: updatedBalance, error: balUpdateError } = await supabase
                .from('leave_balance')
                .update({
                    total_pending: newPending,
                    total_used: newUsed
                })
                .eq('employee_id', leave.employee_id)
                .eq('leave_year', currentYear)
                .select();

            if (balUpdateError) throw balUpdateError;
            
            newBalanceData = updatedBalance[0];
            
            console.log('APPROVED - Balance updated:', {
                oldPending: totalPending,
                newPending,
                oldUsed: totalUsed,
                newUsed,
                available: available // unchanged
            });

        } else if (status === 'rejected') {
            // REJECTED: Move from pending back to available
            const newPending = totalPending - leaveDays;
            const newAvailable = available + leaveDays;
            
            const { data: updatedBalance, error: balUpdateError } = await supabase
                .from('leave_balance')
                .update({
                    total_pending: newPending,
                    current_balance: newAvailable
                })
                .eq('employee_id', leave.employee_id)
                .eq('leave_year', currentYear)
                .select();

            if (balUpdateError) throw balUpdateError;
            
            newBalanceData = updatedBalance[0];
            
            console.log('REJECTED - Balance updated:', {
                oldPending: totalPending,
                newPending,
                oldAvailable: available,
                newAvailable,
                used: totalUsed // unchanged
            });
        }

        // Get updated leave stats for admin dashboard
        const { count: pendingCount, error: pendingError } = await supabase
            .from('leaves')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'pending');

        const { count: approvedCount, error: approvedError } = await supabase
            .from('leaves')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'approved');

        const { count: rejectedCount, error: rejectedError } = await supabase
            .from('leaves')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'rejected');

        const { count: totalCount, error: totalError } = await supabase
            .from('leaves')
            .select('*', { count: 'exact', head: true });

        // Create notification for employee
        try {
            const notificationMessage = status === 'approved' 
                ? `Your leave application for ${new Date(leave.start_date).toLocaleDateString()} has been approved.`
                : `Your leave application for ${new Date(leave.start_date).toLocaleDateString()} has been rejected. ${comments ? 'Reason: ' + comments : ''}`;

            const { error: notifError } = await supabase
                .from('notifications')
                .insert([{
                    employee_id: leave.employee_id,
                    message: notificationMessage,
                    type: 'leave_' + status,
                    created_at: new Date().toISOString()
                }]);

            if (notifError) throw notifError;
            console.log('Notification created for employee');
        } catch (notifError) {
            console.error('Error creating notification:', notifError);
        }

        res.json({
            success: true,
            message: `Leave ${status} successfully`,
            balance: {
                total_accrued: (parseFloat(newBalanceData.total_accrued) || 0).toFixed(1),
                used: (parseFloat(newBalanceData.total_used) || 0).toFixed(1),
                pending: (parseFloat(newBalanceData.total_pending) || 0).toFixed(1),
                available: (parseFloat(newBalanceData.current_balance) || 0).toFixed(1)
            },
            stats: {
                total: totalCount || 0,
                pending: pendingCount || 0,
                approved: approvedCount || 0,
                rejected: rejectedCount || 0
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
        const { data: types, error } = await supabase
            .from('leave_types')
            .select('*')
            .eq('is_active', true);

        if (error) throw error;

        if (!types || types.length === 0) {
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