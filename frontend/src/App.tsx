import { useEffect, useState, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';

// eager load auth components
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ForgotPassword } from './pages/ForgotPassword';
import { ResetPassword } from './pages/ResetPassword';

// lazy load script editor pages
const ScriptWriterDashboard = lazy(() => import('./pages/ScriptWriter/ScriptWriterDashboard').then(m => ({ default: m.ScriptWriterDashboard })));
const ScriptWriterInfinite = lazy(() => import('./pages/ScriptWriter/ScriptWriterInfinite').then(m => ({ default: m.ScriptWriterInfinite })));
const MasterScriptReaderPage = lazy(() => import('./pages/ScriptWriter/MasterScriptReaderPage').then(m => ({ default: m.MasterScriptReaderPage })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));
const NotFound = lazy(() => import('./pages/NotFound').then(m => ({ default: m.NotFound })));
const LandingPage = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const DocsPage = lazy(() => import('./pages/DocsPage').then(m => ({ default: m.DocsPage })));

import { useAuthStore } from './stores/authStore';
import { useUIStore } from './stores/uiStore';
import { ACCENT_COLORS } from './config/accents';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/layout/Layout';
import { ToastContainer } from './components/ui/Toast';
import { VerificationBanner, VerificationOverlay } from './components/ui';
import { AIProvider } from './contexts/AIContext';
import { ScriptWriterProvider } from './contexts/ScriptWriterContext';
import { GlobalAIWidget, GlobalAIWidgetWithAuth } from './components/GlobalAIWidget';
import { useThemeStore } from './stores/themeStore';
import { useMobile } from './hooks/useMobile';
import { MobileGate } from './components/MobileGate';
import { api } from './services/api';

// Loading Screen
function LoadingScreen() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--console-bg)' }}
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin shadow-[0_0_30px_rgba(var(--brand-primary-rgb),0.15)]"
          style={{ borderColor: 'var(--border-subtle)', borderTopColor: 'var(--brand-primary)' }}
        />
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-tertiary">Hydrating Workspace</p>
      </div>
    </div>
  );
}

// Protected Route wrapper
function ProtectedRoute({ children, useLayout = true }: { children: React.ReactNode; useLayout?: boolean }) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const [isChecking, setIsChecking] = useState(!isAuthenticated);
  const location = useLocation();
  const { isMobile } = useMobile();

  useEffect(() => {
    if (isAuthenticated) {
      setIsChecking(false);
      return;
    }

    let mounted = true;

    const verify = async () => {
      const timeout = setTimeout(() => {
        if (mounted) setIsChecking(false);
      }, 5000);

      try {
        await checkAuth();
      } finally {
        clearTimeout(timeout);
        if (mounted) {
          setIsChecking(false);
        }
      }
    };

    verify();

    return () => {
      mounted = false;
    };
  }, [checkAuth, isAuthenticated]);

  if (isChecking) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Gate mobile users — show "use desktop" screen instead of the app
  if (isMobile) {
    return <MobileGate />;
  }

  if (user && !user.emailVerified && location.pathname !== '/settings') {
    return <VerificationOverlay />;
  }

  if (!useLayout) {
    return (
      <>
        <VerificationBanner />
        {children}
      </>
    );
  }

  return (
    <Layout banner={<VerificationBanner />}>
      {children}
    </Layout>
  );
}

// Public Route wrapper
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function hexToHue(hex: string): number {
  let r = 0, g = 0, b = 0;
  try {
    let cleanHex = hex.trim().replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }
    if (cleanHex.length !== 6) return 35;
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return 35;
  } catch (e) {
    return 35;
  }
  
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0;
  if (max !== min) {
    const d = max - min;
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return h * 360;
}

function hexToRgb(hex: string): { r: number, g: number, b: number } | null {
  try {
    let cleanHex = hex.trim().replace('#', '');
    if (cleanHex.length === 3) {
      cleanHex = cleanHex[0] + cleanHex[0] + cleanHex[1] + cleanHex[1] + cleanHex[2] + cleanHex[2];
    }
    if (cleanHex.length !== 6) return null;
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16)
    };
  } catch (e) { return null; }
}

function App() {
  const { user } = useAuthStore();
  const { theme, effectiveTheme } = useThemeStore();
  const { accentColor, customAccentColor, aiAccentColor, backgroundTinting, reducedMotion } = useUIStore();

  useEffect(() => {
    if (!user) return;

    const hasDiff = 
      user.theme !== theme ||
      user.accentColor !== accentColor ||
      user.customAccentColor !== customAccentColor ||
      user.aiAccentColor !== aiAccentColor ||
      user.backgroundTinting !== backgroundTinting ||
      user.reducedMotion !== reducedMotion;

    if (!hasDiff) return;

    const timer = setTimeout(async () => {
      try {
        const response = await api.updateProfile({
          theme,
          accentColor,
          customAccentColor,
          aiAccentColor,
          backgroundTinting,
          reducedMotion
        });
        if (response?.user) {
          useAuthStore.setState({ user: response.user });
        }
      } catch (err) {
        console.error('Failed to sync visual preferences to server:', err);
      }
    }, 1000); // 1-second debounce

    return () => clearTimeout(timer);
  }, [user, theme, accentColor, customAccentColor, aiAccentColor, backgroundTinting, reducedMotion]);

  useEffect(() => {
    const root = window.document.documentElement;
    root?.classList.remove('light', 'dark');
    root?.classList.add(effectiveTheme);

    // 1. Determine Accent OKLCH
    let l = 0.65, c = 0.15, h = 35;
    let hex = '#EB644B';

    if (accentColor === 'custom' && customAccentColor) {
      let cleanHex = customAccentColor.trim();
      if (!cleanHex.startsWith('#')) cleanHex = '#' + cleanHex;
      
      if (/^#([0-9A-F]{3}){1,2}$/i.test(cleanHex)) {
        hex = cleanHex;
        h = hexToHue(hex);
        l = theme === 'dark' ? 0.62 : 0.58; 
        c = 0.16;
      } else {
        const accent = ACCENT_COLORS.terracotta;
        const parts = accent.oklch.split(' ').map(parseFloat);
        l = parts[0];
        c = parts[1];
        h = parts[2];
        hex = accent.hex;
      }
    } else {
      const accent = ACCENT_COLORS[accentColor] || ACCENT_COLORS.terracotta;
      const parts = accent.oklch.split(' ').map(parseFloat);
      l = parts[0];
      c = parts[1];
      h = parts[2];
      hex = accent.hex;
    }

    // 2. Apply Accent Variables
    root.style.setProperty('--accent', `oklch(${l} ${c} ${h})`);
    root.style.setProperty('--accent-hover', `oklch(${l + 0.05} ${c + 0.02} ${h})`);
    root.style.setProperty('--accent-soft', `oklch(${l} ${c} ${h} / 0.12)`);
    root.style.setProperty('--accent-hex', hex);
    
    const rgb = hexToRgb(hex);
    if (rgb) {
      root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty('--accent-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty('--brand-primary-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
    }
    
    root.style.setProperty('--accent-primary', `oklch(${l} ${c} ${h})`);
    root.style.setProperty('--brand-primary', `oklch(${l} ${c} ${h})`);
    root.style.setProperty('--brand-soft', `oklch(${l} ${c} ${h} / 0.15)`);

    // 3. Apply Background Tinting
    if (backgroundTinting) {
      if (theme === 'dark') {
        root.style.setProperty('--surface-page', 'oklch(0.08 0.005 250)');
        root.style.setProperty('--surface-sidebar', 'oklch(0.06 0.005 250)');
        root.style.setProperty('--surface-elevated', 'oklch(0.12 0.005 250)');
        root.style.setProperty('--surface-overlay', 'oklch(0 0 0 / 0.85)');
        root.style.setProperty('--bg-glow', `radial-gradient(circle at 50% -20%, oklch(${l} ${c} ${h} / 0.06), transparent 70%)`);
      } else {
        root.style.setProperty('--surface-page', 'oklch(0.99 0.002 250)');
        root.style.setProperty('--surface-sidebar', 'oklch(0.97 0.002 250)');
        root.style.setProperty('--surface-elevated', 'oklch(1.0 0 0)');
        root.style.setProperty('--surface-overlay', 'oklch(1.0 0.002 250 / 0.8)');
        root.style.setProperty('--bg-glow', `radial-gradient(circle at 50% -20%, oklch(${l} ${c} ${h} / 0.03), transparent 70%)`);
      }
    } else {
      root.style.removeProperty('--surface-page');
      root.style.removeProperty('--surface-sidebar');
      root.style.removeProperty('--surface-elevated');
      root.style.removeProperty('--surface-overlay');
      root.style.setProperty('--bg-glow', 'none');
    }

    if (reducedMotion) {
      root?.classList.add('reduced-motion');
    } else {
      root?.classList.remove('reduced-motion');
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const bgColor = theme === 'dark' ? '#0b0f14' : '#ffffff';
      metaThemeColor.setAttribute('content', bgColor);
    }

    // 4. AI Assistant Accent — match the main accent
    root.style.setProperty('--ai-accent', `oklch(${l} ${c} ${h})`);
    root.style.setProperty('--ai-accent-soft', `oklch(${l} ${c} ${h} / 0.1)`);
    
    // 5. Expand VS Code style semantic tokens
    if (theme === 'dark') {
      root.style.setProperty('--surface-toolbar', 'oklch(0.12 0.005 250)');
      root.style.setProperty('--surface-tab-active', 'oklch(0.15 0.005 250)');
      root.style.setProperty('--surface-input', 'oklch(0.05 0.005 250)');
      root.style.setProperty('--border-focus', `oklch(${l} ${c} ${h})`);
    } else {
      root.style.setProperty('--surface-toolbar', 'oklch(0.96 0.002 250)');
      root.style.setProperty('--surface-tab-active', 'oklch(1 0 0)');
      root.style.setProperty('--surface-input', 'oklch(0.98 0.002 250)');
      root.style.setProperty('--border-focus', `oklch(${l} ${c} ${h})`);
    }

  }, [accentColor, customAccentColor, aiAccentColor, backgroundTinting, theme, reducedMotion]);

  return (
    <ErrorBoundary>
      <AIProvider>
        <ScriptWriterProvider>
          <ToastContainer />
          <BrowserRouter>
            <Routes>
              {/* Public routes */}
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <PublicRoute>
                    <Register />
                  </PublicRoute>
                }
              />
              <Route
                path="/forgot-password"
                element={
                  <PublicRoute>
                    <ForgotPassword />
                  </PublicRoute>
                }
              />
              <Route
                path="/reset-password"
                element={
                  <PublicRoute>
                    <ResetPassword />
                  </PublicRoute>
                }
              />

              {/* Public landing page */}
              <Route
                path="/"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <LandingPage />
                  </Suspense>
                }
              />

              {/* Protected routes - direct screenplay paths */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingScreen />}>
                      <ScriptWriterDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/script-writer"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingScreen />}>
                      <ScriptWriterDashboard />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/script-writer/master-script/:scriptId"
                element={
                  <ProtectedRoute useLayout={false}>
                    <Suspense fallback={<LoadingScreen />}>
                      <MasterScriptReaderPage />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/script-writer/:projectId/:sceneId?"
                element={
                  <ProtectedRoute useLayout={false}>
                    <Suspense fallback={<LoadingScreen />}>
                      <ScriptWriterInfinite />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<LoadingScreen />}>
                      <Settings />
                    </Suspense>
                  </ProtectedRoute>
                }
              />

              <Route
                path="/docs"
                element={
                  <Suspense fallback={<LoadingScreen />}>
                    <DocsPage />
                  </Suspense>
                }
              />

              {/* 404 — Proper not-found page */}
              <Route path="*" element={
                <ProtectedRoute>
                  <Suspense fallback={<LoadingScreen />}>
                    <NotFound />
                  </Suspense>
                </ProtectedRoute>
              } />
            </Routes>
            <GlobalAIWidgetWithAuth />
          </BrowserRouter>
        </ScriptWriterProvider>
      </AIProvider>
    </ErrorBoundary>
  );
}

export default App;
