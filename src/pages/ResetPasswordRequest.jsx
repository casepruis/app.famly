import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/components/ui/use-toast';
import logo from '@/assets/famly_kama_icon.svg';

export default function ResetPasswordRequest() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setSubmitted(true);
    } catch (error) {
      toast({ title: 'Error', description: 'Could not request password reset.', variant: 'destructive', duration: 5000 });
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
              <h2 className="text-2xl font-bold mb-2">Check your email</h2>
              <p className="text-gray-700 mb-4">If an account exists for that email, you’ll receive a password reset link shortly.</p>
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
            <h2 className="text-2xl font-bold mb-4">Reset your password</h2>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? 'Sending...' : 'Send reset link'}
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
