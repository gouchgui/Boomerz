// Boomerz : sert le site statique et redirige les autres adresses vers https://boomerz.org.
// La redirection de l'adresse .workers.dev ne s'active que si REDIRIGER_VERS_DOMAINE vaut "oui"
// (dans wrangler.jsonc), une fois boomerz.org branché sur le projet Cloudflare.
const DOMAINE = "boomerz.org";
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const vieuxNom = url.hostname.endsWith(".workers.dev");
    const www = url.hostname === "www." + DOMAINE;
    if (www || (vieuxNom && env.REDIRIGER_VERS_DOMAINE === "oui")) {
      url.hostname = DOMAINE;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(request);
  },
};
