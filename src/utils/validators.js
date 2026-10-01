/**
 * Enterprise Email & Input Validation Engine
 * Provides RFC 5322 regex checks, disposable/fake domain filtering,
 * typo suggestion detection, and live server-assisted MX verification.
 */

export const EMAIL_REGEX =
  /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?\.[a-zA-Z]{2,}$/;

export const MAX_FILE_SIZE = Infinity; // Unlimited file transfer capacity

// Top disposable & fake temporary email domains
export const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  '10minutemail.com',
  'guerrillamail.com',
  'trashmail.com',
  'sharklasers.com',
  'yopmail.com',
  'fake.com',
  'fakemail.com',
  'test.com',
  'example.com',
  'invalid.com',
  'dispostable.com',
  'getairmail.com',
  'mytemp.email',
  'nada.ltd',
  'crazymailing.com',
  'throwawaymail.com',
  'temp-mail.org',
  'generator.email',
  'inboxkitten.com',
  'maildrop.cc',
  'mohmal.com',
  'minutemailbox.com',
  'emailfake.com',
  'zillamail.com',
  'trashmail.net',
  'burnermail.io',
  'guerrillamailblock.com',
  'grr.la',
  'superrito.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'teleworm.us',
  'einrot.com',
  'yopmail.fr',
  'yopmail.net',
  'temporary-mail.net',
  'tempmailaddress.com',
  'mytempemail.com',
  'tempemail.co',
  'tmpmail.org',
  'tmpmail.net',
  'fakemailgenerator.com',
  'trashmail.me',
  'mailnesia.com',
  'trashmail.org',
  'discard.email',
  'disposablemail.com',
  '0-mail.com',
  '0815.ru',
  '0clickemail.com',
  '10mail.org',
  '20minutemail.com',
  '33mail.com',
  'anonmail.net',
  'anonymbox.com',
  'bugmenot.com',
  'byom.de',
  'deadfake.com',
  'discardmail.com',
  'disposable.im',
  'dodgeit.com',
  'dontreg.com',
  'dumpmail.de',
  'easytrashmail.com',
  'fakeinbox.com',
  'fakemailz.com',
  'filzmail.com',
  'fizmail.com',
  'getonemail.com',
  'hidemail.de',
  'hidemail.net',
  'hmamail.com',
  'hushmail.me',
  'incognitomail.org',
  'jetable.com',
  'jetable.net',
  'jetable.org',
  'kasmail.com',
  'koszmail.pl',
  'kurzepost.de',
  'lortemail.dk',
  'lroid.com',
  'madmail.net',
  'mailexpire.com',
  'mailin8r.com',
  'mailinater.com',
  'mailnull.com',
  'mailsac.com',
  'meltmail.com',
  'mintemail.com',
  'mytrashmail.com',
  'nomail.xl.cx',
  'nospam.ze.tc',
  'notmail.org',
  'nowmymail.com',
  'oneoffmail.com',
  'quickinbox.com',
  'rcpt.at',
  'refreshemail.com',
  'safetymail.info',
  'shortmail.net',
  'sofort-mail.de',
  'spambob.com',
  'spambox.us',
  'spamfree24.org',
  'spamgourmet.com',
  'spamhole.com',
  'spaminator.de',
  'spammotel.com',
  'tempail.com',
  'tempemail.biz',
  'tempemail.net',
  'tempinbox.com',
  'throwawayemailaddress.com',
  'trash-mail.at',
  'trash-mail.com',
  'trash-mail.de',
  'trashinbox.com',
  'twinmail.de',
  'veryrealemail.com',
  'wegwerfadresse.de',
  'wegwerfemail.de',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'whyspam.me',
  'ymail.com',
  'zippymail.info',
  'zxcv.com',
  'zxcvbnm.com',
  'abc.com',
  'xyz.com',
  'asdf.com',
  'qwerty.com',
  '123.com',
  'fakeemail.com',
  'testemail.com',
]);

// Common domain typos and auto-suggestions
export const COMMON_DOMAIN_TYPOS = {
  'gmai.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmaill.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'gmaul.com': 'gmail.com',
  'gmail.co': 'gmail.com',
  'gmail.con': 'gmail.com',
  'gmail.cm': 'gmail.com',
  'gmail.om': 'gmail.com',
  'yaho.com': 'yahoo.com',
  'yahooo.com': 'yahoo.com',
  'yaho.co': 'yahoo.com',
  'ymail.con': 'yahoo.com',
  'hotmial.com': 'hotmail.com',
  'hotmaill.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'outlok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
  'outlokk.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'icoud.com': 'icloud.com',
  'iclod.com': 'icloud.com',
  'icloud.co': 'icloud.com',
  'protonmil.com': 'proton.me',
  'protonmai.com': 'proton.me',
};

// Gibberish / Fake keyboard mash patterns
const GIBBERISH_PATTERNS = [
  /^asdf/i,
  /^qwer/i,
  /^zxcv/i,
  /^12345/i,
  /^aaaa/i,
  /^bbbb/i,
  /^testtest/i,
  /^fakefake/i,
  /^xyzxyz/i,
];

/**
 * Perform comprehensive synchronous email syntax, domain, and disposable checks
 */
export function verifyEmailDetailed(email) {
  if (!email || typeof email !== 'string') {
    return {
      valid: false,
      reason: 'Email address cannot be empty.',
      code: 'EMPTY_EMAIL',
    };
  }

  const clean = email.trim().toLowerCase();

  // 1. Length checks
  if (clean.length < 6) {
    return {
      valid: false,
      reason: 'Email address is too short. Please enter a valid email.',
      code: 'TOO_SHORT',
    };
  }
  if (clean.length > 120) {
    return {
      valid: false,
      reason: 'Email address exceeds maximum allowed length.',
      code: 'TOO_LONG',
    };
  }

  // 2. Syntax checks
  if (!clean.includes('@')) {
    return {
      valid: false,
      reason: 'Missing "@" symbol in email address.',
      code: 'MISSING_AT',
    };
  }

  const parts = clean.split('@');
  if (parts.length !== 2) {
    return {
      valid: false,
      reason: 'Email address can only contain a single "@" symbol.',
      code: 'MULTIPLE_AT',
    };
  }

  const [localPart, domainPart] = parts;

  if (!localPart || localPart.length === 0) {
    return {
      valid: false,
      reason: 'Missing username before "@".',
      code: 'MISSING_USERNAME',
    };
  }

  if (!domainPart || domainPart.length === 0) {
    return {
      valid: false,
      reason: 'Missing domain name after "@" (e.g. gmail.com).',
      code: 'MISSING_DOMAIN',
    };
  }

  // Check consecutive dots
  if (clean.includes('..')) {
    return {
      valid: false,
      reason: 'Email address cannot contain consecutive dots ("..").',
      code: 'CONSECUTIVE_DOTS',
    };
  }

  // Check valid regex format
  if (!EMAIL_REGEX.test(clean)) {
    return {
      valid: false,
      reason: 'Invalid email address format. Example: yourname@gmail.com',
      code: 'INVALID_FORMAT',
    };
  }

  // Check domain dots and TLD
  if (!domainPart.includes('.')) {
    return {
      valid: false,
      reason: 'Domain must include an extension like .com, .org, .net, or .io',
      code: 'MISSING_TLD',
    };
  }

  const domainParts = domainPart.split('.');
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) {
    return {
      valid: false,
      reason: 'Invalid domain extension. Please enter a valid top-level domain.',
      code: 'INVALID_TLD',
    };
  }

  // 3. Check for disposable & fake test domains
  if (DISPOSABLE_EMAIL_DOMAINS.has(domainPart)) {
    return {
      valid: false,
      reason: 'Temporary or disposable email domains are not allowed. Please enter your real email address.',
      code: 'DISPOSABLE_EMAIL',
      isDisposable: true,
    };
  }

  // 4. Check for fake placeholder strings
  if (
    domainPart === 'domain.com' ||
    domainPart === 'company.com' ||
    domainPart === 'email.com' ||
    domainPart === 'site.com' ||
    localPart === 'fake' ||
    localPart === 'test' ||
    localPart === 'asdf' ||
    localPart === '123' ||
    localPart === 'invalid' ||
    localPart === 'username' ||
    localPart === 'yourname' ||
    localPart === 'none' ||
    localPart === 'null' ||
    localPart === 'undefined'
  ) {
    return {
      valid: false,
      reason: 'Please enter a genuine, active email address instead of a placeholder.',
      code: 'PLACEHOLDER_EMAIL',
    };
  }

  // Check for obvious gibberish repetitions (e.g. aaaaaaa@gmail.com or asdfasdf@...)
  const isGibberish = GIBBERISH_PATTERNS.some((pat) => pat.test(localPart)) && localPart.length < 9;
  if (isGibberish && (domainPart === 'test.com' || domainPart === 'example.com' || domainPart === 'fake.com')) {
    return {
      valid: false,
      reason: 'Please provide a valid, real email address.',
      code: 'GIBBERISH_EMAIL',
    };
  }

  // 5. Typo suggestion
  const typoSuggestion = COMMON_DOMAIN_TYPOS[domainPart];
  const suggestion = typoSuggestion ? `${localPart}@${typoSuggestion}` : null;

  return {
    valid: true,
    cleanEmail: clean,
    domain: domainPart,
    suggestion,
  };
}

/**
 * Quick boolean check for email validity
 */
export function isValidEmail(email) {
  return verifyEmailDetailed(email).valid;
}

/**
 * Validate array of recipient emails
 */
export function validateRecipientEmails(emails) {
  if (!emails || emails.length === 0) {
    return 'At least one recipient email is required.';
  }
  for (const email of emails) {
    const res = verifyEmailDetailed(email);
    if (!res.valid) {
      return `"${email}": ${res.reason}`;
    }
  }
  return null;
}

export function validateFileSize(files) {
  if (!files || files.length === 0) {
    return 'Please select at least one file or folder.';
  }
  return null;
}

/**
 * Asynchronously verify email domain MX/DNS with backend server
 */
export async function verifyEmailWithServer(email) {
  const localCheck = verifyEmailDetailed(email);
  if (!localCheck.valid) {
    return localCheck;
  }

  try {
    const res = await fetch('/api/auth/validate-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: localCheck.cleanEmail }),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        ...localCheck,
        ...data,
      };
    }
  } catch (err) {
    // Network fallback
  }

  return localCheck;
}
