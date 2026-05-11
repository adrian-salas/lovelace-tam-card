import { LitElement, html, property, CSSResult, TemplateResult, css } from 'lit-element';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';

import './editor';

import { fetchPassages, normalizeApiHost, parsePassageData } from './utils';
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
		return {};
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
		};
	}

	protected timeConvert(n: number, nb: number): string {
		const num = n;
		const hours = num / 60;
		const rhours = Math.floor(hours);
		const minutes = (hours - rhours) * 60;
		const rminutes = Math.round(minutes);
		if (rhours != 0) return rhours + ' h ' + rminutes + ' min';
		else if (nb === 1) return rminutes + ' minutes';
		else return rminutes + ' min';
	}

	protected sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	protected checkBackgroundColor(number: string | number): string {
		if (this._config?.backgroundColor) {
			if (this._config?.backgroundColor !== 'auto')
				return validateColor(this._config?.backgroundColor) ? this._config?.backgroundColor : color[number];
		}
		return color[number];
	}

	protected checkTextColor(defaultColor: string): string {
		if (this._config?.textColor) {
			if (this._config?.textColor !== 'auto')
				return validateColor(this._config?.textColor) ? this._config?.textColor : defaultColor;
		}
		return defaultColor;
	}

	protected async fetchPassagesWithRetry(stopName: string, retries = 2): Promise<Passage[]> {
		let attempts = 0;
		const apiHost = normalizeApiHost(this._config?.api_host);
		while (attempts <= retries) {
			try {
				const passages = await fetchPassages(apiHost, stopName, 5);
				let filtered = passages;

				// Filter by direction if specified
				if (this._config?.direction) {
					filtered = filtered.filter(passage => passage.trip_headsign === this._config?.direction);
				}

				// Filter by route if specified
				if (this._config?.route_short_name) {
					filtered = filtered.filter(passage => passage.route_short_name === this._config?.route_short_name);
				}

				return filtered;
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
			const resultToParse = await this.fetchPassagesWithRetry(this._config.stop);
			this.fetchedData = resultToParse;
		} catch (error) {
			console.error('Error fetching passages:', error);
			this.fetchedData = [];
		}
	}

	protected async waitFetchApi(): Promise<void> {
		if (this.waitFetch === false) {
			this.waitFetch = true;
			await this.fetchDataApi();
			await this.sleep(20000);
			this.waitFetch = false;
		}
	}

	protected renderPassageRow(passage: Passage, index: number): TemplateResult {
		const minutes = passage.minutes_from_now;
		const noConversion = minutes < 2 || minutes === null;
		const isClosing = minutes < 2;
		const routeNum = passage.route_short_name || '?';
		const direction = passage.trip_headsign?.toLowerCase() || 'Unknown';

		return html`
			<div
				class="passage-row ${isClosing ? 'closing' : ''}"
				style="background-color: ${this.checkBackgroundColor(routeNum)}; color: ${this.checkTextColor('black')}"
			>
				<div class="passage-number">${index + 1}</div>
				<div class="route-badge">
					<ha-icon icon="${icon[routeNum] || 'mdi:tram'}"></ha-icon>
					<span class="route-name">${routeNum}</span>
				</div>
				<div class="passage-direction">${direction}</div>
				<div class="passage-time">
					${noConversion ? 'Proche !!' : this.timeConvert(minutes, 1)}
				</div>
			</div>
		`;
	}

	protected render(): TemplateResult | void {
		if (!this._config || !this.hass) {
			return html`
				<div class="card-preview">
					Veuillez sélectionner un arrêt
				</div>
			`;
		}

		this.waitFetchApi();

		if (!this.fetchedData) {
			return html`
				<ha-card>
					<p class="dot-loading">
						Chargement&nbsp<span>.</span><span>.</span><span>.</span><span>.</span><span>.</span>
					</p>
				</ha-card>
			`;
		}

		if (this.fetchedData.length === 0) {
			return html`
				<ha-card>
					<div class="card-content">
						<p>Aucun passage disponible pour ${this._config.stop}</p>
					</div>
				</ha-card>
			`;
		}

		return html`
			<ha-card>
				<div class="card-header">
					<h2 class="stop-name">${this._config.stop?.toLowerCase()}</h2>
				</div>
				<div class="passages-list">
					${this.fetchedData.slice(0, 5).map((passage, idx) => this.renderPassageRow(passage, idx))}
				</div>
			</ha-card>
		`;
	}

	static get styles(): CSSResult {
		return css`
			ha-card {
				display: block;
			}

			.card-preview {
				padding: 16px;
				text-align: center;
				color: #666;
			}

			.card-header {
				padding: 16px;
				border-bottom: 1px solid #e0e0e0;
			}

			.stop-name {
				margin: 0;
				font-size: 1.3em;
				font-weight: 600;
				text-transform: capitalize;
			}

			.passages-list {
				display: flex;
				flex-direction: column;
			}

			.passage-row {
				display: flex;
				align-items: center;
				padding: 12px 16px;
				border-bottom: 1px solid rgba(0, 0, 0, 0.1);
				gap: 12px;
				transition: opacity 0.3s;
			}

			.passage-row:last-child {
				border-bottom: none;
			}

			.passage-row.closing {
				animation: pulse 1s infinite;
			}

			.passage-number {
				font-weight: bold;
				min-width: 24px;
				text-align: center;
			}

			.route-badge {
				display: flex;
				align-items: center;
				gap: 6px;
				font-weight: 600;
				min-width: 50px;
			}

			.route-badge ha-icon {
				width: 20px;
				height: 20px;
			}

			.route-name {
				font-size: 0.9em;
			}

			.passage-direction {
				flex: 1;
				text-transform: capitalize;
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			.passage-time {
				font-weight: 600;
				min-width: 80px;
				text-align: right;
			}

			.card-content {
				padding: 16px;
				text-align: center;
				color: #666;
			}

			.dot-loading {
				font-size: 1.6em;
				text-align: center;
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

			@keyframes pulse {
				0% {
					opacity: 1;
				}
				50% {
					opacity: 0.6;
				}
				100% {
					opacity: 1;
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
	description: "La carte TAM Montpellier affiche les horaires des prochains TRAM / Bus d'un arrêt.",
});
