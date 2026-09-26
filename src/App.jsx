import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ComposeCard from './components/ComposeCard';
import HistoryView from './components/HistoryView';
import DownloadLandingPage from './components/DownloadLandingPage';
import SettingsModal from './components/SettingsModal';
import EmailPreviewModal from './components/EmailPreviewModal';
import ToastContainer from './components/ToastContainer';
import ChatView from './components/chat/ChatView';
import AuthModal from './components/chat/AuthModal';
import AuthPage from './components/AuthPage';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';

function AppContent() {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  const { toasts, addToast, removeToast } = useToast();
  const { currentUser, token, isAuthenticated, loading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState(() => {
    const hash = window.location.hash;
    if (hash === '#signup' || hash === '#register') return 'signup';
    if (hash === '#chat') return 'chat';
    if (hash === '#history') return 'history';
    if (hash === '#compose') return 'compose';
    return 'login'; // Defaults to Login / Signup on website open
  });
  const [downloadToken, setDownloadToken] = useState(null);

  // Settings state with localStorage persistence
  const [defaultExpiry, setDefaultExpiry] = useState(() => {
    try {
      const stored = localStorage.getItem('aerodrop_default_expiry');
      return stored ? parseInt(stored, 10) : 7;
    } catch (e) {
      return 7;
    }
  });

  const [defaultDownloadLimit, setDefaultDownloadLimit] = useState(null);
  const [defaultSenderEmail, setDefaultSenderEmail] = useState(() => {
    try {
      return localStorage.getItem('aerodrop_default_sender') || '';
    } catch (e) {
      return '';
    }
  });
  const [notifyOnDownload, setNotifyOnDownload] = useState(true);

  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [targetEmailToken, setTargetEmailToken] = useState(null);
  const [outboxCount, setOutboxCount] = useState(0);

  // Detect hash in URL on load and hashchange
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#download/')) {
        const urlToken = hash.replace('#download/', '');
        setDownloadToken(urlToken);
      } else if (hash === '#signup' || hash === '#register') {
        setDownloadToken(null);
        setActiveTab('signup');
      } else if (hash === '#chat') {
        setDownloadToken(null);
        setActiveTab('chat');
      } else if (hash === '#compose') {
        setDownloadToken(null);
        setActiveTab('compose');
      } else if (hash === '#history') {
        setDownloadToken(null);
        setActiveTab('history');
      } else {
        // Root path / or #login: ALWAYS display login / signup view
        setDownloadToken(null);
        setActiveTab('login');
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Update outbox count (requires authentication)
  const refreshOutboxCount = async () => {
    if (!token) {
      setOutboxCount(0);
      return;
    }
    try {
      const res = await fetch('/api/emails', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setOutboxCount(data.emails?.length || 0);
      }
    } catch (err) {}
  };

  useEffect(() => {
    refreshOutboxCount();
  }, [token]);

  const handleOpenLandingPage = (tok) => {
    window.location.hash = `#download/${tok}`;
    setDownloadToken(tok);
  };

  const handleBackToCompose = () => {
    window.location.hash = '';
    setDownloadToken(null);
    setActiveTab('compose');
  };

  const handleViewEmail = (tok) => {
    setTargetEmailToken(tok);
    setIsEmailModalOpen(true);
  };

  const handleTabChange = (tab) => {
    // If user is not authenticated and attempts to open protected features, redirect to login
    if (!isAuthenticated && tab !== 'login' && tab !== 'signup') {
      addToast({
        type: 'warning',
        title: 'Authentication Required',
        message: 'Please sign in or create an account to access AeroDrop transfers and chat.',
      });
      window.location.hash = '#login';
      setDownloadToken(null);
      setActiveTab('login');
      return;
    }

    if (tab === 'emails') {
      setIsEmailModalOpen(true);
    } else if (tab === 'login') {
      window.location.hash = '#login';
      setDownloadToken(null);
      setActiveTab('login');
    } else if (tab === 'signup') {
      window.location.hash = '#signup';
      setDownloadToken(null);
      setActiveTab('signup');
    } else if (tab === 'chat') {
      window.location.hash = '#chat';
      setDownloadToken(null);
      setActiveTab('chat');
    } else {
      handleBackToCompose();
      setActiveTab(tab);
    }
  };

  if (authLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-app)',
          color: 'var(--text-main)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              border: '3px solid var(--border-subtle)',
              borderTopColor: 'var(--accent-primary)',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px auto',
            }}
          />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Securing Session...
          </div>
        </div>
      </div>
    );
  }

  // Determine what view to render
  const renderMainView = () => {
    // 1. Recipient download page (always accessible with token)
    if (downloadToken) {
      return (
        <DownloadLandingPage
          token={downloadToken}
          onBackToCompose={handleBackToCompose}
        />
      );
    }

    // 2. Utmost Authentication Gate: If unauthenticated or explicitly on login/signup tabs
    if (!isAuthenticated || activeTab === 'login' || activeTab === 'signup') {
      return (
        <AuthPage
          initialMode={activeTab === 'signup' ? 'register' : 'login'}
          onNavigate={handleTabChange}
          showToast={addToast}
        />
      );
    }

    // 3. Authenticated protected routes
    if (activeTab === 'chat') {
      return (
        <ChatView
          showToast={addToast}
          onOpenAuth={() => setActiveTab('login')}
        />
      );
    }

    if (activeTab === 'history') {
      return (
        <HistoryView
          onOpenLandingPage={handleOpenLandingPage}
          onViewEmail={handleViewEmail}
          onNewTransfer={() => setActiveTab('compose')}
          showToast={addToast}
        />
      );
    }

    return (
      <ComposeCard
        defaultSenderEmail={currentUser?.email || defaultSenderEmail}
        defaultExpiryDays={defaultExpiry}
        defaultDownloadLimit={defaultDownloadLimit}
        onTransferCreated={(transfer) => {
          refreshOutboxCount();
        }}
        onOpenLandingPage={handleOpenLandingPage}
        onViewEmail={handleViewEmail}
        showToast={addToast}
      />
    );
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--bg-app)',
        color: 'var(--text-main)',
        transition: 'background-color 300ms ease, color 300ms ease',
      }}
    >
      <Header
        activeTab={downloadToken ? null : (!isAuthenticated ? (activeTab === 'signup' ? 'signup' : 'login') : activeTab)}
        setActiveTab={handleTabChange}
        resolvedTheme={resolvedTheme}
        toggleTheme={toggleTheme}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenAuth={() => setActiveTab('login')}
        unreadEmailsCount={outboxCount}
      />

      <main
        style={{
          flex: 1,
          padding: activeTab === 'chat' && isAuthenticated ? '20px 16px' : '40px 16px 60px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {renderMainView()}
      </main>

      {/* Footer (hidden on active chat for maximal viewport) */}
      {activeTab !== 'chat' && (
        <footer
          style={{
            padding: '24px 20px',
            borderTop: '1px solid var(--border-subtle)',
            textAlign: 'center',
            fontSize: '12px',
            color: 'var(--text-placeholder)',
            backgroundColor: 'var(--bg-card)',
          }}
        >
          <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <span>
              ⚡ <strong>AeroDrop</strong> • Instant Email File Sharing & Real-Time Group Chat
            </span>
            <span>
              Authenticated Sessions • WebSockets • Verified Attribution
            </span>
          </div>
        </footer>
      )}

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        theme={theme}
        setTheme={setTheme}
        defaultExpiry={defaultExpiry}
        setDefaultExpiry={setDefaultExpiry}
        defaultDownloadLimit={defaultDownloadLimit}
        setDefaultDownloadLimit={setDefaultDownloadLimit}
        senderEmail={defaultSenderEmail}
        setSenderEmail={setDefaultSenderEmail}
        notifyOnDownload={notifyOnDownload}
        setNotifyOnDownload={setNotifyOnDownload}
        showToast={addToast}
      />

      {/* Transactional Email Inspector Modal */}
      <EmailPreviewModal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setTargetEmailToken(null);
        }}
        targetToken={targetEmailToken}
        showToast={addToast}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        showToast={addToast}
      />

      {/* Global Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
