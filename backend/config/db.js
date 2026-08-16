const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URL;
  const dbName = process.env.DB_NAME;
  if (!uri || !dbName) {
    throw new Error("MONGO_URL and DB_NAME must be set in environment");
  }
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { dbName });
  console.log(`[db] Connected to MongoDB database: ${dbName}`);
}

module.exports = connectDB;
