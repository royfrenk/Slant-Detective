import React from "react";

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
    title: "Paste an Anthropic API key later for the full rubric",
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
    <li className="bg-surface-variant rounded-lg px-4 py-3 border-l-[3px] border-l-primary list-none">
      <p className="text-on-surface font-semibold text-sm leading-snug m-0">
        {title}
      </p>
      <p className="text-on-surface-variant font-normal text-[13px] leading-relaxed mt-1 mb-0">
        {body}
      </p>
    </li>
  );
}

export default function Welcome(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-[640px]">
        {/* Content card */}
        <div className="bg-surface rounded-2xl p-8 md:p-12 shadow-ambient">
          {/* Wordmark */}
          <p className="text-primary font-bold text-[13px] tracking-wordmark uppercase mb-6 m-0">
            Slant Detective
          </p>

          {/* Headline */}
          <h1 className="text-on-surface font-semibold text-[22px] md:text-[26px] leading-[1.3] mb-8 mt-0">
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

        {/* Footer nav triad */}
        {/* TODO SD-Week4: wire to how-we-measure.html, privacy.html, credits.html */}
        <nav
          className="mt-8 flex items-center justify-center gap-0 text-xs text-on-surface-variant"
          aria-label="Footer navigation"
        >
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-label="How we measure bias"
            className="text-on-surface-variant no-underline hover:underline"
          >
            How we measure
          </a>
          <span className="mx-2 select-none" aria-hidden="true">·</span>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-label="Privacy policy"
            className="text-on-surface-variant no-underline hover:underline"
          >
            Privacy
          </a>
          <span className="mx-2 select-none" aria-hidden="true">·</span>
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            aria-label="Credits and attributions"
            className="text-on-surface-variant no-underline hover:underline"
          >
            Credits
          </a>
        </nav>
      </div>
    </div>
  );
}
