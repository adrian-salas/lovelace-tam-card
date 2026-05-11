import { LitElement, html, property, TemplateResult, CSSResult, css } from 'lit-element';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';

import { TamCardConfig } from './types';
import { fetchPassages, fetchStops, normalizeApiHost } from './utils';

export class TamCardEditor extends LitElement implements LovelaceCardEditor {
	@property() public hass?: HomeAssistant;
	@property() private _config?: TamCardConfig;
	@property() private stops: string[] = [];
	@property() private directions: string[] = [];
	@property() private routes: string[] = [];
	@property() private loadingStops = false;
	@property() private loadingDirections = false;
	@property() private loadingRoutes = false;
	@property() private loadingError?: string;

	public async setConfig(config: TamCardConfig): Promise<void> {
		this._config = config;
		await this.loadStops();
		if (this._config.stop) {
			await this.loadDirectionsAndRoutes(this._config.stop);
		}
	}

	get _stop(): string {
		if (this._config) {
			return this._config.stop || '';
		}
		return '';
	}

	get _direction(): string {
		if (this._config) {
			return this._config.direction || '';
		}
		return '';
	}

	get _route(): string {
		if (this._config) {
			return this._config.route_short_name || '';
		}
		return '';
	}

	get _backgroundColor(): string {
		if (this._config) {
			return this._config.backgroundColor || '';
		}
		return '';
	}

	get _textColor(): string {
		if (this._config) {
			return this._config.textColor || '';
		}
		return '';
	}

	get _apiHost(): string {
		if (this._config) {
			return this._config.api_host || '';
		}
		return '';
	}

	protected async loadStops(): Promise<void> {
		if (!this._config) {
			return;
		}
		this.loadingStops = true;
		this.loadingError = undefined;
		try {
			this.stops = await fetchStops(this._apiHost);
		} catch (error) {
			this.stops = [];
			this.loadingError = "Impossible de charger les arrets depuis l'API";
			console.error(error);
		} finally {
			this.loadingStops = false;
		}
	}

	protected async loadDirectionsAndRoutes(stopName: string): Promise<void> {
		if (!stopName) {
			this.directions = [];
			this.routes = [];
			return;
		}
		this.loadingDirections = true;
		this.loadingRoutes = true;
		this.loadingError = undefined;
		try {
			const passages = await fetchPassages(this._apiHost, stopName, 50);
			const directions = passages
				.map(passage => passage.trip_headsign)
				.filter(direction => Boolean(direction));
			const routes = passages
				.map(passage => passage.route_short_name)
				.filter(route => Boolean(route));

			this.directions = [...new Set(directions)].sort();
			this.routes = [...new Set(routes)].sort();
		} catch (error) {
			this.directions = [];
			this.routes = [];
			this.loadingError = "Impossible de charger les directions/routes depuis l'API";
			console.error(error);
		} finally {
			this.loadingDirections = false;
			this.loadingRoutes = false;
		}
	}

	protected render(): TemplateResult | void {
		if (!this.hass || !this._config) {
			return html`
				<div class="card-config">
					<div class="description">
						<p>Veuillez patienter le temps de charger les arrêts / directions disponibles.</p>
					</div>
				</div>
			`;
		}

		return html`
			<div class="card-config">
				<div class="description">
					<p>
						Si votre arrêt / direction n'est pas disponible après le chargement, réessayer ultérieurement.
					</p>
					${this.loadingError
						? html`
								<p>${this.loadingError}</p>
						  `
						: html``}
				</div>
				<div class="option1">
					<div class="values">
						<ha-textfield
							label="Couleur du fond"
							@input=${this._valueChanged}
							.configValue=${'backgroundColor'}
							.value=${this._backgroundColor}
							@closed=${(ev): void => ev.stopPropagation()}
						>
						</ha-textfield>
					</div>
					<div class="values">
						<ha-textfield
							label="Couleur du texte"
							@input=${this._valueChanged}
							.configValue=${'textColor'}
							.value=${this._textColor}
							@closed=${(ev): void => ev.stopPropagation()}
						>
						</ha-textfield>
					</div>
					<div class="values">
						<ha-textfield
							label="API Host (optionnel)"
							@input=${this._valueChanged}
							.configValue=${'api_host'}
							.value=${this._apiHost}
							@closed=${(ev): void => ev.stopPropagation()}
						>
						</ha-textfield>
					</div>
				</div>
				<div class="option2">
					<div class="values">
						<ha-select
							label="Arrêt"
							@selected=${this._valueChanged}
							.configValue=${'stop'}
							.value=${this._stop}
							@closed=${(ev): void => ev.stopPropagation()}
						>
							${this.loadingStops
								? html`
										<mwc-list-item .value=${''}>Chargement...</mwc-list-item>
								  `
								: this.stops.map(val => {
										return html`
											<mwc-list-item .value="${val}">${val}</mwc-list-item>
										`;
								  })}
						</ha-select>
					</div>
					${this._config.stop
						? html`
								<div class="values">
									<ha-select
										label="Route (optionnel - ex: T1, 3, 4)"
										@selected=${this._valueChanged}
										.configValue=${'route_short_name'}
										.value=${this._route}
										@closed=${(ev): void => ev.stopPropagation()}
									>
										<mwc-list-item .value=${''}>Toutes les routes</mwc-list-item>
										${this.loadingRoutes
											? html`
													<mwc-list-item .value=${''}>Chargement...</mwc-list-item>
											  `
											: this.routes.map(val => {
													return html`
														<mwc-list-item .value="${val}">Route ${val}</mwc-list-item>
													`;
											  })}
									</ha-select>
								</div>
						  `
						: html``}
					${this._config.stop
						? html`
								<div class="values">
									<ha-select
										label="Direction (optionnel)"
										@selected=${this._valueChanged}
										.configValue=${'direction'}
										.value=${this._direction}
										@closed=${(ev): void => ev.stopPropagation()}
									>
										<mwc-list-item .value=${''}>Toutes les directions</mwc-list-item>
										${this.loadingDirections
											? html`
													<mwc-list-item .value=${''}>Chargement...</mwc-list-item>
											  `
											: this.directions.map(val => {
													return html`
														<mwc-list-item .value="${val}">${val}</mwc-list-item>
													`;
											  })}
									</ha-select>
								</div>
						  `
						: html``}
				</div>
			</div>
		`;
	}

	private async _valueChanged(ev): Promise<void> {
		if (!this._config || !this.hass) {
			return;
		}
		const target = ev.target;
		if (this[`_${target.configValue}`] === target.value) {
			return;
		}

		if (target.configValue) {
			if (target.value === '') {
				delete this._config[target.configValue];
			} else {
				this._config = {
					...this._config,
					[target.configValue]: target.checked !== undefined ? target.checked : target.value,
				};
			}
		}

		if (target.configValue === 'api_host') {
			this._config.api_host = normalizeApiHost(this._config.api_host);
			this._config.stop = '';
			this._config.direction = '';
			this._config.route_short_name = '';
			this.stops = [];
			this.directions = [];
			this.routes = [];
			await this.loadStops();
		}

		if (target.configValue === 'stop') {
			this._config.direction = '';
			this._config.route_short_name = '';
			this.directions = [];
			this.routes = [];
			await this.loadDirectionsAndRoutes(target.value);
		}

		fireEvent(this, 'config-changed', { config: this._config });
	}

	static get styles(): CSSResult {
		return css`
			.card-config {
				width: 95%;
				height: 100%;
				margin: auto;
			}
			.option1 {
				display: flex;
				margin: auto;
				height: auto;
				flex-wrap: wrap;
			}
			.option2 {
				display: flex;
				margin: auto;
				height: 71vh;
				flex-direction: column;
			}
			.description {
				padding: 1em;
				margin: auto;
				max-width: 40em;
				font-size: 1em;
			}
			ha-select,
			ha-textfield {
				padding: 1em;
				width: 16em;
			}
			:host {
				--mdc-menu-max-height: 65vh;
			}
		`;
	}
}
customElements.define('tam-card-editor', TamCardEditor);
