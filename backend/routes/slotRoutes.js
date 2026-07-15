const express = require("express");
const requireAuth = require("../middleware/auth");
const { listSlots } = require("../controllers/slotController");
const { bookSlot } = require("../controllers/bookingController");

const router = express.Router();

// Listing slots is useful even before login, but this app treats the whole
// product as logged-in-only for simplicity, so it's protected too.
router.get("/", requireAuth, listSlots);
router.post("/:id/book", requireAuth, bookSlot);

module.exports = router;
