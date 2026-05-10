import { Passage } from './types';

// Fetch stops from API
// API Response: { count: 777, data: [ { ID, Code, Name, Latitude, Longitude, WheelchairBoarding } ] }
export async function fetchStops(apiHost: string): Promise<string[]> {
	try {
		const url = `${apiHost}/api/v1/realtime/stops`;
		console.log('Fetching stops from:', url);
		
		const response = await fetch(url, {
			method: 'GET',
			mode: 'no-cors',
			headers: {
				'Accept': 'application/json',
			},
		});

		if (!response.ok) {
			console.error(`API Error: ${response.status} ${response.statusText}`);
			return [];
		}

		const responseData = await response.json();
		console.log('Raw API response:', responseData);
		
		// Extract stops from the data array and use the 'Name' field
		if (responseData.data && Array.isArray(responseData.data)) {
			const stops = responseData.data.map(stop => stop.Name).filter(name => name);
			console.log(`✅ Extracted ${stops.length} stops`);
			return stops;
		}
		
		return [];
	} catch (error) {
		console.error('Error fetching stops:', error);
		return [];
	}
}

// Fetch passages from API
// API Response: { stop_name, count, limit, data: [ { route_short_name, route_long_name, trip_headsign, scheduled_time, delay_seconds, estimated_time, minutes_from_now, direction_id, wheelchair_access } ] }
export async function fetchPassages(apiHost: string, stopName: string, limit: number = 5): Promise<Passage[]> {
	try {
		const url = `${apiHost}/api/v1/realtime/passages?stop_name=${encodeURIComponent(stopName)}&limit=${limit}`;
		console.log('Fetching passages from:', url);
		
		const response = await fetch(url, {
			method: 'GET',
			mode: 'no-cors',
			headers: {
				'Accept': 'application/json',
			},
		});

		if (!response.ok) {
			console.error(`API Error: ${response.status} ${response.statusText}`);
			return [];
		}

		const responseData = await response.json();
		console.log('Raw API response:', responseData);
		
		// Extract passages from the data array
		if (responseData.data && Array.isArray(responseData.data)) {
			// Transform API response to match expected format
			const passages = responseData.data.map(passage => ({
				route_short_name: passage.route_short_name,
				trip_headsign: passage.trip_headsign,
				scheduled_time: passage.scheduled_time,
				estimated_time: passage.estimated_time,
				delay_seconds: passage.delay_seconds,
				minutes_from_now: passage.minutes_from_now,
				stop_name: responseData.stop_name,
			}));
			console.log(`✅ Extracted ${passages.length} passages`);
			return passages;
		}
		
		return [];
	} catch (error) {
		console.error('Error fetching passages:', error);
		return [];
	}
}
