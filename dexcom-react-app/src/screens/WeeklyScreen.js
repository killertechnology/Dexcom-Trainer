import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const WeeklyScreen = () => {
  const [weeklyData, setWeeklyData] = useState([]);
  const [selectedWeek, setSelectedWeek] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  useEffect(() => {
    fetch(`http://localhost:3000/api/weekly?date=${selectedWeek}`)
      .then((response) => response.json())
      .then((data) => setWeeklyData(data));
  }, [selectedWeek]);

  const updateWeek = (days) => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + days);
    setSelectedWeek(newDate.toISOString().split("T")[0]);
  };

  const chartData = {
    labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    datasets: [
      {
        label: "Weekly CGM Glucose Levels",
        data: weeklyData.map((day) => day.avgGlucose || null),
        borderColor: "rgb(54, 162, 235)",
        backgroundColor: "rgba(54, 162, 235, 0.2)",
      },
    ],
  };

  return (
    <Card>
      <CardContent>
        <h2 className="text-xl font-semibold">Weekly Blood Glucose Data</h2>
        <div className="flex gap-2 items-center mb-4">
          <button onClick={() => updateWeek(-7)} className="border p-2 rounded">← Previous Week</button>
          <input
            type="date"
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="border p-2 rounded"
          />
          <button onClick={() => updateWeek(7)} className="border p-2 rounded">Next Week →</button>
        </div>
        <Line data={chartData} options={{ scales: { y: { min: 0, max: 420 } } }} />
        <div className="mt-4 p-4 border rounded-lg shadow-md bg-gray-100">
          <h3 className="text-lg font-semibold">Weekly Summary</h3>
          <p><strong>Average Daily Score:</strong> TBD</p>
          <p><strong>Total Positive Points:</strong> TBD</p>
          <p><strong>Total Negative Events:</strong> TBD</p>
          <p><strong>Total Points Achieved:</strong> TBD</p>
          <p><strong>Total Points Revoked:</strong> TBD</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default WeeklyScreen;
