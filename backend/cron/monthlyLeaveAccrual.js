const cron = require('node-cron');
const supabase = require('../config/supabase');

// Run at 00:01 on the 1st of every month
cron.schedule('1 0 1 * *', async () => {
    console.log('='.repeat(70));
    console.log('🔄 RUNNING MONTH-END LEAVE ACCRUAL JOB FOR PREVIOUS MONTH');
    console.log('Time:', new Date().toLocaleString());
    console.log('='.repeat(70));
    
    try {
        const today = new Date();
        const previousMonth = today.getMonth(); // 0-11 (previous month)
        const year = today.getFullYear();
        const monthName = new Date(year, previousMonth, 1).toLocaleString('default', { month: 'long' });
        
        console.log(`📅 Processing accrual for ${monthName} ${year}`);
        
        // Get all employees who have completed 6 months
        // In PostgreSQL, we need to use INTERVAL for date calculations
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('employee_id, joining_date, first_name, last_name')
            .lte('joining_date', sixMonthsAgo.toISOString().split('T')[0]);

        if (empError) throw empError;

        console.log(`📊 Found ${employees?.length || 0} eligible employees who joined before ${sixMonthsAgo.toISOString().split('T')[0]}`);

        const results = {
            total: employees?.length || 0,
            processed: 0,
            skipped: 0,
            failed: 0,
            details: []
        };

        for (const emp of employees || []) {
            try {
                console.log(`Processing employee: ${emp.employee_id} (${emp.first_name} ${emp.last_name})`);
                
                // Check if already accrued for previous month
                const { data: existing, error: checkError } = await supabase
                    .from('leave_transactions')
                    .select('id')
                    .eq('employee_id', emp.employee_id)
                    .eq('leave_year', year)
                    .eq('transaction_type', 'accrual')
                    .gte('transaction_date', `${year}-${String(previousMonth + 1).padStart(2, '0')}-01`)
                    .lt('transaction_date', `${year}-${String(previousMonth + 2).padStart(2, '0')}-01`);

                if (checkError) throw checkError;

                if (!existing || existing.length === 0) {
                    // Add 1.5 leaves for previous month
                    
                    // First, check if leave_balance exists for this employee and year
                    const { data: balance, error: balanceError } = await supabase
                        .from('leave_balance')
                        .select('*')
                        .eq('employee_id', emp.employee_id)
                        .eq('leave_year', year);

                    if (balanceError && balanceError.code !== 'PGRST116') throw balanceError;

                    if (!balance || balance.length === 0) {
                        // Create new balance record
                        const { error: createError } = await supabase
                            .from('leave_balance')
                            .insert([{
                                employee_id: emp.employee_id,
                                leave_year: year,
                                total_accrued: 1.5,
                                total_used: 0,
                                total_pending: 0,
                                current_balance: 1.5
                            }]);

                        if (createError) throw createError;
                    } else {
                        // Update existing balance
                        const currentBalance = balance[0];
                        const newAccrued = (parseFloat(currentBalance.total_accrued) || 0) + 1.5;
                        const newCurrent = (parseFloat(currentBalance.current_balance) || 0) + 1.5;

                        const { error: updateError } = await supabase
                            .from('leave_balance')
                            .update({
                                total_accrued: newAccrued,
                                current_balance: newCurrent
                            })
                            .eq('employee_id', emp.employee_id)
                            .eq('leave_year', year);

                        if (updateError) throw updateError;
                    }

                    // Record transaction
                    const accrualDate = new Date(year, previousMonth, 1);
                    
                    const { error: transError } = await supabase
                        .from('leave_transactions')
                        .insert([{
                            employee_id: emp.employee_id,
                            leave_year: year,
                            transaction_date: accrualDate.toISOString().split('T')[0],
                            transaction_type: 'accrual',
                            amount: 1.5,
                            description: `Monthly leave accrual for ${monthName} ${year}`
                        }]);

                    if (transError) throw transError;

                    results.processed++;
                    results.details.push({
                        employee_id: emp.employee_id,
                        name: `${emp.first_name} ${emp.last_name}`,
                        status: 'success',
                        message: `Added 1.5 leaves for ${monthName}`
                    });

                    console.log(`✅ Added 1.5 leaves to ${emp.employee_id} for ${monthName}`);

                    // Create notification for employee
                    try {
                        await supabase
                            .from('notifications')
                            .insert([{
                                employee_id: emp.employee_id,
                                title: 'Leave Accrual',
                                message: `1.5 leaves have been added to your account for ${monthName} ${year}.`,
                                type: 'leave_accrual',
                                created_at: new Date().toISOString()
                            }]);
                    } catch (notifError) {
                        console.log(`⚠️ Could not create notification for ${emp.employee_id}`);
                    }

                } else {
                    results.skipped++;
                    results.details.push({
                        employee_id: emp.employee_id,
                        name: `${emp.first_name} ${emp.last_name}`,
                        status: 'skipped',
                        message: `Already accrued for ${monthName}`
                    });
                    console.log(`⏭️ Already accrued for ${emp.employee_id}`);
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

        console.log('='.repeat(70));
        console.log('📊 ACCRUAL SUMMARY');
        console.log(`Month: ${monthName} ${year}`);
        console.log(`Total eligible: ${results.total}`);
        console.log(`Processed: ${results.processed}`);
        console.log(`Skipped: ${results.skipped}`);
        console.log(`Failed: ${results.failed}`);
        console.log('='.repeat(70));

        // Log to cron_logs table if exists
        try {
            await supabase
                .from('cron_logs')
                .insert([{
                    job_name: 'month_end_leave_accrual',
                    status: results.failed === 0 ? 'success' : results.failed === results.total ? 'failed' : 'partial_success',
                    result: {
                        month: monthName,
                        year,
                        processed: results.processed,
                        skipped: results.skipped,
                        failed: results.failed,
                        details: results.details
                    },
                    executed_at: new Date().toISOString()
                }]);
        } catch (logError) {
            console.log('📝 Cron logging skipped (cron_logs table may not exist)');
        }

        console.log('✅ Month-end leave accrual completed');
        
    } catch (error) {
        console.error('❌ Month-end accrual failed:', error);
        console.error('Error stack:', error.stack);
        
        // Log failure
        try {
            await supabase
                .from('cron_logs')
                .insert([{
                    job_name: 'month_end_leave_accrual',
                    status: 'failed',
                    error: error.message,
                    executed_at: new Date().toISOString()
                }]);
        } catch (logError) {
            // Silent fail
        }
    }
    
    console.log('='.repeat(70) + '\n');
});

// Manual trigger function for testing or manual runs
const manualMonthlyAccrual = async (specificMonth = null, specificYear = null) => {
    console.log('='.repeat(70));
    console.log('🔄 MANUAL MONTH-END ACCRUAL TRIGGERED');
    console.log('Time:', new Date().toLocaleString());
    console.log('='.repeat(70));
    
    try {
        const today = new Date();
        const month = specificMonth !== null ? specificMonth - 1 : today.getMonth(); // 0-11
        const year = specificYear || today.getFullYear();
        const monthName = new Date(year, month, 1).toLocaleString('default', { month: 'long' });
        
        console.log(`📅 Processing manual accrual for ${monthName} ${year}`);
        
        // Get all employees who have completed 6 months by the end of that month
        const sixMonthsBeforeMonth = new Date(year, month, 1);
        sixMonthsBeforeMonth.setMonth(sixMonthsBeforeMonth.getMonth() - 6);
        
        const { data: employees, error: empError } = await supabase
            .from('employees')
            .select('employee_id, joining_date, first_name, last_name')
            .lte('joining_date', sixMonthsBeforeMonth.toISOString().split('T')[0]);

        if (empError) throw empError;

        console.log(`📊 Found ${employees?.length || 0} eligible employees`);

        const results = [];

        for (const emp of employees || []) {
            try {
                // Check if already accrued for this month
                const { data: existing, error: checkError } = await supabase
                    .from('leave_transactions')
                    .select('id')
                    .eq('employee_id', emp.employee_id)
                    .eq('leave_year', year)
                    .eq('transaction_type', 'accrual')
                    .gte('transaction_date', `${year}-${String(month + 1).padStart(2, '0')}-01`)
                    .lt('transaction_date', `${year}-${String(month + 2).padStart(2, '0')}-01`);

                if (checkError) throw checkError;

                if (!existing || existing.length === 0) {
                    // Add 1.5 leaves
                    
                    // Check if leave_balance exists
                    const { data: balance, error: balanceError } = await supabase
                        .from('leave_balance')
                        .select('*')
                        .eq('employee_id', emp.employee_id)
                        .eq('leave_year', year);

                    if (!balance || balance.length === 0) {
                        await supabase
                            .from('leave_balance')
                            .insert([{
                                employee_id: emp.employee_id,
                                leave_year: year,
                                total_accrued: 1.5,
                                total_used: 0,
                                total_pending: 0,
                                current_balance: 1.5
                            }]);
                    } else {
                        const currentBalance = balance[0];
                        const newAccrued = (parseFloat(currentBalance.total_accrued) || 0) + 1.5;
                        const newCurrent = (parseFloat(currentBalance.current_balance) || 0) + 1.5;

                        await supabase
                            .from('leave_balance')
                            .update({
                                total_accrued: newAccrued,
                                current_balance: newCurrent
                            })
                            .eq('employee_id', emp.employee_id)
                            .eq('leave_year', year);
                    }

                    // Record transaction
                    const accrualDate = new Date(year, month, 1);
                    
                    await supabase
                        .from('leave_transactions')
                        .insert([{
                            employee_id: emp.employee_id,
                            leave_year: year,
                            transaction_date: accrualDate.toISOString().split('T')[0],
                            transaction_type: 'accrual',
                            amount: 1.5,
                            description: `Manual leave accrual for ${monthName} ${year}`
                        }]);

                    results.push({
                        employee_id: emp.employee_id,
                        name: `${emp.first_name} ${emp.last_name}`,
                        success: true,
                        message: `Added 1.5 leaves for ${monthName}`
                    });
                } else {
                    results.push({
                        employee_id: emp.employee_id,
                        name: `${emp.first_name} ${emp.last_name}`,
                        success: false,
                        message: `Already accrued for ${monthName}`
                    });
                }
            } catch (empError) {
                results.push({
                    employee_id: emp.employee_id,
                    name: emp.first_name ? `${emp.first_name} ${emp.last_name}` : emp.employee_id,
                    success: false,
                    error: empError.message
                });
            }
        }

        const summary = {
            total: results.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length
        };

        console.log('📊 MANUAL ACCRUAL SUMMARY:', summary);
        
        return {
            success: true,
            message: `Manual accrual for ${monthName} ${year} completed`,
            summary,
            results,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('❌ Manual accrual failed:', error);
        return {
            success: false,
            message: 'Manual accrual failed',
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
};

// Function to get last accrual run status
const getLastAccrualRun = async () => {
    try {
        const { data: logs, error } = await supabase
            .from('cron_logs')
            .select('*')
            .eq('job_name', 'month_end_leave_accrual')
            .order('executed_at', { ascending: false })
            .limit(1);

        if (error && error.code !== 'PGRST116') throw error;

        return {
            success: true,
            last_run: logs && logs.length > 0 ? logs[0] : null,
            next_run: getNextRunDate()
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

// Helper function to get next run date
const getNextRunDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 1, 0);
    return nextMonth.toISOString();
};

console.log('✅ Month-end accrual cron job scheduled for 00:01 on the 1st of every month');

module.exports = { 
    manualMonthlyAccrual,
    getLastAccrualRun
};