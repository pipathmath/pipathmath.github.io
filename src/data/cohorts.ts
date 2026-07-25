export type CohortStatus = "enrolling" | "waitlist" | "closed";

export interface SessionDate {
  shortDate: string;
  fullDate: string;
}

export interface Cohort {
  id: string;
  eyebrow: string;
  title: string;
  dateRange: string;
  days: string;
  time: string;
  timezone: string;
  format: string;
  price: number;
  status: CohortStatus;
  marketingCapacity: string;
  sessions: SessionDate[];
}

export const augustSatMathCohort: Cohort = {
  id: "august-2026",
  eyebrow: "Next live cohort",
  title: "August Digital SAT Math Bootcamp",
  dateRange: "August 18–September 10, 2026",
  days: "Tuesdays & Thursdays",
  time: "7:00–8:15 PM",
  timezone: "ET",
  format: "Live online via Zoom",
  price: 299,
  status: "enrolling",
  marketingCapacity: "A focused cohort of 10–15 students",
  sessions: [
    { shortDate: "Aug 18", fullDate: "Tuesday, August 18" },
    { shortDate: "Aug 20", fullDate: "Thursday, August 20" },
    { shortDate: "Aug 25", fullDate: "Tuesday, August 25" },
    { shortDate: "Aug 27", fullDate: "Thursday, August 27" },
    { shortDate: "Sep 1", fullDate: "Tuesday, September 1" },
    { shortDate: "Sep 3", fullDate: "Thursday, September 3" },
    { shortDate: "Sep 8", fullDate: "Tuesday, September 8" },
    { shortDate: "Sep 10", fullDate: "Thursday, September 10" },
  ],
};
