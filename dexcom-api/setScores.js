
const mysql = require('mysql2');
const { Client } = require('ssh2');
const dayjs = require('dayjs');
const fs = require('fs');
const dbConfig = require("./sshconfig");
const dbConfig = require("./dbLocalConfig");


// Create SSH Tunnel & Connect to MySQL
async function connectToDatabase() {
    return new Promise((resolve, reject) => {
        const sshClient = new Client();
        sshClient.on('ready', () => {
            console.log('✅ SSH Tunnel Connected');
            sshClient.forwardOut(
                '127.0.0.1', 3306,
                'ec2-52-39-197-130.us-west-2.compute.amazonaws.com', 3306,
                (err, stream) => {
                    if (err) {
                        sshClient.end();
                        return reject(err);
                    }
                    const connection = mysql.createConnection({
                        ...dbConfig,
                        stream
                    });
                    connection.connect(error => {
                        if (error) {
                            sshClient.end();
                            return reject(error);
                        }
                        console.log('✅ MySQL Connected via SSH Tunnel');
                        resolve({ connection, sshClient });
                    });
                }
            );
        });
        sshClient.on('error', reject);
        sshClient.connect(sshConfig);
    });
}

async function getDaysWithData(connection) {
    try {
        const [rows] = await connection.promise().query(
            "SELECT DISTINCT DATE(Timestamp) AS record_date FROM cgm_data ORDER BY record_date ASC"
        );
        return rows.map(row => row.record_date);
    } catch (error) {
        console.error("Error fetching days:", error);
        return [];
    }
}

async function getDayData(connection, day) {
    const [cgmRows] = await connection.promise().query(
        "SELECT * FROM cgm_data WHERE DATE(Timestamp) = ? ORDER BY Timestamp ASC",
        [day]
    );
    const [bolusRows] = await connection.promise().query(
        "SELECT * FROM bolus_data WHERE DATE(Timestamp) = ? ORDER BY Timestamp ASC",
        [day]
    );
    return { cgmData: cgmRows, bolusData: bolusRows };
}

let numIntervalsForSpikeX = 24; // 120 minutes (assuming 5-minute intervals)
let numIntervalsForSpikeY = 12;  // 60 minutes (assuming 5-minute intervals)
let spikeXIncreaseThreshold = 85;
let spikeYIncreaseThreshold = 45;

const checkForBGSpike = (data, i) => {  // ✅ Main Function: Check If a Spike Occurs
  let newBgValueXminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeX); // ✅ Get BG value X min ahead
  let newBgValueYminAhead = getBgValueAtInterval(data, i, numIntervalsForSpikeY); // ✅ Get BG value Y min ahead

  let bgIncreaseOverXmin = calculateBgIncrease(data[i], newBgValueXminAhead); // ✅ Compute BG increase over X min
  let bgIncreaseOverYmin = calculateBgIncrease(data[i], newBgValueYminAhead); // ✅ Compute BG increase over Y min

  // ✅ Returns TRUE if BG increases meet the threshold & new values are high
  let _outcome = (bgIncreaseOverXmin >= spikeXIncreaseThreshold || bgIncreaseOverYmin >= spikeYIncreaseThreshold) && (newBgValueXminAhead > 205 || newBgValueYminAhead > 220);
  
  return _outcome;
};



function detectSpikes(data) {
    let lastSpikeIndex = -6;
    let inSpike = false;
    let spikeAnnotations = [];
    let spikeTimes = [,];
    let spikeDetected = false;

    for (let i = 0; i < data.length; i++) {
        if (data[i] !== null) {
            let spikeDetected = checkForBGSpike(data, i);

            if (spikeDetected && (i - lastSpikeIndex >= numIntervalsForSpikeX)) {
                let { formatted, militaryTime } = formatTime(i);
                console.log(militaryTime, `${data[i]["Timestamp"]} - BG/Carb Increase. Spike detected.`, 'classYellowBold');
                
                lastSpikeIndex = i;
                let troughStart = findTroughStart(data, i)[0];
                let peakEnd = findPeakEnd(data, i)[0];

                spikeAnnotations.push({ xMin: troughStart, xMax: peakEnd });
                spikeTimes.push([troughStart, data[i]["Timestamp"]]); // Store spike start time

                if (!inSpike) {
                    spikeStart = troughStart;
                    inSpike = true;
                }
            }

        }
    }

    return spikeTimes;

}


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
  

// ✅ Helper Function: Get BG Value at a Specific Interval
const getBgValueAtInterval = (data, i, interval) => {
    let bgvalAtInterval = data[i + interval] !== null ? data[i + interval] : null;
    try {
        // Code that might throw an error
        bgvalAtInterval = bgvalAtInterval["CGM Value"];
        //console.log(i); 
        
      } catch (error) {
        // Code to handle the error
        console.error("data length exceeded. Ignoring.");
      }

    
    return bgvalAtInterval;
  };
  
  // ✅ Helper Function: Calculate BG Increase Over Time
  const calculateBgIncrease = (initialValue, newValue) => {
    let bgIncrease = newValue !== null ? newValue - initialValue["CGM Value"] : 0;
    bgIncrease = bgIncrease;
    return newValue;
  };
  

// ✅ Finds lowest point before a spike (Trough)
const findTroughStart = (data, i) => {
    let troughStart = i;
    //while the current value (starting at i) is higher than the previous value,
    //keep moving back in time until it is not (the starting point of the spike)
    while (troughStart > 0 && data[troughStart - 1]["CGM Value"] <= data[troughStart]["CGM Value"]) {
        troughStart--;
    }
    return [troughStart,data[troughStart]];

  };
  
  // ✅ Finds highest point after a spike (Peak)
  const findPeakEnd = (data, i) => {
    let peakEnd = i;
    while (peakEnd < data.length - 1 && data[peakEnd + 1]["CGM Value"] >= data[peakEnd]["CGM Value"]) {
        peakEnd++;
    }
    return [peakEnd,data[peakEnd]];
  };


function detectLateBoluOLD(spikeTimes, bolusData) {
    return bolusData.filter(bolus => spikeTimes.some(spike => bolus.Timestamp > spike && bolus.Timestamp - spike > 15)).length;
}

let lastLateBolusIndex = -4;
let lastEarlyBolusIndex = -6;
let newExpectedBolusBars = []; // Temporary array to hold bars before setting state

const [earlyBolusIndexes, setEarlyBolusIndexes] = [];
const [supplementalBolusIndexes, setSupplementalBolusIndexes] = [];
const [lateBolusIndexes, setLateBolusIndexes] = [];
const [expectedBolusIndexes, setExpectedBolusIndexes] = [];
const [doubleBolusIndexes, setDoubleBolusIndexes] = [];
const [eventMessages, setEventMessages] = [];
const [expectedBolusBars, setExpectedBolusBars] = [];

const detectLateBolus = (data, bolusData, spikeTimes) => {
    let lateBolusCount = 0;
    let lateBoluses = [];

    // Convert timestamps to dayjs objects for easy comparison
    const formattedSpikeTimes = spikeTimes.map(spike => ({
        value: spike[0], 
        timestamp: dayjs(spike[1]) // Convert to dayjs object
    }));

    const formattedBolusData = bolusData.map(bolus => ({
        ...bolus,
        timestamp: dayjs(bolus.Timestamp) // Convert to dayjs object
    }));

    // Loop through each spike time and check if a bolus occurred within 60 minutes AFTER the spike
    formattedSpikeTimes.forEach(spike => {
        const foundLateBolus = formattedBolusData.find(bolus => {
            const diffMinutes = bolus.timestamp.diff(spike.timestamp, 'minute');
            return diffMinutes > 0 && diffMinutes <= 60; // Bolus must be AFTER the spike and within 60 min
        });

        if (foundLateBolus) {
            lateBolusCount++;
            lateBoluses.push(foundLateBolus);
        }
    });

    //return { lateBolusCount, lateBoluses };
    return lateBoluses.length;
}


const detectExpectedBolus = (cgmData, bolusData, spikeTimes) => {

    let expectedBolusCount = 0;
    let expectedBoluses = [];

    // Convert timestamps to dayjs objects for easy comparison
    const formattedCGMData = cgmData.map(entry => ({
        timestamp: dayjs(entry["Timestamp"]), // Convert to dayjs object
        value: entry["CGM Value"]
    }));

    const formattedBolusData = bolusData.map(bolus => ({
        ...bolus,
        timestamp: dayjs(bolus.Timestamp) // Convert to dayjs object
    }));

    // Scan CGM data to find periods where BG is > 200 for 90+ minutes
    let startHighBG = null;

    for (let i = 0; i < formattedCGMData.length; i++) {
        const entry = formattedCGMData[i];

        if (entry.value > 200) {
            if (!startHighBG) {
                startHighBG = entry.timestamp; // Start tracking high BG
            }

            // Check if 90 minutes have passed
            const duration = entry.timestamp.diff(startHighBG, "minute");

            if (duration >= 90) {
                // Check if a bolus was given during this period
                const hadBolus = formattedBolusData.some(bolus =>
                    bolus.timestamp.isAfter(startHighBG) && bolus.timestamp.isBefore(entry.timestamp)
                );

                if (!hadBolus) {
                    expectedBolusCount++;
                    expectedBoluses.push({ start: startHighBG.format(), end: entry.timestamp.format() });
                }

                // Reset tracking
                startHighBG = null;
            }
        } else {
            startHighBG = null; // Reset if BG drops below 200
        }
    }

    return  expectedBolusCount;

}


const detectEarlyBolus = (data, bolusData, spikeTimes) => {
    let earlyBolusCount = 0;
    let earlyBoluses = [];

    // Convert timestamps to dayjs objects for easy comparison
    const formattedSpikeTimes = spikeTimes.map(spike => ({
        value: spike[0], 
        timestamp: dayjs(spike[1]) // Convert to dayjs object
    }));

    const formattedBolusData = bolusData.map(bolus => ({
        ...bolus,
        timestamp: dayjs(bolus.Timestamp) // Convert to dayjs object
    }));

    // Loop through each spike time and check if a bolus occurred within 30 minutes BEFORE the spike
    formattedSpikeTimes.forEach(spike => {
        const foundEarlyBolus = formattedBolusData.find(bolus => {
            const diffMinutes = spike.timestamp.diff(bolus.timestamp, 'minute');
            return diffMinutes > 0 && diffMinutes <= 30; // Bolus must be BEFORE the spike and within 30 min
        });

        if (foundEarlyBolus) {
            earlyBolusCount++;
            earlyBoluses.push(foundEarlyBolus);
        }
    });

    return earlyBoluses.length;
    //return { earlyBolusCount, earlyBoluses };

}





function detectSupplementalBolus(bolusData) {
    return bolusData.filter(bolus => bolus.amount > 0).length;
}

async function saveDailyScore(connection, day, scoreData) {
    try {
        await connection.promise().query(
            `INSERT INTO Scores (user_id, date, total_score, today_score, rewards, deductions)
             VALUES (?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE total_score = VALUES(total_score),
                                     today_score = VALUES(today_score),
                                     rewards = VALUES(rewards),
                                     deductions = VALUES(deductions)`,
            [
                1, 
                day, 
                scoreData.totalScore, 
                scoreData.dailyScore, 
                (scoreData.positivePoints * 10), 
                (scoreData.negativeEvents * 5)
            ]
        );
    } catch (error) {
        console.error("Error saving daily score:", error);
    }
}

async function processScoring() {
    try {
        const { connection, sshClient } = await connectToDatabase();
        const days = await getDaysWithData(connection);
        let totalPoints = 100;
        
        for (const day of days) {
            console.log(`Processing: ${day}`);
            const { cgmData, bolusData } = await getDayData(connection, day);
            
            let spikeTimes = detectSpikes(cgmData);
            let lateBolusCount = detectLateBolus(cgmData, bolusData, spikeTimes);
            let earlyBolusCount = detectEarlyBolus(cgmData, bolusData, spikeTimes);
            let expectedBolusCount = detectExpectedBolus(cgmData, bolusData, spikeTimes);
            let supplementalBolusCount = detectSupplementalBolus(bolusData);
            
            let dailyScore = totalPoints;
            dailyScore -= lateBolusCount * 5;
            dailyScore += earlyBolusCount * 10;
            dailyScore -= expectedBolusCount * 5;
            dailyScore += supplementalBolusCount * 5;
            
            const scoreData = {
                totalScore: dailyScore,
                dailyScore,
                positivePoints: earlyBolusCount + supplementalBolusCount,
                negativeEvents: lateBolusCount + expectedBolusCount
            };
            
            await saveDailyScore(connection, day, scoreData);
        }
        connection.end();
        sshClient.end();
    } catch (error) {
        console.error("Error processing scores:", error);
    }
}

processScoring();