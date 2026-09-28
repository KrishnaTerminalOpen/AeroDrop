import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  RotateCcw,
  Send,
  Loader2,
  SwitchCamera,
  Sparkles,
} from 'lucide-react';

export default function CameraModal({
  isOpen,
  onClose,
  onSendPhoto,
  roomTitle = 'Chat',
}) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null); // Data URL or null
  const [caption, setCaption] = useState('');
  const [facingMode, setFacingMode] = useState('user'); // 'user' | 'environment'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Initialize camera stream
  useEffect(() => {
    if (!isOpen) return;

    setCapturedImage(null);
    setCaption('');
    setCameraError(null);

    let activeStream = null;

    const startCamera = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Camera access is not supported by your browser.');
        }

        const constraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        };

        activeStream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = activeStream;
        setStream(activeStream);

        if (videoRef.current) {
          videoRef.current.srcObject = activeStream;
        }
      } catch (err) {
        console.error('[CameraModal] Camera error:', err);
        setCameraError(
          err.name === 'NotAllowedError'
            ? 'Camera permission denied. Please allow camera access in your browser settings.'
            : 'Could not access camera. Please verify your device has a working camera.'
        );
      }
    };

    startCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, facingMode]);

  // Connect video element when stream is ready and not in preview mode
  useEffect(() => {
    if (videoRef.current && stream && !capturedImage) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, capturedImage]);

  // Take snapshot
  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      // Mirror horizontal flip for selfie camera
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
  };

  // Discard and retake
  const handleRetake = () => {
    setCapturedImage(null);
    setCaption('');
  };

  // Switch between front & back camera
  const handleSwitchCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  // Send photo into chat
  const handleSend = async () => {
    if (!capturedImage) return;

    setIsSubmitting(true);
    try {
      // Convert Data URL to Blob
      const res = await fetch(capturedImage);
      const blob = await res.blob();
      const fileName = `Photo_${Date.now()}.jpg`;
      const file = new File([blob], fileName, { type: 'image/jpeg' });

      await onSendPhoto(file, caption.trim(), capturedImage);
      handleClose();
    } catch (err) {
      console.error('[CameraModal] Error sending photo:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCapturedImage(null);
    setCaption('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeUp 180ms ease',
      }}
    >
      {/* Hidden canvas for snapshot rendering */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Top Header */}
      <div
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          color: '#ffffff',
          zIndex: 10,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
        }}
      >
        <button
          onClick={handleClose}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: 'none',
            color: '#ffffff',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="Close Camera"
        >
          <X size={20} />
        </button>

        <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc' }}>
          {capturedImage ? 'Send Photo' : `Camera • ${roomTitle}`}
        </div>

        {!capturedImage ? (
          <button
            onClick={handleSwitchCamera}
            style={{
              background: 'rgba(255, 255, 255, 0.15)',
              border: 'none',
              color: '#ffffff',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Flip Camera"
          >
            <SwitchCamera size={18} />
          </button>
        ) : (
          <div style={{ width: '40px' }} />
        )}
      </div>

      {/* Center Viewfinder / Preview */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a0a0a',
          overflow: 'hidden',
        }}
      >
        {cameraError ? (
          <div style={{ textAlign: 'center', padding: '24px', maxWidth: '380px', color: '#e2e8f0' }}>
            <Camera size={48} style={{ opacity: 0.4, margin: '0 auto 16px auto' }} />
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>
              Camera Unavailable
            </div>
            <div style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5 }}>
              {cameraError}
            </div>
          </div>
        ) : capturedImage ? (
          /* Snapshot Photo Review */
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <img
              src={capturedImage}
              alt="Captured"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
              }}
            />
          </div>
        ) : (
          /* Live Camera Viewfinder */
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
            }}
          />
        )}
      </div>

      {/* Bottom Controls Area */}
      <div
        style={{
          padding: '20px 24px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
          zIndex: 10,
        }}
      >
        {capturedImage ? (
          /* Review Controls: Caption Input + Retake + Send */
          <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
            {/* Caption Input Field */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                backdropFilter: 'blur(10px)',
                borderRadius: '16px',
                padding: '6px 8px 6px 16px',
                marginBottom: '16px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isSubmitting && handleSend()}
                placeholder="Add a caption..."
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#ffffff',
                  fontSize: '15px',
                }}
              />
            </div>

            {/* Actions: Retake and WhatsApp-style Green Send button */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <button
                type="button"
                onClick={handleRetake}
                className="touch-target btn-press"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={16} />
                <span>Retake</span>
              </button>

              <button
                type="button"
                onClick={handleSend}
                disabled={isSubmitting}
                className="touch-target btn-press"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 24px',
                  borderRadius: '999px',
                  backgroundColor: '#10b981', // WhatsApp-style vibrant emerald
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '15px',
                  fontWeight: 700,
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 16px rgba(16, 185, 129, 0.45)',
                  transition: 'all 150ms ease',
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <span>Send</span>
                    <Send size={16} />
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Live Shutter Button */
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={handleCapture}
              disabled={Boolean(cameraError)}
              className="touch-target btn-press"
              style={{
                width: '74px',
                height: '74px',
                borderRadius: '50%',
                backgroundColor: 'transparent',
                border: '4px solid #ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: cameraError ? 'not-allowed' : 'pointer',
                padding: '4px',
                boxShadow: '0 0 20px rgba(255,255,255,0.3)',
                transition: 'transform 100ms ease',
              }}
              title="Take Photo"
            >
              <div
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
