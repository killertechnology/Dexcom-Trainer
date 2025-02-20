import React from "react";
import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";

import Home1 from "./screens/Home";
import DailyScreen from "./screens/DailyScreen";
import Disclaimer from "./screens/Disclaimer";

//Test


const App = () => {
  return (
    <Router>
      <div>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
        <Route path="/Disclaimer" element={<Disclaimer />} />
          <Route path="/DailyScreen" element={<DailyScreen />} />
        </Routes>
      </div>
    </Router>
  );
};

const Header = () => (
  <div align="center">
    <h1 >CGM Personal Trainer</h1>
     </div>
);
/*
<nav >
      <Link to="/daily" className="text-blue-600">Daily</Link>
     </nav>
   
*/
const Home = () => (
  <Card>
    <CardContent>
      
            <table align="center" style={{"text-align":"left","width":"97%"}}>
                <tbody>
                  <tr>
                    <td align="center">
                    <h2>Welcome to CGM Personal Trainer,<br />Your Personalized Diabetes Coach!</h2>
                    <img src="/images/home3.webp" width={"80%"}></img>
                    </td>
                  </tr>
                <tr>
                    
                    <td className="scoreboard" valign="top">
                    Managing diabetes can feel overwhelming, especially when you're new to Continuous Glucose Monitoring (CGM) and insulin therapy. That’s where CGM Personal Trainer steps in!<br /><br />
                    </td>
                </tr>
                <tr>
                    <td className="scoreboard" valign="top">
                    Designed for both patients and parents of young diabetics, this app transforms complex blood glucose data into simple, easy-to-understand insights. It acts like a personal diabetes coach right in your pocket—helping you make smarter insulin decisions, avoid common mistakes, and build confidence in managing diabetes effectively. CGM Personal Trainer takes the guesswork out of bolusing by analyzing CGM data and identifying patterns in insulin delivery. <br /><br />
                    </td>
                </tr>
                <tr>
                    <td className="scoreboard" valign="top">
                    It highlights key events like late boluses, missed corrections, or early proactive dosing, all while rewarding you for healthy habits and smart decisions. Using a fun, gamified scoring system, it offers real-time feedback and actionable tips—turning diabetes management into an empowering experience rather than a stressful chore. Imagine earning points for keeping blood glucose within range and getting helpful nudges when things go off track—like having a diabetes-savvy friend who’s always there to guide you.<br /><br />
                    </td>
                </tr>
                <tr>
                    <td valign="top" className="scoreboard">
                    <div style={{"text-align": "center" }}>
                      <img src="/images/home4.webp" width={"80%"} style={{ alignContent: "center" }}></img>
                    </div><br />
                    With intuitive charts, a simple AM/PM view of your day, and personalized insights, CGM Personal Trainer offers that 20/20 hindsight we all wish we had—without the guilt trips. Whether you’re a parent helping your child navigate diabetes or an adult managing it yourself, the app gives you the tools to better understand how food, insulin, and daily decisions impact blood sugar trends. It’s not just about data; it’s about feeling supported, making informed choices, and celebrating small wins along the way. CGM Personal Trainer helps turn everyday learning into long-term success.<br />
                    <br /><br /><a href='/Disclaimer' style={{fontWeight:"bolder",fontSize:20}}>CLICK HERE TO START</a><br /><br /><br /><br />
                    </td>
                </tr>
                
                </tbody>
            </table>
        
    </CardContent>
  </Card>
);

export default App;

                        
                        

                        