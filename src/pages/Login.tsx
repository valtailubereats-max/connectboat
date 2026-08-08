import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, getDocWithCacheFallback } from '../firebase';
import { sendEmailGeneric } from '../utils/emailService';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Mail, Lock, User as UserIcon, ArrowRight, Github, Eye, EyeOff } from 'lucide-react';
import { ConnectBoatLogo } from '../components/ConnectBoatLogo';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

const Login = () => {
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();
  const { settings } = useSettings();
  const enablePortugal = settings?.enablePortugalMarket === true;
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  
  const queryMode = searchParams.get('mode');
  const initialMode = (queryMode === 'register' || queryMode === 'login' || queryMode === 'forgot') ? queryMode : 'login';
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>(initialMode);

  useEffect(() => {
    const qm = searchParams.get('mode');
    if (qm === 'register' || qm === 'login' || qm === 'forgot') {
      setMode(qm);
    }
  }, [searchParams]);
  
  // Email/Password states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [profileCountry, setProfileCountry] = useState<'Portugal' | 'Reino Unido'>('Reino Unido');
  const [showPassword, setShowPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const handleRedirectAfterAuth = async (isNewUser: boolean) => {
    await refreshProfile();
    const dest = searchParams.get('redirect');
    if (dest) {
      navigate(decodeURIComponent(dest), { replace: true });
    } else {
      navigate(isNewUser ? '/profile' : '/');
    }
  };

  const handleDemoLogin = (role: 'admin' | 'user') => {
    if (!acceptedTerms) {
      setError('You must accept the Terms of Use to continue.');
      return;
    }
    const demoProfile = role === 'admin' 
      ? {
          uid: 'valtair-demo-admin-uid',
          email: 'valtailubereats@gmail.com',
          displayName: 'Valtair Santos (Admin)',
          role: 'admin',
          phone: '+351 912 345 678'
        }
      : {
          uid: 'utilizador-demo-uid',
          email: 'visitante@mercadoluso.pt',
          displayName: 'Test User',
          role: 'user',
          phone: '+351 922 111 222'
        };

    localStorage.setItem('demo_user', JSON.stringify(demoProfile));
    
    const dest = searchParams.get('redirect');
    if (dest) {
      navigate(decodeURIComponent(dest), { replace: true });
    } else {
      navigate('/');
    }
    window.location.reload();
  };

  const handleGoogleLogin = async () => {
    if (!acceptedTerms) {
      setError('You must accept the Terms of Use to continue.');
      return;
    }
    setLoading(true);
    setError('');
    const provider = new GoogleAuthProvider();
    // Force account selection to allow switching accounts
    provider.setCustomParameters({ prompt: 'select_account' });
    
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if profile exists
      const docRef = doc(db, 'users', user.uid);
      let docSnap;
      try {
        docSnap = await getDocWithCacheFallback(docRef, `users/${user.uid}`);
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }

      if (!docSnap?.exists()) {
        const homeCountry = localStorage.getItem('selectedCountry') as 'Portugal' | 'Reino Unido' | null;
        const finalCountry = enablePortugal && (homeCountry === 'Portugal' || homeCountry === 'Reino Unido') ? homeCountry : 'Reino Unido';
        
        // Create basic profile if it doesn't exist
        const isAdminEmail = user.email === 'valtailubereats@gmail.com' || user.email === 'valtail@gmail.com' || user.email === 'generalsales2021@gmail.com';
        try {
          const refParam = searchParams.get('ref') || localStorage.getItem('referred_by_code_raw') || localStorage.getItem('referred_by_code');
          await setDoc(docRef, {
            uid: user.uid,
            name: user.displayName || 'User',
            email: user.email || '',
            phone: '', 
            country: finalCountry,
            role: isAdminEmail ? 'admin' : 'user',
            acceptedTerms: true,
            acceptedTermsAt: serverTimestamp(),
            ...(refParam ? { referredBy: refParam.trim() } : {})
          });
          
          // Sincronizar sellerPublicProfiles:
          try {
            await setDoc(doc(db, 'sellerPublicProfiles', user.uid), {
              displayName: user.displayName || 'User',
              country: finalCountry,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (syncErr) {
            console.error('[Sync] Falha ao criar sellerPublicProfiles em Google Login:', syncErr);
          }

          // Enviar email de boas-vindas
          if (user.email) {
            sendEmailGeneric('boas_vindas', user.email, {
              userName: user.displayName || 'User'
            }).catch(emailErr => console.warn('[Google Register Email] Erro ao enviar email de boas-vindas:', emailErr));
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
        await handleRedirectAfterAuth(true);
      } else {
        await handleRedirectAfterAuth(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/popup-closed-by-user') {
        setError('The sign-in window was closed.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('This sign-in method is not enabled in Firebase Console.');
      } else if (err.message && err.message.startsWith('{')) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Error creating profile (${parsed.operationType}): ${parsed.error}`);
        } catch {
          setError('Permission error when creating profile. Please check if you accepted the terms.');
        }
      } else {
        setError(err.message || 'Error signing in with Google. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acceptedTerms) {
      setError('You must accept the Terms of Use to continue.');
      return;
    }
    if (!email || !password || (mode === 'register' && !name)) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (mode === 'register') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        const user = result.user;
        
        await updateProfile(user, { displayName: name });

        const docRef = doc(db, 'users', user.uid);
        const isAdminEmail = user.email === 'valtailubereats@gmail.com' || user.email === 'valtail@gmail.com' || user.email === 'generalsales2021@gmail.com';
        const targetCountry = enablePortugal ? profileCountry : 'Reino Unido';
        try {
          const refParam = searchParams.get('ref') || localStorage.getItem('referred_by_code_raw') || localStorage.getItem('referred_by_code');
          await setDoc(docRef, {
            uid: user.uid,
            name: name,
            email: user.email || '',
            phone: '',
            country: targetCountry,
            role: isAdminEmail ? 'admin' : 'user',
            acceptedTerms: true,
            acceptedTermsAt: serverTimestamp(),
            ...(refParam ? { referredBy: refParam.trim() } : {})
          });
          
          // Sincronizar sellerPublicProfiles:
          try {
            await setDoc(doc(db, 'sellerPublicProfiles', user.uid), {
              displayName: name,
              country: targetCountry,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (syncErr) {
            console.error('[Sync] Falha ao criar sellerPublicProfiles em Email register:', syncErr);
          }

          // Enviar email de boas-vindas
          if (user.email) {
            sendEmailGeneric('boas_vindas', user.email, {
              userName: name
            }).catch(emailErr => console.warn('[Email Register Welcome] Erro ao enviar email de boas-vindas:', emailErr));
          }
          // Synchronize locally too
          localStorage.setItem('selectedCountry', targetCountry);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
        }
        await handleRedirectAfterAuth(true);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        await handleRedirectAfterAuth(false);
      }
    } catch (err: any) {
      console.error('Email auth error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Incorrect email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already in use.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password must be at least 6 characters long.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('Email/password sign-in is not enabled in Firebase Console.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else if (err.message && err.message.startsWith('{')) {
        try {
          const parsed = JSON.parse(err.message);
          setError(`Database error (${parsed.operationType}): ${parsed.error}`);
        } catch {
          setError('Permission or network error when communicating with the server.');
        }
      } else {
        setError(err.message || 'An error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Please enter your email.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMessage('Password recovery email sent successfully! Please check your inbox.');
    } catch (err: any) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError('Email not registered or invalid.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Network error. Please check your internet connection.');
      } else {
        setError('Error sending recovery email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-5 sm:p-6 rounded-3xl shadow-2xl border border-slate-100"
      >
        <div className="text-center mb-4">
          <div className="flex items-center justify-center mx-auto mb-3">
            <ConnectBoatLogo className="h-11 w-auto" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            {mode === 'login' ? 'Welcome back!' : mode === 'register' ? 'Create account' : 'Reset password'}
          </h1>
          <p className="text-slate-500 mt-1 font-medium text-sm leading-tight">
            {mode === 'login' 
              ? 'Sign in to continue trading.' 
              : mode === 'register' ? 'Join ConnectBoat marine community.' : 'Enter your email to receive instructions.'}
          </p>
        </div>

        {searchParams.get('message') && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-indigo-50 text-indigo-700 p-3 rounded-xl mb-4 text-xs font-semibold border border-indigo-100 flex items-start gap-2"
          >
            <ShieldCheck size={16} className="text-indigo-600 shrink-0 mt-0.5" />
            <span>{searchParams.get('message')}</span>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-red-50 text-red-600 p-3 rounded-xl mb-4 text-xs font-bold border border-red-100 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 bg-red-600 rounded-full shrink-0" />
            {error}
          </motion.div>
        )}

        {successMessage && (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-emerald-50 text-emerald-600 p-3 rounded-xl mb-4 text-xs font-bold border border-emerald-100 flex items-center gap-2"
          >
            <div className="w-1.5 h-1.5 bg-emerald-600 rounded-full shrink-0" />
            {successMessage}
          </motion.div>
        )}

        <form onSubmit={mode === 'forgot' ? handlePasswordReset : handleEmailAuth} className="space-y-3 mb-4">
          {mode === 'register' && (
            <>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium text-slate-900"
                />
              </div>
            </>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium text-slate-900"
            />
          </div>
          {mode !== 'forgot' && (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-12 pr-12 py-3 bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white rounded-xl outline-none transition-all font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-600 transition-colors"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          )}

          {mode === 'login' && (
            <div className="text-right">
              <button
                type="button"
                onClick={() => {
                  const params: any = { mode: 'forgot' };
                  const currentRef = searchParams.get('ref');
                  const currentRedirect = searchParams.get('redirect');
                  if (currentRef) params.ref = currentRef;
                  if (currentRedirect) params.redirect = currentRedirect;
                  setSearchParams(params);
                  setMode('forgot');
                  setError('');
                  setSuccessMessage('');
                }}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 disabled:opacity-50 group"
          >
            <span>{loading ? 'Processing...' : (mode === 'login' ? 'Sign In' : mode === 'register' ? 'Create Account' : 'Send Email')}</span>
            {!loading && <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />}
          </button>
        </form>

        {mode !== 'forgot' && (
          <>
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-4">
              <input
                type="checkbox"
                id="terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
              />
              <label htmlFor="terms" className="text-xs text-slate-600 cursor-pointer leading-tight font-medium">
                I read and agree to the <Link to="/terms" className="text-indigo-600 font-bold hover:underline">Terms of Use</Link> and acknowledge that the platform acts strictly as an intermediary.
              </label>
            </div>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-bold">
                <span className="bg-white px-3 text-slate-400">Sign in with Google Key</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-white border-2 border-slate-200 text-slate-700 py-2.5 rounded-xl font-bold hover:bg-slate-50 hover:border-indigo-200 transition-all disabled:opacity-50 text-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              <span>Google</span>
            </button>
          </>
        )}

        <div className="text-center mt-4">
          {mode === 'forgot' ? (
            <button
              onClick={() => {
                const params: any = { mode: 'login' };
                const currentRef = searchParams.get('ref');
                const currentRedirect = searchParams.get('redirect');
                if (currentRef) params.ref = currentRef;
                if (currentRedirect) params.redirect = currentRedirect;
                setSearchParams(params);
                setMode('login');
                setError('');
                setSuccessMessage('');
              }}
              className="text-sm font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              Back to Sign In
            </button>
          ) : (
            <button
              onClick={() => {
                const newMode = mode === 'login' ? 'register' : 'login';
                const params: any = { mode: newMode };
                const currentRef = searchParams.get('ref');
                const currentRedirect = searchParams.get('redirect');
                if (currentRef) params.ref = currentRef;
                if (currentRedirect) params.redirect = currentRedirect;
                setSearchParams(params);
                setMode(newMode);
                setError('');
                setSuccessMessage('');
              }}
              className="text-sm font-bold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign in here"}
            </button>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-50 text-center text-slate-400 text-[10px] uppercase tracking-[0.2em] font-black flex items-center justify-center gap-1.5">
          <ShieldCheck size={14} />
          <span>Secure and Fast</span>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
