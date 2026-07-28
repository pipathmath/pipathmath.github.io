/**
 * PiPath enrollment receiver for a Google Apps Script web-app deployment.
 *
 * Required Script Properties:
 * - PIPATH_SPREADSHEET_ID
 * - PIPATH_SHARED_SECRET
 *
 * Do not paste either value into this file.
 */

var LEADS_SHEET_NAME = "Leads";
var EVENTS_SHEET_NAME = "Stripe Events";

var LEAD_HEADERS = [
  "created_at",
  "lead_id",
  "cohort_id",
  "cohort_name",
  "parent_name",
  "student_name",
  "parent_email",
  "parent_phone",
  "student_math_score",
  "additional_notes",
  "expected_amount_cents",
  "expected_currency",
  "lead_status",
  "payment_status",
  "stripe_checkout_session_id",
  "stripe_payment_intent_id",
  "stripe_event_id",
  "amount_paid_cents",
  "currency",
  "refunded_amount_cents",
  "paid_at",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "ga_client_id",
  "landing_page",
  "referrer",
  "follow_up_status",
  "internal_notes",
  "updated_at"
];

var EVENT_HEADERS = [
  "received_at",
  "event_id",
  "event_type",
  "lead_id",
  "checkout_session_id",
  "payment_intent_id",
  "result"
];

function doGet() {
  return jsonOutput_({
    ok: true,
    service: "pipath-enrollment-receiver"
  });
}

function doPost(event) {
  try {
    var payload = parsePayload_(event);
    authorize_(payload.secret);

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error("sheet_busy");
    }

    try {
      var spreadsheet = openSpreadsheet_();
      var leadsSheet = ensureSheet_(spreadsheet, LEADS_SHEET_NAME, LEAD_HEADERS);
      var eventsSheet = ensureSheet_(spreadsheet, EVENTS_SHEET_NAME, EVENT_HEADERS);
      var result;

      if (payload.action === "create_lead") {
        result = createLead_(leadsSheet, payload.lead);
      } else if (payload.action === "payment_update") {
        result = updatePayment_(leadsSheet, eventsSheet, payload.payment);
      } else if (payload.action === "refund_update") {
        result = updateRefund_(leadsSheet, eventsSheet, payload.refund);
      } else {
        throw new Error("unsupported_action");
      }

      SpreadsheetApp.flush();
      return jsonOutput_({ ok: true, result: result });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return jsonOutput_({
      ok: false,
      code: safeErrorCode_(error)
    });
  }
}

function parsePayload_(event) {
  if (!event || !event.postData || typeof event.postData.contents !== "string") {
    throw new Error("missing_request_body");
  }

  if (event.postData.contents.length > 20000) {
    throw new Error("request_too_large");
  }

  var payload = JSON.parse(event.postData.contents);
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("invalid_request_body");
  }

  return payload;
}

function authorize_(providedSecret) {
  var expectedSecret = PropertiesService.getScriptProperties()
    .getProperty("PIPATH_SHARED_SECRET");

  if (!expectedSecret || !constantTimeEqual_(providedSecret, expectedSecret)) {
    throw new Error("unauthorized");
  }
}

function constantTimeEqual_(left, right) {
  if (typeof left !== "string" || typeof right !== "string") {
    return false;
  }

  var difference = left.length ^ right.length;
  var maximumLength = Math.max(left.length, right.length);

  for (var index = 0; index < maximumLength; index += 1) {
    difference |= (left.charCodeAt(index % Math.max(left.length, 1)) || 0) ^
      (right.charCodeAt(index % Math.max(right.length, 1)) || 0);
  }

  return difference === 0;
}

function openSpreadsheet_() {
  var spreadsheetId = PropertiesService.getScriptProperties()
    .getProperty("PIPATH_SPREADSHEET_ID");

  if (!spreadsheetId) {
    throw new Error("spreadsheet_not_configured");
  }

  return SpreadsheetApp.openById(spreadsheetId);
}

function ensureSheet_(spreadsheet, name, headers) {
  var sheet = spreadsheet.getSheetByName(name);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#E8F0FE");
    sheet.autoResizeColumns(1, headers.length);
    return sheet;
  }

  var existingHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  for (var index = 0; index < headers.length; index += 1) {
    if (existingHeaders[index] !== headers[index]) {
      throw new Error(name.toLowerCase().replace(/\s+/g, "_") + "_header_mismatch");
    }
  }

  return sheet;
}

function createLead_(sheet, lead) {
  requireObject_(lead, "invalid_lead");
  requireId_(lead.leadId, "invalid_lead_id");
  requireText_(lead.cohortId, "invalid_cohort_id", 80);
  requireText_(lead.parentName, "invalid_parent_name", 120);
  requireText_(lead.studentName, "invalid_student_name", 120);
  requireText_(lead.parentEmail, "invalid_parent_email", 254);
  requireText_(lead.parentPhone, "invalid_parent_phone", 30);

  var existingRow = findRow_(sheet, "lead_id", lead.leadId);
  if (existingRow) {
    return "lead_already_exists";
  }

  var now = new Date().toISOString();
  var row = emptyRow_(LEAD_HEADERS.length);
  setRowValue_(row, LEAD_HEADERS, "created_at", safeCell_(lead.createdAt || now, 40));
  setRowValue_(row, LEAD_HEADERS, "lead_id", lead.leadId);
  setRowValue_(row, LEAD_HEADERS, "cohort_id", safeCell_(lead.cohortId, 80));
  setRowValue_(row, LEAD_HEADERS, "cohort_name", safeCell_(lead.cohortName, 160));
  setRowValue_(row, LEAD_HEADERS, "parent_name", safeCell_(lead.parentName, 120));
  setRowValue_(row, LEAD_HEADERS, "student_name", safeCell_(lead.studentName, 120));
  setRowValue_(row, LEAD_HEADERS, "parent_email", safeCell_(lead.parentEmail, 254));
  setRowValue_(row, LEAD_HEADERS, "parent_phone", safeCell_(lead.parentPhone, 30));
  var studentMathScore = optionalInteger_(lead.studentMathScore);
  if (studentMathScore !== "" && (studentMathScore < 160 || studentMathScore > 800)) {
    throw new Error("invalid_student_math_score");
  }
  setRowValue_(row, LEAD_HEADERS, "student_math_score", studentMathScore);
  setRowValue_(row, LEAD_HEADERS, "additional_notes", safeCell_(lead.additionalNotes, 1000));
  setRowValue_(row, LEAD_HEADERS, "expected_amount_cents", requiredNonnegativeInteger_(lead.expectedAmountCents, "invalid_expected_amount"));
  setRowValue_(row, LEAD_HEADERS, "expected_currency", safeCurrency_(lead.expectedCurrency));
  setRowValue_(row, LEAD_HEADERS, "lead_status", "Checkout opened");
  setRowValue_(row, LEAD_HEADERS, "payment_status", "Not paid");
  setRowValue_(row, LEAD_HEADERS, "utm_source", safeCell_(lead.utmSource, 200));
  setRowValue_(row, LEAD_HEADERS, "utm_medium", safeCell_(lead.utmMedium, 200));
  setRowValue_(row, LEAD_HEADERS, "utm_campaign", safeCell_(lead.utmCampaign, 200));
  setRowValue_(row, LEAD_HEADERS, "utm_content", safeCell_(lead.utmContent, 200));
  setRowValue_(row, LEAD_HEADERS, "utm_term", safeCell_(lead.utmTerm, 200));
  setRowValue_(row, LEAD_HEADERS, "gclid", safeCell_(lead.gclid, 300));
  setRowValue_(row, LEAD_HEADERS, "ga_client_id", safeCell_(lead.gaClientId, 120));
  setRowValue_(row, LEAD_HEADERS, "landing_page", safeCell_(lead.landingPage, 2048));
  setRowValue_(row, LEAD_HEADERS, "referrer", safeCell_(lead.referrer, 2048));
  setRowValue_(row, LEAD_HEADERS, "follow_up_status", "New");
  setRowValue_(row, LEAD_HEADERS, "updated_at", now);

  sheet.appendRow(row);
  return "lead_created";
}

function updatePayment_(leadsSheet, eventsSheet, payment) {
  requireObject_(payment, "invalid_payment_update");
  requireId_(payment.eventId, "invalid_event_id");

  if (findRow_(eventsSheet, "event_id", payment.eventId)) {
    return "event_already_processed";
  }

  requireId_(payment.leadId, "invalid_lead_id");
  var leadRow = findRow_(leadsSheet, "lead_id", payment.leadId);
  if (!leadRow) {
    throw new Error("lead_not_found");
  }

  var paymentStatus = String(payment.paymentStatus || "");
  var allowedStatuses = ["processing", "paid", "failed", "expired"];
  if (allowedStatuses.indexOf(paymentStatus) === -1) {
    throw new Error("invalid_payment_status");
  }

  if (paymentStatus === "paid") {
    var expectedAmount = Number(cellValue_(leadsSheet, leadRow, "expected_amount_cents"));
    var expectedCurrency = String(cellValue_(leadsSheet, leadRow, "expected_currency")).toLowerCase();
    var receivedAmount = requiredNonnegativeInteger_(payment.amountCents, "invalid_payment_amount");
    var receivedCurrency = safeCurrency_(payment.currency);

    if (receivedAmount !== expectedAmount || receivedCurrency !== expectedCurrency) {
      throw new Error("payment_amount_mismatch");
    }

    setCellValue_(leadsSheet, leadRow, "lead_status", "Enrolled");
    setCellValue_(leadsSheet, leadRow, "payment_status", "Paid");
    setCellValue_(leadsSheet, leadRow, "amount_paid_cents", receivedAmount);
    setCellValue_(leadsSheet, leadRow, "currency", receivedCurrency);
    setCellValue_(leadsSheet, leadRow, "paid_at", safeCell_(payment.paidAt || new Date().toISOString(), 40));
  } else if (paymentStatus === "processing") {
    setCellValue_(leadsSheet, leadRow, "lead_status", "Checkout submitted");
    setCellValue_(leadsSheet, leadRow, "payment_status", "Processing");
  } else if (paymentStatus === "failed") {
    setCellValue_(leadsSheet, leadRow, "lead_status", "Follow up");
    setCellValue_(leadsSheet, leadRow, "payment_status", "Failed");
  } else {
    setCellValue_(leadsSheet, leadRow, "lead_status", "Follow up");
    setCellValue_(leadsSheet, leadRow, "payment_status", "Expired");
  }

  setCellValue_(leadsSheet, leadRow, "stripe_checkout_session_id", safeCell_(payment.checkoutSessionId, 255));
  setCellValue_(leadsSheet, leadRow, "stripe_payment_intent_id", safeCell_(payment.paymentIntentId, 255));
  setCellValue_(leadsSheet, leadRow, "stripe_event_id", payment.eventId);
  setCellValue_(leadsSheet, leadRow, "updated_at", new Date().toISOString());

  appendEvent_(eventsSheet, payment, paymentStatus);
  return "payment_updated";
}

function updateRefund_(leadsSheet, eventsSheet, refund) {
  requireObject_(refund, "invalid_refund_update");
  requireId_(refund.eventId, "invalid_event_id");

  if (findRow_(eventsSheet, "event_id", refund.eventId)) {
    return "event_already_processed";
  }

  requireText_(refund.paymentIntentId, "invalid_payment_intent_id", 255);
  var leadRow = findRow_(leadsSheet, "stripe_payment_intent_id", refund.paymentIntentId);
  if (!leadRow) {
    appendEvent_(eventsSheet, {
      eventId: refund.eventId,
      eventType: refund.eventType,
      paymentIntentId: refund.paymentIntentId
    }, "refund_not_matched");
    return "refund_not_matched";
  }

  var status = String(refund.refundStatus || "");
  if (status !== "refunded" && status !== "partially_refunded") {
    throw new Error("invalid_refund_status");
  }

  setCellValue_(
    leadsSheet,
    leadRow,
    "payment_status",
    status === "refunded" ? "Refunded" : "Partially refunded"
  );
  if (status === "refunded") {
    setCellValue_(leadsSheet, leadRow, "lead_status", "Refunded");
  }
  setCellValue_(leadsSheet, leadRow, "refunded_amount_cents", requiredNonnegativeInteger_(refund.refundedAmountCents, "invalid_refund_amount"));
  setCellValue_(leadsSheet, leadRow, "stripe_event_id", refund.eventId);
  setCellValue_(leadsSheet, leadRow, "updated_at", new Date().toISOString());

  appendEvent_(eventsSheet, {
    eventId: refund.eventId,
    eventType: refund.eventType,
    leadId: cellValue_(leadsSheet, leadRow, "lead_id"),
    checkoutSessionId: cellValue_(leadsSheet, leadRow, "stripe_checkout_session_id"),
    paymentIntentId: refund.paymentIntentId
  }, status);
  return "refund_updated";
}

function appendEvent_(sheet, event, result) {
  sheet.appendRow([
    new Date().toISOString(),
    safeCell_(event.eventId, 255),
    safeCell_(event.eventType, 255),
    safeCell_(event.leadId, 255),
    safeCell_(event.checkoutSessionId, 255),
    safeCell_(event.paymentIntentId, 255),
    safeCell_(result, 80)
  ]);
}

function findRow_(sheet, header, value) {
  if (!value || sheet.getLastRow() < 2) {
    return null;
  }

  var column = headerIndex_(sheet, header) + 1;
  var match = sheet
    .getRange(2, column, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext();

  return match ? match.getRow() : null;
}

function headerIndex_(sheet, header) {
  var lastColumn = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var index = headers.indexOf(header);
  if (index === -1) {
    throw new Error("missing_column_" + header);
  }
  return index;
}

function cellValue_(sheet, row, header) {
  return sheet.getRange(row, headerIndex_(sheet, header) + 1).getValue();
}

function setCellValue_(sheet, row, header, value) {
  sheet.getRange(row, headerIndex_(sheet, header) + 1).setValue(
    value === null || typeof value === "undefined" ? "" : value
  );
}

function emptyRow_(length) {
  return Array.apply(null, Array(length)).map(function () { return ""; });
}

function setRowValue_(row, headers, header, value) {
  var index = headers.indexOf(header);
  if (index === -1) {
    throw new Error("missing_column_" + header);
  }
  row[index] = value === null || typeof value === "undefined" ? "" : value;
}

function requireObject_(value, code) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(code);
  }
}

function requireId_(value, code) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{8,255}$/.test(value)) {
    throw new Error(code);
  }
}

function requireText_(value, code, maximumLength) {
  if (typeof value !== "string" || !value.trim() || value.length > maximumLength) {
    throw new Error(code);
  }
}

function safeCell_(value, maximumLength) {
  if (value === null || typeof value === "undefined") {
    return "";
  }

  var cleaned = String(value)
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .trim()
    .slice(0, maximumLength);

  if (/^[=+\-@]/.test(cleaned)) {
    return "'" + cleaned;
  }

  return cleaned;
}

function optionalInteger_(value) {
  if (value === null || value === "" || typeof value === "undefined") {
    return "";
  }

  var number = Number(value);
  if (!Number.isInteger(number)) {
    throw new Error("invalid_integer");
  }
  return number;
}

function requiredNonnegativeInteger_(value, code) {
  var number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new Error(code);
  }
  return number;
}

function safeCurrency_(value) {
  var currency = String(value || "").trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new Error("invalid_currency");
  }
  return currency;
}

function safeErrorCode_(error) {
  var message = error && error.message ? String(error.message) : "unknown_error";
  return message.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
}

function jsonOutput_(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
