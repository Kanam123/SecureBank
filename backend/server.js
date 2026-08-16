require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const seed = require("./seed");

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGINS || "*").split(","), credentials: true }));
app.use(express.json());

// Routes (all prefixed with /api)
app.get("/api/", (req, res) => res.json({ message: "SecureBank API is running" }));
app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/users", require("./routes/users"));
app.use("/api/accounts", require("./routes/accounts"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/beneficiaries", require("./routes/beneficiaries"));
app.use("/api/admin", require("./routes/admin"));

app.use((req, res) => res.status(404).json({ message: "Route not found" }));

const PORT = 8001;

(async () => {
  try {
    await connectDB();
    await seed();
    app.listen(PORT, "0.0.0.0", () => console.log(`[server] SecureBank API listening on :${PORT}`));
  } catch (err) {
    console.error("[server] Failed to start", err);
    process.exit(1);
  }
})();
