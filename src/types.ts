export interface TamCardConfig {
	type: string;
	stop: string;
	direction: string;
	backgroundColor: string;
	textColor: string;
}

export interface AllDataTypes {
	route_id: string;
	route_short_name: string;
	trip_id: Array<string>;
	stop_name: string;
	trip_headsign: string;
	stop_id: string;
}
