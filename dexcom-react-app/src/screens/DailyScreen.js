import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Line } from "react-chartjs-2";
import Scoreboard from "./Scoreboard"; // Adjust the path if needed

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  annotationPlugin
);

const DailyScreen = () => {
  const [selectedDate, setSelectedDate] = useState(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
  );
  const [cgmData, setCgmData] = useState(new Array(96).fill(null));
  const [bolusData, setBolusData] = useState(new Array(96).fill(null));
  const [bolusDetails, setBolusDetails] = useState([]);
  const [scoreData, setScoreData] = useState({
    totalPoints: 55,
    pointsEarnedToday: 0,
    pointsDeductedToday: 0,
    negativeEvents: [],
    positiveEvents: 0,
  });
  const [firstBGValue, setFirstBGValue] = useState(25);
  const [bgSpikes, setBgSpikes] = useState([]);
  const [spikeAnnotations, setSpikeAnnotations] = useState([]);
  const [dailyScore, setDailyScore] = useState(null);

  useEffect(() => {
    fetchData(selectedDate);
  }, [selectedDate]);

useEffect(() => {
  fetchDailyScores(selectedDate).then((data) => {
    if (data) {
      setDailyScore(data);
    }
  });
}, [selectedDate]);

  const fetchData = (date) => {
    Promise.all([
        fetch(`http://localhost:3000/api/cgm?date=${date}`).then((res) => res.json()),
        fetch(`http://localhost:3000/api/bolus?date=${date}`).then((res) => res.json())
    ])
    .then(([cgmResponse, bolusResponse]) => {
        // ✅ Process CGM Data
        const formattedCgmData = new Array(96).fill(null);
        cgmResponse.forEach(entry => {
            const timestamp = new Date(Date.parse(entry["Timestamp"]));
            const index = timestamp.getHours() * 4 + Math.floor(timestamp.getMinutes() / 15);
            if (index >= 0 && index < 96) {
                formattedCgmData[index] = entry["CGM Value"];
            }
        });

        // ✅ Process Bolus Data
        const formattedBolusData = new Array(96).fill(null);
        bolusResponse.forEach(entry => {
            const timestamp = new Date(Date.parse(entry["Timestamp"]));
            const index = timestamp.getHours() * 4 + Math.floor(timestamp.getMinutes() / 15);
            if (index >= 0 && index < 96) {
                formattedBolusData[index] = entry["Insulin Delivered"];
            }
        });

        // ✅ Now BOTH datasets are available before calling detectBgSpikes()
        setCgmData([...formattedCgmData]);
        setBolusData([...formattedBolusData]);
        detectBgSpikes(formattedCgmData, formattedBolusData);
        //detectLateBolus(formattedCgmData, formattedBolusData, spikeTimes);
        //detectEarlyBolus(formattedCgmData, bolusData, spikeTimes);
        //detectExpectedBolus(data, bolusData, spikeTimes);
        //detectDoubleBolus(bolusData);
        setSpikeAnnotations(annotations);
        eventMessages.time.sort((a, b) => a.time - b.time);
        
    })
    .catch(error => console.error("Error fetching data:", error));
};


const fetchDailyScores = async (date) => {
  try {
    const response = await fetch(`http://localhost:3000/api/scores/1?date=${date}`);
    if (!response.ok) {
      throw new Error("Failed to fetch daily scores.");
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching daily scores:", error);
    return null;
  }
};


let events = [];
let spikes = [];

let lastLateBolusIndex = -6;
let lastEarlyBolusIndex = -6;
let newExpectedBolusBars = []; // Temporary array to hold bars before setting state

const [earlyBolusIndexes, setEarlyBolusIndexes] = useState({});
const [supplementalBolusIndexes, setSupplementalBolusIndexes] = useState({});
const [lateBolusIndexes, setLateBolusIndexes] = useState({});
const [expectedBolusIndexes, setExpectedBolusIndexes] = useState({});
const [doubleBolusIndexes, setDoubleBolusIndexes] = useState({});
const [eventMessages, setEventMessages] = useState([]);
const [expectedBolusBars, setExpectedBolusBars] = useState([]);


let spikeStart = null;
let lastNoBolusIndex = -6;
let spikeEnd = null;
let annotations = [];
let spikeTimes = [];


useEffect(() => {
  setEarlyBolusIndexes(prevIndexes => ({ ...prevIndexes }));
  setLateBolusIndexes(prevIndexes => ({ ...prevIndexes }));
  setDoubleBolusIndexes(prevIndexes => ({ ...prevIndexes }));
  setExpectedBolusBars([...newExpectedBolusBars]);
}, []);  // ✅ FIX: Empty dependency array to run only once on mount



const detectBgSpikes = (data, bolusData) => {
  clearEvents(); // Clear previous events before detecting new ones
  let lastSpikeIndex = -6;
  let inSpike = false;
  let spikeAnnotations = [];

  for (let i = 0; i < data.length - numIntervalsForSpikeX; i++) {
      if (data[i] !== null) {
          let spikeDetected = checkForBGSpike(data, i);

          if (spikeDetected && (i - lastSpikeIndex >= numIntervalsForSpikeX)) {
              let { formatted, militaryTime } = formatTime(i);
              addEvent(militaryTime, `${formatted} - BG/Carb Increase. Spike detected.`, 'classYellowBold');
              
              lastSpikeIndex = i;
              let troughStart = findTroughStart(data, i);
              let peakEnd = findPeakEnd(data, i);

              spikeAnnotations.push({ xMin: troughStart, xMax: peakEnd });
              spikeTimes.push(troughStart); // Store spike start time

              if (!inSpike) {
                  spikeStart = troughStart;
                  inSpike = true;
              }
          }

          if (inSpike && (!spikeDetected || i === data.length - 10)) {
              spikeEnd = i;
              annotations.push({
                  type: "box",
                  xMin: spikeStart,
                  xMax: spikeEnd,
                  backgroundColor: "rgba(255, 255, 0, 0.2)",
                  borderWidth: 0,
                  drawTime: "beforeDatasetsDraw",
              });
              inSpike = false;
          }
      }
  }

  detectLateBolus(data, bolusData, spikeTimes);
  detectEarlyBolus(data, bolusData, spikeTimes);

    detectExpectedBolus(data, bolusData);

  
  detectSupplementalBolus(bolusData);

};

/**
* **Helper Functions**
*/

// ✅ Helper Function: Get BG Value at a Specific Interval
const getBgValueAtInterval = (data, i, interval) => {
  return data[i + interval] !== null ? data[i + interval] : null;
};

// ✅ Helper Function: Calculate BG Increase Over Time
const calculateBgIncrease = (initialValue, newValue) => {
  return newValue !== null ? newValue - initialValue : 0;
};




let numIntervalsForSpikeX = 8; // 120 minutes (assuming 15-minute intervals)
let numIntervalsForSpikeY = 4;  // 60 minutes (assuming 15-minute intervals)
let spikeXIncreaseThreshold = 85;
let spikeYIncreaseThreshold = 45;
const checkForBGSpike = (data, i) => {  // ✅ Main Function: Check If a Spike Occurs
  let newBgValueXminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeX); // ✅ Get BG value X min ahead
  let newBgValueYminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeY); // ✅ Get BG value Y min ahead

  let bgIncreaseOverXmin = calculateBgIncrease(data[i], newBgValueXminAhead); // ✅ Compute BG increase over X min
  let bgIncreaseOverYmin = calculateBgIncrease(data[i], newBgValueYminAhead); // ✅ Compute BG increase over Y min

  // ✅ Returns TRUE if BG increases meet the threshold & new values are high
  return (bgIncreaseOverXmin >= spikeXIncreaseThreshold || bgIncreaseOverYmin >= spikeYIncreaseThreshold) && (newBgValueXminAhead > 205 || newBgValueYminAhead > 220);
};



// ✅ Finds lowest point before a spike (Trough)
const findTroughStart = (data, i) => {
  let troughStart = i;
  while (troughStart > 0 && data[troughStart - 1] <= data[troughStart]) {
      troughStart--;
  }
  return troughStart;
};

// ✅ Finds highest point after a spike (Peak)
const findPeakEnd = (data, i) => {
  let peakEnd = i;
  while (peakEnd < data.length - 1 && data[peakEnd + 1] >= data[peakEnd]) {
      peakEnd++;
  }
  return peakEnd;
};

const detectLateBolus = (data, bolusData, spikeTimes) => {
  let newLateBolusIndexes = { ...lateBolusIndexes }; // Copy existing late bolus indexes

  for (let i = 0; i < bolusData.length; i++) {
      
      // ✅ Ensure at least 10 minutes since last detected bolus
      if (bolusData[i] !== null && (i - lastLateBolusIndex >= 10)) { 
          
        // ✅ Check if bolus falls within 195 min after a spike
          let spikeStart = spikeTimes.find(spike => i - spike > 0 && i - spike <= 13); 

          if (spikeStart !== undefined) { // ✅ If valid spike found
              let { formatted: lateBolusFormatted, militaryTime: lateBolusMilitary } = formatTime(i);
              
              // ✅ Add event for late bolus
              addEvent(lateBolusMilitary, `${lateBolusFormatted} - Late bolus detected!`, 'classRedBold');

              // ✅ Store this bolus in the state to prevent duplicates
              newLateBolusIndexes[i] = lateBolusFormatted;
              lastLateBolusIndex = i; // ✅ Update last bolus index
          }
      }
  }
  setLateBolusIndexes(newLateBolusIndexes); // ✅ Update state with detected late boluses
};

const detectEarlyBolus = (data, bolusData, spikeTimes) => {
  let updatedIndexes = { ...earlyBolusIndexes }; // Copy existing early bolus indexes

  for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null && (i - lastEarlyBolusIndex >= 8)) { // ✅ Ensure at least 8 minutes since last early bolus
          let spikeStart = spikeTimes.find(spike => (spike - i >= 1 && spike - i <= 5)); // ✅ Check if bolus was 5-25 min before spike

          if (spikeStart !== undefined) { // ✅ If valid early bolus found
              let { formatted: earlyBolusFormatted, militaryTime: earlyBolusMilitary } = formatTime(i);

              // ✅ Add event for early bolus
              addEvent(earlyBolusMilitary, `${earlyBolusFormatted} - Early bolus detected. Good Job!`, 'classGreenBold');

              // ✅ Store this bolus in the state to prevent duplicates
              updatedIndexes[i] = earlyBolusFormatted;
              lastEarlyBolusIndex = i; // ✅ Update last early bolus index
          }
      }
  }
  setEarlyBolusIndexes(updatedIndexes); // ✅ Update state with detected early boluses
};

const detectExpectedBolus = (data, bolusData) => {
  let highBgStart = null;
  

  for (let i = 0; i < data.length; i++) {
      if (data[i] !== null && data[i] > 200) { 
          if (highBgStart === null) {
              highBgStart = i; 
          }

          if (i - highBgStart >= 6) {  
              let noBolusDetected = !bolusData.slice(highBgStart, i).some(bolus => bolus !== null);

              if (noBolusDetected) { 
                  let expectedBolusStart = highBgStart;
                  let expectedBolusEnd = i;

                  while (
                      expectedBolusEnd < data.length &&
                      data[expectedBolusEnd] !== null &&
                      data[expectedBolusEnd] > 200 &&
                      bolusData[expectedBolusEnd] === null
                  ) {
                      expectedBolusEnd++;
                  }

                  let expectedBolusCenter = Math.floor((expectedBolusStart + expectedBolusEnd) / 2);

                  let { formatted: expectedBolusFormatted, militaryTime: expectedBolusMilitary } = formatTime(expectedBolusCenter);

                  addEvent(
                    expectedBolusMilitary,
                    `${expectedBolusFormatted} - Expected bolus (BG > 200 for 120 min).`,
                    'classOrangeBold',
                  ' Expected Bolus Details Content'
                  );

                  // ✅ Store expected bolus bar data
                  newExpectedBolusBars.push({
                      index: expectedBolusCenter,
                      value: 0.5, // Adjust height as needed
                      backgroundColor: "rgba(255, 165, 0, 0.8)",
                  });
              }
              highBgStart = null;
          }
      } else {
          highBgStart = null;
      }
  }

  // ✅ Update state with detected bars
  setExpectedBolusBars(newExpectedBolusBars);
};




const detectSupplementalBolus = (bolusData) => {
  let newSupplementalBolusIndexes = { ...supplementalBolusIndexes }; // Copy existing

  for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null) {
          // ✅ If bolus is NOT classified as Early, Late, or Expected
          if (
              !earlyBolusIndexes.hasOwnProperty(i) &&
              !lateBolusIndexes.hasOwnProperty(i) &&
              !expectedBolusIndexes.hasOwnProperty(i)
          ) {
              let { formatted: supplementalBolusFormatted, militaryTime: supplementalBolusMilitary } = formatTime(i);
              
              // ✅ Store in event list and highlight in UI
              addEvent(supplementalBolusFormatted, `${supplementalBolusFormatted} - Supplemental Bolus detected.`);
              newSupplementalBolusIndexes[i] = supplementalBolusFormatted;
          }
      }
  }
  setSupplementalBolusIndexes(newSupplementalBolusIndexes);
};



const addEvent = (time, description, className, details) => {
  setEventMessages(prevEvents => {
      // Prevent duplicate events
      if (!prevEvents.some(event => event.time === time && event.description === description)) {
          return [...prevEvents, { time, description, className, details }];
      }
      return prevEvents; // Return existing events if duplicate is found
  });
};


const removeEvent = (time) => {
  setEventMessages(prevEvents => prevEvents.filter(event => event.time !== time));
};

const clearEvents = () => {
  setEventMessages([]);
};





const formatTime = (index) => {
  let hours = Math.floor(index / 4);
  let minutes = (index % 4) * 15;
  let period = hours >= 12 ? "p.m." : "a.m.";
  let adjustedHours = hours % 12 || 12; // Convert 0 to 12-hour format
  let totalMinutes = (hours % 24) * 60 + minutes; // Military time for sorting

  return {
      formatted: `${adjustedHours}:${minutes.toString().padStart(2, "0")} ${period}`,
      militaryTime: totalMinutes
  };
};


// 📊 Add Chart Annotations (Yellow for Spike, Orange for No Bolus)
const addChartAnnotations = (start, end, bolusData) => {
  let annotations = [];

  // Add Yellow Region (BG Spike)
  annotations.push({
      type: "box",
      xMin: start + 1, // Start slightly after spike detection
      xMax: end,
      backgroundColor: "rgba(255, 255, 0, 0.2)", // Yellow for BG spike
      borderWidth: 0,
      drawTime: "beforeDatasetsDraw",
  });

  // Add Orange Region (No Bolus Detected)
  let noBolus = !bolusData.slice(start, end).some(bolus => bolus !== null);
  if (noBolus) {
      annotations.push({
          type: "box",
          xMin: end,
          xMax: Math.min(end + 2, bolusData.length - 1), // 30 minutes
          backgroundColor: "rgba(255, 165, 0, 0.3)", // Orange for no bolus
          borderWidth: 0,
          drawTime: "beforeDatasetsDraw",
      });
  }

  return annotations;
};



const updateDate = (days) => {
  const newDate = new Date(selectedDate);
  newDate.setDate(newDate.getDate() + days);
  setSelectedDate(newDate.toISOString().split("T")[0]);

  // ✅ Clear existing events before fetching new data
  clearEvents();  

  // Reset the accordion
  setExpandedIndex(null);
  
  // ✅ Fetch new data and detect events
  fetchData(newDate.toISOString().split("T")[0]);

};


  const chartData = {
    labels: Array.from({ length: 96 }, (_, i) =>
      `${Math.floor(i / 4)}:${((i % 4) * 15).toString().padStart(2, "0")}`
    ),
    datasets: [
      {
        label: "CGM Glucose Levels",
        data: cgmData,
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(187, 255, 255, 0.2)",
        pointRadius: 4,
        pointBackgroundColor: "rgb(203, 245, 245)",
        fill: true,
      },
      {
        label: "Bolus Insulin Delivered",
        data: bolusData,
        type: "bar",
        backgroundColor: (context) => getBolusBarColor(context),
        borderColor:  (context) => getBolusBarColor(context),
        borderWidth: 1,
        barPercentage: 2.1,
        categoryPercentage: 1.0,
        yAxisID: "y2",
    },
    {
      label: "Expected Bolus",
      data: new Array(96).fill(null).map((_, i) =>
          expectedBolusBars.some(bar => bar.index === i) ? 0.5 : null
      ), 
      type: "bar",
      backgroundColor: "rgba(255, 165, 0, 0.8)", // Orange for expected bolus
      borderWidth: 0,
      yAxisID: "y2",
      barPercentage: 5, 
      categoryPercentage: 1.2,
  },
    ],
  };





  const updateTooltipForBolus = (tooltipItem) => {
    const index = tooltipItem.dataIndex;
    const dataset = tooltipItem.dataset.label;

    if (dataset === "Bolus Insulin Delivered") {
        let tooltipMessages = [];
        
        if (doubleBolusIndexes.hasOwnProperty(index)) {
            tooltipMessages.push(`Additional Bolus Detected at ${doubleBolusIndexes[index]}`);
        } else if (lateBolusIndexes.hasOwnProperty(index)) {
            tooltipMessages.push(`Late Bolus Detected at ${lateBolusIndexes[index]}`);
        } else if (earlyBolusIndexes.hasOwnProperty(index)) {
            tooltipMessages.push(`Early Bolus Detected at ${earlyBolusIndexes[index]}`);
        }
        else if (supplementalBolusIndexes.hasOwnProperty(index)) {
          tooltipMessages.push(`Supplemental Bolus Detected at ${supplementalBolusIndexes[index]}`);
      }
        
        return tooltipMessages.length > 0 ? tooltipMessages.join("\n") : tooltipItem.formattedValue;

    }

      // ✅ Add tooltip for "Expected Bolus"
    if (dataset === "Expected Bolus") {
          return "Bolus Expected: No bolus was detected in the expected range. (BG > 200 for 120 min)";
    }

    return tooltipItem.formattedValue;

};

const getBolusBarColor = (context) => {
  const index = context.dataIndex;
  if (doubleBolusIndexes.hasOwnProperty(index)) {
      return "rgba(255, 215, 0, 0.8)"; // 🟡 Yellow for Additional Bolus
  }
  if (lateBolusIndexes.hasOwnProperty(index)) {
      return "rgba(255, 0, 0, 0.8)"; // 🔴 Red for Late Bolus
  }
  if (earlyBolusIndexes.hasOwnProperty(index) || supplementalBolusIndexes.hasOwnProperty(index)) {
      return "rgba(75, 192, 75, 0.8)"; // 🟢 Green for Early & Supplemental Bolus
  }
  return "rgba(255, 99, 132, 0.8)"; // Default color
};



  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: { min: 0, max: 420 },
        y2: { min: 0, max: 10, position: "right", grid: { drawOnChartArea: false } },
        x: { ticks: { autoSkip: true, maxTicksLimit: 12 } },
    },
    plugins: {
        tooltip: {
            callbacks: {
                label: updateTooltipForBolus
            }
        },
        annotation: {
            annotations: [{
                type: "box",
                yMin: 80,
                yMax: 150,
                backgroundColor: "rgba(144, 238, 144, 0.2)", // Light green
                borderWidth: 0,
                drawTime: "beforeDatasetsDraw",
            },
            ...spikeAnnotations],
        },
    }
};


  const DailyScreen = () => {  };
  const [expandedIndex, setExpandedIndex] = useState(null);
  const toggleAccordion = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  return (
    <div className="dailyChartHead">
      <Card>
        <CardContent>
          <h2 className="text-xl font-semibold">Daily Blood Glucose Data</h2>
          <div align="center">
            <Button onClick={() => updateDate(-1)}>← Back</Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border p-2 rounded"
            />
            <Button onClick={() => updateDate(1)}>Next →</Button>
          </div>
          <div style={{ height: "400px", width: "99%" }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          <Scoreboard dailyScore={dailyScore} />
          

          {eventMessages.length > 0 ? (
            <table>
              <tbody>
                {eventMessages
                  .slice()
                  .sort((a, b) => a.time - b.time) // Ensure chronological order
                  .map((event, index) => (
                    <React.Fragment key={index}>
                      <tr>
                        <td className={event.className}>
                          {event.description}
                          <br />
                          <a
                            onClick={() => toggleAccordion(index)}
                            style={{
                              cursor: "pointer",
                              color: "blue",
                              textDecoration: "underline",
                            }}
                          >
                            Learn More
                          </a>
                          {expandedIndex === index && (
                            <div
                              className="accordion-content"
                              style={{
                                marginTop: "5px",
                                padding: "10px",
                                backgroundColor: "#f1f1f1",
                                borderRadius: "5px",
                                border: "1px solid #ccc",
                              }}
                            >
                              <p>
                                {event.details ||
                                  "Additional details about this event will appear here."}
                              </p>
                            </div>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
              </tbody>
            </table>
          ) : (
            <p>No significant events detected today.</p>
          )}

        </CardContent>
      </Card>
    </div>
  );
};

export default DailyScreen;
