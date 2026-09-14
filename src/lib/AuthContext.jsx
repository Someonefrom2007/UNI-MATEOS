import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';

import { supabase } from '@/lib/supabase';

const AuthContext = createContext(null);

// Flatten the Supabase auth user (id/email live on the user, app-level profile
// fields live in user_metadata) into the shape the app already consumes.
const toAppUser = (sessionUser) => {
  if (!sessionUser) return null;
  return {
    ...sessionUser,
    ...(sessionUser.user_metadata || {}),
    id: sessionUser.id,
    email: sessionUser.email,
    role: sessionUser.user_metadata?.role || 'user',
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const syncSession = useCallback(async () => {
    try {
      setAuthError(null);
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        const { data: { user: currentUser }, error } = await supabase.auth.getUser();
        if (!error && currentUser) {
          setUser(toAppUser(currentUser));
          setIsAuthenticated(true);
        } else {
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('Session sync failed:', error);
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({
        type: 'unknown',
        message: error.message || 'Failed to restore session',
      });
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    syncSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(toAppUser(session.user));
        setIsAuthenticated(true);
        setAuthError(null);
      } else {
        setUser(null);
        setIsAuthenticated(false);
      }
      setIsLoadingAuth(false);
      setAuthChecked(true);
    });

    return () => subscription.unsubscribe();
  }, [syncSession]);

  const checkUserAuth = useCallback(async () => {
    await syncSession();
  }, [syncSession]);

  const logout = (shouldRedirect = true) => {
    supabase.auth.signOut().finally(() => {
      setUser(null);
      setIsAuthenticated(false);
      if (shouldRedirect) {
        window.location.href = '/login';
      }
    });
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authError,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};