# Fulfillment Daily Checklist

This folder contains a single-page HTML checklist for fulfillment morning checks and end-of-day cleaning.

## Use It On Department Computers

Open `index.html` in Chrome, Edge, or Safari on each computer. You can put the file on a shared drive, copy it locally, or host it on a simple internal web page.

Each computer stores its own:

- Draft checklist
- Slack relay URL
- Location label
- Local submission history

The page has two tabs:

- Morning Checklist: submitted in the morning.
- Daily Cleaning: submitted at the end of the day.

## GitHub Pages Hosting

GitHub Pages is optional, but it is a good way to give every fulfillment computer one shared URL.

1. Create a new GitHub repository.
2. Upload these files and folders to the repository root:
   - `index.html`
   - `README.md`
   - `.nojekyll`
   - `assets/`
3. Go to the repository's Settings tab.
4. Open Pages.
5. Under Build and deployment, choose Deploy from a branch.
6. Select the `main` branch and `/root`.
7. Save.
8. GitHub will give you a Pages URL after it deploys.

The Slack webhook still belongs in Google Apps Script, not in GitHub. In the checklist page, paste the Google Apps Script Web App URL into `Slack relay URL`.

## Slack Setup

The person submitting the checklist must enter their name before it can be submitted. Slack receives a compact sheet-style message with the submitter, timestamp, station, shift, location, completion count, notes, and checked tasks.

Direct Slack webhooks are not ideal inside plain HTML because the webhook URL would be exposed on every computer and browser security often blocks the request. The recommended setup is a small Google Apps Script relay.

1. Create a Slack incoming webhook for the channel where you want alerts.
2. Go to [script.google.com](https://script.google.com) and create a new project.
3. Paste the contents of `google-apps-script-slack-relay.js`.
4. Replace `PASTE_YOUR_SLACK_INCOMING_WEBHOOK_URL_HERE` with your Slack webhook URL.
5. Deploy as a web app.
6. Set access to anyone with the link, or your company workspace if your Google account supports it.
7. Copy the web app URL.
8. Open `index.html`, paste that URL into Slack relay URL, add a location label, and click Save Settings.

When the active tab is fully complete and submitted, the page sends a timestamped message to Slack and also saves a local history entry.

## Customizing Tasks

Open `index.html` and edit the `morningTasks` and `cleaningTasks` arrays near the bottom of the file. Each item has this shape:

```js
["Task title", "Short detail shown under the task", "Optional category"]
```

The cleaning section currently includes Cleaning and Restocking categories. On Fridays, the page automatically adds an expired-compounds verification item.

## Notes

The app prevents submission until every task is checked. If Slack is unavailable, it still saves the submission locally with a delivery failure note.
