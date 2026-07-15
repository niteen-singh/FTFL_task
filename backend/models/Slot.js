const mongoose = require("mongoose");

const slotSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    startTime: {
      type: Date,
      required: true,
    },
    capacity: {
      type: Number,
      required: true,
      min: 1,
    },
    // The single source of truth for "is there room". Booking decrements
    // this with an atomic, conditional findOneAndUpdate (seatsRemaining > 0)
    // so two concurrent requests can never both succeed once seats hit 0.
    seatsRemaining: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Slot", slotSchema);
