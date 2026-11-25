# Les deux tâches quotidiennes de Boomerz

Règle convenue : l'aperçu du lendemain part par e-mail à 7 h. Sans réponse, il est publié à 1 h du matin. Pour modifier ou bloquer une fiche, Guillaume écrit dans la conversation Boomerz ; la fiche est alors corrigée, ou passée en `"statut": "bloque"`.

---

## Tâche 1 · « Boomerz · aperçu de demain » (chaque jour vers 7 h, heure de Paris)

Tu prépares la fiche du mot de DEMAIN pour le site Boomerz (dico de la Gen Z pour les boomers).

1. Clone le dépôt GitHub du site. Lis `README.md` (format des fiches) et `content/config.json`.
2. Calcule la date de demain à l'heure de Paris (AAAA-MM-JJ). Si `content/jours/<demain>.json` existe déjà, ne crée rien : passe directement à l'étape 7 avec cette fiche.
3. Choisis le mot :
   - un mot, une expression ou une tendance de la Gen Z ou de la Gen Alpha réellement utilisé en France en ce moment. Cherche sur le web (presse, listes de tendances TikTok, Le Robert, Larousse, Euronews, Le Bonbon…) ;
   - jamais un mot déjà présent dans `content/jours/` (champ `slug` ou `mot`) ni dans `content/cimetiere.json` ;
   - rien de sexuel, d'insultant envers un groupe, ni lié à la drogue. En cas de doute, choisis un autre mot ;
   - vérifie le sens dans au moins deux sources sérieuses et note-les dans `sources`.
   - priorité aux mots que les gens cherchent vraiment sur Google en France : ceux qui apparaissent dans des articles « que veut dire… », « ça veut dire quoi… », « expressions de jeunes », « argot Gen Z / Gen Alpha », ou dans les mots de l'année des dictionnaires. Un mot très recherché vaut mieux qu'un mot amusant mais confidentiel.
4. Référencement (Google) : la fiche doit répondre directement à la recherche « ça veut dire quoi <mot> ».
   - `definition` : la première phrase donne le sens tout de suite, sans détour ;
   - `definition_courte` : moins de 60 caractères, commence par une majuscule, sans point final ;
   - `aussi_ecrit` : 2 à 4 graphies ou variantes que les gens tapent (sans accent, avec tiret, abréviation, expression complète, verbe dérivé). Exemple pour « Délulu » : `["delulu", "délulu", "delulu is the solulu"]` ;
   - `origine` : dates, lieux et noms précis (plateforme, artiste, dictionnaire qui l'a retenu), c'est ce qui rend la fiche crédible ;
   - `slug` : le mot en minuscules sans accent ni article, tirets entre les mots (`glow-up`, `red-flag`).
5. Rédige la fiche en suivant exactement le format du README :
   - ton drôle et bienveillant, phrases courtes, tutoiement ;
   - `generations` : 6 entrées, une époque ancienne ou littéraire (citation d'auteur ou d'œuvre seulement si tu en es sûr), puis 1960 ou 1970, 1980, 1990, 2000 et 2020. Le champ `incarne` cite une figure, un film, un objet ou un phénomène de l'époque, sans photo ;
   - `trendle` : un AUTRE mot Gen Z, différent du mot du jour et de tous les `trendle.reponse` des 60 derniers jours, avec 5 indices du plus dur au plus facile ;
   - `"statut": "brouillon"`.
6. Lance `node build.js` pour valider la fiche, corrige toute erreur, puis commit et push sur `main` avec le message « Brouillon du JJ/MM : <mot> ».
7. Ta réponse finale est l'e-mail d'aperçu. Elle doit contenir, en français, sans jargon technique :
   - en titre : « Boomerz · demain <date> : <mot> » ;
   - le lien où la fiche sera visible après publication : https://boomerz.org/mot/<slug>/ ;
   - la définition, l'origine, l'exemple, la traduction boomer, la gêne si un parent l'utilise ;
   - les 6 générations (époque, expression, incarné par) et la généalogie ;
   - le mème d'origine ;
   - le Trendle : la réponse et les 5 indices ;
   - les sources ;
   - pour finir : « Sans réponse de ta part, cette fiche sera en ligne cette nuit à 1 h. Pour la modifier ou la bloquer, écris dans la conversation Boomerz. »

---

## Tâche 2 · « Boomerz · mise en ligne » (chaque nuit vers 1 h, heure de Paris)

Tu publies le mot du jour du site Boomerz.

1. Clone le dépôt GitHub du site.
2. Calcule la date du jour à l'heure de Paris (AAAA-MM-JJ) et ouvre `content/jours/<aujourd'hui>.json`.
3. Si le fichier n'existe pas, ou si son statut vaut `bloque` : ne publie rien. Le site garde le mot précédent. Termine en expliquant en une phrase pourquoi rien n'a été publié.
4. Si son statut vaut `brouillon`, passe-le à `publie`. S'il vaut déjà `publie`, ne change rien au contenu.
5. Lance `node build.js`. En cas d'erreur, ne pousse rien et termine en décrivant l'erreur.
6. Commit et push sur `main` avec le message « Publication du JJ/MM : <mot> », même si le contenu n'a pas changé (`git commit --allow-empty`). Ce push relance le build Cloudflare, qui affiche le nouveau jour.
7. Termine par une phrase : le mot publié, ou la raison pour laquelle rien n'a été publié.
