import { recordAudit } from "./enrollment";
import type { Env } from "./types";
import type { FulfilledEnrollment } from "./enrollment";

interface EmailMessage {
  kind: "parent_confirmation" | "owner_notification";
  recipient: string;
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/u)[0] || "there";
}

function onboardingUrl(env: Env, token: string): string {
  const origin = env.SITE_URL?.trim() || "https://www.pipathacademy.com";
  return `${new URL(origin).origin}/sat-math-bootcamp/enrollment-confirmed?token=${encodeURIComponent(token)}`;
}

function parentMessage(
  env: Env,
  enrollment: FulfilledEnrollment,
): EmailMessage {
  const url = onboardingUrl(env, enrollment.onboardingToken);
  const safeName = escapeHtml(firstName(enrollment.parentName));
  const safeCohort = escapeHtml(enrollment.cohort.name);

  return {
    kind: "parent_confirmation",
    recipient: enrollment.parentEmail,
    subject: `You're enrolled: ${enrollment.cohort.name}`,
    html: `<p>Hi ${safeName},</p>
<p>Your student's place in <strong>${safeCohort}</strong> is confirmed.</p>
<p>The next step is a short academic profile so Dr. Ferrer can prepare the diagnostic and targeted practice.</p>
<p><a href="${escapeHtml(url)}">Complete student onboarding</a></p>
<p>You can use the same secure link later if you do not have the details ready now.</p>
<p>PiPath Academy<br>Dr. Orlando Ferrer</p>`,
    text: `Hi ${firstName(enrollment.parentName)},

Your student's place in ${enrollment.cohort.name} is confirmed.

Complete the short academic profile here:
${url}

You can use the same secure link later if you do not have the details ready now.

PiPath Academy
Dr. Orlando Ferrer`,
  };
}

function ownerMessage(
  env: Env,
  enrollment: FulfilledEnrollment,
): EmailMessage {
  const ownerEmail = env.OWNER_EMAIL?.trim() || "pipathmath@gmail.com";
  const onboardingState = onboardingUrl(env, enrollment.onboardingToken);

  return {
    kind: "owner_notification",
    recipient: ownerEmail,
    subject: `New paid SAT enrollment: ${enrollment.cohort.name}`,
    html: `<p>A new paid enrollment was recorded.</p>
<ul>
<li>Cohort: ${escapeHtml(enrollment.cohort.name)}</li>
<li>Parent: ${escapeHtml(enrollment.parentName)}</li>
<li>Email: ${escapeHtml(enrollment.parentEmail)}</li>
<li>Phone: ${escapeHtml(enrollment.parentPhone || "Not provided")}</li>
<li>Amount: $${(enrollment.amountCents / 100).toFixed(2)} ${escapeHtml(enrollment.currency.toUpperCase())}</li>
</ul>
<p><a href="${escapeHtml(onboardingState)}">Open the onboarding link</a></p>`,
    text: `A new paid enrollment was recorded.

Cohort: ${enrollment.cohort.name}
Parent: ${enrollment.parentName}
Email: ${enrollment.parentEmail}
Phone: ${enrollment.parentPhone || "Not provided"}
Amount: $${(enrollment.amountCents / 100).toFixed(2)} ${enrollment.currency.toUpperCase()}

Onboarding link: ${onboardingState}`,
  };
}

async function markDelivery(
  env: Env,
  enrollmentId: string,
  kind: EmailMessage["kind"],
  values: {
    status: "pending" | "sent" | "failed";
    providerMessageId?: string | null;
    lastError?: string | null;
    incrementAttempts?: boolean;
  },
): Promise<void> {
  await env.DB.prepare(
    `UPDATE email_deliveries
     SET status = ?,
         provider_message_id = COALESCE(?, provider_message_id),
         last_error = ?,
         attempts = attempts + ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
     WHERE enrollment_id = ?
       AND kind = ?`,
  )
    .bind(
      values.status,
      values.providerMessageId ?? null,
      values.lastError ?? null,
      values.incrementAttempts ? 1 : 0,
      enrollmentId,
      kind,
    )
    .run();
}

async function deliverOnce(
  env: Env,
  enrollmentId: string,
  message: EmailMessage,
): Promise<boolean> {
  await env.DB.prepare(
    `INSERT OR IGNORE INTO email_deliveries (
       id, enrollment_id, kind, recipient, status
     ) VALUES (?, ?, ?, ?, 'pending')`,
  )
    .bind(crypto.randomUUID(), enrollmentId, message.kind, message.recipient)
    .run();

  const delivery = await env.DB.prepare(
    `SELECT status
     FROM email_deliveries
     WHERE enrollment_id = ?
       AND kind = ?`,
  )
    .bind(enrollmentId, message.kind)
    .first<{ status: "pending" | "sent" | "failed" }>();

  if (delivery?.status === "sent") {
    return true;
  }

  const apiKey = env.RESEND_API_KEY?.trim();
  const from = env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    await markDelivery(env, enrollmentId, message.kind, {
      status: "failed",
      lastError: "email_configuration_missing",
    });
    await recordAudit(
      env,
      "email_skipped_configuration_missing",
      "enrollment",
      enrollmentId,
      { kind: message.kind },
    );
    return false;
  }

  await markDelivery(env, enrollmentId, message.kind, {
    status: "pending",
    incrementAttempts: true,
  });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "idempotency-key": `enrollment/${enrollmentId}/${message.kind}`,
    },
    body: JSON.stringify({
      from,
      to: [message.recipient],
      subject: message.subject,
      html: message.html,
      text: message.text,
      reply_to: env.OWNER_EMAIL?.trim() || "pipathmath@gmail.com",
      tags: [
        { name: "category", value: message.kind },
        { name: "enrollment", value: enrollmentId.replaceAll("-", "_") },
      ],
    }),
  });

  if (!response.ok) {
    const errorCode = `resend_http_${response.status}`;
    await markDelivery(env, enrollmentId, message.kind, {
      status: "failed",
      lastError: errorCode,
    });
    throw new Error(errorCode);
  }

  const result = (await response.json()) as { id?: string };
  await markDelivery(env, enrollmentId, message.kind, {
    status: "sent",
    providerMessageId: result.id ?? null,
  });

  return true;
}

export async function sendEnrollmentEmails(
  env: Env,
  enrollment: FulfilledEnrollment,
): Promise<{ parentSent: boolean; ownerSent: boolean }> {
  const parentSent = await deliverOnce(
    env,
    enrollment.enrollmentId,
    parentMessage(env, enrollment),
  );
  const ownerSent = await deliverOnce(
    env,
    enrollment.enrollmentId,
    ownerMessage(env, enrollment),
  );

  return { parentSent, ownerSent };
}
