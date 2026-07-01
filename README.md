# Fulfillment Daily Checklist

This folder contains a single-page HTML checklist for fulfillment morning checks and end-of-day cleaning.

## Use It On Department Computers

Open `index.html` in Chrome, Edge, or Safari on each computer. You can put the file on a shared drive, copy it locally, or host it on a simple internal web page.

Each computer stores its own:

- Draft checklist
- Local submission history

The page has two tabs:

- Morning Checklist: submitted in the morning.
- Daily Cleaning: submitted at the end of the day.

## GitHub Pages Hosting

GitHub Pages is optional, but it is a good way to give every fulfillment computer one shared URL.

1. Create a new GitHub repository.
2. Upload these files to the repository root:
   - `index.html`
   - `README.md`
   - `.nojekyll`
3. Go to the repository's Settings tab.
4. Open Pages.
5. Under Build and deployment, choose Deploy from a branch.
6. Select the `main` branch and `/root`.
7. Save.
8. GitHub will give you a Pages URL after it deploys.

The Slack webhook still belongs in Google Apps Script, not in GitHub. To avoid entering the relay URL on every computer, paste the Google Apps Script Web App URL into `defaultSlackRelayUrl` inside `index.html`.

## Slack And Google Sheet Setup

The person submitting the checklist must enter their name before it can be submitted. Slack receives a compact sheet-style message with the submitter, timestamp, station, shift, location, completion count, notes, and checked tasks.

The same relay can also log every submission to a Google Sheet for permanent records.

Direct Slack webhooks are not ideal inside plain HTML because the webhook URL would be exposed on every computer and browser security often blocks the request. The recommended setup is a small Google Apps Script relay.

1. Create a Slack incoming webhook for the channel where you want alerts.
2. Create a Google Sheet for the log.
3. Copy the Google Sheet ID from the sheet URL. It is the long value between `/d/` and `/edit`.
4. Go to [script.google.com](https://script.google.com) and create a new project.
5. Paste the contents of `google-apps-script-slack-relay.js`.
6. Replace `PASTE_YOUR_SLACK_INCOMING_WEBHOOK_URL_HERE` with your Slack webhook URL.
7. Replace `PASTE_YOUR_GOOGLE_SHEET_ID_HERE` with your Google Sheet ID.
8. Deploy as a web app.
9. Set access to anyone with the link, or your company workspace if your Google account supports it.
10. Copy the web app URL.
11. Open `index.html` and paste that URL into this line:

```js
const defaultSlackRelayUrl = "";
```

For example:

```js
const defaultSlackRelayUrl = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec";
```

When the active tab is fully complete and submitted, the page sends a timestamped message to Slack, appends a row to the Google Sheet, and also saves a local history entry. The local history is only for quick confirmation on that computer; Slack and the Google Sheet are the primary records.

If you update the Apps Script after deploying, use **Deploy > Manage deployments > Edit** and create a new version. Reuse the same web app URL if Google allows it.

The relay can also archive old logs automatically. It creates archive spreadsheets in a Google Drive folder named `Fulfillment Checklist Archives`, unless you set `ARCHIVE_FOLDER_ID` to an existing Drive folder ID. On the first day of a new month, prior-month rows are moved out of the live Sheet and into monthly archive files such as `Fulfillment Checklist Archive 2026-07`.

To enable automatic monthly archiving:

1. Paste the updated `google-apps-script-slack-relay.js` into Apps Script.
2. Save.
3. Run `createMonthlyArchiveTrigger` once from the Apps Script editor.
4. Approve the requested permissions.
5. Redeploy the Web App as a new version.

To archive existing older rows immediately, run `archivePriorMonthLogs` once. For example, on July 1, 2026, this archives April, May, and June rows and removes them from the live Sheet.

Friday end-of-day cleaning submissions automatically add two system rows to the `End-of-Day Cleaning` tab:

- Closed Saturday
- Closed Sunday

The script writes to separate Google Sheet tabs:

- `Morning Product Checklist`
- `End-of-Day Cleaning`

If either tab does not exist, it creates it and adds these columns:

- Logged At
- Submitted At
- Checklist
- Submitted By
- Station
- Shift
- Location
- Completion
- Items
- Notes

If Apps Script asks for explicit OAuth scopes, use:

```json
{
  "timeZone": "America/Phoenix",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/script.scriptapp"
  ]
}
```

## Customizing Tasks

Open `index.html` and edit the `morningTasks` and `cleaningTasks` arrays near the bottom of the file. Each item has this shape:

```js
["Task title", "Short detail shown under the task", "Optional category"]
```

The cleaning section currently includes Cleaning and Restocking categories. On Fridays, the page automatically adds an expired-compounds verification item.

## Notes

The app prevents submission until every task is checked. If Slack is unavailable, it still saves the submission locally with a delivery failure note.
