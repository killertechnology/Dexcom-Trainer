import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Bar, Line } from "react-chartjs-2";
import Scoreboard from "./Scoreboard"; // Adjust the path if needed
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
  // ---------------- State Definitions ----------------
  const [majorEventsList, setMajorEvents] = useState([]);
  const [earlyBolusIndexes, setEarlyBolusIndexes] = useState({});
  const [supplementalBolusIndexes, setSupplementalBolusIndexes] = useState({});
  const [correctionBolusIndexes, setCorrectionBolusIndexes] = useState({});
  const [expectedBolusIndexes, setExpectedBolusIndexes] = useState({});
  const [expectedBolusBars, setExpectedBolusBars] = useState([]);
  const [selectedDate, setSelectedDate] = useState("2025-01-22");
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

  // ---------------- GA: Fire Page Load ----------------
  useEffect(() => {
    // If gtag is defined, fire a page_load event
    if (window.gtag) {
      window.gtag("event", "CGM_page_load", {
        event_category: "DailyScreen",
        event_label: "User loaded DailyScreen",
      });
    }

    // Apply background image to the entire body
    document.body.style.backgroundImage = "url('/images/background.webp')";
    document.body.style.backgroundSize = "cover";
    document.body.style.backgroundPosition = "center";
    document.body.style.backgroundRepeat = "no-repeat";
  }, []);

  // ---------------- Data Fetching Logic ----------------
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
        
        //console.log(majorEventsList);
        
        
    })
    .catch(error => console.error("Error fetching data:", error));

    }
    
};

  const fetchDailyScores = async (date) => {
    try {
      const response = await fetch(
        `https://3tansqzb2f.execute-api.us-east-1.amazonaws.com/default/api/scores/1?date=${date}`
      );
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

  // ---------------- BG Spike Detection, Bolus Detection, etc. ----------------
  let events = [];
  let spikes = [];
  let lastCorrectionBolusIndex = -6;
  let lastEarlyBolusIndex = -6;
  let newExpectedBolusBars = [];
  let spikeStart = null;
  let lastNoBolusIndex = -6;
  let spikeEnd = null;
  let annotations = [];
  let spikeTimes = [];

  useEffect(() => {
    setEarlyBolusIndexes((prevIndexes) => ({ ...prevIndexes }));
    setCorrectionBolusIndexes((prevIndexes) => ({ ...prevIndexes }));
    setSupplementalBolusIndexes((prevIndexes) => ({ ...prevIndexes }));
    setExpectedBolusBars([...newExpectedBolusBars]);
  }, []);

  let numIntervalsForSpikeA = 5; // 120 min
  let spikeIncreaseThresholdA = 50;

  let numIntervalsForSpikeB = 8; // 60 min
  let spikeIncreaseThresholdB = 65;

  const checkForBGSpike = (data, i) => {
    let newBgValueXminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeA);
    let newBgValueYminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeB);
    let bgIncreaseOverXmin = calcucorrectionBgIncrease(data[i], newBgValueXminAhead);
    let bgIncreaseOverYmin = calcucorrectionBgIncrease(data[i], newBgValueYminAhead);

    if (bgIncreaseOverXmin >= spikeIncreaseThresholdA) {
      if (newBgValueXminAhead > 200 || newBgValueYminAhead > 220) {
        return true;
      }
    }
    return false;
  };

  const getBgValueAtInterval = (data, i, numIntervals) => {
    return data[i + numIntervals] !== null ? data[i + numIntervals] : null;
  };

  const calcucorrectionBgIncrease = (initialValue, newValue) => {
    return newValue !== null ? newValue - initialValue : 0;
  };

  let spikeDetected = false;

  const detectBgSpikes = (data) => {
    let lastSpikeIndex = -6;
    let inSpike = false;
    let spikeAnnotationsLocal = [];
    let troughStart = 0;
    let peakEnd = 0;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== null) {
        spikeDetected = checkForBGSpike(data, i);

        if (spikeDetected && i - lastSpikeIndex >= 6) {
          let { formatted, militaryTime } = formatTime(i);
          lastSpikeIndex = i;
          peakEnd = findPeakEnd(data, i);
          troughStart = findTroughStart(data, peakEnd);

          if (spikeTimes.indexOf(troughStart) < 0) {
            spikeAnnotationsLocal.push({ xMin: troughStart, xMax: peakEnd });
            let spikePeakBG = getBgValueAtInterval(data, peakEnd, 2);
            let spikeRange = spikePeakBG - getBgValueAtInterval(data, troughStart, 0);
            spikeTimes.push([troughStart, spikePeakBG]);
          }

          majorEventsList[majorEventsList.length] = [
            "Spike",
            "🚀 " + formatted,
            "This is normal after a meal or snack.",
            "classYellowBold",
            troughStart,
            " Carb Increase (spike) detected",
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

  // ---------------- Trough & Peak Detection Helpers ----------------
  const checkTroughNextPoint = (data, troughStart) => {
    if (data[troughStart - 1] - data[troughStart] <= -1) {
      return true;
    }
    if (data[troughStart - 2] <= data[troughStart]) {
      return true;
    }
  };

  const findTroughStart = (data, i) => {
    let troughStart = i;
    while (troughStart > 0) {
      if (checkTroughNextPoint(data, troughStart)) {
        troughStart--;
      } else {
        break;
      }
    }
    return troughStart;
  };

  const findPeakEnd = (data, i) => {
    let peakEnd = i;
    while (peakEnd < data.length) {
      if (
        (data[peakEnd + 2] >= data[peakEnd] &&
          data[peakEnd + 4] >= data[peakEnd] &&
          data[peakEnd] > 200) ||
        data[peakEnd + 5] >= data[peakEnd] ||
        data[peakEnd + 1] > data[peakEnd]
      ) {
        peakEnd++;
      } else {
        break;
      }
    }
    return peakEnd;
  };

  // ---------------- Time Parsing for Sorting/Comparison ----------------
  function parseTime(timeStr) {
    const regex = /(\d{1,2}):(\d{2})\s*([ap])\.?m\.?/i;
    const match = timeStr.match(regex);

    if (match) {
      let hours = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      const period = match[3].toLowerCase();

      if (period === "p" && hours < 12) hours += 12;
      if (period === "a" && hours === 12) hours = 0;
      return hours * 60 + minutes;
    }
    return 0;
  }

  // ---------------- Checking Spike Times & Bolus Logic ----------------
  const getNearestSpikeTime = (data, i) => {
    let _absV = 0;
    let _finalV = 50;
    let _finalIndex = 1;
    for (let j = 0; j < spikeTimes.length; j++) {
      _absV = Math.abs(spikeTimes[j][0] - i);
      if (_absV < _finalV) {
        _finalV = _absV;
        _finalIndex = j;
      }
    }
    if (spikeTimes[_finalIndex - 1] != null) {
      if (i - spikeTimes[_finalIndex - 1][0] < 7) {
        _finalIndex = _finalIndex - 1;
      }
    }

    if (data[i] > 250) {
      return spikeTimes[_finalIndex - 1];
    }
    if (_finalV > 10) return undefined;
    return spikeTimes[_finalIndex];
  };

  const detectCorrectionBolus = (data, bolusData, spikeTimes) => {
    let newCorrectionBolusIndexes = { ...correctionBolusIndexes };

    for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null) {
        if (markedBolus[i] === undefined) {
          let spikeStart = getNearestSpikeTime(data, i);

          if (spikeStart !== undefined) {
            if (spikeStart[0] <= i) {
              let { formatted: correctionBolusFormatted } = formatTime(i);

              let _correctionBolusMessage =
                "Insulin Delivered: " +
                bolusDetails[i]["Insulin Delivered"] +
                " units\n";
              _correctionBolusMessage +=
                "Blood Glucose Input: " +
                bolusDetails[i]["Blood Glucose Input"] +
                " mg/dl\n";
              _correctionBolusMessage +=
                "Carbs Input: " + bolusDetails[i]["Carbs Input"] + " g\n";
              _correctionBolusMessage +=
                "Carbs Ratio: " + bolusDetails[i]["Carbs Ratio"] + " g\nㅤ\n";
              _correctionBolusMessage +=
                " ⚠️ Heads up! Administering your bolus after the ideal time can ";
              _correctionBolusMessage +=
                "lead to higher post-meal blood sugar levels. Aim for a more timely dose with ";
              _correctionBolusMessage +=
                "accurately estimated carbs to improve control.\n";

              if (spikeStart[1] > 200) {
                _correctionBolusMessage +=
                  "\nㅤ\n 📊 Analysis:\nBG increased close to " +
                  spikeStart[1] +
                  ", even after the ";
                _correctionBolusMessage +=
                  "bolus. You may have under-estimated the carbs for this meal, ";
                _correctionBolusMessage +=
                  "or did not provide enough time for the bolus to kick-in before eating.";
              }
              newCorrectionBolusIndexes[i] = correctionBolusFormatted;
              lastCorrectionBolusIndex = i;

              majorEventsList[majorEventsList.length] = [
                "correction",
                " 🕒 " + correctionBolusFormatted,
                _correctionBolusMessage,
                "classRedBold",
                i,
                "Correction bolus detected",
              ];

              markedBolus[i] = "Marked";
            }
          }
        }
      }
    }
    setCorrectionBolusIndexes(newCorrectionBolusIndexes);
  };

  const detectEarlyBolus = (data, bolusData, spikeTimes) => {
    let updatedIndexes = { ...earlyBolusIndexes };

    for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null) {
        let spikeStart = getNearestSpikeTime(data, i);
        let { formatted: earlyBolusFormatted } = formatTime(i);
        let _earlyBolusMessage = "";

        if (spikeStart !== undefined) {
          if (spikeStart[0] >= i - 1) {
            _earlyBolusMessage +=
              "Insulin Delivered: " +
              bolusDetails[i]["Insulin Delivered"] +
              " units\n";
            _earlyBolusMessage +=
              "Blood Glucose Input: " +
              bolusDetails[i]["Blood Glucose Input"] +
              " mg/dl\n";
            _earlyBolusMessage +=
              "Carbs Input: " + bolusDetails[i]["Carbs Input"] + " g\n";
            _earlyBolusMessage +=
              "Carbs Ratio: " + bolusDetails[i]["Carbs Ratio"] + " g\nㅤ\n";
            _earlyBolusMessage +=
              " ✅ Nice work! Being aware of upcoming meal intake and proactively providing a ";
            _earlyBolusMessage +=
              "proportional bolus helps to keep the spikes down to a minimum.";

            if (spikeStart[1] > 150) {
              _earlyBolusMessage +=
                "\nㅤ\n ⚠️ Analysis:\nBG increased close to " +
                spikeStart[1] +
                ", even after the ";
              _earlyBolusMessage +=
                "bolus. It sounds like you may have under-estimated the amount of carbs for this meal, ";
              _earlyBolusMessage +=
                "or did not provide enough time for the bolus to kick-in before eating.";
            }
            updatedIndexes[i] = ["🟢 Early Bolus Detected", earlyBolusFormatted];
            lastEarlyBolusIndex = i;
            majorEventsList[majorEventsList.length] = [
              "early",
              " 🏆  " + earlyBolusFormatted,
              _earlyBolusMessage,
              "classGreenBold",
              i,
              "Proactive Bolus Detected",
            ];

            markedBolus[i] = "Marked";
          }
        }
      }
    }
    setEarlyBolusIndexes(updatedIndexes);
  };

  let _openchatParams = "";
  const detectExpectedBolus = (data, bolusData) => {
    let highBgStart = null;

    for (let i = 0; i < data.length; i++) {
      if (data[i] !== null && data[i] > 200) {
        if (highBgStart === null) {
          highBgStart = i;
        }
        if (i - highBgStart >= 10) {
          let noBolusDetected = !bolusData
            .slice(highBgStart - 5, i)
            .some((bolus) => bolus !== null);

          if (noBolusDetected) {
            let expectedBolusStart = highBgStart;
            let expectedBolusEnd = i;

            while (
              expectedBolusEnd < data.length &&
              data[expectedBolusEnd] !== null &&
              data[expectedBolusEnd] > 200
            ) {
              expectedBolusEnd++;
            }

            let expectedBolusCenter = Math.floor(
              (expectedBolusStart + expectedBolusEnd) / 2
            );

            let { formatted: expectedBolusFormatted } = formatTime(
              expectedBolusCenter
            );
            let _expectedBolusMessage =
              "Attention! Missing your scheduled bolus might cause your blood sugar to spike, or cause you to remain at elevated glucose levels. ";
            _expectedBolusMessage +=
              "Remember to dose on time for better overall management.";

            majorEventsList[majorEventsList.length] = [
              "expected",
              " ⚠️ " + expectedBolusFormatted,
              _expectedBolusMessage,
              "classOrangeBold",
              i,
              "Bolus Recommended",
            ];

            newExpectedBolusBars.push({
              index: expectedBolusCenter,
              value: 0.5,
              backgroundColor: "rgba(255, 165, 0, 0.8)",
            });
          }
          highBgStart = null;
        }
      } else {
        highBgStart = null;
      }
    }
    setExpectedBolusBars(newExpectedBolusBars);
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

  const detectSupplementalBolus = (bolusData) => {
    let newSupplementalBolusIndexes = { ...supplementalBolusIndexes };
    console.log("detecting supplementals");
    for (let i = 0; i < bolusData.length; i++) {
      if (bolusData[i] !== null) {
        let bolusDetected = bolusData.slice(i - 3, i).some((bolus) => bolus !== null);

        if (bolusDetected) {
          let { formatted: supplementalBolusFormatted } = formatTime(i);

          let _supplementalBolusMessage =
            "Insulin Delivered: " +
            bolusDetails[i]["Insulin Delivered"] +
            " units\n";
          _supplementalBolusMessage +=
            "Blood Glucose Input: " +
            bolusDetails[i]["Blood Glucose Input"] +
            " mg/dl\n";
          _supplementalBolusMessage +=
            "Carbs Input: " + bolusDetails[i]["Carbs Input"] + " g\n";
          _supplementalBolusMessage +=
            "Carbs Ratio: " + bolusDetails[i]["Carbs Ratio"] + " g\nㅤ\n";
          _supplementalBolusMessage +=
            "It's important to work toward your target range ";
          _supplementalBolusMessage +=
            "but be careful not to take your doses too close together.";

          _supplementalBolusMessage +=
            "\nㅤ\n ⚠️ Analysis:\nInsulin stacking occurs when multiple doses of insulin are taken ";
          _supplementalBolusMessage +=
            "too close together before the previous dose has fully acted, leading to an increased risk ";
          _supplementalBolusMessage +=
            "of hypoglycemia (low blood sugar). This typically happens with bolus (mealtime) ";
          _supplementalBolusMessage +=
            "insulin when someone takes additional correction doses before their ";
          _supplementalBolusMessage +=
            "prior dose has peaked or fully lowered blood glucose.";

          for (let k = 0; k < majorEventsList.length; k++) {
            if (majorEventsList[k][4] == i) {
              majorEventsList[k] = [
                "supplemental",
                " ⚠️ " + supplementalBolusFormatted,
                _supplementalBolusMessage,
                "classOrangeBold",
                i,
                "Extra Bolus Detected",
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
      _openchatParams +=
        majorEventsList[i][0] +
        "|" +
        majorEventsList[i][1] +
        "|" +
        majorEventsList[i][2].replace(/\n/g, "") +
        "|" +
        majorEventsList[i][5] +
        " *END LINE* ";
    }
    //console.log(_openchatParams);
  };

  const formatTime = (index) => {
    let hours = Math.floor(index / 4);
    let minutes = (index % 4) * 15;
    let period = hours >= 12 ? "p.m." : "a.m.";
    let adjustedHours = hours % 12 || 12; // Convert 0 to 12-hour format
    let totalMinutes = (hours % 24) * 60 + minutes;

    return {
      formatted: `${adjustedHours}:${minutes.toString().padStart(2, "0")} ${period}`,
      militaryTime: totalMinutes,
    };
  };

  // ---------------- Chart Data & Options ----------------
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
        pointBackgroundColor: (context) => getBgPointColor(context),
        fill: true,
      },
      {
        label: "Bolus Insulin Delivered",
        data: bolusData,
        type: "bar",
        backgroundColor: (context) => getBolusBarColor(context),
        borderColor: (context) => getBolusBarColor(context),
        borderWidth: 1,
        barPercentage: 5.1,
        categoryPercentage: 1.0,
        yAxisID: "y2",
      },
      {
        label: "Expected Bolus",
        data: new Array(96).fill(null).map((_, i) =>
          expectedBolusBars.some((bar) => bar.index === i) ? 0.5 : null
        ),
        type: "bar",
        backgroundColor: "rgba(255, 165, 0, 0.8)", 
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

      for (let n = 0; n < majorEventsList.length; n++) {
        if (
          majorEventsList[n][4] == index &&
          majorEventsList[n][0].indexOf("Spike") < 0
        ) {
          tooltipMessages.push(`${majorEventsList[n][2]}`);
          return tooltipMessages.join("\n");
        }
      }

      for (let n = 0; n < majorEventsList.length; n++) {
        if (
          majorEventsList[n][4] == index &&
          majorEventsList[n][0] == "early"
        ) {
          tooltipMessages.push(`${majorEventsList[n][2]}`);
          return tooltipMessages.join("\n");
        }
      }

      for (let n = 0; n < majorEventsList.length; n++) {
        if (
          majorEventsList[n][4] == index &&
          majorEventsList[n][0] == "supplemental"
        ) {
          tooltipMessages.push(`${majorEventsList[n][2]}`);
          return tooltipMessages.join("\n");
        }
      }

      // default
      return tooltipItem.formattedValue;
    }

    if (dataset === "Expected Bolus") {
      return "Bolus Expected: No bolus was detected in the expected range. (BG > 200 for 120 min)";
    }

    return tooltipItem.formattedValue;
  };

  const getBgPointColor = (context) => {
    const index = context.dataIndex;
    for (let spike of spikeAnnotations) {
      if (index >= spike.xMin && index <= spike.xMax) {
        return "rgb(255, 227, 227)"; 
      }
    }
    return "rgb(75, 192, 192)";
  };

  const getBolusBarColor = (context) => {
    const index = context.dataIndex;

    for (let n = 0; n < majorEventsList.length; n++) {
      if (
        majorEventsList[n][4] === index &&
        majorEventsList[n][0] === "correction"
      ) {
        return "rgba(255, 0, 0, 0.8)"; 
      }
    }

    for (let n = 0; n < majorEventsList.length; n++) {
      if (
        majorEventsList[n][4] === index &&
        majorEventsList[n][0] === "early"
      ) {
        return "rgba(29, 114, 0, 0.8)"; 
      }
    }

    for (let n = 0; n < majorEventsList.length; n++) {
      if (
        majorEventsList[n][4] === index &&
        majorEventsList[n][0] === "supplemental"
      ) {
        return "rgba(255, 168, 27, 0.8)"; 
      }
    }

    return "rgba(99, 239, 255, 0.8)"; 
  };

  // ************** GA: Chart Click Handling **************
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (event, elements) => {
      if (window.gtag) {
        window.gtag("event", "CGM_chart_click", {
          event_category: "DailyScreen",
          event_label: elements.length
            ? `Clicked chart index: ${elements[0].index}`
            : "Clicked on empty chart area",
        });
      }
    },
    scales: {
      y: { min: 0, max: 420 },
      y2: {
        min: 0,
        max: 10,
        position: "right",
        grid: { drawOnChartArea: false },
      },
      x: {
        ticks: {
          maxTicksLimit: 13,
          callback: function (value) {
            //  ... same logic
            return value;
          },
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          title: (tooltipItems) => {
            let _thisIndex = tooltipItems[0].dataIndex;
            for (let n = 0; n < majorEventsList.length; n++) {
              if (
                majorEventsList[n][4] == _thisIndex &&
                majorEventsList[n][0].indexOf("Spike") < 0
              ) {
                return `${majorEventsList[n][1]} ${majorEventsList[n][5]}`;
              }
            }
            return tooltipItems[0].label;
          },
          label: (tooltipItem) => {
            let label = updateTooltipForBolus(tooltipItem);
            return label.match(/(.{1,45})(\s|$)/g, "$1\n");
          },
        },
        backgroundColor: "rgba(106, 122, 106, 0.95)",
        displayColors: false,
        enabled: true,
        usePointStyle: true,
        bodyFont: { size: 15, weight: "normal" },
        titleFont: { size: 16, weight: "bold" },
        useHTML: 1,
        maxWidth: "100%",
        bodySpacing: 1,
        yAlign: "top",
      },
      annotation: {
        annotations: [
          {
            type: "box",
            yMin: 80,
            yMax: 150,
            backgroundColor: "rgba(144, 238, 144, 0.2)",
            borderWidth: 0,
            drawTime: "beforeDatasetsDraw",
          },
          ...spikeAnnotations,
        ],
      },
    },
  };

  // ---------------- Accordion for major events ----------------
  const [expandedIndex, setExpandedIndex] = useState(null);
  const toggleAccordion = (index) => {
    // GA: event click
    if (window.gtag) {
      window.gtag("event", "CGM_event_click", {
        event_category: "DailyScreen",
        event_label: `Accordion index: ${index}`,
      });
    }
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  // ---------------- UI Rendering ----------------
  return (
    <div className="dailyChartHead" align="center" style={styles.container}>
      <Card>
        <CardContent>
          {/* Date nav */}
          <table border={0} cellPadding={1} style={{ paddingTop: 0, width: "100%" }}>
            <tbody>
              <tr>
                <td align="right">
                  <img
                    style={{ paddingTop: 10, cursor: "pointer" }}
                    onClick={() => {
                      // GA for previous
                      if (window.gtag) {
                        window.gtag("event", "CGM_previous_click", {
                          event_category: "DailyScreen",
                          event_label: "Prev button in daily screen",
                        });
                      }
                      updateDate(-1);
                    }}
                    src="images/back.jpg"
                    width={90}
                    alt="Prev"
                  />
                 

                </td>
                <td width={1}>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      // GA: date_selection_update
                      if (window.gtag) {
                        window.gtag("event", "CGM_date_selection_update", {
                          event_category: "DailyScreen",
                          event_label: e.target.value,
                        });
                      }
                    }}
                    className="dateSelect"
                  />
                </td>
                <td align="left">
                  <img
                    style={{ paddingTop: 10, cursor: "pointer" }}
                    onClick={() => {
                      // GA for next
                      if (window.gtag) {
                        window.gtag("event", "CGM_next_click", {
                          event_category: "DailyScreen",
                          event_label: "Next button in daily screen",
                        });
                      }
                      updateDate(1);
                    }}
                    src="images/next.jpg"
                    width={90}
                    alt="Next"
                  />
                </td>
              </tr>
              <tr>
                <td colSpan={3} align="center">
                  <div className="text-xl font-semibold">
                    Daily Blood Glucose Data <br />
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Chart */}
          <div style={{ height: "350px", width: "95%" }}>
            <Line data={chartData} options={chartOptions} />
          </div>

          {/* If majorEventsList has items */}
          {majorEventsList.length > 0 ? (
            <table
              border={0}
              height={1}
              cellPadding={0}
              cellSpacing={0}
              className="events_table"
            >
              <tbody>
                <tr>
                  <td align="center">
                    <div className="text-xl font-semibold">
                      <div style={{ padding: 10, paddingBottom: 25 }}>
                        <Button
                          style={{ fontSize: 20, width: "95%", fontWeight: "bolder" }}
                          onClick={() => {
                            // GA: AI Summary Click
                            if (window.gtag) {
                              window.gtag("event", "CGM_ai_summary_click", {
                                event_category: "DailyScreen",
                                event_label: "Daily AI Summary Button",
                              });
                            }
                            handleDailyAIClick();
                          }}
                        >
                          Daily AI Summary
                        </Button>
                      </div>
                    </div>
                  </td>
                </tr>

                {/* Major events listing */}
                {majorEventsList
                  .slice()
                  .sort((a, b) => a.time - b.time)
                  .map((msg, index) => (
                    <React.Fragment key={index}>
                      <tr>
                        <td className="button-container">
                          <button
                            className={`gradient-btn btn${majorEventsList[index][0]}`}
                            onClick={() => toggleAccordion(index)}
                            style={{ cursor: "pointer" }}
                          >
                            <div className="button-header">
                              {msg[1]} - {msg[5]}
                            </div>
                            {expandedIndex === index && (
                              <table border={0} height={1} cellPadding={0} cellSpacing={0}>
                                <tbody>
                                  <tr>
                                    <td className="button-container">
                                      <div
                                        className="events_detail accordion-content "
                                        dangerouslySetInnerHTML={{
                                          __html: msg[2].replace(/\n/g, "<br />"),
                                        }}
                                      ></div>
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

      <br />
      <br />
      <br />
      <br />

      {showSpinner && (
        <div className="spinner-container">
          <div className="spinner"></div>
          <p>Loading AI Summary...</p>
        </div>
      )}

      {/* AI Summary Modal */}
      {showModal && (
        <div
          style={{
            position: "fixed",
            top: 60,
            left: 20,
            right: 20,
            bottom: 0,
            height: 600,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            borderRadius: "4px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              padding: "20px",
              borderRadius: "4px",
              maxWidth: "87vw",
              maxHeight: "90vh",
              overflowY: "auto",
              textAlign: "left",
              height: 550,
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setShowModal(false);
                document.body.style.overflow = "";
              }}
              style={{
                position: "absolute",
                top: "20px",
                right: "25px",
                background: "none",
                border: "none",
                fontSize: "18px",
                fontWeight: "bolder",
                cursor: "pointer",
              }}
            >
              X
            </button>
            <div
              className="ai_table"
              dangerouslySetInnerHTML={{
                __html: modalContent.replaceAll("</li>", "\n<br />\n</li>"),
              }}
            ></div>
            <div className="ai_disclaimer">
              *AI summary is only an analysis of your day's events. Always consult
              with your endocrinologist before making any changes to your
              dosage/timing.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Basic styling adjustments
const styles = {
  container: {
    maxWidth: "1000px",
    margin: "auto",
    padding: "10px",
    textAlign: "center",
    backgroundImage: "none",
  },
  flexCenter: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    alignItems: "center",
    justifyContent: "center",
  },
  mapContainer: {
    width: "99%",
    margin: "auto",
    height: "600px",
    border: "1px solid black",
  },
  mapStyle: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  modalContent: {
    width: "calc(100vw - 30px)",
    height: "calc(100vh - 60px)",
    padding: "15px",
    margin: "15px",
    position: "relative",
    overflow: "auto",
    borderRadius: "8px",
    backgroundColor: "#fff",
  },
  closeButton: {
    position: "absolute",
    top: "10px",
    right: "10px",
    fontSize: "1.2em",
    cursor: "pointer",
    backgroundColor: "#FADADD",
    border: "none",
    padding: "5px 10px",
    borderRadius: "5px",
  },
  aiText: {
    whiteSpace: "pre-wrap",
    margin: "10px",
    fontSize: "1.3em",
    textAlign: "left",
  },
  controlButton: {
    backgroundColor: "#AEDFF7",
    color: "#333",
    padding: "2px 4px",
    borderRadius: "2px",
    margin: "2px",
    fontSize: "1.1em",
    fontWeight: "bolder",
    cursor: "pointer",
  },
  refreshButton: {
    backgroundColor: "#f5ff3e",
    color: "#333",
    padding: "2px 4px",
    borderRadius: "5px",
    margin: "1px",
    fontSize: "1.2em",
    fontWeight: "bolder",
    cursor: "pointer",
  },
  inputField: {
    fontSize: "1.2em",
    padding: "10px",
    margin: "5px 0",
    width: "40%",
    boxSizing: "border-box",
  },
  selectField: {
    fontSize: "0.8em",
    padding: "10px",
    margin: "5px 0",
    width: "39%",
    boxSizing: "border-box",
  },
  selectFieldMag: {
    fontSize: "1.0em",
    padding: "10px",
    margin: "5px 0",
    width: "23%",
    boxSizing: "border-box",
  },
};

export default DailyScreen;
