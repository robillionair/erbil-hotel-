import React, { useEffect, useState } from 'react';
import { useAuthStore, UserRole } from './store/useAuthStore';
import { useCitadelStore } from './store/useCitadelStore';
import { useHotelOpsStore } from './store/useHotelOpsStore';
import { AuthModal } from './auth/AuthModal';
import { LuxuryGuestPortal } from './portal/LuxuryGuestPortal';
import { StandardOpsDashboard } from './portal/StandardOpsDashboard';
import { CitadelShell } from './citadel-mode/CitadelShell';
import { User, LogOut, Sparkles, Cpu } from 'lucide-react';

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

  const showLuxuryGuestPortal =
    !citadelMode &&
    (portalSubView === 'guest_portal' || (portalSubView === 'auto' && activeRole === 'guest'));

  return (
    <div className="min-h-screen bg-[#030305] text-[#f4f0ea] flex flex-col">
      {/* SLEEK GLASSMORPHIC TOP NAVIGATION BAR (56px) */}
      <header className="h-[56px] glass-panel border-x-0 border-t-0 border-b border-white/10 px-4 sm:px-6 flex items-center justify-between gap-3 z-50 shrink-0 select-none">
        {/* Left Brand Emblem & Surface Pills */}
        <div className="flex items-center gap-3 overflow-x-auto">
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/assets/logo/erbil-hotel-logo.jpeg"
              alt="Erbil Hotel"
              className="w-8 h-8 rounded-xl object-cover border border-[#d4af37]/60"
            />
            <span className="font-serif text-lg tracking-wide text-white hidden sm:inline">
              Erbil Hotel
            </span>
          </div>

          {!citadelMode && (
            <div className="flex items-center gap-1 p-1 rounded-full bg-white/[0.04] border border-white/10 text-xs">
              <button
                onClick={() => setPortalSubView('guest_portal')}
                className={`px-3.5 py-1 rounded-full font-medium transition ${
                  showLuxuryGuestPortal
                    ? 'bg-gradient-to-r from-[#d4af37] to-[#b89225] text-[#030305] font-semibold shadow'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Luxury Guest Portal
              </button>
              <button
                onClick={() => setPortalSubView('staff_ops')}
                className={`px-3.5 py-1 rounded-full font-medium transition ${
                  !showLuxuryGuestPortal
                    ? 'bg-gradient-to-r from-[#00f0ff] to-[#00b8d4] text-[#030305] font-semibold shadow'
                    : 'text-white/65 hover:text-white'
                }`}
              >
                Operations Workspace
              </button>
            </div>
          )}
        </div>

        {/* Center Smooth Pill Role Switcher */}
        <div className="hidden lg:flex items-center gap-1 p-1 rounded-full bg-white/[0.03] border border-white/10 text-xs">
          {(
            [
              { id: 'guest', label: 'Guest' },
              { id: 'front_desk', label: 'Front Desk' },
              { id: 'housekeeping', label: 'Housekeeping' },
              { id: 'executive', label: 'Executive' },
            ] as const
          ).map((r) => {
            const isAct = activeRole === r.id;
            return (
              <button
                key={r.id}
                onClick={() => handleRoleQuickSwitch(r.id)}
                className={`px-3.5 py-1 rounded-full font-medium transition-all ${
                  isAct
                    ? 'bg-white/15 text-[#d4af37] border border-[#d4af37]/40 shadow-sm'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        {/* Right: Citadel Mode 3D Engine Pill + Account Popover Button */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => toggleCitadelMode()}
            title="Shortcut: Ctrl+Shift+L"
            className={`px-4 py-1.5 rounded-full text-xs font-medium flex items-center gap-2 transition-all border ${
              citadelMode
                ? 'bg-[#00e676]/20 border-[#00e676] text-[#00e676] shadow-[0_0_25px_rgba(0,230,118,0.3)]'
                : 'glass-pill border-[#d4af37]/50 text-[#d4af37] hover:bg-[#d4af37] hover:text-[#030305]'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Citadel 3D Telemetry: {citadelMode ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => openAuthModal('signin')}
            className="glass-pill px-3.5 py-1.5 rounded-full text-xs text-white/90 hover:text-white flex items-center gap-2 transition"
          >
            <User className="w-3.5 h-3.5 text-[#d4af37]" />
            <span className="hidden md:inline max-w-[130px] truncate">
              {user?.fullName || 'Sign In'}
            </span>
          </button>

          {user && user.id !== 'guest-public' && (
            <button
              onClick={() => signOut()}
              title="Sign Out"
              className="w-8 h-8 rounded-full glass-pill flex items-center justify-center text-white/55 hover:text-[#ff1e7a] hover:border-[#ff1e7a]/50 transition"
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
