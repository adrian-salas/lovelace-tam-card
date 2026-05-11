export interface TamCardConfig {
	type: string;
	stop: string;
	direction?: string;
	route_short_name?: string;
	backgroundColor?: string;
	textColor?: string;
	api_host?: string;
	update_interval?: number;
	limit?: number;
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
