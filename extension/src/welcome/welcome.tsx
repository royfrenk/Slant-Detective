import React from "react";
import { FEEDBACK_FORM_URL } from "../shared/urls";

interface Bullet {
  title: string;
  body: string;
}

const BULLETS: readonly Bullet[] = [
  {
    title: "Per-article bias analysis",
    body: "Slant Detective reads the article you have open and scores it across four dimensions.",
  },
  {
    title: "Works immediately, no setup needed",
    body: "Source labels and language-intensity signals run entirely in your browser, no account required.",
  },
  {
    title: "Add an API key later — Anthropic, OpenAI, or Gemini",
    body: "Unlock tilt direction, four-dimension breakdown, evidence spans, and inline highlights.",
  },
] as const;

function handleTryIt(): void {
  chrome.tabs.getCurrent((tab) => {
    if (tab?.id !== undefined) {
      chrome.tabs.remove(tab.id);
    }
  });
}

function BulletItem({ title, body }: Bullet): React.JSX.Element {
  return (
    <li className="bg-surface-variant rounded-lg px-5 py-4 border-l-[3px] border-l-primary list-none">
      <p className="text-on-surface font-semibold text-[15px] leading-snug m-0">
        {title}
      </p>
      <p className="text-on-surface-variant font-normal text-[14px] leading-relaxed mt-1.5 mb-0">
        {body}
      </p>
    </li>
  );
}

export default function Welcome(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[720px]">
        {/* Content card */}
        <div className="bg-surface rounded-2xl p-8 md:p-12 shadow-ambient">
          {/* Logo + wordmark row */}
          <div className="flex items-center gap-3 mb-6">
            <img
              src={chrome.runtime.getURL('assets/icon-128.png')}
              alt=""
              aria-hidden="true"
              width={40}
              height={40}
              className="block"
            />
            <p className="text-primary font-bold text-[13px] tracking-wordmark uppercase m-0">
              Slant Detective
            </p>
          </div>

          {/* Headline */}
          <h1 className="text-on-surface font-semibold text-[24px] md:text-[28px] leading-[1.3] mb-8 mt-0">
            Find the lean in what you read.
          </h1>

          {/* Three bullet items */}
          <ul className="flex flex-col gap-5 p-0 m-0 mb-10">
            {BULLETS.map((bullet) => (
              <BulletItem key={bullet.title} title={bullet.title} body={bullet.body} />
            ))}
          </ul>

          {/* Try it button */}
          <button
            type="button"
            onClick={handleTryIt}
            aria-label="Try it — close this tab and start using Slant Detective"
            className={[
              "bg-gradient-to-br from-primary to-primary-container",
              "text-on-primary font-medium text-sm",
              "px-8 py-3 rounded-md border-0 cursor-pointer",
              "transition-transform duration-75",
              "hover:brightness-[0.96]",
              "focus:outline focus:outline-2 focus:outline-primary focus:outline-offset-2",
              "active:scale-[0.98]",
            ].join(" ")}
          >
            Try it
          </button>
        </div>

        {/* Footer nav quad */}
        <nav
          className="mt-8 flex items-center justify-center gap-0 text-xs text-on-surface-variant"
          aria-label="Footer navigation"
        >
          <a
            role="link"
            tabIndex={0}
            aria-label="How we measure bias"
            className="text-on-surface-variant no-underline hover:underline cursor-pointer"
            onClick={() => { chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/how-we-measure.html') }).catch(() => {}); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/how-we-measure.html') }).catch(() => {}); }}
          >
            How we measure
          </a>
          <span className="mx-2 select-none" aria-hidden="true">·</span>
          <a
            role="link"
            tabIndex={0}
            aria-label="Privacy policy"
            className="text-on-surface-variant no-underline hover:underline cursor-pointer"
            onClick={() => { chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/privacy.html') }).catch(() => {}); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/privacy.html') }).catch(() => {}); }}
          >
            Privacy
          </a>
          <span className="mx-2 select-none" aria-hidden="true">·</span>
          <a
            role="link"
            tabIndex={0}
            aria-label="Credits and attributions"
            className="text-on-surface-variant no-underline hover:underline cursor-pointer"
            onClick={() => { chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/credits.html') }).catch(() => {}); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') chrome.tabs.create({ url: chrome.runtime.getURL('src/pages/credits.html') }).catch(() => {}); }}
          >
            Credits
          </a>
          <span className="mx-2 select-none" aria-hidden="true">·</span>
          <a
            role="link"
            tabIndex={0}
            aria-label="Open Slant Detective feedback form in new tab"
            className="text-on-surface-variant no-underline hover:underline cursor-pointer"
            onClick={() => { chrome.tabs.create({ url: FEEDBACK_FORM_URL, active: true }).catch(() => {}); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') chrome.tabs.create({ url: FEEDBACK_FORM_URL, active: true }).catch(() => {}); }}
          >
            Feedback
          </a>
        </nav>
      </div>
    </div>
  );
}
