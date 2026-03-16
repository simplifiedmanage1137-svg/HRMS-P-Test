const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken, isAdmin } = require('../middleware/auth');

// Get all employees for admin
router.get('/employees', verifyToken, isAdmin, async (req, res) => {
    try {
        console.log('📋 Fetching employees for admin...');
        
        // Check if employees table exists and get columns
        const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'employees')
            .eq('table_schema', 'public');

        if (columnsError) {
            console.error('❌ Error checking columns:', columnsError);
            return res.json([]);
        }

        const columnNames = columns.map(col => col.column_name);
        
        // Build select fields based on existing columns
        let selectFields = ['id', 'employee_id', 'first_name', 'last_name', 'email'];
        
        if (columnNames.includes('designation')) selectFields.push('designation');
        if (columnNames.includes('department')) selectFields.push('department');
        if (columnNames.includes('phone')) selectFields.push('phone');

        let query = supabase
            .from('employees')
            .select(selectFields.join(','))
            .order('first_name', { ascending: true });

        // Add is_active filter if column exists
        if (columnNames.includes('is_active')) {
            query = query.or('is_active.eq.true,is_active.is.null');
        }

        const { data: employees, error } = await query;

        if (error) throw error;

        console.log(`✅ Found ${employees?.length || 0} employees`);
        res.json(employees || []);

    } catch (error) {
        console.error('❌ Error fetching employees:', error);
        console.error('Error details:', error.message);
        
        // Return empty array instead of error to prevent frontend crash
        res.json([]);
    }
});

// Get pending requests count
router.get('/pending-count', verifyToken, isAdmin, async (req, res) => {
    try {
        // Check if table exists
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'update_requests')
            .eq('table_schema', 'public');

        if (tableError || !tables || tables.length === 0) {
            return res.json({ count: 0 });
        }

        const { count, error } = await supabase
            .from('update_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'completed');

        if (error) throw error;

        res.json({ count: count || 0 });

    } catch (error) {
        console.error('❌ Error fetching pending count:', error);
        res.json({ count: 0 });
    }
});

// Get all pending requests
router.get('/pending-requests', verifyToken, isAdmin, async (req, res) => {
    try {
        console.log('📋 Fetching pending update requests...');

        // Check if table exists
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'update_requests')
            .eq('table_schema', 'public');

        if (tableError || !tables || tables.length === 0) {
            return res.json([]);
        }

        const { data: requests, error } = await supabase
            .from('update_requests')
            .select(`
                *,
                employees!inner(first_name, last_name, email, designation, department)
            `)
            .in('status', ['pending', 'in_progress'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Format requests
        const formattedRequests = (requests || []).map(req => ({
            ...req,
            requested_fields: req.requested_fields || [],
            employee_data: req.employee_data || null,
            first_name: req.employees?.first_name,
            last_name: req.employees?.last_name,
            email: req.employees?.email,
            designation: req.employees?.designation,
            department: req.employees?.department,
            employees: undefined
        }));

        res.json(formattedRequests);

    } catch (error) {
        console.error('❌ Error fetching pending requests:', error);
        res.json([]);
    }
});

// Send update request to employee
router.post('/send-request', verifyToken, isAdmin, async (req, res) => {
    try {
        const { employee_id, requested_fields, requested_field_names, notes } = req.body;
        
        console.log('📝 Sending update request:', { employee_id, requested_fields });
        
        // Check if requested_field_names column exists
        const { data: columns, error: columnsError } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'update_requests')
            .eq('column_name', 'requested_field_names')
            .eq('table_schema', 'public');

        const insertData = {
            employee_id,
            admin_id: req.userId,
            requested_fields: requested_fields || [],
            notes: notes || null,
            status: 'pending',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        // Add requested_field_names if column exists
        if (columns && columns.length > 0) {
            insertData.requested_field_names = requested_field_names || [];
        }

        const { data, error } = await supabase
            .from('update_requests')
            .insert([insertData])
            .select();

        if (error) throw error;

        res.status(201).json({ 
            success: true,
            message: 'Update request sent successfully',
            request_id: data[0].id
        });
        
    } catch (error) {
        console.error('❌ Error sending update request:', error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Database error: ' + error.message
        });
    }
});

// Get completed requests
router.get('/completed-requests', verifyToken, isAdmin, async (req, res) => {
    try {
        console.log('📋 Fetching completed update requests...');

        // Check if update_requests table exists
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'update_requests')
            .eq('table_schema', 'public');

        if (tableError || !tables || tables.length === 0) {
            console.log('ℹ️ update_requests table does not exist');
            return res.json([]);
        }

        // Get requests with employee details
        const { data: requests, error } = await supabase
            .from('update_requests')
            .select(`
                *,
                employees!left(first_name, last_name, email, designation, department, phone)
            `)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        console.log(`✅ Found ${requests?.length || 0} completed requests`);

        // Format requests
        const formattedRequests = (requests || []).map(req => ({
            ...req,
            requested_fields: req.requested_fields || [],
            employee_data: req.employee_data || {},
            employeeDetails: {
                first_name: req.employees?.first_name,
                last_name: req.employees?.last_name,
                email: req.employees?.email,
                designation: req.employees?.designation,
                department: req.employees?.department,
                phone: req.employees?.phone
            },
            employees: undefined
        }));

        res.json(formattedRequests);

    } catch (error) {
        console.error('❌ Error fetching completed requests:', error);
        
        // Return empty array instead of 500 error
        res.json([]);
    }
});

// Handle request (approve/reject)
router.post('/handle-request', verifyToken, isAdmin, async (req, res) => {
    try {
        const { request_id, action } = req.body;
        
        console.log(`📝 ${action}ing update request: ${request_id}`);

        // Check if update_requests table exists
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'update_requests')
            .eq('table_schema', 'public');

        if (tableError || !tables || tables.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Update requests table not found' 
            });
        }

        // Get request details
        const { data: requests, error: fetchError } = await supabase
            .from('update_requests')
            .select('*')
            .eq('id', request_id);

        if (fetchError) throw fetchError;

        if (!requests || requests.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found' 
            });
        }

        const request = requests[0];

        // Check notifications table columns
        const { data: notifColumns, error: notifColError } = await supabase
            .from('information_schema.columns')
            .select('column_name')
            .eq('table_name', 'notifications')
            .eq('table_schema', 'public');

        const notifColumnNames = notifColumns?.map(col => col.column_name) || [];
        console.log('📊 Notifications columns:', notifColumnNames);

        if (action === 'approve') {
            // Parse employee data
            let employeeData = request.employee_data || {};
            
            if (Object.keys(employeeData).length > 0) {
                // Get employees table columns
                const { data: empColumns, error: empColError } = await supabase
                    .from('information_schema.columns')
                    .select('column_name')
                    .eq('table_name', 'employees')
                    .eq('table_schema', 'public');

                const columnNames = empColumns?.map(col => col.column_name) || [];
                
                // Build update object dynamically
                const updateData = {};
                const fieldMapping = {
                    'first_name': 'first_name',
                    'last_name': 'last_name',
                    'email': 'email',
                    'phone': 'phone',
                    'address': 'address',
                    'city': 'city',
                    'state': 'state',
                    'pincode': 'pincode',
                    'bank_name': 'bank_name',
                    'account_number': 'account_number',
                    'ifsc_code': 'ifsc_code',
                    'pan_number': 'pan_number',
                    'emergency_contact': 'emergency_contact',
                    'designation': 'designation',
                    'department': 'department',
                    'employment_type': 'employment_type',
                    'shift_timing': 'shift_timing',
                    'reporting_manager': 'reporting_manager',
                    'dob': 'dob',
                    'blood_group': 'blood_group',
                    'gross_salary': 'gross_salary',
                    'in_hand_salary': 'in_hand_salary',
                    'aadhar_number': 'aadhar_number'
                };
                
                Object.keys(employeeData).forEach(key => {
                    const columnName = fieldMapping[key] || key;
                    
                    if (columnNames.includes(columnName) && 
                        employeeData[key] !== null && 
                        employeeData[key] !== undefined) {
                        updateData[columnName] = employeeData[key];
                    }
                });

                if (Object.keys(updateData).length > 0) {
                    const { error: updateError } = await supabase
                        .from('employees')
                        .update(updateData)
                        .eq('employee_id', request.employee_id);

                    if (updateError) throw updateError;
                    console.log('✅ Employee data updated successfully');
                }
            }

            // Update request status
            const { error: updateReqError } = await supabase
                .from('update_requests')
                .update({
                    status: 'approved',
                    updated_at: new Date().toISOString()
                })
                .eq('id', request_id);

            if (updateReqError) throw updateReqError;

            // Create notification based on available columns
            const notificationData = {
                employee_id: request.employee_id,
                message: 'Your information update request has been approved by admin.',
                type: 'update_approved',
                created_at: new Date().toISOString()
            };

            if (notifColumnNames.includes('title')) {
                notificationData.title = 'Update Request Approved';
            }
            if (notifColumnNames.includes('reference_id')) {
                notificationData.reference_id = request_id;
            }

            const { error: notifError } = await supabase
                .from('notifications')
                .insert([notificationData]);

            if (notifError) {
                console.log('⚠️ Could not create notification:', notifError.message);
            }

            console.log(`✅ Request approved successfully`);

            res.json({ 
                success: true,
                message: 'Request approved successfully'
            });

        } else if (action === 'reject') {
            // Update request status
            const { error: updateReqError } = await supabase
                .from('update_requests')
                .update({
                    status: 'rejected',
                    updated_at: new Date().toISOString()
                })
                .eq('id', request_id);

            if (updateReqError) throw updateReqError;

            // Create notification based on available columns
            const notificationData = {
                employee_id: request.employee_id,
                message: 'Your information update request has been rejected by admin.',
                type: 'update_rejected',
                created_at: new Date().toISOString()
            };

            if (notifColumnNames.includes('title')) {
                notificationData.title = 'Update Request Rejected';
            }
            if (notifColumnNames.includes('reference_id')) {
                notificationData.reference_id = request_id;
            }

            const { error: notifError } = await supabase
                .from('notifications')
                .insert([notificationData]);

            if (notifError) {
                console.log('⚠️ Could not create notification:', notifError.message);
            }

            console.log(`✅ Request rejected successfully`);

            res.json({ 
                success: true,
                message: 'Request rejected successfully'
            });

        } else {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid action. Use "approve" or "reject"' 
            });
        }

    } catch (error) {
        console.error(`❌ Error handling request:`, error);
        
        res.status(500).json({ 
            success: false, 
            message: 'Error processing request',
            error: error.message 
        });
    }
});

module.exports = router;