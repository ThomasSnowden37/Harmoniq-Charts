import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { jwtDecode } from 'jwt-decode';
import { CredentialResponse } from '@react-oauth/google';
import { v5 as uuidv5 } from 'uuid';
import { setRealUserId } from '../lib/auth';

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

interface GoogleUser {
  id: string; 
  name: string;
  email: string;
  picture: string;
}

interface AuthContextType {
  user: GoogleUser | null;
  login: (credentialResponse: CredentialResponse) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<GoogleUser | null>(() => {
    const stored = localStorage.getItem('harmoniq_user');
    return stored ? JSON.parse(stored) : null;
  });

  useEffect(() => {
    if (user) {
      localStorage.setItem('harmoniq_user', JSON.stringify(user));
      setRealUserId(user.id);
    } else {
      localStorage.removeItem('harmoniq_user');
    }
  }, [user]);

  const login = async (credentialResponse: CredentialResponse) => {
    if (credentialResponse.credential) {
      const decoded: any = jwtDecode(credentialResponse.credential);

      const userUuid = uuidv5(decoded.sub, NAMESPACE);

      const googleUser: GoogleUser = {
        id: userUuid,
        name: decoded.name,
        email: decoded.email,
        picture: decoded.picture
      };

      try {
        // Sync with backend to create the user in Supabase
        const res = await fetch('http://localhost:3001/api/auth/google-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: decoded.sub,
                email: decoded.email,
                username: decoded.name
            })
        });

        if (res.ok) {
          setUser(googleUser);
          setRealUserId(googleUser.id); // Updates the global ID for components
        }
      } catch (err) {
        console.error("Backend sync failed", err);
      }
    }
  };

  const logout = () => {
    setUser(null);
    setRealUserId('11111111-1111-1111-1111-111111111111');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};