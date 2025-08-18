
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { UserWhitelist } from '@/api/entities';
import { createPageUrl } from '@/utils';
import { Loader2, LogIn, Calendar, CheckSquare, Sparkles, AlertTriangle, LogOut } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

// Helper function to normalize Google email addresses for consistent comparison
const normalizeGoogleEmail = (email) => {
  const lowerEmail = email.toLowerCase();
  
  if (lowerEmail.endsWith('@gmail.com') || lowerEmail.endsWith('@googlemail.com')) {
    const parts = lowerEmail.split('@');
    let localPart = parts[0];
    const domainPart = 'gmail.com'; // Standardize to gmail.com

    // Remove all dots from the local part
    localPart = localPart.replace(/\./g, '');

    // Remove any text after a '+' in the local part
    const plusIndex = localPart.indexOf('+');
    if (plusIndex !== -1) {
      localPart = localPart.substring(0, plusIndex);
    }

    return `${localPart}@${domainPart}`;
  }
  return lowerEmail;
};

// PLATFORM_ADMINS emails should ideally be stored in their canonical/normalized form
// if they are Google emails (e.g., 'keespruis@gmail.com' instead of 'kees.pruis@gmail.com')
// for consistency with the normalization logic.
const PLATFORM_ADMINS = ["kees.pruis@gmail.com"]; // Assuming this is the canonical form stored

export default function Index() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Checking your account...');
  const [authStatus, setAuthStatus] = useState('checking');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [hasChecked, setHasChecked] = useState(false);



  useEffect(() => {
    const user = User.login("test@example.com", "test123");
    console.log("Logged in as:", user);
    // Prevent multiple calls
    if (hasChecked) return;
    
    const checkUserSetup = async () => {
  // Add a small delay to prevent rapid successive calls
  await new Promise(resolve => setTimeout(resolve, 500));

  try {
    setIsLoggingIn(true); // ✅ Optional: show visual feedback while logging in

    // ✅ Login properly and wait for it to finish
    const loggedInUser = await User.login("test@example.com", "test123");
    console.log("Logged in as:", loggedInUser); // ✅ You'll now see the actual user object

    // ✅ Get user from /auth/me
    const user = await User.me();
    console.log("User ", user);

    if (!user) {
      console.log("No user in localStorage — user is not logged in.");
      setAuthStatus("unauthenticated");
      setStatus("Welcome! Please log in to continue.");
      return;
    }

    setUserEmail(user.user_id); // Store original email for display
    setAuthStatus('authenticated');

    if (user && user.family_id) {
      setStatus('Welcome back! Redirecting...');
      setTimeout(() => navigate(createPageUrl('Dashboard')), 1000);
      return;
    }

    // Apply robust normalization to both platform admin and user emails
    const normalizedUserEmail = normalizeGoogleEmail(user.user_id);
    const normalizedPlatformAdmins = PLATFORM_ADMINS.map(normalizeGoogleEmail);

    if (!normalizedPlatformAdmins.includes(normalizedUserEmail)) {
      setStatus('Checking access permissions...');

      const whitelistEntries = await UserWhitelist.filter({ email: normalizedUserEmail });

      const hasActiveEntry = whitelistEntries.some(entry => entry.status === 'active');

      if (!hasActiveEntry) {
        setAuthStatus('not_whitelisted');
        setStatus('Access denied. This email is not authorized.');
        return;
      }
    }

    // If no family_id, go to setup page (with delay to prevent loop)
    setStatus('No family connection found. Redirecting to setup...');
    setTimeout(() => navigate(createPageUrl('FamilySetup')), 1500);

  } catch (error) {
    if (error.response?.status === 401 || error.message.includes('401')) {
        console.log("Auth check failed, user is not logged in.");
        setAuthStatus('unauthenticated');
        setStatus('Welcome! Please log in to continue.');
    } else if (error.response?.status === 429) {
        console.log("Rate limited, waiting before retry");
        setAuthStatus('rate_limited');
        setStatus('Too many requests. Please wait a moment...');
        setTimeout(() => {
          setHasChecked(false);
          setAuthStatus('checking');
          setStatus('Retrying...');
        }, 5000);
    } else {
        console.error("An unexpected error occurred during setup:", error);
        setAuthStatus('error');
        setStatus(`An error occurred: ${error.message}`);
    }
  } finally {
    setIsLoggingIn(false);
    setHasChecked(true);
  }
};

    checkUserSetup();
  }, [navigate, hasChecked]);

  const handleLogin = async () => {
    console.log("Start login process");
    setIsLoggingIn(true);
    try {
      const user = await User.login("test@example.com", "test123");
      console.log("Logged in as:", user);
      setAuthStatus("authenticated");
      setUserEmail(user.user_id);
      setStatus("Welcome! Redirecting...");
      setTimeout(() => navigate(createPageUrl("Dashboard")), 1000);
    } catch (error) {
      console.error("Login Failed:", error);
      toast({
        title: "Login Failed",
        description: "Invalid credentials. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await User.logout();
    setAuthStatus('unauthenticated');
    setUserEmail('');
    setHasChecked(false);
  };

  const renderContent = () => {
    switch(authStatus) {
      case 'checking':
      case 'authenticated': // Show loading status for backend check
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
            <Button 
              onClick={() => window.location.reload()} 
              className="mt-4"
              variant="outline"
            >
              Refresh Page
            </Button>
          </>
        );
      case 'unauthenticated':
        return (
          <div className="flex flex-col items-center gap-6">
            <Button 
              size="lg" 
              onClick={handleLogin} 
              disabled={isLoggingIn}
              className="bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg px-12 py-6 text-lg rounded-xl"
            >
              {isLoggingIn ? (
                <Loader2 className="w-6 h-6 mr-3 animate-spin" />
              ) : (
                <LogIn className="w-6 h-6 mr-3" />
              )}
              {isLoggingIn ? 'Redirecting...' : 'Log In or Sign Up'}
            </Button>
            <p className="text-sm text-gray-500">
              famly.ai is an invite-only platform for selected families.
            </p>
          </div>
        );
      case 'not_whitelisted':
        return (
          <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg max-w-lg mx-auto text-left shadow-md">
            <div className="flex">
              <div className="py-1"><AlertTriangle className="h-6 w-6 text-red-500 mr-4" /></div>
              <div>
                <p className="font-bold text-red-800">Access Not Authorized</p>
                <p className="text-sm text-red-700 mt-1">
                  The email address <span className="font-semibold">{userEmail}</span> is not authorized to access famly.ai. Please contact your administrator to request access.
                </p>
                <Button variant="outline" size="sm" onClick={handleLogout} className="mt-4 gap-2">
                  <LogOut className="w-4 h-4"/>
                  Sign Out
                </Button>
              </div>
            </div>
          </div>
        );
      case 'error':
         return (
             <div className="bg-red-50 border-l-4 border-red-400 p-6 rounded-r-lg max-w-lg mx-auto text-left shadow-md">
                 <p className="font-bold text-red-800">An Error Occurred</p>
                 <p className="text-sm text-red-700 mt-1">{status}</p>
                 <Button 
                   onClick={() => window.location.reload()} 
                   className="mt-4"
                   variant="outline"
                 >
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
        <div className="flex justify-center items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 p-3">
            <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/52181febd_Screenshot_20250703_092323_Chrome.jpg" 
                alt="famly.ai Logo" 
                className="w-full h-full object-contain" 
            />
          </div>
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              famly.ai
            </h1>
            <p className="text-lg text-gray-600 font-medium">making family life easier</p>
          </div>
        </div>

        {authStatus !== 'not_whitelisted' && authStatus !== 'rate_limited' && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            Your intelligent family hub for scheduling, tasks, and staying connected
          </h2>
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
            </div>
          </div>
        </div>
        )}

        {renderContent()}

        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 mb-2">Powered by</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center p-1">
              <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/52181febd_Screenshot_20250703_092323_Chrome.jpg" 
                  alt="famly.ai Logo" 
                  className="w-full h-full object-contain" 
              />
            </div>
            <span className="text-sm font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
              famly.ai
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
