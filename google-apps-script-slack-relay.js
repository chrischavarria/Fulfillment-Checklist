const SLACK_WEBHOOK_URL = "PASTE_YOUR_SLACK_INCOMING_WEBHOOK_URL_HERE";
const GOOGLE_SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const MORNING_SHEET_TAB_NAME = "Morning Product Checklist";
const CLEANING_SHEET_TAB_NAME = "End-of-Day Cleaning";
const ARCHIVE_FOLDER_ID = "";
const ARCHIVE_FOLDER_NAME = "Fulfillment Checklist Archives";
const SHEET_HEADERS = [
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
];

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
    appendWeekendClosureRowsIfNeeded(sheet, payload);
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

function archivePriorMonthLogs() {
  if (!GOOGLE_SHEET_ID || GOOGLE_SHEET_ID === "PASTE_YOUR_GOOGLE_SHEET_ID_HERE") {
    console.log("Google Sheet logging is not configured.");
    return;
  }

  const liveSpreadsheet = SpreadsheetApp.openById(GOOGLE_SHEET_ID);
  const archiveFolder = getArchiveFolder();
  const currentMonthStart = getMonthStart(new Date());
  const archiveGroups = {};
  const deletePlans = [];

  [MORNING_SHEET_TAB_NAME, CLEANING_SHEET_TAB_NAME].forEach((sheetName) => {
    const sheet = liveSpreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() < 2) return;

    ensureHeaderRow(sheet);
    const values = sheet.getDataRange().getValues();
    const rowsToDelete = [];

    for (let index = 1; index < values.length; index += 1) {
      const row = values[index];
      const loggedAt = coerceDate(row[0]) || coerceDate(row[1]);
      if (!loggedAt || loggedAt >= currentMonthStart) continue;

      const monthKey = Utilities.formatDate(loggedAt, Session.getScriptTimeZone(), "yyyy-MM");
      if (!archiveGroups[monthKey]) archiveGroups[monthKey] = {};
      if (!archiveGroups[monthKey][sheetName]) archiveGroups[monthKey][sheetName] = [];
      archiveGroups[monthKey][sheetName].push(row);
      rowsToDelete.push(index + 1);
    }

    if (rowsToDelete.length) {
      deletePlans.push({ sheet, rowsToDelete });
    }
  });

  Object.keys(archiveGroups).forEach((monthKey) => {
    const archiveSpreadsheet = getOrCreateArchiveSpreadsheet(archiveFolder, monthKey);
    Object.keys(archiveGroups[monthKey]).forEach((sheetName) => {
      const archiveSheet = getOrCreateSheet(archiveSpreadsheet, sheetName);
      ensureHeaderRow(archiveSheet);
      appendRows(archiveSheet, archiveGroups[monthKey][sheetName]);
    });
  });

  deletePlans.forEach(({ sheet, rowsToDelete }) => {
    rowsToDelete.reverse().forEach((rowNumber) => sheet.deleteRow(rowNumber));
  });
}

function createMonthlyArchiveTrigger() {
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (trigger.getHandlerFunction() === "archivePriorMonthLogs") {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  ScriptApp.newTrigger("archivePriorMonthLogs")
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();
}

function appendWeekendClosureRowsIfNeeded(sheet, payload) {
  if (payload.checklistType !== "cleaning") return;

  const submittedDate = coerceDate(payload.submittedAt) || new Date();
  if (submittedDate.getDay() !== 5) return;

  const saturday = addDays(getDayStart(submittedDate), 1);
  const sunday = addDays(getDayStart(submittedDate), 2);
  appendClosureRowIfMissing(sheet, saturday, "Closed Saturday");
  appendClosureRowIfMissing(sheet, sunday, "Closed Sunday");
}

function appendClosureRowIfMissing(sheet, date, checklistTitle) {
  const submittedAt = Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd");
  const existingRows = sheet.getDataRange().getValues();
  const exists = existingRows.some((row) => (
    String(row[1]) === submittedAt &&
    String(row[2]) === checklistTitle &&
    String(row[3]) === "System"
  ));

  if (exists) return;

  sheet.appendRow([
    new Date(),
    submittedAt,
    checklistTitle,
    "System",
    "Fulfillment",
    "Closed",
    "Fulfillment",
    "Closed",
    `${checklistTitle} automatically added after Friday end-of-day cleaning submission.`,
    "Automatically added after Friday end-of-day cleaning submission."
  ]);
}

function getArchiveFolder() {
  if (ARCHIVE_FOLDER_ID) return DriveApp.getFolderById(ARCHIVE_FOLDER_ID);

  const folders = DriveApp.getFoldersByName(ARCHIVE_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(ARCHIVE_FOLDER_NAME);
}

function getOrCreateArchiveSpreadsheet(folder, monthKey) {
  const archiveName = `Fulfillment Checklist Archive ${monthKey}`;
  const files = folder.getFilesByName(archiveName);
  if (files.hasNext()) return SpreadsheetApp.openById(files.next().getId());

  const spreadsheet = SpreadsheetApp.create(archiveName);
  DriveApp.getFileById(spreadsheet.getId()).moveTo(folder);
  const defaultSheet = spreadsheet.getSheets()[0];
  defaultSheet.setName(MORNING_SHEET_TAB_NAME);
  ensureHeaderRow(defaultSheet);
  return spreadsheet;
}

function appendRows(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function getMonthStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function getDayStart(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function coerceDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  sheet.appendRow(SHEET_HEADERS);
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
