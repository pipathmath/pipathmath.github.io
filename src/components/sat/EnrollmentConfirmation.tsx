import {
  useEffect,
  useState,
  type SubmitEvent as ReactSubmitEvent,
} from "react";

interface EnrolledStatus {
  state: "enrolled";
  cohortId: string;
  cohortName: string;
  startsAt: string;
  endsAt: string;
  maskedParentEmail: string;
  onboardingComplete: boolean;
  onboardingToken: string;
}

type StatusPayload =
  | { state: "processing" }
  | EnrolledStatus
  | { state: "unavailable" };

type ViewState =
  | { name: "loading" }
  | { name: "processing" }
  | { name: "enrolled"; enrollment: EnrolledStatus }
  | { name: "complete"; firstName?: string }
  | { name: "error"; message: string };

interface ApiErrorPayload {
  message?: string;
}

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 1_500;

function lookupQuery(): string | null {
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get("session_id");
  const token = params.get("token");

  if (sessionId && !token) {
    return `session_id=${encodeURIComponent(sessionId)}`;
  }

  if (token && !sessionId) {
    return `token=${encodeURIComponent(token)}`;
  }

  return null;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.message || "We could not verify this enrollment.";
  } catch {
    return "We could not verify this enrollment.";
  }
}

export default function EnrollmentConfirmation() {
  const [view, setView] = useState<ViewState>({ name: "loading" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;
    let timeoutId: number | undefined;

    async function loadStatus(attempt: number): Promise<void> {
      const query = lookupQuery();
      if (!query) {
        if (active) {
          setView({
            name: "error",
            message: "This page needs the secure link from Stripe or your confirmation email.",
          });
        }
        return;
      }

      try {
        const response = await fetch(`/api/enrollment-status?${query}`, {
          headers: { accept: "application/json" },
        });

        if (!response.ok) {
          throw new Error(await errorMessage(response));
        }

        const payload = (await response.json()) as StatusPayload;
        if (!active) {
          return;
        }

        if (payload.state === "processing" && attempt < POLL_ATTEMPTS) {
          setView({ name: "processing" });
          timeoutId = window.setTimeout(
            () => void loadStatus(attempt + 1),
            POLL_DELAY_MS,
          );
          return;
        }

        if (payload.state === "enrolled") {
          setView(
            payload.onboardingComplete
              ? { name: "complete" }
              : { name: "enrolled", enrollment: payload },
          );
          return;
        }

        setView({
          name: "error",
          message:
            payload.state === "processing"
              ? "Payment succeeded, but enrollment is still finalizing. Please use the link in your confirmation email in a few minutes."
              : "We could not find an active paid enrollment for this link.",
        });
      } catch (error) {
        if (active) {
          setView({
            name: "error",
            message:
              error instanceof Error
                ? error.message
                : "We could not verify this enrollment.",
          });
        }
      }
    }

    void loadStatus(0);

    return () => {
      active = false;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  async function submitOnboarding(event: ReactSubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (view.name !== "enrolled") {
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    const formData = new FormData(event.currentTarget);
    const body = {
      token: view.enrollment.onboardingToken,
      studentFirstName: String(formData.get("studentFirstName") ?? ""),
      studentLastName: String(formData.get("studentLastName") ?? ""),
      grade: String(formData.get("grade") ?? ""),
      scoreRange: String(formData.get("scoreRange") ?? ""),
      targetAndChallenges: String(formData.get("targetAndChallenges") ?? ""),
    };

    try {
      const response = await fetch("/api/onboarding", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(await errorMessage(response));
      }

      const result = (await response.json()) as {
        completed: boolean;
        studentFirstName?: string;
      };

      window.history.replaceState(
        {},
        "",
        "/sat-math-bootcamp/enrollment-confirmed",
      );
      setView({ name: "complete", firstName: result.studentFirstName });
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "We could not save the student profile. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (view.name === "loading" || view.name === "processing") {
    return (
      <section className="confirmation-card confirmation-status" aria-live="polite">
        <span className="status-chip">Payment complete</span>
        <h1>We are finalizing your enrollment.</h1>
        <p>
          Stripe has returned you to PiPath. We are securely confirming the payment
          and creating the enrollment record.
        </p>
        <div className="status-progress" aria-hidden="true" />
      </section>
    );
  }

  if (view.name === "error") {
    return (
      <section className="confirmation-card confirmation-status" role="alert">
        <span className="status-chip status-chip-neutral">Enrollment help</span>
        <h1>We need a little help finding this enrollment.</h1>
        <p>{view.message}</p>
        <p>
          Please email{" "}
          <a href="mailto:pipathmath@gmail.com">pipathmath@gmail.com</a> and include
          the parent email used at checkout.
        </p>
        <a className="button button-secondary" href="/sat-math-bootcamp">
          Return to course details
        </a>
      </section>
    );
  }

  if (view.name === "complete") {
    return (
      <section className="confirmation-card confirmation-status" aria-live="polite">
        <span className="status-chip">Profile received</span>
        <h1>
          {view.firstName ? `Thank you. ${view.firstName}'s profile is complete.` : "Your student profile is complete."}
        </h1>
        <p>
          Dr. Ferrer now has the starting information needed to prepare the
          diagnostic and targeted practice.
        </p>
        <div className="confirmation-next">
          <strong>What happens next</strong>
          <ol>
            <li>Keep the enrollment confirmation email for your records.</li>
            <li>Watch for diagnostic and course-access details from PiPath Academy.</li>
            <li>Plan to join the live Zoom sessions a few minutes early.</li>
          </ol>
        </div>
        <a className="button button-primary" href="/sat-math-bootcamp">
          Review the course schedule
        </a>
      </section>
    );
  }

  const { enrollment } = view;

  return (
    <section className="confirmation-card">
      <div className="confirmation-status">
        <span className="status-chip">Enrollment confirmed</span>
        <h1>You're enrolled.</h1>
        <p>
          A confirmation has been sent to {enrollment.maskedParentEmail}. Your
          student's place in <strong>{enrollment.cohortName}</strong> is secure.
        </p>
      </div>

      <div className="onboarding-intro">
        <p className="section-kicker">Optional now, required before class</p>
        <h2>Help us prepare the right starting point.</h2>
        <p>
          This short profile replaces the old interest form. You can complete it
          now or return through the secure link in your confirmation email.
        </p>
      </div>

      <form className="onboarding-form" onSubmit={submitOnboarding}>
        <div className="form-grid">
          <label className="form-field">
            <span>Student's first name</span>
            <input
              name="studentFirstName"
              type="text"
              autoComplete="given-name"
              maxLength={80}
              required
            />
          </label>

          <label className="form-field">
            <span>Student's last name</span>
            <input
              name="studentLastName"
              type="text"
              autoComplete="family-name"
              maxLength={80}
              required
            />
          </label>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Student's grade level</span>
            <select name="grade" defaultValue="" required>
              <option value="" disabled>Select a grade</option>
              <option value="9">9th Grade</option>
              <option value="10">10th Grade</option>
              <option value="11">11th Grade</option>
              <option value="12">12th Grade</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="form-field">
            <span>Recent SAT or PSAT Math score</span>
            <select name="scoreRange" defaultValue="" required>
              <option value="" disabled>Select the closest range</option>
              <option value="baseline_needed">We have not taken one yet</option>
              <option value="under_500">Under 500</option>
              <option value="500_600">500-600</option>
              <option value="600_700">600-700</option>
              <option value="700_plus">700+</option>
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>Target SAT Math score and challenging topics</span>
          <textarea
            name="targetAndChallenges"
            rows={5}
            maxLength={1000}
            placeholder="For example: aiming for 700; quadratics and multi-step word problems are the biggest challenges."
            required
          />
          <small>Share whatever you know now. A diagnostic will establish the baseline.</small>
        </label>

        {formError && (
          <p className="form-error" role="alert">
            {formError}
          </p>
        )}

        <button className="button button-primary" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Saving profile..." : "Complete student profile"}
        </button>
      </form>
    </section>
  );
}
