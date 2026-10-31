// Trait de côte de Saint-Louis — application MapLibre
const COULEURS_ANNEES = ["interpolate", ["linear"], ["get", "annee"],
  1984, "#F2C14E", 2000, "#E0E3A0", 2012, "#7FC4C0", 2026, "#1B6CA8"];

const INDICATEURS = {
  lrr: { champ: "lrr", borne: 6, unite: "m/an", min: "recul −6 m/an", max: "avancée +6 m/an" },
  nsm: { champ: "nsm", borne: 200, unite: "m", min: "recul −200 m", max: "avancée +200 m" },
};

const etat = { annees: [], index: 0, indicateur: "lrr", transect: null, lecture: null };
const $ = (id) => document.getElementById(id);
const estMobile = () => window.matchMedia("(max-width: 720px)").matches;

const carte = new maplibregl.Map({
  container: "carte",
  style: {
    version: 8,
    sources: {
      imagerie: {
        type: "raster",
        tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
        tileSize: 256,
        maxzoom: 18,
        attribution: "Imagerie © Esri, Maxar, Earthstar Geographics",
      },
    },
    layers: [{ id: "imagerie", type: "raster", source: "imagerie", paint: { "raster-saturation": -0.35, "raster-brightness-max": 0.85 } }],
  },
  bounds: [[-16.535, 15.90], [-16.475, 16.06]],
  fitBoundsOptions: { padding: { top: 20, bottom: 20, left: 20, right: 20 } },
  attributionControl: { compact: true },
});
carte.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
carte.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-right");

function cadrer() {
  const p = estMobile()
    ? { top: 20, bottom: window.innerHeight * 0.52 + 10, left: 20, right: 20 }
    : { top: 30, bottom: 30, left: document.getElementById("panneau").getBoundingClientRect().right + 40, right: 60 };
  carte.fitBounds([[-16.528, 15.885], [-16.488, 16.055]], { padding: p, duration: 0 });
}

function couleurTaux(ind) {
  const { champ, borne } = INDICATEURS[ind];
  return ["interpolate", ["linear"], ["get", champ],
    -borne, "#C0392B", -borne / 2, "#E8A08C", 0, "#CFC6B0", borne / 2, "#8DB7D6", borne, "#1F6FA8"];
}

async function initialiser() {
  const [traits, transects] = await Promise.all([
    fetch("data/traits_de_cote_annuels.geojson").then((r) => r.json()),
    fetch("data/transects_dsas.geojson").then((r) => r.json()),
  ]);
  etat.annees = transects.annees;
  etat.series = new Map(transects.features.map((f) => [f.properties.id, f.properties]));

  carte.addSource("traits", { type: "geojson", data: traits });
  carte.addSource("transects", { type: "geojson", data: transects, promoteId: "id" });

  carte.addLayer({ id: "traits-tous", type: "line", source: "traits",
    paint: { "line-color": COULEURS_ANNEES, "line-width": 1, "line-opacity": 0.55 } });
  carte.addLayer({ id: "transects", type: "line", source: "transects",
    layout: { "line-cap": "round" },
    paint: { "line-color": couleurTaux("lrr"), "line-width": ["interpolate", ["linear"], ["zoom"], 11, 2, 15, 5], "line-opacity": 0.9 } });
  carte.addLayer({ id: "transect-choisi", type: "line", source: "transects", filter: ["==", ["get", "id"], -1],
    paint: { "line-color": "#FFFFFF", "line-width": ["interpolate", ["linear"], ["zoom"], 11, 5, 15, 9] } });
  carte.addLayer({ id: "trait-1984", type: "line", source: "traits", filter: ["==", ["get", "annee"], 1984],
    paint: { "line-color": "#FFFFFF", "line-width": 1.6, "line-dasharray": [2, 2], "line-opacity": 0.9 } });
  carte.addLayer({ id: "trait-annee", type: "line", source: "traits", filter: ["==", ["get", "annee"], 2026],
    layout: { "line-join": "round" },
    paint: { "line-color": "#FFFFFF", "line-width": 3 } });

  // Frise : un trait par année fiable, coloré comme sur la carte
  const n = etat.annees.length;
  $("curseur").max = n - 1;
  $("curseur").value = n - 1;
  const grad = $("graduations");
  etat.annees.forEach((a, i) => {
    const t = document.createElement("i");
    t.style.left = `${(i / (n - 1)) * 100}%`;
    t.style.background = couleurAnnee(a);
    grad.appendChild(t);
  });
  choisirAnnee(n - 1);
  cadrer();

  carte.on("mouseenter", "transects", () => (carte.getCanvas().style.cursor = "pointer"));
  carte.on("mouseleave", "transects", () => (carte.getCanvas().style.cursor = ""));
  carte.on("click", "transects", (e) => ouvrirFiche(e.features[0].properties.id));
}

// Le style est défini dans le code : il peut déjà être prêt à cette ligne
if (carte.isStyleLoaded()) initialiser();
else carte.once("style.load", initialiser);

// Couleur d'une année pour la frise (même dégradé que la carte)
function couleurAnnee(a) {
  const arrets = [[1984, [242, 193, 78]], [2000, [224, 227, 160]], [2012, [127, 196, 192]], [2026, [27, 108, 168]]];
  for (let i = 0; i < arrets.length - 1; i++) {
    const [a0, c0] = arrets[i], [a1, c1] = arrets[i + 1];
    if (a <= a1) {
      const t = (a - a0) / (a1 - a0);
      return `rgb(${c0.map((v, k) => Math.round(v + t * (c1[k] - v))).join(",")})`;
    }
  }
  return "rgb(27,108,168)";
}

function choisirAnnee(i) {
  etat.index = i;
  const a = etat.annees[i];
  $("annee").textContent = a;
  $("curseur").value = i;
  if (carte.getLayer("trait-annee")) carte.setFilter("trait-annee", ["==", ["get", "annee"], a]);
  if (etat.transect !== null) dessinerGraphe(etat.series.get(etat.transect));
}

$("curseur").addEventListener("input", (e) => {
  arreterLecture();
  choisirAnnee(+e.target.value);
});

function arreterLecture() {
  if (!etat.lecture) return;
  clearInterval(etat.lecture);
  etat.lecture = null;
  $("icone-lecture").setAttribute("d", "M7 5v14l12-7z");
  $("lecture").setAttribute("aria-label", "Lancer l'animation");
}

$("lecture").addEventListener("click", () => {
  if (etat.lecture) return arreterLecture();
  if (etat.index >= etat.annees.length - 1) choisirAnnee(0);
  $("icone-lecture").setAttribute("d", "M7 5h4v14H7zM13 5h4v14h-4z");
  $("lecture").setAttribute("aria-label", "Mettre l'animation en pause");
  etat.lecture = setInterval(() => {
    if (etat.index >= etat.annees.length - 1) return arreterLecture();
    choisirAnnee(etat.index + 1);
  }, 450);
});

document.querySelectorAll(".choix button").forEach((b) => {
  b.addEventListener("click", () => {
    document.querySelectorAll(".choix button").forEach((x) => x.setAttribute("aria-checked", x === b));
    etat.indicateur = b.dataset.ind;
    const ind = INDICATEURS[etat.indicateur];
    carte.setPaintProperty("transects", "line-color", couleurTaux(etat.indicateur));
    $("leg-min").textContent = ind.min;
    $("leg-max").textContent = ind.max;
  });
});

const fmt = (v, d = 1) => (v > 0 ? "+" : v < 0 ? "−" : "") + Math.abs(v).toFixed(d).replace(".", ",");

function ouvrirFiche(id) {
  const p = etat.series.get(id);
  if (!p) return;
  etat.transect = id;
  carte.setFilter("transect-choisi", ["==", ["get", "id"], id]);
  $("fiche").hidden = false;
  $("invite").hidden = true;
  $("fiche-titre").textContent = `Transect ${id} · ${p.km.toFixed(1).replace(".", ",")} km nord`;
  const signif = Math.abs(p.lrr) > p.lci;
  $("f-lrr").innerHTML = `${fmt(p.lrr, 1)} m/an<small>± ${p.lci.toFixed(1).replace(".", ",")} m/an${signif ? "" : ", non significatif"}</small>`;
  $("f-nsm").innerHTML = `${fmt(p.nsm, 0)} m<small>de 1984 à 2026</small>`;
  $("f-epr").innerHTML = `${fmt(p.epr, 1)} m/an<small>1984 et 2026 seules</small>`;
  $("f-lrr").style.color = signif ? (p.lrr < 0 ? "var(--recul)" : "var(--avancee)") : "";
  dessinerGraphe(p);
}

$("fermer").addEventListener("click", () => {
  etat.transect = null;
  carte.setFilter("transect-choisi", ["==", ["get", "id"], -1]);
  $("fiche").hidden = true;
  $("invite").hidden = false;
});

function dessinerGraphe(p) {
  const svg = $("graphe");
  const W = 320, H = 150, m = { g: 46, d: 16, h: 10, b: 20 };
  const pts = etat.annees.map((a, i) => [a, p.serie ? p.serie[i] : null]).filter(([, v]) => v !== null);
  if (!pts.length) { svg.innerHTML = ""; return; }
  const vals = pts.map(([, v]) => v);
  const ymax = Math.max(50, ...vals.map(Math.abs));
  const lim = Math.ceil(ymax / 50) * 50;
  const x = (a) => m.g + ((a - 1984) / (2026 - 1984)) * (W - m.g - m.d);
  const y = (v) => m.h + ((lim - v) / (2 * lim)) * (H - m.h - m.b);
  const anneeChoisie = etat.annees[etat.index];
  let s = "";
  [-lim, 0, lim].forEach((v) => {
    s += `<line x1="${m.g}" x2="${W - m.d}" y1="${y(v)}" y2="${y(v)}" stroke="${v === 0 ? "#8A9AA0" : "#E1E7E6"}" stroke-width="1"/>`;
    s += `<text x="${m.g - 5}" y="${y(v) + 3}" text-anchor="end">${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v)} m</text>`;
  });
  [1984, 2000, 2015, 2026].forEach((a) => (s += `<text x="${x(a)}" y="${H - 5}" text-anchor="middle">${a}</text>`));
  s += `<line x1="${x(anneeChoisie)}" x2="${x(anneeChoisie)}" y1="${m.h}" y2="${H - m.b}" stroke="#17262C" stroke-width="1" stroke-dasharray="2 2"/>`;
  s += `<polyline fill="none" stroke="#9AAAB0" stroke-width="1.2" points="${pts.map(([a, v]) => `${x(a)},${y(v)}`).join(" ")}"/>`;
  pts.forEach(([a, v]) => {
    const c = v < 0 ? "#C0392B" : "#1F6FA8";
    const r = a === anneeChoisie ? 5 : 3;
    s += `<circle cx="${x(a)}" cy="${y(v)}" r="${r}" fill="${c}" ${a === anneeChoisie ? 'stroke="#17262C" stroke-width="1.5"' : ""}><title>${a} : ${fmt(v, 0)} m</title></circle>`;
  });
  svg.innerHTML = s;
}

let attenteCadrage;
window.addEventListener("resize", () => {
  carte.resize();
  clearTimeout(attenteCadrage);
  attenteCadrage = setTimeout(cadrer, 200);
});
