// @author         screach
// @name           Tear Marker
// @category       Wasabee
// @version        0.0.3
// @description    Marks specific smurf portals with Wasabee "destroy" marker

/* exported setup --eslint */
/* global L,$ --eslint */

const tearMarker = (window.plugin.tearMarker = {});

tearMarker.PD_DELAY = 250;
tearMarker.PD_SIM_REQUESTS = 5;
tearMarker.TEAR_MARKER_TYPE = 'DestroyPortalAlert';

tearMarker.MARKER_TYPES = ['CapturePortalMarker', 'LetDecayPortalAlert', 'ExcludeMarker', 'DestroyPortalAlert', 'FarmPortalMarker', 'GotoPortalMarker', 'GetKeyPortalMarker', 'CreateLinkAlert', 'MeetAgentPortalMarker', 'OtherPortalAlert', 'RechargePortalAlert', 'UpgradePortalAlert', 'UseVirusPortalAlert'];

tearMarker.MOD_TYPE = {
  RES_SHIELD: 'Shield',
  MULTIHACK: 'Multi-hack',
  FORCE_AMP: 'Force Amp',
  HEATSINK: 'Heat Sink',
  TURRET: 'Turret',
  LINK_AMPLIFIER: 'Link Amp',
};

tearMarker.checkMod = function (m) {
  return (
    m &&
    ((m.rarity.match('.*RARE') && (m.name === tearMarker.MOD_TYPE.MULTIHACK || m.name === tearMarker.MOD_TYPE.HEATSINK)) ||
      (m.rarity.match('.*VERY_RARE') && m.name.indexOf(tearMarker.MOD_TYPE.RES_SHIELD) >= 0))
  );
};

tearMarker.removeMarker = function (portalOptions) {
  const markers = window.plugin.wasabee._selectedOp.markers;
  const marker = markers.find((marker) => marker.portalId === portalOptions.guid);
  if (marker) {
    window.plugin.wasabee._selectedOp.removeMarker(marker);
    tearMarker.removedMarkers++;
  }
};

tearMarker.addMarker = function (guid, pd) {
  const rawPortal = {
    id: guid,
    lat: (pd.latE6 / 1e6).toFixed(6),
    lng: (pd.lngE6 / 1e6).toFixed(6),
    name: pd.title,
    comment: '',
    hardness: '',
  };

  window.plugin.wasabee._selectedOp.convertPortalsToObjs([rawPortal]).forEach((p) => {
    if (!window.plugin.wasabee._selectedOp.containsMarker(p, tearMarker.TEAR_MARKER_TYPE)) {
      window.plugin.wasabee._selectedOp.addPortal(p);
      window.plugin.wasabee._selectedOp.addMarker(tearMarker.TEAR_MARKER_TYPE, p);
      tearMarker.addedMarkers++;
    }
  });
};

tearMarker.isTear = function (pd) {
  return pd.team === 'R' && (pd.level >= 7 || (pd.level >= 6 && pd.mods.filter(tearMarker.checkMod).length > 0));
};

tearMarker.finishResults = function () {
  alert(
    `Tears Finder<ul class="tearMarker-summary"><li>${tearMarker.initialQueueSize} checked portals</li><li>${tearMarker.errors} errors</li><li>${tearMarker.addedMarkers} new tears</li><li>${tearMarker.removedMarkers} destroyed tears</li><li>${window.plugin.wasabee._selectedOp.markers.length} total tears</li></ul>`
  );
  console.log(`Done. Found ${tearMarker.addedMarkers} tear(s)`);
};

tearMarker.resetFoundPortals = function () {
  tearMarker.portals = [];
  tearMarker.addedMarkers = 0;
  tearMarker.removedMarkers = 0;
  tearMarker.errors = 0;
};

tearMarker.checkLocation = function (portalNode) {
  return (
    window.map.getBounds().contains(portalNode._latlng) &&
    (!window.plugin.wasabee._selectedOp.zones ||
      !window.plugin.wasabee._selectedOp.zones[0] ||
      !window.plugin.wasabee._selectedOp.zones[0].points ||
      !window.plugin.wasabee._selectedOp.zones[0].points.length > 0 ||
      window.plugin.wasabee._selectedOp.zones[0].contains(portalNode._latlng))
  );
};

tearMarker.checkBasicConditions = function (portalNode) {
  return window.plugin.wasabee._selectedOp.containsMarkerByID(portalNode.options.guid, tearMarker.TEAR_MARKER_TYPE) ||
    portalNode.options.team === window.TEAM_RES && portalNode.options.level >= 6;
};

tearMarker.doSearchTears = function () {
  console.log('Searching tears...');
  return new Promise((resolve) => {
    tearMarker.resetFoundPortals();
    tearMarker.queue = Object.values(window.portals)
    .filter(tearMarker.checkLocation)
    .filter(tearMarker.checkBasicConditions);
    tearMarker.initialQueueSize = tearMarker.queue.length;
    resolve();
  })
    .then(() => Promise.all(Array(tearMarker.PD_SIM_REQUESTS).fill(0).map(tearMarker.startChecking)))
    .catch(() => console.log('Errors, yay'))
    .finally(tearMarker.finishResults);
};

tearMarker.markProgress = function () {
  tearMarker.progress.style.width = ((tearMarker.initialQueueSize - tearMarker.queue.length) / tearMarker.initialQueueSize) * 100 + '%';
};

tearMarker.startChecking = function () {
  if (tearMarker.queue && tearMarker.queue.length > 0) {
    return tearMarker.checkNext().finally(tearMarker.startChecking);
  }
  return Promise.resolve();
};

tearMarker.checkNext = function () {
  tearMarker.markProgress();
  const portalNode = tearMarker.queue.shift();
  if (portalNode) {
    const portalOptions = portalNode.options;
    return tearMarker.getDetail(portalOptions.guid).then((detail) => {
      if (tearMarker.isTear(detail)) {
        tearMarker.addMarker(portalOptions.guid, detail);
      } else {
        tearMarker.removeMarker(portalOptions);
      }
    });
  }
  return Promise.resolve();
};

tearMarker.getDetail = function (guid) {
  if (window.portalDetail.isFresh(guid)) {
    return new Promise((resolve) => {
      resolve(window.portalDetail.get(guid));
    });
  } else {
    return new Promise((resolve, reject) =>
      setTimeout(
        () =>
          window.portalDetail
            .request(guid)
            .then((pd) => resolve(pd))
            .catch(() => {
              tearMarker.errors++;
              reject();
            }),
        tearMarker.PD_DELAY
      )
    );
  }
};

tearMarker.done = function () {
  tearMarker.running = false;
  tearMarker.searchButton.classList.remove('working');
  L.DomUtil.remove(tearMarker.progressBar);
};

tearMarker.visualizeStart = function () {
  tearMarker.searchButton.classList.add('working');
  tearMarker.progress = L.DomUtil.create('div', 'progress');
  tearMarker.progress.style.width = '0%';
  tearMarker.progressBar = L.DomUtil.create('div', 'progress-bar');
  tearMarker.progressBar.appendChild(tearMarker.progress);
  tearMarker.searchButton.after(tearMarker.progressBar);
};

tearMarker.searchTears = function () {
  tearMarker.visualizeStart();
  let promise;
  try {
    if (!tearMarker.running) {
      tearMarker.running = true;
      promise = tearMarker.doSearchTears();
    }
  } finally {
    if (promise) {
      promise.finally(tearMarker.done);
    } else {
      tearMarker.done();
    }
  }
};

tearMarker.setupCss = function () {
  $('<style>').prop('type', 'text/css').html('@include_css:tear-marker.css@').appendTo('head');
  if(isSmartphone()) $('<style>').prop('type', 'text/css').html('@include_css:tear-marker-phone.css@').appendTo('head');
};

tearMarker.controlIcon = function () {
  const ActionButton = L.Control.extend({
    options: { position: 'bottomleft' },

    onAdd: function () {
      const controlDiv = L.DomUtil.create('div', 'leaflet-tearMarker tearMarker actionButton');
      const controlSubDIV = L.DomUtil.create('div', 'leaflet-bar', controlDiv);

      const searchButton = L.DomUtil.create('a', 'tearMarkerActionBtn', controlSubDIV);
      tearMarker.searchButton = searchButton;
      searchButton.title = 'Find Tears';
      searchButton.id = 'tear-marker-search-button';
      L.DomEvent.addListener(searchButton, 'click', tearMarker.searchTears).addListener(searchButton, 'click', L.DomEvent.stop);

      return controlDiv;
    },
  });
  window.map.addControl(new ActionButton());
};

tearMarker.markerTypeOptions = function() {
  return tearMarker.MARKER_TYPES.map((type) => `<option ${tearMarker.TEAR_MARKER_TYPE === type?'selected="selected"':''}value="${type}">${window.plugin.wasabee.static.strings.English[type]}</option>`)
    .join('');
};

tearMarker.configForm = function () {
  return `
      <label for="tearMarker-pd-delay">Delay between portal detail requests (ms)</label>
      <input id="tearMarker-pd-delay" type="number" min="0" value="${tearMarker.PD_DELAY}">

      <label for="tearMarker-pd-sim-requests">Max simultaneous portal detail requests</label>
      <input id="tearMarker-pd-sim-requests" type="number" min="1" value="${tearMarker.PD_SIM_REQUESTS}">

      <label for="tearMarker-tear-marker-type">Tear marker type</label>
      <select id="tearMarker-tear-marker-type">
        ${tearMarker.markerTypeOptions()}
      </select>
  `;
};

tearMarker.saveConfig = function () {
  localStorage.setItem(
    'tearMarker',
    JSON.stringify({
      pdd: (tearMarker.PD_DELAY = Number($('#tearMarker-pd-delay').val()) ?? tearMarker.PD_DELAY),
      pdsr: (tearMarker.PD_SIM_REQUESTS = Number($('#tearMarker-pd-sim-requests').val()) ?? tearMarker.PD_SIM_REQUESTS),
      tmt: (tearMarker.TEAR_MARKER_TYPE = $('#tearMarker-tear-marker-type').val() ?? tearMarker.TEAR_MARKER_TYPE),
    })
  );
};

tearMarker.loadConfig = function () {
  const localConfig = localStorage.getItem('tearMarker');
  if (localConfig) {
    const config = JSON.parse(localConfig);
    if (config) {
      tearMarker.PD_DELAY = config.pdd ?? tearMarker.PD_DELAY;
      tearMarker.PD_SIM_REQUESTS = config.pdsr ?? tearMarker.PD_SIM_REQUESTS;
      tearMarker.TEAR_MARKER_TYPE = config.tmt ?? tearMarker.TEAR_MARKER_TYPE;
    }
  }
};

tearMarker.configWindow = function () {
  window.dialog({
    title: 'Tear Marker Options',
    id: 'tear-marker-options',
    html: tearMarker.configForm(),
    width: 'auto',
    height: 'auto',
    dialogClass: 'tear-marker-config',
    closeCallback: tearMarker.saveConfig,
  });
};

tearMarker.configButton = function () {
  $('<a>').html('Tear Marker').attr('title', 'Tear Marker').click(tearMarker.configWindow).appendTo('#toolbox');
};

const setup = function () {
  // if (!window.plugin.wasabee) {
  //   alert(`Tear finder requires 'wasabee' plugin to be installed`);
  // } else {
  tearMarker.loadConfig();
  tearMarker.setupCss();
  tearMarker.controlIcon();
  tearMarker.configButton();
  // }
};
