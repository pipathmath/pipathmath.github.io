import { useId, useState } from "react";
import type { Cohort } from "../../data/cohorts";

interface Props {
  cohort: Cohort;
}
export default function CohortCard({ cohort }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const sessionListId = useId();

  return (
    <article className="cohort-card" id={cohort.id}>
      <div className="cohort-date-block" aria-hidden="true">
        <span>AUG</span>
        <strong>18</strong>
        <small>Starts</small>
      </div>

      <div className="cohort-main">
        <p className="section-kicker">{cohort.eyebrow}</p>
        <h3>{cohort.title}</h3>
        <p className="cohort-date-range">{cohort.dateRange}</p>

        <dl className="cohort-facts">
          <div>
            <dt>Meeting time</dt>
            <dd>
              {cohort.days}<br />
              {cohort.time} {cohort.timezone}
            </dd>
          </div>
          <div>
            <dt>Format</dt>
            <dd>{cohort.format}</dd>
          </div>
          <div>
            <dt>Instruction</dt>
            <dd>8 sessions · 10 live hours</dd>
          </div>
          <div>
            <dt>Group size</dt>
            <dd>{cohort.marketingCapacity}</dd>
          </div>
        </dl>

        <button
          className="text-button"
          type="button"
          aria-expanded={isExpanded}
          aria-controls={sessionListId}
          onClick={() => setIsExpanded((currentValue) => !currentValue)}
        >
          {isExpanded ? "Hide all class dates" : "See all 8 class dates"}
          <span aria-hidden="true">{isExpanded ? "−" : "+"}</span>
        </button>

        {isExpanded && (
          <div className="session-list" id={sessionListId}>
            {cohort.sessions.map((session, index) => (
              <div className="session-item" key={session.shortDate}>
                <span>Class {index + 1}</span>
                <strong>{session.fullDate}</strong>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="cohort-enrollment">
        <span className="status-chip">Enrollment open</span>
        <p className="cohort-price">
          <span>Complete program</span>
          <strong>${cohort.price}</strong>
        </p>
        <a className="button button-primary button-full" href="#enrollment">
          Enroll — ${cohort.price}
        </a>
        <small>Secure Stripe checkout will be connected in Batch 2.</small>
      </div>
    </article>
  );
}
