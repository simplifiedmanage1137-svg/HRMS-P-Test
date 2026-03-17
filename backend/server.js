const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const supabase = require('./config/supabase');

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

// ============== MULTER CONFIGURATION FOR DOCUMENT UPLOADS ==============
const documentStorage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, documentsDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const fieldname = file.fieldname.replace(/[^a-zA-Z0-9]/g, '_');
        cb(null, fieldname + '-' + uniqueSuffix + ext);
    }
});

const uploadDocuments = multer({ 
    storage: documentStorage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images and documents are allowed'));
        }
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
        return res.status(401).json({ 
            success: false,
            message: 'Access token required' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your_jwt_secret_key_here', (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Token expired' 
                });
            }
            return res.status(403).json({ 
                success: false,
                message: 'Invalid or expired token' 
            });
        }
        req.user = user;
        req.userId = user.id;
        req.userRole = user.role;
        req.employeeId = user.employeeId;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
            success: false,
            message: 'Admin access required' 
        });
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
        const { data, error } = await supabase
            .from('employees')
            .select('count', { count: 'exact', head: true });
        
        if (error) throw error;
        
        res.json({
            success: true,
            message: 'Supabase connected successfully!',
            database: 'Supabase'
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Supabase connection failed',
            error: error.message
        });
    }
});

// ============== AUTH ROUTES ==============
const authRoutes = require('./routes/authRoutes');
app.use('/api/auth', authRoutes);

// ============== TODAY'S EVENTS ROUTE ==============
app.get('/api/employees/today-events', async (req, res) => {
    try {
        console.log('📅 Fetching today events...');

        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay = today.getDate();

        // Get all employees
        const { data: employees, error } = await supabase
            .from('employees')
            .select('*');

        if (error) throw error;

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
                    if (years > 0) {
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
const employeeRoutes = require('./routes/employeeRoutes');
app.use('/api/employees', authenticateToken, employeeRoutes);

// ============== LEAVE ROUTES ==============
const leaveRoutes = require('./routes/leaveRoutes');
app.use('/api/leaves', authenticateToken, leaveRoutes);

// ============== ATTENDANCE ROUTES ==============
const attendanceRoutes = require('./routes/attendanceRoutes')(supabase);
app.use('/api/attendance', authenticateToken, attendanceRoutes);

// ============== NOTIFICATION ROUTES ==============
const notificationRoutes = require('./routes/notificationRoutes');
app.use('/api/notifications', authenticateToken, notificationRoutes);

// ============== SHIFTS ROUTES ==============
app.get('/api/shifts', authenticateToken, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('shifts')
            .select('*')
            .order('id');

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('❌ Error fetching shifts:', error);
        res.status(500).json({ 
            success: false,
            error: error.message 
        });
    }
});

// ============== SALARY ROUTES ==============
const salaryRoutes = require('./routes/salaryRoutes');
app.use('/api/salary', authenticateToken, salaryRoutes);

// ============== ADMIN UPDATE ROUTES ==============
const adminUpdateRoutes = require('./routes/adminUpdateRoutes');
app.use('/api/admin-updates', authenticateToken, adminUpdateRoutes);

// ============== EMPLOYEE UPDATE ROUTES ==============
const employeeUpdateRoutes = require('./routes/employeeUpdateRoutes');
app.use('/api/employee-updates', authenticateToken, employeeUpdateRoutes);

// ============== UPDATE RESPONSE ROUTES ==============
const updateResponseRoutes = require('./routes/updateResponseRoutes');
app.use('/api/update-responses', authenticateToken, updateResponseRoutes);

// ============== IP WHITELIST MIDDLEWARE ==============
const { checkAttendanceEligibility } = require('./middleware/ipWhitelist');

// Apply IP check to attendance routes
app.use('/api/attendance', checkAttendanceEligibility);

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
    console.log(`📦 Database: Supabase`);
    console.log('='.repeat(70));
    console.log(`📝 TEST ROUTES:`);
    console.log(`   - GET  /api/test`);
    console.log(`   - GET  /api/test-db`);
    console.log('='.repeat(70));
    console.log(`🔐 AUTH ROUTES:`);
    console.log(`   - POST /api/auth/login`);
    console.log(`   - POST /api/auth/register`);
    console.log(`   - POST /api/auth/verify`);
    console.log('='.repeat(70));
    console.log(`👥 EMPLOYEE ROUTES:`);
    console.log(`   - GET    /api/employees`);
    console.log(`   - GET    /api/employees/:id`);
    console.log(`   - GET    /api/employees/profile/:employeeId`);
    console.log(`   - POST   /api/employees`);
    console.log(`   - PUT    /api/employees/:id`);
    console.log(`   - DELETE /api/employees/:id`);
    console.log(`   - GET    /api/employees/today-events`);
    console.log(`   - POST   /api/employees/:employeeId/documents`);
    console.log('='.repeat(70));
    console.log(`📅 LEAVE ROUTES:`);
    console.log(`   - GET    /api/leaves/types`);
    console.log(`   - GET    /api/leaves/balance/:employee_id`);
    console.log(`   - GET    /api/leaves`);
    console.log(`   - POST   /api/leaves/apply`);
    console.log(`   - PUT    /api/leaves/:id/status`);
    console.log('='.repeat(70));
    console.log(`⏰ ATTENDANCE ROUTES:`);
    console.log(`   - GET    /api/attendance/report`);
    console.log(`   - GET    /api/attendance/today/:employee_id`);
    console.log(`   - POST   /api/attendance/clock-in`);
    console.log(`   - POST   /api/attendance/clock-out`);
    console.log(`   - POST   /api/attendance/heartbeat`);
    console.log('='.repeat(70));
    console.log(`💰 SALARY ROUTES:`);
    console.log(`   - GET    /api/salary/employee/:employee_id`);
    console.log(`   - GET    /api/salary/:id`);
    console.log(`   - POST   /api/salary/generate`);
    console.log('='.repeat(70));
    console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
    console.log('='.repeat(70));
});