const express = require('express');
const mysql = require("mysql2");
const bodyParser = require("body-parser");
const cors = require("cors");


// ✅ Create an Express app
const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Use environment variables for DB credentials
const dbConfig = {
  host: "ec2-52-39-197-130.us-west-2.compute.amazonaws.com",
  user: "root",
  password: "good4you",
  database: "dexcom",
  port: 3306
};

// ✅ Use a connection pool (better for AWS Lambda)
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
}).promise();

// ✅ Define routes
app.get("/", async (req, res) => {
  try {
    const [results] = await pool.query("SELECT * FROM cgm_data LIMIT 100");
    res.json(results);
  } catch (err) {
    console.error("❌ Database query error:", err);
    res.status(500).json({ error: err.message });
  }
});

let local = "false";

// ✅ Start local server only if running locally
if (local === "true") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Local server running on http://localhost:${PORT}`);
  });
}


  // ✅ Export for AWS Lambda
  module.exports.handler = require("serverless-http")(app);
  console.log('running');
