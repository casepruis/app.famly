import React, { useState } from 'react';
import { authClient } from '@/api/authClient';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import logo from '@/assets/famly_kama_icon.svg';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Missing or invalid reset token.');
      return;
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.detail || 'Reset failed. The link may be invalid or expired.');
        setLoading(false);
        return;
      }
      // Try to log in the user automatically after reset
      const loginRes = await authClient.login(res?.email || '', password);
      if (loginRes) {
        navigate('/dashboard');
        return;
      }
      setSubmitted(true);
    } catch (err) {
      setError('Could not reset password.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
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
            <div className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg space-y-4">
              <h2 className="text-2xl font-bold mb-2">Password reset successful</h2>
              <p className="text-gray-700 mb-4">You can now sign in with your new password.</p>
              <Button onClick={() => navigate('/signin')}>Back to Sign In</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

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
          <form onSubmit={handleSubmit} className="w-full bg-white/80 backdrop-blur-sm p-6 rounded-xl shadow-lg space-y-4">
            <h2 className="text-2xl font-bold mb-4">Set a new password</h2>
            <div>
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div>
              <Label htmlFor="confirm">Confirm Password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            {error && <div className="text-red-600 text-sm">{error}</div>}
            <Button type="submit" className="w-full" disabled={loading || !password || !confirm}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </Button>
            <Button variant="link" type="button" className="w-full" onClick={() => navigate('/signin')}>
              Back to Sign In
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
