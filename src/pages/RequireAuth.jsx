import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authClient } from '@/api/authClient';

export default function RequireAuth({ children }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const check = async () => {
      const loggedIn = authClient.isLoggedIn();
      if (!loggedIn) {
        navigate('/signin', { replace: true });
        return;
      }
      setChecking(false);
    };
    check();
  }, [navigate]);

  if (checking) return null;
  return children;
}