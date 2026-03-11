// src/components/Layout/Navbar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  FaBell, 
  FaUserCircle, 
  FaClock, 
  FaCalendarAlt, 
  FaEdit, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaUser, 
  FaSignOutAlt,
  FaTrash,
  FaTimes
} from 'react-icons/fa';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import axios from 'axios';
import { Badge, Button, Dropdown } from 'react-bootstrap';
import EventNotification from '../Common/EventNotification';

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { 
    eventNotifications, 
    markEventAsRead, 
    markAllEventsAsRead,
    removeNotification 
  } = useNotification();
  
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  
  const notificationRef = useRef(null);
  const bellRef = useRef(null);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (user) {
      fetchEmployeeName();
      fetchNotifications();
      fetchPendingUpdateRequests();
      
      const interval = setInterval(() => {
        fetchNotifications();
        fetchPendingUpdateRequests();
      }, 30000);
      
      return () => clearInterval(interval);
    }
  }, [user]);

  // Update unread count
  useEffect(() => {
    const unreadEvents = eventNotifications.filter(e => !e.read).length;
    const unreadRegular = notifications.filter(n => !n.is_read).length;
    setUnreadCount(unreadRegular + unreadEvents);
  }, [eventNotifications, notifications]);

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        notificationRef.current && 
        !notificationRef.current.contains(event.target) &&
        bellRef.current && 
        !bellRef.current.contains(event.target)
      ) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const fetchEmployeeName = async () => {
    try {
      if (user?.role === 'admin') {
        setEmployeeName('Administrator');
        return;
      }
      
      const response = await axios.get(`http://localhost:5000/api/employees/profile/${user?.employeeId}`);
      if (response.data) {
        const fullName = `${response.data.first_name || ''} ${response.data.last_name || ''}`.trim();
        setEmployeeName(fullName || 'Employee');
      }
    } catch (error) {
      console.error('Error fetching employee name:', error);
      setEmployeeName(user?.role === 'admin' ? 'Administrator' : 'Employee');
    }
  };

  const fetchNotifications = async () => {
    if (!user?.employeeId) return;
    
    try {
      const response = await axios.get(`http://localhost:5000/api/notifications?employee_id=${user.employeeId}`);
      if (response.data && Array.isArray(response.data)) {
        setNotifications(response.data);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchPendingUpdateRequests = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/employee-updates/pending-requests');
      
      if (Array.isArray(response.data)) {
        setPendingRequests(response.data);
        setPendingCount(response.data.length);
      } else if (response.data?.requests && Array.isArray(response.data.requests)) {
        setPendingRequests(response.data.requests);
        setPendingCount(response.data.requests.length);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  const markAsRead = async (id) => {
    try {
      await axios.put(`http://localhost:5000/api/notifications/${id}/read`);
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true } : n)
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (id, e) => {
    e.stopPropagation(); // Prevent triggering parent click
    
    try {
      // Call API to delete notification
      await axios.delete(`http://localhost:5000/api/notifications/${id}`);
      
      // Remove from local state
      setNotifications(prev => prev.filter(n => n.id !== id));
      
      // Also try to remove from context if available
      if (removeNotification) {
        removeNotification(id);
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      
      // If API fails, at least remove from UI
      setNotifications(prev => prev.filter(n => n.id !== id));
    }
  };

  const deleteEventNotification = (eventId, e) => {
    e.stopPropagation();
    
    if (markEventAsRead) {
      markEventAsRead(eventId);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.is_read).map(n => n.id);
      await Promise.all(unreadIds.map(id => markAsRead(id)));
      markAllEventsAsRead();
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const handleEventClose = (eventId) => {
    markEventAsRead(eventId);
  };

  const handleViewUpdateRequests = () => {
    if (user?.role === 'admin') {
      navigate('/admin/update-requests');
    } else {
      navigate('/employee/update-requests');
    }
    setShowNotifications(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const formatNotificationTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const formattedTime = currentTime.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  const formattedDate = currentTime.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Get icon for notification type
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'update_approved':
        return <FaCheckCircle className="me-2 text-success" size={14} />;
      case 'update_rejected':
        return <FaTimesCircle className="me-2 text-danger" size={14} />;
      case 'update_request':
        return <FaEdit className="me-2 text-warning" size={14} />;
      default:
        return <FaBell className="me-2 text-info" size={14} />;
    }
  };

  return (
    <nav className="navbar-top" style={{
      backgroundColor: 'white',
      padding: '10px 20px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      position: 'sticky',
      top: 0,
      zIndex: 999,
      width: '100%',
      height: '60px'
    }}>
      <div>
        {/* <h5 style={{ margin: 0, fontSize: '16px', fontWeight: 'normal' }}>
          Welcome, <span style={{ color: '#d53f8c', fontWeight: 'bold' }}>{employeeName}</span>
        </h5> */}
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* Time and Date Display */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginRight: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '20px',
          padding: '5px 12px'
        }}>
          <FaClock style={{ color: '#d53f8c', marginRight: '6px' }} size={14} />
          <span style={{ fontWeight: 'bold', marginRight: '8px', fontSize: '14px' }}>{formattedTime}</span>
          <span style={{ color: '#999', margin: '0 4px' }}>|</span>
          <FaCalendarAlt style={{ color: '#d53f8c', marginLeft: '4px', marginRight: '6px' }} size={14} />
          <span style={{ color: '#666', fontSize: '14px' }}>{formattedDate}</span>
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative', marginRight: '15px' }} ref={bellRef}>
          <FaBell 
            size={20} 
            style={{ cursor: 'pointer', color: '#d53f8c' }}
            onClick={toggleNotifications}
          />
          {unreadCount > 0 && (
            <Badge 
              bg="danger" 
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                fontSize: '10px',
                padding: '2px 5px',
                borderRadius: '10px'
              }}
            >
              {unreadCount}
            </Badge>
          )}
        </div>

        {/* Profile Dropdown - Fixed with role-based menu items */}
        <Dropdown align="end">
          <Dropdown.Toggle variant="link" style={{ padding: 0, border: 'none', color: '#d53f8c' }}>
            <FaUserCircle size={28} color="#d53f8c" />
          </Dropdown.Toggle>

          <Dropdown.Menu>
            {/* My Profile - Sirf EMPLOYEE ke liye show hoga */}
            {user?.role === 'employee' && (
              <Dropdown.Item as={Link} to="/profile">
                <FaUser className="me-2" /> My Profile
              </Dropdown.Item>
            )}
            
            {/* Update Requests - Sabke liye (role ke hisaab se different path) */}
            <Dropdown.Item 
              as={Link} 
              to={user?.role === 'admin' ? '/admin/update-requests' : '/employee/update-requests'}
            >
              <FaEdit className="me-2" /> Update Requests
              {pendingCount > 0 && (
                <Badge bg="danger" className="ms-2">{pendingCount}</Badge>
              )}
            </Dropdown.Item>
            
            <Dropdown.Divider />
            
            {/* Logout - Sabke liye common */}
            <Dropdown.Item onClick={handleLogout}>
              <FaSignOutAlt className="me-2" /> Logout
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </div>

      {/* Notifications Dropdown */}
      {showNotifications && (
        <div 
          ref={notificationRef}
          style={{
            position: 'absolute',
            right: '20px',
            top: '70px',
            width: '400px',
            backgroundColor: 'white',
            boxShadow: '0 5px 15px rgba(0,0,0,0.2)',
            borderRadius: '8px',
            padding: '15px',
            zIndex: 1001,
            maxHeight: '500px',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h6 style={{ margin: 0 }}>Notifications</h6>
            {unreadCount > 0 && (
              <Button 
                variant="link" 
                size="sm" 
                onClick={markAllAsRead}
                style={{ padding: 0, textDecoration: 'none' }}
              >
                Mark all as read
              </Button>
            )}
          </div>
          
          {/* Pending Update Requests Section */}
          {pendingCount > 0 && (
            <div className="mb-3 p-2 bg-warning bg-opacity-10 rounded">
              <div className="d-flex align-items-center">
                <FaEdit className="text-warning me-2" size={16} />
                <div className="flex-grow-1">
                  <small className="fw-bold d-block">Pending Update Requests</small>
                  <small className="text-muted">
                    {pendingCount} update request(s) pending
                  </small>
                </div>
                <Button
                  variant="outline-warning"
                  size="sm"
                  onClick={handleViewUpdateRequests}
                >
                  View
                </Button>
              </div>
            </div>
          )}
          
          {/* Event Notifications Section */}
          {eventNotifications.filter(e => !e.read).length > 0 && (
            <div className="mb-3">
              <small className="text-muted fw-semibold d-block mb-2">🎉 Today's Events</small>
              {eventNotifications.filter(e => !e.read).map(event => (
                <div key={event.id} style={{ position: 'relative' }}>
                  <EventNotification 
                    event={event} 
                    onClose={() => handleEventClose(event.id)}
                  />
                  <Button
                    variant="link"
                    size="sm"
                    onClick={(e) => deleteEventNotification(event.id, e)}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      padding: '2px 5px',
                      color: '#999',
                      fontSize: '12px'
                    }}
                    title="Remove notification"
                  >
                    <FaTimes />
                  </Button>
                </div>
              ))}
            </div>
          )}
          
          {/* Regular Notifications Section */}
          {notifications.length > 0 ? (
            <div>
              <small className="text-muted fw-semibold d-block mb-2">🔔 Updates</small>
              {notifications.map(notif => (
                <div 
                  key={notif.id} 
                  style={{
                    borderBottom: '1px solid #eee',
                    padding: '10px',
                    borderRadius: '4px',
                    backgroundColor: !notif.is_read ? '#f8f9fa' : 'transparent',
                    marginBottom: '5px',
                    position: 'relative'
                  }}
                >
                  <div className="d-flex align-items-start">
                    {getNotificationIcon(notif.type)}
                    <div className="flex-grow-1" style={{ marginRight: '25px' }}>
                      <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>{notif.message}</p>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <small style={{ color: '#999' }}>
                          {formatNotificationTime(notif.created_at)}
                        </small>
                        {!notif.is_read && (
                          <Badge bg="primary" pill style={{ fontSize: '10px' }}>New</Badge>
                        )}
                      </div>
                    </div>
                    
                    {/* Delete Button */}
                    <Button
                      variant="link"
                      size="sm"
                      onClick={(e) => deleteNotification(notif.id, e)}
                      style={{
                        position: 'absolute',
                        top: '5px',
                        right: '5px',
                        padding: '2px 5px',
                        color: '#999',
                        fontSize: '12px'
                      }}
                      title="Delete notification"
                    >
                      <FaTimes />
                    </Button>
                  </div>
                  
                  {/* Mark as read on click (but not when clicking delete) */}
                  {!notif.is_read && (
                    <div 
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        cursor: 'pointer',
                        zIndex: 0
                      }}
                      onClick={() => markAsRead(notif.id)}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            eventNotifications.filter(e => !e.read).length === 0 && 
            pendingCount === 0 && (
              <div style={{ textAlign: 'center', padding: '20px' }}>
                <p style={{ color: '#999', margin: 0 }}>No notifications</p>
              </div>
            )
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;