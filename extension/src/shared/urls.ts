export const FEEDBACK_FORM_URL = 'https://forms.gle/KbJv385YuWu13MQH8' as const;

// Built at call time because chrome.runtime.id is only available at runtime.
export function getReviewInfo(): { url: string; storeName: string; body: string } {
  const isFirefox =
    typeof (chrome as unknown as Record<string, unknown>).sidebarAction !== 'undefined';
  if (isFirefox) {
    return {
      url: 'https://addons.mozilla.org/en-US/firefox/addon/slant-detective/reviews/',
      storeName: 'Firefox Add-ons',
      body: 'Leave a quick review on Firefox Add-ons — it really helps.',
    };
  }
  return {
    url: `https://chromewebstore.google.com/detail/${chrome.runtime.id}/reviews`,
    storeName: 'Chrome Web Store',
    body: 'Leave a quick review on the Chrome Web Store — it really helps.',
  };
}
