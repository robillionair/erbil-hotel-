import React, { useState, useEffect } from 'react';
import { X, Shield, KeyRound, UserPlus, Sparkles, Lock, Mail, Phone, UserCheck } from 'lucide-react';
import { useAuthStore, UserRole } from '../store/useAuthStore';
import { isSupabaseConfigured } from '../lib/supabaseClient';

export const AuthModal: React.FC = () => {
  const {
    isAuthModalOpen,
    authModalInitialTab,
    closeAuthModal,
    signInWithPassword,
    signUpCreateAccount,
    sendMagicLinkOtp,
    isLoading,
    authError,
    authNotice,
    clearMessages,
  } = useAuthStore();

  const [tab, setTab] = useState<'signin' | 'signup' | 'magic'>('signin');
  const [email, setEmail] = useState('chairman@erbilhotel.iq');
  const [password, setPassword] = useState('erbil2026');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+964 750 816 9999');
  const [role, setRole] = useState<UserRole>('guest');

  useEffect(() => {
    if (isAuthModalOpen) {
      setTab(authModalInitialTab);
      clearMessages();
    }
  }, [isAuthModalOpen, authModalInitialTab, clearMessages]);

  if (!isAuthModalOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithPassword(email, password);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    await signUpCreateAccount({
      email,
      password,
      fullName,
      phone,
      role,
    });
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMagicLinkOtp(email);
  };

  const fillDemoAccount = (targetEmail: string, targetRole: UserRole) => {
    setEmail(targetEmail);
    setPassword('erbil2026');
    setRole(targetRole);
    setTab('signin');
    clearMessages();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg bg-[#050508] border border-[#24242c] shadow-2xl overflow-hidden text-[#f4f0ea]">
        {/* Top Gold Accent Hairline */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#d4af37] to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#16161a] bg-[#08080c]">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logo/erbil-hotel-logo.jpeg"
              alt="Erbil Hotel"
              className="w-9 h-9 object-cover border border-[#d4af37]/50"
            />
            <div>
              <div className="font-mono text-[10px] tracking-[0.22em] text-[#d4af37] uppercase">
                ERBIL HOTEL // IDENTITY VAULT
              </div>
              <h2 className="font-serif text-xl font-semibold tracking-wide text-[#f4f0ea]">
                Authentication & Role Provisioning
              </h2>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1.5 text-[#888895] hover:text-[#f4f0ea] border border-transparent hover:border-[#282832] transition"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-3 border-b border-[#16161a] bg-[#040406] font-mono text-[11px] tracking-wider uppercase">
          <button
            type="button"
            onClick={() => {
              setTab('signin');
              clearMessages();
            }}
            className={`py-3 flex items-center justify-center gap-1.5 border-r border-[#16161a] transition ${
              tab === 'signin'
                ? 'bg-[#101016] text-[#d4af37] border-b-2 border-b-[#d4af37]'
                : 'text-[#787885] hover:text-[#f4f0ea]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('signup');
              clearMessages();
            }}
            className={`py-3 flex items-center justify-center gap-1.5 border-r border-[#16161a] transition ${
              tab === 'signup'
                ? 'bg-[#101016] text-[#00f0ff] border-b-2 border-b-[#00f0ff]'
                : 'text-[#787885] hover:text-[#f4f0ea]'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            Create Account
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('magic');
              clearMessages();
            }}
            className={`py-3 flex items-center justify-center gap-1.5 transition ${
              tab === 'magic'
                ? 'bg-[#101016] text-[#00e676] border-b-2 border-b-[#00e676]'
                : 'text-[#787885] hover:text-[#f4f0ea]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Magic Link / OTP
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Status Banner */}
          <div className="flex items-center justify-between px-3 py-2 bg-[#0a0a10] border border-[#1c1c24] font-mono text-[10px]">
            <span className="text-[#888895]">AUTH PROVIDER:</span>
            <span className={isSupabaseConfigured ? 'text-[#00e676]' : 'text-[#d4af37]'}>
              {isSupabaseConfigured
                ? 'SUPABASE CLOUD AUTH + RLS ACTIVE'
                : 'LOCAL PERSISTENT VAULT + REALTIME SIMULATOR'}
            </span>
          </div>

          {authError && (
            <div className="p-3 bg-[#ff1e7a]/10 border border-[#ff1e7a]/50 text-[#ff1e7a] font-mono text-xs">
              {authError}
            </div>
          )}

          {authNotice && (
            <div className="p-3 bg-[#00e676]/10 border border-[#00e676]/50 text-[#00e676] font-mono text-xs">
              {authNotice}
            </div>
          )}

          {/* SIGN IN FORM */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#686875] absolute left-3 top-2.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@erbilhotel.iq"
                    className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#d4af37] pl-9 pr-3 py-2 text-sm text-[#f4f0ea] outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1.5">
                  Security Password / PIN
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#686875] absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#d4af37] pl-9 pr-3 py-2 text-sm text-[#f4f0ea] outline-none font-mono"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#d4af37] hover:bg-[#e3be42] text-[#030305] font-mono text-xs font-bold uppercase tracking-[0.18em] transition"
              >
                {isLoading ? 'AUTHENTICATING...' : 'AUTHENTICATE SESSION'}
              </button>

              {/* Pre-seeded 1-Click Accounts */}
              <div className="pt-3 border-t border-[#16161a]">
                <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#686875] mb-2">
                  INSTANT CREDENTIAL PRESETS (PASSWORD: erbil2026)
                </div>
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('chairman@erbilhotel.iq', 'executive')}
                    className="px-2.5 py-1.5 bg-[#0c0c12] hover:bg-[#161622] border border-[#22222c] text-left text-[#d4af37] truncate"
                  >
                    [EXEC] chairman@erbilhotel.iq
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('reception@erbilhotel.iq', 'front_desk')}
                    className="px-2.5 py-1.5 bg-[#0c0c12] hover:bg-[#161622] border border-[#22222c] text-left text-[#00f0ff] truncate"
                  >
                    [DESK] reception@erbilhotel.iq
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('housekeeping@erbilhotel.iq', 'housekeeping')}
                    className="px-2.5 py-1.5 bg-[#0c0c12] hover:bg-[#161622] border border-[#22222c] text-left text-[#00e676] truncate"
                  >
                    [CLEAN] housekeeping@erbilhotel.iq
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('envoy@diplomatic.org', 'guest')}
                    className="px-2.5 py-1.5 bg-[#0c0c12] hover:bg-[#161622] border border-[#22222c] text-left text-[#f4f0ea] truncate"
                  >
                    [GUEST] envoy@diplomatic.org
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* CREATE ACCOUNT (SIGN UP) FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Dilan Barzani"
                    className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#00f0ff] px-3 py-2 text-xs text-[#f4f0ea] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1">
                    Phone / WhatsApp *
                  </label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-[#686875] absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+964 750 816 9999"
                      className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#00f0ff] pl-8 pr-2.5 py-2 text-xs text-[#f4f0ea] outline-none font-mono"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@erbilhotel.iq"
                    className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#00f0ff] px-3 py-2 text-xs text-[#f4f0ea] outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1">
                    Password / PIN *
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#00f0ff] px-3 py-2 text-xs text-[#f4f0ea] outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1.5">
                  Select Operational / Guest Role *
                </label>
                <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                  {(
                    [
                      { id: 'guest', label: 'LUXURY GUEST', desc: 'Book suites, Digital Key & Dining' },
                      { id: 'front_desk', label: 'FRONT DESK', desc: 'Check-In/Out, Ready Rooms & Stays' },
                      { id: 'housekeeping', label: 'HOUSEKEEPING', desc: 'Room Turnover & Supervisor Inspect' },
                      { id: 'executive', label: 'EXECUTIVE COMMAND', desc: 'Full Citadel Telemetry + Admin' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRole(item.id)}
                      className={`p-2.5 border text-left transition ${
                        role === item.id
                          ? 'bg-[#121622] border-[#00f0ff] text-[#f4f0ea]'
                          : 'bg-[#09090d] border-[#1e1e26] text-[#888895] hover:border-[#343442]'
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold text-[10px]">
                        <span>{item.label}</span>
                        {role === item.id && <UserCheck className="w-3.5 h-3.5 text-[#00f0ff]" />}
                      </div>
                      <div className="text-[9px] text-[#686875] mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#00f0ff] hover:bg-[#33f3ff] text-[#030305] font-mono text-xs font-bold uppercase tracking-[0.18em] transition"
              >
                {isLoading ? 'PROVISIONING PROFILE...' : 'CREATE ACCOUNT & SIGN IN'}
              </button>
            </form>
          )}

          {/* MAGIC LINK / OTP FORM */}
          {tab === 'magic' && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <p className="text-xs text-[#9898a6] leading-relaxed">
                Dispatch a zero-password cryptographic Magic Link / One-Time Passcode to your email.
                 Automatically provisions a `public.profiles` record via Supabase Trigger.
              </p>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-[#888895] mb-1.5">
                  Recipient Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@diplomatic.org"
                  className="w-full bg-[#09090d] border border-[#22222a] focus:border-[#00e676] px-3 py-2 text-sm text-[#f4f0ea] outline-none font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#00e676] hover:bg-[#2ef08d] text-[#030305] font-mono text-xs font-bold uppercase tracking-[0.18em] transition"
              >
                {isLoading ? 'DISPATCHING OTP...' : 'SEND MAGIC LINK / VERIFY OTP'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-[#040406] border-t border-[#16161a] flex items-center justify-between font-mono text-[10px] text-[#686875]">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-[#d4af37]" />
            ERBIL HOTEL // SALEM STREET, SULAYMANIYAH
          </span>
          <span>1 USD = 1,310 IQD</span>
        </div>
      </div>
    </div>
  );
};
