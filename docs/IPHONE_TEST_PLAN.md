# iPhone test plan

A hands-on check of Climb Pass Tracker on a real iPhone, written for the owner to run alone. The app has so far been tested only in a desktop browser (automated) and on one Android phone (Samsung), so everything on an iPhone is **expected, not yet verified**. The riskiest part is marked **(risky)**: the Dropbox sign-in inside the installed app.

Allow about 45 minutes. Use a real Dropbox account you do not mind testing with (the app only writes one file, `climb-pass-tracker-backup.json`, in its own app folder).

## Before you start

You need:

- an iPhone with Safari (note the iOS version: Settings, General, About)
- the live site, https://climbpasstracker.netlify.app (note the app version at the bottom of Settings)
- the Dropbox app key already set in Netlify, so the Dropbox section shows in Settings
- a second way to move files off the phone (AirDrop, Files, or email to yourself)

Write down: **iOS version, app version, date.** Put them at the top of your results.

Keep a scratch pad. For every step below, mark **Pass**, **Fail** or **Odd** and note anything that looked wrong, even small. A screenshot of each failure is the most useful thing you can send back.

## A. First visit in Safari (not installed)

| # | Do | Expected |
|---|----|----------|
| A1 | Open the site in Safari. | The main screen loads in a few seconds, with an "add to home screen" card showing the iPhone steps. |
| A2 | Add a pass: gym `Test Wall`, type Multipass, entries 5, +6 months, then **Add pass**. | The pass appears and "Test Wall, Multipass added" shows at the bottom. |
| A3 | Tap `−` twice, then `+` once. | Left shows 4 / 5. |
| A4 | Open Settings (gear). | Backup is first, then Reminders, then "Add to your home screen" (closed), then Delete everything. |

## B. Install, and the separate-storage check

On an iPhone, the home-screen app and Safari keep **separate** saved data. We expect the installed app to start **empty**.

| # | Do | Expected |
|---|----|----------|
| B1 | In Safari: Share, **Add to Home Screen**, **Add**. | An icon with the monkey/app artwork appears. |
| B2 | Open the app from the home screen. | A launch screen shows, then the app opens with no browser bars. |
| B3 | Look at the list. | **Expected: empty** (the pass from A2 is not there). Mark Pass if empty; if the pass is there, mark Odd and tell Claude. |
| B4 | In the installed app, Settings: the data-safety card and the "Add to your home screen" section. | A green "✓ Installed as an app…" line instead of the amber warning, and no "Add to your home screen" section (the app knows it is installed). |

## C. Moving data between Safari and the installed app

| # | Do | Expected |
|---|----|----------|
| C1 | In **Safari**, Settings, **Download backup file**. | A file such as `climb-pass-tracker-backup-2026-…json` is offered to save (Files or the share sheet). |
| C2 | Get the file where the installed app can pick it (save to Files). | You can find it in Files. |
| C3 | In the **installed app**, Settings, **Open a backup file**, choose it. | A preview shows what would be added (1 pass). |
| C4 | Press **Add to this device**. | "Done. This device now has:" and the pass appears in the list with 4 / 5. |
| C5 | Open the same file again. | "Everything in this backup is already on this device." |

## D. Everyday use in the installed app

| # | Do | Expected |
|---|----|----------|
| D1 | Add three more passes: a Single entry, a Membership with entries per month 8, and a Multipass expiring in 10 days. | Each saves; the 10-day one shows an orange banner at the top and an orange ring. |
| D2 | Tap `−` on the single entry. | It moves to **Finished** with "moved to Finished · Undo". Tap **Undo**: it returns. |
| D3 | Open **History**, tap a line, change its date to yesterday, **Save**. | "Changes saved" and the line slides to its place. |
| D4 | In History, open a line and choose **Delete this entry**, then confirm. | "Entry deleted" and the pass gets the entry back. |
| D5 | Tap a pass row to open its details; edit the price; **Save**. | "Changes saved". |
| D6 | Dismiss a banner. | It disappears and stays gone after a reload. |
| D7 | Rotate the phone sideways, then back. | The list reflows; nothing is cut off. |
| D8 | Settings, Display & Brightness: switch to Dark (or Light). | The app follows; text stays readable. |
| D9 | Settings, Accessibility, Display & Text Size, Larger Text, drag to a big size. | Rows stack, nothing runs off the edge, buttons stay tappable. |

## E. Offline and persistence

| # | Do | Expected |
|---|----|----------|
| E1 | Turn on **Airplane Mode**, close the app fully (swipe up), open it again. | It opens and shows your passes. |
| E2 | Offline, add a pass and tap `−`. | Both work. |
| E3 | Turn Airplane Mode off. | Nothing breaks; the data is still there. |
| E4 | Leave the installed app **unopened for 7 days**, then open it. (Do this one in the background of your week.) | Passes are still there. Installed apps are not meant to be cleared the way Safari tabs can be. |

## F. Dropbox (risky)

Do these in the **installed app**. Write down exactly what you see after each step, including any page that opens outside the app.

| # | Do | Expected (not verified) |
|---|----|-------------------------|
| F1 | Settings, **Connect Dropbox**. | Dropbox's page opens (inside or outside the app). Sign in, **Allow**. |
| F2 | **Where do you land after Allow?** Note: back in the installed app, or in Safari? | **Risky.** Pass: back in the installed app on Settings, with "✓ Dropbox is connected." Fail: Safari opens, or an error shows. |
| F3 | If F2 failed, go back to the installed app and look at Settings. | Note whether it shows Connect Dropbox again, an error, or a message. Screenshot it. |
| F4 | If connected: press **Back up now**. | "Backed up to Dropbox." and "Last Dropbox backup: <today>". |
| F5 | In Dropbox (app or website): Apps, Climb Pass Tracker. | One file `climb-pass-tracker-backup.json`. |
| F6 | Close the app fully, open it again. | Still connected. |
| F7 | **Guards:** Settings, Delete everything, confirm. Then Connect Dropbox again and press **Back up now**. | Refused: "There is nothing on this phone to back up yet. To get your passes back, choose Restore from Dropbox." The file in Dropbox is unchanged. |
| F8 | Press **Restore from Dropbox**, then **Add to this device**. | Your passes come back. |
| F9 | Add one pass, then press **Back up now**. | Normal backup, no question (this phone has now backed up). |
| F10 | **Disconnect Dropbox**. | "Disconnected. Your backup stays in your Dropbox." and the Connect button returns. |
| F11 | Repeat F1 to F4 in a plain **Safari tab** (not the installed app). | Note whether it works there. If F2 failed but this works, the problem is specific to the installed app. |

If you can, also try the Dropbox sign-in while a different Dropbox account is signed in on the phone, and Deny at the Dropbox page (expected: "Dropbox was not connected.").

## G. Smaller checks

| # | Do | Expected |
|---|----|----------|
| G1 | Icon badge: with a banner showing, look at the app icon. | Likely **no badge** on iPhone (it needs notification permission, which the app never asks for). Note what you see. Not a failure. |
| G2 | About (monkey icon): tap the Instagram, quiz and coffee cards. | Each opens in Safari in a new view. |
| G3 | Privacy policy and Terms from Settings. | Open and read normally; the Privacy page has a Dropbox section. |
| G4 | Pull to refresh or reopen after a new version is deployed. | The new version appears within one or two opens (check the version at the bottom of Settings). |

## What to send back

Send Claude this, filled in:

```
iOS version:
App version:
Installed or Safari tab:

A: pass/fail + notes
B: ...
C: ...
D: ...
E: ...
F: F2 (where did you land after Allow?) = ...
   F1–F11 results
G: ...
Screenshots of every Fail/Odd.
```

## What each result means

- **F2 passes, F7 passes:** nothing to do for iPhone.
- **F2 fails in the installed app:** tell Claude. The plan is to hide **Connect Dropbox** in the installed iPhone app and show a short note pointing to the backup file instead (connecting in Safari would not help, because Safari and the installed app keep separate saved data).
- **B3 shows the Safari pass in the installed app:** tell Claude; the storage assumption is wrong and the install steps need no warning.
- **B3 is empty, as expected:** consider adding a line to the install steps saying that passes added in Safari first need a backup file to move over.
- **Anything in D, E or C fails:** that is a real bug; send the screenshot.
