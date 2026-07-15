const ApiError = require("../utils/ApiError");

// Centralized error handler. Every route uses asyncHandler, so any thrown
// error (ApiError or otherwise) ends up here instead of leaking a stack
// trace or crashing the server.
function errorHandler(err, req, res, next) {
    if (err instanceof ApiError) {
        return res.status(err.statusCode).json({ error: err.message });
    }

    // Mongoose validation error
    if (err.name === "ValidationError") {
        return res.status(400).json({ error: err.message });
    }

    // Mongoose bad ObjectId
    if (err.name === "CastError") {
        return res.status(400).json({ error: `Invalid ${err.path}` });
    }

    // Duplicate key (e.g. unique email, or the active-booking partial index)
    if (err.code === 11000) {
        return res.status(409).json({ error: "Duplicate resource" });
    }

    console.error("[unhandled error]", err);
    return res.status(500).json({ error: "Internal server error" });
}

module.exports = errorHandler;
