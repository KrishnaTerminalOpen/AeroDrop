import React, { useState, useRef, useEffect } from 'react';
import {
  Sun,
  Moon,
  Send,
  History,
  Mail,
  Settings,
  MessageSquare,
  LogIn,
  UserPlus,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Header({
  activeTab,
  setActiveTab,
  resolvedTheme,
  toggleTheme,
  onOpenSettings,
  onOpenAuth,
  unreadEmailsCount = 0,
}) {
  const isDark = resolvedTheme === 'dark';
  const { currentUser, logout, isAuthenticated } = useAuth();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <>
      {/* ======================================================================
          TOP HEADER BAR (Always single-row, perfectly aligned on both Mobile & Desktop)
         ====================================================================== */}
      <header
        className="app-header"
        style={{
          width: '100%',
          flexShrink: 0,
          borderBottom: '1px solid var(--border-subtle)',
          backgroundColor: 'var(--bg-card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(12px)',
          transition: 'background-color 300ms ease, border-color 300ms ease',
        }}
      >
        <div
          className="header-inner"
          style={{
            maxWidth: '1280px',
            margin: '0 auto',
            padding: '0 20px',
            height: '54px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'nowrap',
            gap: '12px',
          }}
        >
          {/* Brand Logo & Name */}
          <div
            className="header-brand"
            onClick={() => setActiveTab(isAuthenticated ? 'compose' : 'login')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              userSelect: 'none',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px var(--accent-glow)',
                flexShrink: 0,
              }}
            >
              <Send size={18} style={{ transform: 'rotate(-10deg) translateX(1px)' }} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '17px', fontWeight: 800, letterSpacing: '-0.4px', color: 'var(--text-main)' }}>
                  AeroDrop
                </span>
                <span
                  style={{
                    fontSize: '9.5px',
                    fontWeight: 700,
                    padding: '2px 5px',
                    borderRadius: '999px',
                    backgroundColor: 'var(--accent-subtle)',
                    color: 'var(--accent-primary)',
                    letterSpacing: '0.4px',
                  }}
                >
                  PRO
                </span>
              </div>
              <div
                className="header-brand-subtitle"
                style={{
                  fontSize: '11px',
                  color: 'var(--text-placeholder)',
                  marginTop: '-2px',
                  display: 'none', // Shown on desktop via media query
                }}
              >
                Instant Email File Sharing & Real-Time Group Chat
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs (Hidden on mobile <768px or unauthenticated) */}
          {isAuthenticated && (
            <nav
              className="header-nav header-nav-desktop"
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-card-subtle)',
                padding: '3px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <button
                onClick={() => setActiveTab('compose')}
                className="touch-target btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'compose' ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === 'compose' ? 'var(--text-main)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'compose' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <Send size={14} />
                <span>Compose</span>
              </button>

              <button
                onClick={() => setActiveTab('history')}
                className="touch-target btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'history' ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'history' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <History size={14} />
                <span>Transfers</span>
              </button>

              <button
                onClick={() => setActiveTab('chat')}
                className="touch-target btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'chat' || activeTab === 'chat-new' ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === 'chat' || activeTab === 'chat-new' ? 'var(--text-main)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'chat' || activeTab === 'chat-new' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                <MessageSquare size={14} />
                <span>Group Chat</span>
              </button>

              <button
                onClick={() => setActiveTab('emails')}
                className="touch-target btn-press"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 13px',
                  borderRadius: '7px',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: activeTab === 'emails' ? 'var(--bg-card)' : 'transparent',
                  color: activeTab === 'emails' ? 'var(--text-main)' : 'var(--text-secondary)',
                  boxShadow: activeTab === 'emails' ? 'var(--shadow-sm)' : 'none',
                  position: 'relative',
                }}
              >
                <Mail size={14} />
                <span>Outbox</span>
                {unreadEmailsCount > 0 && (
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: 'var(--accent-primary)',
                      color: '#ffffff',
                      borderRadius: '999px',
                      padding: '1px 5px',
                      fontWeight: 700,
                    }}
                  >
                    {unreadEmailsCount}
                  </span>
                )}
              </button>
            </nav>
          )}

          {/* Right Actions: Theme Toggle, Settings & User Profile */}
          <div
            className="header-actions"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexShrink: 0,
            }}
          >
            {/* Animated Day/Night Theme Toggle */}
            <button
              onClick={toggleTheme}
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              className="touch-target btn-press"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                backgroundColor: 'var(--bg-card-subtle)',
                border: '1px solid var(--border-subtle)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#fbbf24' : '#f59e0b',
                transition: 'all 200ms ease',
              }}
            >
              {isDark ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            {/* Settings Button */}
            <button
              onClick={onOpenSettings}
              aria-label="Settings"
              className="touch-target btn-press"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '10px',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-card-subtle)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Settings size={16} />
            </button>

            {/* User Account / Profile Dropdown */}
            {currentUser ? (
              <div style={{ position: 'relative' }} ref={userMenuRef}>
                <button
                  onClick={() => setIsUserMenuOpen((prev) => !prev)}
                  className="touch-target btn-press header-user-btn"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px 3px 3px',
                    borderRadius: '20px',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-card-subtle)',
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '50%',
                      backgroundColor: currentUser.color || 'var(--accent-primary)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '11.5px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {currentUser.initials}
                  </div>
                  <span
                    className="header-user-name"
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      maxWidth: '85px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {currentUser.displayName}
                  </span>
                  <ChevronDown className="header-user-chevron" size={13} color="var(--text-placeholder)" />
                </button>

                {/* Dropdown Menu */}
                {isUserMenuOpen && (
                  <div
                    className="header-user-dropdown"
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '220px',
                      backgroundColor: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '14px',
                      boxShadow: 'var(--shadow-elevated)',
                      padding: '6px',
                      zIndex: 100,
                      animation: 'fadeUp 150ms ease',
                    }}
                  >
                    {/* User details */}
                    <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {currentUser.displayName}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentUser.email}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveTab('chat');
                      }}
                      className="touch-target btn-press"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-main)',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <MessageSquare size={14} color="var(--accent-primary)" />
                      <span>Open Group Chat</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveTab('signup');
                      }}
                      className="touch-target btn-press"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-main)',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-card-subtle)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <UserPlus size={14} color="#10b981" />
                      <span>Register New Account</span>
                    </button>

                    <div style={{ height: '1px', backgroundColor: 'var(--border-subtle)', margin: '4px 0' }} />

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                        setActiveTab('login');
                      }}
                      className="touch-target btn-press"
                      style={{
                        width: '100%',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--color-error)',
                        fontSize: '12.5px',
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textAlign: 'left',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-error-bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <LogOut size={14} />
                      <span>Switch User / Log Out</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              /* Desktop-only Auth buttons (Hidden on phone to keep top header clean & single-row) */
              <div className="header-auth-desktop" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => setActiveTab('login')}
                  className="touch-target btn-press"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: activeTab === 'login' ? 'var(--bg-card-subtle)' : 'transparent',
                    color: 'var(--text-main)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                >
                  <LogIn size={13} />
                  <span>Log In</span>
                </button>

                <button
                  onClick={() => setActiveTab('signup')}
                  className="touch-target btn-press"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--accent-primary)',
                    color: '#ffffff',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <UserPlus size={13} />
                  <span>Sign Up</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======================================================================
          MOBILE BOTTOM NAVIGATION BAR (Rendered for authenticated users on non-chat screens)
         ====================================================================== */}
      {isAuthenticated && activeTab !== 'chat' && activeTab !== 'chat-new' && (
        <nav
          className="mobile-bottom-nav"
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '56px',
            backgroundColor: 'var(--bg-card)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'none', // Controlled via CSS media queries for <768px
            alignItems: 'center',
            justifyContent: 'space-around',
            zIndex: 90,
            backdropFilter: 'blur(16px)',
            boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          {/* 1. Compose */}
          <button
            type="button"
            onClick={() => setActiveTab('compose')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'compose' ? 'var(--accent-primary)' : 'var(--text-placeholder)',
              transition: 'color 150ms ease',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: activeTab === 'compose' ? 'var(--accent-subtle)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Send size={16} />
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'compose' ? 700 : 500 }}>
              Compose
            </span>
          </button>

          {/* 2. Transfers */}
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'history' ? 'var(--accent-primary)' : 'var(--text-placeholder)',
              transition: 'color 150ms ease',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: activeTab === 'history' ? 'var(--accent-subtle)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <History size={16} />
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'history' ? 700 : 500 }}>
              Transfers
            </span>
          </button>

          {/* 3. Group Chat */}
          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'chat' || activeTab === 'chat-new' ? 'var(--accent-primary)' : 'var(--text-placeholder)',
              transition: 'color 150ms ease',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: activeTab === 'chat' || activeTab === 'chat-new' ? 'var(--accent-subtle)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessageSquare size={16} />
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'chat' || activeTab === 'chat-new' ? 700 : 500 }}>
              Chat
            </span>
          </button>

          {/* 4. Outbox */}
          <button
            type="button"
            onClick={() => setActiveTab('emails')}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '3px',
              height: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: activeTab === 'emails' ? 'var(--accent-primary)' : 'var(--text-placeholder)',
              transition: 'color 150ms ease',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: activeTab === 'emails' ? 'var(--accent-subtle)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <Mail size={16} />
              {unreadEmailsCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-4px',
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--accent-primary)',
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: '10.5px', fontWeight: activeTab === 'emails' ? 700 : 500 }}>
              Outbox
            </span>
          </button>
        </nav>
      )}
    </>
  );
}
