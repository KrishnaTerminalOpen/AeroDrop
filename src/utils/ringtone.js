// Web Audio API WhatsApp-style Ringtone & Ringback Tone Generator
// Zero external audio files, 100% reliable across iOS, Android, and Desktop browsers.

class RingtoneManager {
  constructor() {
    this.audioCtx = null;
    this.incomingInterval = null;
    this.outgoingInterval = null;
  }

  getAudioContext() {
    try {
      if (!this.audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          this.audioCtx = new AudioCtxClass();
        }
      }
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return this.audioCtx;
    } catch (e) {
      return null;
    }
  }

  // Play outgoing ringback beep cadence (beep... beep...)
  startRingback() {
    this.stopAll();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playBeep = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard 440Hz + 480Hz ringback tone
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);
        osc1.type = 'sine';
        osc2.type = 'sine';

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch (e) {}
    };

    playBeep();
    this.outgoingInterval = setInterval(playBeep, 3200);
  }

  // Play incoming ringtone (WhatsApp melodic cadence)
  startIncoming() {
    this.stopAll();
    const ctx = this.getAudioContext();
    if (!ctx) return;

    const playRing = () => {
      try {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // 425Hz + 475Hz European/WhatsApp cadence
        osc1.frequency.setValueAtTime(425, now);
        osc2.frequency.setValueAtTime(475, now);
        osc1.type = 'sine';
        osc2.type = 'sine';

        gain.gain.setValueAtTime(0.14, now);
        gain.gain.linearRampToValueAtTime(0.14, now + 0.8);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.2);
        osc2.stop(now + 1.2);
      } catch (e) {}
    };

    playRing();
    this.incomingInterval = setInterval(playRing, 2400);
  }

  stopAll() {
    if (this.incomingInterval) {
      clearInterval(this.incomingInterval);
      this.incomingInterval = null;
    }
    if (this.outgoingInterval) {
      clearInterval(this.outgoingInterval);
      this.outgoingInterval = null;
    }
  }
}

export const ringtone = new RingtoneManager();
