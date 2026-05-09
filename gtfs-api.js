// GTFS API Backend Service
// Parses GTFS data and serves real-time departure info
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const AdmZip = require('adm-zip');
const moment = require('moment-timezone');

const app = express();
const PORT = process.env.PORT || 3002;
const DATA_DIR = path.join(__dirname, 'data');
const GTFS_ZIP_URL = 'https://data.montpellier3m.fr/GTFS/Urbain/GTFS.zip';
const CSV_URL = 'https://data.montpellier3m.fr/sites/default/files/ressources/TAM_MMM_TpsReel.csv';

// Enable CORS
app.use(cors());
app.use(express.json());

// In-memory cache
let gtfsData = {
  stops: [],
  routes: [],
  trips: {},
  stopTimes: {},
  calendar: {},
};

let csvCache = [];
let lastCsvUpdate = 0;

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Download and parse GTFS data
 */
async function downloadAndParseGTFS() {
  try {
    console.log('📥 Downloading GTFS...');
    const response = await axios.get(GTFS_ZIP_URL, { responseType: 'arraybuffer' });
    const zip = new AdmZip(response.data);
    
    const zipPath = path.join(DATA_DIR, 'GTFS.zip');
    fs.writeFileSync(zipPath, response.data);
    
    const extractPath = path.join(DATA_DIR, 'gtfs');
    if (fs.existsSync(extractPath)) {
      fs.rmSync(extractPath, { recursive: true });
    }
    
    zip.extractAllTo(extractPath, true);
    console.log('✅ GTFS extracted');
    
    // Parse GTFS files
    await parseGTFSFiles(extractPath);
    console.log('✅ GTFS parsed and cached');
    
    return true;
  } catch (error) {
    console.error('❌ Error downloading GTFS:', error.message);
    return false;
  }
}

/**
 * Parse individual GTFS files
 */
async function parseGTFSFiles(extractPath) {
  try {
    // Parse stops.txt
    const stopsFile = fs.readFileSync(path.join(extractPath, 'stops.txt'), 'utf-8');
    gtfsData.stops = parse(stopsFile, { columns: true });
    console.log(`  - Loaded ${gtfsData.stops.length} stops`);

    // Parse routes.txt
    const routesFile = fs.readFileSync(path.join(extractPath, 'routes.txt'), 'utf-8');
    gtfsData.routes = parse(routesFile, { columns: true });
    console.log(`  - Loaded ${gtfsData.routes.length} routes`);

    // Parse trips.txt
    const tripsFile = fs.readFileSync(path.join(extractPath, 'trips.txt'), 'utf-8');
    const trips = parse(tripsFile, { columns: true });
    gtfsData.trips = {};
    trips.forEach(trip => {
      gtfsData.trips[trip.trip_id] = trip;
    });
    console.log(`  - Loaded ${trips.length} trips`);

    // Parse stop_times.txt
    const stopTimesFile = fs.readFileSync(path.join(extractPath, 'stop_times.txt'), 'utf-8');
    const stopTimes = parse(stopTimesFile, { columns: true });
    gtfsData.stopTimes = {};
    stopTimes.forEach(st => {
      if (!gtfsData.stopTimes[st.stop_id]) {
        gtfsData.stopTimes[st.stop_id] = [];
      }
      gtfsData.stopTimes[st.stop_id].push(st);
    });
    console.log(`  - Loaded ${stopTimes.length} stop times`);

    // Parse calendar_dates.txt for service dates
    const calendarFile = fs.readFileSync(path.join(extractPath, 'calendar_dates.txt'), 'utf-8');
    const calendar = parse(calendarFile, { columns: true });
    gtfsData.calendar = {};
    calendar.forEach(cal => {
      if (!gtfsData.calendar[cal.service_id]) {
        gtfsData.calendar[cal.service_id] = [];
      }
      gtfsData.calendar[cal.service_id].push(cal);
    });
    console.log(`  - Loaded calendar dates`);

  } catch (error) {
    console.error('❌ Error parsing GTFS:', error.message);
    throw error;
  }
}

/**
 * Fetch and cache live CSV data
 */
async function fetchLiveCSV() {
  try {
    const now = Date.now();
    if (csvCache.length > 0 && now - lastCsvUpdate < 30000) {
      return; // Cache for 30 seconds
    }

    console.log('📥 Fetching live CSV...');
    const response = await axios.get(CSV_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    csvCache = parse(response.data, { columns: true, delimiter: ';' });
    lastCsvUpdate = now;
    console.log(`✅ Fetched ${csvCache.length} live records`);
  } catch (error) {
    console.error('❌ Error fetching CSV:', error.message);
  }
}

/**
 * Get all stops
 */
app.get('/api/stops', (req, res) => {
  try {
    const stops = gtfsData.stops.map(stop => ({
      stop_id: stop.stop_id,
      stop_name: stop.stop_name,
      stop_lat: stop.stop_lat,
      stop_lon: stop.stop_lon,
    }));
    
    res.json({
      status: 'success',
      count: stops.length,
      data: stops,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Get directions for a specific stop
 */
app.get('/api/stops/:stopId/directions', (req, res) => {
  try {
    const { stopId } = req.params;
    
    const stopTimes = gtfsData.stopTimes[stopId] || [];
    const directionsSet = new Set();
    
    stopTimes.forEach(st => {
      const trip = gtfsData.trips[st.trip_id];
      if (trip && trip.trip_headsign) {
        directionsSet.add(trip.trip_headsign);
      }
    });
    
    const directions = Array.from(directionsSet).sort();
    
    res.json({
      status: 'success',
      stop_id: stopId,
      count: directions.length,
      data: directions,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Get next departures for a stop and direction
 */
app.get('/api/departures', async (req, res) => {
  try {
    const { stopId, stopName, direction } = req.query;
    
    if (!stopId && !stopName) {
      return res.status(400).json({
        status: 'error',
        message: 'stopId or stopName required',
      });
    }

    await fetchLiveCSV();

    // Find stop if only name provided
    let actualStopId = stopId;
    if (!stopId && stopName) {
      const stop = gtfsData.stops.find(s => s.stop_name.toLowerCase() === stopName.toLowerCase());
      if (!stop) {
        return res.status(404).json({
          status: 'error',
          message: `Stop "${stopName}" not found`,
        });
      }
      actualStopId = stop.stop_id;
    }

    // Get stop times for this stop
    const stopTimes = gtfsData.stopTimes[actualStopId] || [];
    
    const departures = [];
    const now = moment().tz('Europe/Paris');
    
    stopTimes.forEach(st => {
      const trip = gtfsData.trips[st.trip_id];
      if (!trip) return;
      
      // Filter by direction if provided
      if (direction && trip.trip_headsign.toLowerCase() !== direction.toLowerCase()) {
        return;
      }
      
      // Find live data for this trip
      const liveRecord = csvCache.find(
        record =>
          record.stop_id === actualStopId &&
          record.trip_headsign.toLowerCase() === trip.trip_headsign.toLowerCase() &&
          record.departure_time === st.departure_time
      );
      
      // Parse departure time
      const [hours, minutes, seconds] = st.departure_time.split(':').map(Number);
      const depTime = moment().tz('Europe/Paris').set({ hour: hours, minute: minutes, second: seconds });
      
      // Handle overnight times
      if (hours >= 0 && hours <= 3 && now.hour() >= 22) {
        depTime.add(1, 'day');
      }
      
      // Only include future departures
      if (depTime > now) {
        const minutesToDeparture = depTime.diff(now, 'minutes');
        
        departures.push({
          trip_id: st.trip_id,
          route_short_name: trip.route_short_name,
          trip_headsign: trip.trip_headsign,
          departure_time: st.departure_time,
          minutes_until_departure: minutesToDeparture,
          delay_sec: liveRecord ? parseInt(liveRecord.delay_sec) || 0 : 0,
          is_real_time: !!liveRecord,
        });
      }
    });
    
    // Sort by departure time and limit to next 5
    departures.sort((a, b) => a.minutes_until_departure - b.minutes_until_departure);
    
    res.json({
      status: 'success',
      stop_id: actualStopId,
      direction: direction || 'all',
      count: departures.length,
      data: departures.slice(0, 5),
    });
  } catch (error) {
    console.error('Error in /api/departures:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'GTFS API is running',
    gtfs_loaded: gtfsData.stops.length > 0,
    stops_count: gtfsData.stops.length,
  });
});

/**
 * Initialize and start server
 */
async function start() {
  try {
    console.log('🚀 Starting GTFS API Server...');
    
    // Download and parse GTFS on startup
    await downloadAndParseGTFS();
    
    // Refresh GTFS daily
    setInterval(() => {
      console.log('🔄 Refreshing GTFS data...');
      downloadAndParseGTFS();
    }, 24 * 60 * 60 * 1000);
    
    // Start server
    app.listen(PORT, () => {
      console.log(`✅ GTFS API Server running on http://localhost:${PORT}`);
      console.log(`📡 Endpoints:`);
      console.log(`   GET /api/stops`);
      console.log(`   GET /api/stops/:stopId/directions`);
      console.log(`   GET /api/departures?stopId=X&direction=Y`);
      console.log(`   GET /health`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

start();
