// Populates a handful of sample slots so the frontend has something to
// show. The assignment doesn't ask for a "create slot" endpoint, so this
// script is the simplest honest way to seed data. Run with: npm run seed
require("dotenv").config();
const mongoose = require("mongoose");
const Slot = require("./models/Slot");

const sampleSlots = [
  {
    title: "Dr. Mehta - General Checkup",
    description: "30-minute general consultation",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 24), // tomorrow
    capacity: 1,
    seatsRemaining: 1,
  },
  {
    title: "Dr. Rao - Dental Cleaning",
    description: "Routine dental cleaning",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 48),
    capacity: 3,
    seatsRemaining: 3,
  },
  {
    title: "Yoga Class - Morning Batch",
    description: "Beginner-friendly group session",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 30),
    capacity: 5,
    seatsRemaining: 5,
  },
  {
    title: "Product Demo Slot",
    description: "1:1 walkthrough with the team",
    startTime: new Date(Date.now() + 1000 * 60 * 60 * 72),
    capacity: 1,
    seatsRemaining: 1,
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("[seed] connected");

  await Slot.deleteMany({});
  await Slot.insertMany(sampleSlots);

  console.log(`[seed] inserted ${sampleSlots.length} slots`);
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
