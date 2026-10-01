import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Users,
  ShieldCheck,
  Radio,
} from 'lucide-react';
import { ringtone } from '../../utils/ringtone';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:openrelay.metered.ca:80' },
  ],
  iceCandidatePoolSize: 10,
};

export default function CallModal({
  isOpen,
  onClose,
  room,
  currentUser,
  callType = 'audio', // 'audio' | 'video'
  isInitiator = true,
  incomingCall = null,
  socket,
  onEndCallMessage,
}) {
  const isVideo = callType === 'video';
  const [callStatus, setCallStatus] = useState('calling'); // 'calling' | 'ringing' | 'connecting' | 'connected' | 'declined' | 'ended'
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(!isVideo);
  const [isSpeakerMuted, setIsSpeakerMuted] = useState(false);
  const [hasRemoteVideo, setHasRemoteVideo] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const modalRef = useRef(null);
  const timerRef = useRef(null);

  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(new MediaStream());
  const candidateQueueRef = useRef([]);
  const seenSignalsRef = useRef(new Set());
  const callIdRef = useRef(incomingCall?.callId || `call_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

  // Target user calculation with resilient fallback
  const getResolvedTargetUserId = () => {
    return (
      incomingCall?.callerId ||
      room?.otherUser?.id ||
      room?.otherUser?._id ||
      room?.memberIds?.find((id) => id !== currentUser?.id) ||
      (room?.members || []).find((m) => (m.userId || m.id) !== currentUser?.id)?.userId ||
      (room?.members || []).find((m) => (m.userId || m.id) !== currentUser?.id)?.id ||
      null
    );
  };

  const targetUserIdRef = useRef(getResolvedTargetUserId());

  useEffect(() => {
    const nextTarget = getResolvedTargetUserId();
    if (nextTarget) {
      targetUserIdRef.current = nextTarget;
    }
  }, [incomingCall, room, currentUser]);

  // Keep video and audio elements bound to streams as soon as available
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current && isVideo && !isVideoOff) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
      localVideoRef.current.play().catch(() => {});
    }
  }, [isVideo, isVideoOff, callStatus]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStreamRef.current) {
      if (remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
      remoteVideoRef.current.play().catch(() => {});
    }
    if (remoteAudioRef.current && remoteStreamRef.current) {
      if (remoteAudioRef.current.srcObject !== remoteStreamRef.current) {
        remoteAudioRef.current.srcObject = remoteStreamRef.current;
      }
      remoteAudioRef.current.play().catch(() => {});
    }
  }, [hasRemoteVideo, callStatus]);

  // Initialize WebRTC and Media Stream
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setCallStatus(isInitiator ? 'calling' : 'connecting');
    setDuration(0);
    setIsMuted(false);
    setIsVideoOff(!isVideo);
    setHasRemoteVideo(false);
    candidateQueueRef.current = [];
    seenSignalsRef.current.clear();
    remoteStreamRef.current = new MediaStream();

    if (isInitiator) {
      ringtone.startRingback();
    }

    const startWebRTC = async () => {
      try {
        // 1. Get user media (microphone & optional camera) with graceful fallback
        let stream = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
            video: isVideo
              ? { facingMode: 'user', width: { ideal: 1280, max: 1920 }, height: { ideal: 720, max: 1080 } }
              : false,
          });
        } catch (mediaErr) {
          console.warn('[WebRTC] High-res constraints failed, trying standard fallback:', mediaErr);
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: isVideo,
            });
          } catch (basicErr) {
            console.warn('[WebRTC] Video capture failed, falling back to audio-only:', basicErr);
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          }
        }

        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        localStreamRef.current = stream;
        if (localVideoRef.current && isVideo) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }

        // 2. Initialize RTCPeerConnection
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // Ensure explicit bidirectional transceivers for audio and video
        try {
          if (pc.addTransceiver) {
            pc.addTransceiver('audio', { direction: 'sendrecv' });
            if (isVideo) {
              pc.addTransceiver('video', { direction: 'sendrecv' });
            }
          }
        } catch (tErr) {
          console.warn('[WebRTC] Transceiver initialization warning:', tErr);
        }

        // 3. Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          try {
            pc.addTrack(track, stream);
          } catch (trErr) {
            console.warn('[WebRTC] addTrack warning:', trErr);
          }
        });

        // 4. Remote track handler with immediate stream attachment
        pc.ontrack = (event) => {
          console.log('[WebRTC] Received remote track:', event.track.kind, event.track.id);

          const incomingStream = (event.streams && event.streams[0]) ? event.streams[0] : null;
          if (incomingStream) {
            remoteStreamRef.current = incomingStream;
          } else {
            if (!remoteStreamRef.current) {
              remoteStreamRef.current = new MediaStream();
            }
            if (!remoteStreamRef.current.getTrackById(event.track.id)) {
              remoteStreamRef.current.addTrack(event.track);
            }
          }

          const streamToPlay = incomingStream || remoteStreamRef.current;

          // Attach remote audio
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = streamToPlay;
            remoteAudioRef.current.play().catch((e) => console.log('Remote audio play error:', e));
          }

          // Attach remote video
          if (event.track.kind === 'video' || isVideo) {
            setHasRemoteVideo(true);
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = streamToPlay;
              remoteVideoRef.current.play().catch((e) => console.log('Remote video play error:', e));
            }
          }

          // Unmute listener: remote track starts active playback as soon as data arrives
          event.track.onunmute = () => {
            console.log('[WebRTC] Remote track unmuted:', event.track.kind);
            if (event.track.kind === 'video' || isVideo) {
              setHasRemoteVideo(true);
            }
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current || incomingStream;
              remoteVideoRef.current.play().catch((e) => console.log('Video play error on unmute:', e));
            }
          };
        };

        // 5. ICE Candidate handler
        pc.onicecandidate = (event) => {
          if (event.candidate && socket) {
            const sigId = `sig_cand_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            socket.emit('call:signal', {
              callId: callIdRef.current,
              signalId: sigId,
              roomId: room?.id,
              targetUserId: targetUserIdRef.current,
              senderId: currentUser?.id,
              signal: {
                type: 'candidate',
                candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate,
              },
            });
          }
        };

        // 6. Connection state handlers
        pc.onconnectionstatechange = () => {
          console.log('[WebRTC] Connection state changed:', pc.connectionState);
          if (pc.connectionState === 'connected') {
            ringtone.stopAll();
            setCallStatus('connected');
            if (remoteVideoRef.current && remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => {});
            }
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.warn('[WebRTC] Connection disconnected or failed');
          }
        };

        pc.oniceconnectionstatechange = () => {
          if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
            ringtone.stopAll();
            setCallStatus('connected');
            if (remoteVideoRef.current && remoteStreamRef.current) {
              remoteVideoRef.current.srcObject = remoteStreamRef.current;
              remoteVideoRef.current.play().catch(() => {});
            }
          }
        };

        // 7. If caller (initiator), send invite to peer
        if (isInitiator && socket) {
          socket.emit('call:invite', {
            callId: callIdRef.current,
            roomId: room?.id,
            callerId: currentUser?.id,
            callerName: currentUser?.displayName || 'User',
            callerColor: currentUser?.color || '#4f46e5',
            callType: isVideo ? 'video' : 'voice',
            targetUserId: targetUserIdRef.current,
          });
        }

        // 8. If answerer, automatically acknowledge acceptance after media is active
        if (!isInitiator && incomingCall) {
          socket.emit('call:accept', {
            callId: callIdRef.current,
            roomId: room?.id,
            callerId: incomingCall.callerId,
          });
        }
      } catch (err) {
        console.error('[WebRTC] Error initializing media/connection:', err);
        ringtone.stopAll();
      }
    };

    startWebRTC();

    return () => {
      isMounted = false;
      ringtone.stopAll();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop());
        remoteStreamRef.current = new MediaStream();
      }
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isOpen, callType, isInitiator]);

  // Socket Signal Handlers
  useEffect(() => {
    if (!socket || !isOpen) return;

    // A. Peer acknowledged ringing
    const handleRinging = () => {
      setCallStatus((prev) => (prev === 'calling' ? 'ringing' : prev));
    };

    // B. Peer accepted call -> Caller generates WebRTC offer
    const handleAccepted = async (payload) => {
      ringtone.stopAll();
      setCallStatus('connecting');

      if (payload?.answererId) {
        targetUserIdRef.current = payload.answererId;
      }

      const pc = pcRef.current;
      if (!pc) return;

      try {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: isVideo,
        });
        await pc.setLocalDescription(offer);

        const sigId = `sig_off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        socket.emit('call:signal', {
          callId: callIdRef.current,
          signalId: sigId,
          roomId: room?.id,
          targetUserId: targetUserIdRef.current,
          senderId: currentUser?.id,
          signal: { type: 'offer', sdp: offer },
        });
      } catch (e) {
        console.error('[WebRTC] Error creating offer:', e);
      }
    };

    // C. Peer declined / rejected call
    const handleDeclined = () => {
      ringtone.stopAll();
      setCallStatus('declined');
      setTimeout(() => {
        handleEndCall();
      }, 1500);
    };

    // D. Incoming WebRTC Signal (Offer / Answer / Candidate)
    const handleSignal = async (payload) => {
      const { signal, senderId, signalId } = payload || {};
      if (!signal || senderId === currentUser?.id) return;
      if (signalId && seenSignalsRef.current.has(signalId)) return;
      if (signalId) seenSignalsRef.current.add(signalId);

      if (senderId && !targetUserIdRef.current) {
        targetUserIdRef.current = senderId;
      }

      const pc = pcRef.current;
      if (!pc) return;

      try {
        if (signal.type === 'offer') {
          // Answerer receives offer -> sets remote description -> creates answer
          if (pc.signalingState !== 'stable') {
            console.warn('[WebRTC] Skipping offer due to state:', pc.signalingState);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process any queued ICE candidates
          while (candidateQueueRef.current.length > 0) {
            const cand = candidateQueueRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (candErr) {
              console.warn('[WebRTC] Error adding queued ICE candidate:', candErr);
            }
          }

          const answer = await pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: isVideo,
          });
          await pc.setLocalDescription(answer);

          const sigId = `sig_ans_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          socket.emit('call:signal', {
            callId: callIdRef.current,
            signalId: sigId,
            roomId: room?.id,
            targetUserId: senderId,
            senderId: currentUser?.id,
            signal: { type: 'answer', sdp: answer },
          });
        } else if (signal.type === 'answer') {
          // Caller receives answer -> sets remote description
          if (pc.signalingState !== 'have-local-offer') {
            console.warn('[WebRTC] Skipping answer due to state:', pc.signalingState);
            return;
          }
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

          // Process queued candidates
          while (candidateQueueRef.current.length > 0) {
            const cand = candidateQueueRef.current.shift();
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand));
            } catch (candErr) {
              console.warn('[WebRTC] Error adding queued ICE candidate:', candErr);
            }
          }
        } else if (signal.type === 'candidate' && signal.candidate) {
          // Process ICE candidate
          try {
            if (pc.remoteDescription && pc.remoteDescription.type) {
              await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            } else {
              candidateQueueRef.current.push(signal.candidate);
            }
          } catch (candErr) {
            console.warn('[WebRTC] Error adding ICE candidate:', candErr);
          }
        }
      } catch (err) {
        console.error('[WebRTC] Signal handling error:', err);
      }
    };

    // E. Peer ended call
    const handleEnded = () => {
      ringtone.stopAll();
      setCallStatus('ended');
      setTimeout(() => {
        handleEndCall(false);
      }, 500);
    };

    socket.on('call:ringing', handleRinging);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:declined', handleDeclined);
    socket.on('call:signal', handleSignal);
    socket.on('call:ended', handleEnded);

    return () => {
      socket.off('call:ringing', handleRinging);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:declined', handleDeclined);
      socket.off('call:signal', handleSignal);
      socket.off('call:ended', handleEnded);
    };
  }, [socket, isOpen, isVideo, room?.id, currentUser?.id]);

  // Duration timer once connected
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [callStatus]);

  const toggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
    }
    setIsMuted(!isMuted);
  };

  const toggleVideo = async () => {
    if (isVideoOff) {
      try {
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.enabled = true;
          } else {
            const newStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const newTrack = newStream.getVideoTracks()[0];
            localStreamRef.current.addTrack(newTrack);
            if (pcRef.current) {
              const senders = pcRef.current.getSenders();
              const videoSender = senders.find((s) => s.track && s.track.kind === 'video');
              if (videoSender) {
                await videoSender.replaceTrack(newTrack);
              } else {
                pcRef.current.addTrack(newTrack, localStreamRef.current);
              }
            }
          }
        }
        setIsVideoOff(false);
      } catch (e) {
        console.warn('Could not activate camera:', e);
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = false;
        });
      }
      setIsVideoOff(true);
    }
  };

  const toggleSpeaker = () => {
    if (remoteAudioRef.current) {
      remoteAudioRef.current.muted = !isSpeakerMuted;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.muted = !isSpeakerMuted;
    }
    setIsSpeakerMuted(!isSpeakerMuted);
  };

  const toggleFullscreen = () => {
    if (!modalRef.current) return;
    if (!document.fullscreenElement) {
      modalRef.current.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleEndCall = (notifyPeer = true) => {
    ringtone.stopAll();

    if (notifyPeer && socket) {
      socket.emit('call:end', {
        callId: callIdRef.current,
        roomId: room?.id,
        targetUserId: targetUserIdRef.current,
        senderId: currentUser?.id,
        duration,
      });
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);

    const formattedTime = formatDuration(duration);
    if (onEndCallMessage && duration > 0) {
      onEndCallMessage(
        callType === 'video'
          ? `📹 Video call ended • ${formattedTime}`
          : `📞 Voice call ended • ${formattedTime}`
      );
    }
    onClose();
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const isGroup = room?.type === 'group';
  const displayName =
    incomingCall?.callerName ||
    room?.displayTitle ||
    room?.name ||
    (isVideo ? 'Video Call' : 'Voice Call');
  const avatarInitials =
    incomingCall?.callerName?.slice(0, 2).toUpperCase() ||
    room?.avatarInitials ||
    displayName.slice(0, 2).toUpperCase();
  const avatarColor =
    incomingCall?.callerColor ||
    room?.avatarColor ||
    room?.color ||
    '#4f46e5';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        backgroundColor: 'rgba(5, 7, 15, 0.94)',
        backdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'fadeIn 200ms ease',
      }}
    >
      {/* Hidden remote audio element to ensure remote voice playback on any device */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div
        ref={modalRef}
        style={{
          width: isFullscreen ? '100vw' : '94%',
          maxWidth: callType === 'video' ? '880px' : '440px',
          height: isFullscreen ? '100vh' : callType === 'video' ? '600px' : '520px',
          maxHeight: '94vh',
          backgroundColor: '#0a0f1d',
          borderRadius: isFullscreen ? 0 : '24px',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.85), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
          transition: 'all 200ms ease',
        }}
      >
        {/* Top Header Bar */}
        <div
          style={{
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            zIndex: 30,
            background: 'linear-gradient(180deg, rgba(10, 15, 29, 0.85) 0%, rgba(10, 15, 29, 0) 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: callStatus === 'connected' ? '#10b981' : '#f59e0b',
                boxShadow: callStatus === 'connected' ? '0 0 8px #10b981' : '0 0 8px #f59e0b',
                display: 'inline-block',
                animation: callStatus !== 'connected' ? 'dropPulse 1.2s infinite' : 'none',
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 600, color: '#f1f5f9' }}>
              {callStatus === 'calling'
                ? 'Calling...'
                : callStatus === 'ringing'
                ? 'Ringing...'
                : callStatus === 'connecting'
                ? 'Connecting...'
                : callStatus === 'declined'
                ? 'Call Declined'
                : callStatus === 'ended'
                ? 'Call Ended'
                : `Connected • ${formatDuration(duration)}`}
            </span>
            <div
              style={{
                marginLeft: '8px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11px',
                color: '#94a3b8',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                padding: '2px 8px',
                borderRadius: '999px',
              }}
            >
              <ShieldCheck size={12} color="#10b981" />
              <span>WebRTC Encrypted</span>
            </div>
          </div>

          {callType === 'video' && (
            <button
              onClick={toggleFullscreen}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                color: '#e2e8f0',
                padding: '6px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          )}
        </div>

        {/* Center Calling Body */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {callType === 'video' ? (
            /* Video Call View */
            <div
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                backgroundColor: '#020617',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Fullscreen Remote Video - Kept active in DOM tree so browser decodes tracks immediately */}
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                onLoadedMetadata={(e) => {
                  setHasRemoteVideo(true);
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().catch(() => {});
                  }
                }}
                onCanPlay={() => {
                  setHasRemoteVideo(true);
                  if (remoteVideoRef.current) {
                    remoteVideoRef.current.play().catch(() => {});
                  }
                }}
                onPlaying={() => {
                  setHasRemoteVideo(true);
                }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  zIndex: 10,
                  backgroundColor: '#020617',
                  opacity: hasRemoteVideo || callStatus === 'connected' ? 1 : 0,
                  transition: 'opacity 250ms ease',
                }}
              />

              {/* Fallback Display if remote video track hasn't arrived yet */}
              {(!hasRemoteVideo && callStatus !== 'connected') && (
                <div
                  style={{
                    position: 'relative',
                    zIndex: 5,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '14px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '96px',
                      height: '96px',
                      borderRadius: isGroup ? '24px' : '50%',
                      backgroundColor: avatarColor,
                      color: '#ffffff',
                      fontSize: '34px',
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 0 50px rgba(79, 70, 229, 0.5)',
                    }}
                  >
                    {isGroup ? <Users size={46} /> : <span>{avatarInitials}</span>}
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: '#f8fafc' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: '13px', color: '#94a3b8' }}>
                    {callStatus === 'connected' ? 'Video streaming...' : 'Connecting live video...'}
                  </div>
                </div>
              )}

              {/* Local Video Self-View (Picture-in-Picture) */}
              {!isVideoOff && (
                <div
                  style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    width: '130px',
                    height: '180px',
                    borderRadius: '16px',
                    overflow: 'hidden',
                    border: '2px solid rgba(255, 255, 255, 0.3)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.7)',
                    backgroundColor: '#1e293b',
                    zIndex: 25,
                  }}
                >
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      transform: 'scaleX(-1)', // Mirror local camera preview
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '6px',
                      left: '8px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color: '#ffffff',
                      textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                    }}
                  >
                    You
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Voice Call View */
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Pulsing Audio Ripples */}
              <div
                style={{
                  position: 'relative',
                  width: '130px',
                  height: '130px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '-18px',
                    borderRadius: '50%',
                    border: '2px solid rgba(79, 70, 229, 0.35)',
                    animation: callStatus === 'connected' ? 'dropPulse 1.5s infinite' : 'spin 8s linear infinite',
                  }}
                />
                <div
                  style={{
                    width: '110px',
                    height: '110px',
                    borderRadius: isGroup ? '30px' : '50%',
                    backgroundColor: avatarColor,
                    color: '#ffffff',
                    fontSize: '40px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 50px rgba(79, 70, 229, 0.45)',
                    zIndex: 2,
                  }}
                >
                  {isGroup ? <Users size={50} /> : <span>{avatarInitials}</span>}
                </div>
              </div>

              <div style={{ fontSize: '22px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                {displayName}
              </div>
              <div style={{ fontSize: '13px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Radio size={14} color="#10b981" />
                <span>
                  {callStatus === 'connected'
                    ? 'High-Definition Audio Connected'
                    : callStatus === 'ringing'
                    ? 'Ringing...'
                    : 'Calling...'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Call Controls Toolbar */}
        <div
          style={{
            padding: '20px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            backgroundColor: 'rgba(10, 15, 29, 0.95)',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            zIndex: 30,
          }}
        >
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            className="touch-target btn-press"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: isMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* Video Toggle Button (for video calls or upgrade from voice) */}
          <button
            onClick={toggleVideo}
            title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
            className="touch-target btn-press"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: isVideoOff ? 'rgba(255, 255, 255, 0.12)' : '#4f46e5',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
          </button>

          {/* Speaker Mute Button */}
          <button
            onClick={toggleSpeaker}
            title={isSpeakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
            className="touch-target btn-press"
            style={{
              width: '50px',
              height: '50px',
              borderRadius: '50%',
              backgroundColor: isSpeakerMuted ? '#ef4444' : 'rgba(255, 255, 255, 0.12)',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 150ms ease',
            }}
          >
            {isSpeakerMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          {/* End Call Button (Big Red) */}
          <button
            onClick={() => handleEndCall(true)}
            title="End Call"
            className="touch-target btn-press"
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              color: '#ffffff',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.5)',
              transition: 'all 150ms ease',
              marginLeft: '8px',
            }}
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    </div>
  );
}
