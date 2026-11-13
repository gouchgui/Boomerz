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

/* ---------- Date du jour (Paris) ---------- */
const today = process.env.BOOMERZ_DATE ||
  new Intl.DateTimeFormat("en-CA", { timeZone: config.fuseau, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

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
const lienMot = (p, s) => `${p}mot/${s}/index.html`;
function write(rel, html) { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }
function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function melange(arr, seed) { const a = arr.slice(); let s = seed; for (let i = a.length - 1; i > 0; i--) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; const k = s % (i + 1); [a[i], a[k]] = [a[k], a[i]]; } return a; }

const ICONE_PLAY = `<svg width="20" height="22" viewBox="0 0 20 22" aria-hidden="true"><path d="M3 2l15 9-15 9z" fill="currentColor"/></svg>`;

/* ---------- Gabarit commun ---------- */
function page({ p, titre, description, canonique, corps, data, robots }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titre)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(config.url_site + canonique)}">
${robots ? `<meta name="robots" content="${robots}">` : ""}
<meta property="og:title" content="${esc(titre)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${esc(config.url_site + canonique)}">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%231D1D1F'/%3E%3Ctext x='32' y='45' font-family='Arial' font-weight='900' font-size='38' text-anchor='middle' fill='%23fff'%3EB%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="${p}assets/style.css">
</head>
<body>
<a class="skip" href="#contenu">Aller au contenu</a>
<header class="nav">
  <nav class="wrap nav-in" aria-label="Navigation principale">
    <a class="logo" href="${p}index.html">Boomerz</a>
    <div class="nav-links">
      <a href="${p}index.html#mot">Mot du jour</a>
      <a href="${p}index.html#jeux">Trendle</a>
      <a href="${p}index.html#jeux">Quiz</a>
      <a href="${p}index.html#album">Album</a>
      <a href="${p}mots/index.html">Dictionnaire</a>
    </div>
    <a class="pill" href="${p}index.html#mot">Le mot du jour</a>
  </nav>
</header>
<div class="bandeau">Boomer, Gen X, millennial ou enfant des années 2000 ? Chaque jour, un mot de la Gen Z décodé pour toi. <a href="${p}index.html#jeux">Tester mon niveau ›</a></div>
<main id="contenu">
${corps}
</main>
<footer class="wrap pied">
  <p class="pied-seo">Boomerz est le dictionnaire de la Gen Z pour les boomers, la Gen X, les millennials et tous ceux qui ont grandi dans les années 80, 90 ou 2000. Chaque jour, un mot d'argot jeune, une expression ou une tendance TikTok expliqués simplement, avec son équivalent d'époque.</p>
  <div class="pied-bas"><span>© ${today.slice(0, 4)} Boomerz</span><span><a href="${p}mots/index.html">Tous les mots</a> · <a href="${p}mentions-legales/index.html">Mentions légales</a>${config.email_contact ? ` · <a href="mailto:${esc(config.email_contact)}?subject=Proposer%20un%20mot">Proposer un mot</a>` : ""}</span></div>
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
  const incarne = j.generations.slice().reverse().slice(0, 3).map((g) => g.incarne.split(",")[0]).join(", ");
  const gen = j.genealogie.map((g, i) => `<span class="${i === j.genealogie.length - 1 ? "fin" : ""}">${esc(g)}</span>`).join(`<b aria-hidden="true">›</b>`);
  return `<article class="carte${grande ? " grande" : ""}" style="--r:${couleur}" data-slug="${esc(j.slug)}">
  <div class="carte-tete"><span class="rarete">${RARETES[j.rarete]}</span><span class="num">${esc(dateCourte(j.date))}</span></div>
  ${meme}
  <h3 class="carte-mot"><a href="${lienMot(p, j.slug)}">${esc(j.mot)}</a></h3>
  <p class="carte-incarne">Incarné par : ${esc(incarne)}</p>
  <div class="carte-genea"><div class="mini-titre">Généalogie</div><div class="chaine">${gen}</div></div>
  <div class="carte-pied"><span>Apparu : ${esc(j.apparu)}</span><span>${ETATS[j.etat]}</span></div>
</article>`;
}

function generations(j) {
  const items = j.generations.map((g, i) => {
    const derniere = i === j.generations.length - 1;
    const premiere = i === 0 && !/^\d/.test(g.epoque);
    return `<div class="ere${derniere ? " ere-z" : ""}${premiere ? " ere-ancienne" : ""}">
      <div class="ere-annee${premiere ? " petit" : ""}">${esc(g.epoque)}</div>
      <div><div class="ere-dit">${esc(g.dit)}</div><div class="ere-label">Incarné par</div><div class="ere-qui">${esc(g.incarne)}</div></div>
    </div>`;
  }).join("");
  return `<section class="wrap section" aria-labelledby="gen-titre">
  <h2 id="gen-titre" class="titre-section">Une même idée.<br>Cinq générations. Et même avant.</h2>
  <p class="sous-titre">Comment on disait « ${esc(j.mot.toLowerCase())} » à ton époque, et qui l'incarnait.</p>
  <div class="eres">${items}</div>
</section>`;
}

function details(j, p, { lien = true } = {}) {
  const jauge = [1, 2, 3, 4, 5].map((n) => `<i class="${n <= j.gene_parent ? "on" : ""}"></i>`).join("");
  return `<div class="details">
  <p class="mini-titre">${esc(j.nature)}${j.prononciation ? ` · [ ${esc(j.prononciation)} ]` : ""}</p>
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

/* ---------- Quiz : questions tirées des derniers mots ---------- */
function construireQuiz() {
  const base = publies.slice(-6);
  if (publies.length < 4) return null;
  return base.map((j) => {
    const autres = melange(publies.filter((x) => x.slug !== j.slug), hash(j.slug + today)).slice(0, 3).map((x) => x.definition_courte);
    const options = melange([j.definition_courte, ...autres], hash(today + j.slug));
    return { q: `« ${j.mot} », ça veut dire…`, o: options, a: options.indexOf(j.definition_courte), w: j.definition };
  });
}

/* ---------- Page d'accueil ---------- */
function accueil() {
  const p = "";
  const album = publies.slice().reverse().map((j) => `<button class="mini" type="button" data-slug="${esc(j.slug)}" style="--r:${COULEURS[j.rarete]}" aria-label="${esc(j.mot)} : ${esc(j.definition_courte)}">
      <span class="mini-meme">${ICONE_PLAY}</span><span class="mini-mot">${esc(j.mot)}</span><span class="mini-def">${esc(j.definition_courte)}</span>
    </button>`).join("");
  const tombes = cimetiere.map((t) => `<li><span class="tombe-mot">${esc(t.mot)}</span><span class="tombe-date">${esc(t.periode)}</span><span class="tombe-epi">${esc(t.epitaphe)}</span></li>`).join("");
  const corps = `
<section id="mot" class="wrap hero">
  <p class="surtitre">Le mot du jour · ${esc(dateCourte(jour.date))}</p>
  <h1>${esc(jour.mot)}.</h1>
  <p class="chapo">${esc(jour.definition_courte)}. Ta génération le faisait déjà, la Gen Z lui a donné un nom.</p>
  <div class="liens-hero"><a href="${lienMot(p, jour.slug)}">Lire la fiche ›</a><a href="#jeux">Jouer au Trendle ›</a></div>
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
      <p class="tuile-txt">Cinq indices. Cinq essais. Un mot à deviner.</p>
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
      <p class="tuile-txt gris-clair">${Math.min(publies.length, 6)} questions sur les derniers mots. Verdict : daron fossile ou collégien infiltré.</p>
      <div id="quiz-box" class="quiz-box"></div>
    </div>
  </div>
</section>
${pub(2)}
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
</section>`;
  return page({
    p, canonique: "/",
    titre: `Boomerz : le dico de la Gen Z pour les boomers · ${jour.mot}`,
    description: config.description,
    corps,
    data: { date: jour.date, site: config.url_site, trendle: jour.trendle, quiz: construireQuiz() },
  });
}

/* ---------- Page d'une fiche ---------- */
function fiche(j, i) {
  const p = "../../";
  const prec = publies[i - 1], suiv = publies[i + 1];
  const corps = `
<section class="wrap hero hero-fiche">
  <p class="surtitre"><a href="${p}mots/index.html">Dictionnaire</a> · Mot du ${esc(dateFr(j.date))}</p>
  <h1>${esc(j.mot)}</h1>
  <p class="chapo">Définition, origine et équivalents d'époque : « ${esc(j.mot)} » expliqué aux boomers et aux parents.</p>
</section>
<section class="wrap" aria-label="Fiche">
  <div class="panneau carte-zone">${carte(j, p, { grande: true })}${details(j, p, { lien: false })}</div>
</section>
${pub(1)}
${generations(j)}
<nav class="wrap prec-suiv" aria-label="Autres mots">
  ${prec ? `<a href="${lienMot(p, prec.slug)}">‹ ${esc(prec.mot)}</a>` : "<span></span>"}
  <a href="${p}mots/index.html">Tous les mots</a>
  ${suiv ? `<a href="${lienMot(p, suiv.slug)}">${esc(suiv.mot)} ›</a>` : "<span></span>"}
</nav>
${pub(2)}`;
  const ld = { "@context": "https://schema.org", "@type": "DefinedTerm", name: j.mot, description: j.definition,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: "Boomerz, le dico de la Gen Z" }, url: `${config.url_site}/mot/${j.slug}/` };
  return page({
    p, canonique: `/mot/${j.slug}/`,
    titre: `${j.mot} : définition et origine, expliqué aux boomers | Boomerz`,
    description: `Que veut dire « ${j.mot} » ? ${j.definition} Origine, exemple et équivalent des années 80, 90 et 2000.`,
    corps: corps + `<script type="application/ld+json">${json(ld)}</script>`,
  });
}

/* ---------- Dictionnaire ---------- */
function dictionnaire() {
  const p = "../";
  const tri = publies.slice().sort((a, b) => a.mot.localeCompare(b.mot, "fr", { sensitivity: "base" }));
  const lignes = tri.map((j) => `<li><a href="${lienMot(p, j.slug)}"><span class="dico-mot">${esc(j.mot)}</span><span class="dico-def">${esc(j.definition_courte)}</span><span class="dico-boomer">Version boomer : « ${esc(j.traduction_boomer)} »</span></a></li>`).join("");
  const corps = `<section class="wrap hero hero-fiche"><p class="surtitre">Dictionnaire</p><h1>Tous les mots de la Gen Z.</h1><p class="chapo">${publies.length} mots d'argot jeune expliqués aux boomers, de A à Z.</p></section>
<section class="wrap"><ul class="dico">${lignes}</ul></section>${pub(2)}`;
  return page({ p, canonique: "/mots/", titre: "Dictionnaire de l'argot Gen Z pour les boomers | Boomerz",
    description: "Tous les mots d'argot de la Gen Z expliqués aux boomers et aux parents, de A à Z, avec leur équivalent d'époque.", corps });
}

/* ---------- Mentions légales ---------- */
function mentions() {
  const p = "../";
  const corps = `<section class="wrap hero hero-fiche"><h1>Mentions légales</h1></section>
<section class="wrap texte">
  <h2>Éditeur du site</h2><p>${esc(config.editeur.nom)}<br>Contact : ${esc(config.editeur.contact)}</p>
  <h2>Hébergement</h2><p>Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis.</p>
  <h2>Contenus</h2><p>Les fiches sont rédigées avec l'aide d'une intelligence artificielle, puis relues avant publication. Les vidéos citées appartiennent à leurs auteurs et sont intégrées via les outils officiels des plateformes. Les personnalités mentionnées le sont à titre d'illustration culturelle.</p>
  <h2>Données personnelles</h2><p>Le site ne demande aucune inscription. Ta progression (album, Trendle) est enregistrée uniquement dans ton navigateur. Si des publicités sont affichées, un bandeau te demandera ton consentement avant tout dépôt de cookie publicitaire.</p>
</section>`;
  return page({ p, canonique: "/mentions-legales/", titre: "Mentions légales | Boomerz", description: "Mentions légales du site Boomerz.", corps, robots: "noindex" });
}

/* ---------- Génération ---------- */
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
fs.cpSync(path.join(ROOT, "assets"), path.join(OUT, "assets"), { recursive: true });
write("index.html", accueil());
publies.forEach((j, i) => write(`mot/${j.slug}/index.html`, fiche(j, i)));
write("mots/index.html", dictionnaire());
write("mentions-legales/index.html", mentions());
write("robots.txt", `User-agent: *\nAllow: /\nSitemap: ${config.url_site}/sitemap.xml\n`);
const urls = ["/", "/mots/", ...publies.map((j) => `/mot/${j.slug}/`)];
write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${config.url_site}${u}</loc></url>`).join("\n")}\n</urlset>\n`);

const brouillons = tous.filter((j) => j.statut !== "publie" || j.date > today);
console.log(`Boomerz : ${publies.length} fiche(s) publiée(s), mot du jour « ${jour.mot} » (${jour.date}), date de référence ${today}.`);
if (brouillons.length) console.log(`En attente : ${brouillons.map((j) => `${j.date} ${j.mot} [${j.statut}]`).join(", ")}`);
