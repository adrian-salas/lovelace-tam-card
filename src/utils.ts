import { AllDataTypes } from './types';
import ALLDATA from './merged_data.json';

const all_data: AllDataTypes[] = ALLDATA as AllDataTypes[];

export function getTripHeadsign(stopName): any {
	const tripHeadsigns: any = [];
	all_data.forEach(item => {
		if (item.stop_name === stopName) {
			tripHeadsigns.push(item.trip_headsign);
		}
	});
	const uniqueTripHeadsigns = tripHeadsigns.filter((value, index, self) => self.indexOf(value) === index);
	uniqueTripHeadsigns.sort();

	return uniqueTripHeadsigns.length ? uniqueTripHeadsigns : ['Stop non trouvé'];
}

export function getAllStops(): string[] {
	let allStop = all_data.map(objet => objet.stop_name);
	allStop = [...new Set(allStop)];
	allStop.sort();
	return allStop;
}

export function timestampToTime(timestamp: any): string {
	const date = new Date(timestamp.time * 1000);
	const hours = date.getHours();
	const minutes = `0${date.getMinutes()}`.slice(-2);
	const seconds = `0${date.getSeconds()}`.slice(-2);
	return `${hours}:${minutes}:${seconds}`;
}

export function showTrip(tripData: any): any {
	const data = all_data.find(item => item.trip_id.includes(tripData.tripId));
	if (data) {
		if (data.hasOwnProperty('trip_headsign') && data.trip_headsign !== '') {
			return data.trip_headsign;
		}
	}
	return 'Destination inconnue';
}

function searchStopAndDirection(stopName, direction): any {
	const results: any = [];
	all_data.forEach(item => {
		if (item.stop_name === stopName && item.trip_headsign === direction) {
			results.push({
				stop_id: item.stop_id,
				route_id: item.route_id,
				trip_headsign: item.trip_headsign,
				stop_name: item.stop_name,
				route_short_name: item.route_short_name,
			});
		}
	});

	return results;
}

function toPascalCase(str): any {
	return str.toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}

// Parse CSV string to array of objects
function parseCSV(csvText: string): any[] {
	const lines = csvText.trim().split('\n');
	if (lines.length < 2) {
		console.error('CSV file is empty or invalid');
		return [];
	}

	const headers = lines[0].split(';');
	const data: any[] = [];

	for (let i = 1; i < lines.length; i++) {
		const values = lines[i].split(';');
		const row: any = {};

		headers.forEach((header, index) => {
			row[header.trim()] = values[index] ? values[index].trim() : '';
		});

		data.push(row);
	}

	return data;
}

// Fetch data from TAM CSV API via local proxy
export async function findData(direction): Promise<any> {
	if (direction === undefined || direction.length === 0 || direction === null) return null;

	try {
		const proxyUrl = 'http://localhost:3001/api/tam-csv';
		console.log('Fetching TAM CSV data from proxy:', proxyUrl);
		
		const response = await fetch(proxyUrl, {
			mode: 'cors',
			headers: {
				'Accept': 'text/csv',
			},
		});

		if (!response.ok) {
			const error = new Error(`${response.url}: ${response.status} ${response.statusText}`);
			error['response'] = response;
			console.error('API Error:', error);
			throw error;
		}

		const csvText = await response.text();
		const csvData = parseCSV(csvText);

		console.log(`Parsed ${csvData.length} records from CSV`);

		// Filter data by stop_id and route_short_name and trip_headsign
		const filteredData = csvData.filter(row => {
			return (
				row.stop_id === direction.stop_id &&
				row.route_short_name === direction.route_short_name &&
				row.trip_headsign === direction.trip_headsign
			);
		});

		console.log(`Found ${filteredData.length} matching records`);

		// Sort by departure_time and format response
		const parsedObject: any = filteredData
			.map(row => ({
				trip_headsign: row.trip_headsign,
				departure_time: row.departure_time,
				route_short_name: row.route_short_name,
				stop_name: row.stop_name,
			}))
			.sort((a, b) => a.departure_time.localeCompare(b.departure_time));

		console.log('Returning data:', parsedObject);
		return parsedObject;
	} catch (error) {
		console.error('Error fetching or parsing CSV:', error);
		return [];
	}
}

export async function getData(stopName, direction): Promise<any> {
	try {
		let obj = await searchStopAndDirection(stopName, direction);
		if (obj.length === 0) {
			const new_stopName = toPascalCase(stopName);
			obj = await searchStopAndDirection(new_stopName, direction);
		}

		if (obj.length === 0) {
			console.warn(`No matching stop/direction found: ${stopName} / ${direction}`);
			return [];
		}

		console.log('Searching for direction config:', obj[0]);
		return await findData(obj[0]);
	} catch (error) {
		console.error('Error in getData:', error);
		return [];
	}
}
