// @author         screach
// @name           Tear Marker
// @category       Wasabee
// @version        0.0.3
// @description    Marks specific smurf portals with Wasabee "destroy" marker

/* exported setup --eslint */
/* global L,$ --eslint */

const tearMarker = (window.plugin.tearMarker = {});

tearMarker.MARKER_TYPES = ['CapturePortalMarker', 'LetDecayPortalAlert', 'ExcludeMarker', 'DestroyPortalAlert', 'FarmPortalMarker', 'GotoPortalMarker', 'GetKeyPortalMarker', 'CreateLinkAlert', 'MeetAgentPortalMarker', 'OtherPortalAlert', 'RechargePortalAlert', 'UpgradePortalAlert', 'UseVirusPortalAlert'];
tearMarker.MOD_TYPE = {
  RES_SHIELD: 'Shield',
  MULTIHACK: 'Multi-hack',
  FORCE_AMP: 'Force Amp',
  HEATSINK: 'Heat Sink',
  TURRET: 'Turret',
  LINK_AMPLIFIER: 'Link Amp',
};

tearMarker.config = {
  portalDetailRequestDelay: 200,
  portalDetailSimultaneousRequests: 1,
  tearMarkerType: 'DestroyPortalAlert',
};

tearMarker.checkMod = function (m) {
  return (
    m &&
    ((m.rarity.match('.*RARE') && (m.name === tearMarker.MOD_TYPE.MULTIHACK || m.name === tearMarker.MOD_TYPE.HEATSINK)) ||
      (m.rarity.match('.*VERY_RARE') && m.name.indexOf(tearMarker.MOD_TYPE.RES_SHIELD) >= 0))
  );
};

tearMarker.isTear = function (pd) {
  return pd.team === window.TEAM_CODE_RES && (pd.level >= 7 || (pd.level >= 6 && pd.mods.filter(tearMarker.checkMod).length > 0));
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
    if (!window.plugin.wasabee._selectedOp.containsMarker(p, tearMarker.config.tearMarkerType)) {
      window.plugin.wasabee._selectedOp.addPortal(p);
      window.plugin.wasabee._selectedOp.addMarker(tearMarker.config.tearMarkerType, p);
      tearMarker.addedMarkers++;
    }
  });
};

tearMarker.showResults = function () {
  alert(
    `Tears Finder<ul class="tearMarker-summary"><li>${tearMarker.initialQueueSize} checked portals</li><li>${tearMarker.errors} errors</li><li>${tearMarker.addedMarkers} new tears</li><li>${tearMarker.removedMarkers} destroyed tears</li><li>${window.plugin.wasabee._selectedOp.markers.length} total tears</li></ul>`
  );
  console.log(`Done. Found ${tearMarker.addedMarkers} tear(s)`);
};

tearMarker.resetInternals = function () {
  tearMarker.portals = [];
  tearMarker.addedMarkers = 0;
  tearMarker.removedMarkers = 0;
  tearMarker.errors = 0;
  tearMarker.lastRequest = 0;
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
  return window.plugin.wasabee._selectedOp.containsMarkerByID(portalNode.options.guid, tearMarker.config.tearMarkerType) ||
    portalNode.options.team === window.TEAM_RES && portalNode.options.level >= 6;
};

tearMarker.prepareQueue = function () {
  return new Promise((resolve) => {
    tearMarker.resetInternals();
    tearMarker.queue = Object.values(window.portals)
    .filter(tearMarker.checkLocation)
    .filter(tearMarker.checkBasicConditions);
    tearMarker.initialQueueSize = tearMarker.queue.length;
    resolve();
  });
};

tearMarker.startThreads = function () {
  return Promise.all(Array(tearMarker.config.portalDetailSimultaneousRequests).fill().map(tearMarker.startChecking));
};

tearMarker.doSearchTears = function () {
  console.log('Searching tears...');
  return tearMarker.prepareQueue()
    .then(tearMarker.startThreads)
};

tearMarker.markProgress = function () {
  tearMarker.progress.style.width = ((tearMarker.initialQueueSize - tearMarker.queue.length) / tearMarker.initialQueueSize) * 100 + '%';
};

tearMarker.startChecking = function () {
  if (tearMarker.queue && tearMarker.queue.length > 0) {
    tearMarker.markProgress();
    return tearMarker.checkNext().finally(tearMarker.startChecking);
  }
  return Promise.resolve();
};

tearMarker.checkNext = function () {
  const portalNode = tearMarker.queue.shift();
  if (portalNode) {
    const portalOptions = portalNode.options;
    return tearMarker.getDetail(portalOptions.guid)
      .then((detail) => tearMarker.handleDetail(portalOptions, detail));
  }
  return Promise.resolve();
};

tearMarker.handleDetail = function(portalOptions, detail) {
  if(tearMarker.isTear(detail)) {
    tearMarker.addMarker(portalOptions.guid, detail);
  } else {
    tearMarker.removeMarker(portalOptions);
  }
};

tearMarker.getDetail = function (guid) {
  if (window.portalDetail.isFresh(guid)) {
    return new Promise((resolve) => {
      resolve(window.portalDetail.get(guid));
    });
  } else {
    let timeout = 0;
    const timeDiff = new Date().getTime() - tearMarker.lastRequest;
    if (tearMarker.lastRequest && timeDiff < tearMarker.config.portalDetailRequestDelay) {
      timeout = tearMarker.config.portalDetailRequestDelay - timeDiff;
    }

    return new Promise((resolve, reject) =>
      setTimeout(
        () => {
          tearMarker.lastRequest = new Date().getTime();
          window.portalDetail
            .request(guid)
            .then(resolve)
            .catch(() => {
              tearMarker.errors++;
              reject();
            })
        },
        timeout
      )
    );
  }
};

tearMarker.finish = function () {
  tearMarker.running = false;
  tearMarker.searchButton.classList.remove('working');
  tearMarker.showResults();
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
      promise
        .catch(() => console.log('Errors, yay: ' + JSON.stringify(arguments)))
        .finally(tearMarker.finish);
    } else {
      tearMarker.finish();
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
  return tearMarker.MARKER_TYPES.map((type) => `<option ${tearMarker.config.tearMarkerType === type?'selected="selected"':''}value="${type}">${window.plugin.wasabee.static.strings.English[type]}</option>`)
    .join('');
};

tearMarker.configForm = function () {
  return `
      <label for="tearMarker-pd-delay">Delay between portal detail requests (ms)</label>
      <input id="tearMarker-pd-delay" type="number" min="0" value="${tearMarker.config.portalDetailRequestDelay}">

      <label for="tearMarker-pd-sim-requests">Max simultaneous portal detail requests</label>
      <input id="tearMarker-pd-sim-requests" type="number" min="1" value="${tearMarker.config.portalDetailSimultaneousRequests}">

      <label for="tearMarker-tear-marker-type">Tear marker type</label>
      <select id="tearMarker-tear-marker-type">
        ${tearMarker.markerTypeOptions()}
      </select>
  `;
};

tearMarker.saveConfig = function () {
  tearMarker.config.portalDetailRequestDelay = Number($('#tearMarker-pd-delay').val()) ?? tearMarker.config.portalDetailRequestDelay;
  tearMarker.config.portalDetailSimultaneousRequests = Number($('#tearMarker-pd-sim-requests').val()) ?? tearMarker.config.portalDetailSimultaneousRequests;
  tearMarker.config.tearMarkerType = $('#tearMarker-tear-marker-type').val() ?? tearMarker.config.tearMarkerType;

  localStorage.setItem('tearMarker', JSON.stringify(tearMarker.config));
};

tearMarker.loadConfig = function () {
  const localConfig = localStorage.getItem('tearMarker');
  if (localConfig) {
    try {
      const config = JSON.parse(localConfig);
      if (config) {
        Object.assign(tearMarker.config, config);
      }
    } catch(e) {
      console.error("Error loading tearMarker config: " + e);
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
