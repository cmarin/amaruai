// Debug logging utility that can be controlled via environment variable
const DEBUG = process.env.NEXT_PUBLIC_DEBUG === 'true';

export const dlog = (...args: unknown[]) => {
  if (DEBUG) {
    console.log(...args);
  }
};

export const derror = (...args: unknown[]) => {
  if (DEBUG) {
    console.error(...args);
  }
};

export const dwarn = (...args: unknown[]) => {
  if (DEBUG) {
    console.warn(...args);
  }
};