/**
 * Centralized API Request Manager with Caching and Deduplication
 * 
 * This utility provides:
 * - Request deduplication to prevent multiple identical API calls
 * - Response caching with configurable TTL
 * - Automatic cache invalidation patterns
 * - Memory-efficient cleanup of expired entries
 */

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface RequestOptions {
  /** Cache TTL in minutes (default: 30) */
  ttl?: number;
  /** Force refresh, bypass cache */
  forceRefresh?: boolean;
  /** Enable console logging for debugging */
  debug?: boolean;
}

class ApiRequestManager {
  private pendingRequests = new Map<string, Promise<any>>();
  private cache = new Map<string, CacheEntry>();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly maxCacheSize = 100; // Maximum number of cache entries

  constructor() {
    // Start cleanup interval to remove expired cache entries every 5 minutes
    this.startCleanupInterval();
  }

  /**
   * Main request method with caching and deduplication
   */
  async request<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const { ttl = 30, forceRefresh = false, debug = false } = options;
    const ttlMs = ttl * 60 * 1000; // Convert minutes to milliseconds

    if (debug) {
      console.log(`[ApiRequestManager] Request for key: ${key}`);
    }

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = this.getFromCache<T>(key);
      if (cached !== null) {
        if (debug) {
          console.log(`[ApiRequestManager] Cache hit for key: ${key}`);
        }
        return cached;
      }
    }

    // Check if request is already in flight
    if (this.pendingRequests.has(key)) {
      if (debug) {
        console.log(`[ApiRequestManager] Duplicate request prevented for key: ${key}`);
      }
      return this.pendingRequests.get(key)!;
    }

    // Create new request
    const requestPromise = this.executeRequest(key, fetcher, ttlMs, debug);
    this.pendingRequests.set(key, requestPromise);

    try {
      const result = await requestPromise;
      return result;
    } finally {
      // Clean up pending request
      this.pendingRequests.delete(key);
    }
  }

  private async executeRequest<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
    debug: boolean
  ): Promise<T> {
    try {
      if (debug) {
        console.log(`[ApiRequestManager] Executing request for key: ${key}`);
      }

      const result = await fetcher();

      // Cache the result with size limit check
      this.setCacheEntry(key, {
        data: result,
        timestamp: Date.now(),
        ttl: ttlMs
      });

      if (debug) {
        console.log(`[ApiRequestManager] Cached result for key: ${key}, TTL: ${ttlMs}ms`);
      }

      return result;
    } catch (error) {
      if (debug) {
        console.error(`[ApiRequestManager] Request failed for key: ${key}`, error);
      }
      throw error;
    }
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  private setCacheEntry(key: string, entry: CacheEntry): void {
    // Check cache size limit
    if (this.cache.size >= this.maxCacheSize && !this.cache.has(key)) {
      // Remove oldest entry when cache is full
      const oldestKey = this.findOldestCacheEntry();
      if (oldestKey) {
        this.cache.delete(oldestKey);
        console.log(`[ApiRequestManager] Cache full, evicted oldest entry: ${oldestKey}`);
      }
    }
    
    this.cache.set(key, entry);
  }

  private findOldestCacheEntry(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();
    
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }
    
    return oldestKey;
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param pattern String or RegExp to match cache keys
   */
  invalidate(pattern: string | RegExp): void {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    
    // Use Array.from to avoid iteration issues with older TypeScript targets
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key);
        console.log(`[ApiRequestManager] Invalidated cache for key: ${key}`);
      }
    }
  }

  /**
   * Invalidate specific cache key
   */
  invalidateKey(key: string): void {
    this.cache.delete(key);
    console.log(`[ApiRequestManager] Invalidated cache for key: ${key}`);
  }

  /**
   * Clear all cache entries
   */
  clearAll(): void {
    this.cache.clear();
    this.pendingRequests.clear();
    console.log('[ApiRequestManager] Cleared all cache and pending requests');
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      cacheSize: this.cache.size,
      pendingRequests: this.pendingRequests.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }

  private startCleanupInterval(): void {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 5 * 60 * 1000);

    // Ensure cleanup on Node.js process exit (for server-side)
    if (typeof process !== 'undefined' && process.on) {
      process.on('exit', () => this.destroy());
    }
  }

  private cleanupExpiredEntries(): void {
    const now = Date.now();
    let removedCount = 0;

    // Use Array.from to avoid iteration issues with older TypeScript targets
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        removedCount++;
      }
    }

    if (removedCount > 0) {
      console.log(`[ApiRequestManager] Cleaned up ${removedCount} expired cache entries`);
    }
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clearAll();
  }
}

// Create singleton instance
const apiRequestManager = new ApiRequestManager();

export { apiRequestManager, ApiRequestManager };
export type { RequestOptions };

// Convenience method for external use
export const cachedRequest = <T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: RequestOptions
): Promise<T> => {
  return apiRequestManager.request(key, fetcher, options);
};

// Cache invalidation helpers
export const invalidateCache = (pattern: string | RegExp) => {
  apiRequestManager.invalidate(pattern);
};

export const clearCache = () => {
  apiRequestManager.clearAll();
};

export const getCacheStats = () => {
  return apiRequestManager.getStats();
};