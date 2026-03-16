const supabase = require('../config/supabase');

// Helper function to get month name
function getMonthName(monthNumber) {
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return months[monthNumber - 1] || 'Unknown';
}

// salaryController.js - Complete generateSalarySlip function

/**
 * Generate salary slip for an employee
 * Access: Employee can generate their own, Admin can generate for anyone
 */
exports.generateSalarySlip = async (req, res) => {
    try {
        const { employee_id, month, year } = req.body;

        console.log('='.repeat(70));
        console.log('💰 GENERATE SALARY SLIP REQUEST');
        console.log('Employee ID:', employee_id);
        console.log('Month:', month, 'Year:', year);
        console.log('Request User:', { 
            role: req.userRole, 
            employeeId: req.employeeId 
        });
        console.log('='.repeat(70));

        // Validate required fields
        if (!employee_id || !month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Employee ID, month and year are required'
            });
        }

        // Validate month range
        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: 'Month must be between 1 and 12'
            });
        }

        // Validate year (not too far in past/future)
        const currentYear = new Date().getFullYear();
        if (year < 2000 || year > currentYear + 1) {
            return res.status(400).json({
                success: false,
                message: 'Invalid year'
            });
        }

        // 👇 IMPORTANT: Authorization check
        // If user is employee, they can only generate for themselves
        if (req.userRole === 'employee' && req.employeeId !== employee_id) {
            console.log('❌ Unauthorized: Employee trying to generate for another employee');
            return res.status(403).json({
                success: false,
                message: 'You can only generate salary slips for yourself'
            });
        }

        // If user is admin, they can generate for anyone (no check needed)

        // Get employee details with joining date
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', employee_id);

        if (empError) {
            console.error('❌ Database error fetching employee:', empError);
            throw empError;
        }

        if (!employees || employees.length === 0) {
            console.log('❌ Employee not found:', employee_id);
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }

        const emp = employees[0];
        console.log('✅ Employee found:', emp.first_name, emp.last_name);
        
        // Validate joining date - cannot generate slips for months before joining
        const joiningDate = new Date(emp.joining_date);
        const requestedDate = new Date(year, month - 1, 1);
        
        // Reset time portions for accurate comparison
        joiningDate.setDate(1);
        joiningDate.setHours(0, 0, 0, 0);
        requestedDate.setHours(0, 0, 0, 0);

        if (requestedDate < joiningDate) {
            const joiningMonth = joiningDate.toLocaleString('default', { month: 'long' });
            const joiningYear = joiningDate.getFullYear();
            
            console.log('❌ Cannot generate: Before joining date');
            return res.status(400).json({
                success: false,
                message: `You cannot generate salary slip for months before your joining date. You joined in ${joiningMonth} ${joiningYear}.`
            });
        }

        // Cannot generate for future months
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth() + 1;
        const currentYear_ = currentDate.getFullYear();
        
        if (year > currentYear_ || (year === currentYear_ && month > currentMonth)) {
            console.log('❌ Cannot generate: Future month');
            return res.status(400).json({
                success: false,
                message: 'Cannot generate salary slip for future months'
            });
        }

        // Check if salary slip already exists for this month/year
        const { data: existing, error: checkError } = await supabase
            .from('salary_slips')
            .select('*')
            .eq('employee_id', employee_id)
            .eq('month', month)
            .eq('year', year);

        if (checkError) {
            console.error('❌ Error checking existing slip:', checkError);
            throw checkError;
        }

        if (existing && existing.length > 0) {
            console.log('✅ Salary slip already exists, returning existing');
            return res.json({
                success: true,
                message: 'Salary slip already exists',
                salarySlip: existing[0]
            });
        }

        // Get basic salary (prefer gross_salary if available)
        let basicSalary = 0;
        
        if (emp.gross_salary && parseFloat(emp.gross_salary) > 0) {
            basicSalary = parseFloat(emp.gross_salary);
        } else if (emp.salary && parseFloat(emp.salary) > 0) {
            basicSalary = parseFloat(emp.salary);
        } else {
            console.log('⚠️ No salary found for employee, using 0');
        }

        // Clean the salary value (remove any non-numeric characters)
        const rawSalary = String(basicSalary).replace(/[^0-9.]/g, '');
        basicSalary = parseFloat(rawSalary) || 0;

        // Fixed deduction amount
        const DT_DEDUCTION = 200;
        
        // Calculate net salary
        const netSalary = basicSalary - DT_DEDUCTION;

        // Ensure net salary is not negative
        const finalNetSalary = netSalary < 0 ? 0 : netSalary;

        console.log('💰 Salary calculation:', {
            basicSalary,
            deduction: DT_DEDUCTION,
            netSalary: finalNetSalary
        });

        // Insert salary slip with correct calculation
        const { data: newSlip, error: insertError } = await supabase
            .from('salary_slips')
            .insert([{
                employee_id,
                month,
                year,
                basic_salary: basicSalary,
                dt: DT_DEDUCTION,
                total_deductions: DT_DEDUCTION,
                net_salary: finalNetSalary,
                gross_earnings: basicSalary,
                hra: 0,
                conveyance: 0,
                medical: 0,
                special: 0,
                pf: 0,
                esi: 0,
                tds: 0,
                pt: 0,
                generated_date: new Date().toISOString(),
                is_paid: false
            }])
            .select();

        if (insertError) {
            console.error('❌ Error inserting salary slip:', insertError);
            
            // Check for duplicate key error
            if (insertError.code === '23505') {
                return res.status(400).json({
                    success: false,
                    message: 'Salary slip for this month already exists'
                });
            }
            
            throw insertError;
        }

        console.log('✅ Salary slip generated successfully. ID:', newSlip[0].id);

        // Create notification for employee
        try {
            const monthName = new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' });
            
            const { error: notifError } = await supabase
                .from('notifications')
                .insert([{
                    employee_id,
                    title: 'Salary Slip Generated',
                    message: `Salary slip for ${monthName} ${year} has been generated.`,
                    type: 'salary',
                    reference_id: newSlip[0].id,
                    created_at: new Date().toISOString()
                }]);

            if (notifError) {
                console.log('⚠️ Notification error:', notifError.message);
            } else {
                console.log('✅ Notification created for employee');
            }
        } catch (notifError) {
            console.log('⚠️ Notification error:', notifError.message);
        }

        // If generating for self, no need for admin notification
        // But if admin is generating for employee, notify admin as well
        if (req.userRole === 'admin' && req.employeeId !== employee_id) {
            try {
                const { error: adminNotifError } = await supabase
                    .from('admin_notifications')
                    .insert([{
                        admin_id: req.userId,
                        title: 'Salary Slip Generated',
                        message: `Salary slip for employee ${emp.first_name} ${emp.last_name} (${employee_id}) for ${monthName} ${year} has been generated.`,
                        type: 'salary_generated',
                        reference_id: newSlip[0].id,
                        created_at: new Date().toISOString()
                    }]);

                if (adminNotifError) {
                    console.log('⚠️ Admin notification error:', adminNotifError.message);
                }
            } catch (adminNotifError) {
                console.log('⚠️ Admin notification error:', adminNotifError.message);
            }
        }

        res.status(201).json({
            success: true,
            message: 'Salary slip generated successfully',
            salarySlip: newSlip[0]
        });

    } catch (error) {
        console.error('❌ Error generating salary slip:', error);
        console.error('Error stack:', error.stack);
        
        res.status(500).json({
            success: false,
            message: 'Failed to generate salary slip',
            error: error.message,
            details: error.details || error.hint
        });
    }
};

// Get all salary slips for an employee
exports.getEmployeeSalarySlips = async (req, res) => {
    try {
        const { employee_id } = req.params;

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

        const joiningDate = new Date(employees[0].joining_date);
        const joiningMonth = joiningDate.getMonth() + 1;
        const joiningYear = joiningDate.getFullYear();

        // Get all salary slips for this employee
        const { data: slips, error: slipError } = await supabase
            .from('salary_slips')
            .select('*')
            .eq('employee_id', employee_id)
            .order('year', { ascending: false })
            .order('month', { ascending: false });

        if (slipError) throw slipError;

        // Add validation info to response
        res.json({
            success: true,
            salarySlips: slips || [],
            joiningInfo: {
                month: joiningMonth,
                year: joiningYear,
                date: employees[0].joining_date,
                formattedDate: joiningDate.toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                })
            }
        });

    } catch (error) {
        console.error('Error fetching salary slips:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary slips',
            error: error.message
        });
    }
};

// Get salary slip by ID
exports.getSalarySlipById = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: slips, error } = await supabase
            .from('salary_slips')
            .select(`
                *,
                employees!inner(first_name, last_name, employee_id, department, position, joining_date)
            `)
            .eq('id', id);

        if (error) throw error;

        if (!slips || slips.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        const slip = {
            ...slips[0],
            first_name: slips[0].employees.first_name,
            last_name: slips[0].employees.last_name,
            department: slips[0].employees.department,
            position: slips[0].employees.position,
            joining_date: slips[0].employees.joining_date,
            employees: undefined
        };

        const joiningDate = new Date(slip.joining_date);
        const slipDate = new Date(slip.year, slip.month - 1, 1);

        // Validate that slip is not before joining date
        if (slipDate < joiningDate) {
            return res.status(403).json({
                success: false,
                message: 'Access denied: This salary slip is from before your joining date'
            });
        }

        res.json({
            success: true,
            salarySlip: slip
        });

    } catch (error) {
        console.error('Error fetching salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary slip',
            error: error.message
        });
    }
};

// Get salary slip by month and year
exports.getSalarySlipByMonth = async (req, res) => {
    try {
        const { employee_id, month, year } = req.params;

        // First check if employee exists and get joining date
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

        const joiningDate = new Date(employees[0].joining_date);
        const requestedDate = new Date(year, month - 1, 1);

        // Validate that requested month is not before joining date
        if (requestedDate < joiningDate) {
            return res.status(403).json({
                success: false,
                message: 'Cannot access salary slips from before your joining date'
            });
        }

        const { data: slips, error } = await supabase
            .from('salary_slips')
            .select(`
                *,
                employees!inner(first_name, last_name, employee_id, department, position)
            `)
            .eq('employee_id', employee_id)
            .eq('month', month)
            .eq('year', year);

        if (error) throw error;

        if (!slips || slips.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found for this month'
            });
        }

        const slip = {
            ...slips[0],
            first_name: slips[0].employees.first_name,
            last_name: slips[0].employees.last_name,
            department: slips[0].employees.department,
            position: slips[0].employees.position,
            employees: undefined
        };

        res.json({
            success: true,
            salarySlip: slip
        });

    } catch (error) {
        console.error('Error fetching salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary slip',
            error: error.message
        });
    }
};

// Generate salary slips for all employees for a specific month (Admin only)
exports.generateBulkSalarySlips = async (req, res) => {
    try {
        const { month, year } = req.body;

        // Get all active employees
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('employee_id, salary, gross_salary');

        if (empError) throw empError;

        const results = [];

        for (const emp of employees || []) {
            try {
                // Check if slip already exists
                const { data: existing, error: checkError } = await supabase
                    .from('salary_slips')
                    .select('*')
                    .eq('employee_id', emp.employee_id)
                    .eq('month', month)
                    .eq('year', year);

                if (checkError) throw checkError;

                if (!existing || existing.length === 0) {
                    // Generate salary slip for this employee
                    const rawSalary = String(emp.gross_salary || emp.salary || '0').replace(/[^0-9.]/g, '');
                    const basicSalary = parseFloat(rawSalary) || 0;
                    
                    // SIMPLIFIED CALCULATIONS
                    const grossEarnings = basicSalary;
                    const dt = 200;
                    const totalDeductions = dt;
                    const netSalary = basicSalary - dt;

                    const { error: insertError } = await supabase
                        .from('salary_slips')
                        .insert([{
                            employee_id: emp.employee_id,
                            month,
                            year,
                            basic_salary: basicSalary,
                            hra: 0,
                            conveyance: 0,
                            medical: 0,
                            special: 0,
                            gross_earnings: grossEarnings,
                            pf: 0,
                            esi: 0,
                            tds: 0,
                            pt: 0,
                            dt,
                            total_deductions,
                            net_salary: netSalary,
                            generated_date: new Date().toISOString()
                        }]);

                    if (insertError) throw insertError;

                    results.push({
                        employee_id: emp.employee_id,
                        status: 'success'
                    });
                } else {
                    results.push({
                        employee_id: emp.employee_id,
                        status: 'already_exists'
                    });
                }
            } catch (empError) {
                results.push({
                    employee_id: emp.employee_id,
                    status: 'failed',
                    error: empError.message
                });
            }
        }

        res.json({
            success: true,
            message: 'Bulk salary slip generation completed',
            results
        });

    } catch (error) {
        console.error('Error generating bulk salary slips:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate bulk salary slips',
            error: error.message
        });
    }
};

// Mark salary as paid (Admin only)
exports.markAsPaid = async (req, res) => {
    try {
        const { id } = req.params;
        const { payment_mode, notes } = req.body;

        const { data, error } = await supabase
            .from('salary_slips')
            .update({
                is_paid: true,
                payment_date: new Date().toISOString().split('T')[0],
                payment_mode,
                notes
            })
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            message: 'Salary marked as paid',
            salarySlip: data[0]
        });

    } catch (error) {
        console.error('Error marking salary as paid:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark salary as paid',
            error: error.message
        });
    }
};

// Delete salary slip (Admin only)
exports.deleteSalarySlip = async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('salary_slips')
            .delete()
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            message: 'Salary slip deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete salary slip',
            error: error.message
        });
    }
};

// Get salary statistics (Admin only)
exports.getSalaryStatistics = async (req, res) => {
    try {
        const { year, month } = req.query;

        let query = supabase
            .from('salary_slips')
            .select(`
                *,
                employees!inner(department)
            `);

        if (year) {
            query = query.eq('year', year);
        }
        if (month) {
            query = query.eq('month', month);
        }

        const { data: slips, error } = await query;

        if (error) throw error;

        // Calculate statistics
        const totalEmployees = new Set(slips?.map(s => s.employee_id)).size;
        const totalSalary = slips?.reduce((sum, s) => sum + (parseFloat(s.net_salary) || 0), 0) || 0;
        const paidCount = slips?.filter(s => s.is_paid).length || 0;
        const unpaidCount = slips?.filter(s => !s.is_paid).length || 0;

        // Department-wise breakdown
        const deptStats = {};
        slips?.forEach(slip => {
            const dept = slip.employees?.department || 'Unknown';
            if (!deptStats[dept]) {
                deptStats[dept] = {
                    count: 0,
                    total: 0,
                    paid: 0
                };
            }
            deptStats[dept].count++;
            deptStats[dept].total += parseFloat(slip.net_salary) || 0;
            if (slip.is_paid) {
                deptStats[dept].paid++;
            }
        });

        res.json({
            success: true,
            statistics: {
                total_employees: totalEmployees,
                total_slips: slips?.length || 0,
                total_salary: totalSalary.toFixed(2),
                paid_count: paidCount,
                unpaid_count: unpaidCount,
                department_breakdown: deptStats
            }
        });

    } catch (error) {
        console.error('Error fetching salary statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch salary statistics',
            error: error.message
        });
    }
};

// Update salary slip (Admin only)
exports.updateSalarySlip = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Remove fields that shouldn't be updated
        delete updates.id;
        delete updates.employee_id;
        delete updates.generated_date;

        const { data, error } = await supabase
            .from('salary_slips')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;

        if (!data || data.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Salary slip not found'
            });
        }

        res.json({
            success: true,
            message: 'Salary slip updated successfully',
            salarySlip: data[0]
        });

    } catch (error) {
        console.error('Error updating salary slip:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update salary slip',
            error: error.message
        });
    }
};