import React, { createContext, useState, useContext, useEffect } from 'react';

// Create the authentication context
const AuthContext = createContext(null);

// Authentication provider component
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check if user is already authenticated on mount
// Check if user is already authenticated on mount
useEffect(() => {
    const checkAuthStatus = () => {
      const authStatus = sessionStorage.getItem('isAuthenticated');
      console.log('Auth status from storage:', authStatus);
      setIsAuthenticated(authStatus === 'true');
      setIsLoading(false);
    };
  
    checkAuthStatus();
  }, []);

  // Login function (not needed with hardcoded login, but included for completeness)
  const login = () => {
    sessionStorage.setItem('isAuthenticated', 'true');
    setIsAuthenticated(true);
  };

  // Logout function
  const logout = () => {
    sessionStorage.removeItem('isAuthenticated');
    setIsAuthenticated(false);
  };

  // Provide auth context to children
  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      login,
      logout
    }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;