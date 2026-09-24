import React from 'react';
import { Sun, Moon, Send, History, Mail, Settings, ShieldCheck, MessageSquare, User } from 'lucide-react';
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
  const { currentUser } = useAuth();

  return (
    <header
      style={{
        width: '100%',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: 'var(--bg-card)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backdropFilter: 'blur(8px)',
        transition: 'background-color 300ms ease, border-color 300ms ease',
      }}
    >
      <div
        style={{
          maxWidth: '1080px',
          margin: '0 auto',
          padding: '0 20px',
          height: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand Logo */}
        <div
          onClick={() => setActiveTab('compose')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--accent-primary) 0%, #3b82f6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 12px var(--accent-glow)',
            }}
          >
            <Send size={20} style={{ transform: 'rotate(-10deg) translateX(1px)' }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text-main)' }}>
                AeroDrop
              </span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: '999px',
                  backgroundColor: 'var(--accent-subtle)',
                  color: 'var(--accent-primary)',
                  letterSpacing: '0.3px',
                }}
              >
                PRO
              </span>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-placeholder)', marginTop: '-2px' }}>
              Instant Email File Sharing
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-card-subtle)',
            padding: '4px',
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
              padding: '8px 14px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: activeTab === 'compose' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'compose' ? 'var(--text-main)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'compose' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <Send size={15} />
            <span>Compose</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className="touch-target btn-press"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: activeTab === 'history' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'history' ? 'var(--text-main)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'history' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <History size={15} />
            <span>Transfers</span>
          </button>

          {/* Group Chat Tab */}
          <button
            onClick={() => setActiveTab('chat')}
            className="touch-target btn-press"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: activeTab === 'chat' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--text-main)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'chat' ? 'var(--shadow-sm)' : 'none',
            }}
          >
            <MessageSquare size={15} />
            <span>Group Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className="touch-target btn-press"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '7px',
              border: 'none',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              backgroundColor: activeTab === 'emails' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'emails' ? 'var(--text-main)' : 'var(--text-secondary)',
              boxShadow: activeTab === 'emails' ? 'var(--shadow-sm)' : 'none',
              position: 'relative',
            }}
          >
            <Mail size={15} />
            <span>Outbox</span>
            {unreadEmailsCount > 0 && (
              <span
                style={{
                  fontSize: '10px',
                  backgroundColor: 'var(--accent-primary)',
                  color: '#ffffff',
                  borderRadius: '999px',
                  padding: '1px 5px',
                  fontWeight: 600,
                }}
              >
                {unreadEmailsCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Actions: Theme Toggle & Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Animated Day/Night Theme Toggle */}
          <button
            onClick={toggleTheme}
            aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            className="touch-target"
            style={{
              position: 'relative',
              width: '60px',
              height: '32px',
              borderRadius: '16px',
              backgroundColor: isDark ? '#232a3b' : '#e2e8f0',
              border: '1px solid var(--border-subtle)',
              cursor: 'pointer',
              padding: '3px',
              display: 'flex',
              alignItems: 'center',
              transition: 'background-color 300ms ease, border-color 300ms ease',
            }}
          >
            {/* Sliding Track Indicator with Rotating/Morphing Icon */}
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '12px',
                backgroundColor: isDark ? 'var(--accent-primary)' : '#ffffff',
                boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isDark ? '#ffffff' : '#f59e0b',
                transform: isDark ? 'translateX(28px) rotate(360deg)' : 'translateX(0px) rotate(0deg)',
                transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1), background-color 300ms ease, color 300ms ease',
              }}
            >
              {isDark ? <Moon size={14} /> : <Sun size={14} />}
            </div>
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            aria-label="Settings"
            className="touch-target btn-press"
            style={{
              width: '38px',
              height: '38px',
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
            <Settings size={18} />
          </button>

          {/* User Account Button */}
          {currentUser ? (
            <button
              onClick={() => setActiveTab('chat')}
              title={`Logged in as ${currentUser.displayName}`}
              className="touch-target btn-press"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: currentUser.color || 'var(--accent-primary)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '13px',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {currentUser.initials}
            </button>
          ) : (
            <button
              onClick={onOpenAuth}
              className="touch-target btn-press"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '8px 12px',
                borderRadius: '8px',
                backgroundColor: 'var(--accent-subtle)',
                color: 'var(--accent-primary)',
                border: '1px solid var(--accent-border)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <User size={14} />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
