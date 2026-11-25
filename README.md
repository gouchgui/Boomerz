# Boomerz

Le dico de la Gen Z pour les boomers. Un mot par jour, sa généalogie sur cinq générations, un Trendle et un quiz.

Site statique, sans base de données ni dépendance : `node build.js` lit `content/` et produit le site complet dans `dist/`.

## Arborescence

```
content/
  config.json          nom, URL, éditeur, codes publicitaires
  cimetiere.json       les tendances mortes
  jours/AAAA-MM-JJ.json une fiche par jour (voir le format plus bas)
assets/                style.css et app.js (copiés tels quels)
build.js               le générateur
AUTOMATISATION.md      les consignes des deux tâches quotidiennes
```

## Pages générées

- `/` : mot du jour, Trendle, quiz, album, cimetière
- `/mot/<slug>/` : une fiche par mot (« Ça veut dire quoi X ? »), avec questions-réponses et données structurées
- `/mots/` : dictionnaire de l'argot des jeunes, de A à Z
- `/expressions-de-jeunes/` : toutes les expressions de l'année, de la plus récente à la plus ancienne
- `/boomer-definition/`, `/generations/` : pages de fond sur les boomers et les générations
- `/expressions-annees-80-90-2000/` : les expressions d'époque tirées des fiches
- `sitemap.xml`, `robots.txt`, `404.html`

## Mise en ligne sur Cloudflare (gratuit)

Le site est déployé comme Worker (voir `wrangler.jsonc` et `worker.js`). `worker.js` redirige `www.boomerz.org` vers `boomerz.org`, et l'ancienne adresse `.workers.dev` quand `REDIRIGER_VERS_DOMAINE` vaut `"oui"` dans `wrangler.jsonc`.

1. Workers & Pages › le projet `boomerz` › Settings › Build › Build configuration :
   - Build command : `node build.js`
   - Deploy command : `npx wrangler deploy`
2. Chaque `git push` sur `main` reconstruit et publie le site en une minute environ.
3. Nom de domaine : Settings › Domains & Routes › Add › Custom domain.

Le nom `name` de `wrangler.jsonc` doit être identique au nom du projet dans Cloudflare.

Le mot affiché est la dernière fiche dont `statut` vaut `publie` et dont la date est passée ou égale à aujourd'hui (heure de Paris). Une fiche datée de demain ou en `brouillon` n'apparaît pas.

## Format d'une fiche

```json
{
  "date": "2026-11-15",               // = nom du fichier
  "statut": "brouillon",              // brouillon | publie | bloque
  "slug": "aura-farming",             // minuscules, chiffres, tirets ; unique
  "mot": "Aura farming",
  "aussi_ecrit": ["aura farm", "+1000 aura"], // facultatif : autres graphies que les gens tapent
  "prononciation": "o-ra far-mingue",
  "nature": "nom / verbe",
  "definition": "Phrase complète.",
  "definition_courte": "Moins de 60 caractères, sert au quiz",
  "origine": "D'où vient le mot, quand et comment il a percé.",
  "exemple": "Phrase d'exemple sans guillemets.",
  "traduction_boomer": "L'équivalent vieille école.",
  "gene_parent": 4,                   // 1 à 5
  "etat": "en-forme",                 // en-forme | en-declin | mort
  "rarete": "epique",                 // commune | rare | epique | legendaire
  "apparu": "2025",
  "meme": { "description": "...", "plateforme": "TikTok", "annee": "2025", "embed_url": null },
  "generations": [                    // 6 entrées : une ancienne, puis 1960 ou 1970, 1980, 1990, 2000, 2020
    { "epoque": "XIXe siècle", "dit": "Un dandy", "incarne": "Brummell, et Baudelaire" }
  ],
  "genealogie": ["Dandy", "James Dean", "Top Gun", "Swag", "Aura"],
  "trendle": {
    "reponse": "SEUM",                // majuscules, sans accent ni espace
    "libelle": "Seum",
    "indices": ["5 indices, du plus difficile au plus facile"],
    "explication": "Affichée une fois la partie finie."
  },
  "pour_aller_plus_loin": [           // 2 à 4 références vérifiées, affichées sur la fiche
    { "type": "article", "titre": "Titre exact", "source": "Slate", "url": "https://...", "langue": "fr", "pourquoi": "Ce que ça apporte." },
    { "type": "livre", "titre": "Titre exact", "auteur": "Eva Illouz", "editeur": "Seuil", "annee": "2020", "pourquoi": "Ce que ça apporte." }
  ],
  "sources": ["https://..."]
}
```

`embed_url` accepte une adresse d'intégration officielle (par exemple `https://www.youtube.com/embed/ID` ou `https://www.tiktok.com/embed/v2/ID`). Sans elle, la carte affiche la description du mème.

## Publicité

Dans `content/config.json`, colle le code fourni par AdSense ou par la plateforme d'affiliation dans `pub.bandeau_1_html` et `pub.bandeau_2_html`. Passe `afficher_emplacements_vides` à `false` avant le lancement pour masquer les cadres vides. Avec AdSense, active aussi le message de consentement (Confidentialité et messages › RGPD) avant d'afficher les annonces.
