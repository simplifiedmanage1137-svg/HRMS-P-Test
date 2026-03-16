const express = require('express');
const router = express.Router();
const attendanceController = require('../controllers/attendanceController');

module.exports = (supabase) => {
    // Pass supabase to controller if needed
    // If controller doesn't need supabase directly, just return router
    
    // Employee endpoints
    router.post('/clock-in', attendanceController.clockIn);
    router.post('/clock-out', attendanceController.clockOut);
    router.post('/heartbeat', attendanceController.heartbeat);
    router.get('/today/:employee_id', attendanceController.getTodayAttendance);

    // Admin endpoints
    router.get('/report', attendanceController.getAttendanceReport);

    console.log('✅ Attendance routes loaded');
    return router;
};