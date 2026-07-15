# FTFL_task

# Slot Booking System

A small race-safe slot booking app: users register/login, view slots with live
capacity, book a slot, and cancel their own bookings — without ever
overbooking a slot, even under concurrent requests.

## A note on the stack

The brief asked for **Next.js (App Router) + TypeScript** on the frontend.
I built the frontend with **plain HTML, CSS, and vanilla JavaScript**
instead. I'm not yet experienced with Next.js/TypeScript, and I'd rather
submit something I fully understand and can defend line-by-line than a
Next.js app I copied patterns for without really knowing why they're there.
The backend requirements (Node/Express/MongoDB) are unchanged, and that's
also plain JavaScript rather than TypeScript for the same reason.

I also want to be upfront that **I used AI assistance (Claude)** while
building this — mainly for scaffolding boilerplate faster and as a sounding
board for the atomic-update/transaction design for the booking endpoint. I
read, tested, and understand every part of it and can walk through or modify
any of it live, but I wanted to disclose it rather than not mention it.

If given more time, reworking the frontend in Next.js + TypeScript is the
first thing I'd tackle — see "What I'd add or change" below.

## Stack actually used

- **Backend:** Node.js, Express, MongoDB + Mongoose, JavaScript
- **Frontend:** Static HTML/CSS/vanilla JavaScript (no framework, no build step)
- **Auth:** JWT, passwords hashed with bcrypt

## Project structure

```
slot-booking/
  backend/
    config/db.js            Mongo connection
    models/                 User, Slot, Booking (Mongoose schemas)
    middleware/             auth.js (JWT check), errorHandler.js
    controllers/             authController, slotController, bookingController
    routes/                  authRoutes, slotRoutes, bookingRoutes
    utils/                   ApiError, asyncHandler, validate
    seed.js                  inserts sample slots
    app.js / server.js
  frontend/
    login.html, register.html, slots.html, my-bookings.html
    css/style.css
    js/api.js, login.js, register.js, slots.js, bookings.js
```

## 1. How I prevented double-booking (the exact mechanism)

The booking endpoint (`POST /api/slots/:id/book`) never does a
"read the count, check it in application code, then save" — that pattern
has a gap between the read and the write where two simultaneous requests
can both see "1 seat left" and both proceed, overbooking the slot.

Instead, every invariant is enforced as a single **atomic, conditional
`findOneAndUpdate`**, so the check-and-write happens as one indivisible
operation on the database side, not in my JS code:

```js
const slot = await Slot.findOneAndUpdate(
    { _id: slotId, seatsRemaining: { $gt: 0 } }, // condition checked by MongoDB
    { $inc: { seatsRemaining: -1 } }, // only applied if condition holds
    { new: true, session },
);
if (!slot) throw new ApiError(409, "This slot is fully booked");
```

MongoDB's storage engine takes a lock on that specific document for the
duration of the operation. If two requests arrive at the same instant, they
still get serialized at the document level: the first one's find-check-write
completes fully, then the second one's condition (`seatsRemaining: { $gt: 0 }`)
is evaluated against the already-decremented document. If the seat was just
taken, the second query matches nothing, `findOneAndUpdate` returns `null`,
and the request is told the slot is full — it never gets a false "success."

The same pattern enforces "max 2 active bookings per user":

```js
const user = await User.findOneAndUpdate(
    { _id: userId, activeBookingsCount: { $lt: 2 } },
    { $inc: { activeBookingsCount: 1 } },
    { new: true, session },
);
if (!user) throw new ApiError(409, "You already have 2 active bookings...");
```

Because a successful booking has to touch **three** documents (decrement the
slot's seats, increment the user's counter, create the `Booking` document),
those three operations are wrapped in a **MongoDB multi-document
transaction** (`session.withTransaction(...)`). If any step fails — slot
full, user already at their 2-booking limit, or a duplicate booking — the
whole transaction aborts and MongoDB automatically rolls back everything
already written in it. That's what stops a seat from being silently "lost":
if the slot-seat decrement succeeds but the user-limit check then fails, the
abort undoes the decrement too, with no manual "give the seat back" code.

As a second, independent line of defense, `Booking` has a **partial unique
index**:

```js
bookingSchema.index(
    { user: 1, slot: 1 },
    { unique: true, partialFilterExpression: { status: "active" } },
);
```

This means the database itself refuses to ever hold two _active_ bookings
for the same user+slot pair. If some other code path ever tried to insert a
duplicate, MongoDB throws an E11000 error, which the controller catches and
turns into a `409`. It's a partial index (only applies while
`status: "active"`) so a user can re-book a slot after cancelling an earlier
booking of it.

Cancelling is protected the same way: cancel does a conditional
`findOneAndUpdate({ _id: bookingId, status: "active" }, { status: "cancelled" })`,
so two concurrent cancel requests for the same booking can't both succeed —
the second gets a 409 ("already cancelled") instead of double-releasing a
seat.

On the frontend, the Book/Cancel buttons are disabled **synchronously**,
before the `await` on the fetch call:

```js
if (bookBtn.disabled) return;
bookBtn.disabled = true;          // happens before any network call
const { ok, data } = await apiFetch(...);
```

A disabled `<button>` stops dispatching `click` events immediately, so a
rapid double-click can't fire two requests. This is a UX nicety, though —
the thing that actually guarantees no overbooking is the database-level
atomic update above, which holds regardless of what any client does.

## 2. Trade-offs I made, and why

- **Transactions require a replica set.** MongoDB transactions don't work
  against a bare standalone `mongod`. I designed for MongoDB Atlas (a
  replica set by default) rather than adding a local replica-set setup
  script, to keep "clone and run" simple. This is documented in
  `.env.example`.
- **No admin UI for creating slots.** The brief only asked for booking-side
  endpoints, so slots are created via a `seed.js` script rather than a
  `POST /slots` admin endpoint. Faster to build, and it's honest about what
  wasn't asked for — but a real product would need slot management.
- **JWT with no refresh token.** Tokens are short-lived-ish (`1d` by
  default) and there's no refresh-token/rotation flow. Simpler to reason
  about and implement correctly in the time available; the cost is users
  get logged out and have to log back in once the token expires.
- **Manual validation instead of a schema library** (e.g. `zod`, `joi`,
  `express-validator`). For four simple fields (email, password) this kept
  dependencies down; it would not scale well if the API grew much bigger.
- **`activeBookingsCount` is a denormalized counter on `User`**, kept in
  sync via the same atomic updates as bookings, rather than doing a `COUNT`
  query against `Booking` on every request. Faster and race-safe, at the
  cost of one more thing that could theoretically drift out of sync if a
  write path is ever added that forgets to touch it (mitigated by only ever
  changing it inside the booking/cancel transactions).
- **Plain HTML/CSS/JS instead of Next.js/TypeScript**, as explained above —
  a deliberate scope change I'm flagging rather than hiding.
- **No automated test suite committed.** I did verify the concurrency logic
  with a script that hammers the booking endpoint with `Promise.all` against
  a temporary MongoDB instance and checked the final `seatsRemaining` and
  booking counts never exceeded capacity, but I didn't have time to turn
  that into a proper committed Jest suite.

## 3. What I'd add or change with more time

- Rebuild the frontend in Next.js + TypeScript as originally asked, now that
  I'd have a working reference implementation to learn the App Router
  patterns against.
- Add TypeScript to the backend too, mainly for the payload shapes between
  routes/controllers/models.
- A `POST /api/slots` (admin-only) endpoint instead of the seed script, with
  a role field on `User`.
- Refresh tokens / shorter-lived access tokens.
- Rate limiting on `/auth/login` and `/auth/register` to slow down
  brute-force attempts.
- A committed automated test suite (unit tests for controllers, plus the
  concurrency test I ran manually) so the race-safety claim is continuously
  verified, not just asserted in this README.
- Optimistic UI updates on booking (update seat count immediately, roll back
  on error) instead of always waiting for a full re-fetch.
- Pagination on `/slots` and `/me/bookings` once the data set is non-trivial.

## 4. Setup and run instructions (clean clone)

### Prerequisites

- Node.js 18+
- A MongoDB connection string that points at a **replica set** — the
  easiest way is a free [MongoDB Atlas](https://www.mongodb.com/atlas)
  cluster, which is a replica set by default. Transactions will fail
  against a plain standalone local `mongod`.

### Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`:

```
MONGO_URI=<your Atlas connection string>
JWT_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
JWT_EXPIRES_IN=1d
PORT=5000
FRONTEND_URL=http://localhost:3000
```

```bash
npm install
npm run seed     # inserts a handful of sample slots
npm run dev       # or: npm start
```

The API is now running at `http://localhost:5000`. Check
`GET http://localhost:5000/api/health` → `{"ok":true}`.

### Frontend

The frontend is static files, no build step. Serve it with any static
server, e.g.:

```bash
cd frontend
npx serve -l 3000
```

Open `http://localhost:3000`. It expects the API at
`http://localhost:5000/api` — change `API_BASE` in `frontend/js/api.js`
if your backend runs elsewhere.

### API summary

| Method | Path                | Auth | Description                            |
| ------ | ------------------- | ---- | -------------------------------------- |
| POST   | /api/auth/register  | No   | Create account, returns JWT            |
| POST   | /api/auth/login     | No   | Log in, returns JWT                    |
| GET    | /api/slots          | Yes  | List slots with remaining capacity     |
| POST   | /api/slots/:id/book | Yes  | Book a slot (race-safe)                |
| GET    | /api/me/bookings    | Yes  | Current user's bookings                |
| DELETE | /api/bookings/:id   | Yes  | Cancel own booking (ownership-checked) |

All authenticated routes expect `Authorization: Bearer <token>`.
