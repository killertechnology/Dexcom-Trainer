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

const MonthlyScreen = () => {
  const [monthlyData, setMonthlyData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(
    new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );

  useEffect(() => {
    fetch(`http://localhost:3000/api/monthly?date=${selectedMonth}`)
      .then((response) => response.json())
      .then((data) => setMonthlyData(data));
  }, [selectedMonth]);

  const updateMonth = (months) => {
    const newDate = new Date(selectedMonth);
    newDate.setMonth(newDate.getMonth() + months);
    setSelectedMonth(newDate.toISOString().split("T")[0]);
  };

  const chartData = {
    labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
    datasets: [
      {
        label: "Monthly CGM Glucose Levels",
        data: monthlyData.map((day) => day.avgGlucose || null),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.2)",
      },
    ],
  };

  return (
    <Card>
      <CardContent>
        <h2 className="text-xl font-semibold">Monthly Blood Glucose Data</h2>
        <div className="flex gap-2 items-center mb-4">
          <button onClick={() => updateMonth(-1)} className="border p-2 rounded">← Previous Month</button>
          <input
            type="month"
            value={selectedMonth.slice(0, 7)}
            onChange={(e) => setSelectedMonth(e.target.value + "-01")}
            className="border p-2 rounded"
          />
          <button onClick={() => updateMonth(1)} className="border p-2 rounded">Next Month →</button>
        </div>
        <Line data={chartData} options={{ scales: { y: { min: 0, max: 420 } } }} />
        <div className="mt-4 p-4 border rounded-lg shadow-md bg-gray-100">
          <h3 className="text-lg font-semibold">Monthly Summary</h3>
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

export default MonthlyScreen;
