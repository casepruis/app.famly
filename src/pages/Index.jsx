<<<<<<< HEAD
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { UserWhitelist } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Loader2, LogIn, Calendar, CheckSquare, Sparkles, AlertTriangle, LogOut } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authClient } from '@/api/authClient';

import logo from '@/assets/famly_kama_icon.svg';
// Safe env resolver (works in Vite/CRA/Next or plain)
const strip = (v) => String(v).replace(/\/+$/, '');
const resolveApiBase = () => {
  // Window override if you ever want to set it before app boots
  if (typeof window !== 'undefined' && window.__API_BASE__) return strip(window.__API_BASE__);

  // Vite
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE) {
    return strip(import.meta.env.VITE_API_BASE);
  }

  // CRA / Next (guard process!)
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.REACT_APP_API_BASE) return strip(process.env.REACT_APP_API_BASE);
    if (process.env.NEXT_PUBLIC_API_BASE) return strip(process.env.NEXT_PUBLIC_API_BASE);
  }

  // Fallback to your FastAPI prefix
  return '/api';
};

const BASE = resolveApiBase();


// Helper to normalize Google email addresses
// const normalizeGoogleEmail = (email) => {
//   const lowerEmail = (email || '').toLowerCase();
//   if (lowerEmail.endsWith('@gmail.com') || lowerEmail.endsWith('@googlemail.com')) {
//     const [local] = lowerEmail.split('@');
//     const domainPart = 'gmail.com';
//     let localPart = local.replace(/\./g, '');
//     const plusIndex = localPart.indexOf('+');
//     if (plusIndex !== -1) localPart = localPart.substring(0, plusIndex);
//     return `${localPart}@${domainPart}`;
//   }
//   return lowerEmail;
// };

const normalizeGoogleEmail = (email) => {
  const lowerEmail = (email || '').toLowerCase();
  if (lowerEmail.endsWith('@gmail.com') || lowerEmail.endsWith('@googlemail.com')) {
    const [local] = lowerEmail.split('@');
    const domainPart = 'gmail.com';
    // ✏️ Keep dots — just remove anything after '+'
    const plusIndex = local.indexOf('+');
    const localPart = plusIndex !== -1 ? local.substring(0, plusIndex) : local;
    return `${localPart}@${domainPart}`;
  }
  return lowerEmail;
};


// Store these in canonical/normalized form for Google emails
const PLATFORM_ADMINS = ['kees.pruis@siliconbrain.nl'];

export default function Index() {
  const navigate = useNavigate();

  const [status, setStatus] = useState('Checking your account...');
  const [authStatus, setAuthStatus] = useState('checking');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [hasChecked, setHasChecked] = useState(false);

  // shared form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // mode: login vs signup
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  // signup-specific state
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [signupChecked, setSignupChecked] = useState(false); // after /check-email
  const [signupReason, setSignupReason] = useState(null); // 'whitelist' | 'invitation' | null
  const [invitationFamilyIds, setInvitationFamilyIds] = useState([]);
  const [selectedFamilyId, setSelectedFamilyId] = useState('');
  const [familyName, setFamilyName] = useState(''); // for whitelist created family

  const checkUserSetup = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 300));
    try {
      setStatus('Checking your account...');
      setAuthStatus('checking');

      const me = await authClient.me().catch((err) => {
        if (err?.response?.status === 401 || String(err?.message).includes('401')) return null;
        throw err;
      });

      if (!me) {
        setAuthStatus('unauthenticated');
        setStatus('Welcome! Please log in or sign up to continue.');
        return;
      }

      setUserEmail(me.user_id || '');
      setAuthStatus('authenticated');

      if (me.family_id) {
        setStatus('Welcome back! Redirecting...');
        setTimeout(() => navigate(createPageUrl('Dashboard')), 800);
        return;
      }

      const normalizedUserEmail = normalizeGoogleEmail(me.user_id || '');
      if (!me.is_platform_admin) {
        setStatus('Checking access permissions...');
        const whitelistEntries = await UserWhitelist.filter({ email: normalizedUserEmail });
        const hasActiveEntry = Array.isArray(whitelistEntries) && whitelistEntries.some((e) => e.status === 'active');

        if (!hasActiveEntry) {
          setAuthStatus('not_whitelisted');
          setStatus('Access denied. This email is not authorized.');
          return;
        }
      }

      setStatus('No family connection found. Redirecting to setup...');
      setTimeout(() => navigate(createPageUrl('FamilySetup')), 1000);
    } catch (error) {
      if (error?.response?.status === 429) {
        setAuthStatus('rate_limited');
        setStatus('Too many requests. Please wait a moment...');
      } else if (error?.response?.status === 401 || String(error?.message || '').includes('401')) {
        setAuthStatus('unauthenticated');
        setStatus('Welcome! Please log in or sign up to continue.');
      } else {
        console.error('Unexpected error during setup:', error);
        setAuthStatus('error');
        setStatus(`An error occurred: ${error?.message || 'Unknown error'}`);
      }
    } finally {
      setHasChecked(true);
    }
  }, [navigate]);

  useEffect(() => {
    if (!hasChecked) checkUserSetup();
  }, [hasChecked, checkUserSetup]);

  // --------- LOGIN ----------
  const handleLogin = async (e) => {
    e?.preventDefault();

    if (!email || !password) {
      toast({ title: 'Missing details', description: 'Please enter both email and password.', variant: 'destructive', duration: 5000  });
      return;
    }

    try {
      setIsLoggingIn(true);
      setStatus('Signing you in...');
      const loggedInUser = await authClient.login(email, password);
      setUserEmail(loggedInUser?.user_id || email);
      await checkUserSetup();
    } catch (error) {
      console.error('Login failed:', error);
      toast({
        title: 'Login failed',
        description: error?.response?.data?.message || 'Invalid credentials. Please try again.',
        variant: 'destructive',
        duration: 5000 
      });
      setAuthStatus('unauthenticated');
      setStatus('Welcome! Please log in or sign up to continue.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // --------- SIGNUP (pre-check) ----------
  // --------- SIGNUP (pre-check) ----------
const handleSignupPrecheck = async (e) => {
  e?.preventDefault();
  const n = normalizeGoogleEmail(email);
  if (!n) {
    toast({ title: 'Enter your email', description: 'We need your email to check your invite.', variant: 'destructive', duration: 5000  });
    return;
  }
  try {
    setIsCheckingEmail(true);
    // ⬇️ use User.checkEmail (from entities.js)
    const result = await User.checkEmail(n);

    if (!result?.allowed) {
      setSignupChecked(false);
      setSignupReason(null);
      setInvitationFamilyIds([]);
      setSelectedFamilyId('');
      toast({
        title: 'No invite found',
        description: 'This email is not whitelisted and has no pending family invitation.',
        variant: 'destructive',
        duration: 5000 
      });
      return;
    }

    setSignupChecked(true);
    setSignupReason(result.reason);
    const fids = result.invitation_family_ids || [];
    setInvitationFamilyIds(fids);
    setSelectedFamilyId(fids.length === 1 ? fids[0] : '');
    setPassword('');
    setFamilyName('');
    setStatus('You can create your account.');
  } catch (err) {
    console.error('check-email failed:', err);
    toast({ title: 'Error', description: 'Could not verify your invite. Try again.', variant: 'destructive', duration: 5000  });
  } finally {
    setIsCheckingEmail(false);
  }
};


  // --------- SIGNUP (commit) ----------
  // --------- SIGNUP (commit) ----------
const handleSignup = async (e) => {
  e?.preventDefault();
  const n = normalizeGoogleEmail(email);

  if (!signupChecked) {
    toast({ title: 'Check your email first', description: 'Tap Continue to verify your invite.', variant: 'destructive', duration: 5000  });
    return;
  }
  if (!password) {
    toast({ title: 'Set a password', description: 'Please choose a password to create your account.', variant: 'destructive', duration: 5000  });
    return;
  }
  if (signupReason === 'invitation' && !selectedFamilyId) {
    toast({ title: 'Choose a family', description: 'Select which family to join.', variant: 'destructive', duration: 5000  });
    return;
  }

  try {
    setIsSigningUp(true);
    setStatus('Creating your account...');

    const payload =
      signupReason === 'invitation'
        ? { email: n, password, family_id: selectedFamilyId }
        : { email: n, password, family_name: familyName || undefined };

    // ⬇️ use User.signup (from entities.js)
    await User.signup(payload);

    // then log in with the same credentials
    const loggedInUser = await User.login(email, password);
    setUserEmail(loggedInUser?.user_id || email);

    await checkUserSetup();
  } catch (err) {
    console.error('signup failed:', err);
    const message = typeof err?.message === 'string' ? err.message : 'Could not create your account.';
    toast({ title: 'Sign up failed', description: message, variant: 'destructive', duration: 5000  });
    setAuthStatus('unauthenticated');
    setStatus('Welcome! Please log in or sign up to continue.');
  } finally {
    setIsSigningUp(false);
  }
};

  const handleLogout = async () => {
    try {
      await authClient.logout();
    } finally {
      setAuthStatus('unauthenticated');
      setUserEmail('');
      setHasChecked(false);
    }
  };

  const renderUnauthenticated = () => {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
        {/* simple tabs */}
        <div className="flex w-full rounded-xl overflow-hidden border bg-white/70 backdrop-blur-sm">
          <button
            className={`flex-1 py-3 text-sm font-medium ${mode === 'login' ? 'bg-white' : 'bg-transparent'} `}
            onClick={() => setMode('login')}
            type="button"
          >
            Log in
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium ${mode === 'signup' ? 'bg-white' : 'bg-transparent'} `}
            onClick={() => setMode('signup')}
            type="button"
          >
            Sign up
          </button>
        </div>

        {mode === 'login' ? (
          <form onSubmit={handleLogin} className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              size="lg"
              type="submit"
              disabled={isLoggingIn || !email || !password}
              className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg px-12 py-6 text-lg rounded-xl"
            >
              {isLoggingIn ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <LogIn className="w-6 h-6 mr-3" />}
              {isLoggingIn ? 'Signing in…' : 'Log In'}
            </Button>
          </form>
        ) : (
          <form onSubmit={signupChecked ? handleSignup : handleSignupPrecheck} className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="signup-email">Email</Label>
              <Input
                id="signup-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSignupChecked(false);
                  setSignupReason(null);
                  setInvitationFamilyIds([]);
                  setSelectedFamilyId('');
                }}
                required
                autoComplete="email"
              />
            </div>

            {!signupChecked ? (
              <Button
                size="lg"
                type="submit"
                disabled={isCheckingEmail || !email}
                className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg px-12 py-6 text-lg rounded-xl"
              >
                {isCheckingEmail ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <LogIn className="w-6 h-6 mr-3" />}
                {isCheckingEmail ? 'Checking…' : 'Continue'}
              </Button>
            ) : (
              <>
                {signupReason === 'invitation' && (
                  <div className="space-y-2">
                    <Label htmlFor="family-select">Select family to join</Label>
                    <select
                      id="family-select"
                      className="w-full border rounded-md p-2"
                      value={selectedFamilyId}
                      onChange={(e) => setSelectedFamilyId(e.target.value)}
                    >
                      <option value="" disabled>
                        {invitationFamilyIds.length ? 'Choose…' : 'No invitations found'}
                      </option>
                      {invitationFamilyIds.map((fid) => (
                        <option key={fid} value={fid}>
                          {fid}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {signupReason === 'whitelist' && (
                  <div className="space-y-2">
                    <Label htmlFor="family-name">Family name (optional)</Label>
                    <Input
                      id="family-name"
                      type="text"
                      placeholder="The Johnsons"
                      value={familyName}
                      onChange={(e) => setFamilyName(e.target.value)}
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="signup-password">Choose a password</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  size="lg"
                  type="submit"
                  disabled={isSigningUp || !password || (signupReason === 'invitation' && !selectedFamilyId)}
                  className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg px-12 py-6 text-lg rounded-xl"
                >
                  {isSigningUp ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <LogIn className="w-6 h-6 mr-3" />}
                  {isSigningUp ? 'Creating account…' : 'Create account'}
                </Button>
              </>
            )}

            <p className="text-sm text-gray-500 text-center">
              famly.ai is invite-only. We’ll verify your email against a whitelist or an invitation.
            </p>
          </form>
        )}
      </div>
    );
  };

  const renderContent = () => {
    switch (authStatus) {
      case 'checking':
      case 'authenticated':
        return (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-lg text-gray-700 font-semibold">{status}</p>
          </>
        );
      case 'rate_limited':
        return (
          <>
            <AlertTriangle className="w-8 h-8 text-orange-500 mx-auto mb-4" />
            <p className="text-lg text-gray-700 font-semibold">{status}</p>
            <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
              Refresh Page
            </Button>
          </>
        );
      case 'not_whitelisted':
        return (
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg max-w-lg mx-auto text-left shadow-md">
            <div className="flex">
              <div className="py-1">
                <AlertTriangle className="h-6 w-6 text-red-500 mr-4" />
              </div>
              <div>
                <p className="font-bold text-red-800">Access Not Authorized</p>
                <p className="text-sm text-red-700 mt-1">
                  The email address <span className="font-semibold">{userEmail}</span> is not authorized to access famly.ai.
                </p>
                <Button variant="outline" size="sm" onClick={handleLogout} className="mt-4 gap-2">
                  <LogOut className="w-4 h-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        );
      case 'unauthenticated':
        return renderUnauthenticated();
      case 'error':
        return (
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg max-w-lg mx-auto text-left shadow-md">
            <p className="font-bold text-red-800">An Error Occurred</p>
            <p className="text-sm text-red-700 mt-1">{status}</p>
            <Button onClick={() => window.location.reload()} className="mt-4" variant="outline">
              Try Again
            </Button>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="text-center max-w-2xl">
        {/* header / branding */}
        <div className="flex justify-center items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 p-3">
            <img
              src={logo}
              alt="famly.ai Logo"
              className="w-full h-full object-contain"
            />
=======
import React, { useEffect, useState } from 'react';
import logo from '@/assets/famly_kama_icon.svg';
import { authClient } from '@/api/authClient';
import { Loader2 } from 'lucide-react';
import { useNavigate } from "react-router-dom";


export default function Index() {
  const navigate = useNavigate();
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
  const timer = setTimeout(() => {
  setRedirecting(true);
  if (authClient.isLoggedIn()) {
  navigate('/dashboard', { replace: true });
  } else {
  navigate('/signin', { replace: true });
  }
  }, 1200); // Show content for 1.2s before redirect
  return () => clearTimeout(timer);
  }, [navigate]);
  return (
  <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4 relative">
  {/* Main landing content */}
  <div className="text-center max-w-2xl">
  {/* header / branding */}
  <div className="flex justify-center items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 p-3">
            <img src={logo} alt="famly.ai Logo" className="w-full h-full object-contain" />
>>>>>>> feature/auth
          </div>
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">famly.ai</h1>
            <p className="text-lg text-gray-600 font-medium">making family life easier</p>
          </div>
<<<<<<< HEAD
        </div>

        {/* features */}
        {authStatus !== 'not_whitelisted' && authStatus !== 'rate_limited' && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Your intelligent family hub for scheduling, tasks, and staying connected</h2>
            <div className="grid md:grid-cols-3 gap-6 text-left">
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Calendar className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-2">Smart Scheduling</h3>
                <p className="text-gray-600 text-sm">AI-powered family calendar that prevents conflicts and suggests optimal times</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                  <CheckSquare className="w-6 h-6 text-green-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-2">Task Management</h3>
                <p className="text-gray-600 text-sm">Assign chores, track homework, and reward completion with our smart task system</p>
              </div>
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <Sparkles className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="font-bold text-gray-800 mb-2">AI Assistant</h3>
                <p className="text-gray-600 text-sm">Voice commands, smart suggestions, and automated family coordination</p>
=======
  </div>
  {/* features */}
  <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Your intelligent family hub for scheduling, tasks, and staying connected</h2>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 7V3M16 7V3M4 11h16M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Smart Scheduling</h3>
              <p className="text-gray-600 text-sm">AI-powered family calendar that prevents conflicts and suggests optimal times</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 12l2 2l4 -4" /><path d="M12 20a8 8 0 1 0 0-16a8 8 0 0 0 0 16z" /></svg>
              </div>
              <h3 className="font-bold text-gray-800 mb-2">Task Management</h3>
              <p className="text-gray-600 text-sm">Assign chores, track homework, and reward completion with our smart task system</p>
            </div>
            <div className="bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 3v2m0 14v2m9-9h-2M5 12H3m15.364-6.364l-1.414 1.414M6.05 17.95l-1.414 1.414m12.728 0l-1.414-1.414M6.05 6.05L4.636 7.464" /></svg>
>>>>>>> feature/auth
              </div>
            </div>
          </div>
<<<<<<< HEAD
        )}

        {/* dynamic content */}
        {renderContent()}

        {/* footer */}
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 mb-2">Powered by</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center p-1">
              <img
                src={logo}
                alt="famly.ai Logo"
                className="w-full h-full object-contain"
              />
=======
  </div>
  {/* footer */}
  <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 mb-2">Powered by</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center p-1">
              <img src={logo} alt="famly.ai Logo" className="w-full h-full object-contain" />
>>>>>>> feature/auth
            </div>
            <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">famly.ai</span>
          </div>
  </div>
  </div>
  {/* Loading overlay */}
  {redirecting && (
  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
          <p className="text-lg text-gray-700 font-semibold">Loading...</p>
  </div>
  )}
  </div>
  );
}

           


