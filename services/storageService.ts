export const storage = {
  get: <T,>(key: string, defaultValue: T): T => {
    const data = localStorage.getItem(key)
    if (data === null) {
      return defaultValue
    }

    try {
      return JSON.parse(data) as T
    } catch {
      return defaultValue
    }
  },
  set: (key: string, value: unknown): void => {
    localStorage.setItem(key, JSON.stringify(value))
  },
  remove: (key: string): void => {
    localStorage.removeItem(key)
  }
}
