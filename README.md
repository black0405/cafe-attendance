<p align="center"><img src="source/public/logo.png" width="128" alt="Cafe Attendance logo"></p>

# Cafe Attendance

Staff attendance for a small cafe, running on one Windows laptop. Staff look
at the webcam, the kiosk greets them by name, they touch the fingerprint reader
to clock in or out. The owner manages staff, downloads Excel reports and gets a
weekly email.

No cloud, no Docker, no server to rent. One installer, one SQLite file.

## Features

- Face recognition on the laptop webcam picks the staff member; fingerprint confirms them (Windows Hello via WebAuthn)
- Lunch break per shift (start and end by fingerprint), deducted from hours worked
- Kiosk screen that works without a login; admin controls only appear while an admin is signed in
- Staff identified by phone number, email optional, login with either
- Admin dashboard: staff list, attendance calendar, recent activity
- Weekly and monthly Excel reports, plus an automatic weekly email
- One-click Windows installer, runs hidden in the background, data kept across upgrades
- Passwords stored bcrypt-hashed, server listens on the laptop only (127.0.0.1)

## Install (cafe laptop)

1. Download `CafeAttendance-Setup.exe` from the Releases page.
2. Run it, Next, Finish. A **Cafe Attendance** shortcut appears on the desktop and Start Menu. Tick "Start when Windows starts" for a kiosk.
3. The kiosk opens in an Edge window at `http://localhost:3789/kiosk`.

Default admin login:

```
Email:    admin@admin.com
Password: admin@admin.com
```

Change it right away: Dashboard, then Users, then the pencil icon on the Admin User row.

The server runs hidden. Use **Stop Cafe Attendance** in the Start Menu to stop it.
**Uninstall Cafe Attendance** is in the Start Menu too (also under Settings, Apps). It asks whether to delete the attendance data.
Data lives in `%LOCALAPPDATA%\CafeAttendance\attendance.db`. Back it up by copying that file. Logs are next to it.

## Fingerprint setup

1. **Windows Hello:** Settings, Accounts, Sign-in options, Fingerprint recognition. Set a PIN, then add each staff member's finger to this Windows account (Windows allows 10 fingers per account).
2. Open the app, click **Admin login** on the kiosk, sign in.
3. **Users:** add each staff member with a phone number.
4. **Kiosk:** for each person click **Enroll finger** and have them touch the reader. Then have them look at the camera and click **Enroll face**; repeat **Add face sample** 2 or 3 times from slightly different angles.
5. **Log out.** The kiosk keeps working; Enroll and Revoke buttons disappear.

Daily use: stand in front of the camera. The kiosk greets you by name and shows Clock in / Clock out / Lunch buttons. Tap one, touch the reader. If the camera does not recognise you, tap your name instead. Card turns green when clocked in.
While clocked in a **Lunch** button appears: tap it and touch the reader to start
lunch (card turns amber), tap **Back from lunch** to end it. One lunch per shift.
If someone forgets to end lunch, clocking out ends it.

Limits to know:

- Windows Hello confirms "an enrolled finger on this Windows account", not which finger. Face recognition supplies the "who"; the finger proves a live person is present. A photo of a coworker plus any enrolled finger could still fool it, so keep the camera at the counter in view of others.
- Face recognition needs decent light and a camera roughly at face height. Masks, caps and strong backlight cause misses; the kiosk then falls back to tapping your name.
- Face data is stored as a 128-number template on the laptop only, never as photos. Get staff consent; **Remove face** deletes it.
- Windows Hello allows a PIN fallback; the browser cannot disable it.
- 10 fingers per Windows account is a Windows limit.

## Reports

Dashboard, then **Reports**.

- **Download:** this/last week, this/last month as an Excel file. Sheet "Shifts": one row per shift with clock in, lunch start, lunch end, clock out and hours worked (lunch deducted). Sheet "Totals": shifts and hours per person with a grand total.
- **Weekly email:** tick "Send weekly report automatically", enter the email to send to and the SMTP details of the sending mailbox. For Gmail: host `smtp.gmail.com`, port `587`, username your Gmail address, password a Google App Password. "Send last week now" tests it.

The email goes out every Monday after 08:00 for the previous Monday to Sunday, sent by the app on the laptop, so the laptop must be on with the app running at some point that week.

## Release a new version (no tools needed)

On GitHub: **Actions**, **Build installer**, **Run workflow**, type a version
such as `1.1.0`, click the green button. About ten minutes later the new
`CafeAttendance-Setup.exe` appears under **Releases**. Installing it over an
older version keeps all data.

To build locally instead, with Node 20+ and [Inno Setup 6](https://jrsoftware.org/isinfo.php):

```bash
cd source
npm install
npm run build:installer
# -> source/installer/dist/CafeAttendance-Setup.exe
```

## Develop

```bash
cd source
npm install
echo DATABASE_URL=file:./dev.db > .env
npm run migrate
npm run dev
```

Open `http://localhost:3000`. Schema changes: edit `prisma/schema.prisma`, run `npx prisma migrate dev --name <change> --create-only`, commit the new folder under `prisma/migrations`. Installed copies apply it on next start.

## Configuration

Set in `source/installer/start.cmd` for installed copies, or `.env` in development.

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `file:%LOCALAPPDATA%/CafeAttendance/attendance.db` | SQLite file |
| `JWT_SECRET` | generated once into `jwt.secret` | token signing |
| `PORT` / `HOSTNAME` | `3789` / `127.0.0.1` | where the server listens |
| `WEBAUTHN_RP_ID` / `WEBAUTHN_ORIGIN` | `localhost` / `http://localhost:3789` | fingerprint domain binding |

## Stack

Next.js 13, Prisma, SQLite, SimpleWebAuthn, face-api.js (TensorFlow.js), nodemailer, ExcelJS, Inno Setup.

## License

MIT, see [LICENSE](LICENSE). Attributions for code this project builds on are in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
