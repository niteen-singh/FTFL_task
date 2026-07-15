// A small typed error so controllers can do `throw new ApiError(409, "...")`
// and the central error handler knows exactly what status/message to send.
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = ApiError;
