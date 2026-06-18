const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET ? JWT_SECRET + '_refresh' : undefined);

if (!JWT_SECRET) {
    console.error('🚨 FATAL: JWT_SECRET environment variable is not set. Auth routes will not work.');
}
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateTokens(payload) {
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
    const refreshToken = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
    return { accessToken, refreshToken };
}

// Login
router.post('/login', async (req, res) => {
    const startTime = Date.now();
    try {
        const { email, identifier, password } = req.body;
        const loginId = (identifier || email || '').trim();

        console.log(`🔐 [LOGIN] attempt — id="${loginId}" origin="${req.headers.origin || 'none'}" ip="${req.ip}"`);

        if (!loginId || !password) {
            console.log('❌ [LOGIN] rejected — missing credentials');
            return res.status(400).json({ success: false, message: 'Employee ID / Email and password are required' });
        }

        // Admin hardcoded login
        if (loginId === 'hr@b2bindemand.com' && password === 'Hr3007') {
            const payload = { id: 1, email: loginId, role: 'admin', employeeId: 'HR001' };
            const { accessToken, refreshToken } = generateTokens(payload);
            console.log(`✅ [LOGIN] hardcoded admin — ${Date.now() - startTime}ms`);
            return res.json({
                success: true,
                token: accessToken,
                refreshToken,
                user: { id: 1, email: loginId, role: 'admin', employeeId: 'HR001', firstName: 'HR', lastName: 'Admin', department: 'Human Resources', designation: 'HR Manager' }
            });
        }

        // Detect whether the input is an email address or an employee ID
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginId);
        console.log(`🔍 [LOGIN] lookup by ${isEmail ? 'email' : 'employee_id'}`);

        // Find employee by email or employee_id
        let user = null;

        if (isEmail) {
            const { data, error } = await supabase.from('employees').select('*').eq('email', loginId.toLowerCase()).maybeSingle();
            if (error) {
                console.error('❌ [LOGIN] Supabase error (email lookup):', error.message);
                throw error;
            }
            user = data;
        } else {
            const { data, error } = await supabase.from('employees').select('*').eq('employee_id', loginId).maybeSingle();
            if (error) {
                console.error('❌ [LOGIN] Supabase error (employee_id lookup):', error.message);
                throw error;
            }
            user = data;
        }

        // Legacy emp_XXX@ems.com format fallback
        if (!user && loginId.startsWith('emp_') && loginId.endsWith('@ems.com')) {
            const employeeId = loginId.replace('emp_', '').replace('@ems.com', '');
            const { data } = await supabase.from('employees').select('*').eq('employee_id', employeeId).maybeSingle();
            user = data;
        }

        if (!user) {
            console.log(`❌ [LOGIN] user not found — "${loginId}"`);
            return res.status(401).json({ success: false, message: 'Invalid email or password' });
        }

        console.log(`✅ [LOGIN] user found — id=${user.id} employeeId=${user.employee_id} role=${user.role} active=${user.is_active} hasPassword=${!!user.password}`);

        // Verify password
        let isValidPassword = false;

        if (!user.password) {
            // No password in DB — allow Welcome@123 as default
            isValidPassword = (password === 'Welcome@123');
            console.log(`🔑 [LOGIN] password check (no hash in DB, default fallback): ${isValidPassword ? 'pass' : 'fail'}`);
        } else {
            isValidPassword = await bcrypt.compare(password, user.password);
            console.log(`🔑 [LOGIN] bcrypt compare: ${isValidPassword ? 'pass' : 'fail'}`);
        }

        if (!isValidPassword) {
            console.log(`❌ [LOGIN] wrong password — employeeId=${user.employee_id}`);
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Check if employee is active
        if (user.is_active === false) {
            console.log(`❌ [LOGIN] account deactivated — employeeId=${user.employee_id}`);
            return res.status(403).json({ success: false, message: 'Your account is deactivated. Please contact admin.' });
        }

        const payload = { id: user.id, email: user.email, role: user.role || 'employee', employeeId: user.employee_id };
        const { accessToken, refreshToken } = generateTokens(payload);

        console.log(`✅ [LOGIN] success — employeeId=${user.employee_id} role=${user.role} ${Date.now() - startTime}ms`);

        return res.json({
            success: true,
            token: accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role || 'employee',
                employeeId: user.employee_id,
                firstName: user.first_name,
                lastName: user.last_name,
                department: user.department,
                designation: user.designation,
                profile_image: user.profile_image
            }
        });

    } catch (error) {
        console.error(`❌ [LOGIN] unhandled error after ${Date.now() - startTime}ms:`, error.message);
        res.status(500).json({ success: false, message: 'Server error during login', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
});

// Refresh token
router.post('/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(401).json({ success: false, message: 'Refresh token required' });
        }

        let decoded;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch {
            return res.status(401).json({ success: false, message: 'Invalid or expired refresh token' });
        }

        // Get fresh user data
        let user = null;
        if (decoded.employeeId === 'HR001') {
            const { accessToken: newAccess, refreshToken: newRefresh } = generateTokens({ id: decoded.id, email: decoded.email, role: decoded.role, employeeId: decoded.employeeId });
            return res.json({ success: true, token: newAccess, refreshToken: newRefresh });
        }

        let data, error;
        try {
            const result = await supabase
                .from('employees')
                .select('id, email, role, employee_id, first_name, last_name, department, designation, profile_image, is_active')
                .eq('id', decoded.id)
                .maybeSingle();
            data = result.data;
            error = result.error;
        } catch (supabaseThrow) {
            console.error('❌ [REFRESH] Supabase threw unexpectedly:', supabaseThrow.message);
            return res.status(503).json({ success: false, message: 'Database unavailable' });
        }
        if (error || !data) return res.status(401).json({ success: false, message: 'User not found' });
        if (data.is_active === false) return res.status(403).json({ success: false, message: 'Account deactivated' });

        user = data;
        const payload = { id: user.id, email: user.email, role: user.role || 'employee', employeeId: user.employee_id };
        const { accessToken, refreshToken: newRefreshToken } = generateTokens(payload);

        return res.json({
            success: true,
            token: accessToken,
            refreshToken: newRefreshToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role || 'employee',
                employeeId: user.employee_id,
                firstName: user.first_name,
                lastName: user.last_name,
                department: user.department,
                designation: user.designation,
                profile_image: user.profile_image
            }
        });

    } catch (error) {
        console.error('❌ [REFRESH] Unhandled error — name:', error.name, '| message:', error.message);
        console.error('❌ [REFRESH] Stack:', error.stack);
        if (res.headersSent) return;
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify token & return fresh user data
router.post('/verify', async (req, res) => {
    try {
        if (!JWT_SECRET) {
            console.error('❌ [VERIFY] JWT_SECRET is not set — cannot verify token');
            return res.status(500).json({ success: false, message: 'Server configuration error', code: 'MISSING_SECRET' });
        }

        const token = req.headers['authorization']?.split(' ')[1];
        if (!token) return res.status(401).json({ success: false, message: 'No token provided', code: 'NO_TOKEN' });

        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (err) {
            if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired', code: 'TOKEN_EXPIRED' });
            return res.status(401).json({ success: false, message: 'Invalid token', code: 'INVALID_TOKEN' });
        }

        if (decoded.employeeId === 'HR001') {
            return res.json({ success: true, user: { id: decoded.id, email: decoded.email, role: 'admin', employeeId: 'HR001', firstName: 'HR', lastName: 'Admin' } });
        }

        if (!decoded.id) {
            console.error('❌ [VERIFY] Token payload missing id field:', JSON.stringify(decoded));
            return res.status(401).json({ success: false, message: 'Invalid token payload', code: 'INVALID_TOKEN' });
        }

        let user, dbError;
        try {
            const result = await supabase
                .from('employees')
                .select('id, email, role, employee_id, first_name, last_name, department, designation, profile_image, is_active')
                .eq('id', decoded.id)
                .maybeSingle();
            user = result.data;
            dbError = result.error;
        } catch (supabaseThrow) {
            console.error('❌ [VERIFY] Supabase threw unexpectedly:', supabaseThrow.message, supabaseThrow.stack);
            return res.status(503).json({ success: false, message: 'Database unavailable', code: 'DB_ERROR' });
        }

        if (dbError) {
            console.error('❌ [VERIFY] Supabase query error:', dbError.message, 'code:', dbError.code);
            return res.status(401).json({ success: false, message: 'User not found', code: 'USER_NOT_FOUND' });
        }
        if (!user) return res.status(401).json({ success: false, message: 'User not found', code: 'USER_NOT_FOUND' });
        if (user.is_active === false) return res.status(403).json({ success: false, message: 'Account deactivated' });

        return res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role || decoded.role || 'employee',
                employeeId: user.employee_id,
                firstName: user.first_name,
                lastName: user.last_name,
                department: user.department,
                designation: user.designation,
                profile_image: user.profile_image
            }
        });

    } catch (error) {
        console.error('❌ [VERIFY] Unhandled error — name:', error.name, '| message:', error.message);
        console.error('❌ [VERIFY] Stack:', error.stack);
        if (res.headersSent) {
            console.error('❌ [VERIFY] Headers already sent — cannot send 500 response');
            return;
        }
        return res.status(500).json({ success: false, message: 'Server error', code: 'INTERNAL_ERROR' });
    }
});

// Register
router.post('/register', async (req, res) => {
    try {
        const { employee_id, email, password, first_name, last_name, department, designation } = req.body;

        if (!employee_id || !email || !first_name || !last_name) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const { data: existing } = await supabase.from('employees').select('id').or(`email.eq.${email},employee_id.eq.${employee_id}`);
        if (existing && existing.length > 0) {
            return res.status(400).json({ success: false, message: 'User with this email or employee ID already exists' });
        }

        const hashedPassword = await bcrypt.hash(password || 'Welcome@123', 10);

        const { data: newUser, error } = await supabase.from('employees').insert([{
            employee_id, email, first_name, last_name,
            department: department || null,
            designation: designation || null,
            password: hashedPassword,
            role: 'employee',
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }]).select();

        if (error) throw error;

        res.status(201).json({ success: true, message: 'Employee registered successfully', user: { id: newUser[0].id, employeeId: newUser[0].employee_id, email: newUser[0].email } });

    } catch (error) {
        console.error('❌ Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error during registration', error: error.message });
    }
});

// Logout
router.post('/logout', (req, res) => {
    res.json({ success: true, message: 'Logged out successfully' });
});

// Change password
router.post('/change-password', async (req, res) => {
    try {
        const token = req.headers['authorization']?.split(' ')[1];
        const { currentPassword, newPassword } = req.body;

        if (!token) return res.status(401).json({ success: false, message: 'No token provided' });
        if (!currentPassword || !newPassword) return res.status(400).json({ success: false, message: 'Both passwords are required' });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const { data: user, error } = await supabase.from('employees').select('*').eq('id', decoded.id).maybeSingle();
        if (error || !user) return res.status(404).json({ success: false, message: 'User not found' });

        let isValid = false;
        if (user.password) {
            try { isValid = await bcrypt.compare(currentPassword, user.password); } catch { isValid = currentPassword === user.password; }
        }
        if (!isValid) isValid = currentPassword === 'Welcome@123' || currentPassword === user.employee_id?.toLowerCase();

        if (!isValid) return res.status(401).json({ success: false, message: 'Current password is incorrect' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error: updateError } = await supabase.from('employees').update({ password: hashedPassword, updated_at: new Date().toISOString() }).eq('id', decoded.id);
        if (updateError) throw updateError;

        res.json({ success: true, message: 'Password changed successfully' });

    } catch (error) {
        if (error.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired' });
        if (error.name === 'JsonWebTokenError') return res.status(401).json({ success: false, message: 'Invalid token' });
        console.error('❌ Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Forgot password
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

        const { data: user } = await supabase.from('employees').select('id, email, first_name').eq('email', email).maybeSingle();

        // Always return same message for security
        if (!user) return res.json({ success: true, message: 'If your email exists, you will receive a reset link' });

        const resetToken = jwt.sign({ id: user.id, email: user.email, purpose: 'password_reset' }, JWT_SECRET, { expiresIn: '36h' });
        console.log('📧 Password reset token for', email, ':', resetToken);

        res.json({
            success: true,
            message: 'If your email exists, you will receive a reset link',
            ...(process.env.NODE_ENV === 'development' && { resetToken })
        });

    } catch (error) {
        console.error('❌ Forgot password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Reset password
router.post('/reset-password', async (req, res) => {
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) return res.status(400).json({ success: false, message: 'Token and new password are required' });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });

        let decoded;
        try { decoded = jwt.verify(token, JWT_SECRET); } catch {
            return res.status(401).json({ success: false, message: 'Invalid or expired token' });
        }

        if (decoded.purpose !== 'password_reset') return res.status(401).json({ success: false, message: 'Invalid token purpose' });

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const { error } = await supabase.from('employees').update({ password: hashedPassword, updated_at: new Date().toISOString() }).eq('id', decoded.id);
        if (error) throw error;

        res.json({ success: true, message: 'Password reset successfully' });

    } catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Direct password reset by email (no token — employee sets new password from login page)
router.post('/reset-password-direct', async (req, res) => {
    try {
        const { email, newPassword } = req.body;

        if (!email || !newPassword) {
            return res.status(400).json({ success: false, message: 'Email and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
        }

        const { data: employee, error } = await supabase
            .from('employees')
            .select('employee_id, email')
            .eq('email', email.toLowerCase().trim())
            .maybeSingle();

        if (error) throw error;
        if (!employee) {
            return res.status(404).json({ success: false, message: 'No account found with this email address' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const { error: updateError } = await supabase
            .from('employees')
            .update({ password: hashedPassword })
            .eq('email', email.toLowerCase().trim());

        if (updateError) throw updateError;

        console.log('✅ Password reset for:', employee.employee_id);
        res.json({ success: true, message: 'Password updated successfully. You can now login with your new password.' });

    } catch (error) {
        console.error('❌ Reset password error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

module.exports = router;
