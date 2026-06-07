/** Experience Cloud / Digital Experiences — no Tooling API on these hosts. */
export function isExperienceCloudUrl(url: string): boolean {
  try {
    return /\.my\.site\.com$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

/** Salesforce platform pages where Console+ can extract a valid API session. */
export function isSalesforcePlatformUrl(url: string): boolean {
  if (!url || isExperienceCloudUrl(url)) return false;

  try {
    const host = new URL(url).hostname;
    const patterns = [
      /\.salesforce\.com$/i,
      /\.salesforce-setup\.com$/i,
      /\.force\.com$/i,
      /\.cloudforce\.com$/i,
      /\.database\.com$/i
    ];
    if (patterns.some((p) => p.test(host))) return true;

    const h = host.toLowerCase();
    return (h.includes('salesforce') && !h.endsWith('.my.site.com')) || h.endsWith('.force.com');
  } catch {
    return false;
  }
}

export const EXPERIENCE_CLOUD_ERROR =
  'Console+ cannot run on Experience Cloud sites (*.my.site.com).\n\n' +
  'Open Salesforce Lightning or Setup instead, then click the Console+ icon.\n\n' +
  'Example: https://yourorg.sandbox.lightning.force.com';

export const UNSUPPORTED_PAGE_ERROR =
  'Console+ only works on Salesforce platform pages (Lightning, Setup, Classic, Developer Console).';

export function isHtmlResponse(body: string): boolean {
  const trimmed = body.trimStart();
  return trimmed.startsWith('<!') || trimmed.startsWith('<html') || trimmed.toLowerCase().startsWith('<!doctype');
}

export function formatApiParseError(body: string): string {
  if (isHtmlResponse(body)) {
    return (
      'Salesforce returned a web page instead of API data (invalid session or wrong org URL).\n\n' +
      'Make sure you opened Console+ from Salesforce Lightning or Setup — not from Experience Cloud (*.my.site.com).'
    );
  }
  const snippet = body.slice(0, 200).trim();
  return snippet ? `API response error: ${snippet}` : 'API returned an unexpected response.';
}
