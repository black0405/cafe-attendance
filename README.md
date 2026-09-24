<p align="center"><img src="source/public/logo.png" width="128" alt="Cafe Attendance logo"></p>

# Cafe Attendance

Staff attendance for a small cafe, running on one Windows laptop. Staff look
at the webcam, the kiosk recognises them, they type their 4-digit PTP and tap
Clock in or Clock out. The owner manages staff, downloads Excel reports and gets a
weekly email.

No cloud, no Docker, no server to rent. One installer, one SQLite file.

## Features

- Clock in and out by face recognition plus a 4-digit PTP code; the server checks both on every punch
- Lunch break per shift, deducted from hours worked
- Kiosk screen that works without a login; admin controls only appear while an admin is signed in
- Staff added with name and phone only, no password and no sign-in; only the admin signs in
- Admin dashboard: staff list, attendance calendar, recent activity
- Weekly and monthly Excel reports, plus an automatic weekly email
- One-click Windows installer, runs hidden in the background, data kept across upgrades
- No default login: the admin account is created on first launch
- Passwords stored bcrypt-hashed, server listens on the laptop only (127.0.0.1)

## Install (cafe laptop)

1. Download `CafeAttendance-Setup.exe` from the Releases page.
2. Run it, Next, Finish. A **Cafe Attendance** shortcut appears on the desktop and Start Menu. Tick "Start when Windows starts" for a kiosk.
3. The kiosk opens in an Edge window at `http://localhost:3789/kiosk`.

On first launch the app opens a **Welcome** screen: enter a name, email and password (8+ characters) to create the admin account. There is no default login. The screen only appears while no accounts exist.

The server runs hidden. Use **Stop Cafe Attendance** in the Start Menu to stop it.
**Uninstall Cafe Attendance** is in the Start Menu too (also under Settings, Apps). It asks whether to delete the attendance data.
Data lives in `%LOCALAPPDATA%\CafeAttendance\attendance.db`. Back it up by copying that file. Logs are next to it.

## Staff setup

1. Open the app, click **Admin login** on the kiosk, sign in.
2. **Staff:** click **Add staff** for each person with a name and phone number. No password is needed: a 4-digit **PTP** code is generated and shown in the Staff list. Give each person their code. **Reset PTP** issues a new one. Staff never sign in to the website; only the admin does.
3. **Kiosk:** for each person, have them look at the camera and click **Enroll face**. Click **Add face sample** 2 or 3 more times from slightly different angles.
4. **Log out.** The kiosk keeps working; the Enroll and Remove buttons disappear.

Daily use: stand in front of the camera. The kiosk greets you by name and asks
for your PTP. Type it, then tap Clock in / Clock out / Lunch while still facing
the camera: the face and the PTP are both checked before the punch is saved. A
wrong PTP keeps the panel open to try again. A card turns green when clocked
in. While clocked in, **Lunch** starts a break (card turns amber) and **Back from
lunch** ends it. One lunch per shift. If someone forgets to end lunch, clocking
out ends it. Tapping a name on the board does nothing; only a recognised face can
clock in.

Limits to know:

- A webcam is required. Without one, nobody can clock in.
- Face recognition needs decent light and a camera roughly at face height. Masks, caps and strong backlight cause misses; step closer and face the camera.
- There is no liveness check, so a photo of a coworker could pass the face step; the PTP is the second lock. Keep the kiosk at the counter where others can see it.
- Face data is stored as a 128-number template on the laptop only, never as photos. Get staff consent; **Remove face** deletes it.
- A PTP is only 4 digits and only works together with the matching face. The server only listens on the laptop itself; do not expose the app on a network.

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

The build stages the app in `%TEMP%\CafeAttendance-stage`, outside the source
tree, and runs the database migration from there as a smoke test. A module
missing from the install then fails the build instead of failing on the cafe
laptop.

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

## Stack

Next.js 13, Prisma, SQLite, face-api.js (TensorFlow.js), nodemailer, ExcelJS, Inno Setup.

## License

MIT, see [LICENSE](LICENSE).
