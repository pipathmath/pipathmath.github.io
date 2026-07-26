import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RESERVE_SEAT_SQL } from "../server/db";

const migration = readFileSync(
  new URL("../migrations/0001_enrollment.sql", import.meta.url),
  "utf8",
);
const cohortId = "august-2026";
const futureExpiry = Math.floor(Date.now() / 1_000) + 1_800;

function reservationValues(id: string, expiry = futureExpiry) {
  return [
    id,
    cohortId,
    expiry,
    `fingerprint-${id}`,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "https://www.pipathacademy.com/sat-math-bootcamp",
    null,
    cohortId,
    cohortId,
    cohortId,
    cohortId,
  ] as const;
}

describe("enrollment migration and atomic seat reservation", () => {
  let db: DatabaseSync;

  beforeEach(() => {
    db = new DatabaseSync(":memory:");
    db.exec(migration);
  });

  afterEach(() => {
    db.close();
  });

  function reserve(id: string, expiry = futureExpiry) {
    return db.prepare(RESERVE_SEAT_SQL).get(...reservationValues(id, expiry)) as
      | { id: string }
      | undefined;
  }

  it("seeds exactly one enrolling August cohort with a technical capacity of 15", () => {
    const cohort = db
      .prepare("SELECT id, status, capacity, price_cents FROM cohorts")
      .get();

    expect(cohort).toEqual({
      id: "august-2026",
      status: "enrolling",
      capacity: 15,
      price_cents: 29_900,
    });
  });

  it("allows 15 live holds and rejects the 16th reservation", () => {
    for (let seat = 1; seat <= 15; seat += 1) {
      expect(reserve(`attempt-${seat}`)).toEqual({ id: `attempt-${seat}` });
    }

    expect(reserve("attempt-16")).toBeUndefined();
  });

  it("releases expired holds back into inventory", () => {
    for (let seat = 1; seat <= 15; seat += 1) {
      reserve(`attempt-${seat}`);
    }

    db.prepare(
      "UPDATE checkout_attempts SET reservation_expires_at = ? WHERE id = ?",
    ).run(Math.floor(Date.now() / 1_000) - 1, "attempt-1");

    expect(reserve("replacement-attempt")).toEqual({ id: "replacement-attempt" });
  });

  it("continues counting a completed hold after it becomes a paid enrollment", () => {
    for (let seat = 1; seat <= 15; seat += 1) {
      reserve(`attempt-${seat}`);
    }

    db.prepare(
      `UPDATE checkout_attempts
       SET status = 'completed', stripe_checkout_session_id = ?
       WHERE id = ?`,
    ).run("cs_test_paid", "attempt-1");
    db.prepare(
      "INSERT INTO parents (id, email, full_name) VALUES (?, ?, ?)",
    ).run("parent-1", "parent@example.com", "Test Parent");
    db.prepare(
      `INSERT INTO enrollments (
        id, cohort_id, parent_id, checkout_attempt_id,
        stripe_checkout_session_id, status, paid_at
      ) VALUES (?, ?, ?, ?, ?, 'paid', ?)`,
    ).run(
      "enrollment-1",
      cohortId,
      "parent-1",
      "attempt-1",
      "cs_test_paid",
      new Date().toISOString(),
    );

    expect(reserve("attempt-16")).toBeUndefined();
  });
});
