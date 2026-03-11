// server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const db = require('./config/database');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');

const app = express();
dotenv.config();

// ============== MIDDLEWARE ==============
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create upload directories if they don't exist
const uploadsDir = path.join(__dirname, 'uploads');
const profilesDir = path.join(uploadsDir, 'profiles');
const documentsDir = path.join(uploadsDir, 'documents');

[uploadsDir, profilesDir, documentsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    }
});

// ============== HELPER FUNCTIONS ==============
const generateSessionId = () => {
    return uuidv4();
};

const parseShiftStart = (shiftTiming) => {
    if (!shiftTiming) return null;

    const parts = shiftTiming.split('-');
    if (parts.length === 0) return null;

    const part = parts[0].trim();
    const ampmMatch = part.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (ampmMatch) {
        let hour = parseInt(ampmMatch[1], 10);
        const minute = parseInt(ampmMatch[2], 10);
        const ampm = ampmMatch[3].toUpperCase();
        if (ampm === 'PM' && hour !== 12) hour += 12;
        if (ampm === 'AM' && hour === 12) hour = 0;
        return { hour, minute };
    }

    const militaryMatch = part.match(/(\d{1,2}):(\d{2})/);
    if (militaryMatch) {
        return {
            hour: parseInt(militaryMatch[1], 10),
            minute: parseInt(militaryMatch[2], 10)
        };
    }

    return null;
};

// ============== MIDDLEWARE FUNCTIONS ==============
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here', (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// ============== TEST ROUTES ==============
app.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'Backend is working!',
        timestamp: new Date().toISOString()
    });
});

app.get('/api/test-db', async (req, res) => {
    try {
        const [result] = await db.query('SELECT 1 + 1 as result');
        res.json({
            success: true,
            message: 'Database connected successfully!',
            result: result[0].result,
            database: process.env.DB_NAME || 'ems_db'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Database connection failed',
            error: error.message
        });
    }
});

// ============== AUTH ROUTES ==============
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log('🔐 Login attempt for email:', email);

        // Hardcoded admin for testing
        if (email === 'admin@ems.com' && password === 'admin123') {
            const token = jwt.sign(
                {
                    id: 1,
                    email,
                    role: 'admin',
                    employeeId: 'ADMIN001'
                },
                process.env.JWT_SECRET || 'your_jwt_secret_key_here',
                { expiresIn: '7d' }
            );

            return res.json({
                success: true,
                token,
                user: {
                    id: 1,
                    email,
                    role: 'admin',
                    employeeId: 'ADMIN001',
                    firstName: 'Admin',
                    lastName: 'User'
                }
            });
        }

        // Employee login from email format: emp_B2B250201@ems.com
        if (email.startsWith('emp_') && email.endsWith('@ems.com')) {
            const employeeId = email.replace('emp_', '').replace('@ems.com', '');

            // Check if employee exists
            const [employees] = await db.query(
                'SELECT * FROM employees WHERE employee_id = ?',
                [employeeId]
            );

            if (employees.length > 0) {
                const employee = employees[0];

                // Accept default password or employee ID as password
                if (password === 'Welcome@123' || password === employeeId) {
                    const token = jwt.sign(
                        {
                            id: employee.id,
                            email: employee.email,
                            role: 'employee',
                            employeeId: employee.employee_id
                        },
                        process.env.JWT_SECRET || 'your_jwt_secret_key_here',
                        { expiresIn: '7d' }
                    );

                    return res.json({
                        success: true,
                        token,
                        user: {
                            id: employee.id,
                            email: employee.email,
                            role: 'employee',
                            employeeId: employee.employee_id,
                            firstName: employee.first_name,
                            lastName: employee.last_name
                        }
                    });
                }
            }
        }

        return res.status(401).json({
            success: false,
            message: 'Invalid email or password'
        });

    } catch (error) {
        console.error('❌ Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login'
        });
    }
});

// ============== TODAY'S EVENTS ROUTE ==============
app.get('/api/employees/today-events', async (req, res) => {
    try {
        console.log('📅 Fetching today events...');

        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();

        // Get all employees
        const [employees] = await db.query('SELECT * FROM employees');

        const birthdays = [];
        const anniversaries = [];

        employees.forEach(emp => {
            // Check birthday
            if (emp.dob) {
                const dob = new Date(emp.dob);
                const dobMonth = dob.getMonth() + 1;
                const dobDay = dob.getDate();

                if (dobMonth === todayMonth && dobDay === todayDay) {
                    birthdays.push({
                        id: emp.id,
                        employee_id: emp.employee_id,
                        first_name: emp.first_name,
                        last_name: emp.last_name,
                        department: emp.department,
                        position: emp.designation || emp.position,
                        profile_image: emp.profile_image
                    });
                }
            }

            // Check work anniversary
            if (emp.joining_date) {
                const joiningDate = new Date(emp.joining_date);
                const joiningMonth = joiningDate.getMonth() + 1;
                const joiningDay = joiningDate.getDate();

                if (joiningMonth === todayMonth && joiningDay === todayDay) {
                    const years = today.getFullYear() - joiningDate.getFullYear();
                    if (years > 0) { // Only count if at least 1 year completed
                        anniversaries.push({
                            id: emp.id,
                            employee_id: emp.employee_id,
                            first_name: emp.first_name,
                            last_name: emp.last_name,
                            department: emp.department,
                            position: emp.designation || emp.position,
                            profile_image: emp.profile_image,
                            joining_date: emp.joining_date,
                            years: years
                        });
                    }
                }
            }
        });

        console.log(`✅ Found ${birthdays.length} birthdays and ${anniversaries.length} anniversaries today`);

        res.json({
            success: true,
            date: today.toISOString().split('T')[0],
            birthdays,
            anniversaries,
            total: birthdays.length + anniversaries.length
        });

    } catch (error) {
        console.error('❌ Error fetching today events:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch events',
            error: error.message
        });
    }
});

// ============== EMPLOYEE ROUTES ==============

// Get all employees
app.get('/api/employees', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM employees ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching employees:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get employee by ID
// server.js mein employee route
app.get('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('📤 Fetching employee with ID:', id);

        // Check if id is number or string
        let query;
        let value;

        if (!isNaN(id)) {
            // If id is number, search by id
            query = 'SELECT * FROM employees WHERE id = ?';
            value = parseInt(id);
        } else {
            // If id is string, search by employee_id
            query = 'SELECT * FROM employees WHERE employee_id = ?';
            value = id;
        }

        const [rows] = await db.query(query, [value]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('❌ Error fetching employee:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get employee by employee_id (for profile)
app.get('/api/employees/profile/:employeeId', async (req, res) => {
    try {
        const { employeeId } = req.params;
        const [rows] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [employeeId]);

        if (rows.length === 0) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json(rows[0]);
    } catch (error) {
        console.error('❌ Error fetching employee profile:', error);
        res.status(500).json({ error: error.message });
    }
});

// server.js - Update the POST /api/employees endpoint with better error handling

// Create new employee
app.post('/api/employees', async (req, res) => {
    try {
        const employeeData = req.body;

        console.log('📝 Creating new employee:', employeeData.email);
        console.log('Employee ID to create:', employeeData.employee_id);

        // Check if employee_id already exists
        const [existing] = await db.query(
            'SELECT employee_id FROM employees WHERE employee_id = ?',
            [employeeData.employee_id]
        );

        if (existing.length > 0) {
            console.log('❌ Employee ID already exists:', employeeData.employee_id);
            return res.status(400).json({
                success: false,
                message: 'Employee ID already exists. Please try again.',
                error: `Duplicate employee_id: ${employeeData.employee_id}`
            });
        }

        // Check if email already exists
        const [existingEmail] = await db.query(
            'SELECT email FROM employees WHERE email = ?',
            [employeeData.email]
        );

        if (existingEmail.length > 0) {
            console.log('❌ Email already exists:', employeeData.email);
            return res.status(400).json({
                success: false,
                message: 'Email already exists. Please use a different email.',
                error: `Duplicate email: ${employeeData.email}`
            });
        }

        const query = `
            INSERT INTO employees (
                first_name, middle_name, last_name, employee_id, email,
                joining_date, designation, department, reporting_manager,
                employment_type, shift_timing,
                in_hand_salary, gross_salary,
                bank_account_name, account_number, ifsc_code, branch_name,
                pan_number, aadhar_number, dob, address, blood_group,
                emergency_contact, contract_policy
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            employeeData.first_name,
            employeeData.middle_name || null,
            employeeData.last_name,
            employeeData.employee_id,
            employeeData.email,
            employeeData.joining_date,
            employeeData.designation,
            employeeData.department,
            employeeData.reporting_manager || null,
            employeeData.employment_type || 'Full Time',
            employeeData.shift_timing || '9:00 AM - 6:00 PM',
            employeeData.in_hand_salary || 0,
            employeeData.gross_salary || 0,
            employeeData.bank_account_name,
            employeeData.account_number,
            employeeData.ifsc_code,
            employeeData.branch_name,
            employeeData.pan_number,
            employeeData.aadhar_number,
            employeeData.dob,
            employeeData.address,
            employeeData.blood_group || null,
            employeeData.emergency_contact,
            employeeData.contract_policy || null
        ];

        console.log('Executing INSERT query...');
        const [result] = await db.query(query, values);
        console.log('✅ Employee inserted with ID:', result.insertId);

        // Create leave balance for employee
        try {
            await db.query(
                `INSERT INTO leave_balances (employee_id, total_accrued, used, pending, available) 
                 VALUES (?, 12, 0, 0, 12)`,
                [employeeData.employee_id]
            );
            console.log('✅ Leave balance created for employee:', employeeData.employee_id);
        } catch (leaveError) {
            console.error('⚠️ Error creating leave balance:', leaveError);
            // Don't fail the whole request if leave balance creation fails
        }

        res.status(201).json({
            success: true,
            message: 'Employee created successfully',
            employee: {
                id: result.insertId,
                employee_id: employeeData.employee_id
            }
        });

    } catch (error) {
        console.error('❌ Error creating employee:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        
        // Handle duplicate entry error specifically
        if (error.code === 'ER_DUP_ENTRY') {
            const match = error.message.match(/'([^']+)'/g);
            const duplicateField = match ? match[0] : 'unknown';
            
            return res.status(400).json({
                success: false,
                message: 'Duplicate entry detected. Please check your data.',
                error: error.message,
                duplicate_field: duplicateField
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Failed to create employee',
            error: error.message
        });
    }
});

// Update employee
app.put('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const query = `
            UPDATE employees SET
                first_name = ?, middle_name = ?, last_name = ?, email = ?,
                joining_date = ?, designation = ?, department = ?, 
                reporting_manager = ?, employment_type = ?, shift_timing = ?,
                in_hand_salary = ?, gross_salary = ?,
                bank_account_name = ?, account_number = ?, ifsc_code = ?, 
                branch_name = ?, pan_number = ?, aadhar_number = ?, 
                dob = ?, address = ?, blood_group = ?, emergency_contact = ?,
                contract_policy = ?
            WHERE id = ?
        `;

        const values = [
            updates.first_name,
            updates.middle_name || null,
            updates.last_name,
            updates.email,
            updates.joining_date,
            updates.designation,
            updates.department,
            updates.reporting_manager || null,
            updates.employment_type,
            updates.shift_timing,
            updates.in_hand_salary,
            updates.gross_salary,
            updates.bank_account_name,
            updates.account_number,
            updates.ifsc_code,
            updates.branch_name,
            updates.pan_number,
            updates.aadhar_number,
            updates.dob,
            updates.address,
            updates.blood_group || null,
            updates.emergency_contact,
            updates.contract_policy || null,
            id
        ];

        await db.query(query, values);

        res.json({
            success: true,
            message: 'Employee updated successfully'
        });

    } catch (error) {
        console.error('❌ Error updating employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update employee',
            error: error.message
        });
    }
});

// Delete employee
app.delete('/api/employees/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // First get employee_id to delete related records
        const [employee] = await db.query('SELECT employee_id FROM employees WHERE id = ?', [id]);

        if (employee.length > 0) {
            // Delete leave balances
            await db.query('DELETE FROM leave_balances WHERE employee_id = ?', [employee[0].employee_id]);

            // Delete leaves
            await db.query('DELETE FROM leaves WHERE employee_id = ?', [employee[0].employee_id]);

            // Delete attendance
            await db.query('DELETE FROM attendance WHERE employee_id = ?', [employee[0].employee_id]);
        }

        // Delete employee
        await db.query('DELETE FROM employees WHERE id = ?', [id]);

        res.json({
            success: true,
            message: 'Employee deleted successfully'
        });
    } catch (error) {
        console.error('❌ Error deleting employee:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete employee',
            error: error.message
        });
    }
});

// ============== DOCUMENT MANAGEMENT ROUTES ==============

// server.js mein yeh routes add karein (already existing hain ya nahi check karein)

// ============== DOCUMENT MANAGEMENT ROUTES ==============

// Get employee documents
app.get('/api/employees/:employeeId/documents', async (req, res) => {
    try {
        const { employeeId } = req.params;
        
        console.log(`📄 Fetching documents for employee: ${employeeId}`);
        
        // Check if employee exists (id ya employee_id dono se search karein)
        let query;
        let value;
        
        if (!isNaN(employeeId)) {
            // If employeeId is number, search by id
            query = 'SELECT * FROM employees WHERE id = ?';
            value = parseInt(employeeId);
        } else {
            // If employeeId is string, search by employee_id
            query = 'SELECT * FROM employees WHERE employee_id = ?';
            value = employeeId;
        }
        
        const [employees] = await db.query(query, [value]);
        
        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        
        const employee = employees[0];
        
        // Return all document fields
        const documents = {
            profile_image: employee.profile_image || null,
            appointment_letter: employee.appointment_letter || null,
            offer_letter: employee.offer_letter || null,
            contract_document: employee.contract_document || null,
            aadhar_card: employee.aadhar_card || null,
            pan_card: employee.pan_card || null,
            resume: employee.resume || null,
            salary_slip: employee.salary_slip || null,
            bank_proof: employee.bank_proof || null,
            education_certificates: employee.education_certificates || null,
            experience_certificates: employee.experience_certificates || null
        };
        
        console.log('✅ Documents fetched successfully');
        res.json(documents);

    } catch (error) {
        console.error('❌ Error fetching documents:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch documents',
            error: error.message
        });
    }
});

// Get specific document
app.get('/api/employees/:employeeId/documents/:documentType', async (req, res) => {
    try {
        const { employeeId, documentType } = req.params;
        const { inline } = req.query; // For viewing in browser vs downloading
        
        console.log(`📄 Fetching document ${documentType} for employee: ${employeeId}`);
        
        // Find employee
        let query;
        let value;
        
        if (!isNaN(employeeId)) {
            query = 'SELECT * FROM employees WHERE id = ?';
            value = parseInt(employeeId);
        } else {
            query = 'SELECT * FROM employees WHERE employee_id = ?';
            value = employeeId;
        }
        
        const [employees] = await db.query(query, [value]);
        
        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Employee not found'
            });
        }
        
        const employee = employees[0];
        
        // Check if document exists
        if (!employee[documentType]) {
            return res.status(404).json({
                success: false,
                message: 'Document not found'
            });
        }

        const filename = employee[documentType];
        
        // Check if file exists in uploads directory
        const possiblePaths = [
            path.join(__dirname, 'uploads/documents', filename),
            path.join(__dirname, 'uploads', filename),
            path.join(__dirname, 'uploads/profiles', filename)
        ];
        
        let filePath = null;
        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                filePath = p;
                break;
            }
        }

        if (!filePath) {
            console.log(`⚠️ File not found on server: ${filename}`);
            return res.status(404).json({
                success: false,
                message: 'File not found on server'
            });
        }

        // Set appropriate headers
        if (inline === 'true') {
            // For viewing in browser
            res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        } else {
            // For downloading
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        }
        
        // Set content type based on file extension
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        };
        
        if (mimeTypes[ext]) {
            res.setHeader('Content-Type', mimeTypes[ext]);
        }
        
        // Send file
        res.sendFile(filePath);

    } catch (error) {
        console.error('❌ Error fetching document:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch document',
            error: error.message
        });
    }
});

// ============== LEAVE ROUTES ==============

// Get all leaves (supports filtering by employee)
// app.get('/api/leaves', async (req, res) => {
//     try {
//         const { employee_id } = req.query;

//         let query = `
//             SELECT l.*, 
//                    e.first_name, e.last_name, e.department, e.employee_id,
//                    e.reporting_manager
//             FROM leaves l
//             JOIN employees e ON l.employee_id = e.employee_id
//         `;

//         const params = [];
//         if (employee_id) {
//             query += ' WHERE l.employee_id = ?';
//             params.push(employee_id);
//         }

//         query += ' ORDER BY l.created_at DESC';

//         const [rows] = await db.query(query, params);
//         res.json(rows);
//     } catch (error) {
//         console.error('❌ Error fetching leaves:', error);
//         res.status(500).json({ error: error.message });
//     }
// });

// Get leave balance for current year
// app.get('/api/leaves/balance/:employeeId', async (req, res) => {
//     try {
//         const { employeeId } = req.params;
//         const today = new Date();
//         const currentYear = today.getFullYear();
//         const currentMonth = today.getMonth() + 1;
//         const currentDay = today.getDate();

//         console.log(`Fetching leave balance for employee: ${employeeId} for year ${currentYear}`);

//         // First check if employee exists
//         const [employees] = await db.query(
//             'SELECT * FROM employees WHERE employee_id = ?',
//             [employeeId]
//         );

//         if (employees.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Employee not found'
//             });
//         }

//         const joiningDate = new Date(employees[0].joining_date);
//         const joinYear = joiningDate.getFullYear();
//         const joinMonth = joiningDate.getMonth() + 1;

//         // Calculate completed months for current year based on join date
//         const calculateCompletedMonths = () => {
//             // If the requested year is before joining year, no accrual
//             if (currentYear < joinYear) return 0;

//             // Determine start month in the current year
//             const startMonth = currentYear === joinYear ? joinMonth : 1;

//             let completedMonths = 0;
//             for (let month = startMonth; month <= currentMonth; month++) {
//                 if (month < currentMonth) {
//                     completedMonths += 1; // previous months are fully completed
//                 } else {
//                     // current month: only count if we are past the last day of the month
//                     const lastDayOfMonth = new Date(currentYear, month, 0).getDate();
//                     if (currentDay > lastDayOfMonth) {
//                         completedMonths += 1;
//                     }
//                 }
//             }

//             return completedMonths;
//         };

//         const completedMonthsInYear = calculateCompletedMonths();
//         const totalAccrued = completedMonthsInYear * 1.5;

//         // Get or create leave balance for current year
//         const [balance] = await db.query(
//             'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?',
//             [employeeId, currentYear]
//         );

//         let used = 0;
//         let pending = 0;

//         if (balance.length > 0) {
//             used = parseFloat(balance[0].used) || 0;
//             pending = parseFloat(balance[0].pending) || 0;

//             const available = totalAccrued - used - pending;

//             // Update database to ensure it matches calculated accrual
//             await db.query(
//                 `UPDATE leave_balances
//                  SET total_accrued = ?, available = ?
//                  WHERE employee_id = ? AND year = ?`,
//                 [totalAccrued, available, employeeId, currentYear]
//             );

//             return res.json({
//                 employee_id: employeeId,
//                 year: currentYear,
//                 total_accrued: totalAccrued,
//                 used,
//                 pending,
//                 available,
//                 completed_months_in_year: completedMonthsInYear,
//                 message: 'Leaves reset at year end; accrual adds 1.5 per fully completed month.'
//             });
//         }

//         // No balance record exists yet - create fresh (no carry forward)
//         const available = totalAccrued;
//         await db.query(
//             `INSERT INTO leave_balances (employee_id, year, total_accrued, used, pending, available, carry_forward)
//              VALUES (?, ?, ?, 0, 0, ?, 0)`,
//             [employeeId, currentYear, totalAccrued, available]
//         );

//         return res.json({
//             employee_id: employeeId,
//             year: currentYear,
//             total_accrued: totalAccrued,
//             used: 0,
//             pending: 0,
//             available,
//             completed_months_in_year: completedMonthsInYear,
//             message: 'Leaves reset at year end; accrual adds 1.5 per fully completed month.'
//         });

//     } catch (error) {
//         console.error('Error fetching leave balance:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch leave balance',
//             error: error.message
//         });
//     }
// });

// Get leave balance for specific year
// app.get('/api/leaves/balance/:employeeId/:year', async (req, res) => {
//     try {
//         const { employeeId, year } = req.params;

//         const [balance] = await db.query(
//             'SELECT * FROM leave_balances WHERE employee_id = ? AND year = ?',
//             [employeeId, year]
//         );

//         if (balance.length > 0) {
//             res.json({
//                 employee_id: employeeId,
//                 year: parseInt(year),
//                 total_accrued: parseFloat(balance[0].total_accrued) || 12,
//                 used: parseFloat(balance[0].used) || 0,
//                 pending: parseFloat(balance[0].pending) || 0,
//                 available: parseFloat(balance[0].available) || 12,
//                 carry_forward: parseFloat(balance[0].carry_forward) || 0
//             });
//         } else {
//             res.status(404).json({
//                 success: false,
//                 message: 'No leave balance found for this year'
//             });
//         }

//     } catch (error) {
//         console.error('Error fetching leave balance:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to fetch leave balance',
//             error: error.message
//         });
//     }
// });

// Create leave request
// app.post('/api/leaves', async (req, res) => {
//     try {
//         const leaveData = req.body;
//         const currentYear = new Date().getFullYear();

//         console.log('Creating leave request:', leaveData);

//         // Start transaction
//         const connection = await db.getConnection();
//         await connection.beginTransaction();

//         try {
//             // Insert leave request
//             const [result] = await connection.query(
//                 `INSERT INTO leaves (
//                     employee_id, leave_type, leave_duration, half_day_type,
//                     start_date, end_date, reason, reporting_manager, days_count, year
//                 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
//                 [
//                     leaveData.employee_id,
//                     leaveData.leave_type,
//                     leaveData.leave_duration,
//                     leaveData.half_day_type || null,
//                     leaveData.start_date,
//                     leaveData.end_date,
//                     leaveData.reason,
//                     leaveData.reporting_manager || null,
//                     leaveData.days_count || 1,
//                     currentYear
//                 ]
//             );

//             // Update leave balance pending count
//             await connection.query(
//                 `UPDATE leave_balances 
//                  SET pending = pending + ? 
//                  WHERE employee_id = ? AND year = ?`,
//                 [leaveData.days_count || 1, leaveData.employee_id, currentYear]
//             );

//             await connection.commit();
//             connection.release();

//             res.status(201).json({
//                 success: true,
//                 message: 'Leave request submitted successfully',
//                 leaveId: result.insertId
//             });

//         } catch (error) {
//             await connection.rollback();
//             connection.release();
//             throw error;
//         }

//     } catch (error) {
//         console.error('Error creating leave request:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to submit leave request',
//             error: error.message
//         });
//     }
// });

// Update leave status
// app.put('/api/leaves/:id/status', async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status, comments } = req.body;

//         const connection = await db.getConnection();
//         await connection.beginTransaction();

//         try {
//             // Get leave details
//             const [leaves] = await connection.query('SELECT * FROM leaves WHERE id = ?', [id]);

//             if (leaves.length === 0) {
//                 await connection.rollback();
//                 connection.release();
//                 return res.status(404).json({ message: 'Leave request not found' });
//             }

//             const leave = leaves[0];
//             const leaveYear = new Date(leave.start_date).getFullYear();

//             // Update leave status
//             await connection.query(
//                 `UPDATE leaves SET status = ?, admin_comments = ? WHERE id = ?`,
//                 [status, comments || null, id]
//             );

//             // Update leave balance
//             if (status === 'approved') {
//                 await connection.query(
//                     `UPDATE leave_balances 
//                      SET used = used + ?, pending = pending - ? 
//                      WHERE employee_id = ? AND year = ?`,
//                     [leave.days_count, leave.days_count, leave.employee_id, leaveYear]
//                 );
//             } else if (status === 'rejected') {
//                 await connection.query(
//                     `UPDATE leave_balances 
//                      SET pending = pending - ? 
//                      WHERE employee_id = ? AND year = ?`,
//                     [leave.days_count, leave.employee_id, leaveYear]
//                 );
//             }

//             await connection.commit();
//             connection.release();

//             res.json({
//                 success: true,
//                 message: `Leave request ${status} successfully`
//             });

//         } catch (error) {
//             await connection.rollback();
//             connection.release();
//             throw error;
//         }

//     } catch (error) {
//         console.error('Error updating leave status:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to update leave status',
//             error: error.message
//         });
//     }
// });

const leaveRoutes = require('./routes/leaveRoutes');
app.use('/api/leaves', leaveRoutes);

// ============== ATTENDANCE ROUTES ==============

// Get attendance report
// app.get('/api/attendance/report', async (req, res) => {
//     try {
//         const { start, end, employee_id } = req.query;

//         let query = `
//             SELECT a.*, e.first_name, e.last_name, e.department 
//             FROM attendance a
//             JOIN employees e ON a.employee_id = e.employee_id
//             WHERE a.attendance_date BETWEEN ? AND ?
//         `;

//         const params = [start, end];

//         if (employee_id) {
//             query += ' AND a.employee_id = ?';
//             params.push(employee_id);
//         }

//         query += ' ORDER BY a.attendance_date DESC, e.first_name';

//         const [rows] = await db.query(query, params);

//         // Add formatted late display (min/sec) to each record
//         rows.forEach(r => {
//             const lateMinutes = parseFloat(r.late_minutes) || 0;
//             if (lateMinutes > 0) {
//                 const lateSeconds = Math.round(lateMinutes * 60);
//                 const hours = Math.floor(lateSeconds / 3600);
//                 const remaining = lateSeconds % 3600;
//                 const mins = Math.floor(remaining / 60);
//                 const secs = remaining % 60;
//                 const parts = [];
//                 if (hours > 0) parts.push(`${hours}h`);
//                 if (mins > 0) parts.push(`${mins}m`);
//                 if (secs > 0) parts.push(`${secs}s`);
//                 r.late_display = parts.length > 0 ? parts.join(' ') : '0s';
//             } else {
//                 r.late_display = null;
//             }
//         });

//         // Calculate stats
//         const stats = {
//             total: rows.length,
//             present: rows.filter(r => r.status === 'present').length,
//             half_day: rows.filter(r => r.status === 'half_day').length,
//             absent: rows.filter(r => r.status === 'absent').length,
//             on_leave: rows.filter(r => r.status === 'on_leave').length,
//             working: rows.filter(r => r.status === 'working').length,
//             late: rows.filter(r => parseFloat(r.late_minutes) > 0).length
//         };

//         res.json({
//             success: true,
//             attendance: rows,
//             stats
//         });

//     } catch (error) {
//         console.error('❌ Error fetching attendance:', error);
//         res.status(500).json({
//             success: false,
//             error: error.message
//         });
//     }
// });

// Get today's attendance for employee
// app.get('/api/attendance/today/:employee_id', async (req, res) => {
//     try {
//         const { employee_id } = req.params;
//         const today = new Date().toISOString().split('T')[0];

//         console.log('Getting attendance for:', employee_id, today);

//         // Check if employee exists
//         const [employee] = await db.query(
//             'SELECT * FROM employees WHERE employee_id = ?',
//             [employee_id]
//         );

//         if (employee.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Employee not found'
//             });
//         }

//         // Check for today's attendance
//         const [todayAttendance] = await db.query(
//             `SELECT a.*, e.first_name, e.last_name, e.shift_timing 
//              FROM attendance a
//              JOIN employees e ON a.employee_id = e.employee_id
//              WHERE a.employee_id = ? AND a.attendance_date = ?`,
//             [employee_id, today]
//         );

//         // Check for any incomplete attendance from previous days
//         const [incompleteAttendance] = await db.query(
//             `SELECT a.*, e.first_name, e.last_name, e.shift_timing 
//              FROM attendance a
//              JOIN employees e ON a.employee_id = e.employee_id
//              WHERE a.employee_id = ? 
//              AND a.clock_in IS NOT NULL 
//              AND a.clock_out IS NULL
//              ORDER BY a.attendance_date DESC
//              LIMIT 1`,
//             [employee_id]
//         );

//         const [activeSession] = await db.query(
//             'SELECT * FROM attendance_sessions WHERE employee_id = ? AND is_active = true',
//             [employee_id]
//         );

//         // Determine which attendance to show
//         let formattedAttendance = null;
//         let hasPreviousIncomplete = false;

//         if (incompleteAttendance.length > 0) {
//             // There's an incomplete attendance from previous day
//             formattedAttendance = { ...incompleteAttendance[0] };
//             hasPreviousIncomplete = true;

//             // Calculate hours so far
//             const clockIn = new Date(formattedAttendance.clock_in);
//             const now = new Date();
//             const hoursSoFar = (now - clockIn) / (1000 * 60 * 60);
//             formattedAttendance.hours_so_far = hoursSoFar.toFixed(2);
//             formattedAttendance.is_previous_day = true;

//             console.log(`⚠️ Found incomplete attendance from ${formattedAttendance.attendance_date}`);

//         } else if (todayAttendance.length > 0) {
//             // Normal today's attendance
//             formattedAttendance = { ...todayAttendance[0] };

//             if (formattedAttendance.clock_out) {
//                 const totalHours = parseFloat(formattedAttendance.total_hours) || 0;

//                 if (totalHours >= 8) {
//                     formattedAttendance.status = 'present';
//                 } else if (totalHours >= 4 && totalHours < 8) {
//                     formattedAttendance.status = 'half_day';
//                 } else if (totalHours > 0 && totalHours < 4) {
//                     formattedAttendance.status = 'absent';
//                 }
//             } else {
//                 // Currently working
//                 const clockIn = new Date(formattedAttendance.clock_in);
//                 const now = new Date();
//                 const currentHours = (now - clockIn) / (1000 * 60 * 60);
//                 formattedAttendance.current_hours = currentHours.toFixed(2);
//             }

//             // Calculate late display if applicable
//             if (formattedAttendance.late_minutes > 0) {
//                 const lateSeconds = Math.round(formattedAttendance.late_minutes * 60);
//                 formattedAttendance.late_display = lateSeconds < 60 ?
//                     `${lateSeconds}s` :
//                     `${Math.floor(lateSeconds / 60)}m ${lateSeconds % 60}s`;
//             }
//         }

//         res.json({
//             success: true,
//             attendance: formattedAttendance,
//             active_session: activeSession[0] || null,
//             has_previous_incomplete: hasPreviousIncomplete,
//             message: hasPreviousIncomplete ?
//                 `You have an incomplete attendance from ${formattedAttendance?.attendance_date}. Please clock out.` :
//                 undefined
//         });

//     } catch (error) {
//         console.error('Error getting attendance:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to get attendance',
//             error: error.message
//         });
//     }
// });

// Clock in
// app.post('/api/attendance/clock-in', async (req, res) => {
//     try {
//         const { employee_id, latitude, longitude } = req.body;
//         const now = new Date();
//         const today = now.toISOString().split('T')[0];

//         // Check if employee exists
//         const [employee] = await db.query(
//             'SELECT * FROM employees WHERE employee_id = ?',
//             [employee_id]
//         );

//         if (employee.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Employee not found'
//             });
//         }

//         // Check if already clocked in today
//         const [existing] = await db.query(
//             'SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?',
//             [employee_id, today]
//         );

//         if (existing.length > 0 && existing[0].clock_in && !existing[0].clock_out) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'Already clocked in today'
//             });
//         }

//         // Get employee shift timing
//         const shiftTiming = employee[0]?.shift_timing || '9:00 AM - 6:00 PM';

//         // Calculate late minutes based on shift start
//         let lateMinutes = 0;
//         let lateDisplay = null;
//         const shiftStart = parseShiftStart(shiftTiming);

//         if (shiftStart) {
//             const shiftStartTime = new Date(now);
//             shiftStartTime.setHours(shiftStart.hour, shiftStart.minute, 0, 0);
//             const diffMs = now - shiftStartTime;
//             if (diffMs > 0) {
//                 lateMinutes = diffMs / (1000 * 60);
//                 const lateSeconds = Math.round(lateMinutes * 60);
//                 const hours = Math.floor(lateSeconds / 3600);
//                 const remaining = lateSeconds % 3600;
//                 const mins = Math.floor(remaining / 60);
//                 const secs = remaining % 60;
//                 const parts = [];
//                 if (hours > 0) parts.push(`${hours}h`);
//                 if (mins > 0) parts.push(`${mins}m`);
//                 if (secs > 0) parts.push(`${secs}s`);
//                 lateDisplay = parts.length > 0 ? parts.join(' ') : '0s';
//             }
//         }

//         const sessionId = generateSessionId();

//         if (existing.length > 0) {
//             // Update existing record
//             await db.query(
//                 `UPDATE attendance 
//                  SET clock_in = ?, late_minutes = ?, latitude = ?, longitude = ?, session_id = ?
//                  WHERE employee_id = ? AND attendance_date = ?`,
//                 [now, lateMinutes, latitude, longitude, sessionId, employee_id, today]
//             );
//         } else {
//             // Insert new record
//             await db.query(
//                 `INSERT INTO attendance 
//                  (employee_id, attendance_date, clock_in, late_minutes, latitude, longitude, shift_time_used, session_id) 
//                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
//                 [employee_id, today, now, lateMinutes, latitude, longitude, shiftTiming, sessionId]
//             );
//         }

//         // Create active session
//         await db.query(
//             `INSERT INTO attendance_sessions 
//              (employee_id, session_id, clock_in_time, last_heartbeat, is_active) 
//              VALUES (?, ?, ?, ?, true)
//              ON DUPLICATE KEY UPDATE
//              last_heartbeat = NOW(), is_active = true`,
//             [employee_id, sessionId, now, now]
//         );

//         res.json({
//             success: true,
//             message: lateMinutes > 0 ? 'Clocked in (late)' : 'Clocked in successfully',
//             clock_in: now,
//             late_minutes: lateMinutes,
//             late_display: lateDisplay,
//             status: 'working',
//             session_id: sessionId
//         });

//     } catch (error) {
//         console.error('❌ Error clocking in:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to clock in',
//             error: error.message
//         });
//     }
// });

// Clock out
// app.post('/api/attendance/clock-out', async (req, res) => {
//     try {
//         const { employee_id, latitude, longitude } = req.body;
//         const now = new Date();
//         const today = now.toISOString().split('T')[0];

//         // Check if employee exists
//         const [employee] = await db.query(
//             'SELECT * FROM employees WHERE employee_id = ?',
//             [employee_id]
//         );

//         if (employee.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Employee not found'
//             });
//         }

//         // Find any incomplete attendance (from any day)
//         const [incompleteAttendance] = await db.query(
//             `SELECT * FROM attendance 
//              WHERE employee_id = ? 
//              AND clock_in IS NOT NULL 
//              AND clock_out IS NULL 
//              ORDER BY attendance_date ASC 
//              LIMIT 1`,
//             [employee_id]
//         );

//         let attendanceRecord = null;
//         let activeSession = null;

//         if (incompleteAttendance.length > 0) {
//             attendanceRecord = incompleteAttendance[0];

//             // Find associated session
//             if (attendanceRecord.session_id) {
//                 const [sessions] = await db.query(
//                     'SELECT * FROM attendance_sessions WHERE session_id = ? AND is_active = true',
//                     [attendanceRecord.session_id]
//                 );
//                 if (sessions.length > 0) {
//                     activeSession = sessions[0];
//                 }
//             }
//         } else {
//             // Check for today's active session
//             const [sessions] = await db.query(
//                 'SELECT * FROM attendance_sessions WHERE employee_id = ? AND is_active = true ORDER BY clock_in_time DESC LIMIT 1',
//                 [employee_id]
//             );
//             if (sessions.length > 0) {
//                 activeSession = sessions[0];

//                 // Get attendance for that session date
//                 const sessionDate = new Date(activeSession.clock_in_time).toISOString().split('T')[0];
//                 const [attendance] = await db.query(
//                     'SELECT * FROM attendance WHERE employee_id = ? AND attendance_date = ?',
//                     [employee_id, sessionDate]
//                 );
//                 if (attendance.length > 0) {
//                     attendanceRecord = attendance[0];
//                 }
//             }
//         }

//         if (!attendanceRecord) {
//             return res.status(400).json({
//                 success: false,
//                 message: 'No active clock-in found. Please clock in first.'
//             });
//         }

//         // Calculate total hours worked
//         const clockIn = new Date(attendanceRecord.clock_in);
//         const totalHours = (now - clockIn) / (1000 * 60 * 60);

//         // Determine status (>=9h Present, >=5h Half Day, <5h Absent)
//         let status = 'present';
//         if (totalHours < 5) {
//             status = 'absent';
//         } else if (totalHours < 9) {
//             status = 'half_day';
//         }

//         const clockInDate = clockIn.toISOString().split('T')[0];
//         const isNextDay = clockInDate !== today;

//         // Update attendance
//         await db.query(
//             `UPDATE attendance 
//              SET clock_out = ?, total_hours = ?, status = ?, latitude = ?, longitude = ?
//              WHERE id = ?`,
//             [now, totalHours.toFixed(2), status, latitude, longitude, attendanceRecord.id]
//         );

//         // Deactivate session if exists
//         if (activeSession) {
//             await db.query(
//                 `UPDATE attendance_sessions 
//                  SET is_active = false, clock_out_time = ?
//                  WHERE id = ?`,
//                 [now, activeSession.id]
//             );
//         }

//         const dateMessage = isNextDay ? ` for ${clockInDate}` : '';

//         res.json({
//             success: true,
//             message: `Clocked out successfully${dateMessage}.`,
//             clock_out: now,
//             attendance_date: clockInDate,
//             total_hours: totalHours.toFixed(2),
//             status,
//             is_next_day: isNextDay
//         });

//     } catch (error) {
//         console.error('❌ Error clocking out:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Failed to clock out',
//             error: error.message
//         });
//     }
// });

const attendanceRoutes = require('./routes/attendanceRoutes');
app.use('/api/attendance', attendanceRoutes);

// ============== NOTIFICATION ROUTES ==============

// Get notifications for employee
app.get('/api/notifications', async (req, res) => {
    try {
        const { employee_id } = req.query;

        const [rows] = await db.query(
            `SELECT * FROM notifications 
             WHERE employee_id = ? 
             ORDER BY created_at DESC 
             LIMIT 50`,
            [employee_id]
        );

        res.json(rows);

    } catch (error) {
        console.error('❌ Error fetching notifications:', error);
        res.status(500).json({ error: error.message });
    }
});

// DELETE notification
app.delete('/api/notifications/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    await db.query('DELETE FROM notifications WHERE id = ?', [id]);
    
    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', async (req, res) => {
    try {
        const { id } = req.params;

        await db.query(
            'UPDATE notifications SET is_read = true WHERE id = ?',
            [id]
        );

        res.json({ success: true });

    } catch (error) {
        console.error('❌ Error marking notification as read:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============== SHIFTS ROUTES ==============
app.get('/api/shifts', async (req, res) => {
    try {
        const [rows] = await db.query('SELECT * FROM shifts ORDER BY id');
        res.json(rows);
    } catch (error) {
        console.error('❌ Error fetching shifts:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============== SALARY ROUTES ==============
const salaryRoutes = require('./routes/salaryRoutes');
app.use('/api/salary', salaryRoutes);

// ============== ADMIN UPDATE ROUTES ==============
const adminUpdateRoutes = require('./routes/adminUpdateRoutes');
app.use('/api/admin-updates', adminUpdateRoutes);

// ============== EMPLOYEE UPDATE ROUTES ==============
const employeeUpdateRoutes = require('./routes/employeeUpdateRoutes');
app.use('/api/employee-updates', employeeUpdateRoutes);

// ============== UPDATE RESPONSE ROUTES ==============
const updateResponseRoutes = require('./routes/updateResponseRoutes');
app.use('/api/update-responses', updateResponseRoutes);

// ============== ERROR HANDLING ==============
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err.stack);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.method} ${req.url} not found`
    });
});



// ============== START SERVER ==============
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log('\n' + '='.repeat(70));
    console.log(`🚀 SERVER STARTED SUCCESSFULLY`);
    console.log('='.repeat(70));
    console.log(`📡 Server running on: http://localhost:${PORT}`);
    console.log('='.repeat(70));
    console.log(`📝 TEST ROUTES:`);
    console.log(`   - GET  /api/test`);
    console.log(`   - GET  /api/test-db`);
    console.log('='.repeat(70));
    console.log(`🔐 AUTH ROUTES:`);
    console.log(`   - POST /api/auth/login`);
    console.log('='.repeat(70));
    console.log(`👥 EMPLOYEE ROUTES:`);
    console.log(`   - GET    /api/employees`);
    console.log(`   - GET    /api/employees/:id`);
    console.log(`   - GET    /api/employees/profile/:employeeId`);
    console.log(`   - POST   /api/employees`);
    console.log(`   - PUT    /api/employees/:id`);
    console.log(`   - DELETE /api/employees/:id`);
    console.log(`   - GET    /api/employees/today-events`);
    console.log(`   - GET    /api/employees/:employeeId/documents`);
    console.log(`   - GET    /api/employees/:employeeId/documents/:documentType`);
    console.log('='.repeat(70));
    console.log(`📅 LEAVE ROUTES:`);
    console.log(`   - GET    /api/leaves`);
    console.log(`   - GET    /api/leaves/balance/:employeeId`);
    console.log(`   - GET    /api/leaves/balance/:employeeId/:year`);
    console.log(`   - POST   /api/leaves`);
    console.log(`   - PUT    /api/leaves/:id/status`);
    console.log('='.repeat(70));
    console.log(`⏰ ATTENDANCE ROUTES:`);
    console.log(`   - GET    /api/attendance/report`);
    console.log(`   - GET    /api/attendance/today/:employee_id`);
    console.log(`   - POST   /api/attendance/clock-in`);
    console.log(`   - POST   /api/attendance/clock-out`);
    console.log('='.repeat(70));
    console.log(`🔔 NOTIFICATION ROUTES:`);
    console.log(`   - GET    /api/notifications`);
    console.log(`   - PUT    /api/notifications/:id/read`);
    console.log('='.repeat(70));
    console.log(`💰 SALARY ROUTES:`);
    console.log(`   - GET    /api/salary/employee/:employeeId`);
    console.log(`   - POST   /api/salary/generate`);
    console.log('='.repeat(70));
    console.log(`🔄 ADMIN UPDATE ROUTES:`);
    console.log(`   - GET    /api/admin-updates/employees`);
    console.log(`   - GET    /api/admin-updates/employee/:employeeId`);
    console.log(`   - POST   /api/admin-updates/send-request`);
    console.log(`   - GET    /api/admin-updates/pending-requests`);
    console.log(`   - GET    /api/admin-updates/notifications`);
    console.log(`   - PUT    /api/admin-updates/notification/:id/read`);
    console.log('='.repeat(70));
    console.log(`🔄 EMPLOYEE UPDATE ROUTES:`);
    console.log(`   - GET    /api/employee-updates/my-profile/:employeeId`);
    console.log(`   - POST   /api/employee-updates/request-update`);
    console.log(`   - GET    /api/employee-updates/my-requests/:employeeId`);
    console.log(`   - GET    /api/employee-updates/pending-requests`);
    console.log(`   - POST   /api/employee-updates/review-request`);
    console.log('='.repeat(70));
    console.log(`🔄 UPDATE RESPONSE ROUTES:`);
    console.log(`   - GET    /api/update-responses/my-pending/:employeeId`);
    console.log(`   - POST   /api/update-responses/respond`);
    console.log('='.repeat(70));
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log('='.repeat(70));
    console.log(`✅ Database: ${process.env.DB_NAME || 'ems_db'}`);
    console.log('='.repeat(70));
});