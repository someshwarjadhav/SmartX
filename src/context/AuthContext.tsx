import type * as React from 'react';
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { ApiError } from '../services/http/errors';
import { loginApi, type LoginProfile } from '../services/auth/auth.api.ts';
import { applySession, clearSessionData, loadSessionData, restoreSession, saveLogin } from '../services/bootstrap';
import { vaultDropLegacy } from '../lib/portal/vault';
import { setSession } from '../services/session';
import { clearSmartxCache } from '../hooks/useQuery';
export interface User extends LoginProfile { name: string; email: string; role: string; }
export interface LoginResult { ok: boolean; message: string; }
interface AuthCtx { user: User | null; login: (email: string, password: string) => Promise<LoginResult>; updateProfile: (name: string, email: string) => LoginResult; logout: () => void; }
const Ctx = createContext<AuthCtx | null>(null);
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
 const [user,setUser]=useState<User|null>(()=>{vaultDropLegacy();return restoreSession() as User|null;});
 const login=useCallback(async(email:string,password:string):Promise<LoginResult>=>{try{const {profile,record}=await loginApi(email.trim(),password);saveLogin(email.trim(),record);setSession(profile);await loadSessionData(profile);applySession(profile);const next:User={...profile,name:profile.name||email.split('@')[0]||'User',email:profile.email||email,role:profile.role||'User'};setUser(next);return{ok:true,message:'Signed in'};}catch(error){clearSessionData();setSession(null);return{ok:false,message:error instanceof ApiError?error.message:error instanceof Error?error.message:'Sign-in failed. Please try again.'};}},[]);
 const updateProfile=useCallback((name:string,email:string):LoginResult=>{if(!user)return{ok:false,message:'Sign in to update your profile.'};if(!name.trim())return{ok:false,message:'Enter your name.'};if(!/^\S+@\S+\.\S+$/.test(email.trim()))return{ok:false,message:'Enter a valid email address.'};setUser({...user,name:name.trim(),email:email.trim()});return{ok:true,message:'Profile updated for this session.'};},[user]);
 const logout=useCallback(()=>{clearSessionData();setSession(null);clearSmartxCache();setUser(null);},[]);
 const value=useMemo(()=>({user,login,updateProfile,logout}),[user,login,updateProfile,logout]);return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
export function useAuth():AuthCtx{const c=useContext(Ctx);if(!c)throw new Error('useAuth must be used inside AuthProvider');return c;}
