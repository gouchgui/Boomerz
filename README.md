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

## Mise en ligne sur Cloudflare Pages (gratuit)

1. Crée un dépôt GitHub (privé ou public) et pousse ce dossier dedans.
2. Sur Cloudflare : Workers & Pages › Créer › Pages › Connecter à Git, puis choisis le dépôt.
3. Réglages de build :
   - Commande de build : `node build.js`
   - Dossier de sortie : `dist`
4. Chaque `git push` sur `main` reconstruit et publie le site en une minute environ.
5. Nom de domaine : dans le projet Pages, onglet « Domaines personnalisés ».

Le mot affiché est la dernière fiche dont `statut` vaut `publie` et dont la date est passée ou égale à aujourd'hui (heure de Paris). Une fiche datée de demain ou en `brouillon` n'apparaît pas.

## Format d'une fiche

```json
{
  "date": "2026-11-15",               // = nom du fichier
  "statut": "brouillon",              // brouillon | publie | bloque
  "slug": "aura-farming",             // minuscules, chiffres, tirets ; unique
  "mot": "Aura farming",
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
  "sources": ["https://..."]
}
```

`embed_url` accepte une adresse d'intégration officielle (par exemple `https://www.youtube.com/embed/ID` ou `https://www.tiktok.com/embed/v2/ID`). Sans elle, la carte affiche la description du mème.

## Publicité

Dans `content/config.json`, colle le code fourni par AdSense ou par la plateforme d'affiliation dans `pub.bandeau_1_html` et `pub.bandeau_2_html`. Passe `afficher_emplacements_vides` à `false` avant le lancement pour masquer les cadres vides. Avec AdSense, active aussi le message de consentement (Confidentialité et messages › RGPD) avant d'afficher les annonces.
