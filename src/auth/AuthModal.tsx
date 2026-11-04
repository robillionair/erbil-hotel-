import React, { useState, useEffect } from 'react';
import { X, Shield, KeyRound, UserPlus, Sparkles, Lock, Mail, Phone, Check } from 'lucide-react';
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-xl p-4">
      <div className="relative w-full max-w-lg rounded-3xl glass-panel overflow-hidden text-[#f4f0ea] shadow-[0_32px_80px_rgba(0,0,0,0.85)]">
        {/* Ambient Top Glow */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-[#d4af37]/20 blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-7 pt-7 pb-5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="p-0.5 rounded-2xl bg-gradient-to-br from-[#d4af37] via-[#d4af37]/40 to-transparent">
              <img
                src="/assets/logo/erbil-hotel-logo.jpeg"
                alt="Erbil Hotel"
                className="w-11 h-11 rounded-[14px] object-cover"
              />
            </div>
            <div>
              <div className="text-[11px] font-medium tracking-[0.22em] text-[#d4af37] uppercase">
                Sovereign Identity Vault
              </div>
              <h2 className="font-serif text-2xl font-normal tracking-wide text-[#f4f0ea]">
                Erbil Hotel Access
              </h2>
            </div>
          </div>
          <button
            onClick={closeAuthModal}
            className="w-9 h-9 rounded-full glass-pill flex items-center justify-center text-white/60 hover:text-white transition"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Floating Pill Mode Switcher */}
        <div className="px-7 pt-5">
          <div className="grid grid-cols-3 p-1 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-medium">
            <button
              type="button"
              onClick={() => {
                setTab('signin');
                clearMessages();
              }}
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                tab === 'signin'
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#b89225] text-[#030305] font-semibold shadow-lg'
                  : 'text-white/60 hover:text-white'
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
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                tab === 'signup'
                  ? 'bg-gradient-to-r from-[#00f0ff] to-[#00b8d4] text-[#030305] font-semibold shadow-lg'
                  : 'text-white/60 hover:text-white'
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
              className={`py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all ${
                tab === 'magic'
                  ? 'bg-gradient-to-r from-[#00e676] to-[#00b85c] text-[#030305] font-semibold shadow-lg'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Magic OTP
            </button>
          </div>
        </div>

        <div className="p-7 space-y-5">
          {/* Cloud Status Pill */}
          <div className="flex items-center justify-between px-4 py-2.5 rounded-2xl bg-white/[0.03] border border-white/10 text-xs">
            <span className="text-white/50">Realtime Security Engine</span>
            <span className="flex items-center gap-2 font-mono text-[11px] text-[#00e676]">
              <span className="w-2 h-2 rounded-full bg-[#00e676] animate-pulse" />
              {isSupabaseConfigured ? 'Supabase Cloud Connected' : 'Encrypted Local + Realtime Bus'}
            </span>
          </div>

          {authError && (
            <div className="p-3.5 rounded-2xl bg-[#ff1e7a]/15 border border-[#ff1e7a]/40 text-[#ff85b3] text-xs">
              {authError}
            </div>
          )}

          {authNotice && (
            <div className="p-3.5 rounded-2xl bg-[#00e676]/15 border border-[#00e676]/40 text-[#69f0ae] text-xs">
              {authNotice}
            </div>
          )}

          {/* SIGN IN FORM */}
          {tab === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@erbilhotel.iq"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#d4af37] pl-10 pr-4 py-2.5 text-sm text-white outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-white/70 mb-1.5">
                  Security Passkey / PIN
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-white/40 absolute left-3.5 top-3" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#d4af37] pl-10 pr-4 py-2.5 text-sm text-white outline-none transition"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#b89225] hover:brightness-110 text-[#030305] text-xs font-semibold uppercase tracking-[0.16em] shadow-lg shadow-[#d4af37]/20 transition"
              >
                {isLoading ? 'Authenticating...' : 'Sign In to Erbil Citadel'}
              </button>

              {/* Quick Sandbox Presets */}
              <div className="pt-4 border-t border-white/10">
                <div className="text-[11px] text-white/45 mb-2.5">
                  Instant 1-Click Role Credentials (Passkey: <code className="text-[#d4af37]">erbil2026</code>)
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('chairman@erbilhotel.iq', 'executive')}
                    className="px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left text-[#d4af37] truncate transition"
                  >
                    Executive // Chairman
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('reception@erbilhotel.iq', 'front_desk')}
                    className="px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left text-[#00f0ff] truncate transition"
                  >
                    Front Desk // Reception
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('housekeeping@erbilhotel.iq', 'housekeeping')}
                    className="px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left text-[#00e676] truncate transition"
                  >
                    Supervisor // Inspect
                  </button>
                  <button
                    type="button"
                    onClick={() => fillDemoAccount('envoy@diplomatic.org', 'guest')}
                    className="px-3 py-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-left text-white/90 truncate transition"
                  >
                    VIP Guest // Envoy
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* CREATE ACCOUNT FORM */}
          {tab === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dilan Barzani"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#00f0ff] px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Phone / WhatsApp</label>
                  <div className="relative">
                    <Phone className="w-3.5 h-3.5 text-white/40 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+964 750 816 9999"
                      className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#00f0ff] pl-8 pr-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-white/70 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@erbilhotel.iq"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#00f0ff] px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/70 mb-1">Password</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 4 chars"
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#00f0ff] px-3.5 py-2 text-xs text-white outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-white/70 mb-2">Assign Role</label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { id: 'guest', label: 'VIP Guest', desc: 'Suite Booking & Digital Key' },
                      { id: 'front_desk', label: 'Front Desk', desc: 'Reception & Check-In' },
                      { id: 'housekeeping', label: 'Housekeeping', desc: 'Turnover & Inspection' },
                      { id: 'executive', label: 'Executive', desc: 'Full Citadel Telemetry' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRole(item.id)}
                      className={`p-3 rounded-2xl border text-left transition-all ${
                        role === item.id
                          ? 'bg-[#00f0ff]/15 border-[#00f0ff] text-white shadow-lg'
                          : 'bg-white/[0.02] border-white/10 text-white/60 hover:border-white/25'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{item.label}</span>
                        {role === item.id && <Check className="w-3.5 h-3.5 text-[#00f0ff]" />}
                      </div>
                      <div className="text-[11px] text-white/45 mt-0.5">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00f0ff] to-[#00b8d4] hover:brightness-110 text-[#030305] text-xs font-semibold uppercase tracking-[0.16em] shadow-lg transition"
              >
                {isLoading ? 'Creating Profile...' : 'Create Account & Continue'}
              </button>
            </form>
          )}

          {/* MAGIC LINK / OTP */}
          {tab === 'magic' && (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <p className="text-xs text-white/65 leading-relaxed">
                Receive an instant passwordless Magic Link or One-Time Passcode. Automatically syncs
                your profile with Supabase Auth.
              </p>
              <div>
                <label className="block text-xs text-white/70 mb-1.5">Email Address</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="guest@diplomatic.org"
                  className="w-full rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#00e676] px-4 py-2.5 text-sm text-white outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00e676] to-[#00b85c] hover:brightness-110 text-[#030305] text-xs font-semibold uppercase tracking-[0.16em] shadow-lg transition"
              >
                {isLoading ? 'Sending OTP...' : 'Dispatch Magic Link'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-4 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-[11px] text-white/45">
          <span className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-[#d4af37]" />
            Erbil Hotel • Salem Street, Sulaymaniyah
          </span>
          <span className="font-mono tabular-nums">1 USD = 1,310 IQD</span>
        </div>
      </div>
    </div>
  );
};
