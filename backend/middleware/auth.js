// middleware/auth.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ 
            success: false,
            message: 'Access token required' 
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ 
                success: false,
                message: 'Invalid or expired token' 
            });
        }
        
        // Set user info in request
        req.user = {
            id: decoded.id,
            employeeId: decoded.employeeId,
            role: decoded.role,
            email: decoded.email
        };
        
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ 
            success: false,
            message: 'Admin access required' 
        });
    }
    next();
};

const isOwnDataOrAdmin = (req, res, next) => {
    const userRole = req.user?.role;
    const userEmployeeId = req.user?.employeeId;
    const requestedEmployeeId = req.params.employee_id;

    if (userRole === 'admin') {
        // Admin can access any data
        return next();
    }

    if (userEmployeeId === requestedEmployeeId) {
        // User can access their own data
        return next();
    }

    return res.status(403).json({ 
        success: false,
        message: 'Access denied: You can only access your own data' 
    });
};

module.exports = { verifyToken, isAdmin, isOwnDataOrAdmin };