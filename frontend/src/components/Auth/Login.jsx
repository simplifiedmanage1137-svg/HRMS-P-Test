// components/Auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FaUser, 
  FaLock, 
  FaArrowRight,
  FaEnvelope,
  FaExclamationTriangle,
  FaCheckCircle
} from 'react-icons/fa';
import { 
  Card, 
  Form, 
  Button, 
  Alert, 
  Container, 
  Row, 
  Col,
  Spinner,
  Modal
} from 'react-bootstrap';
import axios from '../../config/axios';
import API_ENDPOINTS from '../../config/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot password states
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
        if (result.user.role === 'admin') {
          navigate('/admin/dashboard');
        } else {
          navigate('/employee/dashboard');
        }
      } else {
        setError(result.message || 'Login failed. Please try again.');
      }
    } catch (err) {
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setFpError('');
    setFpSuccess('');

    if (!fpEmail) return setFpError('Please enter your email address.');
    if (!fpNewPassword) return setFpError('Please enter a new password.');
    if (fpNewPassword.length < 6) return setFpError('Password must be at least 6 characters.');
    if (fpNewPassword !== fpConfirmPassword) return setFpError('Passwords do not match.');

    setFpLoading(true);
    try {
      const response = await axios.post(API_ENDPOINTS.PASSWORD_RESET_DIRECT, {
        email: fpEmail,
        newPassword: fpNewPassword
      });
      if (response.data.success) {
        setFpSuccess(response.data.message);
        setFpNewPassword('');
        setFpConfirmPassword('');
        setTimeout(() => {
          setShowForgotModal(false);
          setFpEmail('');
          setFpSuccess('');
          setEmail(fpEmail);
        }, 2000);
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light p-2 p-sm-3 p-md-4">
      <Container style={{ maxWidth: '450px' }} className="px-0 px-sm-2">
        <Row className="justify-content-center g-0">
          <Col xs={12}>
            <Card className="border-0 shadow-lg overflow-hidden">
              <Card.Header className="text-center py-3 py-sm-4 border-0" style={{
                background: 'linear-gradient(135deg, #e6e4f0, #f2d9cc)',
              }}>
                <h1 className="h4 h3-sm mb-0 fw-semibold" style={{ color: '#3d2c5e' }}>Welcome Back</h1>
                <p className="mb-0 mt-2 small px-2 px-sm-0" style={{ color: '#7a6a9a' }}>
                  Employee Management System
                </p>
              </Card.Header>

              <Card.Body className="p-3 p-sm-4">
                {error && (
                  <Alert variant="danger" className="mb-4 py-2 small d-flex align-items-center" dismissible onClose={() => setError('')}>
                    <FaExclamationTriangle className="me-2 flex-shrink-0" size={12} />
                    <span className="text-wrap">{error}</span>
                  </Alert>
                )}

                <Form onSubmit={handleSubmit}>
                  <Form.Group className="mb-4">
                    <Form.Label className="small fw-semibold text-muted mb-2 d-flex align-items-center">
                      <FaEnvelope className="me-2" size={12} />Email Address
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email" required className="ps-5 py-2"
                        style={{ height: '48px', fontSize: '0.95rem', borderRadius: '10px', border: '1.5px solid #e5e7eb' }}
                        disabled={loading}
                      />
                      <FaUser className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={16} />
                    </div>
                  </Form.Group>

                  <Form.Group className="mb-2">
                    <Form.Label className="small fw-semibold text-muted mb-2 d-flex align-items-center">
                      <FaLock className="me-2" size={12} />Password
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password" required className="ps-5 py-2"
                        style={{ height: '48px', fontSize: '0.95rem', borderRadius: '10px', border: '1.5px solid #e5e7eb' }}
                        disabled={loading}
                      />
                      <FaLock className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" size={16} />
                    </div>
                  </Form.Group>

                  {/* Forgot Password Link */}
                  <div className="text-end mb-4">
                    <button
                      type="button"
                      className="btn btn-link btn-sm p-0 text-decoration-none"
                      style={{ color: '#7a6a9a', fontSize: '0.85rem' }}
                      onClick={() => { setShowForgotModal(true); setFpEmail(email); setFpError(''); setFpSuccess(''); }}
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <Button
                    type="submit" disabled={loading}
                    className="w-100 py-2 d-flex align-items-center justify-content-center gap-2 border-0 mb-4"
                    style={{
                      height: '48px', background: 'linear-gradient(135deg, #e6e4f0, #f2d9cc)',
                      color: '#3d2c5e', borderRadius: '10px', fontSize: '1rem', fontWeight: '600'
                    }}
                  >
                    {loading ? (
                      <><Spinner as="span" animation="border" size="sm" className="me-2" />Signing in...</>
                    ) : (
                      <>Sign In <FaArrowRight className="ms-2" size={14} /></>
                    )}
                  </Button>
                </Form>
              </Card.Body>
            </Card>

            <p className="text-center mt-4 small text-muted">
              © {new Date().getFullYear()} Employee Management System. All rights reserved.
            </p>
          </Col>
        </Row>
      </Container>

      {/* Forgot Password Modal */}
      <Modal show={showForgotModal} onHide={() => setShowForgotModal(false)} centered>
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #e6e4f0, #f2d9cc)' }}>
          <Modal.Title className="h6 fw-semibold" style={{ color: '#3d2c5e' }}>
            <FaLock className="me-2" size={14} />Set New Password
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {fpError && (
            <Alert variant="danger" className="py-2 small" dismissible onClose={() => setFpError('')}>
              <FaExclamationTriangle className="me-2" size={12} />{fpError}
            </Alert>
          )}
          {fpSuccess && (
            <Alert variant="success" className="py-2 small">
              <FaCheckCircle className="me-2" size={12} />{fpSuccess}
            </Alert>
          )}
          <Form onSubmit={handleForgotPassword}>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold text-muted">
                <FaEnvelope className="me-1" size={11} />Email Address
              </Form.Label>
              <Form.Control
                type="email" value={fpEmail} onChange={(e) => setFpEmail(e.target.value)}
                placeholder="Enter your registered email" required
                style={{ borderRadius: '8px', border: '1.5px solid #e5e7eb' }}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label className="small fw-semibold text-muted">
                <FaLock className="me-1" size={11} />New Password
              </Form.Label>
              <Form.Control
                type="password" value={fpNewPassword} onChange={(e) => setFpNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)" required
                style={{ borderRadius: '8px', border: '1.5px solid #e5e7eb' }}
              />
            </Form.Group>
            <Form.Group className="mb-4">
              <Form.Label className="small fw-semibold text-muted">
                <FaLock className="me-1" size={11} />Confirm Password
              </Form.Label>
              <Form.Control
                type="password" value={fpConfirmPassword} onChange={(e) => setFpConfirmPassword(e.target.value)}
                placeholder="Confirm new password" required
                style={{ borderRadius: '8px', border: '1.5px solid #e5e7eb' }}
              />
            </Form.Group>
            <Button
              type="submit" disabled={fpLoading} className="w-100 border-0"
              style={{
                height: '44px', background: 'linear-gradient(135deg, #e6e4f0, #f2d9cc)',
                color: '#3d2c5e', borderRadius: '8px', fontWeight: '600'
              }}
            >
              {fpLoading ? (
                <><Spinner as="span" animation="border" size="sm" className="me-2" />Setting Password...</>
              ) : 'Set Password'}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default Login;