# VERTFORM 2.0 — "Courtside Notebook"

Redesigned and extended from v1.6. Plain HTML/CSS/JS, no build step, no new dependencies (fonts are self-hosted). See PHONE_SETUP.md to install or update.

## What changed
- **Design:** dark charcoal training-notebook look, Big Shoulders Display + IBM Plex, five-tab bottom nav (Today · Train · Fuel · Plan · Progress; Settings from the cog), desktop side rail, safe-area and keyboard handling, reduced-motion support.
- **Saved meals & recipes:** ingredient quantities (g, tbsp, tsp, whole items), yield, per-serving macros, log N servings to any date/meal, edit/duplicate/delete. Diary entries store a snapshot, so editing or deleting a recipe never changes history.
- **Rest timer:** per-exercise defaults, auto-start option, pause/resume/skip/±15 s, docked in the workout and as a pill elsewhere, timestamp-based, optional sound/vibration/screen-awake.
- **Last-time comparison:** per exercise, from completed sets only, with date, "use these", history, and PB markers only for like-for-like comparisons.
- **Flexible calendar:** choose any recurring volleyball days (history-aware, past weeks are not rewritten), add/edit matches and extra sessions, move gym sessions, planned/done/missed/rest states, clashes flagged not overwritten.
- **Volleyball logs:** training or match, duration, RPE, notes, optional jump count (labelled estimate or counted). Session load = duration × session RPE (arbitrary units; not an injury or medical score). Gym and volleyball counts are kept separate.
- **Backups:** last-export date, configurable reminder, versioned file with record counts, preview + confirmation before import, undo last import, safe handling of malformed/newer files, pre-upgrade copy.
- **Jump height:** standing reach added; approach jump = approach touch − standing reach; the reach used is stored per result; old approach readings stay as touch height; standing CMJ stays separate.
- **Fixes:** workouts start on the selected plan date; one version number everywhere (2.0.0); drafts persist; service-worker cache is versioned and never touches records; a tap lost to a re-render when a search box lost focus.

## Files
index.html · css/styles.css · js/*.js (util, foods-data, programme, store, ui, nutrition, recipes, workout, calendar, metrics, views, main) · sw.js · manifest.webmanifest · icons · fonts/ (SIL OFL licences included).
Data model notes: `vertform.v1` key, `version: 1` kept for rollback, `schemaVersion: 2`, backup header `backup.format: 2`.

## Tested vs not tested
See the delivery message for the exact list. In short: logic and layout were exercised in desktop Chromium via Playwright at 320–430 px and 1280 px; real iOS/Android devices, Safari, real camera scanning, real software-keyboard behaviour, haptics/sound and OS-level text-size settings were not tested.

## 2.1 — Career skin
Restyled to match the Road to Ace career UI: deep-navy background, frosted-glass cards, blue / gold / mint accents, spaced small-caps labels, floating glass tab dock, crest logo. All of it lives in `css/career.css` (plus new tokens at the top of `css/styles.css`); no logic or data-model changes, so existing records and backups carry over. Fonts are now system fonts (the self-hosted font files were removed). There is no login page.

## 2.2 — Career-style home hub
The app now opens on a hub like the career home: a VERT/FORM crest in the middle. Tap it and three orbs open around it — **Gym today**, **Diet** and **Volleyball** — each opening a panel over the blurred home (gym: today's session, recovery check-in, all sessions; diet: the food diary; volleyball: schedule, next two weeks, training days, logbook). The big button at the bottom starts today's session (or adds food on rest days). Progress, Logbook and Settings are one tap from the home screen; the other pages are unchanged. New file: `js/home.js`.


## 2.3 - your numbers, your blocks, your vertical
- **Profile & calories:** targets now come from your age, sex, height, bodyweight (latest logged weight wins), optional body fat, daily-life activity, and the gym and volleyball sessions you actually have planned. Protein can be set per kg. A prompt appears in the Diet panel until you set your profile.
- **Volleyball training blocks:** edit the blocks of a club night (name, minutes, effort 1-10, jumps), per weekday if you like. Logging a session starts from them and each log can still be adjusted; totals fill duration, RPE and jumps.
- **Vertical plan:** reads your CMJ, approach jump, trap-bar 1RM, bodyweight and optional drop-jump RSI, picks an emphasis and gives a weekly plan by phase. See `RESEARCH_VERTICAL.md` for the evidence and its limits.
- Also: selected RPE button is visible again; new optional measurement 'Drop-jump RSI'. Old backups still import; new fields are added automatically.

## 2.4 - scanner, fuel warnings, load and polish
- **Scanner rebuilt for UK supermarket packs:** reads EAN-13 / EAN-8 / UPC-A with the phone's own detector plus a bundled ZXing engine (`lib/`, works offline and on iPhone). High-resolution continuously focusing camera, torch, zoom, tap to refocus, centre-strip / full-frame / contrast-boosted passes, check-digit validation so QR codes and misreads are ignored, and a typed-barcode box that tells you if a digit is wrong. EAN-13 / UPC-A forms of the same code are both tried.
- **Not in Open Food Facts?** "Add from the label" saves per-100 g values against the barcode. It is remembered, works offline and is included in backups.
- **Fuel vs training flags:** light on fuel for a heavy day, carbs behind before a match, a week of under-eating, low protein, and a weigh-in reminder. A one-line nudge shows on the hub.
- **Jumps per week:** 8-week chart in the Volleyball panel from logged jumps plus planned sessions, with a spike warning.
- **Appearance:** Dark / Light / Match phone, your own logo (hub and top bar), and a gently animated hub background (respects reduced-motion).

## 2.12.1 - Agility + landing session
- New session editor has a ready-made "Agility + landing" template (warm-up, landing prep, plyo block, agility block, prehab, cool-down; 15 exercises, about 65 min). It starts as log-only so it does not add a fifth gym session to your week; switch on "Include in my weekly plan" if you want it scheduled.

## 2.12.0 - Videos in Post, and a focus cue after training
- Add a video to a post (up to 30 seconds). It is shrunk on your phone to a small clip with sound (about 1 MB per 10 s), uploaded with a one-time ticket, and shown in the feed. Deleting the post deletes the file.
- Re-run `vertform-posts.sql` once (safe to re-run): it adds the video bucket, tickets and rules.
- After a session, the Finish sheet has "Focus for next time", one line under your notes. It appears at the start of your next session of the same kind and in the Gym Today panel.

## 2.11.0 - Comments
- Comment on any post (yours or a friend's): tap the speech bubble under a post, up to 200 characters. Delete your own comments, or any comment on your own post.
- Re-run `vertform-posts.sql` once (safe to re-run) to add comments.

## 2.10.0 - Full-page navigation and friend lifts
- No bottom tab bar. Every page opens full screen with a Back button at the top left (and the phone's back gesture works). Back returns to where you came from, or the home orbs.
- Friend profile: tap a friend on the leaderboard (or their name/avatar in the feed) to see their week and compare lifts. Each shared lift shows your estimated one-rep max against theirs, plus the best set behind it.
- Lifts are the best estimated 1RM (Epley) per loaded exercise from your completed sessions, up to 12. Sharing is on by default and can be switched off in Leaderboard > Settings, which also clears them from the server.
- Needs `vertform-lifts.sql` run once, and the updated `vertform-posts.sql` re-run (safe to re-run). Until then everything else keeps working; the comparison just stays empty.

## 2.9.3 - Photos in Post
- Add a photo to a post (shrunk on your phone to a small JPEG first). Photos are stored privately in Supabase and only loaded for you and your friends, one at a time as you scroll.
- The Text / Gym / Volleyball choice is now three colour-coded tiles showing what would be attached.
- Re-run the updated `vertform-posts.sql` once (safe to run again) before posting.

## 2.9.2 - Setup redesign
- First-run setup is now one question per screen with a progress bar: welcome, team days (glowing day circles), one screen per team training (name, intensity with level bars, length), gym sessions a week (big stepper), name your sessions (compact rows), and a week summary.

## 2.9.1 - Home: five orbs, no bottom bar
- Logbook and Friends are now small orbs on the home ring (Friends opens the Post feed; the Leaderboard button is on that page). Settings stays on the gear. The bottom link bar is gone and the home page no longer scrolls.

## 2.9.0 - Post (friends feed) replaces Progress
- The Progress tab is gone. The bottom tab is now Post: write a short note (280 characters) and optionally attach your latest gym or volleyball session (title, sets, time, effort only). You and the friends you added by code see each other's posts. Like and delete your own posts.
- Needs `vertform-posts.sql` run once in Supabase (after vertform-friends.sql). Same locked-table model: no direct table access, every call checks your device secret.
- Jump readouts, charts and the weekly summary are no longer shown. Existing measurements stay stored in your backup. The leaderboard's Jump tab and "share my best jump" switch are removed.
- Home link PROGRESS became POST; the leaderboard link is now BOARD.

## 2.8.0 - Calendar home, fresh-start setup, intensity not blocks
- Home: CALENDAR replaces Volleyball. Drag gym sessions between days, with a plain verdict on each lane.
- New accounts start empty. A short setup asks which days you train as a team, names them, sets intensity (light / moderate / hard / max) and how many gym sessions a week you want. Existing accounts are not re-onboarded.
- Team training blocks are gone: intensity alone drives load, recovery and gym spacing.
- Declutter: Settings grouped, Fuel/Progress details tucked into expandable sections, home fits one screen, backup reminder moved to the dock, compact session rows on phones.

## 2.7.0 - Create your own gym sessions
- Train → **Create your own session**: name it, add exercises (sets, reps or time, reps/seconds/metres, weight or not, rest time, note), reorder, edit, delete. Start blank or from a copy of A–D (a copy keeps exercise history so "last time" still works; the originals are never changed).
- Your sessions get their own letter (E and up), can be switched into your weekly plan, placed automatically, dragged on the Plan board and logged like the built-in ones. Mark one "heavy leg day" and it is kept 3+ days from a match.
- Built-in week-1 and deload set reductions apply only to A–D; your sessions use the sets you wrote. Deleting a session keeps already-logged workouts in history.

## 2.6.2 - Drag the whole session box
- You can now drag the session box itself, not just the dots. Mouse: drag straight away. Phone: press and hold for a moment (you feel a small buzz), then drag; a quick swipe still scrolls the page. The dots still work instantly, and tapping them opens the date picker.

## 2.6.1 - Comfort pass
- Removed text glow, halos, blur layers and the rotating ray pattern behind text (it shimmered); background glow is now nearly still. Small caps text is larger, less spaced and higher contrast. Fixed cramped spacing in Friends settings and hub links wrap instead of clipping.

## 2.6.0 - Friends & weekly leaderboard
- **Online, no login:** run `vertform-friends.sql` once in Supabase. Each device makes a random secret (server stores only its hash) and a 6-character friend code; swap codes to add each other (mutual).
- **Shared:** nickname, gym sessions this week vs your own target, streak of weeks hitting your own target (fair whatever your plan), volleyball sessions, optional best jump. Never weight, food or notes.
- Boards: This week, Streak, Jump, Volleyball. Rename, remove a friend, or leave and delete everything from inside the app.
- Tables are locked (RLS, no policies); the app can only call the vf_* functions. Stats sync quietly after you log. Works offline; syncs when back online.
- Entry points: Progress page and the hub's FRIENDS link.

## 2.5.0 - Drag-and-drop week board
- **Plan page is now a board:** each day is a lane. Drag the handle on a gym session to another day (mouse, pen or finger; only the handle captures touch so the page still scrolls). The lane lights green (fine) or orange (flagged, with the reason) and a bar names the day; dropping saves it with an Undo. Tapping the handle opens the old date picker as a fallback.
- **Gym sessions a week is yours:** choose 2, 3 or 4 (or tick exact sessions). The recommended number is shown and starts from the programme's four, minus one for each extra regular volleyball night. Fewer sessions are spread across the week automatically.
- The same safety checks run on every drop: heavy lower-body days near a match, matches, doubled days. They are flagged, never silently changed. Past days can't be dropped on.

## 2.4.1 - My foods
- Save any scanned (or label-entered) product to **My foods** from its sheet. Your usual portion is remembered and pre-filled each time.
- My foods appear as quick picks in **Add food** and on the Fuel page; foods you log twice or more in 30 days are suggested automatically (tap *Keep* in Manage to save them).

## 2.13.0 — Daily Post (BeReal-style)
- Post page opens with a "Post today" hero; tapping it expands the composer (Cancel closes it). Multiple posts per day are allowed (cap 20 per 24h).
- Feed shows **Today** (friends and you) first; the last 6 days sit in a collapsed "Earlier this week". Feed reloads when the local day rolls over, so each day starts fresh and loads far less.
- Server: `vf_feed(p_id,p_secret,p_from,p_to)` (max 15-day range) and `vf_post_create(... p_day)`; posts older than 30 days are purged along with their videos. **Re-run `vertform-posts.sql` before using this version.**

## 2.14.0 — Calmer, more premium look
- New `css/premium.css` (loaded after career.css): Manrope for all text (bundled in `fonts/`, works offline), flat graphite surfaces with hairline borders, one blue accent, no glass gradients, glows or text shadows, sentence case instead of wide all-caps.
- Page and section titles auto-convert from ALL CAPS via `softCase()` in views.js. A few labels hard-coded in capitals inside individual screens (e.g. meal names) are still capitals.
- Home start button restyled and in sentence case.

## 2.14.1 — Less repetition, no flicker
- Removed repeated labels: page eyebrows that restated the title, the second VERT/FORM wordmark on home, "Friday 16 October · today" under the food date picker, the Gym today panel tag, "Gym ·" on gym cards, "Starting for today" (now "Log for another day").
- Tapping something inside a home panel (e.g. Fresh / Fatigued) no longer replays the panel's open animation, so the screen doesn't look like it reloads.

## 2.15.0 — Hevy-style logging
- **Previous column**: each set row shows what you did in the matching set last time (`100 × 5`). Tap it to copy into that row. The old "Last time" box is now one line with Fill all, Progress and Plates.
- **Warm-up sets**: tap a set number to mark it W. Warm-ups are skipped for working-set numbering, previous values, PBs, volume, history and friend lift estimates.
- **Progress chart**: Progress (in a workout) or tapping an exercise name in a saved workout shows estimated 1RM (Epley, 1–12 rep sets) over time, or best reps/seconds for unloaded exercises.
- **Plate calculator**: Plates opens a sheet with the current weight, bar choice (20/15/10 kg, remembered) and plates per side, with the closest possible weight if it can't be made exactly.
- **Auto-shared workout card**: Finish workout has "Share to friends" (remembered). Posts a gym card with time, volume, sets, PBs and the top line of each exercise. Uses the existing `vf_post_create` (meta ≤600 chars, trimmed to fit), so no SQL change.

## 2.15.1–2.15.2 — Declutter pass
- Progress sheet: one line per session, PB tag inline, year and session only when needed, round chart ticks. Sheets without a label no longer show "VERTFORM".
- Saved workout: title is the session name, date and RPE in the label, one row per exercise (tap for progress), notes only if written.
- Logbook: no "Nº 003" numbers or "RPE —"; removed explanation lines (counted separately, tick sets, timer, manual food), shorter friend and drag hints; Calendar's "W1 build" tag only shows "Easy week".
- Leftover ALL-CAPS labels are softened automatically (main.js), keeping abbreviations (RPE, PB, kcal…), the wordmark, friend codes and anything people typed.
- Fixed "kcallogged" spacing and the upper-case jumps placeholder.

## 2.15.3 — Quicker check-in, volleyball log and profile
- Daily check-in no longer pops up. "How do you feel today?" sits on the Gym today panel, and the first exercise of a workout shows a one-tap Fresh / Moderate / Fatigued row if you haven't answered.
- Log volleyball: duration chips (60/90/120 or Other) and Light / Moderate / Hard / Max, then Save. Date, exact RPE, jumps and notes are under "More details" (opens automatically when editing a session that has them or logging another day). Session load shows only once it can be worked out.
- Profile & calories: one-line intro; the equation, protein-range and adjustment notes moved into "How targets are worked out".

## 2.16.0 — Bodyweight trend
- Food diary has a Bodyweight card: average of your weigh-ins over the last 7 days, change versus 4 weeks earlier, an 8-week trend line and a Log weight button (highlighted after 7 days). It replaces the "Time to weigh in" banner.
- If the 4-week change doesn't fit your goal (maintain drifting more than 1 kg, cut not dropping or dropping faster than ~0.6 kg/week, gain not rising) it suggests a ~150 kcal adjustment.
- Fixed the volleyball "How hard was it?" buttons (one line, centred, not touching the label).

## 2.18.0 — Your 3D player
- **Create your player** (Settings → You, your profile, or the avatar on the Post page): shirt, skin, hair and hair colour, shorts, shoes, build, height and shirt number, with a live 3D preview. The 3D lives in `player3d/` (three.js loads only when a player is on screen and is cached after).
- **Home**: your player spins inside the centre crest (tap it to open the hub as before).
- **Profiles**: tap a friend, or yourself, to see their player on a spotlit turntable you can drag, with tags for their best jump, streak and top lift, then the weekly stats, lift comparison and posts.
- **Avatars**: a head-and-shoulders portrait of each player is drawn once and kept on the phone; it replaces the initial in the feed, comments, the leaderboard and the Post header.
- **Needs `vertform-looks.sql`** so friends can see each other's players (adds the look to the board). Without it your player still works on your own phone.
- Service worker no longer mistakes the 3D frames for the app page.

## 2.18.1 — Player polish and more looks
- Home: your player stands in the centre circle with their head popping above it (stays inside when the hub is open).
- Profiles and the editor use a softer stage that fades into the page: no light shaft, dim glass, cool even light.
- Player editor has tabs (Kit, Hair, Body, Extras) and new options: shirt trim colour, sock length and colour, 4 more hairstyles (Mohawk, Curly top, High top, Spiky), facial hair, headband, knee pads, arm sleeves and wristbands. Faces are now visible under every hairstyle.
- **Re-run `vertform-looks.sql`** so the server accepts the new options.

## 2.18.2 — Player editor redesign
- Bigger preview with a smaller turntable; the camera glides to what you're editing (Kit → upper body, Hair → face, Body → whole player, Extras → legs) and the player turns to face you.
- Each option is one row you swipe sideways, so a tab fits on screen; the selected option is scrolled into view.
- Underlined tabs that stay pinned with the preview; Random and Reset buttons on the preview.

## 2.18.3 — Home player fix
- The home player was cropped (head and feet cut off) because the camera didn't fit the frame on some screens. The camera now fits the whole player to whatever size the frame is, and the player sits the same way whether the hub is open or closed: feet inside the circle, head just above it.
- The host's "Powered by Netlify" badge was being injected into the 3D frames as well, so it showed up in the middle of the circle. The 3D frames now show only the player (the badge on the main page is unchanged).

## 2.18.4 — Profile circle
- Your avatar sits in the top bar on every page (next to settings; in the side rail on wide screens) and opens your profile, where you can create or edit your player. It hides while you're on your own profile.
- Removed the duplicates: the avatar button on the Post header and the "Create/Edit my player" button in Settings. Tapping your own name in the leaderboard or on your own post still opens your profile.

## 2.18.5 — No white flash
- 3D players (home, profiles, editor) load in a frame that browsers paint white until it's ready. The frames now stay invisible until the first 3D frame is drawn, then fade in over a third of a second.

## 2.18.5 — Home player stays put
- Tapping your player on the home screen opened the hub by rebuilding the page, which reloaded the 3D player: it flashed white and came back. Opening/closing the hub and its panels now changes the page in place, so the player keeps spinning.
- Where the page does rebuild, browsers that support moving a frame without reloading it keep the player running; elsewhere the 3D fades in instead of flashing white (frames stay invisible until their first frame is drawn).

## 2.18.6 — Calendar tidy-up
- One flat list instead of boxes inside boxes: each day is a row with a hairline between days.
- Today has a blue date circle; past days are dimmed; rest days are short, quiet rows.
- Sessions are flat cards with a coloured edge (blue planned, green done, red missed, amber team training/match) and the status as coloured text instead of pills. Drag handles are smaller and fainter.
- Week header: "This week" and the dates on the left, round previous/next buttons on the right.

## 2.19.0 — Google sign-in, cloud backup and sync (switched off until the new project is ready)
- `js/config.js` holds the Supabase URL, publishable key and `auth` switch. With `auth: false` (as shipped) nothing changes and no sign-in is shown.
- With `auth: true`: Settings → Account → **Sign in with Google**; also on the welcome screen ("Already use VERTFORM? Sign in") and the friends set-up screen.
- After sign-in: your friend profile is linked to your account (or brought to this device with its own key); your records back up automatically (about 12 s after a change and when you leave the app) and are pulled when you come back. A new phone restores everything. If two devices both changed, you choose which to keep; the other copy is kept on the phone for undo.
- Backup reminders stop while the account backup is current. Sign out keeps everything on the phone; "Delete cloud backup" removes the cloud copy and unlinks the friend profile.
- Server: `vertform-accounts.sql` (device keys, `vf_me`, `vf_link`, `vf_device_key`, `vf_backup_get/put` with revision check, `vf_account_forget`). `vertform-setup.sql` = every VERTFORM SQL file in order, for a fresh project.

## 2.20.0 — BeReal-style posts and reactions
- Posts are picture first, with the caption over the photo or video.
- Six emoji reactions (fire, laugh, volleyball, strong, heart, eyes) replace the single heart. Tap one to react, tap it again to remove it, tap another to swap. Old hearts carry over.
- Run vertform-setup.sql (or the new vertform-reactions.sql) on Supabase. It adds the reactions table and vf_react, and updates vf_feed.
- Camera reactions: on a friend's post, tap React to open the camera, take a quick selfie, check it and send. It shows as a camera chip under the post; tap it to see everyone's camera reactions.
- The reaction row scrolls sideways inside each post so nothing runs off the screen.
- Run vertform-reactions.sql again on Supabase (it adds the photo column and the vf_react_photo and vf_react_photos functions).

## 2.20.1 — Player look stays saved
- Fixed: the 3D player look was dropped every time the app reopened. It now stays on the phone and goes into cloud backups.

## 2.21.0 — Own VERTFORM project and Google sign-in
- The app now uses its own Supabase project (aitrauriezphqtpraqoc), separate from ACE.
- Google sign-in is switched on. Existing friend codes from the old project don't carry over.

## 2.22.0 — Sign in with email and password
- Google sign-in is replaced by email and password. "Create an account" sends a confirmation email (if your Supabase project asks for one). "Forgot password?" sends a reset link, which brings you back to the app to choose a new password.
- Cloud backup, sync and friend identity work exactly as before.

## 2.22.1 — Camera reactions show on the post
- Each camera reaction now appears as a round selfie on the post, in the top-right corner of the photo (BeReal style). Up to three show, with "+N" for the rest. On text posts they show in a row under the words.
- Tap a selfie to see everyone's camera reactions. The camera count no longer hides off-screen in the reaction row.

## 2.23.0 — BeReal-style reactions only
- Emoji reactions are gone. A post has the camera React button and comments, nothing else.
- Camera reaction bubbles sit at the bottom-right of the photo.
- You can save your own camera reaction to your phone, from the preview before you send it or from your own bubble.

## 2.23.1 — Friends: start again when the code is no longer recognised
- When the saved friend code is rejected (for example after the project changed), the Leaderboard now shows "Start again with a new code". One tap clears the old code on this phone and takes you to the join screen.

## 2.24.0 — Share food
- The post composer has a Food option. Share today's macros, one meal (pick Breakfast, Lunch, Dinner or Snack), or the full day.
- A food post shows calories, protein, carbs and fat. A meal or full day also lists the foods (up to 12). Weight and notes are never included.
- Run vertform-food.sql on Supabase. It allows the food post kind and raises the post text limit for the food summary.

## 2.24.1 — Clearer message for food posts
- If a food post fails because the database update is missing, the app now says to run vertform-food.sql in Supabase, instead of "Something went wrong".

## 2.25.0 — AI food estimate, logo in the corner, calendar tidy-up
- Food search has an "Estimate with AI" button. Describe what you ate (e.g. "beef brisket from Lanzhou La Main") and it fills in the name, calories and macros on the manual form. Check it before saving.
- Needs a one-time setup: a Gemini API key, the estimate-food Edge Function and a GEMINI_API_KEY secret in Supabase (see the setup note with the zip).
- The top-right and side-menu avatar is now the VERTFORM logo. It can't be changed.
- The calendar no longer has the "Your week" banner.

## 2.25.1 — AI estimate function name
- The AI estimate now calls the Edge Function under the name it was deployed with (dynamic-worker). No change for you except the setup note.

## 2.25.2 — Jump test with high frame-rate video
- The jump test has a Frame rate picker (24 to 240 fps). The app guesses the rate from the video, and this lets you set it when the guess is wrong, for example on 240 fps slow-motion clips.
- If a video can't be read by the browser, the jump test now says so instead of failing silently.

## 2.25.3 — Jump test shows a message for videos the phone can't show
- If the phone's browser can load a video but can't show its picture (often 240 fps clips), the jump test now says so, instead of a black screen.

## 2.26.0 — Food search drops down
- Matches from foods and saved meals now open as a dropdown under the search box, instead of a list below. Clear the search to see your saved meals and recent foods again.
- Saved meals and recipes show in the same dropdown.
- The AI estimate button stays in place below the search.

## 2.27.0 — Add exercises during the workout
- In a workout, tap "Add an exercise to today" (in the options menu) or "Add exercise" in the Exercises list. Give it a name, sets, reps and whether to record weight.
- It's added to this session only. Your plan and future workouts stay the same.

## 2.28.0 — Friends feed: clearer posts
- Each post has a name bar across the top. A blue edge marks friends' posts and a green edge marks yours.
- Camera reactions now sit in a row under the post, not over the picture.

## 2.29.0 — Leaderboard is its own page
- The home screen has a gold Leaderboard orb at the bottom of the ring. It opens the leaderboard as a page, with the same tabs and friend list as before.
- The Post page's Leaderboard button still works.

## 2.30.0 — Comments look like replies on the post
- The comments sheet opens with the post's picture and caption at the top.
- Replies read like a chat: yours sit on the right, your friends' on the left, each with a small avatar.
- The input has your own avatar beside it and a round send button.

## 2.31.1 — Profile back to lifts only
- Removed the head-to-head block from friend profiles. Lift comparisons (for example your squat against theirs) stay where they were.

## 2.31.0 — Head to head on a friend's profile
- Open a friend's profile to see you vs them this week: gym sessions, volleyball, weeks on streak and best standing jump (if they share it). The leader on each row is highlighted, with a summary like "You lead 2 of 3".
- Only the numbers the leaderboard already shares are used. Food is never included.

## 2.31.2 — Lift comparison as a dropdown on friend profiles
- On a friend's profile, "Compare lifts with <name>" is now a dropdown button, with the number of shared lifts on it. Tap it to see your best lift against theirs in kg (for example squat 90 kg vs 50 kg), with bars and who leads.
- Collapsed by default so the profile stays short.

## 2.31.3 — Nicer lift comparison
- A scoreboard at the top shows how many lifts each of you leads.
- Each lift is now a head-to-head card: your number on the left, theirs on the right, the winner glows, with a split bar showing the balance and a pill for the gap.

## 2.32.0 — Tap your friend's player to compare by body part
- On a friend's profile, their 3D player is now tappable. Tap the legs, chest, back, core, shoulders or arms to compare only those lifts.
- The player is tinted by who leads each body part: blue where you lead, pink where they lead, white where level, dark where nothing is shared yet. The tapped part is highlighted and a sheet shows the head-to-head cards under the player.
- Front / Back buttons turn the player round. Dragging still spins it.
- Lifts are matched to a body part by name (squat and leg press to legs, bench to chest, rows to back, and so on).
- Fixed the lifts-led scoreboard counting a tie as a win for your friend.

## 2.32.1 — AI estimate no longer hides while you search
- "Estimate with AI" now appears as the first row of the food search results as soon as you type, so the results list can't cover it. The button below the search box is still there.

## 2.33.0 — Chat with AI about a meal
- New "Chat with AI about a meal" button in Add food (the AI row in the search results opens the same chat). Describe what you ate, talk it through ("only half the noodles", "no oil") and the estimate updates after every reply.
- "Use these macros" opens the manual food form filled in, so you can check the numbers and save.
- The Supabase function `dynamic-worker` has a new version (`out/estimate-food/index.ts`) that supports chat. Paste it in and deploy to get the full chat. With the old version the button still works as a one-shot estimate.

## 2.33.1 — Leaderboard: instant tabs, streak as a fire
- Fixed the leaderboard page being slow to react. Tapping This week, Volleyball or Jump, and the list finishing loading, now update the page straight away. Before, the page only redrew on the next unrelated refresh.
- The Streak tab is gone. Each person now has a small fire with their streak in weeks next to their name (hidden at 0).

## 2.34.0 — No zoom, swipe back
- Pinch zoom and double-tap zoom are switched off, so the app always stays at its normal size.
- Swipe in from the left edge of the screen to go back a page. If a sheet is open, the swipe closes the sheet first. A small arrow follows your finger. It does nothing on the home screen or during a workout.

## 2.34.1 — Shared meal bar sits flush under the photo
- On a post, the meal, gym session or volleyball bar under the photo now runs the full width of the post instead of looking like a separate box inset inside it.

## 2.35.0 — Cleaner food diary meals
- Each meal (Breakfast, Lunch, Dinner, Snack) now has a bold name with its calories in a small pill beside it, a colour stripe down the left edge, and a coloured add button.
- Foods are simple rows under a thin line instead of boxes inside the box. Macros show as coloured 20P 30C 5F, calories sit on the right, and the edit and delete buttons are smaller.

## 2.36.0 — Calorie trend, tidier food diary
- New calorie trend graph under the Add food / Scan / Manual buttons: a bar for each day against that day's target, with a line marking the target. Blue is under, green is on target (within about 7%), orange is over. Switch between 7, 14 and 30 days, and tap a bar to open that day.
- The headline says how far over or under you are per day on average. Today is drawn faded and left out of the average because the day isn't finished. Days with nothing logged show a dot.
- Removed My foods, Saved meals chips and Quick repeat from the diary page. They are in the Add food sheet.
- The old 7-day bars inside "Targets & last 7 days" are gone, replaced by the trend.

## 2.37.0 — Date in the top bar, no Food diary title
- The Food diary title is gone. The day picker (previous, date, next; tap the date to choose any day) now sits in the top bar next to Back, so the page starts straight at your targets.
- Looking at a past day shows a small "Back to today" button under the banners.
- On wide screens, where there is no top bar, the date picker stays at the top of the page.

## 2.38.0 — Minimal calorie trend
- The calorie trend is now a clean 7-day strip: slim bars, a dashed target line, orange only on days you went over, and one headline ("154 kcal over a day").
- Tap a bar to see that day's calories, its target and how far over or under it was. Tap "Open day" to jump to it, or tap the bar again to clear it.

## 2.39.0 — Exercise library, mid-workout add/remove, name matching
- **Exercise library:** Settings → Exercise library. Lists every exercise you have used (built-in, your sessions, logged workouts), plus exercises you add by hand and ones friends shared in recent gym posts. Search tolerates capitals and small typos.
- **Pick from library** when building a session, and **Add exercise** during a workout: just today, or keep it in that session for future workouts.
- **Remove exercise** during a workout: just today (with Undo) or for good (built-in A–D exercises are hidden, restorable from the library).
- **Same exercise, whatever you typed:** history, last time and PBs now match exercises by name, ignoring capitals, spacing, a trailing "s" and a one-letter typo or swap.
- New fields in saved data: `catalogue`, `hiddenEx` (older backups load fine).

## 2.40.0 — Feed and tabs layout
- New home: opens on **Friends** (your friends' posts first). Bottom bar: **Feed · You · [post button] · Gym · Fuel**. The centre camera button opens a new post and the photo picker in one tap.
- Swipe left/right to move between Feed and You.
- Settings → Appearance → **Home layout** switches back to the classic circle hub at any time. Records are untouched either way.
- Still to come: the redesigned You page, and Today / Plan / History inside Gym.

## 2.41.0 — You page
- New **You** page (second tab): your look/crest, week streak, TODAY tiles (calories left, today's gym session, volleyball), a three-row weekly leaderboard, and a MORE grid (Progress, Jump test, Vertical plan, Plan, Logbook, Friends).
- Pager dots show Feed and You are side by side; swipe between them. The classic hub is still available in Settings → Appearance.

## 2.42.0 — Gym tab
- Gym now has **Today / Plan / History**. Today: the session card with Start, readiness check, week strip, and buttons for the Exercise library, a new session, volleyball and the jump tracker. Plan: the calendar plus your programme (tap a session to start it). History: the logbook.

## 2.43.0 — Feed cards
- Feed top strip now reads "You posted today" with the time and camera-reaction count and a Post again button (or "Post today" before you have posted).
- Friend posts are rounded cards: header, photo with caption over it (or a short caption for text posts), a session card with a GYM / VB tag, then React and comment buttons.

## 2.44.0 — Sessions tab and no doubled exercises
- Gym now has **Today / Plan / Sessions / History**. Sessions lists every session; open one to see its exercises, remove one (bin), or **Add exercise** from the library. Plan links to it.
- The library marks exercises **Already added** for the session or workout you are adding to. Adding one again asks you to confirm first (in a saved session, a session being edited, or a workout in progress).

## 2.45.0 — Fuel tab sections and new app icon
- Fuel now has **Today / Meals / Progress**. Today: calories and macros, Add food / Scan / Manual, and the day's meals. Meals: saved meals and recipes. Progress: calorie trend, bodyweight, and targets with the last 7 days.
- New home-screen icon.

## 2.46.0 — Plan month view, easier library
- Gym → Plan now opens on a **month calendar** (done, planned, missed, volleyball, today). Tap a day to open it; arrows change month. The week view with moving sessions, matches and extras is below it.
- Gym → Sessions starts with a **Find exercises** bar so the exercise library is easy to spot.

## 2.47.0 — Usability pass
- Workout screen: **Add exercise** and **Remove** buttons now sit under "Add a set" on every exercise (they were only in the ⋯ menu).
- New layout: removed the duplicate "V" icons from the top bar (the You tab covers your profile).

## 2.48.0 — Plan day panel, tidier leaderboard
- Plan: tap any day on the month calendar and that day's plan opens right under it (start, move, log volleyball / match / extra). The old week list is replaced by a collapsed "Plan settings & upcoming" section.
- Leaderboard: Refresh sits in the header (it was hidden behind the tab bar), "Load the board" replaces the "pull to refresh" line, and "Settings" is now "Sharing & nickname".

## 2.55.0 — Banner gallery
- Five premium banner graphics (Spike, Net, Court, Iron, Rise) drawn for the app; pick one under Gym → Today → Change banner, or use your own picture from your phone.

## 2.54.1 — Your own banner
- Gym → Today: "Change banner" lets you pick any picture from your phone for the banner and gym cards. Stored on this phone only.

## 2.54.0 — Photo-first posts, artwork, motion
- Finish screen: add a selfie to your post. Gym posts with a photo show the session numbers laid over the picture.
- Original volleyball-player artwork on gym post cards and the top of Gym → Today.
- Feed loading skeleton, blur-in photos, tap and page animations (respect reduced-motion). Two corner sizes: 24 and pill.

## 2.53.1 — One palette, edge-to-edge posts
- Removed the leftover navy/blue surfaces and blue-tinted greys; one neutral dark palette with red as the single accent.
- Photos and gym cards run the full width of the screen. Plan calendar is monochrome (filled = done, outline = planned, red = missed).

## 2.53.0 — Clearer feed, profile photos
- Feed: VERT/FORM wordmark on top, a row of friends' faces (red ring = posted today), one continuous feed with no section headers, gym sessions as big headline cards (lifts behind a tap), a proper empty state, a solid tab bar.
- Profile photo: choose a picture on You (cropped square, shown on posts and the friends row). The 3D player stays as "Player look". Needs vertform-photos.sql on the friends database for friends to see it.
- You: bigger profile header with week number; Gym: feeling check folded away; Fuel and Gym: fewer coloured edges and boxes.

## 2.52.1 — Less repeating
- You: shortcuts cut to Jump progress, Vertical plan, Lifts (Logbook lives in Gym → History; Friends via the leaderboard card).
- Gym: removed the duplicate Exercises / New session / Jump tracker buttons on Today, the duplicate "Exercise library" button and "Training sessions" link.
- Week tag (WK 01/12) only on You. Classic hub retired; layout switch removed from Settings.

## 2.52.0 — Notifications + premium look
- Push notifications (Settings → Notifications), kept quiet: only when a friend posts (one ping per friend per 3 hours) or you're @mentioned in a post or comment. Optional session-day reminder, off by default. Needs the server setup in vertform-push.sql + the vf-push edge function; on iPhone the app must be installed to the home screen.
- Composer tag chips insert @nickname.
- css/premium2.css: no card boxes; hairlines and space group content, photos are the only shapes, single red accent, gold only for streak/PB. Leaderboard lives only on You.

## 2.51.1 — Glass tab bar
- The bottom tab bar is now a floating frosted-glass pill (blur, soft highlight edge), light and dark.

## 2.51.0 — Cleaner tabs, Lifts, own-post preview
- Removed the big page titles on Feed, You and Gym, and the repeated week label (it stays in the top bar only).
- Fuel notices (under-eating, match carbs, protein) have a close button; weekly ones stay away for 3 days.
- Swiping between Feed and You only changes tab, and the tap that follows a swipe is ignored.
- Your own posts are no longer in the feed. The "You posted today" strip shows mini previews and opens a larger list of your posts.
- You > Lifts replaces Plan: every weighted lift, sortable (heaviest, biggest gain, most trained, recent, A-Z), with sparkline and dashed trend; tap for the full chart. Charts everywhere now show a trend line.
- The Mifflin-St Jeor targets paragraph is gone from Fuel (still in the targets calculator).

## 2.50.0 — Training partners
- "Trained with" in Workout options and the Finish sheet: pick friends or type a name. Saved workouts count per person; top partners show on the You page (See all for the full list) and each workout record lists who you trained with. Stored on this device only.

## 2.49.0 — Optional creatine tracker
- Settings → **Creatine** switches an optional tracker on (off by default) and sets your daily dose. When on, Fuel → Today shows a one-tap "Mark taken" row with the last 7 days as dots. Included in backups.
- Gym → Today: removed the redundant "Plan" link beside This week (Plan is one tap away in the tabs).
