// TODO: swap console.log for a real sink when analytics is approved. The
// privacy page promises no third-party analytics today, so nothing here may
// make a network call until that copy changes. Every event goes through this
// one function so the swap is a single edit.
export function track(event, props = {}) {
  console.log('[analytics]', event, props);
}
