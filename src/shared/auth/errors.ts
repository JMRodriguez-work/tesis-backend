const EXACT_CODES: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'Email o contraseña incorrectos',
  INVALID_EMAIL: 'El email no es válido',
  INVALID_PASSWORD: 'La contraseña no es válida',
  USER_NOT_FOUND: 'Usuario no encontrado',
  PASSWORD_TOO_SHORT: 'La contraseña es demasiado corta',
  PASSWORD_TOO_LONG: 'La contraseña es demasiado larga',
  EMAIL_NOT_VERIFIED: 'Debes verificar tu email antes de iniciar sesión',
  FAILED_TO_CREATE_USER: 'No se pudo crear el usuario',
  FAILED_TO_CREATE_SESSION: 'No se pudo iniciar la sesión',
  FAILED_TO_UPDATE_USER: 'No se pudo actualizar el usuario',
  INVALID_TOKEN: 'Token inválido o expirado',
  TOKEN_EXPIRED: 'Token expirado',
  EMAIL_REQUIRED: 'El email es obligatorio',
  PASSWORD_REQUIRED: 'La contraseña es obligatoria',
  NAME_REQUIRED: 'El nombre es obligatorio',
  USER_BANNED: 'Tu cuenta fue suspendida. Contactá a un administrador',
  SIGNUP_DISABLED: 'El registro está deshabilitado',
}

const PREFIX_CODES: Array<{ prefix: string; message: string }> = [
  { prefix: 'USER_ALREADY_EXISTS', message: 'Ya existe un usuario con ese email' },
  { prefix: 'EMAIL_ALREADY_EXISTS', message: 'El email ya está registrado' },
  { prefix: 'USERNAME_ALREADY_EXISTS', message: 'El nombre de usuario ya está en uso' },
  { prefix: 'PASSWORD_TOO_', message: 'La contraseña no cumple los requisitos' },
]

export function translateBetterAuthError(code: string, fallback: string): string {
  if (EXACT_CODES[code]) return EXACT_CODES[code]
  for (const { prefix, message } of PREFIX_CODES) {
    if (code.startsWith(prefix)) return message
  }
  return fallback
}

export function getBetterAuthErrorMessage(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const p = payload as { code?: unknown; message?: unknown }
  if (typeof p.code !== 'string' || typeof p.message !== 'string') return null
  return translateBetterAuthError(p.code, p.message)
}
