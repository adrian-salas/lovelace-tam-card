export interface TamCardConfig {
	type: string;
	stop: string;
	direction: string;
	backgroundColor?: string;
	textColor?: string;
	api_host?: string;
}

export interface Passage {
	route_short_name: string;
	trip_headsign: string;
	scheduled_time: string;
	estimated_time: string;
	delay_seconds: number;
	minutes_from_now: number;
	stop_name: string;
}
