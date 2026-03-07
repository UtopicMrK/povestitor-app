// ═══════════════════════════════════════════
//  Povestitor Magic — PWA Companion App
//  Comunicare cu ESP32 prin JSON API
// ═══════════════════════════════════════════

const App = {
  baseUrl: '',
  refreshTimer: null,
  connected: false,
  currentTab: 'home',

  // ─── Story emoji mapping ───
  storyEmojis: {
    'Frozen':       '\u2744\uFE0F',   // snowflake
    'Scufita':      '\u{1F9E3}',      // red scarf
    'Purcelus':     '\u{1F437}',      // pig
    'Alba':         '\u{1F34E}',      // apple
    'Cenusareasa':  '\u{1F451}',      // crown
    'Dinozaur':     '\u{1F995}',      // dino
    'libera':       '\u{2728}',       // sparkles
    'default':      '\u{1F4D6}'       // book
  },

  // ─── INIT ───
  init() {
    const savedIP = localStorage.getItem('povestitor_ip');
    if (savedIP) {
      document.getElementById('ip-input').value = savedIP;
      this.tryAutoConnect(savedIP);
    }

    // Enter key on IP input
    document.getElementById('ip-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.connect();
    });
  },

  // ─── AUTO CONNECT ───
  async tryAutoConnect(ip) {
    this.baseUrl = 'http://' + ip;
    try {
      const r = await this.fetchAPI('/api/status', 3000);
      if (r && r.version) {
        this.connected = true;
        this.showApp();
        this.updateAll(r);
        this.startRefresh();
      }
    } catch (e) {
      // Silent fail — show connect screen
    }
  },

  // ─── CONNECT BUTTON ───
  async connect() {
    const ip = document.getElementById('ip-input').value.trim();
    const errorEl = document.getElementById('connect-error');
    const btn = document.getElementById('btn-connect');

    if (!ip) {
      errorEl.textContent = 'Introdu adresa IP a dispozitivului';
      return;
    }

    // Show loading
    btn.querySelector('.btn-text').textContent = 'Se conecteaza...';
    btn.querySelector('.btn-loader').style.display = 'inline-block';
    btn.disabled = true;
    errorEl.textContent = '';

    this.baseUrl = 'http://' + ip;

    try {
      const r = await this.fetchAPI('/api/status', 5000);
      if (r && r.version) {
        localStorage.setItem('povestitor_ip', ip);
        this.connected = true;
        this.showApp();
        this.updateAll(r);
        this.startRefresh();
      } else {
        throw new Error('Raspuns invalid');
      }
    } catch (e) {
      errorEl.textContent = 'Nu pot conecta. Verifica IP-ul si ca esti pe aceeasi retea WiFi.';
    } finally {
      btn.querySelector('.btn-text').textContent = 'Conecteaza';
      btn.querySelector('.btn-loader').style.display = 'none';
      btn.disabled = false;
    }
  },

  // ─── DISCONNECT ───
  disconnect() {
    localStorage.removeItem('povestitor_ip');
    this.connected = false;
    this.stopRefresh();
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('screen-connect').classList.add('active');
  },

  // ─── SHOW APP ───
  showApp() {
    document.getElementById('screen-connect').classList.remove('active');
    document.getElementById('app-container').style.display = 'block';
  },

  // ─── API FETCH HELPER ───
  async fetchAPI(endpoint, timeout = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const r = await fetch(this.baseUrl + endpoint, {
        signal: controller.signal
      });
      clearTimeout(timer);
      return await r.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  },

  async postAPI(endpoint, data, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const r = await fetch(this.baseUrl + endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      clearTimeout(timer);
      return await r.json();
    } catch (e) {
      clearTimeout(timer);
      throw e;
    }
  },

  // ─── AUTO REFRESH ───
  startRefresh() {
    this.stopRefresh();
    this.refreshTimer = setInterval(() => this.refresh(), 5000);
  },

  stopRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  },

  async refresh() {
    try {
      const r = await this.fetchAPI('/api/status', 4000);
      if (r && r.version) {
        this.updateAll(r);
        this.setConnectionDot(true);
      }
    } catch (e) {
      this.setConnectionDot(false);
    }
  },

  setConnectionDot(connected) {
    const dot = document.getElementById('connection-dot');
    dot.className = connected ? 'dot dot-green' : 'dot dot-red';
    dot.title = connected ? 'Conectat' : 'Deconectat';
  },

  // ─── UPDATE ALL UI ───
  updateAll(status) {
    // Home tab
    document.getElementById('home-story').textContent = status.storyName || 'Niciuna';
    document.getElementById('home-messages').textContent = status.messages;
    document.getElementById('home-rssi').textContent = status.wifi.rssi + ' dBm';
    document.getElementById('home-uptime').textContent = this.formatUptime(status.uptime);

    // State with color
    const stateEl = document.getElementById('home-state');
    const stateNames = {
      idle: 'Gata', recording: 'Inregistreaza',
      processing: 'Proceseaza', speaking: 'Vorbeste', menu: 'Meniu'
    };
    stateEl.textContent = stateNames[status.state] || status.state;
    stateEl.className = 'stat-value state-' + status.state;

    const dotEl = document.getElementById('state-dot');
    dotEl.className = 'stat-icon state-' + status.state;

    // Volume
    const slider = document.getElementById('vol-slider');
    slider.value = status.volume;
    slider.style.setProperty('--vol-pct', status.volume + '%');
    document.getElementById('vol-value').textContent = status.volume + '%';
    this.updateVolIcon(status.volume);

    // Settings tab
    document.getElementById('set-version').textContent = 'v' + status.version;
    document.getElementById('set-heap').textContent = Math.round(status.heap / 1024) + ' KB';
    document.getElementById('set-uptime').textContent = this.formatUptime(status.uptime);
    document.getElementById('set-wifi-ssid').textContent = status.wifi.ssid || 'AP Mode';
    document.getElementById('set-wifi-rssi').textContent = status.wifi.rssi + ' dBm';
    document.getElementById('set-wifi-ip').textContent = status.wifi.ip;
  },

  formatUptime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + s + 's';
    return s + 's';
  },

  // ─── TAB SWITCHING ───
  switchTab(tab) {
    this.currentTab = tab;

    // Update tab bar
    document.querySelectorAll('.tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(c => {
      c.classList.toggle('active', c.id === 'tab-' + tab);
    });

    // Load data for specific tabs
    if (tab === 'stories') this.loadStories();
    if (tab === 'settings') this.loadWifiInfo();
  },

  // ─── STORIES ───
  async loadStories() {
    try {
      const r = await this.fetchAPI('/api/stories');
      const grid = document.getElementById('stories-list');
      grid.innerHTML = '';

      r.stories.forEach(s => {
        const card = document.createElement('div');
        card.className = 'story-card' + (s.active ? ' active' : '');
        card.onclick = () => this.selectStory(s.id, s.title);

        const emoji = this.getStoryEmoji(s.title);
        card.innerHTML = `
          <span class="story-emoji">${emoji}</span>
          <div class="story-title">${this.escapeHtml(s.title)}</div>
          ${s.source === 'github' ? '<span class="story-badge">GitHub</span>' : ''}
        `;
        grid.appendChild(card);
      });
    } catch (e) {
      this.toast('Eroare la incarcarea povestilor');
    }
  },

  getStoryEmoji(title) {
    const t = title.toLowerCase();
    for (const [key, emoji] of Object.entries(this.storyEmojis)) {
      if (t.includes(key.toLowerCase())) return emoji;
    }
    return this.storyEmojis.default;
  },

  async selectStory(id, title) {
    if (!confirm('Selectezi povestea "' + title + '"?\nConversatia curenta va fi resetata.')) return;

    try {
      const r = await this.postAPI('/api/story/select', { id });
      if (r.ok) {
        this.toast('Poveste selectata: ' + title);
        this.loadStories();
        this.refresh();
      }
    } catch (e) {
      this.toast('Eroare la selectare');
    }
  },

  // ─── VOLUME ───
  onVolumeSlide(val) {
    val = parseInt(val);
    document.getElementById('vol-value').textContent = val + '%';
    document.getElementById('vol-slider').style.setProperty('--vol-pct', val + '%');
    this.updateVolIcon(val);
  },

  async setVolume(val) {
    val = parseInt(val);
    document.getElementById('vol-slider').value = val;
    this.onVolumeSlide(val);

    try {
      await this.postAPI('/api/volume', { volume: val });
    } catch (e) {
      this.toast('Eroare la setarea volumului');
    }
  },

  updateVolIcon(vol) {
    vol = parseInt(vol);
    const icon = document.getElementById('vol-icon');
    if (vol === 0)      icon.textContent = '\u{1F507}';   // muted
    else if (vol <= 33) icon.textContent = '\u{1F508}';   // low
    else if (vol <= 66) icon.textContent = '\u{1F509}';   // medium
    else                icon.textContent = '\u{1F50A}';   // high
  },

  // ─── RESET CONVERSATION ───
  async resetConversation() {
    if (!confirm('Resetezi conversatia? Istoricul va fi sters.')) return;

    try {
      const r = await this.postAPI('/api/reset', {});
      if (r.ok) {
        this.toast('Conversatia a fost resetata');
        this.refresh();
      }
    } catch (e) {
      this.toast('Eroare la resetare');
    }
  },

  // ─── WIFI ───
  async loadWifiInfo() {
    try {
      const r = await this.fetchAPI('/api/wifi');
      document.getElementById('set-wifi-ssid').textContent = r.ssid || 'AP Mode';
      document.getElementById('set-wifi-rssi').textContent = r.rssi + ' dBm';
      document.getElementById('set-wifi-ip').textContent = r.ip;
      document.getElementById('set-wifi-mac').textContent = r.mac;
    } catch (e) {
      // Silent — data already from status
    }
  },

  async saveWifi() {
    const ssid = document.getElementById('wifi-ssid').value.trim();
    const pass = document.getElementById('wifi-pass').value;

    if (!ssid || !pass) {
      this.toast('Completeaza SSID-ul si parola');
      return;
    }

    if (!confirm('Salvezi WiFi "' + ssid + '"?\nDispozitivul va reporni.')) return;

    try {
      await this.postAPI('/api/wifi', { ssid, pass });
      this.toast('WiFi salvat! Dispozitivul reporneste...');
      this.stopRefresh();
      this.setConnectionDot(false);
    } catch (e) {
      // May timeout because device restarts — that's OK
      this.toast('WiFi salvat! Dispozitivul reporneste...');
      this.stopRefresh();
      this.setConnectionDot(false);
    }
  },

  // ─── TOAST ───
  toast(message) {
    // Remove existing
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = message;
    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.classList.add('show');
    });

    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 300);
    }, 2500);
  },

  // ─── UTILITIES ───
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ─── START ───
document.addEventListener('DOMContentLoaded', () => App.init());
