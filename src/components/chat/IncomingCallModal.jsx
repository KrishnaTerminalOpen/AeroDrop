import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { ringtone } from '../../utils/ringtone';

export default function IncomingCallModal({ incomingCall, onAccept, onDecline }) {
  useEffect(() => {
    if (incomingCall) {
      ringtone.startIncoming();
    }
    return () => {
      ringtone.stopAll();
    };
  }, [incomingCall]);

  if (!incomingCall) return null;

  const { callerName, callerColor, callType } = incomingCall;
  const isVideo = callType === 'video';
  const initials = (callerName || 'U').slice(0, 2).toUpperCase();

  const handleAccept = () => {
    ringtone.stopAll();
    onAccept();
  };

  const handleDecline = () => {
    ringtone.stopAll();
    onDecline();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: 'rgba(5, 7, 15, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 200ms ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '380px',
          backgroundColor: '#0f172a',
          borderRadius: '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.85), 0 0 20px rgba(16, 185, 129, 0.2)',
          padding: '36px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Pulsating Glowing Avatar Ring */}
        <div style={{ position: 'relative', marginBottom: '24px' }}>
          <div
            style={{
              position: 'absolute',
              inset: '-12px',
              borderRadius: '50%',
              border: '2px solid rgba(16, 185, 129, 0.6)',
              animation: 'dropPulse 1.4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              width: '84px',
              height: '84px',
              borderRadius: '50%',
              backgroundColor: callerColor || '#4f46e5',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '30px',
              fontWeight: 700,
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            {initials}
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '-4px',
              right: '-4px',
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              backgroundColor: isVideo ? '#6366f1' : '#10b981',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              zIndex: 3,
            }}
          >
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
          </div>
        </div>

        {/* Caller Info */}
        <h3
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: '#f8fafc',
            marginBottom: '6px',
            letterSpacing: '-0.3px',
          }}
        >
          {callerName || 'Incoming Call'}
        </h3>
        <p
          style={{
            fontSize: '13px',
            color: '#94a3b8',
            marginBottom: '32px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
              display: 'inline-block',
              animation: 'dropPulse 1s infinite',
            }}
          />
          <span>{isVideo ? 'Incoming WhatsApp Video Call...' : 'Incoming WhatsApp Voice Call...'}</span>
        </p>

        {/* Action Buttons: Accept / Decline */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            width: '100%',
            padding: '0 16px',
          }}
        >
          {/* Decline Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleDecline}
              title="Decline Call"
              className="touch-target btn-press"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(239, 68, 68, 0.45)',
                transition: 'all 150ms ease',
              }}
            >
              <PhoneOff size={24} />
            </button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#f87171' }}>Decline</span>
          </div>

          {/* Accept Button */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleAccept}
              title="Accept Call"
              className="touch-target btn-press"
              style={{
                width: '60px',
                height: '60px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                color: '#ffffff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 8px 20px rgba(16, 185, 129, 0.45)',
                transition: 'all 150ms ease',
              }}
            >
              <Phone size={24} />
            </button>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#34d399' }}>Accept</span>
          </div>
        </div>
      </div>
    </div>
  );
}
