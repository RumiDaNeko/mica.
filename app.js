// Fills the download button and release list from GitHub's API for Mica's release repo.
// The repo name ends in a dot ("mica."), so the API is reached by numeric id like AppUpdater.cs does.
(function () {
  var REPO_URL = "https://github.com/RumiDaNeko/mica.";
  var API = "https://api.github.com/repositories/1432309505/releases";
  var CACHE_KEY = "mica-releases";
  var CACHE_MS = 10 * 60 * 1000; // unauthenticated API allows 60 requests/hour per IP

  function $(sel) { return document.querySelector(sel); }
  function $all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function formatSize(bytes) {
    return bytes >= 1e9 ? (bytes / 1e9).toFixed(1) + " GB" : Math.round(bytes / 1e6) + " MB";
  }
  function formatDate(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function versionOf(release) { return release.tag_name.replace(/^v/i, ""); }
  function installerOf(release) {
    return (release.assets || []).filter(function (a) { return /setup\.exe$/i.test(a.name); })[0]
      || (release.assets || []).filter(function (a) { return /\.(exe|msi|zip)$/i.test(a.name); })[0];
  }

  function readCache() {
    try {
      var c = JSON.parse(sessionStorage.getItem(CACHE_KEY));
      if (c && Date.now() - c.at < CACHE_MS) return c.data;
    } catch (e) {}
    return null;
  }
  function writeCache(data) {
    try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data: data })); } catch (e) {}
  }

  function load() {
    var cached = readCache();
    if (cached) return Promise.resolve(cached);
    return fetch(API + "?per_page=6", { headers: { Accept: "application/vnd.github+json" } })
      .then(function (r) {
        if (!r.ok) throw new Error("GitHub responded " + r.status);
        return r.json();
      })
      .then(function (list) {
        var data = list.filter(function (r) { return !r.draft; }).map(function (r) {
          var a = installerOf(r);
          return {
            tag_name: r.tag_name, name: r.name, html_url: r.html_url, body: r.body || "",
            published_at: r.published_at, prerelease: r.prerelease,
            asset: a ? { name: a.name, size: a.size, url: a.browser_download_url, digest: a.digest || "" } : null
          };
        });
        writeCache(data);
        return data;
      });
  }

  function renderDownload(latest) {
    var v = versionOf(latest);
    $all("[data-download]").forEach(function (el) { el.href = latest.asset ? latest.asset.url : latest.html_url; });
    $("[data-label]").textContent = "Download Mica " + v;
    var meta = $("[data-meta]");
    meta.textContent = "";
    var parts = ["Windows x64", formatDate(latest.published_at)];
    if (latest.asset) parts.splice(1, 0, formatSize(latest.asset.size));
    meta.appendChild(document.createTextNode(parts.join(" · ") + " · "));
    var notes = document.createElement("a");
    notes.href = latest.html_url;
    notes.textContent = "release notes";
    meta.appendChild(notes);
  }

  function renderReleases(list) {
    var ol = $("[data-releases]");
    ol.textContent = "";
    list.slice(0, 5).forEach(function (r, i) {
      var li = document.createElement("li");
      var head = document.createElement("div");
      head.className = "head";
      var h = document.createElement("h3");
      var a = document.createElement("a");
      a.href = r.html_url;
      a.textContent = r.name || ("Mica " + versionOf(r));
      a.style.textDecoration = "none";
      h.appendChild(a);
      head.appendChild(h);
      if (i === 0 && !r.prerelease) head.appendChild(badge("Latest"));
      if (r.prerelease) head.appendChild(badge("Pre-release"));
      var t = document.createElement("time");
      t.dateTime = r.published_at;
      t.textContent = formatDate(r.published_at);
      head.appendChild(t);
      li.appendChild(head);
      var notes = document.createElement("div");
      notes.className = "notes";
      // Plain text on purpose: release bodies are Markdown we don't render, and never HTML we trust.
      notes.textContent = r.body.replace(/\r/g, "").replace(/^#+\s*/gm, "").replace(/\*\*/g, "").trim();
      li.appendChild(notes);
      ol.appendChild(li);
      if (notes.textContent.split("\n").length > 6) {
        notes.classList.add("clamped");
        var more = document.createElement("button");
        more.className = "more";
        more.textContent = "Show all notes";
        more.addEventListener("click", function () {
          var open = notes.classList.toggle("clamped");
          more.textContent = open ? "Show all notes" : "Show less";
        });
        li.appendChild(more);
      }
    });
  }
  function badge(text) {
    var s = document.createElement("span");
    s.className = "badge";
    s.textContent = text;
    return s;
  }

  load().then(function (list) {
    var latest = list.filter(function (r) { return !r.prerelease; })[0] || list[0];
    if (!latest) throw new Error("No releases yet");
    renderDownload(latest);
    renderReleases(list);
  }).catch(function () {
    var meta = $("[data-meta]");
    meta.textContent = "Couldn't reach GitHub. ";
    var a = document.createElement("a");
    a.href = REPO_URL + "/releases/latest";
    a.textContent = "Get the latest release on GitHub";
    meta.appendChild(a);
    $("[data-releases]").innerHTML = '<li class="muted">Release notes are unavailable right now.</li>';
  });

  // Click a gallery screenshot to view it full size.
  var box = $("[data-lightbox]");
  if (box && box.showModal) {
    $all(".gallery .shot img").forEach(function (img) {
      img.addEventListener("click", function () {
        box.querySelector("img").src = img.src;
        box.querySelector("img").alt = img.alt;
        box.showModal();
      });
    });
    box.addEventListener("click", function () { box.close(); });
  }
})();
