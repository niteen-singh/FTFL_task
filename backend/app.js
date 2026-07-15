const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const slotRoutes = require("./routes/slotRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const errorHandler = require("./middleware/errorHandler");

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

app.use(
    cors({
        origin: allowedOrigins.length ? allowedOrigins : "*",
    }),
);

app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/slots", slotRoutes);
// bookingRoutes itself defines /me/bookings and /bookings/:id, so it's
// mounted at /api directly rather than /api/bookings.
app.use("/api", bookingRoutes);

// 404 for anything else under /api
app.use("/api", (req, res) => {
    res.status(404).json({ error: "Not found" });
});

app.use(errorHandler);

module.exports = app;
