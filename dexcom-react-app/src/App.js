import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

import DailyScreen from "./screens/DailyScreen";
import WeeklyScreen from "./screens/WeeklyScreen";
import MonthlyScreen from "./screens/MonthlyScreen";
import Login from "./screens/Login"; 

//Test


const App = () => {
  return (
    <Router>
      <div>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/daily" element={<DailyScreen />} />
          <Route path="/weekly" element={<WeeklyScreen />} />
          <Route path="/monthly" element={<MonthlyScreen />} />
          <Route path="/login" element={<Login />} />
        </Routes>
      </div>
    </Router>
  );
};

const Header = () => (
  <div>
    <h1 >Dexcom Personal Trainer</h1>
    <nav >
      <Link to="/daily" className="text-blue-600">Daily</Link>
      <Link to="/weekly" className="text-blue-600">Weekly</Link>
      <Link to="/monthly" className="text-blue-600">Monthly</Link>
      <Link to="/login" className="text-blue-600">Login</Link>
    </nav>
  </div>
);

const Home = () => (
  <Card>
    <CardContent>
      <h2>Welcome to the Dexcom App!</h2>
      <p>Navigate to the Daily, Weekly, or Monthly views to explore your data.</p>
    </CardContent>
  </Card>
);

export default App;
