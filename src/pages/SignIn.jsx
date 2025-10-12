import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '@/api/authClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';

import logo from '@/assets/famly_kama_icon.svg';
import { Loader2, LogIn } from 'lucide-react';

export default function SignIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Missing details', description: 'Please enter both email and password.', variant: 'destructive', duration: 5000 });
      return;
    }
    setLoading(true);
    try {
      await authClient.login(email, password);
      window.location.href = '/dashboard';
    } catch (error) {
      toast({ title: 'Login failed', description: error?.message || 'Invalid credentials.', variant: 'destructive', duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-green-50 p-4">
      <div className="text-center max-w-2xl">
        <div className="flex justify-center items-center gap-4 mb-8">
          <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-2xl transform rotate-3 p-3">
            <img src={logo} alt="famly.ai Logo" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">famly.ai</h1>
            <p className="text-lg text-gray-600 font-medium">making family life easier</p>
          </div>
        </div>
        <div className="flex flex-col items-center gap-6 w-full max-w-md mx-auto">
          <form onSubmit={handleLogin} className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required autoComplete="current-password" />
            </div>
            <Button size="lg" type="submit" disabled={loading || !email || !password} className="w-full bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white shadow-lg px-12 py-6 text-lg rounded-xl">
              {loading ? <Loader2 className="w-6 h-6 mr-3 animate-spin" /> : <LogIn className="w-6 h-6 mr-3" />}
              {loading ? 'Signing in…' : 'Log In'}
            </Button>
            <div className="mt-4 text-center">
              <span>Don't have an account? </span>
              <Button variant="link" type="button" onClick={() => navigate('/signup')}>Sign Up</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
