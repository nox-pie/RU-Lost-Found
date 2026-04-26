import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { School } from '../types';
import { Upload, CheckCircle, Loader } from 'lucide-react';

const SCHOOLS: School[] = [
  'Newton School of Technology',
  'School of Entrepreneurship',
  'School of Psychology & Education',
  'School of Creativity',
  'School of Healthcare',
  'School of Public Leadership'
];

type AuthMode = 'login' | 'signup' | 'forgot-password' | 'reset-password';

export default function Login() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [year, setYear] = useState('');
  const [school, setSchool] = useState<School>(SCHOOLS[0]);
  const [enrollmentNumber, setEnrollmentNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [profilePicture, setProfilePicture] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  // Forgot Password fields
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // Email Verification fields
  const [signupOtp, setSignupOtp] = useState('');
  const [emailVerified, setEmailVerified] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [showOtpInput, setShowOtpInput] = useState(false);

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);
  
  const { login, signup } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      setProfilePicture(file);
      const reader = new FileReader();
      reader.onload = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSendSignupOtp = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }
    try {
      setError('');
      setVerifyingEmail(true);
      const res = await fetch('/api/auth/send-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setSuccessMsg('Verification code sent! Check your email inbox.');
      setShowOtpInput(true);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleVerifyOtp = () => {
    if (!signupOtp || signupOtp.length !== 6) {
      setError('Please enter the 6-digit code from your email');
      return;
    }
    setError('');
    setEmailVerified(true);
    setSuccessMsg('Email verified! Complete the form below to create your account.');
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setSuccessMsg('OTP sent to your email! Please check your inbox.');
      setMode('reset-password');
    } catch (err: any) {
      setError(err.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setLoading(true);
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp, newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      setSuccessMsg('Password reset successful! You can now log in.');
      setMode('login');
      setPassword('');
      setOtp('');
      setNewPassword('');
    } catch (err: any) {
      setError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode);
    setError('');
    setSuccessMsg('');
    setEmailVerified(false);
    setShowOtpInput(false);
    setSignupOtp('');
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    try {
      setError('');
      setLoading(true);
      
      if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else if (mode === 'signup') {
        if (!emailVerified) {
          setError('Please verify your email address before signing up.');
          setLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('email', email);
        formData.append('password', password);
        formData.append('firstName', firstName);
        formData.append('lastName', lastName);
        formData.append('year', year);
        formData.append('school', school);
        formData.append('enrollmentNumber', enrollmentNumber);
        formData.append('phone', phone);
        formData.append('signupOtp', signupOtp);
        if (profilePicture) {
          formData.append('profilePicture', profilePicture);
        }
        
        await signup(formData);
        navigate('/');
      }
    } catch (err: any) {
      setError(err.message || (mode === 'login' ? 'Failed to sign in' : 'Failed to create account'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      {/* University background image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/university-bg.png')" }}
      />
      {/* Background image overlay removed */}
      <div className="relative z-10 flex flex-col items-center mb-8">
        <img
          src="/rishihood-logo.png"
          alt="Rishihood University"
          className="w-[220px] object-contain mb-6 border-2 border-orange-500 rounded-lg p-3 shadow-md bg-white hover:shadow-lg transition-all duration-300"
        />
      </div>
      <div className="relative z-10 max-w-md w-full space-y-8 bg-gradient-to-br from-[#fcf1e8]/95 to-[#fceadc]/95 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-white/50">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            {mode === 'login' && 'Sign in to RU Lost & Found'}
            {mode === 'signup' && 'Create an Account'}
            {mode === 'forgot-password' && 'Reset Password'}
            {mode === 'reset-password' && 'Enter OTP'}
          </h2>
        </div>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}
        
        {successMsg && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative" role="alert">
            <span className="block sm:inline">{successMsg}</span>
          </div>
        )}

        {/* FORGOT PASSWORD FORM */}
        {mode === 'forgot-password' && (
          <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label htmlFor="email-reset" className="block text-sm font-medium text-gray-700">Email address</label>
                <input
                  id="email-reset" type="email" required value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Enter your registered email"
                />
              </div>
            </div>
            <div>
              <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light">
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </div>
            <div className="text-center">
              <button type="button" onClick={() => switchMode('login')} className="text-primary hover:text-primary-light text-sm font-medium">Back to Sign In</button>
            </div>
          </form>
        )}

        {/* RESET PASSWORD OTP FORM */}
        {mode === 'reset-password' && (
          <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
            <div className="rounded-md shadow-sm space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">6-Digit OTP</label>
                <input
                  type="text" required value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="123456"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">New Password</label>
                <input
                  type="password" required value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm"
                  placeholder="Enter new password"
                />
              </div>
            </div>
            <div>
              <button type="submit" disabled={loading} className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary-light">
                {loading ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </form>
        )}

        {/* LOGIN AND SIGNUP FORM */}
        {(mode === 'login' || mode === 'signup') && (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div className="rounded-md shadow-sm space-y-4">
              
              {/* Profile Picture Upload (Signup Only) */}
              {mode === 'signup' && emailVerified && (
                <div className="flex flex-col items-center mb-6">
                  <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {previewUrl ? (
                      <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-primary">
                        <img src={previewUrl} alt="Profile" className="h-full w-full object-cover" />
                      </div>
                    ) : (
                      <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center border-2 border-dashed border-gray-300 group-hover:border-primary transition-colors">
                        <Upload className="h-8 w-8 text-gray-400 group-hover:text-primary" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black bg-opacity-40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-white text-xs font-medium">Upload</span>
                    </div>
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                  <span className="mt-2 text-sm text-gray-500">Profile Picture (Optional)</span>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label htmlFor="email-address" className="block text-sm font-medium text-gray-700">Email address</label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="email-address" name="email" type="email" required value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      // Reset verification if email changes
                      if (mode === 'signup' && emailVerified) {
                        setEmailVerified(false);
                        setShowOtpInput(false);
                        setSignupOtp('');
                        setSuccessMsg('');
                      }
                    }}
                    disabled={mode === 'signup' && emailVerified}
                    className={`appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${
                      mode === 'signup' && emailVerified ? 'bg-green-50 border-green-300' : ''
                    }`}
                    placeholder="Email address"
                  />
                  {mode === 'signup' && !emailVerified && (
                    <button
                      type="button"
                      onClick={handleSendSignupOtp}
                      disabled={verifyingEmail || !email}
                      className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-secondary hover:bg-secondary-dark rounded-md disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap transition-colors"
                    >
                      {verifyingEmail ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : showOtpInput ? 'Resend' : 'Verify'}
                    </button>
                  )}
                  {mode === 'signup' && emailVerified && (
                    <div className="flex-shrink-0 flex items-center text-green-600">
                      <CheckCircle className="h-6 w-6" />
                    </div>
                  )}
                </div>
              </div>

              {/* Signup OTP Verification */}
              {mode === 'signup' && showOtpInput && !emailVerified && (
                <div className="bg-orange-50 p-4 rounded-md border border-orange-200 space-y-3">
                  <label className="block text-sm font-medium text-gray-700">Enter 6-digit verification code</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={signupOtp}
                      onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary sm:text-sm text-center text-lg tracking-widest font-mono"
                      placeholder="• • • • • •"
                      maxLength={6}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={signupOtp.length !== 6}
                      className="flex-shrink-0 px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Confirm
                    </button>
                  </div>
                  <p className="text-xs text-gray-500">Check your email inbox for the verification code</p>
                </div>
              )}

              {/* Password Field (always for login, only after verification for signup) */}
              {(mode === 'login' || (mode === 'signup' && emailVerified)) && (
                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
                  <input
                    id="password" name="password" type="password" required value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                    placeholder="Password"
                  />
                  {mode === 'login' && (
                    <div className="mt-2 flex justify-end">
                      <button type="button" onClick={() => switchMode('forgot-password')} className="text-sm font-medium text-primary hover:text-primary-light">
                        Forgot Password?
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Remaining signup fields — only shown after email verification */}
              {mode === 'signup' && emailVerified && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">First Name</label>
                      <input type="text" id="firstName" required value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border focus:border-primary focus:ring-primary sm:text-sm" />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">Last Name</label>
                      <input type="text" id="lastName" required value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border focus:border-primary focus:ring-primary sm:text-sm" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year of Study</label>
                    <select id="year" required value={year} onChange={(e) => setYear(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border focus:border-primary focus:ring-primary sm:text-sm">
                      <option value="">Select Year</option>
                      <option value="1">1st Year</option>
                      <option value="2">2nd Year</option>
                      <option value="3">3rd Year</option>
                      <option value="4">4th Year</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="school" className="block text-sm font-medium text-gray-700">School</label>
                    <select id="school" required value={school} onChange={(e) => setSchool(e.target.value as School)} className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border focus:border-primary focus:ring-primary sm:text-sm">
                      {SCHOOLS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="enrollmentNumber" className="block text-sm font-medium text-gray-700">Enrollment Number</label>
                    <input type="text" id="enrollmentNumber" required value={enrollmentNumber} onChange={(e) => setEnrollmentNumber(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border focus:border-primary focus:ring-primary sm:text-sm" />
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input type="tel" id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 px-3 py-2 border focus:border-primary focus:ring-primary sm:text-sm" placeholder="E.g. +91 9876543210" />
                  </div>
                </>
              )}
            </div>

            {/* Submit button — only shown for login or for verified signup */}
            {(mode === 'login' || (mode === 'signup' && emailVerified)) && (
              <div>
                <button type="submit" disabled={loading} className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
                  {mode === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              </div>
            )}
          </form>
        )}

        {(mode === 'login' || mode === 'signup') && (
          <div className="text-center">
            <div className="relative my-4 flex items-center justify-center">
              <div className="flex-grow border-t border-gray-300"></div>
              <span className="px-3 text-sm text-gray-500 bg-transparent">
                {mode === 'login' ? "Don't have an account?" : "Already have an account?"}
              </span>
              <div className="flex-grow border-t border-gray-300"></div>
            </div>
            <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} className="text-primary hover:text-primary-light font-medium transition-colors">
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}