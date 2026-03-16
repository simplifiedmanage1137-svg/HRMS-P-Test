// middleware/auth.js
const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Verifies JWT token and attaches user info to request object
 */
const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
        return res.status(403).json({ 
            success: false,
            message: 'No token provided. Access denied.' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Token expired. Please login again.' 
                });
            }
            if (err.name === 'JsonWebTokenError') {
                return res.status(401).json({ 
                    success: false,
                    message: 'Invalid token. Please login again.' 
                });
            }
            return res.status(401).json({ 
                success: false,
                message: 'Unauthorized access.' 
            });
        }

        // Attach user info to request
        req.userId = decoded.id;
        req.userRole = decoded.role;
        req.employeeId = decoded.employeeId;
        req.userEmail = decoded.email;
        
        console.log('✅ Token verified:', {
            userId: req.userId,
            role: req.userRole,
            employeeId: req.employeeId
        });
        
        next();
    });
};

/**
 * Admin Authorization Middleware
 */
const isAdmin = (req, res, next) => {
    if (!req.userRole) {
        return res.status(403).json({ 
            success: false,
            message: 'Access denied. User role not found.' 
        });
    }
    
    if (req.userRole !== 'admin') {
        return res.status(403).json({ 
            success: false,
            message: 'Admin access required. You do not have permission.' 
        });
    }
    
    next();
};

/**
 * Employee Authorization Middleware
 * Checks if authenticated user is accessing their own data or is admin
 */
const isOwnDataOrAdmin = (req, res, next) => {
    console.log('🔍 isOwnDataOrAdmin middleware called');
    console.log('User role:', req.userRole);
    console.log('User employeeId:', req.employeeId);
    
    // Get target employee ID from various possible locations
    const targetEmployeeId = req.params.employee_id || 
                            req.body.employee_id || 
                            req.params.id;
    
    console.log('Target employeeId:', targetEmployeeId);
    
    // Admin can access any data
    if (req.userRole === 'admin') {
        console.log('✅ Admin access granted');
        return next();
    }
    
    // Employees can only access their own data
    if (req.userRole === 'employee' && req.employeeId === targetEmployeeId) {
        console.log('✅ Employee accessing own data - granted');
        return next();
    }
    
    console.log('❌ Access denied - not authorized');
    return res.status(403).json({ 
        success: false,
        message: 'Access denied. You can only access your own data.' 
    });
};

module.exports = {
    verifyToken,
    isAdmin,
    isOwnDataOrAdmin
};