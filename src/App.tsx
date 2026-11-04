import React, { useEffect, useState } from 'react';
import { useAuthStore, UserRole } from './store/useAuthStore';
import { useCitadelStore } from './store/useCitadelStore';
import { useHotelOpsStore } from './store/useHotelOpsStore';
import { AuthModal } from './auth/AuthModal';
import { LuxuryGuestPortal } from './portal/LuxuryGuestPortal';
import { StandardOpsDashboard } from './portal/StandardOpsDashboard';
import { CitadelShell } from './citadel-mode/CitadelShell';
import { User, LogOut } from 'lucide-react';

export const App: React.FC = () => {
  const { user, switchRoleSandbox, openAuthModal, signOut } = useAuthStore();
  const {
    citadelMode,
    toggleCitadelMode,
    evaluateFrameThrottle,
    recordInteraction,
  } = useCitadelStore();
  const { initializeRealtimeSync } = useHotelOpsStore();

  const [portalSubView, setPortalSubView] = useState<'auto' | 'guest_portal' | 'staff_ops'>('auto');

  // Initialize Realtime bus & Supabase subscription once on mount
  useEffect(() => {
    initializeRealtimeSync();
  }, [initializeRealtimeSync]);

  // Global Ctrl+Shift+L Shortcut for CITADEL MODE + Smart Frame Throttler Heartbeat
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        toggleCitadelMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    const interval = window.setInterval(() => {
      evaluateFrameThrottle(document.hasFocus());
    }, 1000);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clearInterval(interval);
    };
  }, [toggleCitadelMode, evaluateFrameThrottle]);

  const activeRole: UserRole = user?.role || 'executive';

  const handleRoleQuickSwitch = (role: UserRole) => {
    switchRoleSandbox(role);
    setPortalSubView('auto');
    recordInteraction();
  };

  // Determine which view renders when Citadel Mode is OFF
  const showLuxuryGuestPortal =
    !citadelMode &&
    (portalSubView === 'guest_portal' || (portalSubView === 'auto' && activeRole === 'guest'));

  return (
    <div className="min-h-screen bg-[#030305] text-[#f4f0ea] flex flex-col">
      {/* BRUTALIST TOP COMMAND BAR (44px) */}
      <header className="h-[44px] bg-[#040406] border-b border-[#16161a] px-3 flex items-center justify-between gap-2 font-mono text-[10px] z-50 shrink-0 select-none">
        {/* Left Brand & Surface Switcher */}
        <div className="flex items-center gap-2.5 overflow-x-auto">
          <div className="flex items-center gap-2 shrink-0">
            <img
              src="/assets/logo/erbil-hotel-logo.jpeg"
              alt="Erbil Hotel"
              className="w-6 h-6 object-cover border border-[#d4af37]"
            />
            <span className="font-bold tracking-[0.16em] text-[#f4f0ea] hidden sm:inline">
              ERBIL.HOTEL // OPS
            </span>
          </div>

          {!citadelMode && (
            <div className="flex items-center gap-1 border-l border-[#1c1c24] pl-2.5">
              <button
                onClick={() => setPortalSubView('guest_portal')}
                className={`px-2 py-1 uppercase transition ${
                  showLuxuryGuestPortal
                    ? 'bg-[#d4af37] text-[#030305] font-bold'
                    : 'bg-[#0a0a0e] text-[#888895] hover:text-[#f4f0ea]'
                }`}
              >
                Luxury Guest Portal
              </button>
              <button
                onClick={() => setPortalSubView('staff_ops')}
                className={`px-2 py-1 uppercase transition ${
                  !showLuxuryGuestPortal
                    ? 'bg-[#00f0ff] text-[#030305] font-bold'
                    : 'bg-[#0a0a0e] text-[#888895] hover:text-[#f4f0ea]'
                }`}
              >
                Swiss-Grid Staff Ops
              </button>
            </div>
          )}
        </div>

        {/* Center Brutalist Role Sandbox Quick-Switcher */}
        <div className="hidden lg:flex items-center gap-1 bg-[#08080c] border border-[#1c1c24] px-2 py-1">
          <span className="text-[#686875] mr-1">[ ROLE:</span>
          {(
            [
              { id: 'guest', label: 'GUEST' },
              { id: 'front_desk', label: 'FRONT DESK' },
              { id: 'housekeeping', label: 'HOUSEKEEPING' },
              { id: 'executive', label: 'EXECUTIVE' },
            ] as const
          ).map((r, idx) => (
            <React.Fragment key={r.id}>
              <button
                onClick={() => handleRoleQuickSwitch(r.id)}
                className={`px-1.5 py-0.5 transition ${
                  activeRole === r.id
                    ? 'bg-[#d4af37] text-[#030305] font-bold'
                    : 'text-[#888895] hover:text-[#f4f0ea]'
                }`}
              >
                {r.label}
              </button>
              {idx < 3 && <span className="text-[#32323e]">|</span>}
            </React.Fragment>
          ))}
          <span className="text-[#686875] ml-1">]</span>
        </div>

        {/* Right: CITADEL MODE TOGGLE + AUTH ACCOUNT CONTROLS */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => toggleCitadelMode()}
            title="Shortcut: Ctrl+Shift+L"
            className={`px-3 py-1.5 border font-bold tracking-[0.14em] uppercase transition ${
              citadelMode
                ? 'bg-[#00e676]/15 border-[#00e676] text-[#00e676]'
                : 'bg-[#0a0a10] border-[#d4af37]/60 text-[#d4af37] hover:bg-[#d4af37] hover:text-[#030305]'
            }`}
          >
            [ CITADEL MODE: {citadelMode ? 'ON' : 'OFF'} ]
          </button>

          <button
            onClick={() => openAuthModal('signin')}
            className="px-2.5 py-1.5 bg-[#0a0a0e] hover:bg-[#14141d] border border-[#22222c] text-[#f4f0ea] flex items-center gap-1.5"
          >
            <User className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="hidden md:inline max-w-[130px] truncate">
              {user?.fullName || 'Sign In / Account'}
            </span>
          </button>

          {user && user.id !== 'guest-public' && (
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="p-1.5 bg-[#0a0a0e] hover:bg-[#ff1e7a]/20 border border-[#22222c] hover:border-[#ff1e7a] text-[#888895] hover:text-[#ff1e7a]"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ACTIVE ENVIRONMENT SURFACE */}
      <div className="flex-1 relative">
        {citadelMode ? (
          <CitadelShell />
        ) : showLuxuryGuestPortal ? (
          <LuxuryGuestPortal onSwitchToOps={() => setPortalSubView('staff_ops')} />
        ) : (
          <StandardOpsDashboard />
        )}
      </div>

      {/* AUTHENTICATION & CREATE ACCOUNT MODAL */}
      <AuthModal />
    </div>
  );
};

export default App;
