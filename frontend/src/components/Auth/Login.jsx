// components/Auth/Login.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
  FaUser, 
  FaLock, 
  FaArrowRight,
  FaEnvelope,
  FaExclamationTriangle
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
  Badge
} from 'react-bootstrap';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
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
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Demo credentials helper
  const fillDemoCredentials = (role) => {
    if (role === 'admin') {
      setEmail('admin@ems.com');
      setPassword('admin123');
    } else {
      setEmail('emp_B2B250201@ems.com');
      setPassword('Welcome@123');
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <Container style={{ maxWidth: '450px' }}>
        <Row className="justify-content-center">
          <Col xs={12}>
            <Card className="border-0 shadow-lg overflow-hidden">
              {/* Card Header with Gradient */}
              <Card.Header className="text-center py-4 border-0" style={{
                background: 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
              }}>
                <h1 className="h3 mb-0 text-white fw-semibold">Welcome Back</h1>
                <p className="mb-0 mt-2 text-white-50 small">
                  Employee Management System
                </p>
              </Card.Header>

              {/* Card Body */}
              <Card.Body className="p-4">
                {/* Error Alert */}
                {error && (
                  <Alert 
                    variant="danger" 
                    className="mb-4 py-2 small d-flex align-items-center"
                    dismissible
                    onClose={() => setError('')}
                  >
                    <FaExclamationTriangle className="me-2" size={12} />
                    {error}
                  </Alert>
                )}

                {/* Login Form */}
                <Form onSubmit={handleSubmit}>
                  {/* Email Field */}
                  <Form.Group className="mb-4">
                    <Form.Label className="small fw-semibold text-muted mb-2">
                      <FaEnvelope className="me-2" size={12} />
                      Email Address
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your email"
                        required
                        className="ps-5 py-2"
                        style={{
                          height: '48px',
                          fontSize: '0.95rem',
                          borderRadius: '10px',
                          border: '1.5px solid #e5e7eb'
                        }}
                        disabled={loading}
                      />
                      <FaUser 
                        className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" 
                        size={16}
                      />
                    </div>
                  </Form.Group>

                  {/* Password Field */}
                  <Form.Group className="mb-4">
                    <Form.Label className="small fw-semibold text-muted mb-2">
                      <FaLock className="me-2" size={12} />
                      Password
                    </Form.Label>
                    <div className="position-relative">
                      <Form.Control
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        className="ps-5 py-2"
                        style={{
                          height: '48px',
                          fontSize: '0.95rem',
                          borderRadius: '10px',
                          border: '1.5px solid #e5e7eb'
                        }}
                        disabled={loading}
                      />
                      <FaLock 
                        className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" 
                        size={16}
                      />
                    </div>
                  </Form.Group>

                  {/* Sign In Button */}
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-100 py-2 d-flex align-items-center justify-content-center gap-2 border-0 mb-4"
                    style={{
                      height: '48px',
                      background: 'linear-gradient(135deg, #4158D0 0%, #C850C0 100%)',
                      borderRadius: '10px',
                      fontSize: '1rem',
                      fontWeight: '600',
                      transition: 'all 0.3s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.currentTarget.style.transform = 'translateY(-2px)';
                        e.currentTarget.style.boxShadow = '0 10px 20px rgba(65, 88, 208, 0.3)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    {loading ? (
                      <>
                        <Spinner
                          as="span"
                          animation="border"
                          size="sm"
                          role="status"
                          aria-hidden="true"
                          className="me-2"
                        />
                        Signing in...
                      </>
                    ) : (
                      <>
                        Sign In
                        <FaArrowRight className="ms-2" size={14} />
                      </>
                    )}
                  </Button>
                </Form>
              </Card.Body>
            </Card>

            {/* Footer Note */}
            <p className="text-center mt-4 small text-muted">
              © {new Date().getFullYear()} Employee Management System. All rights reserved.
            </p>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;