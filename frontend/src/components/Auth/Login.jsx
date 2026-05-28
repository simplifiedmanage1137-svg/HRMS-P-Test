// components/Auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  FaEnvelope, FaLock, FaEye, FaEyeSlash,
  FaExclamationTriangle, FaCheckCircle,
  FaUsers, FaChartBar, FaCalendarCheck, FaUserCheck, FaClock, FaArrowRight
} from 'react-icons/fa';
import { Spinner, Modal, Form, Alert, Button } from 'react-bootstrap';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

// ---- Workflow Diagram (SVG-based illustration) ----
const WorkflowIllustration = () => (
  <div style={{ position: 'relative', width: '100%', maxWidth: '480px', margin: '0 auto' }}>
    {/* Center card */}
    <div style={{
      position: 'relative', display: 'flex', justifyContent: 'center',
      alignItems: 'center', marginBottom: '16px'
    }}>
      {/* Dashed circle */}
      <svg width="320" height="220" viewBox="0 0 320 220" style={{ position: 'absolute' }}>
        <circle cx="160" cy="110" r="90" fill="none" stroke="#CBD5E0" strokeWidth="1.5" strokeDasharray="6 4" />
        {/* Dots on circle */}
        {[0, 60, 120, 180, 240, 300].map((deg, i) => {
          const rad = (deg * Math.PI) / 180;
          const x = 160 + 90 * Math.cos(rad);
          const y = 110 + 90 * Math.sin(rad);
          return <circle key={i} cx={x} cy={y} r="4" fill={i % 2 === 0 ? '#00A4BD' : '#E2E8F0'} />;
        })}
      </svg>

      {/* Center white card */}
      <div style={{
        background: 'white', borderRadius: '12px', padding: '16px 20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)', textAlign: 'center',
        zIndex: 2, minWidth: '140px'
      }}>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#4A5568', letterSpacing: '0.5px', marginBottom: '4px' }}>
          ATTENDANCE
        </div>
        <div style={{ fontSize: '10px', fontWeight: '700', color: '#4A5568', letterSpacing: '0.5px' }}>
          MANAGEMENT
        </div>
        <div style={{ width: '24px', height: '2px', background: '#00A4BD', margin: '6px auto 0' }} />
      </div>

      {/* Floating icon circles */}
      {[
        { icon: <FaUsers size={14} />, color: '#00A4BD', bg: '#E6F7FA', top: '10px', left: '30px' },
        { icon: <FaCalendarCheck size={14} />, color: '#805AD5', bg: '#FAF5FF', top: '10px', right: '30px' },
        { icon: <FaChartBar size={14} />, color: '#00A4BD', bg: '#E6F7FA', bottom: '10px', left: '60px' },
        { icon: <FaUserCheck size={14} />, color: '#805AD5', bg: '#FAF5FF', bottom: '10px', right: '60px' },
        { icon: <FaClock size={14} />, color: '#38A169', bg: '#F0FFF4', top: '50%', left: '10px', transform: 'translateY(-50%)' },
      ].map((item, i) => (
        <div key={i} style={{
          position: 'absolute', width: '36px', height: '36px', borderRadius: '50%',
          background: item.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: item.color, boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 3,
          top: item.top, left: item.left, right: item.right, bottom: item.bottom,
          transform: item.transform
        }}>
          {item.icon}
        </div>
      ))}
    </div>

    {/* Bottom feature cards */}
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
      {[
        { title: 'Clock In/Out', desc: 'Track daily attendance with geo-fencing support.' },
        { title: 'Leave Management', desc: 'Apply and manage leaves with balance tracking.' },
        { title: 'Salary Slips', desc: 'View and download monthly salary slips easily.' },
        { title: 'Team Reports', desc: 'Managers can view team attendance reports.' },
        { title: 'Notifications', desc: 'Get real-time alerts for approvals and updates.' },
      ].map((card, i) => (
        <div key={i} style={{
          background: 'white', borderRadius: '8px', padding: '10px 12px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)', width: '120px',
          borderTop: `2px solid ${i % 2 === 0 ? '#00A4BD' : '#805AD5'}`
        }}>
          <div style={{ fontSize: '10px', fontWeight: '700', color: '#2D3748', marginBottom: '4px' }}>
            {card.title}
          </div>
          <div style={{ fontSize: '9px', color: '#718096', lineHeight: 1.4 }}>
            {card.desc}
          </div>
        </div>
      ))}
    </div>
  </div>
);

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [showForgotModal, setShowForgotModal] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [fpLoading, setFpLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (result.success) {
        navigate(result.user.role === 'admin' ? '/admin/dashboard' : '/employee/dashboard');
      } else {
        setError(result.message || 'Login failed. Please try again.');
      }
    } catch {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setFpError(''); setFpSuccess('');
    if (!fpEmail) return setFpError('Please enter your email address.');
    if (!fpNewPassword) return setFpError('Please enter a new password.');
    if (fpNewPassword.length < 6) return setFpError('Password must be at least 6 characters.');
    if (fpNewPassword !== fpConfirmPassword) return setFpError('Passwords do not match.');
    setFpLoading(true);
    try {
      const res = await axios.post(API_ENDPOINTS.PASSWORD_RESET_DIRECT, {
        email: fpEmail, newPassword: fpNewPassword
      });
      if (res.data.success) {
        setFpSuccess(res.data.message);
        setFpNewPassword(''); setFpConfirmPassword('');
        setTimeout(() => {
          setShowForgotModal(false); setFpEmail(''); setFpSuccess(''); setEmail(fpEmail);
        }, 2000);
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setFpLoading(false);
    }
  };

  const inputStyle = {
    height: '46px', fontSize: '14px', borderRadius: '8px',
    border: '1.5px solid #E2E8F0', paddingLeft: '42px',
    paddingRight: '42px', color: '#2D3748', background: 'white',
    outline: 'none', width: '100%', transition: 'border-color 0.2s'
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', overflow: 'hidden',
      background: '#F7F8FA', fontFamily: "'Inter', -apple-system, sans-serif"
    }}>
      {/* ---- LEFT PANEL ---- */}
      <div style={{
        flex: '0 0 55%', width: '55%', display: 'flex', flexDirection: 'column',
        padding: '24px 40px', background: '#F7F8FA',
        position: 'relative', overflow: 'hidden'
      }}>
        {/* Decorative dots */}
        <div style={{ position: 'absolute', top: '60px', left: '50%', width: '6px', height: '6px', borderRadius: '50%', background: '#FC8181' }} />
        <div style={{ position: 'absolute', top: '14px', right: '30%', width: '6px', height: '6px', borderRadius: '50%', background: '#FC8181' }} />

        {/* Top label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#38A169' }} />
          <span style={{ fontSize: '13px', fontWeight: '600', color: '#4A5568', letterSpacing: '0.5px' }}>
            EMS
          </span>
        </div>

        {/* Heading */}
        <div style={{ maxWidth: '480px', marginBottom: '20px' }}>
          <h1 style={{
            fontSize: '30px', fontWeight: '800', color: '#1A202C',
            lineHeight: 1.2, marginBottom: '12px', letterSpacing: '-0.5px'
          }}>
            Manage your team,<br />effortlessly.
          </h1>
          <p style={{ fontSize: '14px', color: '#718096', lineHeight: 1.6, margin: 0 }}>
            Track attendance, manage leaves, and handle payroll
            from one unified platform built for modern teams.
          </p>
        </div>

        {/* Illustration */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          <img
            src="/images/login_image.png"
            alt="HRMS Workflow"
            style={{
              width: '100%',
              maxWidth: '400px',
              maxHeight: 'calc(100vh - 220px)',
              objectFit: 'contain'
            }}
          />
        </div>

        {/* Bottom text */}
        <div style={{ paddingTop: '12px' }}>
          <span style={{ fontSize: '12px', color: '#A0AEC0' }}>
            Secure authentication · Role-based access
          </span>
        </div>
      </div>

      {/* ---- RIGHT PANEL ---- */}
      <div style={{
        flex: '0 0 45%', width: '45%',
        display: 'flex', flexDirection: 'column',
        background: '#F0F2F5',
        padding: '0',
      }}>
        {/* Top logo area */}
        <div style={{
          padding: '32px 40px 0', display: 'flex',
          justifyContent: 'flex-end', alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '8px',
              background: '#2D3748', display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: 'white', fontWeight: '800', fontSize: '14px'
            }}>
              E
            </div>
            <span style={{ fontWeight: '800', fontSize: '18px', color: '#1A202C', letterSpacing: '-0.5px' }}>
              EMS
            </span>
          </div>
        </div>

        {/* Form card */}
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center',
          justifyContent: 'center', padding: '32px 40px'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px',
            padding: '32px 28px', width: '100%', maxWidth: '450px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            border: '1px solid #E2E8F0'
          }}>
            {/* Title */}
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#1A202C', marginBottom: '6px' }}>
              Sign in
            </h2>
            <p style={{ fontSize: '14px', color: '#718096', marginBottom: '28px' }}>
              Enter your credentials to continue
            </p>

            {error && (
              <div style={{
                background: '#FFF5F5', border: '1px solid #FED7D7', borderRadius: '8px',
                padding: '10px 14px', marginBottom: '20px', display: 'flex',
                alignItems: 'center', gap: '8px', fontSize: '13px', color: '#C53030'
              }}>
                <FaExclamationTriangle size={12} />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#2D3748', marginBottom: '8px' }}>
                  Email
                </label>
                <div style={{ position: 'relative' }}>
                  <FaEnvelope style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', color: '#A0AEC0', fontSize: '14px', zIndex: 1
                  }} />
                  <input
                    type="email" value={email} required disabled={loading}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#00A4BD'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#2D3748', marginBottom: '8px' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <FaLock style={{
                    position: 'absolute', left: '14px', top: '50%',
                    transform: 'translateY(-50%)', color: '#A0AEC0', fontSize: '14px', zIndex: 1
                  }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password} required disabled={loading}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    style={inputStyle}
                    onFocus={(e) => e.target.style.borderColor = '#00A4BD'}
                    onBlur={(e) => e.target.style.borderColor = '#E2E8F0'}
                  />
                  <button
                    type="button"
                    onMouseDown={() => setShowPassword(true)}
                    onMouseUp={() => setShowPassword(false)}
                    onMouseLeave={() => setShowPassword(false)}
                    onTouchStart={() => setShowPassword(true)}
                    onTouchEnd={() => setShowPassword(false)}
                    style={{
                      position: 'absolute', right: '14px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: '#A0AEC0',
                      padding: 0, userSelect: 'none'
                    }}
                  >
                    {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
                  </button>
                </div>
              </div>

              {/* Forgot password */}
              <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                <button
                  type="button"
                  onClick={() => { setShowForgotModal(true); setFpEmail(email); setFpError(''); setFpSuccess(''); }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '13px', color: '#00A4BD', fontWeight: '500'
                  }}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit button */}
              <button
                type="submit" disabled={loading}
                style={{
                  width: '80%', height: '44px', borderRadius: '8px',
                  display: 'block', margin: '0 auto',
                  background: loading ? '#718096' : '#4A5568',
                  border: 'none', color: 'white', fontSize: '15px',
                  fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '8px', transition: 'background 0.2s ease',
                  letterSpacing: '0.3px'
                }}
                onMouseEnter={(e) => { if (!loading) e.target.style.background = '#2D3748'; }}
                onMouseLeave={(e) => { if (!loading) e.target.style.background = '#4A5568'; }}
              >
                {loading ? (
                  <><Spinner as="span" animation="border" size="sm" /> Signing in...</>
                ) : 'Sign in'}
              </button>
            </form>

            {/* Bottom note */}
            <p style={{
              textAlign: 'center', marginTop: '20px', marginBottom: 0,
              fontSize: '12px', color: '#A0AEC0', lineHeight: 1.6
            }}>
              Enterprise-grade sign-in · Role-based workspace access
            </p>
          </div>
        </div>
      </div>

      {/* ---- FORGOT PASSWORD MODAL ---- */}
      <Modal show={showForgotModal} onHide={() => setShowForgotModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '1px solid #E2E8F0', padding: '20px 24px' }}>
          <Modal.Title style={{ fontSize: '16px', fontWeight: '700', color: '#1A202C' }}>
            <FaLock className="me-2" size={13} style={{ color: '#00A4BD' }} />
            Set New Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          {fpError && (
            <Alert variant="danger" dismissible onClose={() => setFpError('')}
              style={{ fontSize: '13px', borderRadius: '8px', padding: '10px 14px' }}>
              <FaExclamationTriangle className="me-2" size={12} />{fpError}
            </Alert>
          )}
          {fpSuccess && (
            <Alert variant="success" style={{ fontSize: '13px', borderRadius: '8px', padding: '10px 14px' }}>
              <FaCheckCircle className="me-2" size={12} />{fpSuccess}
            </Alert>
          )}
          <Form onSubmit={handleForgotPassword}>
            {[
              { label: 'Email Address', type: 'email', value: fpEmail, onChange: setFpEmail, placeholder: 'Enter your registered email' },
              { label: 'New Password', type: 'password', value: fpNewPassword, onChange: setFpNewPassword, placeholder: 'Min 6 characters' },
              { label: 'Confirm Password', type: 'password', value: fpConfirmPassword, onChange: setFpConfirmPassword, placeholder: 'Confirm new password' },
            ].map(({ label, type, value, onChange, placeholder }) => (
              <Form.Group className="mb-3" key={label}>
                <Form.Label style={{ fontSize: '13px', fontWeight: '600', color: '#4A5568' }}>{label}</Form.Label>
                <Form.Control
                  type={type} value={value} required
                  onChange={(e) => onChange(e.target.value)}
                  placeholder={placeholder}
                  style={{ height: '42px', fontSize: '13px', borderRadius: '8px', border: '1.5px solid #E2E8F0' }}
                />
              </Form.Group>
            ))}
            <Button
              type="submit" disabled={fpLoading}
              style={{
                width: '100%', height: '42px', background: '#4A5568',
                border: 'none', borderRadius: '8px', fontSize: '14px',
                fontWeight: '600', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: '8px'
              }}
            >
              {fpLoading
                ? <><Spinner as="span" animation="border" size="sm" /> Setting...</>
                : 'Set Password'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Login;
