export interface TamCardConfig {
	type: string;
	stop: string;
	direction: string;
	backgroundColor: string;
	textColor: string;
	apiHost?: string;
	api_host?: string;
}

export interface Stop {
	stop_id?: string;
	stop_name: string;
}

export interface Passage {
	route_short_name?: string | number;
	trip_headsign: string;
	stop_name?: string;
	departure_time?: string;
	expected_departure_time?: string;
	passage_time?: string;
	minutes_until_departure?: number;
}

export interface StopApiResponse {
	data?: Stop[];
	stops?: Stop[];
}

export interface PassageApiResponse {
	data?: Passage[];
	passages?: Passage[];
}
