const supabase = require('../config/supabase');

class LeaveYearlyService {
    
    /**
     * Get current year
     * @returns {number} Current year
     */
    static getCurrentYear() {
        return new Date().getFullYear();
    }

    /**
     * Check if a month is completed (current date is past month end)
     * @param {number} year - Year to check
     * @param {number} month - Month to check (1-12)
     * @returns {boolean} Whether month is completed
     */
    static isMonthCompleted(year, month) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        
        // Get last day of the month
        const lastDayOfMonth = new Date(year, month, 0).getDate();
        
        // Month is completed if:
        // 1. We're in a future year, OR
        // 2. We're in a future month, OR
        // 3. We're in the same month but past the last day (next month)
        if (year < currentYear) return true; // Previous years are fully completed
        if (year > currentYear) return false; // Future years not started
        
        // Current year
        if (month < currentMonth) return true; // Previous months completed
        if (month > currentMonth) return false; // Future months not started
        
        // Current month - check if we're past the last day
        return currentDay > lastDayOfMonth; // True on 1st of next month
    }

    /**
     * Get completed months for a specific year
     * @param {number} year - Year to check
     * @returns {number} Number of completed months
     */
    static getCompletedMonthsInYear(year) {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth() + 1;
        const currentDay = today.getDate();
        
        if (year < currentYear) return 12; // Previous years - all months completed
        if (year > currentYear) return 0; // Future years - no months completed
        
        // Current year - count completed months
        let completedMonths = 0;
        for (let month = 1; month <= 12; month++) {
            if (this.isMonthCompleted(year, month)) {
                completedMonths++;
            }
        }
        return completedMonths;
    }

    /**
     * Initialize leave balance for new employee
     * @param {string} employee_id - Employee ID
     * @param {string} joiningDate - Joining date
     * @returns {Promise<Object>} Initialized balance
     */
    static async initializeEmployeeBalance(employee_id, joiningDate) {
        try {
            const currentYear = this.getCurrentYear();
            
            // Check if balance already exists
            const { data: existing, error: checkError } = await supabase
                .from('leave_balance')
                .select('id')
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existing) {
                console.log(`⚠️ Balance already exists for ${employee_id} in ${currentYear}`);
                return {
                    success: false,
                    message: 'Balance already exists',
                    employee_id,
                    leave_year: currentYear
                };
            }

            // Create zero balance for current year
            const { error: insertError } = await supabase
                .from('leave_balance')
                .insert([{
                    employee_id,
                    leave_year: currentYear,
                    total_accrued: 0,
                    total_used: 0,
                    total_pending: 0,
                    current_balance: 0,
                    last_updated: new Date().toISOString()
                }]);

            if (insertError) throw insertError;
            
            console.log(`✅ Initialized zero balance for ${employee_id} for year ${currentYear}`);
            
            return {
                success: true,
                employee_id,
                leave_year: currentYear,
                total_accrued: 0,
                current_balance: 0
            };

        } catch (error) {
            console.error('❌ Error initializing employee balance:', error);
            throw error;
        }
    }

    /**
     * Get current year balance for employee
     * @param {string} employee_id - Employee ID
     * @returns {Promise<Object>} Balance object
     */
    static async getCurrentYearBalance(employee_id) {
        const currentYear = this.getCurrentYear();
        
        try {
            const { data: balance, error } = await supabase
                .from('leave_balance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear)
                .maybeSingle();

            if (error) throw error;

            if (!balance) {
                // Create zero balance if not exists
                await this.initializeEmployeeBalance(employee_id, new Date());
                
                const { data: newBalance, error: refetchError } = await supabase
                    .from('leave_balance')
                    .select('*')
                    .eq('employee_id', employee_id)
                    .eq('leave_year', currentYear)
                    .maybeSingle();

                if (refetchError) throw refetchError;

                return {
                    ...newBalance,
                    total_accrued: parseFloat(newBalance.total_accrued) || 0,
                    total_used: parseFloat(newBalance.total_used) || 0,
                    total_pending: parseFloat(newBalance.total_pending) || 0,
                    current_balance: parseFloat(newBalance.current_balance) || 0
                };
            }

            return {
                ...balance,
                total_accrued: parseFloat(balance.total_accrued) || 0,
                total_used: parseFloat(balance.total_used) || 0,
                total_pending: parseFloat(balance.total_pending) || 0,
                current_balance: parseFloat(balance.current_balance) || 0
            };
        } catch (error) {
            console.error('❌ Error getting current year balance:', error);
            throw error;
        }
    }

    /**
     * Add monthly accrual for completed months in CURRENT YEAR ONLY
     * @param {string} employee_id - Employee ID
     * @returns {Promise<Object>} Updated balance
     */
    static async addMonthlyAccrual(employee_id) {
        try {
            const currentYear = this.getCurrentYear();
            const today = new Date();
            const currentMonth = today.getMonth() + 1;
            const currentDay = today.getDate();
            
            // Get employee joining date
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('joining_date, first_name, last_name')
                .eq('employee_id', employee_id)
                .maybeSingle();

            if (empError) throw empError;

            if (!employees) {
                throw new Error('Employee not found');
            }

            const joiningDate = new Date(employees.joining_date);
            
            // Calculate how many months in current year are COMPLETED
            let completedMonthsInYear = 0;
            
            for (let month = 1; month <= currentMonth; month++) {
                if (month < currentMonth) {
                    completedMonthsInYear++;
                } else if (month === currentMonth) {
                    const lastDayOfMonth = new Date(currentYear, month, 0).getDate();
                    if (currentDay > lastDayOfMonth) {
                        completedMonthsInYear++;
                    }
                }
            }

            console.log(`📊 Employee ${employee_id}: ${completedMonthsInYear} completed months in ${currentYear}`);

            // Expected accrual for current year
            const expectedAccrued = completedMonthsInYear * 1.5;

            // Get current balance for current year
            let { data: balance, error: balanceError } = await supabase
                .from('leave_balance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear)
                .maybeSingle();

            if (balanceError) throw balanceError;

            if (!balance) {
                // Create new balance for current year
                const { error: insertError } = await supabase
                    .from('leave_balance')
                    .insert([{
                        employee_id,
                        leave_year: currentYear,
                        total_accrued: expectedAccrued,
                        total_used: 0,
                        total_pending: 0,
                        current_balance: expectedAccrued,
                        last_updated: today.toISOString()
                    }]);

                if (insertError) throw insertError;
                
                console.log(`✅ Created new balance for ${employee_id} in ${currentYear} with ${expectedAccrued} leaves`);
            } else {
                const currentAccrued = parseFloat(balance.total_accrued) || 0;
                
                // Only add if expected is greater than current
                if (expectedAccrued > currentAccrued) {
                    const additional = expectedAccrued - currentAccrued;
                    
                    const { error: updateError } = await supabase
                        .from('leave_balance')
                        .update({
                            total_accrued: expectedAccrued,
                            current_balance: balance.current_balance + additional,
                            last_updated: today.toISOString()
                        })
                        .eq('employee_id', employee_id)
                        .eq('leave_year', currentYear);

                    if (updateError) throw updateError;

                    // Record transaction
                    const { error: transError } = await supabase
                        .from('leave_transactions')
                        .insert([{
                            employee_id,
                            leave_year: currentYear,
                            transaction_date: today.toISOString().split('T')[0],
                            transaction_type: 'accrual',
                            amount: additional,
                            description: `Monthly leave accrual for month ${completedMonthsInYear} in ${currentYear}`
                        }]);

                    if (transError) throw transError;

                    console.log(`✅ Added ${additional} leaves to ${employee_id} in ${currentYear}`);
                }
            }

            const updatedBalance = await this.getCurrentYearBalance(employee_id);
            return { 
                success: true, 
                balance: updatedBalance,
                completedMonths: completedMonthsInYear
            };

        } catch (error) {
            console.error('❌ Error adding monthly accrual:', error);
            throw error;
        }
    }

    /**
     * Reset all employees for new year (run on Jan 1)
     * @returns {Promise<Object>} Reset results
     */
    static async resetForNewYear() {
        try {
            const previousYear = this.getCurrentYear() - 1;
            const currentYear = this.getCurrentYear();
            
            console.log(`🔄 Resetting leaves from ${previousYear} to ${currentYear}`);

            // Get all employees
            const { data: employees, error: empError } = await supabase
                .from('employees')
                .select('employee_id, first_name, last_name');

            if (empError) throw empError;

            console.log(`📊 Found ${employees?.length || 0} employees to process`);

            const results = {
                total: employees?.length || 0,
                expired: 0,
                created: 0,
                failed: 0,
                details: []
            };

            for (const emp of employees || []) {
                try {
                    // Get previous year's balance
                    const { data: prevBalance, error: prevError } = await supabase
                        .from('leave_balance')
                        .select('*')
                        .eq('employee_id', emp.employee_id)
                        .eq('leave_year', previousYear)
                        .maybeSingle();

                    if (prevError) throw prevError;

                    if (prevBalance) {
                        const remainingLeaves = parseFloat(prevBalance.current_balance) || 0;
                        
                        // Record that leaves expired
                        if (remainingLeaves > 0) {
                            const { error: transError } = await supabase
                                .from('leave_transactions')
                                .insert([{
                                    employee_id: emp.employee_id,
                                    leave_year: previousYear,
                                    transaction_date: new Date().toISOString().split('T')[0],
                                    transaction_type: 'yearly_reset',
                                    amount: -remainingLeaves,
                                    description: `${remainingLeaves} leaves expired on Dec 31, ${previousYear}`
                                }]);

                            if (transError) throw transError;

                            results.expired++;
                            console.log(`📅 ${remainingLeaves} leaves expired for ${emp.employee_id}`);
                        }
                    }

                    // Check if balance already exists for current year
                    const { data: existing, error: checkError } = await supabase
                        .from('leave_balance')
                        .select('id')
                        .eq('employee_id', emp.employee_id)
                        .eq('leave_year', currentYear)
                        .maybeSingle();

                    if (checkError) throw checkError;

                    if (!existing) {
                        // Create new zero balance for current year
                        const { error: insertError } = await supabase
                            .from('leave_balance')
                            .insert([{
                                employee_id: emp.employee_id,
                                leave_year: currentYear,
                                total_accrued: 0,
                                total_used: 0,
                                total_pending: 0,
                                current_balance: 0,
                                last_updated: new Date().toISOString()
                            }]);

                        if (insertError) throw insertError;

                        results.created++;
                        results.details.push({
                            employee_id: emp.employee_id,
                            name: `${emp.first_name} ${emp.last_name}`,
                            status: 'created',
                            year: currentYear
                        });

                        console.log(`✅ Created new zero balance for ${emp.employee_id} for year ${currentYear}`);
                    } else {
                        results.details.push({
                            employee_id: emp.employee_id,
                            name: `${emp.first_name} ${emp.last_name}`,
                            status: 'exists',
                            year: currentYear
                        });
                    }

                } catch (empError) {
                    results.failed++;
                    results.details.push({
                        employee_id: emp.employee_id,
                        name: emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.employee_id,
                        status: 'failed',
                        error: empError.message
                    });
                    console.error(`❌ Error processing ${emp.employee_id}:`, empError.message);
                }
            }

            console.log('\n' + '='.repeat(70));
            console.log('📊 YEARLY RESET SUMMARY');
            console.log(`Total employees: ${results.total}`);
            console.log(`Expired leaves recorded: ${results.expired}`);
            console.log(`New balances created: ${results.created}`);
            console.log(`Failed: ${results.failed}`);
            console.log('='.repeat(70));

            return { 
                success: true, 
                message: `Leaves reset for year ${currentYear}`,
                summary: {
                    total: results.total,
                    expired: results.expired,
                    created: results.created,
                    failed: results.failed
                },
                details: results.details
            };

        } catch (error) {
            console.error('❌ Error resetting leaves for new year:', error);
            throw error;
        }
    }

    /**
     * Deduct leaves when applying
     * @param {string} employee_id - Employee ID
     * @param {number} leaveId - Leave ID
     * @param {number} days - Number of days
     * @returns {Promise<Object>} Updated balance
     */
    static async deductLeaves(employee_id, leaveId, days) {
        try {
            const currentYear = this.getCurrentYear();
            
            // Get current balance
            const { data: balance, error: balanceError } = await supabase
                .from('leave_balance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear)
                .maybeSingle();

            if (balanceError) throw balanceError;

            if (!balance) {
                throw new Error('Leave balance not found');
            }

            // Update balance
            const newPending = (parseFloat(balance.total_pending) || 0) + days;
            const newCurrent = (parseFloat(balance.current_balance) || 0) - days;

            const { error: updateError } = await supabase
                .from('leave_balance')
                .update({
                    total_pending: newPending,
                    current_balance: newCurrent,
                    last_updated: new Date().toISOString()
                })
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear);

            if (updateError) throw updateError;

            // Record transaction
            const { error: transError } = await supabase
                .from('leave_transactions')
                .insert([{
                    employee_id,
                    leave_year: currentYear,
                    transaction_date: new Date().toISOString().split('T')[0],
                    transaction_type: 'leave_application',
                    leave_id: leaveId,
                    amount: -days,
                    description: `Leave application for ${days} days in ${currentYear}`
                }]);

            if (transError) throw transError;

            return await this.getCurrentYearBalance(employee_id);

        } catch (error) {
            console.error('❌ Error deducting leaves:', error);
            throw error;
        }
    }

    /**
     * Update leave status (approve/reject)
     * @param {string} employee_id - Employee ID
     * @param {number} leaveId - Leave ID
     * @param {number} days - Number of days
     * @param {string} oldStatus - Old status
     * @param {string} newStatus - New status
     * @returns {Promise<Object>} Updated balance
     */
    static async updateLeaveStatus(employee_id, leaveId, days, oldStatus, newStatus) {
        try {
            const currentYear = this.getCurrentYear();
            
            // Get current balance
            const { data: balance, error: balanceError } = await supabase
                .from('leave_balance')
                .select('*')
                .eq('employee_id', employee_id)
                .eq('leave_year', currentYear)
                .maybeSingle();

            if (balanceError) throw balanceError;

            if (!balance) {
                throw new Error('Leave balance not found');
            }

            let updates = {};
            let transactionType = '';
            let amount = 0;
            let description = '';

            if (oldStatus === 'pending' && newStatus === 'approved') {
                // Move from pending to used
                updates = {
                    total_pending: (parseFloat(balance.total_pending) || 0) - days,
                    total_used: (parseFloat(balance.total_used) || 0) + days
                };
                transactionType = 'leave_approved';
                amount = -days;
                description = `Leave approved - ${days} days deducted from ${currentYear}`;

            } else if (oldStatus === 'pending' && newStatus === 'rejected') {
                // Move from pending back to available
                updates = {
                    total_pending: (parseFloat(balance.total_pending) || 0) - days,
                    current_balance: (parseFloat(balance.current_balance) || 0) + days
                };
                transactionType = 'leave_rejected';
                amount = days;
                description = `Leave rejected - ${days} days returned to ${currentYear} balance`;
            }

            if (Object.keys(updates).length > 0) {
                const { error: updateError } = await supabase
                    .from('leave_balance')
                    .update({
                        ...updates,
                        last_updated: new Date().toISOString()
                    })
                    .eq('employee_id', employee_id)
                    .eq('leave_year', currentYear);

                if (updateError) throw updateError;

                // Record transaction
                const { error: transError } = await supabase
                    .from('leave_transactions')
                    .insert([{
                        employee_id,
                        leave_year: currentYear,
                        transaction_date: new Date().toISOString().split('T')[0],
                        transaction_type: transactionType,
                        leave_id: leaveId,
                        amount: amount,
                        description: description
                    }]);

                if (transError) throw transError;
            }

            return await this.getCurrentYearBalance(employee_id);

        } catch (error) {
            console.error('❌ Error updating leave status:', error);
            throw error;
        }
    }
}

module.exports = LeaveYearlyService;