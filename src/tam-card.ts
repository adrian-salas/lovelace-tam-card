import { LitElement, html, property, CSSResult, TemplateResult, css } from 'lit-element';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';

import './editor';

import { fetchPassages, normalizeApiHost } from './utils';
import { Passage, TamCardConfig } from './types';
import { CARD_VERSION } from './const';

import { color } from './color';
import { icon } from './icon';

import { localize } from './localize/localize';
import validateColor from 'validate-color';
/* eslint no-console: 0 */
console.info(
	`%c\tTAM-CARD \n%c\t${localize('common.version')} ${CARD_VERSION}\t`,
	'color: orange; font-weight: bold; background: black',
	'color: white; font-weight: bold; background: dimgray',
);

export class TamCard extends LitElement {
	public static async getConfigElement(): Promise<LovelaceCardEditor> {
		return document.createElement('tam-card-editor') as LovelaceCardEditor;
	}

	public static getStubConfig(): object {
		return {
			stop: 'JUVIGNAC',
			api_host: 'http://localhost:8080',
			update_interval: 60,
			limit: 3,
		};
	}

	@property() public hass?: HomeAssistant;
	@property() private _config?: TamCardConfig;
	@property() private waitFetch = false;
	@property() private fetchedData: Passage[] | null = null;

	public async setConfig(config: TamCardConfig): Promise<void> {
		if (!config) {
			throw new Error(localize('common.invalid_configuration'));
		}
		if (!config.stop || config.stop.length === 0) {
			return;
		}

		this._config = {
			...config,
			update_interval: config.update_interval || 60,
			limit: config.limit || 3,
		};
	}

	protected timeConvert(n: number): string {
		const num = n;
		const hours = num / 60;
		const rhours = Math.floor(hours);
		const minutes = (hours - rhours) * 60;
		const rminutes = Math.round(minutes);
		if (rhours !== 0) return `${rhours}h ${rminutes}min`;
		else return `${rminutes}min`;
	}

	protected sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	protected checkBackgroundColor(routeShortName: string | number): string {
		if (this._config?.backgroundColor) {
			if (this._config?.backgroundColor !== 'auto')
				return validateColor(this._config?.backgroundColor)
					? this._config?.backgroundColor
					: color[routeShortName];
		}
		return color[routeShortName];
	}

	protected checkTextColor(defaultColor: string): string {
		if (this._config?.textColor) {
			if (this._config?.textColor !== 'auto')
				return validateColor(this._config?.textColor) ? this._config?.textColor : defaultColor;
		}
		return defaultColor;
	}

	protected async fetchPassagesWithRetry(stopName: string, limit: number, retries = 2): Promise<Passage[]> {
		let attempts = 0;
		const apiHost = normalizeApiHost(this._config?.api_host);
		while (attempts <= retries) {
			try {
				const passages = await fetchPassages(apiHost, stopName, 50);

				// Filter by route if specified
				let filtered = passages;
				if (this._config?.route_short_name) {
					filtered = passages.filter(p => p.route_short_name === this._config?.route_short_name);
				}

				// Filter by direction if specified
				if (this._config?.direction) {
					filtered = filtered.filter(p => p.trip_headsign === this._config?.direction);
				}

				// Limit to the configured number of passages
				return filtered.slice(0, limit);
			} catch (error) {
				attempts += 1;
				if (attempts > retries) {
					throw error;
				}
				await this.sleep(1000 * attempts);
			}
		}
		return [];
	}

	protected async fetchDataApi(): Promise<void> {
		if (!this._config?.stop) {
			return;
		}
		this.fetchedData = null;
		try {
			const limit = this._config.limit || 3;
			this.fetchedData = await this.fetchPassagesWithRetry(this._config.stop, limit);
		} catch (error) {
			console.error('Error fetching passages:', error);
			this.fetchedData = [];
		}
	}

	protected async waitFetchApi(): Promise<void> {
		if (this.waitFetch === false) {
			this.waitFetch = true;
			await this.fetchDataApi();
			const updateInterval = (this._config?.update_interval || 60) * 1000;
			await this.sleep(updateInterval);
			this.waitFetch = false;
		}
	}

	protected render(): TemplateResult | void {
		if (!this._config || !this.hass) {
			return html`
				Prévisualisation: Veuillez sélectionner un arrêt
			`;
		}

		this.waitFetchApi();

		if (!this.fetchedData) {
			return html`
				<p class="dot-loading">
					Chargement&nbsp<span>.</span><span>.</span><span>.</span><span>.</span><span>.</span>
				</p>
			`;
		}

		if (this.fetchedData.length === 0) {
			return html`
				<ha-card tabindex="0" aria-label="TAM">
					<div id="states" class="card-content">
						<div class="flex">
							<div class="text cap info">Aucun passage disponible</div>
						</div>
					</div>
				</ha-card>
			`;
		}

		return html`
			<ha-card tabindex="0" aria-label="TAM">
				${this.fetchedData.map(passage => {
					const proche = passage.minutes_from_now < 2;
					const noConversion = passage.minutes_from_now === undefined || passage.minutes_from_now < 0;
					const routeShortName = passage.route_short_name || '0';
					const backgroundColor = this.checkBackgroundColor(routeShortName);
					const textColor = this.checkTextColor('black');
					const cardIcon = icon[routeShortName] || icon[0];
					const time = noConversion ? 'Fin de service' : this.timeConvert(passage.minutes_from_now);

					return html`
						<div
							id="states"
							style="background-color: ${backgroundColor}; color: ${textColor}"
							class="${proche ? 'card-content clignote' : 'card-content'}"
						>
							<div class="flex">
								<div class="badge">
									<ha-icon icon="${cardIcon || 'mdi:tram'}"></ha-icon>
								</div>
								<div class="text cap info flexAlign">
									<div>${routeShortName}</div>
									&nbsp&nbsp
									<div>➜</div>
									&nbsp&nbsp
									<div>${(passage.trip_headsign || '')?.toLowerCase()}</div>
								</div>
								<div class="text right">${time}</div>
							</div>
						</div>
					`;
				})}
			</ha-card>
		`;
	}

	static get styles(): CSSResult {
		return css`
			.flex {
				display: flex;
				justify-content: space-between;
				align-items: center;
				min-width: 0px;
				flex: 1 1 0%;
			}
			.card-content {
				border-radius: 0.3em;
				padding: 12px;
				margin: 4px 0;
			}
			.flexAlign {
				display: flex;
			}
			.info {
				white-space: nowrap;
				text-overflow: ellipsis;
				overflow: hidden;
				flex: 1 0 60px;
				margin-left: 1em;
			}
			.right {
				text-align: right;
				font-weight: 600;
			}
			.cap {
				text-transform: capitalize;
			}
			.bold {
				font-weight: 700;
				font-size: 2em;
				margin-top: -0.1em;
			}
			.text {
				font-size: 1em;
			}
			.ha-icon {
				width: 20px;
				height: 20px;
			}
			.clignote {
				animation-duration: 2.5s;
				animation-name: clignoter;
				animation-iteration-count: infinite;
				transition: none;
			}
			@keyframes clignoter {
				0% {
					opacity: 1;
				}
				50% {
					opacity: 0.2;
				}
				100% {
					opacity: 1;
				}
			}
			.dot-loading {
				font-size: 1.6em;
			}

			.dot-loading span {
				font-size: 1.9em;
				animation-name: blink;
				animation-duration: 1.4s;
				animation-iteration-count: infinite;
				animation-fill-mode: both;
			}

			.dot-loading span:nth-child(2) {
				animation-delay: 0.2s;
			}

			.dot-loading span:nth-child(3) {
				animation-delay: 0.4s;
			}
			.dot-loading span:nth-child(4) {
				animation-delay: 0.6s;
			}
			.dot-loading span:nth-child(5) {
				animation-delay: 0.8s;
			}

			@keyframes blink {
				0% {
					opacity: 0.2;
				}
				20% {
					opacity: 1;
				}
				100% {
					opacity: 0.2;
				}
			}
		`;
	}
}

customElements.define('tam-card', TamCard);
((window as unknown) as Record<string, unknown>).customCards =
	((window as unknown) as Record<string, unknown>).customCards || [];
(((window as unknown) as Record<string, unknown>).customCards as unknown[]).push({
	type: 'tam-card',
	name: 'TAM Montpellier',
	preview: false,
	description: "La carte TAM Montpellier affiche les horaires des prochains TRAM / Bus d'un arrêt défini.",
});
