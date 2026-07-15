const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { isValidEmail, isValidPassword } = require("../utils/validate");

const SALT_ROUNDS = 12;

function signToken(userId) {
  return jwt.sign({ sub: userId.toString() }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "1d",
  });
}

function toPublicUser(user) {
  return {
    id: user._id,
    email: user.email,
    activeBookingsCount: user.activeBookingsCount,
  };
}

const register = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email)) {
    throw new ApiError(400, "A valid email is required");
  }
  if (!isValidPassword(password)) {
    throw new ApiError(400, "Password must be at least 8 characters long");
  }

  const normalizedEmail = email.trim().toLowerCase();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, "An account with this email already exists");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await User.create({ email: normalizedEmail, passwordHash });

  const token = signToken(user._id);
  res.status(201).json({ token, user: toPublicUser(user) });
});

const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};

  if (!isValidEmail(email) || typeof password !== "string" || !password) {
    throw new ApiError(400, "Email and password are required");
  }

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  // Same generic message whether the email doesn't exist or the password is
  // wrong, so we don't leak which accounts exist.
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = signToken(user._id);
  res.status(200).json({ token, user: toPublicUser(user) });
});

module.exports = { register, login };
