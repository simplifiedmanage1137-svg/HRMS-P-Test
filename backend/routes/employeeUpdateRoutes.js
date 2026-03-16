const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const { verifyToken } = require('../middleware/auth');

// Get pending requests for employee
router.get('/pending-requests', verifyToken, async (req, res) => {
    try {
        console.log('='.repeat(50));
        console.log('📋 PENDING REQUESTS API CALLED');
        console.log('👤 User from token:', req.user);
        console.log('👤 Employee ID:', req.employeeId);
        console.log('='.repeat(50));

        if (!req.employeeId) {
            console.log('❌ No employee ID in token');
            return res.status(400).json({ 
                success: false, 
                message: 'Employee ID not found in token' 
            });
        }

        // Check if table exists using information_schema
        const { data: tables, error: tableError } = await supabase
            .from('information_schema.tables')
            .select('table_name')
            .eq('table_name', 'update_requests')
            .eq('table_schema', 'public');

        if (tableError) {
            console.error('❌ Error checking table:', tableError);
        }

        console.log('📊 Table exists:', tables && tables.length > 0);
        
        if (!tables || tables.length === 0) {
            return res.json([]);
        }

        const { data: requests, error } = await supabase
            .from('update_requests')
            .select('*')
            .eq('employee_id', req.employeeId)
            .in('status', ['pending', 'in_progress'])
            .order('created_at', { ascending: false });

        if (error) throw error;

        console.log(`📊 Found ${requests?.length || 0} requests for employee ${req.employeeId}`);
        
        if (requests && requests.length > 0) {
            console.log('📊 First request:', requests[0]);
        }

        // Format requests (JSON fields are already parsed by Supabase)
        console.log(`✅ Sending ${requests?.length || 0} formatted requests`);
        res.json(requests || []);

    } catch (error) {
        console.error('❌ Error fetching pending requests:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching requests',
            error: error.message 
        });
    }
});

// Get specific request details
router.get('/request/:requestId', verifyToken, async (req, res) => {
    try {
        const { requestId } = req.params;

        const { data: requests, error } = await supabase
            .from('update_requests')
            .select('*')
            .eq('id', requestId);

        if (error) throw error;

        if (!requests || requests.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found' 
            });
        }

        const request = requests[0];

        // Verify ownership
        if (request.employee_id !== req.employeeId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }

        res.json(request);

    } catch (error) {
        console.error('❌ Error fetching request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching request',
            error: error.message 
        });
    }
});

// Accept request endpoint
router.post('/accept-request/:requestId', verifyToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        
        console.log('📝 Accepting request:', requestId);
        console.log('👤 Employee ID from token:', req.employeeId);

        // Check if request exists and belongs to this employee
        const { data: requests, error: fetchError } = await supabase
            .from('update_requests')
            .select('*')
            .eq('id', requestId)
            .eq('employee_id', req.employeeId);

        if (fetchError) throw fetchError;

        if (!requests || requests.length === 0) {
            console.log('❌ Request not found or does not belong to employee');
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found or does not belong to you' 
            });
        }

        const request = requests[0];
        console.log('✅ Found request:', request);

        // Check if request is in pending state
        if (request.status !== 'pending') {
            console.log('❌ Request is not in pending state:', request.status);
            return res.status(400).json({ 
                success: false, 
                message: `Request is already ${request.status}` 
            });
        }

        // Update status to in_progress
        const { error: updateError } = await supabase
            .from('update_requests')
            .update({ 
                status: 'in_progress',
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        console.log('✅ Request updated successfully');

        res.json({ 
            success: true, 
            message: 'Request accepted successfully' 
        });

    } catch (error) {
        console.error('❌ Error accepting request:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error',
            error: error.message 
        });
    }
});

// Employee submits updated data
router.post('/submit-update', verifyToken, async (req, res) => {
    try {
        const { requestId, updatedData } = req.body;

        // Get request
        const { data: requests, error: fetchError } = await supabase
            .from('update_requests')
            .select('*')
            .eq('id', requestId);

        if (fetchError) throw fetchError;

        if (!requests || requests.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'Request not found' 
            });
        }

        const request = requests[0];

        // Verify ownership
        if (request.employee_id !== req.employeeId) {
            return res.status(403).json({ 
                success: false, 
                message: 'Access denied' 
            });
        }

        // Check status
        if (request.status !== 'in_progress') {
            return res.status(400).json({ 
                success: false, 
                message: 'Request is not in progress' 
            });
        }

        // Update request with employee data
        const { error: updateError } = await supabase
            .from('update_requests')
            .update({ 
                status: 'completed',
                employee_data: updatedData,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // Get admin users for notification
        const { data: admins, error: adminError } = await supabase
            .from('users')
            .select('id')
            .eq('role', 'admin')
            .limit(1);

        if (adminError) throw adminError;

        // Create notification for admin
        if (admins && admins.length > 0) {
            // Check notification table columns
            const { data: notifColumns, error: colError } = await supabase
                .from('information_schema.columns')
                .select('column_name')
                .eq('table_name', 'admin_notifications')
                .eq('table_schema', 'public');

            const columnNames = notifColumns?.map(col => col.column_name) || [];

            const notificationData = {
                admin_id: admins[0].id,
                message: `Employee ${req.employeeId} has submitted their information update for approval.`,
                type: 'update_completed',
                reference_id: requestId,
                created_at: new Date().toISOString()
            };

            if (columnNames.includes('title')) {
                notificationData.title = 'Employee Update Submitted';
            }

            const { error: notifError } = await supabase
                .from('admin_notifications')
                .insert([notificationData]);

            if (notifError) {
                console.log('⚠️ Could not create admin notification:', notifError.message);
            }
        }

        res.json({ 
            success: true,
            message: 'Update submitted successfully. Waiting for admin approval.'
        });

    } catch (error) {
        console.error('❌ Error submitting update:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error submitting update',
            error: error.message 
        });
    }
});

// Get completed requests for employee (history)
router.get('/completed-requests', verifyToken, async (req, res) => {
    try {
        const { data: requests, error } = await supabase
            .from('update_requests')
            .select('*')
            .eq('employee_id', req.employeeId)
            .in('status', ['approved', 'rejected'])
            .order('updated_at', { ascending: false });

        if (error) throw error;

        res.json(requests || []);

    } catch (error) {
        console.error('❌ Error fetching completed requests:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching requests',
            error: error.message 
        });
    }
});

// Get count of pending notifications for employee
router.get('/notification-count', verifyToken, async (req, res) => {
    try {
        const { count, error } = await supabase
            .from('update_requests')
            .select('*', { count: 'exact', head: true })
            .eq('employee_id', req.employeeId)
            .eq('status', 'pending');

        if (error) throw error;

        res.json({ 
            success: true,
            count: count || 0 
        });

    } catch (error) {
        console.error('❌ Error fetching notification count:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching count',
            error: error.message 
        });
    }
});

// Get current employee data for editing
router.get('/current-data', verifyToken, async (req, res) => {
    try {
        const { data: employees, error } = await supabase
            .from('employees')
            .select('*')
            .eq('employee_id', req.employeeId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ 
                    success: false, 
                    message: 'Employee not found' 
                });
            }
            throw error;
        }

        res.json(employees);

    } catch (error) {
        console.error('❌ Error fetching employee data:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching data',
            error: error.message 
        });
    }
});

// Get admin notifications for employee
router.get('/admin-notifications', verifyToken, async (req, res) => {
    try {
        console.log('📋 Fetching admin notifications for employee:', req.employeeId);
        
        const { data: notifications, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('employee_id', req.employeeId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) throw error;

        res.json({
            success: true,
            notifications: notifications || []
        });

    } catch (error) {
        console.error('❌ Error fetching admin notifications:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error fetching notifications',
            error: error.message 
        });
    }
});

// Get all pending requests (for admin dashboard)
router.get('/admin/pending-requests', verifyToken, async (req, res) => {
    try {
        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        const { data: requests, error } = await supabase
            .from('update_requests')
            .select(`
                *,
                employees!inner(first_name, last_name, email, department, designation)
            `)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // Format requests with employee details
        const formattedRequests = (requests || []).map(req => ({
            ...req,
            employee_first_name: req.employees?.first_name,
            employee_last_name: req.employees?.last_name,
            employee_email: req.employees?.email,
            employee_department: req.employees?.department,
            employee_designation: req.employees?.designation,
            employees: undefined
        }));

        res.json(formattedRequests);

    } catch (error) {
        console.error('❌ Error fetching admin pending requests:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching requests',
            error: error.message
        });
    }
});

// Admin approves/rejects completed request
router.post('/admin/handle-completed/:requestId', verifyToken, async (req, res) => {
    try {
        const { requestId } = req.params;
        const { action, comments } = req.body;

        // Check if user is admin
        if (req.userRole !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin access required'
            });
        }

        if (!['approve', 'reject'].includes(action)) {
            return res.status(400).json({
                success: false,
                message: 'Action must be approve or reject'
            });
        }

        // Get request details
        const { data: requests, error: fetchError } = await supabase
            .from('update_requests')
            .select('*')
            .eq('id', requestId)
            .eq('status', 'completed')
            .single();

        if (fetchError || !requests) {
            return res.status(404).json({
                success: false,
                message: 'Completed request not found'
            });
        }

        const request = requests;
        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        // Update request status
        const { error: updateError } = await supabase
            .from('update_requests')
            .update({
                status: newStatus,
                admin_comments: comments || null,
                updated_at: new Date().toISOString()
            })
            .eq('id', requestId);

        if (updateError) throw updateError;

        // If approved, update employee data
        if (action === 'approve' && request.employee_data) {
            const { error: empUpdateError } = await supabase
                .from('employees')
                .update(request.employee_data)
                .eq('employee_id', request.employee_id);

            if (empUpdateError) throw empUpdateError;
        }

        // Create notification for employee
        const notificationMessage = action === 'approve' 
            ? 'Your information update request has been approved by admin.'
            : `Your information update request has been rejected by admin.${comments ? ' Reason: ' + comments : ''}`;

        const { error: notifError } = await supabase
            .from('notifications')
            .insert([{
                employee_id: request.employee_id,
                title: `Update Request ${action === 'approve' ? 'Approved' : 'Rejected'}`,
                message: notificationMessage,
                type: `update_${action === 'approve' ? 'approved' : 'rejected'}`,
                reference_id: requestId,
                created_at: new Date().toISOString()
            }]);

        if (notifError) {
            console.log('⚠️ Could not create notification:', notifError.message);
        }

        res.json({
            success: true,
            message: `Request ${action === 'approve' ? 'approved' : 'rejected'} successfully`
        });

    } catch (error) {
        console.error('❌ Error handling completed request:', error);
        res.status(500).json({
            success: false,
            message: 'Error processing request',
            error: error.message
        });
    }
});

module.exports = router;