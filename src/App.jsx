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
import { AuthProvider } from './hooks/useAuth';
import { useTheme } from './hooks/useTheme';
import { useToast } from './hooks/useToast';

function AppContent() {
  const { theme, resolvedTheme, toggleTheme, setTheme } = useTheme();
  const { toasts, addToast, removeToast } = useToast();

  const [activeTab, setActiveTab] = useState('compose'); // 'compose' | 'history' | 'chat' | 'emails' | 'login' | 'signup'
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
        const token = hash.replace('#download/', '');
        setDownloadToken(token);
      } else if (hash === '#login') {
        setDownloadToken(null);
        setActiveTab('login');
      } else if (hash === '#signup' || hash === '#register') {
        setDownloadToken(null);
        setActiveTab('signup');
      } else if (hash === '#chat') {
        setDownloadToken(null);
        setActiveTab('chat');
      } else {
        setDownloadToken(null);
      }
    };

    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // Update outbox count
  const refreshOutboxCount = async () => {
    try {
      const res = await fetch('/api/emails');
      if (res.ok) {
        const data = await res.json();
        setOutboxCount(data.emails?.length || 0);
      }
    } catch (err) {}
  };

  useEffect(() => {
    refreshOutboxCount();
  }, []);

  const handleOpenLandingPage = (token) => {
    window.location.hash = `#download/${token}`;
    setDownloadToken(token);
  };

  const handleBackToCompose = () => {
    window.location.hash = '';
    setDownloadToken(null);
    setActiveTab('compose');
  };

  const handleViewEmail = (token) => {
    setTargetEmailToken(token);
    setIsEmailModalOpen(true);
  };

  const handleTabChange = (tab) => {
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
        activeTab={downloadToken ? null : activeTab}
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
          padding: activeTab === 'chat' ? '20px 16px' : '40px 16px 60px 16px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {downloadToken ? (
          <DownloadLandingPage
            token={downloadToken}
            onBackToCompose={handleBackToCompose}
          />
        ) : (activeTab === 'login' || activeTab === 'signup') ? (
          <AuthPage
            initialMode={activeTab === 'signup' ? 'register' : 'login'}
            onNavigate={handleTabChange}
            showToast={addToast}
          />
        ) : activeTab === 'chat' ? (
          <ChatView
            showToast={addToast}
            onOpenAuth={() => setActiveTab('login')}
          />
        ) : activeTab === 'history' ? (
          <HistoryView
            onOpenLandingPage={handleOpenLandingPage}
            onViewEmail={handleViewEmail}
            onNewTransfer={() => setActiveTab('compose')}
            showToast={addToast}
          />
        ) : (
          <ComposeCard
            defaultSenderEmail={defaultSenderEmail}
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
