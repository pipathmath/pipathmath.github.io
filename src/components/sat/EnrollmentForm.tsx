import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type FocusEvent,
  type SubmitEvent as ReactSubmitEvent,
} from "react";

interface Props {
  cohortId: string;
  price: number;
  enabled: boolean;
  consultationUrl: string;
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

interface FormValues {
  parentName: string;
  studentName: string;
  parentEmail: string;
  parentPhone: string;
  studentMathScore: string;
  additionalNotes: string;
}

const ATTRIBUTION_KEY = "pipath_attribution";
const FORM_DRAFT_KEY = "pipath_enrollment_draft";
const GA4_MEASUREMENT_ID = "G-EXV4N60WP8";
const emptyForm: FormValues = {
  parentName: "",
  studentName: "",
  parentEmail: "",
  parentPhone: "",
  studentMathScore: "",
  additionalNotes: "",
};

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
    if (existing) return JSON.parse(existing) as Omit<AttributionPayload, "gaClientId">;
  } catch {
    // Checkout remains available when storage is unavailable.
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
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  if (!gtag) return Promise.resolve(null);

  return new Promise((resolve) => {
    let resolved = false;
    const timeoutId = window.setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 700);

    gtag("get", GA4_MEASUREMENT_ID, "client_id", (clientId: unknown) => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timeoutId);
      resolve(typeof clientId === "string" ? clientId.slice(0, 120) : null);
    });
  });
}

function trackCheckoutStart(cohortId: string, price: number): void {
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
  gtag?.("event", "generate_lead", { currency: "USD", value: price });
  gtag?.("event", "begin_checkout", {
    currency: "USD",
    value: price,
    items: [{ item_id: cohortId, item_name: "Digital SAT Math Bootcamp", price, quantity: 1 }],
  });
}

function emailValidationMessage(input: HTMLInputElement): string {
  if (input.validity.valueMissing) {
    return "Enter the parent or guardian's email address.";
  }

  if (
    input.validity.typeMismatch ||
    (input.value.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(input.value.trim()))
  ) {
    return "Enter a valid email address, such as name@example.com.";
  }

  return "";
}

async function responseMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message || "Checkout could not be started. Please try again.";
  } catch {
    return "Checkout could not be started. Please try again.";
  }
}

export default function EnrollmentForm({ cohortId, price, enabled, consultationUrl }: Props) {
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const errorId = useId();
  const availabilityId = useId();
  const emailErrorId = useId();

  useEffect(() => {
    try {
      const draft = window.sessionStorage.getItem(FORM_DRAFT_KEY);
      if (draft) setValues({ ...emptyForm, ...(JSON.parse(draft) as Partial<FormValues>) });
    } catch {
      // A canceled checkout can still be restarted with a fresh form.
    }
  }, []);

  useEffect(() => {
    function resetCheckoutNavigationState(): void {
      // Browsers can restore this React tree from the back-forward cache after
      // Stripe navigation. Loading is transient and must not keep the form locked.
      setIsStarting(false);
    }

    window.addEventListener("pageshow", resetCheckoutNavigationState);
    return () => window.removeEventListener("pageshow", resetCheckoutNavigationState);
  }, []);

  function updateValue(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setValues((current) => {
      const nextValues = { ...current, [event.target.name]: event.target.value };
      try {
        window.sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(nextValues));
      } catch {
        // Form entry still works when browser storage is unavailable.
      }
      return nextValues;
    });
  }

  function updateEmail(event: ChangeEvent<HTMLInputElement>) {
    updateValue(event);
    if (emailError) setEmailError(emailValidationMessage(event.currentTarget));
  }

  function validateEmail(event: FocusEvent<HTMLInputElement>) {
    setEmailError(emailValidationMessage(event.currentTarget));
  }

  async function startCheckout(event: ReactSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enabled || isStarting) return;

    setIsStarting(true);
    setError("");

    try {
      try {
        window.sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(values));
      } catch {
        // Draft persistence is a convenience, not a checkout requirement.
      }

      const attribution = { ...storedAttribution(), gaClientId: await gaClientId() };
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ cohortId, ...values, attribution }),
      });

      if (!response.ok) throw new Error(await responseMessage(response));
      const result = (await response.json()) as { url?: string };
      if (!result.url) throw new Error("Checkout did not return a secure payment link.");

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

  return (
    <div className="enrollment-form-card">
      <div className="enrollment-form-topline">
        <div>
          <span>August SAT Math Bootcamp</span>
          <strong>Family enrollment form</strong>
        </div>
        <p><span>Program tuition</span><strong>${price}</strong></p>
      </div>

      <form onSubmit={startCheckout}>
        <fieldset disabled={isStarting}>
          <legend>Parent and student details</legend>
          <p className="enrollment-form-intro">We'll use this information to prepare for your student and send enrollment details. Required fields are marked <span aria-hidden="true">*</span>.</p>

          <div className="form-grid">
            <label className="form-field">
              <span>Parent or guardian name *</span>
              <input name="parentName" type="text" autoComplete="name" maxLength={120} value={values.parentName} onChange={updateValue} required />
            </label>
            <label className="form-field">
              <span>Student's name *</span>
              <input name="studentName" type="text" autoComplete="off" maxLength={120} value={values.studentName} onChange={updateValue} required />
            </label>
          </div>

          <div className="form-grid">
            <label className="form-field">
              <span>Parent or guardian email *</span>
              <input
                name="parentEmail"
                type="email"
                autoComplete="email"
                maxLength={254}
                value={values.parentEmail}
                onChange={updateEmail}
                onBlur={validateEmail}
                onInvalid={(event) => setEmailError(emailValidationMessage(event.currentTarget))}
                aria-invalid={emailError ? "true" : undefined}
                aria-describedby={emailError ? emailErrorId : undefined}
                required
              />
              {emailError && <small className="form-field-error" id={emailErrorId} role="alert">{emailError}</small>}
            </label>
            <label className="form-field">
              <span>Parent or guardian phone *</span>
              <input name="parentPhone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} value={values.parentPhone} onChange={updateValue} required />
            </label>
          </div>

          <label className="form-field form-field-score">
            <span>Recent SAT or PSAT Math score <small>Optional</small></span>
            <input name="studentMathScore" type="number" inputMode="numeric" min={160} max={800} step={1} placeholder="For example, 700" value={values.studentMathScore} onChange={updateValue} />
            <small>Enter the Math section score from the most recent SAT or PSAT, if available.</small>
          </label>

          <label className="form-field">
            <span>Anything else we should know? <small>Optional</small></span>
            <textarea name="additionalNotes" rows={4} maxLength={1000} placeholder="Your message to us" value={values.additionalNotes} onChange={updateValue} />
          </label>

          {error && <p className="form-error" id={errorId} role="alert">{error}</p>}

          <button
            className="button button-primary button-full"
            type="submit"
            disabled={!enabled || isStarting}
            aria-describedby={error ? errorId : !enabled ? availabilityId : undefined}
          >
            {isStarting
              ? "Opening secure checkout… Please don’t refresh."
              : enabled
                ? `Continue to secure payment — $${price}`
                : "Continue to secure payment"}
          </button>
        </fieldset>
      </form>

      <div className="enrollment-form-assurance">
        <span>Your information is used only for enrollment and course communication.</span>
        <span>Card details are securely handled by Stripe.</span>
      </div>
      {!enabled && <p className="enrollment-form-disabled" id={availabilityId} role="status">Online payment isn't open yet. To enroll now, <a href={consultationUrl} target="_blank" rel="noreferrer">book a free consultation</a>.</p>}
    </div>
  );
}
