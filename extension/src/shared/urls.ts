export const FEEDBACK_FORM_URL = 'https://forms.gle/KbJv385YuWu13MQH8' as const;

/**
 * Returns the listing-reviews URL for the current browser, or null if
 * none is available yet (Firefox: AMO slug pending). Built at call time
 * because chrome.runtime.id is only available at runtime.
 */
export function getReviewUrl(): string | null {
  const isFirefox =
    typeof (chrome as unknown as Record<string, unknown>).sidebarAction !== 'undefined';
  // AMO slug not yet known — Firefox path is a no-op until listing is approved.
  if (isFirefox) return null;
  return `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`;
}
