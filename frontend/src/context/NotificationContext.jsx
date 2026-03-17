// context/NotificationContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import API_ENDPOINTS from '../config/api';

const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notification, setNotification] = useState(null);
  const [employeeUpdate, setEmployeeUpdate] = useState(null);
  const [eventNotifications, setEventNotifications] = useState([]);
  const [todayEvents, setTodayEvents] = useState({ birthdays: [], anniversaries: [], total: 0 });
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch today's events (birthdays and anniversaries)
  const fetchTodayEvents = async () => {
    try {
      const response = await axios.get(API_ENDPOINTS.TODAY_EVENTS);
      setTodayEvents(response.data);
      
      // Create notifications for events
      const events = [];
      
      response.data.birthdays?.forEach(emp => {
        events.push({
          id: `birthday-${emp.id}-${Date.now()}`,
          type: 'birthday',
          employee: emp,
          message: `🎂 Happy Birthday to ${emp.first_name} ${emp.last_name}!`,
          date: new Date().toISOString(),
          read: false
        });
      });
      
      response.data.anniversaries?.forEach(emp => {
        const years = new Date().getFullYear() - new Date(emp.joining_date).getFullYear();
        events.push({
          id: `anniversary-${emp.id}-${Date.now()}`,
          type: 'anniversary',
          employee: emp,
          message: `🎉 Congratulations! ${emp.first_name} ${emp.last_name} is celebrating ${years} year${years > 1 ? 's' : ''} work anniversary!`,
          years,
          date: new Date().toISOString(),
          read: false
        });
      });
      
      setEventNotifications(events);
      updateUnreadCount(events);
    } catch (error) {
      // Don't show error in console for 404 - it's expected if route doesn't exist
      if (error.response?.status !== 404) {
        console.error('Error fetching today events:', error);
      }
    }
  };

  // Update unread count
  const updateUnreadCount = (events = eventNotifications) => {
    const count = events.filter(e => !e.read).length;
    setUnreadCount(count);
  };

  // Check for events every hour
  useEffect(() => {
    fetchTodayEvents();
    
    const interval = setInterval(fetchTodayEvents, 60 * 60 * 1000); // Every hour
    
    return () => clearInterval(interval);
  }, []);

  // Update unread count when events change
  useEffect(() => {
    updateUnreadCount();
  }, [eventNotifications]);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  const notifyEmployeeUpdate = (employeeId) => {
    setEmployeeUpdate({ employeeId, timestamp: Date.now() });
  };

  const clearEmployeeUpdate = () => {
    setEmployeeUpdate(null);
  };

  const markEventAsRead = (eventId) => {
    setEventNotifications(prev => {
      const updated = prev.map(event => 
        event.id === eventId ? { ...event, read: true } : event
      );
      updateUnreadCount(updated);
      return updated;
    });
  };

  const markAllEventsAsRead = () => {
    setEventNotifications(prev => {
      const updated = prev.map(event => ({ ...event, read: true }));
      updateUnreadCount(updated);
      return updated;
    });
  };

  // Get unread events count
  const getUnreadEventCount = () => {
    return eventNotifications.filter(e => !e.read).length;
  };

  return (
    <NotificationContext.Provider value={{
      notification,
      showNotification,
      employeeUpdate,
      notifyEmployeeUpdate,
      clearEmployeeUpdate,
      eventNotifications,
      todayEvents,
      fetchTodayEvents,
      markEventAsRead,
      markAllEventsAsRead,
      unreadCount,
      getUnreadEventCount
    }}>
      {children}
    </NotificationContext.Provider>
  );
};