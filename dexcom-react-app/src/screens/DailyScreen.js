import React, { useState, useEffect } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Bar, Line } from "react-chartjs-2";
import Scoreboard from "./Scoreboard"; // Adjust the path if needed
//import Chart from 'chart.js/auto';
import dayjs from "dayjs";

import {
  Chart as ChartJS,
  CategoryScale,
  BarController,
  LinearScale,
  PointElement,
  LineElement,
  TimeScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import "chartjs-adapter-date-fns";



ChartJS.register(
  TimeScale,
  BarController,
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
  const [majorEventsList,setMajorEvents] = useState([]);
  const [earlyBolusIndexes, setEarlyBolusIndexes] = useState({});
  const [supplementalBolusIndexes, setSupplementalBolusIndexes] = useState({});
  const [correctionBolusIndexes, setCorrectionBolusIndexes] = useState({});
  const [expectedBolusIndexes, setExpectedBolusIndexes] = useState({});
  const [expectedBolusBars, setExpectedBolusBars] = useState([]);
  const [selectedDate, setSelectedDate] = useState('2025-01-22');
  const [cgmData, setCgmData] = useState(new Array(96).fill(null));
  const [bolusData, setBolusData] = useState(new Array(96).fill(null));
  let [bolusDetails, setBolusDetails] = useState([]);
  const [scoreData, setScoreData] = useState({
    totalPoints: 55,
    pointsEarnedToday: 0,
    pointsDeductedToday: 0,
    negativeEvents: [],
    positiveEvents: 0,
  });

  const markedBolus = [];
  const [spikeAnnotations, setSpikeAnnotations] = useState([]);
  const [dailyScore, setDailyScore] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState("");
  const [showSpinner, setShowSpinner] = useState(false);


  const handleDailyAIClick = async () => {
    // Build a pipe-delimited string from majorEventsList.
    const pipeDelimited = majorEventsList
      .map((event) => event.join("|"))
      .join(" | ");
  
    try {
      // Show spinner before fetching data
      setShowSpinner(true); // Assuming you have a state for spinner: const [showSpinner, setShowSpinner] = useState(false);
  
      const response = await fetch(`https://api.flex-ai.com/ask-gpt?date=${selectedDate}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: pipeDelimited }),
      });
  
      if (!response.ok) {
        throw new Error("Failed to fetch AI summary");
      }
  
      // Open the modal and hide the spinner
      setShowModal(true);
      setModalContent(""); // Reset modal content
      setShowSpinner(false); 
  
      // Set up the reader and decoder for streaming
      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let content = "";
  
      // Loop through the stream and update the modal content
      while (!done) {
        const { value, done: doneReading } = await reader.read();
        done = doneReading;
        const chunk = decoder.decode(value || new Uint8Array());
        content += chunk;
  
        setModalContent(content);
      }
    } catch (error) {
      console.error(error);
      setModalContent("Error fetching summary.");
      setShowModal(true);
      setShowSpinner(false); // Hide spinner on error
    }
  };

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

let dataRequested = false;

  const fetchData = (date) => {
     console.log("fetching data");
    
    if (!dataRequested){
      dataRequested=true;
      Promise.all([
        fetch(`https://3tansqzb2f.execute-api.us-east-1.amazonaws.com/default/api/cgm?date=${date}`).then((res) => res.json()),
        fetch(`https://3tansqzb2f.execute-api.us-east-1.amazonaws.com/default/api/bolus?date=${date}`).then((res) => res.json())
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

        bolusResponse.forEach(entry => {
          const timestamp = new Date(Date.parse(entry["Timestamp"]));
          const index = timestamp.getHours() * 4 + Math.floor(timestamp.getMinutes() / 15);
          if (index >= 0 && index < 96) {
              //formattedBolusData[index] = entry["Insulin Delivered"];
              bolusDetails[index] = entry;
          }
      });
        

        // ✅ Now BOTH datasets are available before calling detectBgSpikes()
        setCgmData([...formattedCgmData]);
        setBolusData([...formattedBolusData]);
        detectBgSpikes(formattedCgmData);
        
        detectEarlyBolus(formattedCgmData, formattedBolusData, spikeTimes);
        detectCorrectionBolus(formattedCgmData, formattedBolusData, spikeTimes);
        
        detectExpectedBolus(formattedCgmData, formattedBolusData);
        detectSupplementalBolus(formattedBolusData);
        setMajorEvents(majorEventsList);
        
        majorEventsList.sort((a, b) => {
          return parseTime(a[1]) - parseTime(b[1]);
        });
        
        console.log(majorEventsList);
        
        
    })
    .catch(error => console.error("Error fetching data:", error));

    }
    
};

const fetchDailyScores = async (date) => {
  try {
    const response = await fetch(`https://3tansqzb2f.execute-api.us-east-1.amazonaws.com/default/api/scores/1?date=${date}`);
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
let lastCorrectionBolusIndex = -6;
let lastEarlyBolusIndex = -6;
let newExpectedBolusBars = []; // Temporary array to hold bars before setting state
let spikeStart = null;
let lastNoBolusIndex = -6;
let spikeEnd = null;
let annotations = [];
let spikeTimes = [];

useEffect(() => {
  setEarlyBolusIndexes(prevIndexes => ({ ...prevIndexes }));
  setCorrectionBolusIndexes(prevIndexes => ({ ...prevIndexes }));
  setSupplementalBolusIndexes(prevIndexes => ({ ...prevIndexes }));
  setExpectedBolusBars([...newExpectedBolusBars]);
}, []);  // ✅ FIX: Empty dependency array to run only once on mount

let numIntervalsForSpikeA = 5; // 120 minutes (assuming 15-minute intervals)
let spikeIncreaseThresholdA = 50;

let numIntervalsForSpikeB = 8;  // 60 minutes (assuming 15-minute intervals)
let spikeIncreaseThresholdB = 65;

  const checkForBGSpike = (data, i) => {  // ✅ Main Function: Check If a Spike Occurs
  let newBgValueXminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeA); // ✅ Get BG value X min ahead
  let newBgValueYminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeB); // ✅ Get BG value Y min ahead
  let bgIncreaseOverXmin = calcucorrectionBgIncrease(data[i], newBgValueXminAhead); // ✅ Compute BG increase over X min
  let bgIncreaseOverYmin = calcucorrectionBgIncrease(data[i], newBgValueYminAhead); // ✅ Compute BG increase over Y min

  // ✅ Returns TRUE if BG increases meet the threshold & new values are high
  if (
    bgIncreaseOverXmin >= spikeIncreaseThresholdA 
  //|| bgIncreaseOverYmin >= spikeIncreaseThresholdB
    ) 
    {
      //return true;
        if (newBgValueXminAhead > 200 
          || newBgValueYminAhead > 220
        ){
          return true;
        }
    }  
  return false;
};

 // ✅ Helper Function: Get BG Value at a Specific Interval
 const getBgValueAtInterval = (data, i, numIntervals) => {
  return data[i + numIntervals] !== null ? data[i + numIntervals] : null;
  };

  // ✅ Helper Function: Calcucorrection BG Increase Over Time
  const calcucorrectionBgIncrease = (initialValue, newValue) => {
  return newValue !== null ? newValue - initialValue : 0;
  };


  let spikeDetected = false;

const detectBgSpikes = (data) => {
    
    let lastSpikeIndex = -6;
    let inSpike = false;
    let spikeAnnotations = [];
    let troughStart = 0;
    let peakEnd = 0;

    for (let i = 0; i < data.length; i++) {
        if (data[i] !== null) {
          spikeDetected = checkForBGSpike(data, i);

            if (spikeDetected && (i - lastSpikeIndex >= 6)) {
              let { formatted, militaryTime } = formatTime(i);
              
              lastSpikeIndex = i;
              peakEnd = findPeakEnd(data, i);
              troughStart = findTroughStart(data, peakEnd);
              

              if (spikeTimes.indexOf(troughStart) < 0){
                spikeAnnotations.push({ xMin: troughStart, xMax: peakEnd });
                let spikePeakBG = getBgValueAtInterval(data,peakEnd,2);
                let spikeRange = spikePeakBG - getBgValueAtInterval(data,troughStart,0);
                spikeTimes.push([troughStart,spikePeakBG]); // Store spike start time
              }

              majorEventsList[majorEventsList.length] = [
                "Spike",   //Carb Increase (spike) detected
                ("🚀 " +  formatted),
                'This is normal after a meal or snack.',
                'classYellowBold',
                troughStart,
                " Carb Increase (spike) detected"
              ];

              if (!inSpike) {
                  spikeStart = troughStart;
                  inSpike = true;
              }
            }

            if (inSpike && (!spikeDetected || i === data.length - 10)) {
                spikeEnd = i;
                annotations.push({
                    type: "box",
                    xMin: troughStart,
                    xMax: peakEnd,
                    backgroundColor: "rgba(255, 255, 0, 0.2)",
                    borderWidth: 0,
                    drawTime: "beforeDatasetsDraw",
              });
              
              inSpike = false;
         }
      }
    }
    setSpikeAnnotations(annotations);
    
  };

  /**
  * **Helper Functions**
  */

// ✅ Finds lowest point before a spike (Trough)


const checkTroughNextPoint = (data,troughStart) => {

    if (data[troughStart - 1] - data[troughStart] <= -1) { return true; }
    if (data[troughStart - 2] <= data[troughStart]) { return true; }
    //if (data[troughStart-4] <= data[troughStart]) { return true; }

}
const findTroughStart = (data, i) => {
  let troughStart = i;
  while (troughStart > 0) {
    
    if (checkTroughNextPoint(data, troughStart)) {
      troughStart--;
    }
    else{
      break;
    }
     // && ((data[troughStart] - data[troughStart-4] >10))
      
    //{
    //  
    
      
  }
  return troughStart;
};

const findTroughStartOLD = (data, i) => {
  let troughStart = i;
  while (troughStart > 0) {
    
    if (
      (data[troughStart - 1] - data[troughStart] <= -1) 
      || (data[troughStart - 2] <= data[troughStart])
      || ((data[troughStart-4] <= data[troughStart]))
      && ((data[troughStart] - data[troughStart-4] >10))
      
    ){
      troughStart--;
    }
    else{
      break;
    }
      
  }
  return troughStart;
};

// ✅ Finds highest point after a spike (Peak)
const findPeakEnd = (data, i) => {
  let peakEnd = i;
  while (peakEnd < data.length) {
    if (
      (data[peakEnd + 2] >= (data[peakEnd])) 
      && (data[peakEnd + 4] >= (data[peakEnd])
      && (data[peakEnd]>200))
      || (data[peakEnd + 5] >= (data[peakEnd])
      || (data[peakEnd + 1] > data[peakEnd])
     )
      ) {   // || ((data[peakEnd + 3] >= (data[peakEnd])))
      
        peakEnd++;

        
      
    } 
    else{ 
      break;
    }


  }
  //spikeDetected = false
  return peakEnd;
};


function parseTime(timeStr) {
  // Use a regex to match a time in the format "9:30 a.m." (ignoring the emoji and extra spaces)
  const regex = /(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i;
  const match = timeStr.match(regex);
  
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3].toLowerCase();

    // Convert to 24-hour format:
    if (period === 'p' && hours < 12) hours += 12;
    if (period === 'a' && hours === 12) hours = 0;
    
    return hours * 60 + minutes; // minutes since midnight
  }
  return 0; // fallback if parsing fails
}


const getNearestSpikeTime = (data,i) => {
  let _absV = 0;
  let _finalV = 50;
  let _finalIndex = 1;
  //return spikeTimes.find(spike => i - spike[0] > 0 && i - spike[0] <= 8); 
  for (let j = 0; j < spikeTimes.length; j++) {
    _absV = Math.abs(spikeTimes[j][0]-i);
      if (_absV < _finalV){
        _finalV = _absV;
        _finalIndex = j;
      }
  }
  if (spikeTimes[_finalIndex-1]!=null){
    if (i - (spikeTimes[_finalIndex-1][0]) <7) {
      _finalIndex = _finalIndex-1;
    }
  }

  if (data[i]>250){
    return spikeTimes[_finalIndex-1];
  }

  if (_finalV > 10)
    return undefined;

  return spikeTimes[_finalIndex];
}



const detectCorrectionBolus = (data, bolusData, spikeTimes) => {
  let newCorrectionBolusIndexes = { ...correctionBolusIndexes }; // Copy existing correction bolus indexes

  for (let i = 0; i < bolusData.length; i++) {
      
      // ✅ Ensure at least 10 minutes since last detected bolus
      if (bolusData[i] !== null) { // && (i - lastCorrectionBolusIndex >= 10)
          if (markedBolus[i] == undefined){
            // ✅ Check if bolus falls within 195 min after a spike
          let spikeStart = getNearestSpikeTime(data,i);

          if (spikeStart !== undefined) { // ✅ If valid spike found
              if (spikeStart[0]<=i){
                let { formatted: correctionBolusFormatted, militaryTime: correctionBolusMilitary } = formatTime(i);
                
                let _correctionBolusMessage="Insulin Delivered: " + bolusDetails[i]["Insulin Delivered"] + " units\n";
                _correctionBolusMessage+="Blood Glucose Input: " + bolusDetails[i]["Blood Glucose Input"] + " mg/dl\n";
                _correctionBolusMessage+="Carbs Input: " + bolusDetails[i]["Carbs Input"] + " g\n";
                _correctionBolusMessage+="Carbs Ratio: " + bolusDetails[i]["Carbs Ratio"] + " g\nㅤ\n";
                _correctionBolusMessage += " ⚠️ Heads up! Administering your bolus after the ideal time can ";
                _correctionBolusMessage += "lead to higher post-meal blood sugar levels. Aim for a more timely dose with ";
                _correctionBolusMessage += "accurately estimated carbs to improve control.\n";
                
                if (spikeStart[1]>200){
                  _correctionBolusMessage+="\nㅤ\n 📊 Analysis:\nBG increased close to " + spikeStart[1] + ", even after the ";
                  _correctionBolusMessage+="bolus. You may have under-estimated the carbs for this meal, ";
                  _correctionBolusMessage+="or did not provide enough time for the bolus to kick-in before eating.";
                }
                // ✅ Store this bolus in the state to prevent duplicates
                newCorrectionBolusIndexes[i] = correctionBolusFormatted;
                lastCorrectionBolusIndex = i; // ✅ Update last bolus index
                
                majorEventsList[majorEventsList.length] = [
                  "correction",
                  (" 🕒 " +  correctionBolusFormatted),
                  _correctionBolusMessage,
                  'classRedBold',
                  i,
                  "Correction bolus detected"
                ];

                markedBolus[i] = 'Marked'

              }
            
          }
      
              
          }
      }
  }
  setCorrectionBolusIndexes(newCorrectionBolusIndexes); // ✅ Update state with detected correction boluses
};

const detectEarlyBolus = (data, bolusData, spikeTimes) => {
  let updatedIndexes = { ...earlyBolusIndexes }; // Copy existing early bolus indexes

  for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null) { // ✅ Ensure at least 8 minutes since last early bolus
          let spikeStart = getNearestSpikeTime(data,i); // ✅ Check if bolus was 5-25 min before spike
          let { formatted: earlyBolusFormatted, militaryTime: earlyBolusMilitary } = formatTime(i);
          let _earlyBolusMessage = "";
          if (spikeStart !== undefined) { // ✅ If valid early bolus found
            if (spikeStart[0]>=i-1){
              _earlyBolusMessage+="Insulin Delivered: " + bolusDetails[i]["Insulin Delivered"] + " units\n";
              _earlyBolusMessage+="Blood Glucose Input: " + bolusDetails[i]["Blood Glucose Input"] + " mg/dl\n";
              _earlyBolusMessage+="Carbs Input: " + bolusDetails[i]["Carbs Input"] + " g\n";
              _earlyBolusMessage+="Carbs Ratio: " + bolusDetails[i]["Carbs Ratio"] + " g\nㅤ\n";
              _earlyBolusMessage+= " ✅ Nice work! Being aware of upcoming meal intake and proactively providing a ";
              _earlyBolusMessage+="proportional bolus helps to keep the spikes down to a minimum.";

              if (spikeStart[1]>150){
                _earlyBolusMessage+="\nㅤ\n ⚠️ Analysis:\nBG increased close to " + spikeStart[1] + ", even after the ";
                _earlyBolusMessage+="bolus. It sounds like you may have under-estimated the amount of carbs for this meal, ";
                _earlyBolusMessage+="or did not provide enough time for the bolus to kick-in before eating.";
              }
              // ✅ Store this bolus in the state to prevent duplicates
              updatedIndexes[i] = ["🟢 Early Bolus Detected",earlyBolusFormatted];
              lastEarlyBolusIndex = i; // ✅ Update last early bolus index
              majorEventsList[majorEventsList.length] = [
                "early", 
                (" 🏆  " + earlyBolusFormatted),
                _earlyBolusMessage,
                'classGreenBold',
                i,
                "Proactive Bolus Detected"
              ];

              markedBolus[i] = 'Marked'

            }
              
              //✅   🕒
          }
      }
  }
  setEarlyBolusIndexes(updatedIndexes); // ✅ Update state with detected early boluses
};
let _openchatParams = '';
const detectExpectedBolus = (data,bolusData) => {
  let highBgStart = null;

  for (let i = 0; i < data.length; i++) {
      if (data[i] !== null && data[i] > 200) { 
          if (highBgStart === null) {
              highBgStart = i; 
          }

          if (i - highBgStart >= 10) {  
              let noBolusDetected = !bolusData.slice(highBgStart-5, i).some(bolus => bolus !== null);

              if (noBolusDetected) { 
                  let expectedBolusStart = highBgStart;
                  let expectedBolusEnd = i;

                  while (
                      expectedBolusEnd < data.length &&
                      data[expectedBolusEnd] !== null &&
                      data[expectedBolusEnd] > 200 
                      //&& bolusData[expectedBolusEnd] === null
                  ) { expectedBolusEnd++; }

                  let expectedBolusCenter = Math.floor((expectedBolusStart + expectedBolusEnd) / 2);

                  let { formatted: expectedBolusFormatted, militaryTime: expectedBolusMilitary } = formatTime(expectedBolusCenter);
                  let _expectedBolusMessage = "Attention! Missing your scheduled bolus might cause your blood sugar to spike, or cause you to remain at elevated glucose levels. "
                  _expectedBolusMessage += "Remember to dose on time for better overall management.";
                  
                  majorEventsList[majorEventsList.length] = [
                    "expected", 
                    (" ⚠️ " + expectedBolusFormatted),
                    _expectedBolusMessage,
                    'classOrangeBold',
                    i,
                    "Bolus Recommended"
                  ];

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
  console.log('detecting supplementals');
  for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null) {
          // ✅ If bolus is NOT classified as Early, Correction, or Expected
         

        let bolusDetected = bolusData.slice(i-3, i).some(bolus => bolus !== null);

        if (bolusDetected){
          let { formatted: supplementalBolusFormatted, militaryTime: supplementalBolusMilitary } = formatTime(i);
          
          let _supplementalBolusMessage="Insulin Delivered: " + bolusDetails[i]["Insulin Delivered"] + " units\n";
          _supplementalBolusMessage+="Blood Glucose Input: " + bolusDetails[i]["Blood Glucose Input"] + " mg/dl\n";
          _supplementalBolusMessage+="Carbs Input: " + bolusDetails[i]["Carbs Input"] + " g\n";
          _supplementalBolusMessage+="Carbs Ratio: " + bolusDetails[i]["Carbs Ratio"] + " g\nㅤ\n";
           _supplementalBolusMessage += "It's important to work toward your target range ";
          
          _supplementalBolusMessage += "but be careful not to take your doses too close together.";
          
          _supplementalBolusMessage += "\nㅤ\n ⚠️ Analysis:\nInsulin stacking occurs when multiple doses of insulin are taken ";
          _supplementalBolusMessage += "too close together before the previous dose has fully acted, leading to an increased risk ";
          _supplementalBolusMessage += "of hypoglycemia (low blood sugar). This typically happens with bolus (mealtime) ";
          _supplementalBolusMessage += "insulin when someone takes additional correction doses before their ";
          _supplementalBolusMessage += "prior dose has peaked or fully lowered blood glucose.";

          for (let k = 0; k < majorEventsList.length; k++) {
            if (majorEventsList[k][4] == i){

              majorEventsList[k] = [
                "supplemental", 
                (" ⚠️ " + supplementalBolusFormatted),
                _supplementalBolusMessage,
                'classOrangeBold',
                i,
                "Extra Bolus Detected"
              ];
            }
          }

          newSupplementalBolusIndexes[i] = supplementalBolusFormatted;
        }
      
      }
  }
  setSupplementalBolusIndexes(newSupplementalBolusIndexes);
setMajorEvents(majorEventsList);

  for (let i = 0; i < majorEventsList.length; i++) {
   _openchatParams += majorEventsList[i][0] + "|" + majorEventsList[i][1] + "|" + majorEventsList[i][2].replace(/\n/g, '') + "|" + majorEventsList[i][5] + " *END LINE* ";
  }
  console.log(_openchatParams);
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
const addChartAnnotations = (start, end) => {
  let annotations = [];

  // Add Yellow Region (BG Spike)
  annotations.push({
      type: "box",
      xMin: start, // Start slightly after spike detection
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
  setMajorEvents([]); 

  // Reset the accordion
  setExpandedIndex(null);

};


const getBgPointColor = (context) => {
  const index = context.dataIndex;
  
  // ✅ Check if the index falls within any spike range
  for (let spike of spikeAnnotations) {
      if (index >= spike.xMin && index <= spike.xMax) {
          return "rgb(255, 227, 227)"; // 🔴 Red for BG points within spike range
      }
  }
  //"rgb(203, 245, 245)"
  return "rgb(75, 192, 192)"; // Default color for BG points
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
        backgroundColor: "rgba(173, 170, 190, 0.2)",
        pointRadius: 4,
        pointBackgroundColor: (context) => getBgPointColor(context), // ✅ Apply dynamic color function
            fill: true,
      },
      {
        label: "Bolus Insulin Delivered",
        data: bolusData,
        type: "bar",
        backgroundColor: (context) => getBolusBarColor(context),
        borderColor:  (context) => getBolusBarColor(context),
        borderWidth: 1,
        barPercentage: 5.1,
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
   
      //if (correctionBolusIndexes.hasOwnProperty(index)) {

        for (let n = 0; n < majorEventsList.length; n++) {
          if ((majorEventsList[n][4] == index) && (majorEventsList[n][0].indexOf("Spike") < 0)){
            tooltipMessages.push(`${majorEventsList[n][2]}`);
            return tooltipMessages.length > 0 ? tooltipMessages.join("\n") : tooltipItem.formattedValue;
          }
        }
        
      //} 
      
      //if (earlyBolusIndexes.hasOwnProperty(index)) {
        
        for (let n = 0; n < majorEventsList.length; n++) {
          if ((majorEventsList[n][4] == index) && (majorEventsList[n][0] == "early")){
            tooltipMessages.push(`${majorEventsList[n][2]}`);
            return tooltipMessages.length > 0 ? tooltipMessages.join("\n") : tooltipItem.formattedValue;
          }
        }

        
        //else
          // tooltipMessages.push(`Bolus Detected....`);
      //}
      
      //if (supplementalBolusIndexes.hasOwnProperty(index)) {

        for (let n = 0; n < majorEventsList.length; n++) {
          if ((majorEventsList[n][4] == index) && (majorEventsList[n][0] == "supplemental")){
            tooltipMessages.push(`${majorEventsList[n][2]}`);
            return tooltipMessages.length > 0 ? tooltipMessages.join("\n") : tooltipItem.formattedValue;
          }
        }

        //tooltipMessages.push(`Supplemental Bolus Detected at ${supplementalBolusIndexes[index]}`);
      //}
      
      

    }

      // ✅ Add tooltip for "Expected Bolus"
    if (dataset === "Expected Bolus") {
          return "Bolus Expected: No bolus was detected in the expected range. (BG > 200 for 120 min)";
    }

    return tooltipItem.formattedValue;

};

const getBolusBarColor = (context) => {
  const index = context.dataIndex;

  for (let n = 0; n < majorEventsList.length; n++) {
    if ((majorEventsList[n][4] === index) && (majorEventsList[n][0] == "correction")){
      return "rgba(255, 0, 0, 0.8)"; // 🔴 Red for Correction Bolus
    }
  }

  for (let n = 0; n < majorEventsList.length; n++) {
    if ((majorEventsList[n][4] === index) && (majorEventsList[n][0] == "early")){
      return "rgba(29, 114, 0, 0.8)"; // 🟢 Green for Early & Supplemental Bolus
    }
  }

  for (let n = 0; n < majorEventsList.length; n++) {
    if ((majorEventsList[n][4] === index) && (majorEventsList[n][0] == "supplemental")){
      return "rgba(255, 168, 27, 0.8)"; // 🔴 Red for Correction Bolus
    }
  }

  return "rgba(99, 239, 255, 0.8)"; // Default color
};

let _xAxisValIterator = 0;
let _xAxisVal = '';
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
  
    scales: {
        y: { min: 0, max: 420 },
        y2: { min: 0, max: 10, position: "right", grid: { drawOnChartArea: false } },
        //{ ticks: { autoSkip: true, maxTicksLimit: 12 } },
        x: { ticks: {maxTicksLimit: 13,callback: function (value, index, values) {

          _xAxisVal = dayjs(value).format("h A");
          _xAxisValIterator = _xAxisValIterator+1;

          if ((value >= 0) && (value <= 4)) {  return "12 AM";  }
          if ((value >= 5) && (value <= 14)) {  return "2 AM";  }
          if ((value >= 14) && (value <= 21)) {  return "4 AM";  }
          if ((value >= 21) && (value <= 28)) {  return "6 AM";  }
          if ((value >= 28) && (value <= 35)) {  return "8 AM";  }
          if ((value >= 35) && (value <= 42)) {  return "10 AM";  }
          if ((value >= 42) && (value <= 49)) {  return "12 PM";  }
          if ((value >= 49) && (value <= 56)) {  return "2 PM";  }
          if ((value >= 56) && (value <= 64)) {  return "4 PM";  }
          if ((value >= 64) && (value <= 72)) {  return "6 PM";  }
          if ((value >= 72) && (value <= 80)) {  return "8 PM";  }
          if ((value >= 80) && (value <= 88)) {  return "10 PM";  }

          //_xAxisVal = _xAxisVal.repl

          return _xAxisVal; // ✅ Formats to AM/PM
        },},
        },
    },
    plugins: {
        tooltip: {
            callbacks: {
                title: (tooltipItems) => {
                  let _thisIndex = tooltipItems[0].dataIndex;
                  for (let n = 0; n < majorEventsList.length; n++) {
                    if ((majorEventsList[n][4] == _thisIndex) && (majorEventsList[n][0].indexOf("Spike") < 0)){
                        return `${majorEventsList[n][1]} ${majorEventsList[n][5]}`; // Change the title
                      
                      //tooltipMessages.push(`${majorEventsList[n][2]}`);
                      break;
                    }
                  }
                  
                  return tooltipItems[0].label;
                },
                label: (tooltipItem) => {
                    let label = updateTooltipForBolus(tooltipItem);
                    return label.match(/(.{1,45})(\s|$)/g, "$1\n"); // Wrap text every 30 characters
                    //return label.match(/.{1,60}/g);
                }
            },
            backgroundColor: "rgba(106, 122, 106, 0.95)",
            displayColors: false, // Hide color boxes to save space
            enabled: true,
            usePointStyle: true,
            bodyFont: { size: 15, weight: "normal" },  // Adjust font style
            titleFont: { size: 16, weight: "bold" }, 
            useHTML: 1,
            maxWidth:"100%",
            bodySpacing: 1, // Increase spacing between lines
            yAlign: "top", // Prevents tooltip from going off-screen
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


 
  const [expandedIndex, setExpandedIndex] = useState(null);
  const toggleAccordion = (index) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };
  const eventDescription = `Correction bolus detected!\nAdditional information here.`;
  const htmlDescription = eventDescription.replace(/\n/g, '<br />');

  return (
    <div className="dailyChartHead" align="center">
      <Card>
        <CardContent>
          
          
          <table border={0} cellPadding={1} style={{ paddingTop:0, width:"1px" }}>
          <tbody>
            <tr>
                <td className="btnDateSelect">
                  <img style={{ paddingTop:10 }} onClick={() => updateDate(-1)} src="images/back.jpg" width={90}></img>
                </td>
                <td width={1}>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="dateSelect"
                  />
                </td>
                <td>
                  <img style={{ paddingTop:10 }} onClick={() => updateDate(1)} src="images/next.jpg" width={90}></img>
                </td>
            </tr>
            <tr>
              <td colSpan={3} align="center">
                <div className="text-xl font-semibold">
                  Daily Blood Glucose Data< br />
                </div>
              </td>
            </tr>
            </tbody>
          </table>
          
          
          <div style={{ height: "350px", width: "95%" }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          
          {majorEventsList.length > 0 ? (
            <table border={0} height={1} cellPadding={0} cellSpacing={0} className="events_table">
              <tbody>
                <tr>
                  <td align="center">
                      <div className="text-xl font-semibold">
                      <div style={{padding:10,paddingBottom:25,  }}>
                        <Button style={{ fontSize:20,  width:"95%",fontWeight:"bolder" }} 
                          onClick={handleDailyAIClick}>Daily AI Summary
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>
            
                
                {majorEventsList
                    .slice()
                    .sort((a, b) => a.time - b.time) // Ensure chronological order
                    .map((msg, index) =>  (
                      
                      
                    <React.Fragment key={index}>

                      

                      <tr>
                      
                        <td className="button-container">
                          
                         
                            

                                <button className={`gradient-btn btn${majorEventsList[index][0]}`} 
                                onClick={() => toggleAccordion(index)} style={{ cursor: "pointer"  }}>
                                      <div className="button-header">
                                        {msg[1]} - {msg[5]}
                                      </div>
                                  
                                      {expandedIndex === index && (
                                          <table border={0} height={1} cellPadding={0} cellSpacing={0} >
                                          <tbody>
                                            <tr>
                                              <td className="button-container">
                                                <div className="events_detail accordion-content " 
                                                  dangerouslySetInnerHTML={{ __html: msg[2].replace(/\n/g, '<br />') }}>
                                                </div>
                                            </td>
                                          </tr>
                                          </tbody>
                                        </table>
                                              )}
                                      
                                  </button>                    
                                  
                                  
                             
                          
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

      <br /><br /><br /><br />
    
        {showSpinner && (
          <div className="spinner-container">
            <div className="spinner"></div>
            <p>Loading AI Summary...</p>
          </div>
        )}


       {/* NEW: Modal Popup */}
       {showModal && (
          <div
            style={{
              position: "fixed",
              top: 60,
              left: 20,
              right: 20,
              bottom: 0,
              height:600,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              borderRadius: "4px",
              // Disable background scrolling by preventing pointer events on the underlying content
              overflow: "hidden",
            }}
          >
            <div
              style={{
                backgroundColor: "#fff",
                padding: "20px",
                borderRadius: "4px",
                maxWidth: "87vw",
                maxHeight: "90vh", // Use viewport units for height
                overflowY: "auto", // Enable vertical scrolling for modal content
                textAlign: "left",
                height: 550,
              }}
            >
              <button
                onClick={() => {
                  setShowModal(false);
                  document.body.style.overflow = ""; // Re-enable background scrolling
                }}
                style={{
                  position: "absolute",
                  top: "20px",
                  right: "25px",
                  background: "none",
                  border: "none",
                  fontSize: "18px",
                  fontWeight:"bolder",
                  cursor: "pointer",
                }}
              >
                X
              </button>
              <div className="ai_table" dangerouslySetInnerHTML={{ __html: modalContent.replaceAll("</li>","\n<br />\n</li>") }} ></div>
              <div className="ai_disclaimer" >*AI summary is only an analysis of your day's events. Always consult with your endocrinoligist before making any changes to your dosage/timing.</div>
            </div>
          </div>
        )}
    </div>
  );
};

export default DailyScreen;

