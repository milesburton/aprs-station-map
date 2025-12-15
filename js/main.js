let leafletLoaded = false;
let togeojsonLoaded = false;

function checkAndInitialise() {
  console.log('Checking libraries…', { 
    leaflet: leafletLoaded, 
    togeojson: togeojsonLoaded 
  });
  if (leafletLoaded && togeojsonLoaded) {
    document.getElementById('loading').style.display = 'none';
    initialiseMap();
  }
}

function initialiseMap() {
  console.log('Initialising map…');
  
  const bexleyLat = 51.4416;
  const bexleyLng = 0.1500;
  
  let urlUpdateTimeout = null;
  window.currentSelectedStation = null;
  let isRestoringState = false;
  
  function encodeState() {
    if (isRestoringState) return;
    const state = {
      lat: map.getCenter().lat.toFixed(6),
      lng: map.getCenter().lng.toFixed(6),
      zoom: map.getZoom(),
      timeFilter: timeFilterEnabled,
      timeHours: maxAgeHours,
      plausibility: plausibilityFilterEnabled,
      directOnly: directOnlyFilterEnabled,
      digipeatedOnly: digipeatedOnlyFilterEnabled,
      rings: distanceRingsVisible,
      heatmap: heatmapVisible,
      tracks: mobilityTracksVisible,
      station: window.currentSelectedStation || null
    };
    const params = new URLSearchParams();
    Object.entries(state).forEach(([key, value]) => {
      if (value === null || 
          (key === 'lat' && Math.abs(value - 51.8) < 0.01) ||
          (key === 'lng' && Math.abs(value - 0.5) < 0.01) ||
          (key === 'zoom' && value === 8) ||
          (key === 'timeHours' && value === 24) ||
          (key === 'plausibility' && value === true) ||
          value === false) {
        return;
      }
      params.set(key, value);
    });
    const newHash = params.toString();
    if (window.location.hash.slice(1) !== newHash) {
      window.location.hash = newHash;
    }
  }
  
  function decodeState() {
    const hash = window.location.hash.slice(1);
    if (!hash) return null;
    try {
      const params = new URLSearchParams(hash);
      return {
        lat: parseFloat(params.get('lat')) || 51.8,
        lng: parseFloat(params.get('lng')) || 0.5,
        zoom: parseInt(params.get('zoom')) || 8,
        timeFilter: params.get('timeFilter') === 'true',
        timeHours: parseFloat(params.get('timeHours')) || 24,
        plausibility: params.get('plausibility') !== 'false',
        directOnly: params.get('directOnly') === 'true',
        digipeatedOnly: params.get('digipeatedOnly') === 'true',
        rings: params.get('rings') === 'true',
        heatmap: params.get('heatmap') === 'true',
        tracks: params.get('tracks') === 'true',
        station: params.get('station') || null
      };
    } catch (e) {
      console.error('Error parsing URL state:', e);
      return null;
    }
  }
  
  function updateUrlDebounced() {
    if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);
    urlUpdateTimeout = setTimeout(() => { encodeState(); }, 500);
  }
  function updateUrlImmediate() {
    if (urlUpdateTimeout) clearTimeout(urlUpdateTimeout);
    encodeState();
  }
  
  function copyShareUrl() {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      showFlashMessage('📋 Share URL copied to clipboard!', 'info');
    }).catch(() => {
      showFlashMessage('❌ Failed to copy URL', 'error');
    });
  }

  function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 +
              Math.cos(lat1 * Math.PI/180)*Math.cos(lat2 * Math.PI/180)*
              Math.sin(dLng/2)**2;
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function parseTimestamp(timestampStr) {
    if (!timestampStr) return null;
    try {
      let timestamp = new Date(timestampStr);
      if (isNaN(timestamp.getTime())) return null;
      return timestamp;
    } catch (e) {
      return null;
    }
  }

  function isPlausibleLocation(lat, lng) {
    if (!plausibilityFilterEnabled) {
      return !(lat === 0 && lng === 0);
    }
    if (lat === 0 && lng === 0) return false;
    const distance = calculateDistance(bexleyLat, bexleyLng, lat, lng);
    const maxPlausibleDistance = 600;
    return distance <= maxPlausibleDistance;
  }

  function getAgeCategory(timestamp) {
    if (!timestamp) return 'unknown';
    const now = new Date();
    const ageMinutes = (now - timestamp) / (1000 * 60);
    if (ageMinutes <= 30) return 'fresh';
    if (ageMinutes <= 120) return 'recent';
    if (ageMinutes <= 720) return 'old';
    return 'stale';
  }
  function getOpacityForAge(ageCategory) {
    switch (ageCategory) {
      case 'fresh': return 1.0;
      case 'recent': return 0.8;
      case 'old': return 0.6;
      case 'stale': return 0.4;
      default: return 0.7;
    }
  }
  function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown time';
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    let ageText;
    if (minutes < 1) ageText = 'Just now';
    else if (minutes < 60) ageText = `${minutes}m ago`;
    else if (hours < 24) ageText = `${hours}h ago`;
    else ageText = `${days}d ago`;
    return `${timestamp.toLocaleString()} (${ageText})`;
  }

  // State
  let distanceRingsVisible = false;
  let heatmapVisible = false;
  let mobilityTracksVisible = false;
  let timeFilterEnabled = false;
  let plausibilityFilterEnabled = true;
  let directOnlyFilterEnabled = false;
  let digipeatedOnlyFilterEnabled = false;
  let maxAgeHours = 24;

  let distanceRingsLayer = null;
  let heatmapLayer = null;
  let mobilityTracksLayer = null;

  let allStations = [];
  let allStationData = [];
  let allTrackData = [];
  let stationMarkers = {};

  function shouldShowStation(timestamp) {
    if (!timeFilterEnabled || !timestamp) return true;
    const now = new Date();
    const ageHours = (now - timestamp) / (1000 * 60 * 60);
    return ageHours <= maxAgeHours;
  }
  function shouldShowStationByReceptionType(isDirectReception) {
    if (directOnlyFilterEnabled && !isDirectReception) return false;
    if (digipeatedOnlyFilterEnabled && isDirectReception) return false;
    return true;
  }

  function showFlashMessage(message, type = 'info') {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'error' ? '#ff4444' : '#007acc'};
      color: white;
      padding: 10px 15px;
      border-radius: 5px;
      font-size: 14px;
      font-weight: bold;
      z-index: 10000;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
      transition: opacity 0.3s ease;
    `;
    flash.textContent = message;
    document.body.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = '0';
      setTimeout(() => { document.body.removeChild(flash); }, 300);
    }, 2000);
  }

  function makeCallsignsClickable(text, currentStationName) {
    const callsignPattern = /\b([A-Z0-9]{1,3}[0-9][A-Z0-9]*(?:-[0-9]+)?)\b/g;
    return text.replace(callsignPattern, (match, callsign) => {
      if (currentStationName.includes(callsign)) return match;
      return `<span class="clickable-callsign" onclick="goToCallsign('${callsign}')">${match}</span>`;
    });
  }

  window.goToCallsign = (callsign) => {
    console.log('Looking for callsign:', callsign);
    let found = null;
    for (const [stationName, marker] of Object.entries(stationMarkers)) {
      if (stationName.includes(callsign)) {
        found = { name: stationName, marker };
        break;
      }
    }
    if (found) {
      map.setView(found.marker.getLatLng(), 12);
      setTimeout(() => {
        found.marker.openPopup();
        window.currentSelectedStation = found.name;
        updateUrlImmediate();
        showFlashMessage(`📍 Found ${callsign}`, 'info');
      }, 500);
    } else {
      showFlashMessage(`⚠️ ${callsign} not in current view or filtered out`, 'error');
    }
  };

  function updateTimeFilterDisplay() {
    const valueElement = document.getElementById('time-filter-value');
    if (maxAgeHours < 1) {
      const minutes = Math.round(maxAgeHours * 60);
      valueElement.textContent = `${minutes} minutes`;
    } else if (maxAgeHours === 24) {
      valueElement.textContent = '24 hours (full day)';
    } else {
      valueElement.textContent = `${maxAgeHours.toFixed(1)} hours`;
    }
  }

  window.goToHome = () => {
    map.setView([bexleyLat, bexleyLng], 12);
    map.closePopup();
    window.currentSelectedStation = null;
    updateUrlImmediate();
  };
  window.goToStation = (name) => {
    const m = stationMarkers[name];
    if (m) {
      map.setView(m.getLatLng(), 12);
      setTimeout(() => {
        m.openPopup();
        window.currentSelectedStation = name;
        updateUrlImmediate();
      }, 500);
    } else {
      console.error('Station not found:', name);
    }
  };

  const initialState = decodeState();
  const initialLat = initialState ? initialState.lat : 51.8;
  const initialLng = initialState ? initialState.lng : 0.5;
  const initialZoom = initialState ? initialState.zoom : 8;

  const map = L.map('map').setView([initialLat, initialLng], initialZoom);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  map.on('moveend', updateUrlDebounced);
  map.on('zoomend', updateUrlDebounced);
  map.on('popupopen', (e) => {
    for (const [name, marker] of Object.entries(stationMarkers)) {
      if (marker === e.popup._source) {
        window.currentSelectedStation = name;
        updateUrlImmediate();
        break;
      }
    }
  });
  map.on('popupclose', () => {
    window.currentSelectedStation = null;
    updateUrlImmediate();
  });

  const homeStationIcon = L.divIcon({
    className: 'home-marker',
    html: `<div style="
      font-size:28px;
      text-align:center;
      line-height:36px;
      width:36px;height:36px;
      text-shadow:
        -2px -2px 0 #000,
         2px -2px 0 #000,
        -2px  2px 0 #000,
         2px  2px 0 #000,
        -1px -1px 0 #fff,
         1px -1px 0 #fff,
        -1px  1px 0 #fff,
         1px  1px 0 #fff;
      filter:drop-shadow(0 4px 8px rgba(0,0,0,0.6));
      cursor:pointer;
    ">☠️</div>`,
    iconSize: [36,36],
    iconAnchor: [18,18],
    popupAnchor: [0,-18]
  });
  L.marker([bexleyLat, bexleyLng], { icon: homeStationIcon })
    .bindPopup(`<div class="popup-content"><div class="station-name">☠️ M0LHA – Home Station</div><div class="station-description">Bexley, London<br>QTH (Home Station)<br><br>Raspberry Pi + Direwolf + SDR<br>Monitoring 144.800 MHz APRS<br><br>All stations shown were heard by M0LHA<br>either directly via RF or via digipeater network.<br><br>Monitoring APRS traffic with hacker spirit!</div></div>`)
    .addTo(map);

  const overlayControl = L.control({ position: 'topleft' });
  overlayControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'overlay-controls');
    div.style.cssText = `
      background:white;
      padding:8px;
      border:2px solid rgba(0,0,0,0.2);
      border-radius:5px;
      font:12px Arial, sans-serif;
      min-width: 140px;
    `;
    div.innerHTML = `
      <div style="margin-bottom:8px;"><strong>📡 Overlays</strong></div>
      <button id="toggle-rings" class="overlay-button">🎯 Distance Rings</button>
      <button id="toggle-heatmap" class="overlay-button">🔥 Station Density</button>
      
      <div class="section-divider">
        <div style="margin-bottom:8px;"><strong>🚗 Mobile Stations</strong></div>
        <button id="toggle-tracks" class="overlay-button">🛤️ Movement History</button>
        <div style="font-size:10px; color:#666; margin-top:4px; line-height:1.3;">
          <div><strong>Current Position:</strong> Station markers show last known location</div>
          <div><strong>Movement History:</strong> Orange lines trace station paths over time</div>
          <div><strong>Note:</strong> History shows all recorded movement, independent of time filter</div>
        </div>
      </div>

      <div class="time-filter-control">
        <div class="time-filter-label">⏰ Time Filter</div>
        <input type="range" id="time-filter-slider" class="time-filter-slider" 
               min="0.5" max="24" step="0.5" value="24">
        <div id="time-filter-value" class="time-filter-value">24 hours (full day)</div>
        <div class="filter-toggle">
          <input type="checkbox" id="time-filter-enabled">
          <label for="time-filter-enabled">Enable time filter</label>
        </div>
      </div>

      <div class="section-divider">
        <div style="margin-bottom:8px;"><strong>📡 Reception Type</strong></div>
        <div class="filter-toggle">
          <input type="checkbox" id="direct-only-filter-enabled">
          <label for="direct-only-filter-enabled">Show only direct reception</label>
        </div>
        <div style="font-size:9px; color:#888; margin-top:2px; line-height:1.2;">
          Direct RF reception by M0LHA (no digipeaters)
        </div>
        <div class="filter-toggle" style="margin-top:8px;">
          <input type="checkbox" id="digipeated-only-filter-enabled">
          <label for="digipeated-only-filter-enabled">Show only digipeated stations</label>
        </div>
        <div style="font-size:9px; color:#888; margin-top:2px; line-height:1.2;">
          Stations heard via MB7USE digipeater network
        </div>
      </div>

      <div class="section-divider">
        <div style="margin-bottom:8px;"><strong>🛡️ Data Filtering</strong></div>
        <div class="filter-toggle">
          <input type="checkbox" id="plausibility-filter-enabled" checked>
          <label for="plausibility-filter-enabled">Filter impossible locations</label>
        </div>
        <div style="font-size:9px; color:#888; margin-top:2px; line-height:1.2;">
          Removes stations beyond 600km range or at coordinates 0,0
        </div>
      </div>

      <div class="url-share-section">
        <div style="margin-bottom:6px;"><strong>🔗 Share</strong></div>
        <button id="copy-share-url" class="share-button">📋 Copy Share URL</button>
        <div style="font-size:9px; color:#888; margin-top:2px; line-height:1.2;">
          URL includes current view, filters, and selected station
        </div>
      </div>
      
      <div class="section-divider">
        <div style="margin-bottom:6px;"><strong>ℹ️ Information</strong></div>
        <div style="font-size:10px; color:#666; line-height:1.3;">
          <div><strong>Packet Age:</strong> Time since M0LHA last heard each station's APRS transmission</div>
          <div style="margin-top:4px;"><strong>Age Colors:</strong></div>
          <div style="margin-left:8px;">🟢 Fresh (0-30m) - Recently active</div>
          <div style="margin-left:8px;">🟡 Recent (30m-2h) - Active today</div>
          <div style="margin-left:8px;">🟠 Old (2-12h) - Older activity</div>
          <div style="margin-left:8px;">🔴 Stale (>12h) - Not recently heard</div>
          
          <div style="margin-top:6px;"><strong>Reception Types:</strong></div>
          <div style="margin-left:8px;">📡 Direct: M0LHA heard station directly via RF</div>
          <div style="margin-left:8px;">🔄 Digipeated: Heard via MB7USE digipeater network</div>
          <div style="margin-left:8px;">📶 Signal strength independent of reception path</div>
          
          <div style="margin-top:6px;"><strong>Technical:</strong></div>
          <div style="margin-left:8px;">📻 Frequency: 144.800 MHz (2m APRS)</div>
          <div style="margin-left:8px;">🖥️ M0LHA: Raspberry Pi + Direwolf + SDR</div>
          <div style="margin-left:8px;">📡 Max range: ~600km (2m VHF typical limit)</div>
        </div>
      </div>
    `;
    L.DomEvent.disableClickPropagation(div);
    return div;
  };
  overlayControl.addTo(map);

  function createDistanceRings() {
    const group = L.layerGroup();
    const dists = [25,50,75,100,125,150];
    const cols = ['#ff4444','#ff8800','#ffcc00','#88ff00','#00ff88','#0088ff'];
    dists.forEach((d,i) => {
      const c = L.circle([bexleyLat,bexleyLng], {
        radius: d*1000,
        fillColor: cols[i], fillOpacity:0.1,
        color: cols[i], weight:2, opacity:0.6
      });
      c.bindPopup(L.popup({
        closeButton:false, autoClose:false, closeOnClick:false, className:'distance-label'
      }).setContent(`${d} km from M0LHA (Bexley)`));
      group.addLayer(c);
    });
    return group;
  }

  function createCoverageHeatmap() {
    const visibleStations = allStationData.filter(s => 
      shouldShowStation(s.timestamp) && 
      isPlausibleLocation(s.lat, s.lng) && 
      shouldShowStationByReceptionType(s.isDirectReception)
    );
    if (!visibleStations.length) return null;
    const layer = L.layerGroup();
    visibleStations.forEach(s => {
      const isDirect = s.isDirectReception;
      layer.addLayer(L.circle([s.lat,s.lng], {
        radius:15000,
        fillColor: isDirect ? '#00ff00' : '#ff8800',
        fillOpacity: isDirect ? 0.16 : 0.12,
        color: isDirect ? '#00ff00' : '#ff8800',
        weight:1,
        opacity: isDirect ? 0.32 : 0.24
      }));
    });
    return layer;
  }

  function createMobilityTracks() {
    if (!allTrackData.length) return null;
    const layer = L.layerGroup();
    let trackCount = 0;
    allTrackData.forEach((track) => {
      if (track.name.includes('📶') || track.name.includes('➡')) return;
      const isDigipeated = track.name.includes('[Digipeated]');
      const isDirectReception = !isDigipeated;
      if (!shouldShowStationByReceptionType(isDirectReception)) return;
      let validCoords = [];
      let validWaypoints = [];
      for (let i = 0; i < track.coordinates.length; i++) {
        const coord = track.coordinates[i];
        if (coord[0] === 0 && coord[1] === 0) continue;
        if (plausibilityFilterEnabled && !isPlausibleLocation(coord[0], coord[1])) continue;
        if (timeFilterEnabled && track.waypoints && track.waypoints[i]) {
          if (!shouldShowStation(track.waypoints[i])) continue;
        }
        validCoords.push(coord);
        validWaypoints.push(track.waypoints ? track.waypoints[i] : null);
      }
      track.filteredWaypoints = validWaypoints;
      if (validCoords.length < 3) return;
      const trackColor = isDigipeated ? '#ff3300' : '#0066ff';
      const polyline = L.polyline(validCoords, {
        color: trackColor,
        weight: isDigipeated ? 3 : 4,
        opacity: 0.9,
        dashArray: isDigipeated ? '5, 5' : null
      });
      polyline.bringToFront();
      const callsign = track.name.replace(/🛤️\s*/, '').replace(/\s*Track.*/, '');
      const receptionType = isDigipeated ? 'Digipeated' : 'Direct';
      let popupContent = `<div class="popup-content">
        <div class="station-name">${callsign} - Movement History</div>
        <div class="station-description">Track shows ${validCoords.length} recorded positions<br>Reception: ${receptionType}`;
      if (track.startTime || track.endTime) {
        popupContent += `<br><br>Track Duration:`;
        if (track.startTime && track.endTime) {
          const duration = (track.endTime - track.startTime) / (1000 * 60);
          popupContent += `<br>From: ${track.startTime.toLocaleString()}<br>To: ${track.endTime.toLocaleString()}<br>Duration: ${Math.round(duration)} minutes`;
        } else if (track.startTime) {
          popupContent += `<br>Started: ${track.startTime.toLocaleString()}`;
        } else if (track.endTime) {
          popupContent += `<br>Ended: ${track.endTime.toLocaleString()}`;
        }
      }
      popupContent += `</div>
        <div style="margin-top:8px; font-size:11px; color:#666; line-height:1.4;">
          <div>🛤️ Line shows complete movement path</div>
          <div>📍 Current position shown as station marker</div>
          <div>🎨 ${isDigipeated ? 'Red' : 'Blue'} = ${receptionType} reception</div>
        </div>
      </div>`;
      polyline.bindPopup(popupContent, { className:'custom-popup', maxWidth: 300, minWidth: 220 });
      validCoords.forEach((coord, pointIndex) => {
        const pointMarker = L.circleMarker(coord, {
          radius: 4,
          fillColor: trackColor,
          color: '#ffffff',
          weight: 1,
          opacity: 1,
          fillOpacity: 0.8
        });
        const coordTimestamp = track.filteredWaypoints && track.filteredWaypoints[pointIndex] ? track.filteredWaypoints[pointIndex] : null;
        let pmContent = `<div class="popup-content">
          <div class="station-name">${callsign} - Check-in Point ${pointIndex + 1}</div>
          <div class="station-description">Position ${pointIndex + 1} of ${validCoords.length} on movement track<br>Reception: ${receptionType}`;
        if (coordTimestamp) {
          pmContent += `<br><br>🕒 ${formatTimestamp(coordTimestamp)}`;
        }
        pmContent += `</div>
          <div style="margin-top:6px; font-size:11px; color:#666;">
            <div>📍 Lat: ${coord[0].toFixed(6)}, Lng: ${coord[1].toFixed(6)}</div>
          </div>
        </div>`;
        pointMarker.bindPopup(pmContent, { className:'custom-popup', maxWidth: 300, minWidth: 220 });
        layer.addLayer(pointMarker);
      });
      layer.addLayer(polyline);
      trackCount++;
    });
    return trackCount > 0 ? layer : null;
  }

  function createStationMarker(stationData) {
    const { latlng, name, desc, timestamp, dist, isDirectReception, iconEmoji, signalText, ageCategory, opacity, emoji, stationType } = stationData;
    let timestampMarker = '';
    if (timestamp) {
      timestampMarker = `<div class="timestamp-marker timestamp-${ageCategory}">•</div>`;
    }
    const icon = L.divIcon({
      className: 'custom-emoji-marker',
      html: `<div class="emoji-container" style="
        font-size:20px;
        text-align:center;
        line-height:24px;
        width:24px;height:24px;
        opacity:${opacity};
        text-shadow:
          -2px -2px 0 #000,
           2px -2px 0 #000,
          -2px  2px 0 #000,
           2px  2px 0 #000,
          -1px -1px 0 #fff,
           1px -1px 0 #fff,
          -1px  1px 0 #fff,
           1px  1px 0 #fff;
        filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4));
        transition:all .2s ease;
        cursor:pointer;
      ">${emoji}${timestampMarker}</div>`,
      iconSize: [24,24],
      iconAnchor: [12,12],
      popupAnchor: [0,-12]
    });
    const receptionType = isDirectReception ? 'Direct RF reception' : 'Digipeated reception';
    const receptionIcon = isDirectReception ? '📡' : '🔄';
    const typeIcon = stationType === 'Mobile station' ? '🚗' : '🏠';
    let popupContent = `<div class="popup-content">
      <div class="station-name">${name}</div>`;
    if (desc && desc.trim()) {
      popupContent += `<div class="station-description">${makeCallsignsClickable(desc, name)}</div>`;
    }
    popupContent += `<div class="signal-strength">${receptionIcon} ${receptionType}</div>
      <div class="signal-strength">${typeIcon} ${stationType}</div>
      <div class="signal-strength">${iconEmoji} ${signalText}</div>`;
    if (timestamp) {
      popupContent += `<div class="timestamp-info">🕒 ${formatTimestamp(timestamp)}</div>`;
    }
    popupContent += `<div class="station-distance">Distance from M0LHA: ${dist.toFixed(1)} km</div></div>`;
    const marker = L.marker(latlng, { icon })
      .bindPopup(popupContent, { className:'custom-popup', maxWidth: 300, minWidth: 220, autoPan: true, keepInView: false })
      .on('mouseover', e => {
        const el = e.target._icon.querySelector('.emoji-container');
        if (el) { el.style.transform = 'scale(1.3)'; el.style.opacity = '1.0'; }
      })
      .on('mouseout', e => {
        const el = e.target._icon.querySelector('.emoji-container');
        if (el) { el.style.transform = 'scale(1)'; el.style.opacity = opacity; }
      });
    return marker;
  }

  function applyLocationFilter() {
    Object.values(stationMarkers).forEach(marker => { map.removeLayer(marker); });
    stationMarkers = {};
    allStationData.forEach(stationData => {
      const passesTimeFilter = shouldShowStation(stationData.timestamp);
      const passesLocationFilter = isPlausibleLocation(stationData.lat, stationData.lng);
      const passesReceptionFilter = shouldShowStationByReceptionType(stationData.isDirectReception);
      if (passesTimeFilter && passesLocationFilter && passesReceptionFilter) {
        const marker = createStationMarker(stationData);
        if (marker) {
          marker.addTo(map);
          stationMarkers[stationData.name] = marker;
        }
      }
    });
    updateStatistics();
    if (heatmapVisible) {
      map.removeLayer(heatmapLayer);
      heatmapLayer = createCoverageHeatmap();
      if (heatmapLayer) { map.addLayer(heatmapLayer); }
      else {
        const heatmapButton = document.getElementById('toggle-heatmap');
        heatmapButton.classList.remove('active');
        heatmapVisible = false;
      }
    }
    if (mobilityTracksVisible) {
      if (mobilityTracksLayer) { map.removeLayer(mobilityTracksLayer); }
      mobilityTracksLayer = createMobilityTracks();
      if (mobilityTracksLayer) { map.addLayer(mobilityTracksLayer); }
    }
    updateUrlImmediate();
  }

  function updateStatistics() {
    const visibleStations = allStationData.filter(s => 
      shouldShowStation(s.timestamp) && 
      isPlausibleLocation(s.lat, s.lng) && 
      shouldShowStationByReceptionType(s.isDirectReception)
    );
    if (visibleStations.length === 0) {
      document.querySelector('.furthest-beacon').innerHTML = `
        <div><strong>📊 Network Statistics:</strong></div>
        <div style="margin-top:4px;">☠️ QTH: <span class="clickable-callsign" onclick="goToHome()">M0LHA</span> – Bexley</div>
        <div style="color:#999;">No stations match current filters</div>
      `;
      return;
    }
    let maxD = 0, minD = Infinity;
    let furthest='', closest='';
    let directCount = 0, digipeatedCount = 0;
    visibleStations.forEach(s => {
      if (s.dist > maxD) { maxD=s.dist; furthest=s.name; }
      if (s.dist < minD) { minD=s.dist; closest=s.name; }
      if (s.isDirectReception) directCount++;
      else digipeatedCount++;
    });
    function extractCall(name){ return name.replace(/^[^\w]*/,'').split(' ')[0]; }
    document.querySelector('.furthest-beacon').innerHTML = `
      <div><strong>📊 Network Statistics:</strong></div>
      <div style="margin-top:4px;">☠️ QTH: <span class="clickable-callsign" onclick="goToHome()">M0LHA</span> – Bexley</div>
      <div>🏠 Closest: <span class="clickable-callsign" onclick="goToStation('${closest}')">${extractCall(closest)}</span> (${minD.toFixed(1)} km)</div>
      <div>📡 Furthest: <span class="clickable-callsign" onclick="goToStation('${furthest}')">${extractCall(furthest)}</span> (${maxD.toFixed(1)} km)</div>
      <div style="margin-top:4px;">📡 Direct: ${directCount} stations</div>
      <div>🔄 Digipeated: ${digipeatedCount} stations</div>
      <div style="margin-top:4px; font-size:10px; color:#666;">Showing ${visibleStations.length} of ${allStationData.length} stations</div>
    `;
  }

  function restoreStateFromUrl() {
    const state = decodeState();
    if (!state) return;
    isRestoringState = true;
    timeFilterEnabled = state.timeFilter;
    maxAgeHours = state.timeHours;
    plausibilityFilterEnabled = state.plausibility;
    directOnlyFilterEnabled = state.directOnly;
    digipeatedOnlyFilterEnabled = state.digipeatedOnly;
    distanceRingsVisible = state.rings;
    heatmapVisible = state.heatmap;
    mobilityTracksVisible = state.tracks;
    window.currentSelectedStation = state.station;
    console.log('Restored state from URL:', state);
    isRestoringState = false;
  }

  function applyRestoredStateToControls() {
    setTimeout(() => {
      const timeToggle = document.getElementById('time-filter-enabled');
      const timeSlider = document.getElementById('time-filter-slider');
      const plausibilityToggle = document.getElementById('plausibility-filter-enabled');
      const directOnlyToggle = document.getElementById('direct-only-filter-enabled');
      const digipeatedOnlyToggle = document.getElementById('digipeated-only-filter-enabled');
      if (timeToggle) timeToggle.checked = timeFilterEnabled;
      if (timeSlider) timeSlider.value = maxAgeHours;
      if (plausibilityToggle) plausibilityToggle.checked = plausibilityFilterEnabled;
      if (directOnlyToggle) directOnlyToggle.checked = directOnlyFilterEnabled;
      if (digipeatedOnlyToggle) digipeatedOnlyToggle.checked = digipeatedOnlyFilterEnabled;
      updateTimeFilterDisplay();
      const ringsButton = document.getElementById('toggle-rings');
      const heatmapButton = document.getElementById('toggle-heatmap');
      const tracksButton = document.getElementById('toggle-tracks');
      if (distanceRingsVisible && ringsButton) {
        ringsButton.classList.add('active');
        distanceRingsLayer = createDistanceRings();
        map.addLayer(distanceRingsLayer);
      }
      if (heatmapVisible && heatmapButton) {
        heatmapButton.classList.add('active');
      }
      if (mobilityTracksVisible && tracksButton) {
        tracksButton.classList.add('active');
      }
    }, 100);
  }

  setTimeout(() => {
    const ringsButton = document.getElementById('toggle-rings');
    const heatmapButton = document.getElementById('toggle-heatmap');
    const tracksButton = document.getElementById('toggle-tracks');
    const copyButton = document.getElementById('copy-share-url');

    ringsButton.addEventListener('click', () => {
      if (distanceRingsVisible) {
        map.removeLayer(distanceRingsLayer);
        distanceRingsVisible = false;
        ringsButton.classList.remove('active');
      } else {
        distanceRingsLayer = createDistanceRings();
        map.addLayer(distanceRingsLayer);
        distanceRingsVisible = true;
        ringsButton.classList.add('active');
      }
      updateUrlImmediate();
    });

    heatmapButton.addEventListener('click', () => {
      if (heatmapVisible) {
        map.removeLayer(heatmapLayer);
        heatmapVisible = false;
        heatmapButton.classList.remove('active');
      } else {
        heatmapLayer = createCoverageHeatmap();
        if (heatmapLayer) {
          map.addLayer(heatmapLayer);
          heatmapVisible = true;
          heatmapButton.classList.add('active');
        }
      }
      updateUrlImmediate();
    });

    tracksButton.addEventListener('click', () => {
      if (mobilityTracksVisible) {
        if (mobilityTracksLayer) { map.removeLayer(mobilityTracksLayer); }
        mobilityTracksVisible = false;
        tracksButton.classList.remove('active');
      } else {
        mobilityTracksLayer = createMobilityTracks();
        if (mobilityTracksLayer) {
          map.addLayer(mobilityTracksLayer);
          mobilityTracksVisible = true;
          tracksButton.classList.add('active');
        }
      }
      updateUrlImmediate();
    });

    copyButton.addEventListener('click', copyShareUrl);

    const timeSlider = document.getElementById('time-filter-slider');
    const timeToggle = document.getElementById('time-filter-enabled');
    const plausibilityToggle = document.getElementById('plausibility-filter-enabled');
    const directOnlyToggle = document.getElementById('direct-only-filter-enabled');
    const digipeatedOnlyToggle = document.getElementById('digipeated-only-filter-enabled');

    timeSlider.addEventListener('input', (e) => {
      maxAgeHours = parseFloat(e.target.value);
      updateTimeFilterDisplay();
      if (timeFilterEnabled) { applyLocationFilter(); }
    });

    timeToggle.addEventListener('change', (e) => {
      timeFilterEnabled = e.target.checked;
      applyLocationFilter();
    });
    plausibilityToggle.addEventListener('change', (e) => {
      plausibilityFilterEnabled = e.target.checked;
      applyLocationFilter();
    });
    directOnlyToggle.addEventListener('change', (e) => {
      directOnlyFilterEnabled = e.target.checked;
      if (e.target.checked) {
        digipeatedOnlyToggle.checked = false;
        digipeatedOnlyFilterEnabled = false;
      }
      applyLocationFilter();
    });
    digipeatedOnlyToggle.addEventListener('change', (e) => {
      digipeatedOnlyFilterEnabled = e.target.checked;
      if (e.target.checked) {
        directOnlyToggle.checked = false;
        directOnlyFilterEnabled = false;
      }
      applyLocationFilter();
    });

    updateTimeFilterDisplay();
    applyRestoredStateToControls();
  }, 100);

  const infoControl = L.control({ position: 'topright' });
  infoControl.onAdd = () => {
    const div = L.DomUtil.create('div', 'info-panel');
    div.style.cssText = `
      background:white;
      padding:8px;
      border:2px solid rgba(0,0,0,0.2);
      border-radius:5px;
      font:12px Arial, sans-serif;
      min-width:200px;
    `;
    div.innerHTML = `
      <div class="last-updated">Last Updated: Loading…</div>
      <div class="furthest-beacon" style="margin-top:8px;">Network Statistics: Loading…</div>
    `;
    return div;
  };
  infoControl.addTo(map);

  const kmlUrl = 'https://download.milesburton.com/aprs/direwolf-stations.kml';

  async function loadKML() {
    try {
      const res = await fetch(kmlUrl + '?_=' + Date.now());
      const text = await res.text();
      let lastModified = 'Unknown';
      const lastModifiedHeader = res.headers.get('last-modified');
      if (lastModifiedHeader) {
        const modDate = new Date(lastModifiedHeader);
        lastModified = modDate.toLocaleString();
      } else {
        const dateHeader = res.headers.get('date');
        if (dateHeader) {
          const serverDate = new Date(dateHeader);
          lastModified = `Server: ${serverDate.toLocaleString()}`;
        }
      }
      const parser = new DOMParser();
      const kml = parser.parseFromString(text, 'text/xml');
      const geojson = toGeoJSON.kml(kml);
      const pointFeatures = geojson.features.filter(f => f.geometry.type === 'Point');
      const lineFeatures = geojson.features.filter(f => f.geometry.type === 'LineString');
      const stationGroups = {};
      pointFeatures.forEach(feature => {
        const name = feature.properties.name || '';
        if (!stationGroups[name]) { stationGroups[name] = []; }
        stationGroups[name].push(feature);
      });
      const deduplicatedPoints = [];
      Object.values(stationGroups).forEach(group => {
        if (group.length === 1) {
          deduplicatedPoints.push(group[0]);
        } else {
          let latest = group[0];
          let latestTime = null;
          group.forEach(feature => {
            const desc = feature.properties.description || '';
            const timestampMatch = desc.match(/🕒 Last heard: ([^\n]+)/);
            if (timestampMatch) {
              const timestamp = parseTimestamp(timestampMatch[1].trim());
              if (timestamp && (!latestTime || timestamp > latestTime)) {
                latestTime = timestamp;
                latest = feature;
              }
            }
          });
          deduplicatedPoints.push(latest);
        }
      });
      geojson.features = [...deduplicatedPoints, ...lineFeatures];
      document.querySelector('.last-updated').textContent = 'KML File Updated: ' + lastModified;
      stationMarkers = {};
      allStations = [];
      allStationData = [];
      allTrackData = [];
      L.geoJSON(geojson, {
        pointToLayer: (feature, latlng) => {
          const name = feature.properties.name || '';
          if (!isPlausibleLocation(latlng.lat, latlng.lng)) {
            console.log(`Filtering out implausible location for ${name}: ${latlng.lat}, ${latlng.lng}`);
            return null;
          }
          let rawDesc = (feature.properties.description||'')
                       .replace(/&lt;/g,'<')
                       .replace(/&gt;/g,'>')
                       .replace(/&amp;/g,'&')
                       .replace(/<!\[CDATA\[/g,'')
                       .replace(/\]\]>/g,'')
                       .trim();
          let timestamp = null;
          const timestampMatch = rawDesc.match(/🕒 Last heard: ([^\n]+)/);
          if (timestampMatch) { timestamp = parseTimestamp(timestampMatch[1].trim()); }
          const dist = calculateDistance(bexleyLat,bexleyLng,latlng.lat,latlng.lng);
          const isDirectReception = rawDesc.includes('**Direct reception**');
          const isDigipeated = rawDesc.includes('**Digipeated**');
          let stationComment = '';
          const commentMatch = rawDesc.match(/💬\s*([^\n📊📡🕒🏠🚗📍📶]+)/);
          if (commentMatch) { stationComment = commentMatch[1].trim(); }
          let stationStatus = '';
          const statusMatch = rawDesc.match(/📊\s*([^\n]+)/);
          if (statusMatch) { stationStatus = statusMatch[1].trim(); }
          let stationType = 'Unknown';
          if (rawDesc.includes('🏠 Fixed station')) stationType = 'Fixed station';
          else if (rawDesc.includes('🚗 Mobile station')) stationType = 'Mobile station';
          let positionReports = '';
          const reportsMatch = rawDesc.match(/📍 Position reports: (\d+)/);
          if (reportsMatch) { positionReports = reportsMatch[1]; }
          let signalStrength = 2;
          let iconEmoji = '📶';
          let signalText = 'Signal strength unknown';
          const signalMatch = rawDesc.match(/📶 Signal: (\d+)\((\d+)\/(\d+)\)/);
          if (signalMatch) {
            const signalValue = parseInt(signalMatch[1]);
            const quality1 = parseInt(signalMatch[2]);
            const quality2 = parseInt(signalMatch[3]);
            const avgQuality = (quality1 + quality2) / 2;
            if (avgQuality < 4) {
              signalStrength = 1;
              iconEmoji = '📵';
              signalText = `Weak Signal (${signalValue}, ${quality1}/${quality2})`;
            } else {
              signalStrength = 2;
              iconEmoji = '📶';
              signalText = `Strong Signal (${signalValue}, ${quality1}/${quality2})`;
            }
          }
          let mobilityInfo = '';
          const speedMatch = rawDesc.match(/🚀\s*([^\n]+)/);
          if (speedMatch) { mobilityInfo = speedMatch[1].trim(); }
          const ageCategory = getAgeCategory(timestamp);
          const opacity = getOpacityForAge(ageCategory);
          let emoji;
          if (stationType === 'Mobile station') emoji = '🚗';
          else if (stationType === 'Fixed station') emoji = '🏠';
          else {
            const first = name.split(' ')[0];
            const isEmoji = /[\u{1F000}-\u{1F9FF}]/u.test(first);
            emoji = isEmoji ? first : '❓';
            if (emoji === '📍') emoji = '❓';
          }
          let cleanDesc = '';
          if (stationComment) cleanDesc += stationComment + '\n';
          if (stationStatus && stationStatus !== 'In Service') cleanDesc += `Status: ${stationStatus}\n`;
          if (mobilityInfo) cleanDesc += `Movement: ${mobilityInfo}\n`;
          if (positionReports) cleanDesc += `Position reports: ${positionReports}`;
          cleanDesc = cleanDesc.trim();
          const stationData = {
            latlng, name, desc: cleanDesc, timestamp, dist, isDirectReception,
            iconEmoji, signalText, ageCategory, opacity, emoji,
            lat: latlng.lat, lng: latlng.lng, signalStrength, stationType
          };
          const existingDataIndex = allStationData.findIndex(existing => existing.name === name);
          if (existingDataIndex !== -1) {
            const existingData = allStationData[existingDataIndex];
            if (timestamp && existingData.timestamp) {
              if (timestamp <= existingData.timestamp) { return null; }
              allStationData.splice(existingDataIndex, 1);
              const existingStationIndex = allStations.findIndex(s => s.name === name);
              if (existingStationIndex !== -1) { allStations.splice(existingStationIndex, 1); }
            } else if (existingData.timestamp && !timestamp) {
              return null;
            } else if (!existingData.timestamp && timestamp) {
              allStationData.splice(existingDataIndex, 1);
              const existingStationIndex = allStations.findIndex(s => s.name === name);
              if (existingStationIndex !== -1) { allStations.splice(existingStationIndex, 1); }
            } else {
              return null;
            }
          }
          allStationData.push(stationData);
          allStations.push({ lat:latlng.lat, lng:latlng.lng, isDirectReception, name, timestamp, ageCategory });
          const passesTimeFilter = shouldShowStation(timestamp);
          const passesLocationFilter = isPlausibleLocation(latlng.lat, latlng.lng);
          const passesReceptionFilter = shouldShowStationByReceptionType(isDirectReception);
          if (!(passesTimeFilter && passesLocationFilter && passesReceptionFilter)) { return null; }
          const marker = createStationMarker(stationData);
          if (marker) {
            marker._stationTimestamp = timestamp;
            stationMarkers[name] = marker;
          }
          return marker;
        },
        filter: (feature) => {
          if (feature.geometry.type === 'LineString') {
            const coords = feature.geometry.coordinates.map(coord => [coord[1], coord[0]]);
            const description = feature.properties.description || '';
            let startTime = null, endTime = null, waypoints = [];
            try {
              const durationMatch = description.match(/Track Duration: (\S+?) to (\S+?)(?:<|$|\s)/);
              if (durationMatch) {
                startTime = new Date(durationMatch[1]);
                endTime = new Date(durationMatch[2]);
                const waypointMatches = description.matchAll(/• Point \d+: (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z)/g);
                const waypointTimes = [];
                for (const match of waypointMatches) {
                  const timestamp = new Date(match[1]);
                  if (!isNaN(timestamp.getTime())) waypointTimes.push(timestamp);
                }
                waypoints = [];
                if (waypointTimes.length >= 2) {
                  for (let i = 0; i < coords.length; i++) {
                    const ratio = i / (coords.length - 1);
                    const timeIndex = ratio * (waypointTimes.length - 1);
                    const floorIndex = Math.floor(timeIndex);
                    const ceilIndex = Math.min(Math.ceil(timeIndex), waypointTimes.length - 1);
                    if (floorIndex === ceilIndex) {
                      waypoints[i] = waypointTimes[floorIndex];
                    } else {
                      const t1 = waypointTimes[floorIndex].getTime();
                      const t2 = waypointTimes[ceilIndex].getTime();
                      const interpolatedTime = t1 + (t2 - t1) * (timeIndex - floorIndex);
                      waypoints[i] = new Date(interpolatedTime);
                    }
                  }
                }
              }
            } catch (e) {
              console.error('Error parsing track timestamps:', e);
            }
            const trackData = {
              name: feature.properties.name || 'Unknown Track',
              description: description,
              coordinates: coords,
              startTime: startTime,
              endTime: endTime,
              waypoints: waypoints
            };
            allTrackData.push(trackData);
            return false;
          }
          if (feature.geometry.type === 'Point') {
            const coords = feature.geometry.coordinates;
            return isPlausibleLocation(coords[1], coords[0]);
          }
          return true;
        }
      }).addTo(map);
      updateStatistics();
      setTimeout(() => {
        if (heatmapVisible) {
          heatmapLayer = createCoverageHeatmap();
          if (heatmapLayer) { map.addLayer(heatmapLayer); }
        }
        if (mobilityTracksVisible) {
          mobilityTracksLayer = createMobilityTracks();
          if (mobilityTracksLayer) { map.addLayer(mobilityTracksLayer); }
        }
        if (window.currentSelectedStation && stationMarkers[window.currentSelectedStation]) {
          setTimeout(() => { stationMarkers[window.currentSelectedStation].openPopup(); }, 500);
        }
      }, 100);
    } catch (err) {
      console.error('Error loading KML:', err);
    }
  }

  restoreStateFromUrl();
  loadKML();
  setInterval(() => {
    const wasSelectedStation = window.currentSelectedStation;
    map.eachLayer(l => l instanceof L.GeoJSON && map.removeLayer(l));
    stationMarkers = {};
    allStations = [];
    allStationData = [];
    allTrackData = [];
    window.currentSelectedStation = wasSelectedStation;
    loadKML();
  }, 60000);
}
