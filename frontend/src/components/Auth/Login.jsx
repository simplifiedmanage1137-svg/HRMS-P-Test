// components/Auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import loginBg from '../../assets/login.jpg'
import {
  FaUser, FaLock, FaEye, FaEyeSlash,
  FaExclamationTriangle, FaCheckCircle
} from 'react-icons/fa';
import { Spinner, Modal, Form, Alert, Button } from 'react-bootstrap';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const Login = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword]         = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState('');
  const [loading, setLoading]           = useState(false);

  const [showForgotModal, setShowForgotModal]       = useState(false);
  const [fpEmail, setFpEmail]                       = useState('');
  const [fpNewPassword, setFpNewPassword]           = useState('');
  const [fpConfirmPassword, setFpConfirmPassword]   = useState('');
  const [fpError, setFpError]                       = useState('');
  const [fpSuccess, setFpSuccess]                   = useState('');
  const [fpLoading, setFpLoading]                   = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(identifier, password);
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
    if (!fpEmail)          return setFpError('Please enter your email address.');
    if (!fpNewPassword)    return setFpError('Please enter a new password.');
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
          setShowForgotModal(false);
          setFpEmail(''); setFpSuccess('');
          setEmail(fpEmail);
        }, 2000);
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password.');
    } finally {
      setFpLoading(false);
    }
  };

  const inputStyle = {
    height: '48px',
    fontSize: '14px',
    borderRadius: '12px',
    border: '1.5px solid #CBD5E1',
    paddingLeft: '44px',
    paddingRight: '44px',
    color: '#334155',
    background: '#FFFFFF',
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.15s',
    fontFamily: 'inherit',
  };

  return (
    <>
      {/* ── Full-page wrapper ── */}
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        fontFamily: "'Inter', -apple-system, sans-serif",
        position: 'relative',
      }}>

        {/* ── Background image ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `url(${loginBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }} />

        {/* ── Dark overlay for readability ── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15, 23, 42, 0.52)',
          zIndex: 1,
        }} />

        {/* ── Logo top-left ── */}
        <div style={{
          position: 'absolute',
          top: '22px',
          left: '26px',
          zIndex: 3,
          display: 'flex',
          alignItems: 'center',
        }}>
          
        </div>

        {/* ── Login card ── */}
        <div style={{
          position: 'relative',
          zIndex: 2,
          background: '#FFFFFF',
          borderRadius: '24px',
          padding: '44px 38px',
          width: '100%',
          maxWidth: '415px',
          boxShadow: '0 25px 50px rgba(0,0,0,0.35)',
          textAlign: 'center',
          margin: '16px',
          border: '1px solid rgba(255,255,255,0.85)',
        }}>

          {/* Avatar badge */}
          <div style={{
            width: '60px', height: '60px', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <img
            src="/images/b2b_logo.png"
            alt="Logo"
            style={{ height: '40px', width: 'auto', objectFit: 'contain', filter: 'brightness(1.15)' }}
          />
          </div>

          <h2 style={{
            fontSize: '24px', fontWeight: '700', color: '#0F172A',
            marginBottom: '6px', letterSpacing: '-0.5px',
          }}>
            
          </h2>
          <p style={{ fontSize: '13px', color: '#292a2b', marginBottom: '28px', fontWeight: '700' }}>
            Employee Management System
          </p>

          {/* Error alert */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FEE2E2',
              borderRadius: '10px', padding: '10px 14px', marginBottom: '16px',
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '13px', color: '#991B1B', textAlign: 'left',
            }}>
              <FaExclamationTriangle size={12} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Employee ID or Email */}
            <div style={{ marginBottom: '16px', position: 'relative' }}>
              <FaUser style={{
                position: 'absolute', left: '16px', top: '50%',
                transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
              }} />
              <input
                type="text" value={identifier} required disabled={loading}
                onChange={e => setIdentifier(e.target.value)}
                placeholder="Employee ID or Email address"
                autoComplete="username"
                style={inputStyle}
                onFocus={e  => e.target.style.borderColor = '#2563EB'}
                onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
              />
            </div>

            {/* Password */}
            <div style={{ marginBottom: '12px', position: 'relative' }}>
              <FaLock style={{
                position: 'absolute', left: '16px', top: '50%',
                transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '14px', zIndex: 1,
              }} />
              <input
                type={showPassword ? 'text' : 'password'} value={password} required disabled={loading}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password"
                style={inputStyle}
                onFocus={e  => e.target.style.borderColor = '#2563EB'}
                onBlur={e   => e.target.style.borderColor = '#CBD5E1'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                style={{
                  position: 'absolute', right: '16px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 0,
                }}
              >
                {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
              </button>
            </div>

            {/* Forgot password */}
            <div style={{ textAlign: 'right', marginBottom: '24px' }}>
              <button
                type="button"
                onClick={() => { setShowForgotModal(true); setFpEmail(identifier.includes('@') ? identifier : ''); setFpError(''); setFpSuccess(''); }}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '12px', color: '#2563EB', fontWeight: '600',
                }}
              >
                Forgot password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              style={{
                width: '100%', height: '48px', borderRadius: '12px',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                border: 'none', color: 'white', fontSize: '15px', fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
            >
              {loading
                ? <><Spinner as="span" animation="border" size="sm" /> Signing in...</>
                : 'Continue'
              }
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '24px 0 16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
            <span style={{ fontSize: '11px', fontWeight: '600', color: '#94A3B8' }}>OR</span>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
          </div>
          <p style={{ fontSize: '12px', fontWeight: '500', color: '#94A3B8', margin: 0 }}>
            Secure sign-in · Role-based access
          </p>
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      <Modal show={showForgotModal} onHide={() => setShowForgotModal(false)} centered>
        <Modal.Header closeButton style={{ borderBottom: '1px solid #E2E8F0', padding: '20px 24px' }}>
          <Modal.Title style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A' }}>
            <FaLock className="me-2" size={13} style={{ color: '#2563EB' }} />
            Set New Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: '24px' }}>
          {fpError   && <Alert variant="danger"  dismissible onClose={() => setFpError('')}  style={{ fontSize: '13px', borderRadius: '8px' }}><FaExclamationTriangle className="me-2" size={12} />{fpError}</Alert>}
          {fpSuccess && <Alert variant="success" style={{ fontSize: '13px', borderRadius: '8px' }}><FaCheckCircle className="me-2" size={12} />{fpSuccess}</Alert>}
          <Form onSubmit={handleForgotPassword}>
            {[
              { label: 'Email Address',    type: 'email',    value: fpEmail,           onChange: setFpEmail,           placeholder: 'Enter your registered email' },
              { label: 'New Password',     type: 'password', value: fpNewPassword,     onChange: setFpNewPassword,     placeholder: 'Min 6 characters' },
              { label: 'Confirm Password', type: 'password', value: fpConfirmPassword, onChange: setFpConfirmPassword, placeholder: 'Confirm new password' },
            ].map(({ label, type, value, onChange, placeholder }) => (
              <Form.Group className="mb-3" key={label}>
                <Form.Label style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>{label}</Form.Label>
                <Form.Control
                  type={type} value={value} required
                  onChange={e => onChange(e.target.value)}
                  placeholder={placeholder}
                  style={{ height: '44px', fontSize: '13px', borderRadius: '10px', border: '1.5px solid #E2E8F0' }}
                />
              </Form.Group>
            ))}
            <Button
              type="submit" disabled={fpLoading}
              style={{
                width: '100%', height: '44px',
                background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                border: 'none', borderRadius: '10px',
                fontSize: '14px', fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              {fpLoading ? <><Spinner as="span" animation="border" size="sm" /> Setting...</> : 'Set Password'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default Login;
