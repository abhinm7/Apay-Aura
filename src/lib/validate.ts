export const auraId = (handle: string) => `${handle}@aura`;

export const normalizePhone = (phone: string) => phone.replace(/\D/g, "").slice(-10);

export function validateName(name: string) {
  const n = name.trim();
  return n.length >= 2 && n.length <= 40 ? null : "Enter your name (2–40 characters)";
}

export function validatePhone(phone: string) {
  return /^\d{10}$/.test(phone) ? null : "Enter a valid 10-digit phone number";
}

export function validatePassword(password: string) {
  return password.length >= 6 ? null : "Password must be at least 6 characters";
}

export function validateHandle(handle: string) {
  return /^[a-z0-9][a-z0-9._]{2,19}$/.test(handle)
    ? null
    : "Aura ID: 3–20 characters — letters, numbers, dot or underscore";
}

export function validatePin(pin: string) {
  return /^\d{4}$/.test(pin) ? null : "PIN must be 4 digits";
}
