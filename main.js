/**
 * Claudian Usage Bars v1.0
 * Shows Claude Max usage (5h, 7d, Sonnet) in the Claudian header.
 *
 * Rate-limit safe:
 *   - API call max every 3 minutes (timer-based)
 *   - Cooldown: skips if last call was < 60s ago
 *   - Local countdown for tooltip reset times (no API needed)
 *   - NO MutationObserver on messages (caused 17k calls)
 */

const { Plugin } = require('obsidian');
const https = require('https');
const { execSync } = require('child_process');

const API_INTERVAL = 180_000;   // 3 minutes between API calls
const MIN_COOLDOWN = 60_000;    // minimum 60s between any two calls
const TOOLTIP_INTERVAL = 30_000; // local tooltip countdown every 30s
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

class ClaudianUsagePlugin extends Plugin {
  apiTimer = null;
  tooltipTimer = null;
  lastApiCall = 0;
  resets = {};
  container = null;

  async onload() {
    // Wait for Claudian header to appear
    this.registerInterval(
      window.setInterval(() => this.tryInject(), 2000)
    );
  }

  onunload() {
    if (this.container) this.container.remove();
    if (this.apiTimer) clearInterval(this.apiTimer);
    if (this.tooltipTimer) clearInterval(this.tooltipTimer);
  }

  tryInject() {
    const header = document.querySelector('.claudian-header');
    if (!header || document.querySelector('.claudian-usage-bars')) return;

    this.buildDOM(header);
    this.fetchAndUpdate();

    // API refresh every 3 minutes
    this.apiTimer = this.registerInterval(
      window.setInterval(() => this.fetchAndUpdate(), API_INTERVAL)
    );

    // Local tooltip countdown every 30s
    this.tooltipTimer = this.registerInterval(
      window.setInterval(() => this.updateTooltips(), TOOLTIP_INTERVAL)
    );

    // ResizeObserver for responsive
    const ro = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      this.container.classList.toggle('usage-compact', w < 500);
      this.container.classList.toggle('usage-minimal', w < 400);
      this.container.classList.toggle('usage-hidden', w < 300);
    });
    ro.observe(header);
    this.register(() => ro.disconnect());
  }

  buildDOM(header) {
    const actions = header.querySelector('.claudian-header-actions');
    this.container = document.createElement('div');
    this.container.className = 'claudian-usage-bars';

    this.container.appendChild(this.makeBar('5h', '5h', '5h'));
    this.container.appendChild(this.makeBar('7d', '7d', '7d'));
    this.container.appendChild(this.makeBar('s7d', 'Sonnet', 's7d'));

    header.insertBefore(this.container, actions);
  }

  makeBar(id, label, barAttr) {
    const group = document.createElement('div');
    group.className = 'claudian-usage-bar-group';
    group.dataset.bar = barAttr;

    const lbl = document.createElement('span');
    lbl.className = 'claudian-usage-bar-label';
    lbl.textContent = label;

    const track = document.createElement('div');
    track.className = 'claudian-usage-bar-track';

    const fill = document.createElement('div');
    fill.className = 'claudian-usage-bar-fill';
    fill.id = 'usage-fill-' + id;
    fill.style.width = '0%';
    fill.dataset.level = 'ok';
    track.appendChild(fill);

    const val = document.createElement('span');
    val.className = 'claudian-usage-bar-value';
    val.id = 'usage-val-' + id;
    val.textContent = '-%';
    val.dataset.level = 'ok';

    const tooltip = document.createElement('div');
    tooltip.className = 'claudian-usage-tooltip';
    tooltip.id = 'usage-tip-' + id;

    group.appendChild(lbl);
    group.appendChild(track);
    group.appendChild(val);
    group.appendChild(tooltip);
    return group;
  }

  getAccessToken() {
    try {
      const raw = execSync(
        'security find-generic-password -s "Claude Code-credentials" -w',
        { encoding: 'utf8', timeout: 5000 }
      );
      return JSON.parse(raw.trim()).claudeAiOauth.accessToken;
    } catch (e) {
      console.error('Claudian Usage: token error', e.message);
      return null;
    }
  }

  apiGet(token) {
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.anthropic.com',
        path: '/api/oauth/usage',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer ' + token,
          'anthropic-beta': 'oauth-2025-04-20',
          'Content-Type': 'application/json',
        },
      }, (res) => {
        let data = '';
        res.on('data', (c) => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    });
  }

  async fetchAndUpdate() {
    // Cooldown check
    const now = Date.now();
    if (now - this.lastApiCall < MIN_COOLDOWN) return;
    this.lastApiCall = now;

    const token = this.getAccessToken();
    if (!token) return;

    try {
      const d = await this.apiGet(token);
      if (d.error) {
        console.warn('Claudian Usage: API error', d.error.message);
        return;
      }

      // Store reset times for local countdown
      this.resets = {
        '5h': d.five_hour?.resets_at,
        '7d': d.seven_day?.resets_at,
        's7d': d.seven_day_sonnet?.resets_at,
      };

      this.setBar('5h', d.five_hour?.utilization ?? 0);
      this.setBar('7d', d.seven_day?.utilization ?? 0);
      this.setBar('s7d', d.seven_day_sonnet?.utilization ?? 0);
      this.updateTooltips();
    } catch (e) {
      console.warn('Claudian Usage: fetch error', e.message);
    }
  }

  setBar(id, val) {
    const fill = document.getElementById('usage-fill-' + id);
    const valEl = document.getElementById('usage-val-' + id);
    if (!fill || !valEl) return;
    const r = Math.round(val);
    const lvl = val >= 80 ? 'critical' : val >= 50 ? 'warning' : 'ok';
    fill.style.width = r + '%';
    fill.dataset.level = lvl;
    valEl.textContent = r + '%';
    valEl.dataset.level = lvl;
  }

  updateTooltips() {
    const tip5h = document.getElementById('usage-tip-5h');
    const tip7d = document.getElementById('usage-tip-7d');
    const tipS = document.getElementById('usage-tip-s7d');
    if (tip5h && this.resets['5h']) tip5h.textContent = this.fmtRelative(this.resets['5h']);
    if (tip7d && this.resets['7d']) tip7d.textContent = this.fmtAbsolute(this.resets['7d']);
    if (tipS && this.resets['s7d']) tipS.textContent = this.fmtAbsolute(this.resets['s7d']);
  }

  fmtRelative(iso) {
    const diff = new Date(iso) - new Date();
    if (diff <= 0) return 'Reset jetzt';
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h < 1) return 'Reset in ' + m + 'min';
    return 'Reset in ' + h + 'h ' + m + 'min';
  }

  fmtAbsolute(iso) {
    const d = new Date(iso);
    const day = DAYS[d.getDay()];
    const date = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const time = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    return 'Reset: ' + day + ' ' + date + ', ' + time;
  }
}

module.exports = ClaudianUsagePlugin;
