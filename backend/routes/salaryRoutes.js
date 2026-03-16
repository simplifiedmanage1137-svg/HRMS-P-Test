// routes/salaryRoutes.js
const express = require('express');
const router = express.Router();
const salaryController = require('../controllers/salaryController');
const { verifyToken, isAdmin, isOwnDataOrAdmin } = require('../middleware/auth');

// Employee routes (require authentication)
router.get('/employee/:employee_id', verifyToken, isOwnDataOrAdmin, salaryController.getEmployeeSalarySlips);
router.get('/:id', verifyToken, salaryController.getSalarySlipById);
router.get('/:employee_id/:month/:year', verifyToken, isOwnDataOrAdmin, salaryController.getSalarySlipByMonth);

// 👇 IMPORTANT: Employee can generate their own salary slip
// Make sure this uses isOwnDataOrAdmin, NOT isAdmin
router.post('/generate', verifyToken, isOwnDataOrAdmin, salaryController.generateSalarySlip);

// Admin only routes
router.post('/generate-bulk', verifyToken, isAdmin, salaryController.generateBulkSalarySlips);
router.put('/:id/mark-paid', verifyToken, isAdmin, salaryController.markAsPaid);
router.delete('/:id', verifyToken, isAdmin, salaryController.deleteSalarySlip);
router.get('/stats/summary', verifyToken, isAdmin, salaryController.getSalaryStatistics);
router.put('/:id', verifyToken, isAdmin, salaryController.updateSalarySlip);

module.exports = router;