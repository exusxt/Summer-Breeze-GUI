(function () {
  'use strict';

  var RELEASES_PAGE = 'https://github.com/exusxt/Summer-Breeze-GUI/releases/latest';

  // Pick the best asset per platform. Pattern => array of matches (first wins).
  var RULES = {
    windows: {
      setup: [/Setup.*\.exe$/],
      'portable-x64': [/.*-x64\.exe$/],
      'portable-arm64': [/.*-arm64\.exe$/]
    },
    macos: {
      dmg: [/^(?!.*-arm64).*\.dmg$/, /.*\.dmg$/],
      maczip: [/^(?!.*-arm64).*\.zip$/, /.*\.zip$/]
    },
    linux: {
      appimage: [/^(?!.*-arm64).*\.AppImage$/, /.*\.AppImage$/],
      deb: [/^(?!.*-arm64).*\.deb$/, /.*\.deb$/],
      rpm: [/^(?!.*-aarch64).*\.rpm$/, /.*\.rpm$/],
      pacman: [/^(?!.*-aarch64).*\.pacman$/, /.*\.pacman$/]
    }
  };

  function applyRelease(release) {
    var version = release.tag_name;
    var versionEl = document.getElementById('version');
    if (versionEl) {
      versionEl.textContent = version.replace(/^v/, '');
    }

    var assets = release.assets || [];
    Object.keys(RULES).forEach(function (platform) {
      var card = document.querySelector('[data-platform="' + platform + '"]');
      if (!card) return;

      Object.keys(RULES[platform]).forEach(function (key) {
        var patterns = RULES[platform][key];
        var asset = null;
        for (var i = 0; i < assets.length; i++) {
          for (var j = 0; j < patterns.length; j++) {
            if (patterns[j].test(assets[i].name)) {
              asset = assets[i];
              break;
            }
          }
          if (asset) break;
        }
        var anchor = card.querySelector('[data-dl="' + key + '"]');
        if (!anchor) return;

        if (asset) {
          anchor.href = asset.browser_download_url;
          anchor.textContent = asset.name;
          anchor.title = asset.name + ' (' + Math.round(asset.size / 1024 / 1024) + ' MB)';
          anchor.classList.add('has-asset');
        }
      });
    });
  }

  fetch('https://api.github.com/repos/exusxt/Summer-Breeze-GUI/releases/latest')
    .then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    })
    .then(applyRelease)
    .catch(function () {
      // Rate-limited or offline: keep the defaults, which point at the
      // releases page.
    });
})();
