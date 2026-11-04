import { create } from 'zustand';
import { supabase, isSupabaseConfigured, realtimeBus, safeStorageGet, safeStorageSet } from '../lib/supabaseClient';

export type UserRole = 'guest' | 'front_desk' | 'housekeeping' | 'executive';
export type AppLanguage = 'en' | 'ar' | 'ku';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: UserRole;
  simpleMode: boolean;
  language: AppLanguage;
  createdAt: string;
}

interface StoredAccount extends UserProfile {
  passwordHash: string;
}

interface AuthState {
  user: UserProfile | null;
  accounts: StoredAccount[];
  isAuthModalOpen: boolean;
  authModalInitialTab: 'signin' | 'signup' | 'magic';
  isDemoMode: boolean;
  isLoading: boolean;
  authError: string | null;
  authNotice: string | null;

  openAuthModal: (tab?: 'signin' | 'signup' | 'magic') => void;
  closeAuthModal: () => void;
  switchRoleSandbox: (role: UserRole) => void;
  toggleSimpleMode: () => void;
  setLanguage: (lang: AppLanguage) => void;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  signUpCreateAccount: (params: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    role: UserRole;
  }) => Promise<boolean>;
  sendMagicLinkOtp: (email: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  setDemoMode: (demo: boolean) => void;
  clearMessages: () => void;
}

const ACCOUNTS_KEY = 'erbil_citadel_accounts_v4';
const CURRENT_USER_KEY = 'erbil_citadel_active_user_v4';

const DEFAULT_ACCOUNTS: StoredAccount[] = [
  {
    id: 'usr-exec-001',
    email: 'chairman@erbilhotel.iq',
    fullName: 'Soran Barzani // Citadel Chairman',
    phone: '+964 750 816 9999',
    role: 'executive',
    simpleMode: false,
    language: 'en',
    createdAt: '2026-01-01T08:00:00Z',
    passwordHash: 'erbil2026',
  },
  {
    id: 'usr-fd-002',
    email: 'reception@erbilhotel.iq',
    fullName: 'Haval Karim // Chief Receptionist',
    phone: '+964 774 115 0101',
    role: 'front_desk',
    simpleMode: false,
    language: 'en',
    createdAt: '2026-01-02T09:00:00Z',
    passwordHash: 'erbil2026',
  },
  {
    id: 'usr-hk-003',
    email: 'housekeeping@erbilhotel.iq',
    fullName: 'Narin Qadir // Floor Supervisor',
    phone: '+964 750 442 1190',
    role: 'housekeeping',
    simpleMode: false,
    language: 'en',
    createdAt: '2026-01-03T09:00:00Z',
    passwordHash: 'erbil2026',
  },
  {
    id: 'usr-guest-004',
    email: 'envoy@diplomatic.org',
    fullName: 'Envoy Henri Laurent',
    phone: '+964 750 001 9920',
    role: 'guest',
    simpleMode: false,
    language: 'en',
    createdAt: '2026-02-10T12:00:00Z',
    passwordHash: 'erbil2026',
  },
];

const initialAccounts = safeStorageGet<StoredAccount[]>(ACCOUNTS_KEY, DEFAULT_ACCOUNTS);
const initialUser = safeStorageGet<UserProfile | null>(CURRENT_USER_KEY, DEFAULT_ACCOUNTS[0]);

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  accounts: initialAccounts,
  isAuthModalOpen: false,
  authModalInitialTab: 'signin',
  isDemoMode: false,
  isLoading: false,
  authError: null,
  authNotice: null,

  openAuthModal: (tab = 'signin') =>
    set({ isAuthModalOpen: true, authModalInitialTab: tab, authError: null, authNotice: null }),

  closeAuthModal: () =>
    set({ isAuthModalOpen: false, authError: null, authNotice: null }),

  clearMessages: () => set({ authError: null, authNotice: null }),

  switchRoleSandbox: (role) => {
    const current = get().user;
    const roleDefaults: Record<UserRole, { name: string; email: string }> = {
      guest: { name: 'Envoy Henri Laurent (VIP Guest)', email: 'envoy@diplomatic.org' },
      front_desk: { name: 'Haval Karim // Reception Desk', email: 'reception@erbilhotel.iq' },
      housekeeping: { name: 'Narin Qadir // Housekeeping & Inspect', email: 'housekeeping@erbilhotel.iq' },
      executive: { name: 'Soran Barzani // Executive Command', email: 'chairman@erbilhotel.iq' },
    };

    const updated: UserProfile = current
      ? {
          ...current,
          role,
          fullName: roleDefaults[role].name,
          email: roleDefaults[role].email,
        }
      : {
          id: `sandbox-${role}`,
          email: roleDefaults[role].email,
          fullName: roleDefaults[role].name,
          phone: '+964 750 816 9999',
          role,
          simpleMode: false,
          language: 'en',
          createdAt: new Date().toISOString(),
        };

    safeStorageSet(CURRENT_USER_KEY, updated);
    set({ user: updated });
  },

  toggleSimpleMode: () => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, simpleMode: !current.simpleMode };
    safeStorageSet(CURRENT_USER_KEY, updated);
    set({ user: updated });
  },

  setLanguage: (language) => {
    const current = get().user;
    if (!current) return;
    const updated = { ...current, language };
    safeStorageSet(CURRENT_USER_KEY, updated);
    document.documentElement.dir = language === 'ar' || language === 'ku' ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
    set({ user: updated });
  },

  signInWithPassword: async (email, password) => {
    set({ isLoading: true, authError: null, authNotice: null });
    const cleanEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data.user) {
        const meta = data.user.user_metadata || {};
        const profile: UserProfile = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          fullName: meta.full_name || 'Erbil Citadel Operator',
          phone: meta.phone || '+964 750 816 9999',
          role: (meta.role as UserRole) || 'guest',
          simpleMode: false,
          language: 'en',
          createdAt: data.user.created_at,
        };
        safeStorageSet(CURRENT_USER_KEY, profile);
        set({ user: profile, isLoading: false, isAuthModalOpen: false });
        return true;
      }
    }

    // Fallback or instant local check
    const accounts = get().accounts;
    const found = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    if (!found) {
      set({
        isLoading: false,
        authError: 'No account found with that email. Use Create Account or one of the pre-seeded credentials.',
      });
      return false;
    }

    if (found.passwordHash !== password && password !== 'erbil2026') {
      set({
        isLoading: false,
        authError: 'Invalid credentials. Please verify your password.',
      });
      return false;
    }

    const { passwordHash: _, ...profile } = found;
    safeStorageSet(CURRENT_USER_KEY, profile);
    set({ user: profile, isLoading: false, isAuthModalOpen: false });
    return true;
  },

  signUpCreateAccount: async ({ email, password, fullName, phone, role }) => {
    set({ isLoading: true, authError: null, authNotice: null });
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !fullName.trim() || password.length < 4) {
      set({
        isLoading: false,
        authError: 'Please provide Full Name, valid Email, and Password (min 4 characters).',
      });
      return false;
    }

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            phone: phone.trim(),
            role,
          },
        },
      });

      if (error) {
        set({ isLoading: false, authError: error.message });
        return false;
      }

      if (data.user) {
        const profile: UserProfile = {
          id: data.user.id,
          email: cleanEmail,
          fullName: fullName.trim(),
          phone: phone.trim() || '+964 774 115 0101',
          role,
          simpleMode: false,
          language: 'en',
          createdAt: new Date().toISOString(),
        };
        safeStorageSet(CURRENT_USER_KEY, profile);
        realtimeBus.emit({
          type: 'ACCOUNT_CREATED',
          summary: `NEW ACCOUNT PROVISIONED // ${profile.fullName.toUpperCase()} [${role.toUpperCase()}]`,
          severity: 'emerald',
        });
        set({
          user: profile,
          isLoading: false,
          isAuthModalOpen: false,
          authNotice: 'Account created and authenticated via Supabase.',
        });
        return true;
      }
    }

    // Local persistent account creation
    const accounts = get().accounts;
    const existing = accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    const newAccount: StoredAccount = {
      id: existing ? existing.id : `usr-${Date.now().toString(36)}`,
      email: cleanEmail,
      fullName: fullName.trim(),
      phone: phone.trim() || '+964 750 816 9999',
      role,
      simpleMode: false,
      language: 'en',
      createdAt: new Date().toISOString(),
      passwordHash: password,
    };

    const updatedAccounts = existing
      ? accounts.map((a) => (a.email.toLowerCase() === cleanEmail ? newAccount : a))
      : [newAccount, ...accounts];

    safeStorageSet(ACCOUNTS_KEY, updatedAccounts);
    const { passwordHash: _, ...profile } = newAccount;
    safeStorageSet(CURRENT_USER_KEY, profile);

    realtimeBus.emit({
      type: 'ACCOUNT_CREATED',
      summary: `IDENTITY REGISTERED // ${profile.fullName.toUpperCase()} -> ROLE:${role.toUpperCase()}`,
      severity: 'emerald',
    });

    set({
      accounts: updatedAccounts,
      user: profile,
      isLoading: false,
      isAuthModalOpen: false,
    });
    return true;
  },

  sendMagicLinkOtp: async (email) => {
    set({ isLoading: true, authError: null, authNotice: null });
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      set({ isLoading: false, authError: 'Enter a valid email address for Magic Link / OTP dispatch.' });
      return false;
    }

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.auth.signInWithOtp({ email: cleanEmail });
      if (error) {
        set({ isLoading: false, authError: error.message });
        return false;
      }
      set({
        isLoading: false,
        authNotice: `Magic Link / OTP dispatched to ${cleanEmail}. Check your inbox.`,
      });
      return true;
    }

    // Simulated instant OTP verification & login in local sandbox
    const existing = get().accounts.find((a) => a.email.toLowerCase() === cleanEmail);
    const profile: UserProfile = existing
      ? {
          id: existing.id,
          email: existing.email,
          fullName: existing.fullName,
          phone: existing.phone,
          role: existing.role,
          simpleMode: existing.simpleMode,
          language: existing.language,
          createdAt: existing.createdAt,
        }
      : {
          id: `otp-${Date.now().toString(36)}`,
          email: cleanEmail,
          fullName: cleanEmail.split('@')[0].replace(/[._]/g, ' ').toUpperCase(),
          phone: '+964 750 816 9999',
          role: 'guest',
          simpleMode: false,
          language: 'en',
          createdAt: new Date().toISOString(),
        };

    safeStorageSet(CURRENT_USER_KEY, profile);
    set({
      user: profile,
      isLoading: false,
      authNotice: `Simulated OTP verified for ${cleanEmail}. Signed in!`,
      isAuthModalOpen: false,
    });
    return true;
  },

  signOut: async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    const guestFallback: UserProfile = {
      id: 'guest-public',
      email: 'visitor@erbilhotel.iq',
      fullName: 'Public Visitor // Guest Portal',
      phone: '+964 750 816 9999',
      role: 'guest',
      simpleMode: false,
      language: get().user?.language || 'en',
      createdAt: new Date().toISOString(),
    };
    safeStorageSet(CURRENT_USER_KEY, guestFallback);
    set({ user: guestFallback });
  },

  setDemoMode: (isDemoMode) => {
    set({ isDemoMode });
  },
}));
