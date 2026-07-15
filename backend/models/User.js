const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    // Denormalized counter kept in sync with the number of the user's
    // Booking documents that have status "active". Reading/writing this
    // field with an atomic conditional update (see bookingController) is
    // what lets us enforce "max 2 active bookings" without a race window.
    activeBookingsCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
