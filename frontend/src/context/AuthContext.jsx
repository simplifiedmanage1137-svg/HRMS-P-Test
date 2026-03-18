// src/context/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import API_ENDPOINTS from '../config/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Check for saved user and token in localStorage
        const savedUser = localStorage.getItem('user');
        const savedToken = localStorage.getItem('token');
        
        if (savedUser && savedToken) {
            setUser(JSON.parse(savedUser));
            setToken(savedToken);
            // Set default axios header
            axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`;
        }
        setLoading(false);
        
        // Log the API endpoint being used
        console.log('🔧 Auth API Endpoint:', API_ENDPOINTS.LOGIN);
    }, []);

    const login = async (email, password) => {
        try {
            console.log('📤 Attempting login with:', { email });
            console.log('📤 Using API endpoint:', API_ENDPOINTS.LOGIN);
            
            const response = await axios.post(API_ENDPOINTS.LOGIN, {
                email,
                password
            }, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            console.log('✅ Login response:', response.data);

            if (response.data.success) {
                const userData = response.data.user;
                const token = response.data.token;
                
                setUser(userData);
                setToken(token);
                
                // Save to localStorage
                localStorage.setItem('user', JSON.stringify(userData));
                localStorage.setItem('token', token);
                
                // Set default axios header for future requests
                axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                
                return { 
                    success: true, 
                    user: userData 
                };
            } else {
                return { 
                    success: false, 
                    message: response.data.message || 'Login failed' 
                };
            }

        } catch (error) {
            console.error('❌ Login error:', error);
            console.error('❌ Login error details:', error.response?.data);
            console.error('❌ Error config:', error.config); // This will show the URL it tried to hit
            
            return { 
                success: false, 
                message: error.response?.data?.message || 'Login failed. Please try again.' 
            };
        }
    };

    const logout = () => {
        setUser(null);
        setToken(null);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        delete axios.defaults.headers.common['Authorization'];
    };

    const value = {
        user,
        token,
        loading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};