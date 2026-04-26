import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: UserProfile | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (formData: FormData) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (formData: FormData) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const res = await fetch('/api/auth/me', {
            headers: { Authorization: `Bearer ${token}` }
          });
          if (res.ok) {
            const user = await res.json();
            const profile: UserProfile = {
              uid: user._id,
              email: user.email,
              firstName: user.firstName,
              lastName: user.lastName,
              year: user.year,
              school: user.school,
              enrollmentNumber: user.enrollmentNumber,
              phone: user.phone,
              profilePicture: user.profilePicture
            };
            setCurrentUser(profile);
          } else {
            localStorage.removeItem('token');
          }
        } catch (err) {
          console.error("Failed to load user session", err);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Login failed');
    
    localStorage.setItem('token', data.token);
    
    const profile: UserProfile = {
      uid: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      year: data.user.year,
      school: data.user.school,
      enrollmentNumber: data.user.enrollmentNumber,
      phone: data.user.phone,
      profilePicture: data.user.profilePicture
    };
    setCurrentUser(profile);
  };

  const signup = async (formData: FormData) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      body: formData // Content-Type omitted for FormData boundary
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Signup failed');
    
    localStorage.setItem('token', data.token);
    
    const profile: UserProfile = {
      uid: data.user.id,
      email: data.user.email,
      firstName: data.user.firstName,
      lastName: data.user.lastName,
      year: data.user.year,
      school: data.user.school,
      enrollmentNumber: data.user.enrollmentNumber,
      phone: data.user.phone,
      profilePicture: data.user.profilePicture
    };
    setCurrentUser(profile);
  };

  const logout = async () => {
    localStorage.removeItem('token');
    setCurrentUser(null);
  };

  const updateProfile = async (formData: FormData) => {
    const token = localStorage.getItem('token');
    const res = await fetch('/api/auth/me', {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Update failed');

    const profile: UserProfile = {
      uid: data._id,
      email: data.email,
      firstName: data.firstName,
      lastName: data.lastName,
      year: data.year,
      school: data.school,
      enrollmentNumber: data.enrollmentNumber,
      phone: data.phone,
      profilePicture: data.profilePicture
    };
    setCurrentUser(profile);
  };

  const value = {
    currentUser,
    userProfile: currentUser,
    loading,
    login,
    signup,
    logout,
    updateProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}