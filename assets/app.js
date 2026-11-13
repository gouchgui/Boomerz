/* Boomerz : interactions (Trendle, quiz, album) */
(function () {
  "use strict";
  var D = window.BOOMERZ || {};
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  function $(id) { return document.getElementById(id); }
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === "text") n.textContent = props[k];
      else if (k === "class") n.className = props[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), props[k]);
      else n.setAttribute(k, props[k]);
    });
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function copier(texte, toast) {
    var ok = function () { toast.textContent = "Copié ! Colle-le où tu veux."; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texte).then(ok, function () { toast.textContent = texte; });
    else toast.textContent = texte;
  }
  var norm = function (s) { return String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/gi, "").toUpperCase(); };
  var site = (D.site || "").replace(/^https?:\/\//, "");

  /* ---------- Album ---------- */
  var album = store.get("bz_album", []);
  function majAlbum() {
    document.querySelectorAll(".mini").forEach(function (m) { m.classList.toggle("possede", album.indexOf(m.dataset.slug) !== -1); });
    document.querySelectorAll("[data-collect]").forEach(function (b) {
      var a = album.indexOf(b.dataset.collect) !== -1;
      b.disabled = a; b.textContent = a ? "Dans ton album ✓" : "Ajouter à mon album";
    });
    var c = $("album-compte"); if (c) c.textContent = document.querySelectorAll(".mini.possede").length;
  }
  document.querySelectorAll("[data-collect]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (album.indexOf(b.dataset.collect) === -1) { album.push(b.dataset.collect); store.set("bz_album", album); }
      majAlbum();
    });
  });
  document.querySelectorAll(".mini").forEach(function (m) {
    m.addEventListener("click", function () {
      var base = document.querySelector('link[rel="stylesheet"]').getAttribute("href").replace("assets/style.css", "");
      window.location.href = base + "mot/" + m.dataset.slug + "/index.html";
    });
  });
  majAlbum();

  /* ---------- Trendle ---------- */
  var T = D.trendle, MAX = 5;
  if (T && $("tr-form")) {
    var cle = "bz_trendle_" + D.date;
    var st = store.get(cle, { essais: [], fini: false, gagne: false });
    var rendre = function () {
      var vus = st.fini ? MAX : Math.min(st.essais.length + 1, MAX);
      var ol = $("tr-indices"); ol.textContent = "";
      T.indices.forEach(function (txt, i) {
        var ouvert = i < vus;
        ol.appendChild(el("li", { class: ouvert ? "" : "verrou" }, [el("b", { text: String(i + 1) }), el("span", { text: ouvert ? txt : "Indice verrouillé" })]));
      });
      var cs = $("tr-cases"); cs.textContent = "";
      for (var i = 0; i < MAX; i++) {
        var e = st.essais[i];
        cs.appendChild(el("span", { class: e === undefined ? "" : (norm(e) === T.reponse ? "ok" : "rate"), text: e === undefined ? "" : (norm(e) === T.reponse ? "✓" : "✗") }));
      }
      var rates = st.essais.filter(function (e) { return norm(e) !== T.reponse; });
      $("tr-deja").textContent = rates.length ? "Déjà tenté : " + rates.join(", ") : "";
      if (st.fini) {
        $("tr-form").hidden = true; $("tr-res").hidden = false;
        $("tr-titre").textContent = st.gagne ? "Bravo ! C'était « " + T.libelle + " »." : "Raté ! C'était « " + T.libelle + " ».";
        $("tr-expl").textContent = T.explication;
      }
    };
    $("tr-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var inp = $("tr-input"), v = inp.value.trim();
      if (!v || st.fini) return;
      st.essais.push(v); inp.value = "";
      if (norm(v) === T.reponse) { st.fini = true; st.gagne = true; }
      else if (st.essais.length >= MAX) st.fini = true;
      store.set(cle, st); rendre();
    });
    $("tr-share").addEventListener("click", function () {
      var grille = st.essais.map(function (e) { return norm(e) === T.reponse ? "🟩" : "🟥"; }).join("") + new Array(MAX - st.essais.length + 1).join("⬜");
      var score = st.gagne ? st.essais.length + "/" + MAX : "X/" + MAX;
      copier("Boomerz · Trendle du " + D.date.split("-").reverse().join("/") + " · " + score + "\n" + grille + "\n" + site, $("tr-toast"));
    });
    rendre();
  }

  /* ---------- Quiz ---------- */
  var Q = D.quiz, box = $("quiz-box");
  if (box) {
    if (!Q || !Q.length) { box.appendChild(el("p", { class: "q-why", text: "Le quiz arrive dès qu'il y a assez de mots." })); }
    else {
      var RES = [
        { min: 0, t: "Daron fossile", d: "Tu dis encore « c'est d'la balle » et tu en es fier. Reviens chaque matin pour le mot du jour." },
        { min: 0.34, t: "Tonton en reconversion", d: "Tu captes l'ambiance, mais au repas de famille, tu fais encore rire, et pas pour les bonnes raisons." },
        { min: 0.67, t: "Grand frère crédible", d: "Tu suis le rythme. Évite quand même de les utiliser devant eux : c'est le meilleur moyen de les tuer." },
        { min: 1, t: "Collégien infiltré", d: "Sans faute. Soit tu as 13 ans, soit tu passes beaucoup trop de temps sur TikTok." }
      ];
      var qi = 0, sc = 0;
      var poser = function () {
        box.textContent = "";
        if (qi >= Q.length) {
          var r = RES.filter(function (x) { return sc / Q.length >= x.min; }).pop();
          var toast = el("p", { class: "toast", role: "status" });
          box.appendChild(el("div", { class: "q-res" }, [
            el("div", { class: "q-num", text: "Score : " + sc + " / " + Q.length }),
            el("div", { class: "q-titre", text: r.t }),
            el("p", { text: r.d }),
            el("div", { class: "btns" }, [
              el("button", { class: "btn", type: "button", text: "Copier mon résultat", onclick: function () { copier("Mon vocabulaire a l'âge de : " + r.t + " (" + sc + "/" + Q.length + ")\nEt toi ? " + site, toast); } }),
              el("button", { class: "btn clair", type: "button", text: "Recommencer", onclick: function () { qi = 0; sc = 0; poser(); } })
            ]),
            toast
          ]));
          return;
        }
        var x = Q[qi];
        var why = el("p", { class: "q-why", role: "status" });
        var opts = el("div", { class: "q-opts" });
        x.o.forEach(function (o, i) {
          opts.appendChild(el("button", { type: "button", text: o, onclick: function (ev) {
            opts.querySelectorAll("button").forEach(function (b, k) { b.disabled = true; if (k === x.a) b.classList.add("bon"); });
            if (i === x.a) sc++; else ev.currentTarget.classList.add("faux");
            why.textContent = (i === x.a ? "Exact. " : "Raté. ") + x.w;
            setTimeout(function () { qi++; poser(); }, 1800);
          } }));
        });
        var prog = el("div", { class: "q-prog" }, [el("i")]);
        prog.firstChild.style.width = (qi / Q.length * 100) + "%";
        box.appendChild(prog);
        box.appendChild(el("div", { class: "q-num", text: "Question " + (qi + 1) + " / " + Q.length }));
        box.appendChild(el("div", { class: "q-txt", text: x.q }));
        box.appendChild(opts);
        box.appendChild(why);
      };
      poser();
    }
  }
})();
