// src/context/NotificationContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from '../config/axios';
import API_ENDPOINTS from '../config/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [eventNotifications, setEventNotifications] = useState([]);
  const [todayEvents, setTodayEvents] = useState({ birthdays: [], anniversaries: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);
  const [employeeUpdate, setEmployeeUpdate] = useState(Date.now()); // Track employee changes

  // Function to trigger employee list refresh
  const triggerEmployeeUpdate = useCallback(() => {
    setEmployeeUpdate(Date.now());
  }, []);
  const showNotification = useCallback((message, type = 'info', duration = 3000) => {
    console.log(`📢 Notification (${type}):`, message);
    
    // Create a temporary notification
    const notification = {
      id: Date.now(),
      message,
      type,
      timestamp: new Date().toISOString()
    };
    
    setToastMessage(notification);
    
    // Auto-hide after duration
    if (duration > 0) {
      setTimeout(() => {
        setToastMessage(null);
      }, duration);
    }
    
    // You can also integrate with a toast library here
    // For now, we'll just log to console and you can add a Toast component later
  }, []);

  // Fetch today's events
  const fetchTodayEvents = useCallback(async () => {
    // Don't fetch if no user or token
    if (!user || !token) {
      console.log('⚠️ No user or token, skipping fetch today events');
      return;
    }

    try {
      setLoading(true);
      console.log('📡 Fetching today events...');
      
      const response = await axios.get(API_ENDPOINTS.TODAY_EVENTS, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      console.log('✅ Today events fetched:', response.data);
      setTodayEvents(response.data);
      
      // Create event notifications
      const events = [];
      
      // Add birthday notifications
      if (response.data.birthdays && response.data.birthdays.length > 0) {
        response.data.birthdays.forEach(emp => {
          events.push({
            id: `birthday-${emp.id}-${Date.now()}`,
            type: 'birthday',
            title: '🎂 Birthday Today!',
            message: `${emp.first_name} ${emp.last_name} (${emp.department}) is celebrating their birthday today!`,
            employee: emp,
            read: false,
            created_at: new Date().toISOString()
          });
        });
      }
      
      // Add anniversary notifications
      if (response.data.anniversaries && response.data.anniversaries.length > 0) {
        response.data.anniversaries.forEach(emp => {
          events.push({
            id: `anniversary-${emp.id}-${Date.now()}`,
            type: 'anniversary',
            title: '🏆 Work Anniversary!',
            message: `${emp.first_name} ${emp.last_name} (${emp.department}) is celebrating ${emp.years} year(s) at the company!`,
            employee: emp,
            read: false,
            created_at: new Date().toISOString()
          });
        });
      }
      
      setEventNotifications(prev => {
        // Combine with existing notifications, remove duplicates
        const existingIds = new Set(prev.map(n => n.id));
        const newEvents = events.filter(e => !existingIds.has(e.id));
        return [...newEvents, ...prev];
      });
      
    } catch (error) {
      if (error.response?.status === 401) {
        console.log('🔑 Unauthorized - Token might be expired');
        // Don't show error for 401, just log it
      } else {
        console.error('❌ Error fetching today events:', error);
        showNotification('Failed to fetch today\'s events', 'danger');
      }
    } finally {
      setLoading(false);
    }
  }, [user, token, showNotification]);

  // Mark event as read
  const markEventAsRead = useCallback((eventId) => {
    setEventNotifications(prev =>
      prev.map(event =>
        event.id === eventId ? { ...event, read: true } : event
      )
    );
  }, []);

  // Mark all events as read
  const markAllEventsAsRead = useCallback(() => {
    setEventNotifications(prev =>
      prev.map(event => ({ ...event, read: true }))
    );
  }, []);

  // Remove notification
  const removeNotification = useCallback((notificationId) => {
    setEventNotifications(prev =>
      prev.filter(n => n.id !== notificationId)
    );
  }, []);

  // Clear all notifications
  const clearAllNotifications = useCallback(() => {
    setEventNotifications([]);
  }, []);

  // Clear toast message
  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  // Fetch events when user changes
  useEffect(() => {
    if (user && token) {
      fetchTodayEvents();
      
      // Refresh every hour
      const interval = setInterval(() => {
        fetchTodayEvents();
      }, 60 * 60 * 1000); // 1 hour
      
      return () => clearInterval(interval);
    }
  }, [user, token, fetchTodayEvents]);

  const value = {
    // Event notifications
    eventNotifications,
    todayEvents,
    loading,
    fetchTodayEvents,
    markEventAsRead,
    markAllEventsAsRead,
    removeNotification,
    clearAllNotifications,
    
    // Toast notifications
    showNotification,
    toastMessage,
    clearToast,
    
    // Employee update trigger
    employeeUpdate,
    triggerEmployeeUpdate
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      
      {/* Optional: Simple Toast Component */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            minWidth: '250px',
            maxWidth: '350px',
            backgroundColor: toastMessage.type === 'success' ? '#d4edda' : 
                           toastMessage.type === 'danger' ? '#f8d7da' : 
                           toastMessage.type === 'warning' ? '#fff3cd' : '#d1ecf1',
            color: toastMessage.type === 'success' ? '#155724' : 
                   toastMessage.type === 'danger' ? '#721c24' : 
                   toastMessage.type === 'warning' ? '#856404' : '#0c5460',
            border: `1px solid ${toastMessage.type === 'success' ? '#c3e6cb' : 
                                 toastMessage.type === 'danger' ? '#f5c6cb' : 
                                 toastMessage.type === 'warning' ? '#ffeeba' : '#bee5eb'}`,
            borderRadius: '4px',
            padding: '12px 16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideIn 0.3s ease'
          }}
        >
          <span>{toastMessage.message}</span>
          <button
            onClick={clearToast}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '16px',
              cursor: 'pointer',
              marginLeft: '12px',
              color: 'inherit',
              opacity: 0.7
            }}
          >
            ×
          </button>
        </div>
      )}
      
      {/* Add animation style */}
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </NotificationContext.Provider>
  );
};