import { LitElement, html, css } from 'lit-element';

export class TamCard extends LitElement {
  public hass;
  private _config;

  public async setConfig(config) {
    console.log('setConfig called with:', config);
    this._config = config;
  }

  protected render() {
    return html`
      <div style="padding: 20px; background: #f0f0f0; border-radius: 8px; text-align: center;">
        <h2>🚊 TAM Card Test</h2>
        <p>If you see this, the card is working!</p>
        <p><strong>Stop:</strong> ${this._config?.stop || 'Not configured'}</p>
        <p><strong>Direction:</strong> ${this._config?.direction || 'Not configured'}</p>
      </div>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }
    `;
  }
}

customElements.define('tam-card', TamCard);
console.log('✅ tam-card registered!');
