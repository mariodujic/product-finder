export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/**
 * Shares a link. On phones (trade fairs) this opens the native share sheet
 * (mail, messengers); on desktop it copies the link to the clipboard.
 */
export async function shareLink(
  title: string,
  url: string,
  nav: Pick<Navigator, 'share' | 'clipboard'> = navigator,
): Promise<ShareOutcome> {
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, url });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
      // Fall through to the clipboard.
    }
  }
  try {
    await nav.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
