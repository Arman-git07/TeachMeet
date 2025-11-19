
// This list is no longer the primary method of validation but serves as a quick, client-side first-pass filter.
// The main validation is now done via the Kickbox API in the SignUpForm.
export const disposableEmailDomains: string[] = [];

// Block TLDs commonly used for spam or temporary services as a strong secondary check.
export const blockedTlds = [
  'xyz', 'icu', 'buzz', 'top', 'click', 'monster', 'live', 'site', 'online', 'loan', 'work', 'gq', 'shop'
];
