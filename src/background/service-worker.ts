// Service worker for Console+ extension
// Handles session extraction and window management

import {
  isExperienceCloudUrl,
  isSalesforcePlatformUrl,
  EXPERIENCE_CLOUD_ERROR,
  UNSUPPORTED_PAGE_ERROR
} from '../utils/salesforce-url';

interface SessionData {
  sessionId: string;
  instanceUrl: string;
}

const CONSOLE_WINDOW_STORAGE_KEY = 'consoleWindowId';

let consoleWindowId: number | null = null;

chrome.action.onClicked.addListener(async (tab) => {
  console.log('🚀 Console+ clicked');

  if (!tab.url) {
    await notifyUnsupported('Console+', 'No page URL detected. Open a Salesforce tab first.');
    return;
  }

  if (isExperienceCloudUrl(tab.url)) {
    console.error('❌ Experience Cloud URL not supported:', tab.url);
    await notifyUnsupported('Experience Cloud not supported', EXPERIENCE_CLOUD_ERROR);
    return;
  }

  if (!isSalesforcePlatformUrl(tab.url)) {
    console.error('❌ Not on Salesforce platform page:', tab.url);
    await notifyUnsupported('Unsupported page', UNSUPPORTED_PAGE_ERROR);
    return;
  }

  try {
    const session = await extractSession(tab.url);

    if (!session) {
      console.error('❌ No session found - please make sure you are logged in');
      await notifyUnsupported(
        'No Salesforce session',
        'Could not read your Salesforce login session. Open Lightning or Setup while logged in, then try again.'
      );
      return;
    }

    console.log('✅ Session extracted');
    console.log(`   API host: ${new URL(session.instanceUrl).hostname}`);
    await chrome.storage.local.set({ session });
    console.log('✅ Session stored');

    await openConsoleWindow(tab);
    console.log('✅ Window opened');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Error:', message);
  }
});

chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === consoleWindowId) {
    consoleWindowId = null;
    chrome.storage.local.remove(CONSOLE_WINDOW_STORAGE_KEY);
  }
});

async function notifyUnsupported(title: string, message: string): Promise<void> {
  try {
    await chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
      title: `Console+ — ${title}`,
      message: message.replace(/\n+/g, ' ').slice(0, 240)
    });
  } catch {
    console.error(title, message);
  }
}

/**
 * Map UI host (Lightning, Setup, etc.) to REST API instance URL.
 */
function buildInstanceUrlCandidates(pageUrl: string): string[] {
  const candidates: string[] = [];

  try {
    const hostname = new URL(pageUrl).hostname;
    const subdomain = hostname.split('.')[0];

    if (hostname.endsWith('.salesforce-setup.com')) {
      if (hostname.includes('.scratch.my.salesforce-setup.com')) {
        candidates.push(`https://${subdomain}.scratch.my.salesforce.com`);
      }
      if (hostname.includes('.sandbox.my.salesforce-setup.com')) {
        candidates.push(`https://${subdomain}.sandbox.my.salesforce.com`);
      }
      if (hostname.includes('.develop.my.salesforce-setup.com')) {
        candidates.push(`https://${subdomain}.develop.my.salesforce.com`);
      }
      candidates.push(`https://${subdomain}.my.salesforce.com`);
    }

    if (hostname.includes('lightning.force.com')) {
      if (hostname.includes('.sandbox.lightning.force.com')) {
        candidates.push(`https://${subdomain}.sandbox.my.salesforce.com`);
      }
      if (hostname.includes('.scratch.lightning.force.com')) {
        candidates.push(`https://${subdomain}.scratch.my.salesforce.com`);
      }
      if (hostname.includes('.develop.lightning.force.com')) {
        candidates.push(`https://${subdomain}.develop.my.salesforce.com`);
      }
      candidates.push(`https://${subdomain}.my.salesforce.com`);
    }

    if (hostname.endsWith('.my.salesforce.com')) {
      candidates.push(`https://${hostname}`);
    } else if (hostname.endsWith('.salesforce.com') && !hostname.endsWith('.salesforce-setup.com')) {
      candidates.push(`https://${hostname}`);
    }

    if (hostname.endsWith('.force.com') && !hostname.includes('lightning.force.com')) {
      candidates.push(`https://${hostname}`);
    }
  } catch {
    // ignore
  }

  return [...new Set(candidates)];
}

function instanceUrlFromCookieDomain(domain: string): string | null {
  const host = domain.startsWith('.') ? domain.slice(1) : domain;
  const lower = host.toLowerCase();

  if (lower.endsWith('.salesforce-setup.com')) {
    const sub = host.split('.')[0];
    if (lower.includes('.scratch.my.salesforce-setup.com')) {
      return `https://${sub}.scratch.my.salesforce.com`;
    }
    if (lower.includes('.sandbox.my.salesforce-setup.com')) {
      return `https://${sub}.sandbox.my.salesforce.com`;
    }
    return `https://${sub}.my.salesforce.com`;
  }

  if (
    lower.endsWith('.my.salesforce.com') ||
    lower.endsWith('.salesforce.com') ||
    (lower.endsWith('.force.com') && !lower.includes('lightning'))
  ) {
    return `https://${host}`;
  }

  return null;
}

async function extractSession(pageUrl: string): Promise<SessionData | null> {
  const cookieNames = ['sid', 'oid'];
  const urlsToTry = [...buildInstanceUrlCandidates(pageUrl), pageUrl];

  for (const targetUrl of urlsToTry) {
    for (const name of cookieNames) {
      try {
        const cookie = await chrome.cookies.get({ url: targetUrl, name });

        if (cookie?.value && cookie.value.length > 15) {
          const fromDomain = cookie.domain
            ? instanceUrlFromCookieDomain(cookie.domain)
            : null;
          const instanceUrl =
            fromDomain ??
            (buildInstanceUrlCandidates(pageUrl)[0] || targetUrl);

          console.log(
            `✅ Session found: ${name} from ${new URL(targetUrl).hostname} → API ${new URL(instanceUrl).hostname}`
          );
          return { sessionId: cookie.value, instanceUrl };
        }
      } catch {
        // try next
      }
    }
  }

  try {
    const allSid = await chrome.cookies.getAll({ name: 'sid' });
    const sorted = allSid
      .filter((c) => c.value && c.value.length > 15 && c.domain?.toLowerCase().includes('salesforce'))
      .sort((a, b) => {
        const score = (d: string) => {
          const x = d.toLowerCase();
          if (x.includes('.sandbox.my.salesforce.com')) return 0;
          if (x.includes('.scratch.my.salesforce.com')) return 1;
          if (x.includes('.my.salesforce.com')) return 2;
          return 3;
        };
        return score(a.domain || '') - score(b.domain || '');
      });

    for (const cookie of sorted) {
      const instanceUrl = cookie.domain
        ? instanceUrlFromCookieDomain(cookie.domain)
        : null;
      if (instanceUrl) {
        console.log(
          `✅ Session found: sid on ${cookie.domain} → API ${new URL(instanceUrl).hostname}`
        );
        return { sessionId: cookie.value, instanceUrl };
      }
    }
  } catch {
    // ignore
  }

  console.error('❌ No session found');
  return null;
}

async function getStoredConsoleWindowId(): Promise<number | null> {
  const stored = await chrome.storage.local.get(CONSOLE_WINDOW_STORAGE_KEY);
  const id = stored[CONSOLE_WINDOW_STORAGE_KEY];
  return typeof id === 'number' ? id : null;
}

async function focusExistingConsoleWindow(windowId: number): Promise<boolean> {
  try {
    const existingWindow = await chrome.windows.get(windowId);
    if (!existingWindow) return false;

    await chrome.windows.update(windowId, { focused: true, drawAttention: true });
    consoleWindowId = windowId;
    return true;
  } catch {
    await chrome.storage.local.remove(CONSOLE_WINDOW_STORAGE_KEY);
    consoleWindowId = null;
    return false;
  }
}

/** Pick the monitor that contains the Salesforce browser window (not always primary). */
async function getDisplayForTab(
  tab: chrome.tabs.Tab
): Promise<chrome.system.display.DisplayInfo | null> {
  if (!chrome.system?.display) return null;

  try {
    const displays = await chrome.system.display.getInfo();
    if (displays.length === 0) return null;

    if (tab.windowId !== undefined) {
      const browserWindow = await chrome.windows.get(tab.windowId);
      const centerX = (browserWindow.left ?? 0) + (browserWindow.width ?? 800) / 2;
      const centerY = (browserWindow.top ?? 0) + (browserWindow.height ?? 600) / 2;

      for (const display of displays) {
        const area = display.workArea;
        if (
          centerX >= area.left &&
          centerX < area.left + area.width &&
          centerY >= area.top &&
          centerY < area.top + area.height
        ) {
          return display;
        }
      }

      // Fallback: display with largest overlap with the browser window
      const winLeft = browserWindow.left ?? 0;
      const winTop = browserWindow.top ?? 0;
      const winRight = winLeft + (browserWindow.width ?? 800);
      const winBottom = winTop + (browserWindow.height ?? 600);

      let bestDisplay = displays[0];
      let bestOverlap = 0;

      for (const display of displays) {
        const area = display.workArea;
        const overlapW = Math.max(
          0,
          Math.min(winRight, area.left + area.width) - Math.max(winLeft, area.left)
        );
        const overlapH = Math.max(
          0,
          Math.min(winBottom, area.top + area.height) - Math.max(winTop, area.top)
        );
        const overlap = overlapW * overlapH;
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          bestDisplay = display;
        }
      }

      return bestDisplay;
    }

    return displays.find((d) => d.isPrimary) ?? displays[0];
  } catch {
    return null;
  }
}

function boundsForDisplay(display: chrome.system.display.DisplayInfo) {
  const area = display.workArea;
  const width = Math.floor(area.width * 0.9);
  const height = Math.floor(area.height * 0.9);
  const left = area.left + Math.floor((area.width - width) / 2);
  const top = area.top + Math.floor((area.height - height) / 2);
  return { width, height, left, top };
}

async function openConsoleWindow(tab: chrome.tabs.Tab) {
  const storedId = await getStoredConsoleWindowId();
  const candidateId = consoleWindowId ?? storedId;

  if (candidateId !== null) {
    const focused = await focusExistingConsoleWindow(candidateId);
    if (focused) return;
  }

  let width = 1400;
  let height = 900;
  let left = 100;
  let top = 100;

  const display = await getDisplayForTab(tab);
  if (display) {
    ({ width, height, left, top } = boundsForDisplay(display));
  } else if (chrome.system?.display) {
    try {
      const displays = await chrome.system.display.getInfo();
      const primary = displays.find((d) => d.isPrimary) ?? displays[0];
      if (primary) {
        ({ width, height, left, top } = boundsForDisplay(primary));
      }
    } catch {
      // use defaults
    }
  }

  const newWindow = await chrome.windows.create({
    url: chrome.runtime.getURL('index.html'),
    type: 'popup',
    width,
    height,
    left,
    top,
    focused: true
  });

  if (newWindow.id !== undefined) {
    consoleWindowId = newWindow.id;
    await chrome.storage.local.set({ [CONSOLE_WINDOW_STORAGE_KEY]: newWindow.id });
  }
}

console.log('🎯 Console+ service worker loaded');
