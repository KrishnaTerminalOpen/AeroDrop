/**
 * Google Identity Services & Browser Account Authentication Helper
 * Provides seamless 1-click Google Sign-In with browser account detection,
 * Google Identity Services (GIS) One Tap, and OAuth popup flows.
 */

// Default public Google Web Client ID (can be overridden with VITE_GOOGLE_CLIENT_ID)
export const GOOGLE_CLIENT_ID =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
  '982348512345-aerodropclient.apps.googleusercontent.com';

/**
 * Safely parse a JWT ID Token payload (Base64 URL)
 */
export function parseJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.warn('[GoogleAuth] Failed to parse JWT payload:', err);
    return null;
  }
}

/**
 * Retrieve list of previously remembered Google accounts from local storage
 */
export function getSavedGoogleAccounts() {
  try {
    const raw = localStorage.getItem('aerodrop_known_google_accounts');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((a) => a?.email && !a.email.toLowerCase().includes('krishnasahu'));
      }
    }
  } catch (e) {}
  return [];
}

/**
 * Save / remember a Google account locally for instant 1-click login
 */
export function saveGoogleAccount({ email, displayName, avatarUrl, googleId }) {
  try {
    if (!email) return;
    const normalizedEmail = email.trim().toLowerCase();
    const current = getSavedGoogleAccounts().filter((a) => a.email.toLowerCase() !== normalizedEmail);
    const updated = [
      {
        email: normalizedEmail,
        displayName: displayName || normalizedEmail.split('@')[0],
        avatarUrl: avatarUrl || null,
        googleId: googleId || null,
        lastUsedAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 5); // Keep up to 5 most recent Google accounts
    localStorage.setItem('aerodrop_known_google_accounts', JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Initialize Google Identity Services (GIS) library
 */
export function initGoogleIdentityServices({ onCredential, onError }) {
  if (typeof window === 'undefined') return;

  const tryInit = () => {
    if (window.google?.accounts?.id) {
      try {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (response) => {
            if (response.credential) {
              const payload = parseJwtPayload(response.credential);
              if (payload) {
                const googleUser = {
                  email: payload.email,
                  displayName: payload.name || payload.given_name || payload.email.split('@')[0],
                  avatarUrl: payload.picture || null,
                  googleId: payload.sub || null,
                  credential: response.credential,
                };
                saveGoogleAccount(googleUser);
                onCredential?.(googleUser);
              }
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });
      } catch (err) {
        console.warn('[GoogleAuth] Google Identity init warning:', err);
      }
    }
  };

  if (window.google?.accounts?.id) {
    tryInit();
  } else {
    // Wait for script to load
    const checkInterval = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(checkInterval);
        tryInit();
      }
    }, 100);
    setTimeout(() => clearInterval(checkInterval), 5000);
  }
}

/**
 * Trigger official Google Account Selection & Fetch Browser Accounts
 * 1. Checks Browser Credential Management API (FedCM / navigator.credentials)
 * 2. Triggers Google Identity Services (GIS) One Tap / Account Chooser
 * 3. Opens Google OAuth Account Chooser Popup window
 * 4. Falls back to modal account selector
 */
export async function triggerGoogleAccountPicker({ onCredential, onFallbackModal, onError }) {
  // Step 1: Try modern browser Credential Manager API if supported
  if (typeof navigator !== 'undefined' && navigator.credentials && navigator.credentials.get) {
    try {
      const cred = await navigator.credentials.get({
        federated: {
          providers: ['https://accounts.google.com'],
        },
        mediation: 'optional',
      });
      if (cred && cred.id) {
        const googleUser = {
          email: cred.id,
          displayName: cred.name || cred.id.split('@')[0],
          avatarUrl: cred.iconURL || null,
          googleId: cred.id,
        };
        saveGoogleAccount(googleUser);
        onCredential?.(googleUser);
        return;
      }
    } catch (e) {
      // Credential Manager not active for this origin, continue to GIS / popup
    }
  }

  // Step 2: Try Google Identity Services (GIS) prompt
  if (window.google?.accounts?.id) {
    let promptHandled = false;
    try {
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log('[GoogleAuth] GIS prompt skipped/not displayed:', notification.getNotDisplayedReason?.());
          if (!promptHandled) {
            promptHandled = true;
            openGoogleOAuthPopup({ onCredential, onFallbackModal, onError });
          }
        }
      });
      return;
    } catch (err) {
      console.warn('[GoogleAuth] GIS prompt error, falling back to popup:', err);
    }
  }

  // Step 3: Open Google OAuth Account Chooser Popup
  openGoogleOAuthPopup({ onCredential, onFallbackModal, onError });
}

/**
 * Open official Google OAuth account picker in a centered popup window
 */
function openGoogleOAuthPopup({ onCredential, onFallbackModal, onError }) {
  try {
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2.5;

    // Google OAuth 2.0 Auth URL with prompt=select_account to list all signed-in browser Google accounts
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${encodeURIComponent(GOOGLE_CLIENT_ID)}` +
      `&redirect_uri=${encodeURIComponent(window.location.origin + '/#google-callback')}` +
      `&response_type=token%20id_token` +
      `&scope=openid%20email%20profile` +
      `&prompt=select_account` +
      `&nonce=${Math.random().toString(36).slice(2)}`;

    const popup = window.open(
      oauthUrl,
      'GoogleSignInPopup',
      `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no,location=no`
    );

    if (!popup || popup.closed || typeof popup.closed === 'undefined') {
      // Popup blocked by browser settings -> open graceful in-app account chooser modal
      onFallbackModal?.();
      return;
    }

    // Monitor popup window or hash change
    let closedCheck = setInterval(() => {
      if (popup.closed) {
        clearInterval(closedCheck);
        // If popup closed without callback, open in-app chooser
        onFallbackModal?.();
      }
    }, 500);

    // Fallback timer
    setTimeout(() => {
      clearInterval(closedCheck);
    }, 60000);
  } catch (err) {
    console.warn('[GoogleAuth] Popup creation failed, opening fallback modal:', err);
    onFallbackModal?.();
  }
}
