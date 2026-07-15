const Slot = require("../models/Slot");
const asyncHandler = require("../utils/asyncHandler");

const listSlots = asyncHandler(async (req, res) => {
  const slots = await Slot.find({}).sort({ startTime: 1 }).lean();

  res.json(
    slots.map((s) => ({
      id: s._id,
      title: s.title,
      description: s.description,
      startTime: s.startTime,
      capacity: s.capacity,
      seatsRemaining: s.seatsRemaining,
    }))
  );
});

module.exports = { listSlots };
