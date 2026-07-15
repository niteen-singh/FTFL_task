const express = require("express");
const requireAuth = require("../middleware/auth");
const { getMyBookings, cancelBooking } = require("../controllers/bookingController");

const router = express.Router();

router.get("/me/bookings", requireAuth, getMyBookings);
router.delete("/bookings/:id", requireAuth, cancelBooking);

module.exports = router;
