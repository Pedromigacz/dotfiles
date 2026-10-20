// The in-process SDK transport may not interrupt its work when fetch is aborted.
// Bound our wait even then, and discard all late results.
export async function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  let onAbort: () => void = () => {}
  const aborted = new Promise<never>((_, reject) => {
    onAbort = () => reject(new Error("Automatic review cancelled"))
    if (signal.aborted) onAbort()
    else signal.addEventListener("abort", onAbort, { once: true })
  })
  try { return await Promise.race([promise, aborted]) }
  finally { signal.removeEventListener("abort", onAbort) }
}
