import { Passage, PassageApiResponse, Stop, StopApiResponse } from './types';
import moment from 'moment-timezone';

export const DEFAULT_API_HOST = '';

export function normalizeApiHost(apiHost?: string): string {
	return (apiHost || DEFAULT_API_HOST).replace(/\/$/, '');
}

async function fetchJson<T>(url: string): Promise<T> {
	const response = await fetch(url, {
		mode: 'cors',
		headers: {
			Accept: 'application/json',
		},
	});
	if (!response.ok) {
		throw new Error(`${response.url}: ${response.status} ${response.statusText}`);
	}
	return response.json();
}

export async function fetchStops(apiHost: string): Promise<string[]> {
	const host = normalizeApiHost(apiHost);
	const response = await fetchJson<StopApiResponse | Stop[]>(`${host}/api/v1/realtime/stops`);
	const stops = Array.isArray(response) ? response : response?.data || response?.stops || [];
	const stopNames = stops.map((stop: Stop) => stop.stop_name).filter(stopName => Boolean(stopName));
	return [...new Set(stopNames)].sort();
}

export async function fetchPassages(apiHost: string, stopName: string, limit = 5): Promise<Passage[]> {
	if (!stopName) {
		return [];
	}
	const host = normalizeApiHost(apiHost);
	const params = new URLSearchParams({
		stop_name: stopName,
		limit: String(limit),
	});
	const response = await fetchJson<PassageApiResponse | Passage[]>(
		`${host}/api/v1/realtime/passages?${params.toString()}`,
	);
	return Array.isArray(response) ? response : response?.data || response?.passages || [];
}

function getPassageMinutes(passage: Passage, now: moment.Moment): number | null {
	if (typeof passage.minutes_until_departure === 'number' && !Number.isNaN(passage.minutes_until_departure)) {
		return Math.max(0, Math.floor(passage.minutes_until_departure));
	}
	const rawTime = passage.expected_departure_time || passage.departure_time || passage.passage_time;
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

export function parsePassageData(passages: Passage[]): any {
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
	const sortedTime = time.sort((a: any, b: any) => a - b);
	for (let i = 0; i < sortedTime.length; i++) {
		if (parseInt(sortedTime[i], 10) < 2) {
			sortedTime[i] = 'Proche !!';
		}
	}
	return [...new Set(sortedTime)];
}
