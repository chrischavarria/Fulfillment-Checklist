const SLACK_WEBHOOK_URL = "PASTE_YOUR_SLACK_INCOMING_WEBHOOK_URL_HERE";
const GOOGLE_SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const MORNING_SHEET_TAB_NAME = "Morning Product Checklist";
const CLEANING_SHEET_TAB_NAME = "End-of-Day Cleaning";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  const submittedTasks = formatTaskGroup(payload.tasks, payload.checklistType);
  const checklistTitle = payload.checklistTitle || "Fulfillment Checklist";
  const location = payload.location || "Not specified";
  const notes = payload.notes || "None";
  const sheetStatus = appendSubmissionToSheet(payload, submittedTasks);

  const message = {
    text: `${checklistTitle} completed by ${payload.teamMember}`,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${checklistTitle} Complete`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Submitted by:*\n${payload.teamMember || "Unknown"}` },
          { type: "mrkdwn", text: `*Submitted at:*\n${payload.submittedAtLocal || "Unknown"}` },
          { type: "mrkdwn", text: `*Station:*\n${payload.station || "Unknown"}` },
          { type: "mrkdwn", text: `*Shift:*\n${payload.shift || "Unknown"}` },
          { type: "mrkdwn", text: `*Location:*\n${location}` },
          { type: "mrkdwn", text: `*Completion:*\n${payload.completeCount || 0}/${payload.totalCount || 0} tasks` }
        ]
      },
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Submitted Items*\n${submittedTasks}`
        }
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Notes*\n${notes}`
        }
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Google Sheet log: ${sheetStatus.message}`
          }
        ]
      }
    ]
  };

  UrlFetchApp.fetch(SLACK_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(message),
    muteHttpExceptions: true
  });

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function appendSubmissionToSheet(payload, submittedTasks) {
  if (!GOOGLE_SHEET_ID || GOOGLE_SHEET_ID === "PASTE_YOUR_GOOGLE_SHEET_ID_HERE") {
    return { ok: false, message: "not configured" };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
    const sheetName = getSheetNameForChecklist(payload.checklistType);
    const sheet = getOrCreateSheet(spreadsheet, sheetName);
    ensureHeaderRow(sheet);
    sheet.appendRow([
      new Date(),
      payload.submittedAtLocal || "",
      payload.checklistTitle || "",
      payload.teamMember || "",
      payload.station || "",
      payload.shift || "",
      payload.location || "",
      `${payload.completeCount || 0}/${payload.totalCount || 0}`,
      submittedTasks.replace(/\*/g, ""),
      payload.notes || ""
    ]);
    return { ok: true, message: `saved to ${sheetName}` };
  } catch (error) {
    console.error(`Google Sheet logging failed: ${error.message}`);
    return { ok: false, message: `failed - ${error.message}` };
  }
}

function testSheetLogging() {
  const testPayload = {
    submittedAtLocal: new Date().toLocaleString(),
    checklistType: "morning",
    checklistTitle: "Morning Product Checklist",
    teamMember: "Apps Script Test",
    station: "Fulfillment",
    shift: "Morning",
    location: "Fulfillment",
    completeCount: 1,
    totalCount: 1,
    notes: "Manual sheet logging test from Apps Script."
  };
  const result = appendSubmissionToSheet(testPayload, "✓ Test item");
  console.log(result.message);
}

function testCleaningSheetLogging() {
  const testPayload = {
    submittedAtLocal: new Date().toLocaleString(),
    checklistType: "cleaning",
    checklistTitle: "End-of-Day Cleaning",
    teamMember: "Apps Script Test",
    station: "Fulfillment",
    shift: "Closing",
    location: "Fulfillment",
    completeCount: 1,
    totalCount: 1,
    notes: "Manual cleaning sheet logging test from Apps Script."
  };
  const result = appendSubmissionToSheet(testPayload, "✓ Test cleaning item");
  console.log(result.message);
}

function getSheetNameForChecklist(checklistType) {
  if (checklistType === "cleaning") return CLEANING_SHEET_TAB_NAME;
  return MORNING_SHEET_TAB_NAME;
}

function getOrCreateSheet(spreadsheet, sheetName) {
  return spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
}

function ensureHeaderRow(sheet) {
  if (sheet.getLastRow() > 0) return;
  sheet.appendRow([
    "Logged At",
    "Submitted At",
    "Checklist",
    "Submitted By",
    "Station",
    "Shift",
    "Location",
    "Completion",
    "Items",
    "Notes"
  ]);
}

function formatTaskGroup(tasks, group) {
  const filtered = (tasks || []).filter((task) => task.group === group);
  if (!filtered.length) return "_No items submitted._";
  const grouped = {};
  filtered.forEach((task) => {
    const category = task.category || "Checklist";
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(`${task.complete ? "✓" : "!"} ${task.title}`);
  });
  return Object.keys(grouped)
    .map((category) => `*${category}*\n${grouped[category].join("\n")}`)
    .join("\n\n");
}
