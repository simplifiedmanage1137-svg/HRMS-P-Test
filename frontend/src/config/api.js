// src/config/api.js

const API_BASE_URL = (() => {
  const url = import.meta.env.VITE_API_URL || '';

  // Warn in production if the env var is missing
  if (!url && import.meta.env.PROD) {
    console.warn(
      '[HRMS] VITE_API_URL is not set. ' +
      'All API calls will use relative paths, which will fail on Vercel. ' +
      'Add VITE_API_URL=https://hrms-p-test-1.onrender.com in your Vercel environment variables.'
    );
  }

  // Strip trailing slash so every endpoint path is clean
  return url.replace(/\/$/, '');
})();

const ep = (path) => `${API_BASE_URL}${path}`;

export const API_ENDPOINTS = {
  // Manager
  MANAGER_TEAM:         ep('/api/employees/manager/team'),
  MANAGER_UPDATE_SHIFT: (employeeId) => ep(`/api/employees/manager/shift/${employeeId}`),

  // Auth
  LOGIN:   ep('/api/auth/login'),
  VERIFY:  ep('/api/auth/verify'),
  REFRESH: ep('/api/auth/refresh'),
  REGISTER: ep('/api/auth/register'),
  LOGOUT:  ep('/api/auth/logout'),

  // Password
  PASSWORD_CHANGE:        ep('/api/auth/change-password'),
  PASSWORD_FORGOT:        ep('/api/auth/forgot-password'),
  PASSWORD_RESET:         ep('/api/auth/reset-password'),
  PASSWORD_RESET_DIRECT:  ep('/api/auth/reset-password-direct'),

  // Health / test
  TEST:    ep('/api/test'),
  TEST_DB: ep('/api/test-db'),
  HEALTH_CHECK:    ep('/api/health'),
  HEALTH_CHECK_DB: ep('/api/health/db'),

  // Employees
  EMPLOYEES:         ep('/api/employees'),
  EMPLOYEE_BY_ID:    (id) => ep(`/api/employees/${id}`),
  EMPLOYEE_PROFILE:  (employeeId) => ep(`/api/employees/profile/${employeeId}`),
  EMPLOYEE_DOCUMENTS: (employeeId) => ep(`/api/employees/${employeeId}/documents`),
  EMPLOYEE_DOCUMENT_BY_TYPE: (employeeId, documentType) =>
    ep(`/api/employees/${employeeId}/documents/${documentType}`),
  EMPLOYEE_DOCUMENT_DELETE: (employeeId, documentType) =>
    ep(`/api/employees/${employeeId}/documents/${documentType}`),
  EMPLOYEE_DELETE: (id) => ep(`/api/employees/${id}`),
  TODAY_EVENTS:    ep('/api/employees/today-events'),
  EMPLOYEE_STATS:  ep('/api/employees/stats/summary'),

  // Leaves
  LEAVES:        ep('/api/leaves'),
  LEAVE_APPLY:   ep('/api/leaves/apply'),
  LEAVE_BY_ID:   (id) => ep(`/api/leaves/${id}`),
  LEAVE_BALANCE: (employeeId) => ep(`/api/leaves/balance/${employeeId}`),
  LEAVE_BALANCE_BY_YEAR: (employeeId, year) => ep(`/api/leaves/balance/${employeeId}/${year}`),
  LEAVE_STATUS:  (id) => ep(`/api/leaves/${id}/status`),
  LEAVE_BY_EMPLOYEE: (employeeId) => ep(`/api/leaves?employee_id=${employeeId}`),
  LEAVE_TYPES:   ep('/api/leaves/types'),
  LEAVE_MANUAL_ACCRUAL: (employeeId) => ep(`/api/leaves/manual-accrual/${employeeId}`),
  LEAVE_YEARLY_RESET: ep('/api/leaves/yearly-reset'),

  // Attendance
  ATTENDANCE:        ep('/api/attendance'),
  ATTENDANCE_REPORT: ep('/api/attendance/report'),
  ATTENDANCE_EMPLOYEE_REPORT: (employeeId, start, end) =>
    ep(`/api/attendance/employee-report/${employeeId}?start=${start}&end=${end}`),
  ATTENDANCE_TODAY:       (employeeId) => ep(`/api/attendance/today/${employeeId}`),
  ATTENDANCE_CLOCK_IN:    ep('/api/attendance/clock-in'),
  ATTENDANCE_CLOCK_OUT:   ep('/api/attendance/clock-out'),
  ATTENDANCE_HEARTBEAT:   ep('/api/attendance/heartbeat'),
  ATTENDANCE_CHECK_ACTIVE: ep('/api/attendance/check-active'),
  ATTENDANCE_MARK_ABSENT:  ep('/api/attendance/mark-absent'),

  // Attendance regularization
  ATTENDANCE_MISSED_CLOCKOUTS: (employeeId) =>
    ep(`/api/attendance/missed-clockouts/${employeeId}`),
  ATTENDANCE_REGULARIZATION_REQUEST: (employeeId) =>
    ep(`/api/attendance/regularization/${employeeId}/request`),
  ATTENDANCE_PENDING_REGULARIZATIONS: ep('/api/attendance/regularization/pending'),
  ATTENDANCE_APPROVE_REGULARIZATION: (requestId) =>
    ep(`/api/attendance/regularization/${requestId}/approve`),
  ATTENDANCE_REJECT_REGULARIZATION: (requestId) =>
    ep(`/api/attendance/regularization/${requestId}/reject`),
  ATTENDANCE_AUTO_CLOSE_STALE: ep('/api/attendance/auto-close-stale'),
  ATTENDANCE_UPDATE_HISTORICAL_LATE_MARKS: ep('/api/attendance/update-historical-late-marks'),

  // Comp-Off
  COMP_OFF_BALANCE: (employeeId) => ep(`/api/attendance/comp-off/${employeeId}`),
  COMP_OFF_HISTORY: (employeeId) => ep(`/api/attendance/comp-off/${employeeId}/history`),

  // Overtime
  OVERTIME_SUMMARY: (employeeId, month, year) =>
    ep(`/api/attendance/overtime/${employeeId}/${month}/${year}`),

  // Salary
  SALARY:          ep('/api/salary'),
  SALARY_EMPLOYEE: (employeeId) => ep(`/api/salary/employee/${employeeId}`),
  SALARY_BY_ID:    (id) => ep(`/api/salary/${id}`),
  SALARY_GENERATE: ep('/api/salary/generate'),

  // Notifications
  NOTIFICATIONS:        ep('/api/notifications'),
  NOTIFICATION_READ:    (id) => ep(`/api/notifications/${id}/read`),
  NOTIFICATION_DELETE:  (id) => ep(`/api/notifications/${id}`),
  NOTIFICATIONS_BY_EMPLOYEE:   (employeeId) => ep(`/api/notifications?employee_id=${employeeId}`),
  NOTIFICATIONS_UNREAD_COUNT:  (employeeId) => ep(`/api/notifications/unread-count/${employeeId}`),
  NOTIFICATION_PREFERENCES:        ep('/api/notifications/preferences'),
  NOTIFICATION_PREFERENCES_UPDATE: ep('/api/notifications/preferences/update'),

  // Notices / Warnings
  NOTICES:              ep('/api/notices'),
  NOTICE_BY_ID:         (id) => ep(`/api/notices/${id}`),
  NOTICES_FOR_EMPLOYEE: (employeeId) => ep(`/api/notices/employee/${employeeId}`),
  NOTICE_READ:          (id) => ep(`/api/notices/${id}/read`),
  NOTICE_DELETE:        (id) => ep(`/api/notices/${id}`),

  // Announcements
  ANNOUNCEMENTS:       ep('/api/announcements'),
  ANNOUNCEMENT_DELETE: (id) => ep(`/api/announcements/${id}`),

  // Ratings
  RATINGS:           ep('/api/ratings'),
  RATINGS_ALL:       ep('/api/ratings/all'),
  RATINGS_ADMIN_RATE: ep('/api/ratings/admin-rate'),

  // Admin updates
  ADMIN_UPDATES:                ep('/api/admin-updates'),
  ADMIN_UPDATES_EMPLOYEES:      ep('/api/admin-updates/employees'),
  ADMIN_UPDATES_SEND_REQUEST:   ep('/api/admin-updates/send-request'),
  ADMIN_UPDATES_COMPLETED:      ep('/api/admin-updates/completed-requests'),
  ADMIN_UPDATES_HANDLE:         ep('/api/admin-updates/handle-request'),
  ADMIN_UPDATES_PENDING_COUNT:  ep('/api/admin-updates/pending-count'),
  ADMIN_UPDATES_MARK_READ:      ep('/api/admin-updates/mark-notifications-read'),
  ADMIN_UPDATES_EMPLOYEE_REQUESTS: (employeeId) =>
    ep(`/api/admin-updates/employee-requests/${employeeId}`),
  ADMIN_UPDATES_SUBMIT: ep('/api/admin-updates/submit-update'),

  // Employee updates
  EMPLOYEE_UPDATES:          ep('/api/employee-updates'),
  EMPLOYEE_UPDATES_PENDING:  ep('/api/employee-updates/pending-requests'),
  EMPLOYEE_UPDATES_ACCEPT:   (requestId) => ep(`/api/employee-updates/accept-request/${requestId}`),
  EMPLOYEE_UPDATES_CURRENT_DATA: ep('/api/employee-updates/current-data'),
  EMPLOYEE_UPDATES_SUBMIT:   ep('/api/employee-updates/submit-update'),
  EMPLOYEE_UPDATES_COMPLETED: ep('/api/employee-updates/completed-requests'),
  EMPLOYEE_UPDATES_REQUEST:  (requestId) => ep(`/api/employee-updates/request/${requestId}`),
  EMPLOYEE_UPDATES_REJECT:   (requestId) => ep(`/api/employee-updates/reject-request/${requestId}`),

  // Update responses
  UPDATE_RESPONSES:     ep('/api/update-responses'),
  UPDATE_RESPONSE_BY_ID: (id) => ep(`/api/update-responses/${id}`),

  // Notice board
  NOTICE_BOARD_ACTIVE:  ep('/api/notice-board/active'),
  NOTICE_BOARD_LIST:    ep('/api/notice-board'),
  NOTICE_BOARD_CREATE:  ep('/api/notice-board'),
  NOTICE_BOARD_UPDATE:  (id) => ep(`/api/notice-board/${id}`),
  NOTICE_BOARD_DELETE:  (id) => ep(`/api/notice-board/${id}`),

  // Public endpoints (no auth)
  LOGIN_FEED:          ep('/api/public/login-feed'),
  OFFICE_EVENTS:       ep('/api/public/office-events'),
  OFFICE_EVENTS_CREATE: ep('/api/public/office-events'),
  OFFICE_EVENT_DELETE: (id) => ep(`/api/public/office-events/${id}`),

  // Shifts
  SHIFTS:       ep('/api/shifts'),
  SHIFT_BY_ID:  (id) => ep(`/api/shifts/${id}`),

  // Contact
  CONTACT: ep('/api/contact'),

  // Geofence
  GEOFENCE_LIST:   ep('/api/geofence/list'),
  GEOFENCE_CREATE: ep('/api/geofence'),
  GEOFENCE_UPDATE: (id) => ep(`/api/geofence/${id}`),
  GEOFENCE_DELETE: (id) => ep(`/api/geofence/${id}`),
  GEOFENCE_GET:    (id) => ep(`/api/geofence/${id}`),
  GEOFENCE_CHECK:  ep('/api/geofence/check'),
};

export default API_ENDPOINTS;
