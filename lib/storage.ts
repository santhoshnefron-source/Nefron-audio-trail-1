export const storage = {
  get: <T>(key: string, defaultValue: T): T => {
    try {
      const item = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
      return item ? JSON.parse(item) : defaultValue;
    } catch (e) {
      return defaultValue;
    }
  },
  set: <T>(key: string, value: T): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(value));
      }
    } catch (e) {
      // Ignore
    }
  },
  getItemString: (key: string): string | null => {
    try {
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
    } catch (e) {
      // Ignore
    }
    return null;
  },
  setItemString: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch (e) {
      // Ignore
    }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      // Ignore
    }
  }
};

