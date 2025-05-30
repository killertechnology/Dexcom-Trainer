import React from "react";
import { Card, CardContent } from "../components/ui/card";


const Scoreboard = ({ dailyScore }) => {
  return (
    <Card >
      <CardContent>
      <div>
        <div className="scoreboard"><br /><b>Scoreboard</b></div>
        {dailyScore ? (
          <table>
            <tbody>
              <tr>
                <td className="border px-4 py-2 font-medium "><b>Total Points</b></td>
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
