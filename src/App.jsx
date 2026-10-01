import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import ComposeCard from './components/ComposeCard';
import HistoryView from './components/HistoryView';
import DownloadLandingPage from './components/DownloadLandingPage';
import SettingsModal from './components/SettingsModal';
import EmailPreviewModal from './components/EmailPreviewModal';
import ToastContainer from './components/ToastContainer';
import ChatView from './components/chat/ChatView';
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
    return 'login'; // By default the login / active session page opens on website visit
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
      } else if (hash === '#chat-new') {
        setDownloadToken(null);
        setActiveTab('chat-new');
      } else if (hash === '#compose') {
        setDownloadToken(null);
        setActiveTab('compose');
      } else if (hash === '#history') {
        setDownloadToken(null);
        setActiveTab('history');
      } else {
        // Root path / or #login: ALWAYS display login page (or active session page if logged in)
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
    } else if (tab === 'chat' || tab === 'chat-new') {
      window.location.hash = tab === 'chat-new' ? '#chat-new' : '#chat';
      setDownloadToken(null);
      setActiveTab(tab);
    } else {
      handleBackToCompose();
      setActiveTab(tab);
    }
  };


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

    // 2. Unauthenticated: Show AuthPage
    if (!isAuthenticated) {
      return (
        <AuthPage
          initialMode={activeTab === 'signup' ? 'register' : 'login'}
          onNavigate={handleTabChange}
          showToast={addToast}
        />
      );
    }

    // 3. Authenticated protected routes with zero-delay persistent chat layer
    return (
      <>
        {/* Persistent ChatView: Always kept warm in background for 0ms instantaneous opening */}
        <div
          style={{
            display: activeTab === 'chat' || activeTab === 'chat-new' ? 'block' : 'none',
            width: '100%',
          }}
        >
          <ChatView
            showToast={addToast}
            onOpenAuth={() => setActiveTab('login')}
            initiallyOpenNewChat={activeTab === 'chat-new'}
          />
        </div>

        {/* Launchpad view if explicitly on login/signup tabs while authenticated */}
        {(activeTab === 'login' || activeTab === 'signup') && (
          <AuthPage
            initialMode={activeTab === 'signup' ? 'register' : 'login'}
            onNavigate={handleTabChange}
            showToast={addToast}
          />
        )}

        {/* Transfer History View */}
        {activeTab === 'history' && (
          <HistoryView
            onOpenLandingPage={handleOpenLandingPage}
            onViewEmail={handleViewEmail}
            onNewTransfer={() => setActiveTab('compose')}
            showToast={addToast}
          />
        )}

        {/* File Compose View */}
        {activeTab !== 'chat' &&
          activeTab !== 'chat-new' &&
          activeTab !== 'history' &&
          activeTab !== 'login' &&
          activeTab !== 'signup' && (
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
          )}
      </>
    );
  };

  const isAuthView = !isAuthenticated || activeTab === 'login' || activeTab === 'signup';

  return (
    <div
      style={{
        height: isAuthView ? '100dvh' : 'auto',
        minHeight: isAuthView ? '100dvh' : '100vh',
        maxHeight: isAuthView ? '100dvh' : 'none',
        overflow: isAuthView ? 'hidden' : 'visible',
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
          padding: isAuthView ? '4px 16px' : (activeTab === 'chat' && isAuthenticated ? '0' : '40px 16px 60px 16px'),
          display: 'flex',
          flexDirection: 'column',
          alignItems: activeTab === 'chat' && isAuthenticated ? 'stretch' : 'center',
          justifyContent: isAuthView ? 'center' : 'flex-start',
          maxWidth: activeTab === 'chat' && isAuthenticated ? '100%' : '1200px',
          width: '100%',
          margin: '0 auto',
          overflow: isAuthView ? 'hidden' : 'visible',
        }}
      >
        {renderMainView()}
      </main>

      {/* Footer (hidden on active chat & login/signup views for zero-scroll viewport) */}
      {!isAuthView && activeTab !== 'chat' && (
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
          <div className="footer-inner" style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
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
