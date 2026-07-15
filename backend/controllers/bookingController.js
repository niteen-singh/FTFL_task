const mongoose = require("mongoose");
const Slot = require("../models/Slot");
const User = require("../models/User");
const Booking = require("../models/Booking");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

/**
 * POST /api/slots/:id/book
 *
 * Race safety, in plain terms:
 *
 * We never do "read seatsRemaining, check in JS, then write" - that pattern
 * has a window between the read and the write where two concurrent requests
 * can both see "1 seat left" and both decide to book, overbooking the slot.
 *
 * Instead every invariant is enforced with a single atomic, CONDITIONAL
 * findOneAndUpdate: "decrement seatsRemaining, but only if seatsRemaining is
 * currently > 0". MongoDB executes the read-check-write as one atomic
 * operation on the storage engine level for a single document, so even if
 * two requests hit this at the exact same millisecond, only one of them can
 * ever see the update apply when there's exactly one seat left. The other
 * gets back `null` and is told the slot is full.
 *
 * The same atomic-conditional-update pattern is used for the "max 2 active
 * bookings per user" rule, guarding User.activeBookingsCount < 2.
 *
 * Because this now touches THREE documents (slot, user, booking) that must
 * all succeed or all fail together, the three operations are wrapped in a
 * MongoDB multi-document transaction. If any step fails (slot full, user at
 * their limit, or a duplicate-booking conflict), the whole transaction is
 * aborted and MongoDB rolls back every write already made in it - so a slot
 * seat is never "lost" because a later step failed.
 */
const bookSlot = asyncHandler(async (req, res) => {
  const { id: slotId } = req.params;
  const userId = req.user.id;

  if (!mongoose.isValidObjectId(slotId)) {
    throw new ApiError(400, "Invalid slot id");
  }

  const session = await mongoose.startSession();

  try {
    let createdBooking;

    await session.withTransaction(async () => {
      // 1) Atomically claim a seat on the slot. This is the operation that
      //    actually prevents overbooking: the condition `seatsRemaining: { $gt: 0 }`
      //    is checked and applied by MongoDB as a single atomic step.
      const slot = await Slot.findOneAndUpdate(
        { _id: slotId, seatsRemaining: { $gt: 0 } },
        { $inc: { seatsRemaining: -1 } },
        { new: true, session }
      );

      if (!slot) {
        // Either the slot doesn't exist, or it's full. Distinguish them
        // with a cheap follow-up read (still inside the transaction so it
        // sees a consistent snapshot).
        const exists = await Slot.exists({ _id: slotId }).session(session);
        if (!exists) throw new ApiError(404, "Slot not found");
        throw new ApiError(409, "This slot is fully booked");
      }

      // 2) Atomically claim one of the user's 2 allowed active-booking slots.
      const user = await User.findOneAndUpdate(
        { _id: userId, activeBookingsCount: { $lt: 2 } },
        { $inc: { activeBookingsCount: 1 } },
        { new: true, session }
      );

      if (!user) {
        // Aborting the transaction automatically undoes step 1's decrement -
        // no manual "give the seat back" code needed.
        throw new ApiError(
          409,
          "You already have 2 active bookings. Cancel one before booking another."
        );
      }

      // 3) Create the booking itself. The partial unique index on
      //    { user, slot, status: 'active' } is a second line of defense:
      //    if this same request somehow got sent twice concurrently, the
      //    second insert fails with a duplicate key error (E11000) instead
      //    of creating a second active booking for the same slot.
      try {
        const docs = await Booking.create(
          [{ user: userId, slot: slotId, status: "active" }],
          { session }
        );
        createdBooking = docs[0];
      } catch (err) {
        if (err.code === 11000) {
          throw new ApiError(409, "You already have an active booking for this slot");
        }
        throw err;
      }
    });

    res.status(201).json({
      id: createdBooking._id,
      slot: slotId,
      status: "active",
      createdAt: createdBooking.createdAt,
    });
  } finally {
    await session.endSession();
  }
});

const getMyBookings = asyncHandler(async (req, res) => {
  const bookings = await Booking.find({ user: req.user.id })
    .sort({ createdAt: -1 })
    .populate("slot", "title description startTime capacity")
    .lean();

  res.json(
    bookings.map((b) => ({
      id: b._id,
      status: b.status,
      createdAt: b.createdAt,
      cancelledAt: b.cancelledAt,
      slot: b.slot
        ? {
            id: b.slot._id,
            title: b.slot.title,
            description: b.slot.description,
            startTime: b.slot.startTime,
          }
        : null,
    }))
  );
});

/**
 * DELETE /api/bookings/:id
 *
 * Ownership (IDOR) check: we first load the booking and compare
 * booking.user to the authenticated user id, returning 403 if they don't
 * match, BEFORE touching anything. Only after that check passes do we run
 * the atomic cancel.
 *
 * The cancel itself is also a conditional findOneAndUpdate
 * (`status: 'active'` -> `status: 'cancelled'`), so if two cancel requests
 * for the same booking race each other, only the first succeeds; the second
 * gets null back and is told the booking was already cancelled - it can
 * never double-release a seat.
 */
const cancelBooking = asyncHandler(async (req, res) => {
  const { id: bookingId } = req.params;
  const userId = req.user.id;

  if (!mongoose.isValidObjectId(bookingId)) {
    throw new ApiError(400, "Invalid booking id");
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) {
    throw new ApiError(404, "Booking not found");
  }

  if (booking.user.toString() !== userId) {
    throw new ApiError(403, "You can only cancel your own bookings");
  }

  if (booking.status !== "active") {
    throw new ApiError(400, "This booking is already cancelled");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const updated = await Booking.findOneAndUpdate(
        { _id: bookingId, status: "active" },
        { status: "cancelled", cancelledAt: new Date() },
        { new: true, session }
      );

      if (!updated) {
        // Lost a race with a concurrent cancel of the same booking.
        throw new ApiError(409, "This booking was already cancelled");
      }

      await Slot.findOneAndUpdate(
        { _id: updated.slot },
        { $inc: { seatsRemaining: 1 } },
        { session }
      );

      await User.findOneAndUpdate(
        { _id: userId, activeBookingsCount: { $gt: 0 } },
        { $inc: { activeBookingsCount: -1 } },
        { session }
      );
    });
  } finally {
    await session.endSession();
  }

  res.status(200).json({ id: bookingId, status: "cancelled" });
});

module.exports = { bookSlot, getMyBookings, cancelBooking };
