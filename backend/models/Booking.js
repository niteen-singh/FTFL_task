const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Slot",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "cancelled"],
      default: "active",
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Belt-and-braces guard against the same user double-booking the same slot
// (e.g. a rapid double-click that somehow reaches the server twice). This is
// a *partial* unique index: it only applies to documents whose status is
// "active", so a user CAN re-book a slot after cancelling their earlier
// booking of it. If two inserts race, MongoDB itself rejects the second one
// with an E11000 duplicate key error, which the controller turns into a 409.
bookingSchema.index(
  { user: 1, slot: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

module.exports = mongoose.model("Booking", bookingSchema);
