// src/config/api.js

// For Vite (uses import.meta.env)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// Add this debug log
console.log('🔧 API Base URL:', API_BASE_URL);
console.log('🔧 Environment:', import.meta.env.MODE);

export const API_ENDPOINTS = {
    // Auth endpoints
    LOGIN: `${API_BASE_URL}/api/auth/login`,
    VERIFY: `${API_BASE_URL}/api/auth/verify`,
    REGISTER: `${API_BASE_URL}/api/auth/register`,
    TEST: `${API_BASE_URL}/api/test`,
    TEST_DB: `${API_BASE_URL}/api/test-db`,

    // Employee endpoints
    EMPLOYEES: `${API_BASE_URL}/api/employees`,
    EMPLOYEE_BY_ID: (id) => `${API_BASE_URL}/api/employees/${id}`,
    EMPLOYEE_PROFILE: (employeeId) => `${API_BASE_URL}/api/employees/profile/${employeeId}`,
    EMPLOYEE_DOCUMENTS: (employeeId) => `${API_BASE_URL}/api/employees/${employeeId}/documents`,
    EMPLOYEE_DOCUMENT_BY_TYPE: (employeeId, documentType) =>
        `${API_BASE_URL}/api/employees/${employeeId}/documents/${documentType}`,
    EMPLOYEE_DOCUMENT_DELETE: (employeeId, documentType) =>
        `${API_BASE_URL}/api/employees/${employeeId}/documents/${documentType}`,
    EMPLOYEE_DELETE: (id) => `${API_BASE_URL}/api/employees/${id}`,
    TODAY_EVENTS: `${API_BASE_URL}/api/employees/today-events`,
    EMPLOYEE_STATS: `${API_BASE_URL}/api/employees/stats/summary`,

    // Leave endpoints
    LEAVES: `${API_BASE_URL}/api/leaves`,
    LEAVE_APPLY: `${API_BASE_URL}/api/leaves/apply`,
    LEAVE_BY_ID: (id) => `${API_BASE_URL}/api/leaves/${id}`,
    LEAVE_BALANCE: (employeeId) => `${API_BASE_URL}/api/leaves/balance/${employeeId}`,
    LEAVE_BALANCE_BY_YEAR: (employeeId, year) => `${API_BASE_URL}/api/leaves/balance/${employeeId}/${year}`,
    LEAVE_STATUS: (id) => `${API_BASE_URL}/api/leaves/${id}/status`,
    LEAVE_BY_EMPLOYEE: (employeeId) => `${API_BASE_URL}/api/leaves?employee_id=${employeeId}`,
    LEAVE_TYPES: `${API_BASE_URL}/api/leaves/types`,
    LEAVE_MANUAL_ACCRUAL: (employeeId) => `${API_BASE_URL}/api/leaves/manual-accrual/${employeeId}`,
    LEAVE_YEARLY_RESET: `${API_BASE_URL}/api/leaves/yearly-reset`,
    
    // Comp-Off endpoints
    COMP_OFF_BALANCE: (employeeId) => `${API_BASE_URL}/api/attendance/comp-off/${employeeId}`,
    COMP_OFF_HISTORY: (employeeId) => `${API_BASE_URL}/api/attendance/comp-off/${employeeId}/history`,

    // Attendance endpoints
    ATTENDANCE: `${API_BASE_URL}/api/attendance`,
    ATTENDANCE_REPORT: `${API_BASE_URL}/api/attendance/report`,
    ATTENDANCE_TODAY: (employee_id) => `${API_BASE_URL}/api/attendance/today/${employee_id}`,
    ATTENDANCE_CLOCK_IN: `${API_BASE_URL}/api/attendance/clock-in`,
    ATTENDANCE_CLOCK_OUT: `${API_BASE_URL}/api/attendance/clock-out`,
    ATTENDANCE_HEARTBEAT: `${API_BASE_URL}/api/attendance/heartbeat`,
    ATTENDANCE_CHECK_ACTIVE: `${API_BASE_URL}/api/attendance/check-active`,
    ATTENDANCE_MARK_ABSENT: `${API_BASE_URL}/api/attendance/mark-absent`,
    
    // Overtime endpoints
    OVERTIME_SUMMARY: (employeeId, month, year) => 
        `${API_BASE_URL}/api/attendance/overtime/${employeeId}/${month}/${year}`,

    // Notification endpoints
    NOTIFICATIONS: `${API_BASE_URL}/api/notifications`,
    NOTIFICATION_READ: (id) => `${API_BASE_URL}/api/notifications/${id}/read`,
    NOTIFICATION_DELETE: (id) => `${API_BASE_URL}/api/notifications/${id}`,
    NOTIFICATIONS_BY_EMPLOYEE: (employeeId) => `${API_BASE_URL}/api/notifications?employee_id=${employeeId}`,
    NOTIFICATIONS_UNREAD_COUNT: (employeeId) => `${API_BASE_URL}/api/notifications/unread-count/${employeeId}`,

    // Salary endpoints
    SALARY: `${API_BASE_URL}/api/salary`,
    SALARY_EMPLOYEE: (employeeId) => `${API_BASE_URL}/api/salary/employee/${employeeId}`,
    SALARY_BY_ID: (id) => `${API_BASE_URL}/api/salary/${id}`,
    SALARY_GENERATE: `${API_BASE_URL}/api/salary/generate`,

    // Shift endpoints
    SHIFTS: `${API_BASE_URL}/api/shifts`,
    SHIFT_BY_ID: (id) => `${API_BASE_URL}/api/shifts/${id}`,

    // Admin update endpoints
    ADMIN_UPDATES: `${API_BASE_URL}/api/admin-updates`,
    ADMIN_UPDATES_EMPLOYEES: `${API_BASE_URL}/api/admin-updates/employees`,
    ADMIN_UPDATES_SEND_REQUEST: `${API_BASE_URL}/api/admin-updates/send-request`,
    ADMIN_UPDATES_COMPLETED: `${API_BASE_URL}/api/admin-updates/completed-requests`,
    ADMIN_UPDATES_HANDLE: `${API_BASE_URL}/api/admin-updates/handle-request`,
    ADMIN_UPDATES_PENDING_COUNT: `${API_BASE_URL}/api/admin-updates/pending-count`,
    ADMIN_UPDATES_MARK_READ: `${API_BASE_URL}/api/admin-updates/mark-notifications-read`,
    ADMIN_UPDATES_EMPLOYEE_REQUESTS: (employeeId) => `${API_BASE_URL}/api/admin-updates/employee-requests/${employeeId}`,
    ADMIN_UPDATES_SUBMIT: `${API_BASE_URL}/api/admin-updates/submit-update`,

    // Employee update endpoints
    EMPLOYEE_UPDATES: `${API_BASE_URL}/api/employee-updates`,
    EMPLOYEE_UPDATES_PENDING: `${API_BASE_URL}/api/employee-updates/pending-requests`,
    EMPLOYEE_UPDATES_ACCEPT: (requestId) => `${API_BASE_URL}/api/employee-updates/accept-request/${requestId}`,
    EMPLOYEE_UPDATES_CURRENT_DATA: `${API_BASE_URL}/api/employee-updates/current-data`,
    EMPLOYEE_UPDATES_SUBMIT: `${API_BASE_URL}/api/employee-updates/submit-update`,
    EMPLOYEE_UPDATES_COMPLETED: `${API_BASE_URL}/api/employee-updates/completed-requests`,
    EMPLOYEE_UPDATES_REQUEST: (requestId) => `${API_BASE_URL}/api/employee-updates/request/${requestId}`,
    EMPLOYEE_UPDATES_REJECT: (requestId) => `${API_BASE_URL}/api/employee-updates/reject-request/${requestId}`,

    // Update response endpoints
    UPDATE_RESPONSES: `${API_BASE_URL}/api/update-responses`,
    UPDATE_RESPONSE_BY_ID: (id) => `${API_BASE_URL}/api/update-responses/${id}`,

    // Geofence endpoints
    GEOFENCE_LIST: `${API_BASE_URL}/api/geofence/list`,
    GEOFENCE_CREATE: `${API_BASE_URL}/api/geofence`,
    GEOFENCE_UPDATE: (id) => `${API_BASE_URL}/api/geofence/${id}`,
    GEOFENCE_DELETE: (id) => `${API_BASE_URL}/api/geofence/${id}`,
    GEOFENCE_GET: (id) => `${API_BASE_URL}/api/geofence/${id}`,
    GEOFENCE_CHECK: `${API_BASE_URL}/api/geofence/check`,

    // Holiday endpoints
    HOLIDAYS: `${API_BASE_URL}/api/holidays`,
    HOLIDAY_BY_DATE: (date) => `${API_BASE_URL}/api/holidays/${date}`,
    HOLIDAY_BY_REGION: (region) => `${API_BASE_URL}/api/holidays/region/${region}`,
    HOLIDAY_BY_YEAR: (year) => `${API_BASE_URL}/api/holidays/year/${year}`,

    // Dashboard endpoints
    DASHBOARD_STATS: (employeeId) => `${API_BASE_URL}/api/dashboard/stats/${employeeId}`,
    DASHBOARD_RECENT_ACTIVITY: (employeeId) => `${API_BASE_URL}/api/dashboard/recent-activity/${employeeId}`,

    // Report endpoints
    REPORTS_ATTENDANCE: `${API_BASE_URL}/api/reports/attendance`,
    REPORTS_LEAVE: `${API_BASE_URL}/api/reports/leave`,
    REPORTS_SALARY: `${API_BASE_URL}/api/reports/salary`,
    REPORTS_EXPORT: (type, format) => `${API_BASE_URL}/api/reports/export/${type}/${format}`,

    // Bulk operations
    BULK_EMPLOYEES_UPLOAD: `${API_BASE_URL}/api/bulk/employees/upload`,
    BULK_ATTENDANCE_UPLOAD: `${API_BASE_URL}/api/bulk/attendance/upload`,
    BULK_LEAVE_UPLOAD: `${API_BASE_URL}/api/bulk/leave/upload`,

    // Settings endpoints
    SETTINGS: `${API_BASE_URL}/api/settings`,
    SETTINGS_COMPANY: `${API_BASE_URL}/api/settings/company`,
    SETTINGS_LEAVE_POLICY: `${API_BASE_URL}/api/settings/leave-policy`,
    SETTINGS_ATTENDANCE_POLICY: `${API_BASE_URL}/api/settings/attendance-policy`,

    // Audit logs
    AUDIT_LOGS: `${API_BASE_URL}/api/audit-logs`,
    AUDIT_LOGS_BY_USER: (userId) => `${API_BASE_URL}/api/audit-logs/user/${userId}`,
    AUDIT_LOGS_BY_DATE: (date) => `${API_BASE_URL}/api/audit-logs/date/${date}`,

    // Backup endpoints
    BACKUP_CREATE: `${API_BASE_URL}/api/backup/create`,
    BACKUP_RESTORE: (backupId) => `${API_BASE_URL}/api/backup/restore/${backupId}`,
    BACKUP_LIST: `${API_BASE_URL}/api/backup/list`,
    BACKUP_DOWNLOAD: (backupId) => `${API_BASE_URL}/api/backup/download/${backupId}`,

    // Export/Import
    EXPORT_EMPLOYEES: `${API_BASE_URL}/api/export/employees`,
    EXPORT_ATTENDANCE: `${API_BASE_URL}/api/export/attendance`,
    EXPORT_LEAVES: `${API_BASE_URL}/api/export/leaves`,
    IMPORT_EMPLOYEES: `${API_BASE_URL}/api/import/employees`,
    IMPORT_ATTENDANCE: `${API_BASE_URL}/api/import/attendance`,
    IMPORT_LEAVES: `${API_BASE_URL}/api/import/leaves`,

    // File upload endpoints
    UPLOAD_PROFILE_IMAGE: (employeeId) => `${API_BASE_URL}/api/upload/profile/${employeeId}`,
    UPLOAD_DOCUMENT: (employeeId, documentType) => `${API_BASE_URL}/api/upload/document/${employeeId}/${documentType}`,
    UPLOAD_BULK: `${API_BASE_URL}/api/upload/bulk`,

    // Analytics endpoints
    ANALYTICS_ATTENDANCE: `${API_BASE_URL}/api/analytics/attendance`,
    ANALYTICS_LEAVE: `${API_BASE_URL}/api/analytics/leave`,
    ANALYTICS_EMPLOYEE: `${API_BASE_URL}/api/analytics/employee`,
    ANALYTICS_DEPARTMENT: (department) => `${API_BASE_URL}/api/analytics/department/${department}`,

    // Calendar endpoints
    CALENDAR_ATTENDANCE: (employeeId, month, year) => 
        `${API_BASE_URL}/api/calendar/attendance/${employeeId}?month=${month}&year=${year}`,
    CALENDAR_LEAVE: (employeeId, month, year) => 
        `${API_BASE_URL}/api/calendar/leave/${employeeId}?month=${month}&year=${year}`,
    CALENDAR_HOLIDAY: (month, year) => 
        `${API_BASE_URL}/api/calendar/holiday?month=${month}&year=${year}`,

    // Notification preferences
    NOTIFICATION_PREFERENCES: `${API_BASE_URL}/api/notifications/preferences`,
    NOTIFICATION_PREFERENCES_UPDATE: `${API_BASE_URL}/api/notifications/preferences/update`,

    // Password management
    PASSWORD_CHANGE: `${API_BASE_URL}/api/auth/change-password`,
    PASSWORD_RESET_REQUEST: `${API_BASE_URL}/api/auth/reset-password-request`,
    PASSWORD_RESET_CONFIRM: `${API_BASE_URL}/api/auth/reset-password-confirm`,

    // Session management
    SESSIONS: `${API_BASE_URL}/api/sessions`,
    SESSION_TERMINATE: (sessionId) => `${API_BASE_URL}/api/sessions/${sessionId}/terminate`,
    SESSION_TERMINATE_ALL: `${API_BASE_URL}/api/sessions/terminate-all`,

    // Health check
    HEALTH_CHECK: `${API_BASE_URL}/api/health`,
    HEALTH_CHECK_DB: `${API_BASE_URL}/api/health/db`
};

// Log all endpoints for debugging
console.log('🔧 API Endpoints loaded:', {
    LOGIN: API_ENDPOINTS.LOGIN,
    TODAY_EVENTS: API_ENDPOINTS.TODAY_EVENTS,
    BASE_URL: API_BASE_URL
});

export default API_ENDPOINTS;