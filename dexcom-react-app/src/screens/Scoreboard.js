import React from "react";
import { Card, CardContent } from "../components/ui/card";


const Scoreboard = ({ dailyScore }) => {
  return (
    <Card className="mt-4 p-4">
      <CardContent>
      <div className="mt-4 p-4 border rounded-lg bg-gray-100">
      <h3 className="text-lg font-semibold">Scoreboard</h3>
      {dailyScore ? (
        <table className="min-w-full border-collapse border border-gray-200">
          <tbody>
            <tr>
              <td className="border px-4 py-2 font-medium">Total Points</td>
              <td className="border px-4 py-2">{dailyScore[0]["total_score"]}</td>
            </tr>
            <tr>
              <td className="border px-4 py-2 font-medium">Points Earned Today</td>
              <td className="border px-4 py-2">{dailyScore[0]["rewards"]}</td>
            </tr>
            <tr>
              <td className="border px-4 py-2 font-medium">Points Deducted Today</td>
              <td className="border px-4 py-2">{dailyScore[0]["deductions"]}</td>
            </tr>
            
          </tbody>
        </table>
      ) : (
        <p>Loading scores...</p>
      )}
    </div>

      </CardContent>
    </Card>
  );
};

export default Scoreboard;
