#!/usr/bin/env node
/*
 * Boomerz : générateur du site statique.
 * Aucune dépendance. Usage : node build.js
 * Lit content/ et écrit le site complet dans dist/.
 * Variable optionnelle : BOOMERZ_DATE=AAAA-MM-JJ pour simuler une autre date.
 */
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const OUT = path.join(ROOT, "dist");
const C = (f) => JSON.parse(fs.readFileSync(path.join(ROOT, "content", f), "utf8"));

const config = C("config.json");
const cimetiere = C("cimetiere.json");
const SITE = config.url_site.replace(/\/$/, "");

/* ---------- Date du jour (Paris) ---------- */
const today = process.env.BOOMERZ_DATE ||
  new Intl.DateTimeFormat("en-CA", { timeZone: config.fuseau, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const ANNEE = Number(today.slice(0, 4));

/* ---------- Chargement et contrôle des fiches ---------- */
const REQUIS = ["date", "statut", "slug", "mot", "definition", "definition_courte", "origine", "exemple",
  "traduction_boomer", "gene_parent", "etat", "rarete", "apparu", "meme", "generations", "genealogie", "trendle"];
const ETATS = { "en-forme": "En pleine forme", "en-declin": "En déclin", "mort": "Mort et enterré" };
const RARETES = { commune: "Commune", rare: "Rare", epique: "Épique", legendaire: "Légendaire" };
const COULEURS = { commune: "#8E8E93", rare: "#0071E3", epique: "#7B3FE4", legendaire: "#C98A00" };

const dir = path.join(ROOT, "content", "jours");
const tous = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().map((f) => {
  const j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const manque = REQUIS.filter((k) => j[k] === undefined || j[k] === null || j[k] === "");
  if (manque.length) throw new Error(`${f} : champs manquants → ${manque.join(", ")}`);
  if (f !== `${j.date}.json`) throw new Error(`${f} : le nom du fichier doit être ${j.date}.json`);
  if (!ETATS[j.etat]) throw new Error(`${f} : etat inconnu « ${j.etat} »`);
  if (!RARETES[j.rarete]) throw new Error(`${f} : rarete inconnue « ${j.rarete} »`);
  if (!Array.isArray(j.trendle.indices) || j.trendle.indices.length !== 5) throw new Error(`${f} : le Trendle doit avoir 5 indices`);
  if (!/^[a-z0-9-]+$/.test(j.slug)) throw new Error(`${f} : slug invalide`);
  if (j.aussi_ecrit && !Array.isArray(j.aussi_ecrit)) throw new Error(`${f} : aussi_ecrit doit être une liste`);
  if (!["publie", "brouillon", "bloque"].includes(j.statut)) throw new Error(`${f} : statut inconnu « ${j.statut} »`);
  return j;
});
const slugs = new Set();
for (const j of tous) { if (slugs.has(j.slug)) throw new Error(`Slug en double : ${j.slug}`); slugs.add(j.slug); }

const publies = tous.filter((j) => j.statut === "publie" && j.date <= today);
if (!publies.length) throw new Error("Aucune fiche publiée à afficher.");
const jour = publies[publies.length - 1];

/* ---------- Outils ---------- */
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const json = (o) => JSON.stringify(o).replace(/</g, "\\u003c");
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const dateFr = (d) => { const [y, m, j] = d.split("-").map(Number); return `${j} ${MOIS[m - 1]} ${y}`; };
const dateCourte = (d) => { const [, m, j] = d.split("-").map(Number); return `${j} ${MOIS[m - 1]}`; };
const lienMot = (p, s) => `${p}mot/${s}/`;
const sansAccent = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const hote = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (e) { return u; } };
function write(rel, html) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function melange(arr, seed) { const a = arr.slice(); let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const k = s % (i + 1); [a[i], a[k]] = [a[k], a[i]]; } return a; }

const ICONE_PLAY = `<svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true"><path d="M3 2l15 9-15 9z" fill="currentColor"/></svg>`;

/* Pages piliers (chemin, libellé court pour la navigation et le pied de page) */
const PILIERS = [
  { url: "mots/", court: "Dictionnaire de l'argot des jeunes" },
  { url: "expressions-de-jeunes/", court: `Expressions de jeunes ${ANNEE}` },
  { url: "boomer-definition/", court: "Boomer : définition" },
  { url: "generations/", court: "Générations X, Y, Z et Alpha" },
  { url: "expressions-annees-80-90-2000/", court: "Expressions des années 80, 90 et 2000" },
];

/* ---------- Gabarit commun ---------- */
function page({ p, titre, description, canonique, corps, data, robots, type = "website", ld = [], publie, fil }) {
  const ldAll = ld.concat(fil ? [{
    "@context": "https://schema.org", "@type": "BreadcrumbList",
    itemListElement: [{ name: "Accueil", url: "/" }].concat(fil).map((x, i) => ({ "@type": "ListItem", position: i + 1, name: x.name, item: SITE + x.url })),
  }] : []);
  const filHtml = fil ? `<nav class="wrap fil" aria-label="Fil d'Ariane"><a href="${p}">Accueil</a>${fil.map((x, i) => i === fil.length - 1 ? ` <span aria-hidden="true">›</span> <span aria-current="page">${esc(x.name)}</span>` : ` <span aria-hidden="true">›</span> <a href="${p}${x.url.replace(/^\//, "")}">${esc(x.name)}</a>`).join("")}</nav>` : "";
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(SITE + canonique)}">
${robots ? `<meta name="robots" content="${robots}">` : `<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">`}
<meta name="theme-color" content="#FFFFFF">
<meta property="og:site_name" content="Boomerz">
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${type}">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(SITE + canonique)}">
<meta property="og:image" content="${SITE}/assets/og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${publie ? `<meta property="article:published_time" content="${publie}">` : ""}
<link rel="icon" href="${p}assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="${p}assets/apple-touch-icon.png">
<link rel="stylesheet" href="${p}assets/style.css">
${ldAll.map((o) => `<script type="application/ld+json">${json(o)}</script>`).join("\n")}
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="nav">
  <nav class="wrap nav-in" aria-label="Navigation principale">
    <a class="logo" href="${p}">Boomerz</a>
    <div class="nav-links">
      <a href="${p}#mot">Mot du jour</a>
      <a href="${p}mots/">Dictionnaire</a>
      <a href="${p}expressions-de-jeunes/">Expressions de jeunes</a>
      <a href="${p}generations/">Générations</a>
      <a href="${p}#jeux">Jeux</a>
    </div>
    <a class="pill" href="${p}#mot">Le mot du jour</a>
  </nav>
</header>
<div class="bandeau">Boomer, Gen X, millennial ou enfant des années 2000 ? Chaque jour, un mot de la Gen Z décodé pour toi. <a href="${p}#jeux">Tester mon niveau ›</a></div>
${filHtml}
<main id="contenu">
${corps}
</main>
<footer class="wrap pied">
  <nav class="pied-liens" aria-label="Pages de Boomerz">${PILIERS.map((x) => `<a href="${p}${x.url}">${esc(x.court)}</a>`).join("")}</nav>
  <p class="pied-seo">Boomerz est le dictionnaire de la Gen Z pour les boomers, la Gen X, les millennials et tous ceux qui ont grandi dans les années 80, 90 ou 2000. Chaque jour, un mot d'argot des jeunes, une expression d'ado ou une tendance TikTok expliqués simplement : ce que ça veut dire, d'où ça vient, et comment on le disait à ton époque.</p>
  <div class="pied-bas"><span>© ${ANNEE} Boomerz</span><span><a href="${p}mentions-legales/">Mentions légales</a>${config.email_contact ? ` · <a href="mailto:${esc(config.email_contact)}?subject=Proposer%20un%20mot">Proposer un mot</a>` : ""}</span></div>
</footer>
${data ? `<script>window.BOOMERZ=${json(data)};</script>` : ""}
<script src="${p}assets/app.js" defer></script>
</body>
</html>`;
}

/* ---------- Blocs ---------- */
function pub(n) {
  const code = config.pub[`bandeau_${n}_html`];
  if (code) return `<section class="wrap pub" aria-label="Publicité"><div class="pub-label">Publicité</div>${code}</section>`;
  if (!config.pub.afficher_emplacements_vides) return "";
  const format = n === 1 ? "970 × 250 sur ordinateur, 320 × 100 sur mobile" : "728 × 90 sur ordinateur, 300 × 250 sur mobile";
  return `<section class="wrap pub" aria-label="Publicité"><div class="pub-label">Publicité</div><div class="pub-vide pub-${n}"><strong>Bandeau ${n} · ${format}</strong><span>Emplacement réservé</span></div></section>`;
}

function carte(j, p, { grande = false } = {}) {
  const couleur = COULEURS[j.rarete];
  const meme = j.meme.embed_url
    ? `<div class="carte-meme video"><iframe src="${esc(j.meme.embed_url)}" title="Le mème d'origine de ${esc(j.mot)}" loading="lazy" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
    : `<div class="carte-meme"><span class="play">${ICONE_PLAY}</span><span class="meme-legende">Le mème d'origine · ${esc(j.meme.plateforme)}, ${esc(j.meme.annee)}</span></div>`;
  const incarne = j.generations.slice().reverse().slice(0, 3).map((g) => g.incarne.split(/[,(]/)[0].trim()).join(", ");
  const gen = j.genealogie.map((g, i) => `<span class="${i === j.genealogie.length - 1 ? "fin" : ""}">${esc(g)}</span>`).join(`<b aria-hidden="true">›</b>`);
  return `<article class="carte${grande ? " grande" : ""}" style="--r:${couleur}" data-slug="${esc(j.slug)}">
  <div class="carte-tete"><span class="rarete">${RARETES[j.rarete]}</span><span class="num">${esc(dateCourte(j.date))}</span></div>
  ${meme}
  <p class="carte-mot"><a href="${lienMot(p, j.slug)}">${esc(j.mot)}</a></p>
  <p class="carte-incarne">Incarné par : ${esc(incarne)}</p>
  <div class="carte-genea"><div class="mini-titre">Généalogie</div><div class="chaine">${gen}</div></div>
  <div class="carte-pied"><span>Apparu : ${esc(j.apparu)}</span><span>${ETATS[j.etat]}</span></div>
</article>`;
}

function generations(j, { titreNiveau = "h2" } = {}) {
  const items = j.generations.map((g, i) => {
    const derniere = i === j.generations.length - 1;
    const premiere = i === 0 && !/^\d/.test(g.epoque);
    return `<div class="ere${derniere ? " ere-z" : ""}${premiere ? " ere-ancienne" : ""}">
      <div class="ere-annee${premiere ? " petit" : ""}">${esc(g.epoque)}</div>
      <div><div class="ere-dit">${esc(g.dit)}</div><div class="ere-label">Incarné par</div><div class="ere-qui">${esc(g.incarne)}</div></div>
    </div>`;
  }).join("");
  return `<section class="wrap section" aria-labelledby="gen-titre">
  <${titreNiveau} id="gen-titre" class="titre-section">Une même idée.<br>Cinq générations. Et même avant.</${titreNiveau}>
  <p class="sous-titre">Comment on disait « ${esc(j.mot.toLowerCase())} » à ton époque, et qui l'incarnait.</p>
  <div class="eres">${items}</div>
</section>`;
}

function details(j, p, { lien = true } = {}) {
  const jauge = [1, 2, 3, 4, 5].map((n) => `<i class="${n <= j.gene_parent ? "on" : ""}"></i>`).join("");
  return `<div class="details">
  <p class="mini-titre">${esc(j.nature || "")}${j.prononciation ? ` · [ ${esc(j.prononciation)} ]` : ""}</p>
  <p class="def">${esc(j.definition)}</p>
  <dl>
    <div><dt>Origine</dt><dd>${esc(j.origine)}</dd></div>
    <div><dt>En vrai</dt><dd class="exemple">« ${esc(j.exemple)} »</dd></div>
    <div><dt>Traduction boomer</dt><dd class="boomer">« ${esc(j.traduction_boomer)} »</dd></div>
    <div><dt>Gêne si un parent l'utilise</dt><dd><span class="jauge" role="img" aria-label="${j.gene_parent} sur 5">${jauge}</span> ${j.gene_parent}/5</dd></div>
  </dl>
  <div class="actions">
    <button class="btn" type="button" data-collect="${esc(j.slug)}">Ajouter à mon album</button>
    ${lien ? `<a class="lien" href="${lienMot(p, j.slug)}">Lire la fiche complète ›</a>` : ""}
  </div>
</div>`;
}

/* Questions-réponses d'une fiche (affichées et en données structurées) */
function questions(j) {
  const m = j.mot;
  const avant = j.generations.slice(0, -1).map((g) => `« ${g.dit} » (${g.epoque})`).join(", ");
  return [
    { q: `Ça veut dire quoi « ${m} » ?`, r: j.definition },
    { q: `D'où vient « ${m} » ?`, r: j.origine },
    { q: `Comment on disait « ${m} » avant ?`, r: `Selon les époques, on disait : ${avant}. En langage boomer, on traduirait par « ${j.traduction_boomer} »` },
    { q: `Comment utiliser « ${m} » dans une phrase ?`, r: `Par exemple : « ${j.exemple} »` },
  ];
}

function proches(j, p) {
  const autres = melange(publies.filter((x) => x.slug !== j.slug), hash(j.slug)).slice(0, 4);
  if (!autres.length) return "";
  return `<section class="wrap section-courte" aria-labelledby="proches-titre">
  <h2 id="proches-titre" class="titre-moyen">D'autres mots de la Gen Z à décoder</h2>
  <ul class="proches">${autres.map((x) => `<li><a href="${lienMot(p, x.slug)}"><span class="dico-mot">${esc(x.mot)}</span><span class="dico-def">${esc(x.definition_courte)}</span></a></li>`).join("")}</ul>
</section>`;
}

/* ---------- Quiz : questions tirées des derniers mots ---------- */
function construireQuiz() {
  if (publies.length < 4) return null;
  return publies.slice(-6).map((j) => {
    const autres = melange(publies.filter((x) => x.slug !== j.slug), hash(j.slug + today)).slice(0, 3).map((x) => x.definition_courte);
    const options = melange([j.definition_courte, ...autres], hash(today + j.slug));
    return { q: `« ${j.mot} », ça veut dire…`, o: options, a: options.indexOf(j.definition_courte), w: j.definition };
  });
}

/* ---------- Page d'accueil ---------- */
function accueil() {
  const p = "";
  const album = publies.slice().reverse().map((j) => `<a class="mini" href="${lienMot(p, j.slug)}" data-slug="${esc(j.slug)}" style="--r:${COULEURS[j.rarete]}">
      <span class="mini-meme">${ICONE_PLAY}</span><span class="mini-mot">${esc(j.mot)}</span><span class="mini-def">${esc(j.definition_courte)}</span>
    </a>`).join("");
  const tombes = cimetiere.map((t) => `<li><span class="tombe-mot">${esc(t.mot)}</span><span class="tombe-date">${esc(t.periode)}</span><span class="tombe-epi">${esc(t.epitaphe)}</span></li>`).join("");
  const derniers = publies.slice(0, -1).reverse().slice(0, 8);
  const nbQuiz = Math.min(publies.length, 6);
  const corps = `
<section id="mot" class="wrap hero">
  <p class="surtitre">Le mot du jour · ${esc(dateCourte(jour.date))}</p>
  <h1><span class="sr">Le dico de la Gen Z pour les boomers. Mot du jour : </span>${esc(jour.mot)}.</h1>
  <p class="chapo">${esc(jour.definition_courte)}. Ta génération le faisait déjà, la Gen Z lui a donné un nom.</p>
  <div class="liens-hero"><a href="${lienMot(p, jour.slug)}">Ça veut dire quoi « ${esc(jour.mot)} » ? ›</a><a href="#jeux">Jouer au Trendle ›</a></div>
</section>
<section class="wrap" aria-label="Carte du jour">
  <div class="panneau carte-zone">${carte(jour, p, { grande: true })}${details(jour, p)}</div>
</section>
${pub(1)}
${generations(jour)}
<section id="jeux" class="wrap section-courte">
  <div class="tuiles">
    <div class="tuile gris" id="trendle">
      <p class="surtitre">Jeu quotidien · Trendle du ${esc(dateCourte(jour.date))}</p>
      <h2>Trendle</h2>
      <p class="tuile-txt">Cinq indices. Cinq essais. Un mot de la Gen Z à deviner.</p>
      <ol class="indices" id="tr-indices"></ol>
      <div class="cases" id="tr-cases" aria-hidden="true"></div>
      <form id="tr-form" class="tr-form" autocomplete="off">
        <label class="sr" for="tr-input">Ta réponse</label>
        <input id="tr-input" placeholder="Ta réponse…" maxlength="30">
        <button class="btn" type="submit">Valider</button>
      </form>
      <p class="tr-deja" id="tr-deja"></p>
      <div class="tr-res" id="tr-res" hidden>
        <p class="tr-titre" id="tr-titre"></p>
        <p id="tr-expl"></p>
        <button class="btn clair" type="button" id="tr-share">Copier mon résultat</button>
        <p class="toast" id="tr-toast" role="status"></p>
      </div>
    </div>
    <div class="tuile noire" id="quiz">
      <p class="surtitre orange">Test</p>
      <h2>Quel âge a ton vocabulaire ?</h2>
      <p class="tuile-txt gris-clair">${nbQuiz} questions sur les derniers mots. Verdict : daron fossile ou collégien infiltré.</p>
      <div id="quiz-box" class="quiz-box"></div>
    </div>
  </div>
</section>
${pub(2)}
<section class="wrap section-courte" aria-labelledby="derniers-titre">
  <h2 id="derniers-titre" class="titre-moyen">Les derniers mots décodés</h2>
  <ul class="proches">${derniers.map((x) => `<li><a href="${lienMot(p, x.slug)}"><span class="dico-mot">${esc(x.mot)}</span><span class="dico-def">${esc(x.definition_courte)}</span></a></li>`).join("")}</ul>
  <p class="voir-tout"><a href="mots/">Voir tout le dictionnaire de l'argot des jeunes ›</a></p>
</section>
<section id="album" class="wrap section-courte">
  <div class="tuiles">
    <div class="tuile gris">
      <h2>L'album</h2>
      <p class="tuile-txt"><span id="album-compte">0</span> carte(s) dans ton album sur ${publies.length} sorties.</p>
      <div class="album">${album}</div>
    </div>
    <div class="tuile gris">
      <h2>Le cimetière</h2>
      <p class="tuile-txt">Ils ont été partout. Puis plus nulle part.</p>
      <ul class="tombes">${tombes}</ul>
    </div>
  </div>
</section>
<section class="wrap section-courte prose" aria-labelledby="cest-quoi">
  <h2 id="cest-quoi" class="titre-moyen">Boomerz, c'est quoi ?</h2>
  <p>Ton ado dit que ton pull est « polyester », que son contrôle de maths l'a laissé « cooked » ou que son crush a « trop d'aura » ? Pas de panique. Boomerz est un <a href="mots/">dictionnaire de l'argot des jeunes</a> fait pour les parents, les boomers, la Gen X et les millennials qui veulent comprendre le vocabulaire de la Gen Z et de la Gen Alpha, sans avoir à demander.</p>
  <p>Chaque jour, un nouveau mot : ce qu'il veut dire, d'où il vient, un exemple, et surtout comment on disait la même chose <a href="expressions-annees-80-90-2000/">dans les années 80, 90 ou 2000</a>. Tu peux aussi parcourir <a href="expressions-de-jeunes/">les expressions de jeunes de ${ANNEE}</a>, savoir <a href="boomer-definition/">ce qu'est vraiment un boomer</a>, ou retrouver <a href="generations/">les dates de chaque génération</a>.</p>
</section>`;
  const ld = [
    { "@context": "https://schema.org", "@type": "WebSite", name: "Boomerz", alternateName: "Boomerz, le dico de la Gen Z", url: SITE + "/", inLanguage: "fr-FR", description: config.description },
    { "@context": "https://schema.org", "@type": "Organization", name: "Boomerz", url: SITE + "/", logo: SITE + "/assets/apple-touch-icon.png" },
  ];
  return page({
    p, canonique: "/", ld,
    titre: "Boomerz · Le dico de la Gen Z : l'argot des jeunes expliqué aux boomers",
    description: `Ça veut dire quoi « ${jour.mot} » ? Chaque jour, Boomerz explique un mot d'argot de la Gen Z aux boomers et aux parents : définition, origine et équivalent des années 80, 90 et 2000.`,
    corps,
    data: { date: jour.date, site: SITE, trendle: jour.trendle, quiz: construireQuiz() },
  });
}

/* ---------- Page d'une fiche ---------- */
function fiche(j, i) {
  const p = "../../";
  const prec = publies[i - 1], suiv = publies[i + 1];
  const qs = questions(j);
  const variantes = (j.aussi_ecrit || []).filter((v) => v.toLowerCase() !== j.mot.toLowerCase());
  const sources = (j.sources || []).filter(Boolean);
  const corps = `
<section class="wrap hero hero-fiche">
  <p class="surtitre">Mot du ${esc(dateFr(j.date))}</p>
  <h1>${esc(j.mot)}</h1>
  <p class="chapo">Ça veut dire quoi « ${esc(j.mot)} » ? Définition, origine et équivalents d'époque, expliqués aux boomers et aux parents.</p>
  ${variantes.length ? `<p class="aussi">Aussi écrit : ${variantes.map(esc).join(", ")}</p>` : ""}
</section>
<section class="wrap" aria-label="Définition">
  <div class="panneau carte-zone">${carte(j, p, { grande: true })}${details(j, p, { lien: false })}</div>
</section>
${pub(1)}
${generations(j)}
<section class="wrap section-courte faq" aria-labelledby="faq-titre">
  <h2 id="faq-titre" class="titre-moyen">« ${esc(j.mot)} » en 4 questions</h2>
  ${qs.map((x) => `<details open><summary><h3>${esc(x.q)}</h3></summary><p>${esc(x.r)}</p></details>`).join("")}
</section>
${sources.length ? `<section class="wrap sources" aria-label="Sources"><p><strong>Sources :</strong> ${sources.map((u) => `<a href="${esc(u)}" rel="noopener nofollow" target="_blank">${esc(hote(u))}</a>`).join(" · ")}</p></section>` : ""}
${proches(j, p)}
<nav class="wrap prec-suiv" aria-label="Mot précédent et suivant">
  ${prec ? `<a href="${lienMot(p, prec.slug)}">‹ ${esc(prec.mot)}</a>` : "<span></span>"}
  <a href="${p}mots/">Tout le dictionnaire</a>
  ${suiv ? `<a href="${lienMot(p, suiv.slug)}">${esc(suiv.mot)} ›</a>` : "<span></span>"}
</nav>
${pub(2)}`;
  const url = `/mot/${j.slug}/`;
  const ld = [
    { "@context": "https://schema.org", "@type": "DefinedTerm", name: j.mot, alternateName: variantes.length ? variantes : undefined, description: j.definition, url: SITE + url, inLanguage: "fr-FR",
      inDefinedTermSet: { "@type": "DefinedTermSet", name: "Boomerz, le dictionnaire de l'argot des jeunes", url: SITE + "/mots/" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.r } })) },
  ];
  const dc = j.definition_courte.replace(/\.$/, "");
  const desc = `${j.mot} : ${dc.charAt(0).toLowerCase() + dc.slice(1)}. Ça veut dire quoi, d'où ça vient, un exemple et l'équivalent des années 80, 90 et 2000, expliqués aux boomers.`;
  return page({
    p, canonique: url, ld, type: "article", publie: j.date,
    fil: [{ name: "Dictionnaire", url: "/mots/" }, { name: j.mot, url }],
    titre: `Ça veut dire quoi « ${j.mot} » ? Définition et origine | Boomerz`,
    description: desc,
    corps,
  });
}

/* ---------- Dictionnaire A à Z ---------- */
function dictionnaire() {
  const p = "../";
  const tri = publies.slice().sort((a, b) => sansAccent(a.mot).localeCompare(sansAccent(b.mot), "fr", { sensitivity: "base", numeric: true }));
  const lettre = (m) => { const c = sansAccent(m).charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "0-9"; };
  const groupes = {};
  tri.forEach((j) => { (groupes[lettre(j.mot)] = groupes[lettre(j.mot)] || []).push(j); });
  const lettres = Object.keys(groupes);
  const corps = `<section class="wrap hero hero-fiche"><h1 class="h1-long">Dictionnaire de l'argot des jeunes</h1><p class="chapo">${publies.length} mots et expressions de la Gen Z et de la Gen Alpha expliqués aux boomers, de A à Z. Un nouveau chaque jour.</p></section>
<nav class="wrap lettres" aria-label="Lettres">${lettres.map((l) => `<a href="#l-${l}">${l}</a>`).join("")}</nav>
<section class="wrap">${lettres.map((l) => `<h2 class="lettre" id="l-${l}">${l}</h2><ul class="dico">${groupes[l].map((j) => `<li><a href="${lienMot(p, j.slug)}"><span class="dico-mot">${esc(j.mot)}</span><span class="dico-def">${esc(j.definition_courte)}</span><span class="dico-boomer">Version boomer : « ${esc(j.traduction_boomer)} »</span></a></li>`).join("")}</ul>`).join("")}</section>
${pub(2)}`;
  return page({ p, canonique: "/mots/", fil: [{ name: "Dictionnaire", url: "/mots/" }],
    titre: "Dictionnaire de l'argot des jeunes : tous les mots de la Gen Z | Boomerz",
    description: `Le dictionnaire de l'argot des jeunes : ${publies.length} mots de la Gen Z et de la Gen Alpha expliqués aux boomers et aux parents, de A à Z, avec leur équivalent d'époque.`,
    corps,
    ld: [{ "@context": "https://schema.org", "@type": "DefinedTermSet", name: "Boomerz, le dictionnaire de l'argot des jeunes", url: SITE + "/mots/", inLanguage: "fr-FR",
      hasDefinedTerm: tri.map((j) => ({ "@type": "DefinedTerm", name: j.mot, url: `${SITE}/mot/${j.slug}/` })) }] });
}

/* ---------- Expressions de jeunes de l'année ---------- */
function expressionsJeunes() {
  const p = "../";
  const liste = publies.slice().reverse();
  const corps = `<section class="wrap hero hero-fiche"><h1 class="h1-long">Expressions de jeunes ${ANNEE} : ce que disent les ados</h1><p class="chapo">${liste.length} mots de la Gen Z et de la Gen Alpha à connaître cette année, et ce qu'ils veulent vraiment dire. Mis à jour chaque jour.</p></section>
<section class="wrap prose">
  <p>Le vocabulaire des ados change à toute vitesse : un mot né sur TikTok peut envahir les cours de récré en quelques semaines, puis disparaître aussi vite. Voici les expressions de jeunes qui circulent en ${ANNEE}, des plus récentes aux plus installées, avec pour chacune sa traduction en langage boomer.</p>
  <ol class="liste-expr">${liste.map((j) => `<li>
    <h2><a href="${lienMot(p, j.slug)}">${esc(j.mot)}</a> : ${esc(j.definition_courte.replace(/\.$/, "").toLowerCase())}</h2>
    <p>${esc(j.definition)}</p>
    <p class="expr-ex">Exemple : « ${esc(j.exemple)} »</p>
    <p class="expr-boomer">En langage boomer : <strong>« ${esc(j.traduction_boomer)} »</strong></p>
  </li>`).join("")}</ol>
  <p>Un mot t'échappe encore ? Il est peut-être dans le <a href="${p}mots/">dictionnaire complet de l'argot des jeunes</a>, ou dans le <a href="${p}">mot du jour</a>.</p>
</section>
${pub(2)}`;
  return page({ p, canonique: "/expressions-de-jeunes/", fil: [{ name: `Expressions de jeunes ${ANNEE}`, url: "/expressions-de-jeunes/" }],
    titre: `Expressions de jeunes ${ANNEE} : ${liste.length} mots de la Gen Z expliqués | Boomerz`,
    description: `Les expressions de jeunes de ${ANNEE} expliquées aux parents et aux boomers : ${liste.slice(0, 5).map((j) => j.mot).join(", ")}… Définitions, exemples et traductions en langage boomer.`,
    corps,
    ld: [{ "@context": "https://schema.org", "@type": "ItemList", name: `Expressions de jeunes ${ANNEE}`, itemListElement: liste.map((j, k) => ({ "@type": "ListItem", position: k + 1, url: `${SITE}/mot/${j.slug}/`, name: j.mot })) }] });
}

/* ---------- Boomer : définition ---------- */
function boomerDefinition() {
  const p = "../";
  const ageMin = ANNEE - 1964, ageMax = ANNEE - 1946;
  const qs = [
    { q: "C'est quoi, un boomer ?", r: `Au sens propre, un boomer (ou baby-boomer) est une personne née pendant le baby-boom qui a suivi la Seconde Guerre mondiale, en gros entre 1946 et 1964. Au sens familier, les jeunes appellent « boomer » toute personne qu'ils trouvent dépassée ou réfractaire à la nouveauté, quel que soit son âge.` },
    { q: "Quel âge a un boomer ?", r: `Les baby-boomers nés entre 1946 et 1964 ont entre ${ageMin} et ${ageMax} ans en ${ANNEE}. Mais au sens moqueur, on peut se faire traiter de boomer à 35 ans, dès qu'on ne connaît pas le dernier mot à la mode.` },
    { q: "D'où vient « OK boomer » ?", r: "La formule se répand sur internet en 2019, notamment sur TikTok, pour couper court au discours condescendant d'un aîné. Elle devient célèbre en novembre 2019, quand la députée néo-zélandaise Chlöe Swarbrick, 25 ans, la lance en plein Parlement à un collègue qui l'interrompt." },
    { q: "Est-ce que « boomer » est une insulte ?", r: "C'est plutôt une moquerie qu'une insulte. Selon le ton, ça va de la taquinerie affectueuse (« t'es trop boomer, papa ») au reproche (« ok boomer » pour clore une discussion). Le meilleur moyen de désamorcer : en rire, et apprendre deux ou trois mots de leur vocabulaire." },
  ];
  const corps = `<section class="wrap hero hero-fiche"><h1 class="h1-long">Boomer : définition, âge et origine de « OK boomer »</h1><p class="chapo">Qui est vraiment un boomer, pourquoi les jeunes l'utilisent pour se moquer, et comment éviter d'en passer pour un.</p></section>
<section class="wrap prose">
  <h2>C'est quoi, un boomer ?</h2>
  <p>Au départ, le mot n'a rien de moqueur. Un <strong>boomer</strong>, ou <strong>baby-boomer</strong>, désigne une personne née pendant le <em>baby-boom</em>, la forte hausse des naissances qui a suivi la Seconde Guerre mondiale. On retient en général les années <strong>1946 à 1964</strong>, même si les dates varient selon les sources : certains historiens français font durer le baby-boom jusqu'à la fin des années 1960.</p>
  <p>Ce sont les enfants des Trente Glorieuses : la télé en noir et blanc, les yé-yé et Salut les copains, Mai 68, la première voiture et souvent la maison achetée jeune. En ${ANNEE}, ils ont entre ${ageMin} et ${ageMax} ans.</p>
  <h2>Le sens moqueur : le boomer, c'est celui qui ne suit plus</h2>
  <p>Depuis la fin des années 2010, les jeunes emploient « boomer » dans un sens beaucoup plus large : est boomer toute personne jugée dépassée, ringarde ou rétive au changement. Peu importe l'âge réel. Un trentenaire qui ne comprend pas « <a href="${p}mot/aura-farming/">aura farming</a> » ou qui prononce mal « <a href="${p}mot/rizz/">rizz</a> » peut très bien se faire traiter de boomer. Les synonymes du moment : <em>daron</em>, <em>tonton</em>, ou simplement <em>vieux</em>.</p>
  <h2>D'où vient « OK boomer » ?</h2>
  <p>« OK boomer » est la réplique qui clôt la discussion. Elle se répand sur internet en 2019, notamment sur TikTok, en réponse aux aînés qui expliquent la vie aux jeunes. Elle devient mondialement célèbre en novembre 2019, quand la députée néo-zélandaise Chlöe Swarbrick, 25 ans, la lance en plein Parlement à un collègue plus âgé qui l'interrompt pendant un discours sur le climat.</p>
  <h2>Boomer, Gen X, millennial, Gen Z : qui est qui ?</h2>
  <p>Les baby-boomers sont suivis par la génération X (nés entre 1965 et 1980 environ), puis par les millennials ou génération Y (1981 à 1996), la génération Z (1997 à 2012) et la génération Alpha. Les dates exactes et ce qui caractérise chaque génération sont détaillés sur la page <a href="${p}generations/">générations X, Y, Z et Alpha</a>.</p>
  <h2>Comment ne pas (trop) passer pour un boomer</h2>
  <p>Première règle : ne pas essayer de parler comme eux. Un adulte qui dit « c'est une <a href="${p}mot/dinguerie/">dinguerie</a> » au dîner, c'est cringe garanti. Deuxième règle : comprendre quand même. C'est le principe de Boomerz : un mot par jour, expliqué simplement, avec son équivalent de ton époque. Commence par le <a href="${p}">mot du jour</a>, ou teste ton niveau avec le <a href="${p}#quiz">quiz « Quel âge a ton vocabulaire ? »</a>.</p>
</section>
<section class="wrap section-courte faq" aria-labelledby="faq-titre"><h2 id="faq-titre" class="titre-moyen">Les questions qu'on se pose sur les boomers</h2>${qs.map((x) => `<details open><summary><h3>${esc(x.q)}</h3></summary><p>${esc(x.r)}</p></details>`).join("")}</section>
${pub(2)}`;
  return page({ p, canonique: "/boomer-definition/", type: "article", fil: [{ name: "Boomer : définition", url: "/boomer-definition/" }],
    titre: "Boomer : définition, âge et origine de « OK boomer » | Boomerz",
    description: `C'est quoi un boomer ? Définition du baby-boomer (né entre 1946 et 1964), sens moqueur chez les jeunes, origine de « OK boomer » et équivalents des générations X, Y et Z.`,
    corps,
    ld: [{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qs.map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.r } })) }] });
}

/* ---------- Générations X, Y, Z, Alpha ---------- */
function generationsPage() {
  const p = "../";
  const G = [
    { nom: "Baby-boomers", debut: 1946, fin: 1964, ancre: "annees-60", decor: "La télé en noir et blanc, les yé-yé, Mai 68, la 2CV.", parle: "« C'est le pied », « avoir un ticket », « poser un lapin »." },
    { nom: "Génération X", debut: 1965, fin: 1980, ancre: "annees-80", decor: "Le Walkman, le Club Dorothée, le Top 50, le Minitel.", parle: "« C'est géant », « avoir les boules », « un beauf »." },
    { nom: "Génération Y (millennials)", debut: 1981, fin: 1996, ancre: "annees-90", decor: "La Game Boy, le Tamagotchi, le Tatoo, les premières années d'internet.", parle: "« C'est d'la balle », « se la péter », « avoir la haine »." },
    { nom: "Génération Z", debut: 1997, fin: 2012, ancre: "annees-2000", decor: "Le smartphone dès le collège, Snapchat, Instagram puis TikTok.", parle: "« Le seum », « cringe », « ghoster », « avoir du rizz »." },
    { nom: "Génération Alpha", debut: 2013, fin: 2025, ancre: null, decor: "La tablette dès le berceau, YouTube Kids, Skibidi Toilet.", parle: "« Six seven », « skibidi », « aura farming »." },
  ];
  const lignes = G.map((g) => `<tr><th scope="row">${esc(g.nom)}</th><td>${g.debut} – ${g.fin}${g.nom === "Génération Alpha" ? " (environ)" : ""}</td><td>${Math.max(0, ANNEE - g.fin)} à ${ANNEE - g.debut} ans</td><td>${esc(g.decor)}</td><td>${esc(g.parle)}${g.ancre ? ` <a href="${p}expressions-annees-80-90-2000/#${g.ancre}">Leurs expressions ›</a>` : ""}</td></tr>`).join("");
  const corps = `<section class="wrap hero hero-fiche"><h1 class="h1-long">Boomers, générations X, Y, Z et Alpha : dates et définitions</h1><p class="chapo">Qui est né quand, à quoi ressemblait leur jeunesse, et comment chaque génération parlait.</p></section>
<section class="wrap prose">
  <p>Les sociologues et les publicitaires découpent la population en générations d'une quinzaine d'années. Les dates varient d'une source à l'autre, d'un ou deux ans en général : celles ci-dessous sont les plus couramment utilisées. Les âges sont calculés pour ${ANNEE}.</p>
  <div class="table-box"><table class="gen-table"><caption>Les générations, de la plus ancienne à la plus jeune</caption><thead><tr><th scope="col">Génération</th><th scope="col">Nés entre</th><th scope="col">Âge en ${ANNEE}</th><th scope="col">Leur jeunesse</th><th scope="col">Comment ils parlaient</th></tr></thead><tbody>${lignes}</tbody></table></div>
  <h2>Les baby-boomers (1946 – 1964)</h2>
  <p>Nés dans l'après-guerre, ils ont grandi pendant les Trente Glorieuses. C'est d'eux que vient le mot « boomer », devenu une moquerie chez les jeunes : tout savoir sur <a href="${p}boomer-definition/">la définition de boomer et « OK boomer »</a>.</p>
  <h2>La génération X (1965 – 1980)</h2>
  <p>Coincée entre les boomers et les millennials, elle a connu l'enfance sans écran et l'arrivée de l'ordinateur personnel. Ce sont souvent les parents des ados d'aujourd'hui.</p>
  <h2>Les millennials ou génération Y (1981 – 1996)</h2>
  <p>Première génération à avoir grandi avec internet et le téléphone portable, de MSN aux Skyblogs. On les appelle « Y », prononcé comme « why », la génération qui demande pourquoi.</p>
  <h2>La génération Z (1997 – 2012)</h2>
  <p>Nés avec le numérique, ils inventent une bonne partie de l'argot actuel sur les réseaux sociaux. C'est leur vocabulaire que Boomerz décode chaque jour : voir <a href="${p}expressions-de-jeunes/">les expressions de jeunes de ${ANNEE}</a>.</p>
  <h2>La génération Alpha (à partir de 2013 environ)</h2>
  <p>Les enfants des millennials, nés avec une tablette entre les mains. Leurs mots, souvent absurdes, envahissent déjà les cours de récré : <a href="${p}mot/six-seven/">six seven</a>, <a href="${p}mot/skibidi/">skibidi</a> ou le <a href="${p}mot/brainrot/">brainrot</a>.</p>
</section>
${pub(2)}`;
  return page({ p, canonique: "/generations/", type: "article", fil: [{ name: "Générations X, Y, Z et Alpha", url: "/generations/" }],
    titre: "Boomers, générations X, Y, Z et Alpha : dates et âges | Boomerz",
    description: `Baby-boomers, génération X, millennials, génération Z et Alpha : années de naissance, âge en ${ANNEE}, jeunesse et expressions de chaque génération.`,
    corps });
}

/* ---------- Expressions des années 60 à 2000 (tirées des fiches) ---------- */
function expressionsEpoques() {
  const p = "../";
  const SECTIONS = [
    { id: "annees-2000", titre: "Expressions des années 2000", test: (a) => a >= 2000 && a < 2020 },
    { id: "annees-90", titre: "Expressions des années 90", test: (a) => a >= 1990 && a < 2000 },
    { id: "annees-80", titre: "Expressions des années 80", test: (a) => a >= 1980 && a < 1990 },
    { id: "annees-70", titre: "Expressions des années 70", test: (a) => a >= 1970 && a < 1980 },
    { id: "annees-60", titre: "Expressions des années 60", test: (a) => a >= 1950 && a < 1970 },
    { id: "autrefois", titre: "Expressions d'autrefois : le français de nos aïeux", test: (a) => a === null || a < 1950 },
  ];
  const entrees = [];
  publies.forEach((j) => j.generations.slice(0, -1).forEach((g) => {
    const m = /^(\d{4})/.exec(g.epoque);
    entrees.push({ an: m ? Number(m[1]) : null, epoque: g.epoque, dit: g.dit, incarne: g.incarne, j });
  }));
  const blocs = SECTIONS.map((s) => {
    const liste = entrees.filter((e) => s.test(e.an));
    if (!liste.length) return "";
    return `<h2 id="${s.id}">${esc(s.titre)}</h2><ul class="epoque-liste">${liste.map((e) => `<li><span class="ep-dit">« ${esc(e.dit)} »</span>${s.id === "autrefois" ? ` <span class="ep-date">(${esc(e.epoque)})</span>` : ""}<span class="ep-qui">${esc(e.incarne)}</span><span class="ep-z">Aujourd'hui, la Gen Z dit : <a href="${lienMot(p, e.j.slug)}">${esc(e.j.mot)}</a></span></li>`).join("")}</ul>`;
  }).join("");
  const corps = `<section class="wrap hero hero-fiche"><h1 class="h1-long">Expressions des années 80, 90 et 2000 : comment on parlait avant la Gen Z</h1><p class="chapo">Avant « cooked », on disait « les carottes sont cuites ». Avant « crush », on « en pinçait ». Voici les expressions de chaque époque, et leur version Gen Z.</p></section>
<nav class="wrap lettres" aria-label="Époques">${SECTIONS.map((s) => `<a href="#${s.id}">${esc(s.titre.replace("Expressions des ", "").replace("Expressions d'autrefois : le français de nos aïeux", "Autrefois"))}</a>`).join("")}</nav>
<section class="wrap prose">${blocs}</section>
${pub(2)}`;
  return page({ p, canonique: "/expressions-annees-80-90-2000/", type: "article", fil: [{ name: "Expressions des années 80, 90 et 2000", url: "/expressions-annees-80-90-2000/" }],
    titre: "Expressions des années 80, 90 et 2000 et leur version Gen Z | Boomerz",
    description: "Les expressions des années 60, 70, 80, 90 et 2000, et comment la Gen Z dit la même chose aujourd'hui : « c'est d'la balle », « avoir les boules », « se la péter »…",
    corps });
}

/* ---------- Mentions légales ---------- */
function mentions() {
  const p = "../";
  const ed = config.editeur || {};
  const anonyme = !ed.nom || /^\[/.test(ed.nom);
  const corps = `<section class="wrap hero hero-fiche"><h1 class="h1-long">Mentions légales</h1></section>
<section class="wrap prose">
  <h2>Éditeur du site</h2>
  ${anonyme
    ? `<p>Ce site est édité à titre non professionnel par un particulier qui a choisi de rester anonyme, comme le permet l'article 6, III, 2 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l'économie numérique. Ses coordonnées ont été communiquées à l'hébergeur.</p>`
    : `<p>${esc(ed.nom)}${ed.contact ? `<br>Contact : ${esc(ed.contact)}` : ""}</p>`}
  <h2>Hébergement</h2><p>Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.</p>
  <h2>Contenus</h2><p>Les fiches sont rédigées avec l'aide d'une intelligence artificielle à partir de sources publiques citées sur chaque fiche, puis relues avant publication. Les vidéos citées appartiennent à leurs auteurs et sont intégrées via les outils officiels des plateformes. Les personnalités et œuvres mentionnées le sont à titre d'illustration culturelle.</p>
  <h2>Données personnelles</h2><p>Le site ne demande aucune inscription. Ta progression (album, Trendle) est enregistrée uniquement dans ton navigateur. Si des publicités sont affichées, un bandeau te demandera ton consentement avant tout dépôt de cookie publicitaire.</p>
</section>`;
  return page({ p, canonique: "/mentions-legales/", titre: "Mentions légales | Boomerz", description: "Mentions légales du site Boomerz.", corps, robots: "noindex, follow" });
}

function page404() {
  const p = "/";
  const corps = `<section class="wrap hero"><p class="surtitre">Erreur 404</p><h1>Cette page est cooked.</h1><p class="chapo">Elle n'existe pas, ou plus. Mais le mot du jour, lui, est bien là.</p><div class="liens-hero"><a href="/">Voir le mot du jour ›</a><a href="/mots/">Ouvrir le dictionnaire ›</a></div></section>`;
  return page({ p, canonique: "/404", titre: "Page introuvable | Boomerz", description: "Cette page n'existe pas.", corps, robots: "noindex" });
}

/* ---------- Génération ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });
write("index.html", accueil());
publies.forEach((j, i) => write(`mot/${j.slug}/index.html`, fiche(j, i)));
write("mots/index.html", dictionnaire());
write("expressions-de-jeunes/index.html", expressionsJeunes());
write("boomer-definition/index.html", boomerDefinition());
write("generations/index.html", generationsPage());
write("expressions-annees-80-90-2000/index.html", expressionsEpoques());
write("mentions-legales/index.html", mentions());
write("404.html", page404());
write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
const urls = [
  { u: "/", d: jour.date, f: "daily", pr: "1.0" },
  { u: "/mots/", d: jour.date, f: "daily", pr: "0.9" },
  { u: "/expressions-de-jeunes/", d: jour.date, f: "daily", pr: "0.9" },
  { u: "/boomer-definition/", d: "2026-11-25", f: "monthly", pr: "0.7" },
  { u: "/generations/", d: "2026-11-25", f: "monthly", pr: "0.7" },
  { u: "/expressions-annees-80-90-2000/", d: jour.date, f: "weekly", pr: "0.7" },
  ...publies.map((j) => ({ u: `/mot/${j.slug}/`, d: j.date, f: "monthly", pr: "0.8" })),
];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((x) => `  <url><loc>${SITE}${x.u}</loc><lastmod>${x.d}</lastmod><changefreq>${x.f}</changefreq><priority>${x.pr}</priority></url>`).join("\n")}\n</urlset>\n`);

const attente = tous.filter((j) => j.statut !== "publie" || j.date > today);
console.log(`Boomerz : ${publies.length} fiche(s) publiée(s), mot du jour « ${jour.mot} » (${jour.date}), date de référence ${today}, site ${SITE}.`);
if (attente.length) console.log(`En attente : ${attente.map((j) => `${j.date} ${j.mot} [${j.statut}]`).join(", ")}`);
