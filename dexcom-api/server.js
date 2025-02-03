require("dotenv").config(); // ✅ Load environment variables from .env
const express = require('express');
const router = express.Router();
const mysql = require("mysql");
const bodyParser = require("body-parser");
const cors = require("cors");
const db = require("./dbconfig");
 
const app = express();
app.use(cors());
app.use(bodyParser.json());


// ✅ Use router for endpoints
router.get('/api/users', (req, res) => {
  db.query('SELECT * FROM Users', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

router.get('/api/cgm', (req, res) => {
  const selectedDate = req.query.date;
  if (!selectedDate) {
    return res.status(400).json({ error: "Missing 'date' query parameter" });
  }

  db.query(
    'SELECT * FROM cgm_data WHERE DATE(Timestamp) = ? ORDER BY Timestamp ASC',
    [selectedDate],
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    }
  );
});

router.get('/api/alarms', (req, res) => {
  db.query('SELECT * FROM alarms_data', (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

router.get('/api/bolus', (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  db.query('SELECT * FROM bolus_data WHERE DATE(Timestamp) = ?', [date], (err, results) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// ✅ Fixed /api/scores/:userId query
router.get('/api/scores/:userId', (req, res) => {
  const userId = req.params.userId;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: "Date parameter is required" });
  }

  db.query('SELECT * FROM Scores WHERE user_id = ? AND DATE(date) = ?', 
    [userId, date], 
    (err, results) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(results);
    }
  );
});

// ✅ Use router in Express App
app.use(router);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

