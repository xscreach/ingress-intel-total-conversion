// @author         screach
// @name           Tear Marker
// @category       Wasabee
// @version        0.0.3
// @description    Marks specific smurf portals with Wasabee "destroy" marker

/* exported setup --eslint */
/* global L --eslint */

const PD_SLEEP_TIME = 250;
const PD_PARALLELS = 5;
const TEAR_MARKER_TYPE = 'DestroyPortalAlert';
const MOD_TYPE = { RES_SHIELD: 'Shield', MULTIHACK: 'Multi-hack', FORCE_AMP: 'Force Amp', HEATSINK: 'Heat Sink', TURRET: 'Turret', LINK_AMPLIFIER: 'Link Amp' };
const tearMarker = (window.plugin.tearMarker = {});

tearMarker.checkMod = function (m) {
  return (
    m &&
    ((m.rarity.match('.*RARE') && (m.name === MOD_TYPE.MULTIHACK || m.name === MOD_TYPE.HEATSINK)) ||
      (m.rarity.match('.*VERY_RARE') && m.name.indexOf(MOD_TYPE.RES_SHIELD) >= 0))
  );
};

tearMarker.removeMarker = function (portalOptions) {
  const markers = window.plugin.wasabee._selectedOp.markers;
  const marker = markers.find((marker) => marker.portalId === portalOptions.guid);
  if (marker) {
    tearMarker.removedMarkers++;
    window.plugin.wasabee._selectedOp.removeMarker(marker);
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
    if (!window.plugin.wasabee._selectedOp.containsMarker(p, TEAR_MARKER_TYPE)) {
      window.plugin.wasabee._selectedOp.addPortal(p);
      window.plugin.wasabee._selectedOp.addMarker(TEAR_MARKER_TYPE, p);
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

function checkLocation(portalNode) {
  return (
    window.map.getBounds().contains(portalNode._latlng) &&
    (!window.plugin.wasabee._selectedOp.zones ||
      !window.plugin.wasabee._selectedOp.zones[0] ||
      !window.plugin.wasabee._selectedOp.zones[0].points ||
      !window.plugin.wasabee._selectedOp.zones[0].points.length > 0 ||
      window.plugin.wasabee._selectedOp.zones[0].contains(portalNode._latlng))
  );
}

function doSearchTears() {
  console.log('Searching tears...');
  return new Promise((resolve) => {
    tearMarker.resetFoundPortals();
    tearMarker.queue = Object.values(window.portals).filter(checkLocation);
    tearMarker.initialQueueSize = tearMarker.queue.length;
    resolve();
  })
    .then(() => Promise.all(Array(PD_PARALLELS).fill(0).map(startChecking)))
    .catch(() => console.log('Errors, yay'))
    .finally(tearMarker.finishResults);
}

function markProgress() {
  tearMarker.progress.style.width = ((tearMarker.initialQueueSize - tearMarker.queue.length) / tearMarker.initialQueueSize) * 100 + '%';
}

function startChecking() {
  if (tearMarker.queue && tearMarker.queue.length > 0) {
    return checkNext().finally(startChecking);
  }
  return Promise.resolve();
}

function checkNext() {
  markProgress();
  const portalNode = tearMarker.queue.shift();
  if (portalNode) {
    const portalOptions = portalNode.options;
    if (window.plugin.wasabee._selectedOp.containsMarkerByID(portalOptions.guid, TEAR_MARKER_TYPE)) {
      return getDetail(portalOptions.guid).then((detail) => {
        if (!tearMarker.isTear(detail)) {
          tearMarker.removeMarker(portalOptions);
        }
      });
    } else if (portalOptions.data.team === window.TEAM_CODE_RES && portalOptions.data.level >= 6) {
      return getDetail(portalOptions.guid).then((detail) => {
        if (tearMarker.isTear(detail)) {
          tearMarker.addMarker(portalOptions.guid, detail);
        }
      });
    }
  }
  return Promise.resolve();
}

function getDetail(guid) {
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
        PD_SLEEP_TIME
      )
    );
  }
}

function done() {
  tearMarker.running = false;
  tearMarker.searchButton.classList.remove('working');
  L.DomUtil.remove(tearMarker.progressBar);
}

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
      promise = doSearchTears();
    }
  } finally {
    if (promise) {
      promise.finally(done);
    } else {
      done();
    }
  }
};

tearMarker.setupCss = function () {
  $('<style>')
    .prop('type', 'text/css')
    .html('@include_css:tear-marker.css@')
    .appendTo('head');
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

const setup = function () {
  // if (!window.plugin.wasabee) {
  //   alert(`Tear finder requires 'wasabee' plugin to be installed`);
  // } else {
  tearMarker.setupCss();
  tearMarker.controlIcon();
  // }
};
