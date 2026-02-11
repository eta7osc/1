import { STORAGE_KEYS } from '../constants'
import { storage } from './storageService'

export const MIN_SECURITY_PASSCODE_LENGTH = 4

function readStorageValue<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key)
  if (raw === null) {
    return fallback
  }

  try {
    return JSON.parse(raw) as T
  } catch {
    return raw as T
  }
}

function normalizePasscode(value: unknown) {
  if (typeof value !== 'string') {
    return ''
  }

  return value.trim()
}

export function getAppLockPasscode(): string {
  return normalizePasscode(readStorageValue<string>(STORAGE_KEYS.PASSCODE, ''))
}

export function hasAppLockPasscode(): boolean {
  return getAppLockPasscode().length >= MIN_SECURITY_PASSCODE_LENGTH
}

export function setAppLockPasscode(passcode: string): void {
  storage.set(STORAGE_KEYS.PASSCODE, passcode.trim())
}

export function verifyAppLockPasscode(input: string): boolean {
  const passcode = getAppLockPasscode()
  return Boolean(passcode) && input.trim() === passcode
}

export function getAppLockEnabled(): boolean {
  return Boolean(readStorageValue<boolean>(STORAGE_KEYS.APP_LOCK_ENABLED, true))
}

export function setAppLockEnabled(enabled: boolean): void {
  storage.set(STORAGE_KEYS.APP_LOCK_ENABLED, enabled)
}

export function getPrivateWallPasscode(): string {
  const localPasscode = normalizePasscode(readStorageValue<string>(STORAGE_KEYS.PRIVATE_WALL_PASSCODE, ''))
  if (localPasscode) {
    return localPasscode
  }

  const envPasscode = normalizePasscode(import.meta.env.VITE_PRIVATE_WALL_PASSWORD || '')
  return envPasscode
}

export function setPrivateWallPasscode(passcode: string): void {
  storage.set(STORAGE_KEYS.PRIVATE_WALL_PASSCODE, passcode.trim())
}

export function verifyPrivateWallPasscode(input: string): boolean {
  const passcode = getPrivateWallPasscode()
  return Boolean(passcode) && input.trim() === passcode
}
