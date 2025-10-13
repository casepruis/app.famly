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
          </div>
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">famly.ai</h1>
            <p className="text-lg text-gray-600 font-medium">making family life easier</p>
          </div>
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
              </div>
            </div>
          </div>
  </div>
  {/* footer */}
  <div className="mt-12 text-center">
          <p className="text-xs text-gray-400 mb-2">Powered by</p>
          <div className="flex items-center justify-center gap-2">
            <div className="w-6 h-6 bg-white rounded-lg flex items-center justify-center p-1">
              <img src={logo} alt="famly.ai Logo" className="w-full h-full object-contain" />
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

           


