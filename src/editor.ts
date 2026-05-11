import { LitElement, html, property, TemplateResult, CSSResult, css } from 'lit-element';
import { HomeAssistant, fireEvent, LovelaceCardEditor } from 'custom-card-helpers';

import { TamCardConfig } from './types';
import { fetchPassages, fetchStops, normalizeApiHost } from './utils';

export class TamCardEditor extends LitElement implements LovelaceCardEditor {
	@property() public hass?: HomeAssistant;
	@property() private _config?: TamCardConfig;
	@property() private stops: string[] = [];
	@property() private routes: string[] = [];
	@property() private directions: string[] = [];
	@property() private loadingStops = false;
	@property() private loadingRoutes = false;
	@property() private loadingDirections = false;
	@property() private loadingError?: string;

	public async setConfig(config: TamCardConfig): Promise<void> {
		this._config = config;
		await this.loadStops();
		if (this._config.stop) {
			await this.loadRoutes(this._config.stop);
			if (this._config.route_short_name) {
				await this.loadDirections(this._config.stop, this._config.route_short_name);
			}
		}
	}

	get _stop(): string {
		if (this._config) {
			return this._config.stop || '';
		}
		return '';
	}

	get _route_short_name(): string {
		if (this._config) {
			return this._config.route_short_name || '';
		}
		return '';
	}

	get _direction(): string {
		if (this._config) {
			return this._config.direction || '';
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
			this.loadingError = "Impossible de charger les arrêts depuis l'API";
			console.error(error);
		} finally {
			this.loadingStops = false;
		}
	}

	protected async loadRoutes(stopName: string): Promise<void> {
		if (!stopName) {
			this.routes = [];
			return;
		}
		this.loadingRoutes = true;
		this.loadingError = undefined;
		try {
			const passages = await fetchPassages(this._apiHost, stopName, 50);
			const uniqueRoutes = [...new Set(passages.map(p => p.route_short_name))].filter(r => Boolean(r)).sort();
			this.routes = uniqueRoutes;
		} catch (error) {
			this.routes = [];
			this.loadingError = "Impossible de charger les lignes depuis l'API";
			console.error(error);
		} finally {
			this.loadingRoutes = false;
		}
	}

	protected async loadDirections(stopName: string, routeShortName: string): Promise<void> {
		if (!stopName || !routeShortName) {
			this.directions = [];
			return;
		}
		this.loadingDirections = true;
		this.loadingError = undefined;
		try {
			const passages = await fetchPassages(this._apiHost, stopName, 50);
			const filteredPassages = passages.filter(p => p.route_short_name === routeShortName);
			const uniqueDirections = [...new Set(filteredPassages.map(p => p.trip_headsign))].filter(d => Boolean(d)).sort();
			this.directions = uniqueDirections;
		} catch (error) {
			this.directions = [];
			this.loadingError = "Impossible de charger les directions depuis l'API";
			console.error(error);
		} finally {
			this.loadingDirections = false;
		}
	}

	protected render(): TemplateResult | void {
		if (!this.hass || !this._config) {
			return html`
				<div class="card-config">
					<div class="description">
						<p>Veuillez patienter le temps de charger les arrêts disponibles.</p>
					</div>
				</div>
			`;
		}

		return html`
			<div class="card-config">
				<div class="description">
					<p>Configuration du TAM Card - Laissez les champs vides pour afficher tous les passages</p>
					${this.loadingError ? html` <p style="color: red;">${this.loadingError}</p> ` : html``}
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
							label="Arrêt (Requis)"
							@selected=${this._valueChanged}
							.configValue=${'stop'}
							.value=${this._stop}
							@closed=${(ev): void => ev.stopPropagation()}
						>
							${this.loadingStops
								? html` <mwc-list-item .value=${''}>Chargement...</mwc-list-item> `
								: this.stops.map(val => {
										return html` <mwc-list-item .value="${val}">${val}</mwc-list-item> `;
								  })}
						</ha-select>
					</div>
					${this._config.stop
						? html`
								<div class="values">
									<ha-select
										label="Ligne (Optionnel)"
										@selected=${this._valueChanged}
										.configValue=${'route_short_name'}
										.value=${this._route_short_name}
										@closed=${(ev): void => ev.stopPropagation()}
									>
										<mwc-list-item .value=${''}>Toutes les lignes</mwc-list-item>
										${this.loadingRoutes
											? html` <mwc-list-item .value=${''}>Chargement...</mwc-list-item> `
											: this.routes.map(val => {
													return html` <mwc-list-item .value="${val}">${val}</mwc-list-item> `;
											  })}
									</ha-select>
								</div>
							  `
						: html``}
					${this._config.stop && this._config.route_short_name
						? html`
								<div class="values">
									<ha-select
										label="Direction (Optionnel)"
										@selected=${this._valueChanged}
										.configValue=${'direction'}
										.value=${this._direction}
										@closed=${(ev): void => ev.stopPropagation()}
									>
										<mwc-list-item .value=${''}>Toutes les directions</mwc-list-item>
										${this.loadingDirections
											? html` <mwc-list-item .value=${''}>Chargement...</mwc-list-item> `
											: this.directions.map(val => {
													return html` <mwc-list-item .value="${val}">${val}</mwc-list-item> `;
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
			this._config.route_short_name = '';
			this._config.direction = '';
			this.stops = [];
			this.routes = [];
			this.directions = [];
			await this.loadStops();
		}

		if (target.configValue === 'stop') {
			this._config.route_short_name = '';
			this._config.direction = '';
			this.routes = [];
			this.directions = [];
			await this.loadRoutes(target.value);
		}

		if (target.configValue === 'route_short_name') {
			this._config.direction = '';
			this.directions = [];
			if (target.value) {
				await this.loadDirections(this._config.stop!, target.value);
			}
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
				height: auto;
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
