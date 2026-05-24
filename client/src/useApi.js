import { createContext, createElement, useContext, useMemo, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';

const DemoAuthContext = createContext(null);

export function sanitizeDemoUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 32);
}

export function DemoAuthProvider({ children }) {
  const [demoUsername, setDemoUsernameState] = useState(() => localStorage.getItem('vt-demo-username') || '');

  const value = useMemo(() => ({
    demoUsername,
    isDemo: Boolean(demoUsername),
    startDemo(username) {
      const clean = sanitizeDemoUsername(username);
      if (!clean) throw new Error('Enter a username to start demo mode.');
      localStorage.setItem('vt-demo-username', clean);
      setDemoUsernameState(clean);
    },
    stopDemo() {
      localStorage.removeItem('vt-demo-username');
      setDemoUsernameState('');
    },
  }), [demoUsername]);

  return createElement(DemoAuthContext.Provider, { value }, children);
}

export function useDemoAuth() {
  const ctx = useContext(DemoAuthContext);
  if (!ctx) throw new Error('useDemoAuth must be used inside DemoAuthProvider');
  return ctx;
}

export function useApi() {
  const { getToken } = useAuth();
  const { demoUsername } = useDemoAuth();

  return async (url, options = {}) => {
    const token = demoUsername ? null : await getToken();
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (demoUsername) headers['X-Demo-Username'] = demoUsername;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { ...options, headers });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `HTTP ${res.status}`);
    }
    return res.json();
  };
}
