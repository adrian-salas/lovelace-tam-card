import { LitElement, html, property, CSSResult, TemplateResult, css } from 'lit-element';
import { HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';

import './editor';

import { fetchPassages, normalizeApiHost, parsePassageData } from './utils';
import { Passage, TamCardConfig, PassageWithRoute } from './types';
import { CARD_VERSION } from './const';

import { color } from './color';
import { icon } from './icon';

import { localize } from './localize/localize';
import validateColor from 'validate-color';
/* eslint no-console: 0 */
console.info(
	`%c	TAM-CARD \n%c	${localize('common.version')} ${CARD_VERSION}	`,
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
	@property() private fetchedData: PassageWithRoute[] | null = null;

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

	protected timeConvert(n: number): string {
		const num = n;
		const hours = Math.floor(num / 60);
		const minutes = num % 60;
		if (hours > 0) {
			return `${hours}h${minutes}`;
		}
		return `${minutes}min`;
	}

	protected sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}

	protected checkBackgroundColor(routeNumber: string | number): string {
		if (this._config?.backgroundColor) {
			if (this._config?.backgroundColor !== 'auto') {
				return validateColor(this._config?.backgroundColor) ? this._config?.backgroundColor : color[routeNumber];
			}
		}
		return color[routeNumber];
	}

	protected checkTextColor(defaultColor: string): string {
		if (this._config?.textColor) {
			if (this._config?.textColor !== 'auto') {
				return validateColor(this._config?.textColor) ? this._config?.textColor : defaultColor;
			}
		}
		return defaultColor;
	}

	protected filterPassages(passages: Passage[]): PassageWithRoute[] {
		return passages
			.filter(p => {
				if (this._config?.direction && p.trip_headsign !== this._config.direction) {
					return false;
				}
				if (this._config?.route_short_name && p.route_short_name !== this._config.route_short_name) {
					return false;
				}
				return true;
			})
			.slice(0, 5)
			.map(p => ({
				...p,
				displayRoute: p.route_short_name || '?',
				displayDirection: p.trip_headsign || 'Direction inconnue',
				displayTime: p.minutes_from_now ? this.timeConvert(Math.floor(p.minutes_from_now)) : 'Indisponible',
			}));
	}

	protected async fetchPassagesWithRetry(stopName: string, retries = 2): Promise<Passage[]> {
		let attempts = 0;
		const apiHost = normalizeApiHost(this._config?.api_host);
		while (attempts <= retries) {
			try {
				return await fetchPassages(apiHost, stopName, 50);
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
			const passages = await this.fetchPassagesWithRetry(this._config.stop);
			this.fetchedData = this.filterPassages(passages);
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

	protected render(): TemplateResult | void {
		if (!this._config || !this.hass) {
			return html`<p>Veuillez sélectionner un arrêt</p>`;
		}

		this.waitFetchApi();

		if (this.fetchedData === null) {
			return html`
				<p class="dot-loading">
					Chargement&nbsp<span>.</span><span>.</span><span>.</span><span>.</span><span>.</span>
				</p>
			`;
		}

		if (this.fetchedData.length === 0) {
			return html`
				<ha-card tabindex="0" aria-label="TAM">
					<div class="card-content">
						<p>Aucun passage disponible</p>
					</div>
				</ha-card>
			`;
		}

		return html`
			<ha-card tabindex="0" aria-label="TAM">
				<div class="card-header">
					<h2>${(this._config.stop as string)?.toLowerCase()}</h2>
				</div>
				<div class="card-content">
					${this.fetchedData.map((passage, index) => {
						const isFirst = index === 0;
						const proche = parseInt(passage.minutes_from_now?.toString() || '0', 10) < 2;
						return html`
							<div class="passage-row ${proche ? 'proche' : ''} ${isFirst ? 'first' : ''}">
								<div class="passage-route">
									<div class="route-badge" style="background-color: ${this.checkBackgroundColor(passage.displayRoute)}; color: ${this.checkTextColor('black')}">
										${passage.displayRoute}
									</div>
								</div>
								<div class="passage-info">
									<div class="direction">${passage.displayDirection?.toLowerCase()}</div>
								</div>
								<div class="passage-time">
									<div class="time ${proche ? 'blink' : ''}">${passage.displayTime}</div>
								</div>
							</div>
						`;
					})}
				</div>
			</ha-card>
		`;
	}

	static get styles(): CSSResult {
		return css`
			.card-header {
				padding: 16px;
				border-bottom: 1px solid #e0e0e0;
			}

			.card-header h2 {
				margin: 0;
				font-size: 1.3em;
				text-transform: capitalize;
			}

			.card-content {
				padding: 0;
			}

			.passage-row {
				display: flex;
				align-items: center;
				padding: 12px 16px;
				border-bottom: 1px solid #f0f0f0;
				gap: 12px;
				transition: background-color 0.2s;
			}

			.passage-row:last-child {
				border-bottom: none;
			}

			.passage-row.first {
				background-color: #f5f5f5;
				font-weight: 500;
			}

			.passage-row.proche {
				animation: blink 1.5s infinite;
			}

			.passage-route {
				flex-shrink: 0;
			}

			.route-badge {
				display: flex;
				align-items: center;
				justify-content: center;
				width: 40px;
				height: 40px;
				border-radius: 50%;
				font-weight: bold;
				font-size: 0.9em;
				box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
			}

			.passage-info {
				flex: 1;
				min-width: 0;
			}

			.direction {
				font-size: 0.95em;
				color: #333;
				text-transform: capitalize;
				white-space: nowrap;
				overflow: hidden;
				text-overflow: ellipsis;
			}

			.passage-time {
				flex-shrink: 0;
				text-align: right;
			}

			.time {
				font-size: 1em;
				font-weight: 500;
				color: #333;
				min-width: 60px;
			}

			.time.blink {
				color: #ff5722;
				animation: blink 1.5s infinite;
			}

			.dot-loading {
				padding: 20px;
				text-align: center;
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
					opacity: 1;
				}
				50% {
					opacity: 0.3;
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
	description: "La carte TAM Montpellier affiche les horaires des prochains TRAM / Bus d'un arrêt défini.",
});
