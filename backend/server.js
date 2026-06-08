const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const cron = require('node-cron');

dotenv.config();

const supabase = require('./config/supabase');

// ─── Routes ──────────────────────────────────────────────────────────────────
const authRoutes          = require('./routes/authRoutes');
const employeeRoutes      = require('./routes/employeeRoutes');
const leaveRoutes         = require('./routes/leaveRoutes');
const attendanceRoutes    = require('./routes/attendanceRoutes');
const salaryRoutes        = require('./routes/salaryRoutes');
const notificationRoutes  = require('./routes/notificationRoutes');
const adminUpdateRoutes   = require('./routes/adminUpdateRoutes');
const employeeUpdateRoutes = require('./routes/employeeUpdateRoutes');
const updateResponseRoutes = require('./routes/updateResponseRoutes');
const noticeRoutes        = require('./routes/noticeRoutes');
const announcementRoutes  = require('./routes/announcementRoutes');
const ratingRoutes        = require('./routes/ratingRoutes');
const loginFeedRoutes     = require('./routes/loginFeedRoutes');
const noticeBoardRoutes   = require('./routes/noticeBoardRoutes');

const attendanceController = require('./controllers/attendanceController');
const { scheduleAbsentCheck } = require('./cron/absentEmployeeCheck');

const app = express();

// ─── Environment ─────────────────────────────────────────────────────────────
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.RENDER_EXTERNAL_URL;
const PORT = process.env.PORT || 5000;

console.log('='.repeat(70));
console.log('🚀 SERVER INITIALIZING');
console.log(`   Environment : ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
console.log(`   Port        : ${PORT}`);
console.log('='.repeat(70));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Hard-coded allowed origins (covers all known deployments)
const ALLOWED_ORIGINS = new Set([
    // Local development
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://localhost:3001',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    // Production Vercel frontends
    'https://hrms-p-test.vercel.app',
    'https://hrms-b2-bindemand-a31u.vercel.app',
    // Render backend (for internal calls / health checks)
    'https://hrms-p-test-1.onrender.com',
]);

// Also pull any extra origins from the env var (comma-separated)
if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(',').forEach(o => {
        const trimmed = o.trim();
        if (trimmed) ALLOWED_ORIGINS.add(trimmed);
    });
}

console.log('🔧 CORS allowed origins:');
ALLOWED_ORIGINS.forEach(o => console.log(`   - ${o}`));

const corsOptions = {
    origin(origin, callback) {
        // Allow requests with no origin (curl, Postman, server-to-server)
        if (!origin) return callback(null, true);

        // Allow all localhost / 127.0.0.1 regardless of port (dev convenience)
        if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
            return callback(null, true);
        }

        // Allow private LAN origins (192.168.x, 10.x, 172.16-31.x)
        if (/^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(origin)) {
            return callback(null, true);
        }

        // Allow any *.vercel.app preview deployment
        if (/^https:\/\/[a-zA-Z0-9-]+-[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }

        if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);

        // Blocked — return null (no error object) so Express does NOT throw;
        // instead we return false which tells the cors middleware to omit the
        // Access-Control-Allow-Origin header, producing a clean CORS rejection.
        console.warn(`⛔ CORS blocked: ${origin}`);
        return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'employee-id',
        'X-Employee-Id',
    ],
    // Cache preflight for 24 h
    maxAge: 86400,
    // Make cors() send the actual allowed origin back (not '*') so
    // credentials work correctly
    optionsSuccessStatus: 204,
};

// Apply CORS before EVERYTHING else so preflight OPTIONS responses are
// handled immediately and always carry the correct headers.
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Explicitly handle OPTIONS preflight for every route so nothing slips
// through if a route handler accidentally swallows the request.

// ─── Body parsers ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ─── Request logger ───────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    console.log(`📍 ${req.method} ${req.path} — origin: ${req.headers.origin || 'none'}`);
    next();
});

// ─── Upload directories ───────────────────────────────────────────────────────
const createUploadDirectories = () => {
    const dirs = [
        path.join(__dirname, 'uploads'),
        path.join(__dirname, 'uploads', 'profiles'),
        path.join(__dirname, 'uploads', 'documents'),
        path.join(__dirname, 'uploads', 'announcements'),
        path.join(__dirname, 'uploads', 'office-events'),
        path.join(__dirname, 'logs'),
    ];
    dirs.forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created: ${dir}`);
        }
    });
    return dirs[0]; // uploadsDir
};

const uploadsDir = createUploadDirectories();

app.use('/uploads', express.static(uploadsDir));

// ─── Multer ───────────────────────────────────────────────────────────────────
const uploadDocuments = multer({
    storage: multer.diskStorage({
        destination(_req, _file, cb) {
            cb(null, path.join(__dirname, 'uploads', 'documents'));
        },
        filename(_req, file, cb) {
            const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            const ext = path.extname(file.originalname);
            cb(null, `${file.fieldname.replace(/[^a-zA-Z0-9]/g, '_')}-${suffix}${ext}`);
        },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter(_req, file, cb) {
        const ok = /jpeg|jpg|png|pdf|doc|docx/.test(
            path.extname(file.originalname).toLowerCase()
        );
        cb(ok ? null : new Error('Only images and documents are allowed'), ok);
    },
});

app.locals.uploadDocuments = uploadDocuments;

// ─── Auth middleware ──────────────────────────────────────────────────────────
const authenticateToken = (req, res, next) => {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access token required', code: 'NO_TOKEN' });
    }
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
            }
            return res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
        }
        req.user       = user;
        req.userId     = user.id;
        req.userRole   = user.role;
        req.employeeId = user.employeeId;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: 'Admin access required' });
    }
    next();
};

// ─── Public routes ────────────────────────────────────────────────────────────
app.use('/api/auth',   authRoutes);
app.use('/api/public', loginFeedRoutes);

// ─── Protected routes ─────────────────────────────────────────────────────────
app.use('/api/employees',       authenticateToken, employeeRoutes);
app.use('/api/leaves',          authenticateToken, leaveRoutes);
app.use('/api/attendance',      authenticateToken, attendanceRoutes(supabase, authenticateToken, requireAdmin));
app.use('/api/salary',          authenticateToken, salaryRoutes);
app.use('/api/notifications',   authenticateToken, notificationRoutes);
app.use('/api/admin-updates',   authenticateToken, adminUpdateRoutes);
app.use('/api/employee-updates', authenticateToken, employeeUpdateRoutes);
app.use('/api/update-responses', authenticateToken, updateResponseRoutes);
app.use('/api/notices',         authenticateToken, noticeRoutes);
app.use('/api/notice-board',    authenticateToken, noticeBoardRoutes);
app.use('/api/announcements',   authenticateToken, announcementRoutes);
app.use('/api/ratings',         ratingRoutes(authenticateToken, requireAdmin));

// ─── Utility endpoints ────────────────────────────────────────────────────────
app.get('/', (_req, res) => res.json({
    name: 'HRMS API',
    version: '2.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
}));

app.get('/api/health', (_req, res) => res.json({
    success: true,
    message: 'Server is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
}));

app.get('/api/test', (req, res) => res.json({
    success: true,
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    requestOrigin: req.headers.origin || 'none',
}));

app.get('/api/test-db', async (_req, res) => {
    try {
        const { error } = await supabase
            .from('employees')
            .select('count', { count: 'exact', head: true });
        if (error) throw error;
        res.json({ success: true, message: 'Supabase connected' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Supabase connection failed', error: err.message });
    }
});

app.get('/api/cors-debug', (req, res) => res.json({
    success: true,
    origin: req.headers.origin || 'none',
    corsHeaders: {
        'Access-Control-Allow-Origin':  res.getHeader('Access-Control-Allow-Origin'),
        'Access-Control-Allow-Methods': res.getHeader('Access-Control-Allow-Methods'),
        'Access-Control-Allow-Headers': res.getHeader('Access-Control-Allow-Headers'),
    },
    allowedOrigins: [...ALLOWED_ORIGINS],
}));

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ success: false, message: `${req.method} ${req.path} not found` });
});

// ─── Global error handler ─────────────────────────────────────────────────────
// Must have 4 parameters for Express to treat it as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err.message);

    if (isProduction) {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(
            path.join(logDir, 'errors.log'),
            `${new Date().toISOString()} — ${err.stack}\n`
        );
    }

    if (err instanceof multer.MulterError) {
        return res.status(400).json({ success: false, message: 'File upload error', error: err.message });
    }
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
    }
    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: isProduction ? undefined : err.message,
    });
});

// ─── Cron jobs ────────────────────────────────────────────────────────────────
const logCronActivity = (type, message, duration = null) => {
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(
        path.join(logDir, 'cron-jobs.log'),
        JSON.stringify({ timestamp: new Date().toISOString(), type, message, duration }) + '\n'
    );
};

// Hourly: auto-close stale sessions
cron.schedule('0 * * * *', async () => {
    const t = Date.now();
    try {
        const result = await attendanceController.autoCloseStaleSessions();
        const ms = Date.now() - t;
        console.log(`✅ Auto-close: ${result.closedCount} sessions closed in ${ms}ms`);
        logCronActivity('AUTO_CLOSE', `${result.closedCount} sessions closed`, ms);
    } catch (err) {
        console.error('❌ Auto-close cron error:', err);
        logCronActivity('AUTO_CLOSE_ERROR', err.message);
    }
});

// Daily 23:59: mark absent
cron.schedule('59 23 * * *', async () => {
    const t = Date.now();
    try {
        const result = await attendanceController.markAbsentAtDayEnd();
        const ms = Date.now() - t;
        console.log(`✅ Absent marking done in ${ms}ms: ${result.message}`);
        logCronActivity('END_OF_DAY', result.message, ms);
    } catch (err) {
        console.error('❌ End-of-day cron error:', err);
        logCronActivity('END_OF_DAY_ERROR', err.message);
    }
});

scheduleAbsentCheck();

// Weekly Sunday 02:00: DB cleanup
cron.schedule('0 2 * * 0', async () => {
    const t = Date.now();
    try {
        const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const ninetyAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from('attendance_sessions')
            .delete().eq('is_active', false).lt('clock_out_time', thirtyAgo);

        await supabase.from('regularization_requests')
            .delete().in('status', ['approved', 'rejected']).lt('created_at', ninetyAgo);

        const ms = Date.now() - t;
        console.log(`✅ Weekly cleanup done in ${ms}ms`);
        logCronActivity('WEEKLY_CLEANUP', 'done', ms);
    } catch (err) {
        console.error('❌ Weekly cleanup error:', err);
        logCronActivity('WEEKLY_CLEANUP_ERROR', err.message);
    }
});

console.log('⏰ Cron jobs scheduled');

// ─── Start server ─────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(70));
    console.log('🚀 SERVER STARTED');
    console.log(`   http://localhost:${PORT}`);
    console.log(`   ${isProduction ? 'PRODUCTION' : 'DEVELOPMENT'}`);
    console.log(`   Public URL: ${process.env.RENDER_EXTERNAL_URL || 'not set'}`);
    console.log('='.repeat(70));

    // Startup fix: repair orphaned attendance records and stale sessions
    setTimeout(async () => {
        try {
            console.log('🔧 Running startup attendance fixes...');
            const fix = await attendanceController.fixOrphanedAttendance(null, null);
            console.log(`✅ Orphan fix: ${fix.fixed} fixed, ${fix.skipped} skipped`);

            const { data: staleSessions } = await supabase
                .from('attendance_sessions')
                .select('session_id, employee_id')
                .eq('is_active', true);

            let staleFixed = 0;
            for (const s of (staleSessions || [])) {
                const { data: clocked } = await supabase
                    .from('attendance')
                    .select('id, clock_out')
                    .eq('employee_id', s.employee_id)
                    .eq('session_id', s.session_id)
                    .not('clock_out', 'is', null)
                    .maybeSingle();

                if (clocked) {
                    await supabase.from('attendance_sessions')
                        .update({ is_active: false, clock_out_time: clocked.clock_out })
                        .eq('session_id', s.session_id)
                        .eq('employee_id', s.employee_id);
                    staleFixed++;
                    continue;
                }

                const { data: any } = await supabase
                    .from('attendance')
                    .select('id')
                    .eq('employee_id', s.employee_id)
                    .eq('session_id', s.session_id)
                    .maybeSingle();

                if (!any) {
                    await supabase.from('attendance_sessions')
                        .update({ is_active: false, clock_out_time: new Date().toISOString() })
                        .eq('session_id', s.session_id)
                        .eq('employee_id', s.employee_id);
                    staleFixed++;
                }
            }
            console.log(`✅ Stale session fix: ${staleFixed} fixed`);
        } catch (err) {
            console.error('❌ Startup fix error:', err.message);
        }
    }, 3000);
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = () => {
    console.log('\n🛑 Shutting down gracefully...');
    const logDir = path.join(__dirname, 'logs');
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.appendFileSync(path.join(logDir, 'server.log'), `${new Date().toISOString()} - shutdown\n`);
    process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught exception:', err.stack);
    if (isProduction) {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(path.join(logDir, 'errors.log'), `${new Date().toISOString()} - ${err.stack}\n`);
        process.exit(1);
    }
});

process.on('unhandledRejection', (reason) => {
    console.error('❌ Unhandled rejection:', reason);
    if (isProduction) {
        const logDir = path.join(__dirname, 'logs');
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(path.join(logDir, 'errors.log'), `${new Date().toISOString()} - Rejection: ${reason}\n`);
        process.exit(1);
    }
});

module.exports = app;
