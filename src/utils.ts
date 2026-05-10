import { Passage } from './types';
import moment from 'moment-timezone';

export const DEFAULT_API_HOST = '';

export function normalizeApiHost(apiHost?: string): string {
	return (apiHost || DEFAULT_API_HOST).replace(/\/$/, '');
}

function getPassageMinutes(passage: Passage, now: moment.Moment): number | null {
	if (typeof passage.minutes_from_now === 'number' && !Number.isNaN(passage.minutes_from_now)) {
		return Math.max(0, Math.floor(passage.minutes_from_now));
	}
	const rawTime = passage.estimated_time || passage.scheduled_time;
	if (!rawTime) {
		return null;
	}
	const fullDateOfTimeCourse = now.clone();
	const [hours, minutes, seconds] = rawTime.split(':');
	if (!hours || !minutes) {
		return null;
	}
	if (hours >= '00' && hours <= '03' && (now.hour() === 22 || now.hour() === 23)) {
		fullDateOfTimeCourse.add(1, 'days');
	}
	fullDateOfTimeCourse.set({
		hour: parseInt(hours, 10),
		minute: parseInt(minutes, 10),
		second: parseInt(seconds || '0', 10),
	});
	if (fullDateOfTimeCourse <= now) {
		return null;
	}
	return fullDateOfTimeCourse.diff(now, 'minutes');
}

export function parsePassageData(passages: Passage[]): string[] {
	const time: string[] = [];
	const now = moment(new Date()).tz('Europe/Paris');
	for (const passage of passages) {
		const minutes = getPassageMinutes(passage, now);
		if (minutes === null) {
			continue;
		}
		time.push(minutes.toString());
	}
	if (time.length === 0) {
		return ['Fin de service'];
	}
	const sortedTime = time.sort((a: string, b: string) => parseInt(a, 10) - parseInt(b, 10));
	for (let i = 0; i < sortedTime.length; i++) {
		if (parseInt(sortedTime[i], 10) < 2) {
			sortedTime[i] = 'Proche !!';
		}
	}
	return [...new Set(sortedTime)];
}

// Fetch stops from API
// API Response: { count: 777, data: [ { ID, Code, Name, Latitude, Longitude, WheelchairBoarding } ] }
export async function fetchStops(apiHost: string): Promise<string[]> {
	try {
		const url = `${normalizeApiHost(apiHost)}/api/v1/realtime/stops`;
		console.log('Fetching stops from:', url);

		const response = await fetch(url, {
			method: 'GET',
			mode: 'no-cors',
			headers: {
				Accept: 'application/json',
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
			const stops = responseData.data.map((stop: Record<string, unknown>) => stop.Name).filter(name => name);
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
export async function fetchPassages(apiHost: string, stopName: string, limit = 5): Promise<Passage[]> {
	try {
		const url = `${normalizeApiHost(apiHost)}/api/v1/realtime/passages?stop_name=${encodeURIComponent(
			stopName,
		)}&limit=${limit}`;
		console.log('Fetching passages from:', url);

		const response = await fetch(url, {
			method: 'GET',
			mode: 'no-cors',
			headers: {
				Accept: 'application/json',
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
			const passages = responseData.data.map((passage: Record<string, unknown>) => ({
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
