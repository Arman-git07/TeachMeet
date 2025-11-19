
// --- 1. Uses Kickbox API (free) to detect disposable emails ---
export async function isDisposableByAPI(email: string): Promise<boolean> {
  try {
    const res = await fetch(`https://open.kickbox.com/v1/disposable/${email}`);
    if (!res.ok) return false; // Fail open (don't block) if API has an issue
    const data = await res.json();
    return data.disposable === true;
  } catch (err) {
    // if API fails, do not block user — fallback checks will handle
    console.warn("Kickbox API call failed, failing open:", err);
    return false;
  }
}

// --- 2. Suspicious TLD check (90% disposable providers use these endings) ---
export function isSuspiciousTLD(email: string): boolean {
  const tld = email.split(".").pop()?.toLowerCase();
  if (!tld) return false;
  const banned = ["xyz", "click", "monster", "shop", "top", "link", "email", "icu", "buzz", "gq", "online", "live", "site", "work", "loan"];
  return banned.includes(tld);
}

// --- 3. Common disposable patterns ---
export function isPatternFake(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return true; // Invalid email format

  const patterns = [
    "mailinator", "tempmail", "10min", "guerrillamail", "yopmail", 
    "fakeinbox", "trashmail", "disposable", "temporary", "throwawaymail"
  ];
  
  return patterns.some(p => domain.includes(p));
}

// --- 4. Simple MX DNS checker (only works on public domains) ---
export async function hasValidMX(email: string): Promise<boolean> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return false;

  try {
    const response = await fetch(`https://dns.google/resolve?name=${domain}&type=MX`);
    const data = await response.json();
    // A valid domain for email should have MX records in its Answer section
    return data.Answer && data.Answer.length > 0;
  } catch (e) {
    // if DNS check fails (e.g., network error), don't block the user.
    // The other checks will provide sufficient coverage.
    console.warn("MX record check failed, failing open:", e);
    return true; 
  }
}

// --- 5. Combine all checks (final) ---
export async function isTemporaryEmail(email: string): Promise<boolean> {
  if (!email || !email.includes("@")) return true;

  // 1. API check (most reliable)
  if (await isDisposableByAPI(email)) {
    return true;
  }

  // 2. Fake pattern detection (fast check)
  if (isPatternFake(email)) {
    return true;
  }

  // 3. Suspicious TLDs (fast check)
  if (isSuspiciousTLD(email)) {
    return true;
  }

  // 4. Invalid MX record (slower, final check)
  if (!(await hasValidMX(email))) {
    return true;
  }

  return false;
}
