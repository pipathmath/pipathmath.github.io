import { useId, useState } from "react";

interface Props {
  cohortId: string;
  price: number;
  enabled: boolean;
  className: string;
  idleLabel: string;
  disabledLabel?: string;
  mobile?: boolean;
}

interface AttributionPayload {
  gaClientId: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  gclid: string | null;
  landingPage: string;
  referrer: string | null;
}

const ATTRIBUTION_KEY = "pipath_attribution";
const GA4_MEASUREMENT_ID = "G-EXV4N60WP8";

function queryValue(params: URLSearchParams, key: string): string | null {
  const value = params.get(key)?.trim();
  return value ? value.slice(0, 300) : null;
}

function firstTouchAttribution(): Omit<AttributionPayload, "gaClientId"> {
  const params = new URLSearchParams(window.location.search);

  return {
    utmSource: queryValue(params, "utm_source"),
    utmMedium: queryValue(params, "utm_medium"),
    utmCampaign: queryValue(params, "utm_campaign"),
    utmContent: queryValue(params, "utm_content"),
    utmTerm: queryValue(params, "utm_term"),
    gclid: queryValue(params, "gclid"),
    landingPage: window.location.href.slice(0, 2_048),
    referrer: document.referrer ? document.referrer.slice(0, 2_048) : null,
  };
}

function storedAttribution(): Omit<AttributionPayload, "gaClientId"> {
  try {
    const existing = window.sessionStorage.getItem(ATTRIBUTION_KEY);
    if (existing) {
      return JSON.parse(existing) as Omit<AttributionPayload, "gaClientId">;
    }
  } catch {
    // Privacy settings can disable sessionStorage. Checkout still works.
  }

  const attribution = firstTouchAttribution();

  try {
    window.sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
  } catch {
    // The server accepts attribution without client-side persistence.
  }

  return attribution;
}

function gaClientId(): Promise<string | null> {
  const gtag = (
    window as Window & {
      gtag?: (...args: unknown[]) => void;
    }
  ).gtag;

  if (!gtag) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    let resolved = false;
    const timeoutId = window.setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 700);

    gtag("get", GA4_MEASUREMENT_ID, "client_id", (clientId: unknown) => {
      if (resolved) {
        return;
      }

      resolved = true;
      window.clearTimeout(timeoutId);
      resolve(typeof clientId === "string" ? clientId.slice(0, 120) : null);
    });
  });
}

function trackCheckoutStart(cohortId: string, price: number): void {
  const gtag = (
    window as Window & {
      gtag?: (...args: unknown[]) => void;
    }
  ).gtag;

  gtag?.("event", "begin_checkout", {
    currency: "USD",
    value: price,
    items: [
      {
        item_id: cohortId,
        item_name: "Digital SAT Math Bootcamp",
        price,
        quantity: 1,
      },
    ],
  });
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || "Checkout could not be started. Please try again.";
  } catch {
    return "Checkout could not be started. Please try again.";
  }
}

export default function EnrollmentButton({
  cohortId,
  price,
  enabled,
  className,
  idleLabel,
  disabledLabel = "Enrollment setup in progress",
  mobile = false,
}: Props) {
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const errorId = useId();

  async function startCheckout() {
    if (!enabled || isStarting) {
      return;
    }

    setIsStarting(true);
    setError("");

    try {
      const attribution = {
        ...storedAttribution(),
        gaClientId: await gaClientId(),
      };

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify({ cohortId, attribution }),
      });

      if (!response.ok) {
        throw new Error(await responseMessage(response));
      }

      const result = (await response.json()) as { url?: string };
      if (!result.url) {
        throw new Error("Checkout did not return a secure payment link.");
      }

      trackCheckoutStart(cohortId, price);
      window.location.assign(result.url);
    } catch (checkoutError) {
      setError(
        checkoutError instanceof Error
          ? checkoutError.message
          : "Checkout could not be started. Please try again.",
      );
      setIsStarting(false);
    }
  }

  const label = enabled
    ? isStarting
      ? "Opening secure checkout..."
      : idleLabel
    : disabledLabel;

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={startCheckout}
        disabled={!enabled || isStarting}
        aria-describedby={error ? errorId : undefined}
      >
        {mobile ? (
          <>
            <span>August cohort · ${price}</span>
            <strong>{label}</strong>
          </>
        ) : (
          label
        )}
      </button>
      {error && (
        <span
          className={mobile ? "mobile-checkout-error" : "checkout-error"}
          id={errorId}
          role="alert"
        >
          {error}
        </span>
      )}
    </>
  );
}
