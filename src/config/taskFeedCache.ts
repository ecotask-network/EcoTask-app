/** Time window after which a warm MMKV task cache is treated as stale and
 *  silently revalidated on mount. Exposed as a separate module so tests can
 *  override it via a Jest module mock. */
export const TASK_FEED_STALE_MS = 5 * 60 * 1000;
