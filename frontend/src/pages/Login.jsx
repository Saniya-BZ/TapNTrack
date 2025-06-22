import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faEnvelope, 
  faLock, 
  faExclamationTriangle, 
  faSpinner, 
  faRightToBracket, 
  faEye, 
  faEyeSlash,
  faHotel
} from '@fortawesome/free-solid-svg-icons';
import '../styles/Login.css';
import api from '../services/api';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const navigate = useNavigate();
  
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate inputs
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    try {
      console.log('Attempting login with:', { email, password: '******' });
      console.log('API endpoint: /login');
      
      // Use the api service for login
      const response = await api.login(email, password);
      
      console.log('Login response:', response.data);
      
      if (response.data && response.data.token) {
        console.log('Authentication successful, setting storage...');
        
        // Store auth data in sessionStorage instead of localStorage
        sessionStorage.setItem('isAuthenticated', 'true');
        sessionStorage.setItem('token', response.data.token);
        sessionStorage.setItem('userRole', response.data.user.role);
        sessionStorage.setItem('userEmail', response.data.user.email);
        
        console.log('Storage updated, checking values:');
        console.log('isAuthenticated:', sessionStorage.getItem('isAuthenticated'));
        console.log('token:', sessionStorage.getItem('token'));
        console.log('userRole:', sessionStorage.getItem('userRole'));
        console.log('userEmail:', sessionStorage.getItem('userEmail'));
        
        console.log('Navigating to dashboard...');
        navigate('/dashboard');
      } else {
        setError('Authentication failed. No token received.');
      }
    } catch (err) {
      console.error('Login error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setError(err.response?.data?.error || 'Login failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="login-container">
      <div className="login-card">
        {/* Left side with logo */}
        <div className="login-logo-container">
          <div className="logo-content">

<div className="logo">
  <FontAwesomeIcon icon={faHotel} className="hotel-icon" />
</div>

            <h1 className="company-name">
              TapNTrack
            </h1>
            <p className="company-tagline">Track</p>
          </div>
        </div>
        
        {/* Right side with login form */}
        <div className="login-form-container">
          <div className="login-form-content">
            <h2 className="login-title">Admin Login</h2>
            <p className="login-subtitle">Access the dashboard with your credentials</p>
            
            {error && (
              <div className="login-error">
                <FontAwesomeIcon icon={faExclamationTriangle} className="error-icon" />
                <span>{error}</span>
              </div>
            )}
            
            <form onSubmit={handleSubmit} className="login-form">
              <div className="form-group">
                <label htmlFor="email">Email Address</label>
                <div className="input-with-icon">
                  <FontAwesomeIcon icon={faEnvelope} className="input-icon" />
                  <input
                    type="text"
                    id="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="password">Password</label>
                <div className="input-with-icon">
                  <FontAwesomeIcon icon={faLock} className="input-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                  <button 
                    type="button"
                    className="password-toggle-btn"
                    onClick={togglePasswordVisibility}
                    tabIndex="-1"
                  >
                    <FontAwesomeIcon 
                      icon={showPassword ? faEyeSlash : faEye} 
                      className="password-toggle-icon" 
                    />
                  </button>
                </div>
              </div>
              
              <button
                type="submit"
                className="login-button"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin className="button-icon" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faRightToBracket} className="button-icon" />
                    Sign In
                  </>
                )}
              </button>
            </form>
            
            <div className="login-help">
              {/* <p>Use the credentials provided by your administrator</p> */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

