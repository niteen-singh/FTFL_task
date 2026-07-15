const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

// verifies using authorization bearer Token
function requireAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [scheme, token] = header.split(" ");

    if (scheme !== "Bearer" || !token) {
        return next(new ApiError(401, "Missing Authorization header"));
    }

    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: payload.sub };
        return next();
    } catch (err) {
        return next(new ApiError(401, "Invalid or expired token"));
    }
}

module.exports = requireAuth;
