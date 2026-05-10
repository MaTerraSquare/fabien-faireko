/* ─────────────────────────────────────────────────────────────────────
   Fabien Widget — embed pour faireko.be (toutes pages via custom_code_head)
   ─────────────────────────────────────────────────────────────────────
   Pattern D-2026-05-03-01 : JS dans ir.attachment public, chargé par
   <script src="/web/content/<id>" async></script> dans custom_code_head.

   Hook global exposé : window.fkOpenFabien(brief?)
   - sans brief : ouvre la conv vide
   - avec brief : pré-remplit la 1ère question

   Lecture des params URL :
   - ?s=mur-humide / ?s=thermwood / etc. → ouvre auto avec brief mappé
   - data-fk-fabien="<scenario>" sur n'importe quel élément cliquable
     déclenche l'ouverture pré-remplie

   Évite les double-instanciations (idempotent).
─────────────────────────────────────────────────────────────────────── */
(function () {
  if (window.__fkFabienLoaded) return;
  window.__fkFabienLoaded = true;

  // ─── CONFIGURATION ────────────────────────────────────────────────
  var CDN = "https://fabien-faireko.netlify.app";
  var ENDPOINT = CDN + "/api/v3/chat";
  var CART_ENDPOINT = CDN + "/api/v3/cart-create";
  var SHOP_BASE = "https://www.faireko.be";

  var POSES = {
    idle:      CDN + "/frontend/fabien/fabien_01_bras-croises.webp",
    welcome:   CDN + "/frontend/fabien/fabien_02_main-tendue.webp",
    questions: CDN + "/frontend/fabien/fabien_03_index-leve.webp",
    products:  CDN + "/frontend/fabien/fabien_04_materiaux-main.webp",
    expert:    CDN + "/frontend/fabien/fabien_05_mains-ouvertes.webp",
    loading:   CDN + "/frontend/fabien/fabien_06_tablette.webp"
  };
  var HEAD_IMG = CDN + "/frontend/fabien/fabien_head.webp";

  // Mapping des scénarios pré-remplis (depuis ?s= ou data-fk-fabien=)
  var SCENARIOS = {
    "thermwood":            "Je veux faire une ITE Thermwood (chaux + fibre de bois) sur ma façade. Comment composer le système ?",
    "iti-chanvre":          "Je veux faire une ITI chanvre PI-Hemp Wall sur du bâti ancien (brique). Quel système me proposes-tu ?",
    "mur-humide":           "J'ai un mur humide à assainir et enduire à la chaux. Comment procéder ?",
    "sarking":              "Je veux faire un sarking (isolation toiture par-dessus les chevrons). Quel système biosourcé proposez-vous ?",
    "cloison":              "Je veux faire une cloison SORIWA (cellulose recyclée) en remplacement d'une ossature acier. Comment ça se met en œuvre ?",
    "dalle":                "Je veux faire un sol Lithotherm chauffant (plancher chauffant sec lava-basalt). Quel système ?",
    "enduit-int":           "Je veux faire un enduit intérieur chaux + argile (Restaura NHL + finition naturelle). Comment composer ?",
    "correction-thermique": "Je veux faire une correction thermique avec Thermcal (mortier isolant NHL5 + verre recyclé). Comment l'appliquer ?"
  };

  // ─── STYLES (injectés une fois) ───────────────────────────────────
  var styleEl = document.createElement("style");
  styleEl.id = "fk-fabien-styles";
  styleEl.textContent = [
    ":root { --fk-green: #2c5f4a; --fk-green-dark: #1e4434; --fk-bg: #f7f5f0; }",
    "#fk-fabien-bubble { position: fixed; bottom: 24px; right: 24px; z-index: 99999; width: 64px; height: 64px; border-radius: 50%; background: var(--fk-green); border: 3px solid white; cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.25); padding: 0; overflow: hidden; transition: transform 0.2s, box-shadow 0.2s; }",
    "#fk-fabien-bubble:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.3); }",
    "#fk-fabien-bubble img { width: 100%; height: 100%; object-fit: cover; object-position: center 30%; display: block; }",
    "#fk-fabien-bubble::before { content: ''; position: absolute; inset: -3px; border-radius: 50%; border: 2px solid var(--fk-green); animation: fk-pulse 2.5s ease-out infinite; pointer-events: none; }",
    "@keyframes fk-pulse { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.4); opacity: 0; } }",
    "#fk-fabien-panel { position: fixed; bottom: 100px; right: 24px; z-index: 99998; width: 380px; max-width: calc(100vw - 32px); height: 600px; max-height: calc(100vh - 140px); background: white; border-radius: 16px; box-shadow: 0 12px 40px rgba(0,0,0,0.25); display: none; flex-direction: column; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }",
    "#fk-fabien-panel.fk-open { display: flex; animation: fk-slide-in 0.3s ease-out; }",
    "@keyframes fk-slide-in { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }",
    "#fk-fabien-mascot-wrap { position: fixed; bottom: 100px; right: 408px; z-index: 99997; width: 200px; height: 340px; pointer-events: none; display: none; }",
    "#fk-fabien-panel.fk-open ~ #fk-fabien-mascot-wrap { display: block; animation: fk-slide-mascot 0.4s ease-out 0.1s both; }",
    "@keyframes fk-slide-mascot { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }",
    "#fk-fabien-mascot { width: 100%; height: 100%; object-fit: contain; object-position: bottom center; transition: opacity 0.25s ease-in-out; }",
    "#fk-fabien-mascot.fk-fade { opacity: 0; }",
    "@media (max-width: 700px) { #fk-fabien-mascot-wrap { display: none !important; } }",
    "#fk-fabien-header { padding: 14px 16px; background: var(--fk-green); color: white; display: flex; justify-content: space-between; align-items: center; }",
    "#fk-fabien-header strong { font-size: 15px; }",
    "#fk-fabien-header .fk-sub { font-size: 11px; opacity: 0.85; display: block; margin-top: 2px; }",
    "#fk-fabien-close { background: none; border: none; color: white; font-size: 22px; cursor: pointer; line-height: 1; }",
    "#fk-fabien-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: var(--fk-bg); }",
    ".fk-msg { padding: 10px 14px; border-radius: 14px; max-width: 85%; line-height: 1.45; font-size: 14px; }",
    ".fk-msg-user { align-self: flex-end; background: var(--fk-green); color: white; border-bottom-right-radius: 4px; }",
    ".fk-msg-bot { align-self: flex-start; background: white; color: #222; border-bottom-left-radius: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.08); }",
    ".fk-card { background: white; border: 1px solid #e0dcd0; border-radius: 10px; padding: 12px; margin-top: 6px; font-size: 13px; }",
    ".fk-card h4 { margin: 0 0 6px; font-size: 14px; color: var(--fk-green); }",
    ".fk-card .fk-explain { margin: 0 0 10px; color: #444; font-size: 13px; }",
    ".fk-product { display: flex; flex-direction: column; padding: 8px; border: 1px solid #eae6dc; border-radius: 6px; margin-top: 6px; background: #fafaf6; }",
    ".fk-product-name { font-weight: 600; font-size: 13px; color: #1a1a1a; }",
    ".fk-product-why { font-size: 12px; color: #555; margin-top: 2px; }",
    ".fk-product-actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }",
    ".fk-btn { padding: 6px 10px; border-radius: 5px; font-size: 12px; border: 1px solid var(--fk-green); background: white; color: var(--fk-green); cursor: pointer; text-decoration: none; }",
    ".fk-btn-primary { background: var(--fk-green); color: white; }",
    ".fk-vigilance { margin-top: 8px; padding: 8px; background: #fff7e6; border-left: 3px solid #d97706; border-radius: 4px; font-size: 12px; }",
    ".fk-vigilance strong { color: #92400e; }",
    ".fk-confidence { display: inline-block; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; margin-bottom: 10px; }",
    ".fk-conf-high { background: #d1fae5; color: #065f46; }",
    ".fk-conf-medium { background: #fef3c7; color: #92400e; }",
    ".fk-conf-expert { background: #fee2e2; color: #991b1b; }",
    ".fk-question-list { margin: 6px 0 0; padding-left: 18px; }",
    ".fk-question-list li { margin: 3px 0; font-size: 13px; }",
    "#fk-fabien-input-row { padding: 12px; border-top: 1px solid #eee; background: white; display: flex; gap: 8px; }",
    "#fk-fabien-input { flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; resize: none; min-height: 40px; max-height: 100px; font-family: inherit; }",
    "#fk-fabien-send { padding: 0 16px; background: var(--fk-green); color: white; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; }",
    "#fk-fabien-send:disabled { opacity: 0.5; cursor: not-allowed; }",
    ".fk-typing { font-style: italic; color: #888; font-size: 13px; }"
  ].join("\n");
  document.head.appendChild(styleEl);

  // ─── DOM (bulle, panel, mascotte) ─────────────────────────────────
  function buildDOM() {
    var bubble = document.createElement("button");
    bubble.id = "fk-fabien-bubble";
    bubble.setAttribute("aria-label", "Ouvrir l'assistant Fabien");
    var bubbleImg = document.createElement("img");
    bubbleImg.src = HEAD_IMG;
    bubbleImg.alt = "Fabien";
    bubble.appendChild(bubbleImg);

    var panel = document.createElement("div");
    panel.id = "fk-fabien-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Assistant Fabien");
    panel.innerHTML = [
      '<div id="fk-fabien-header">',
      '  <div>',
      '    <strong>Fabien — Assistant FAIRĒKO</strong>',
      '    <span class="fk-sub">Matériaux biosourcés &amp; bas carbone</span>',
      '  </div>',
      '  <button id="fk-fabien-close" aria-label="Fermer">×</button>',
      '</div>',
      '<div id="fk-fabien-messages"></div>',
      '<div id="fk-fabien-input-row">',
      '  <textarea id="fk-fabien-input" placeholder="Décrivez votre projet…" rows="1"></textarea>',
      '  <button id="fk-fabien-send">→</button>',
      '</div>'
    ].join("");

    var mascotWrap = document.createElement("div");
    mascotWrap.id = "fk-fabien-mascot-wrap";
    mascotWrap.setAttribute("aria-hidden", "true");
    var mascotImg = document.createElement("img");
    mascotImg.id = "fk-fabien-mascot";
    mascotImg.src = POSES.welcome;
    mascotImg.alt = "";
    mascotWrap.appendChild(mascotImg);

    document.body.appendChild(bubble);
    document.body.appendChild(panel);
    document.body.appendChild(mascotWrap);
  }

  function init() {
    buildDOM();

    // Préchargement
    Object.keys(POSES).forEach(function (k) {
      var i = new Image();
      i.src = POSES[k];
    });

    var $bubble = document.getElementById("fk-fabien-bubble");
    var $panel = document.getElementById("fk-fabien-panel");
    var $close = document.getElementById("fk-fabien-close");
    var $msgs = document.getElementById("fk-fabien-messages");
    var $input = document.getElementById("fk-fabien-input");
    var $send = document.getElementById("fk-fabien-send");
    var $mascot = document.getElementById("fk-fabien-mascot");

    var history = [];
    var _currentPose = "welcome";
    var _greeted = false;

    function setPose(name) {
      if (!POSES[name] || _currentPose === name) return;
      _currentPose = name;
      $mascot.classList.add("fk-fade");
      setTimeout(function () {
        $mascot.src = POSES[name];
        $mascot.classList.remove("fk-fade");
      }, 250);
    }

    function ensureGreeting() {
      if (_greeted) return;
      _greeted = true;
      addBotText("Bonjour ! Je suis Fabien, l'assistant FAIRĒKO. Décrivez-moi votre projet (que voulez-vous faire ? mur, sol, toiture ? intérieur ou extérieur ? bâti ancien ?) et je vous oriente vers les bons matériaux.");
    }

    function openPanel() {
      $panel.classList.add("fk-open");
      setPose("welcome");
      ensureGreeting();
    }
    function closePanel() {
      $panel.classList.remove("fk-open");
    }

    $bubble.addEventListener("click", function () {
      if ($panel.classList.contains("fk-open")) closePanel();
      else openPanel();
    });
    $close.addEventListener("click", closePanel);

    $input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
    });
    $send.addEventListener("click", function () { sendMessage(); });

    async function sendMessage(textOverride) {
      var text = (textOverride || $input.value || "").trim();
      if (!text) return;
      $input.value = "";
      addUserMsg(text);
      history.push({ role: "user", content: text });
      setLoading(true);

      try {
        var r = await fetch(ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history })
        });
        var data = await r.json();
        if (!data.ok) {
          history.pop();
          setPose("idle");
          var is429 = (data.error && data.error.status === 429) || /rate.?limit|429/i.test((data.error && data.error.message) || "");
          if (is429) addBotText("⏳ Trop de questions à la suite — patientez 30 secondes et réessayez. (Limite Anthropic temporaire)");
          else addBotText("⚠️ Une erreur est survenue. Réessayez ou contactez hello@nbsdistribution.eu.");
          console.error("[fabien-v3]", data);
          return;
        }

        if (data.card) {
          renderCard(data.card);
          history.push({ role: "assistant", content: data.raw });
          if (data.card.kind === "questions") setPose("questions");
          else if (data.card.confidence === "expert_required") setPose("expert");
          else if (data.card.solutions && data.card.solutions.length) setPose("products");
          else if (data.card.vigilances && data.card.vigilances.length) setPose("expert");
          else setPose("idle");
        } else {
          addBotText(data.raw || "(pas de réponse)");
          history.push({ role: "assistant", content: data.raw || "" });
          setPose("idle");
        }
      } catch (e) {
        history.pop();
        setPose("idle");
        addBotText("⚠️ Erreur réseau. Réessayez.");
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    function setLoading(on) {
      $send.disabled = on;
      if (on) {
        setPose("loading");
        var div = document.createElement("div");
        div.className = "fk-msg fk-msg-bot fk-typing";
        div.id = "fk-typing";
        div.textContent = "Fabien réfléchit…";
        $msgs.appendChild(div);
        scrollMsgs();
      } else {
        var t = document.getElementById("fk-typing");
        if (t) t.remove();
      }
    }

    function addUserMsg(t) {
      var div = document.createElement("div");
      div.className = "fk-msg fk-msg-user";
      div.textContent = t;
      $msgs.appendChild(div);
      scrollMsgs();
    }
    function addBotText(t) {
      var div = document.createElement("div");
      div.className = "fk-msg fk-msg-bot";
      div.textContent = t;
      $msgs.appendChild(div);
      scrollMsgs();
    }

    function renderCard(card) {
      var wrap = document.createElement("div");
      wrap.className = "fk-msg fk-msg-bot";

      if (card.summary) {
        var p = document.createElement("p");
        p.style.margin = "0 0 8px";
        p.style.fontSize = "13px";
        p.style.color = "#444";
        p.innerHTML = "<em>" + escapeHtml(card.summary) + "</em>";
        wrap.appendChild(p);
      }

      if (card.kind === "questions" && Array.isArray(card.questions) && card.questions.length) {
        var q = document.createElement("div");
        q.innerHTML = "<strong>Pour mieux vous orienter :</strong>";
        var ul = document.createElement("ul");
        ul.className = "fk-question-list";
        card.questions.forEach(function (qq) {
          var li = document.createElement("li");
          li.textContent = qq;
          ul.appendChild(li);
        });
        q.appendChild(ul);
        wrap.appendChild(q);
        $msgs.appendChild(wrap);
        scrollMsgs();
        return;
      }

      if (card.confidence) {
        var conf = document.createElement("div");
        var m = { high: ["fk-conf-high", "🟢 Compatible"], medium: ["fk-conf-medium", "🟠 Validation recommandée"], expert_required: ["fk-conf-expert", "🔴 Expertise requise"] };
        var c = m[card.confidence] || m.medium;
        conf.className = "fk-confidence " + c[0];
        conf.textContent = c[1];
        wrap.appendChild(conf);
      }

      if (Array.isArray(card.solutions) && card.solutions.length) {
        card.solutions.forEach(function (sol) {
          var cardDiv = document.createElement("div");
          cardDiv.className = "fk-card";
          if (sol.title) {
            var h = document.createElement("h4");
            h.textContent = sol.title;
            cardDiv.appendChild(h);
          }
          if (sol.explanation) {
            var pp = document.createElement("p");
            pp.className = "fk-explain";
            pp.textContent = sol.explanation;
            cardDiv.appendChild(pp);
          }
          if (Array.isArray(sol.products)) {
            sol.products.forEach(function (prod) {
              var pdiv = document.createElement("div");
              pdiv.className = "fk-product";
              var nm = document.createElement("div");
              nm.className = "fk-product-name";
              nm.textContent = prod.name || ("Produit " + (prod.product_id || "?"));
              pdiv.appendChild(nm);
              if (prod.why) {
                var why = document.createElement("div");
                why.className = "fk-product-why";
                why.textContent = prod.why;
                pdiv.appendChild(why);
              }
              var actions = document.createElement("div");
              actions.className = "fk-product-actions";
              if (prod.website_url) {
                var a = document.createElement("a");
                a.className = "fk-btn";
                a.href = (String(prod.website_url).indexOf("http") === 0 ? prod.website_url : SHOP_BASE + prod.website_url);
                a.target = "_blank"; a.rel = "noopener";
                a.textContent = "Voir la fiche";
                actions.appendChild(a);
              }
              if (prod.product_id) {
                var b = document.createElement("button");
                b.className = "fk-btn fk-btn-primary";
                b.textContent = "Ajouter au devis";
                b.addEventListener("click", function () { addToCart(prod); });
                actions.appendChild(b);
              }
              pdiv.appendChild(actions);
              cardDiv.appendChild(pdiv);
            });
          }
          wrap.appendChild(cardDiv);
        });
      }

      if (Array.isArray(card.vigilances) && card.vigilances.length) {
        var v = document.createElement("div");
        v.className = "fk-vigilance";
        v.innerHTML = "<strong>⚠️ Points d'attention :</strong><ul style='margin:4px 0 0;padding-left:18px'>"
          + card.vigilances.map(function (x) { return "<li>" + escapeHtml(x) + "</li>"; }).join("")
          + "</ul>";
        wrap.appendChild(v);
      }

      if (card.next_step) {
        var ns = document.createElement("div");
        ns.style.marginTop = "10px";
        ns.style.fontSize = "13px";
        ns.style.color = "#444";
        ns.innerHTML = "<strong>Prochaine étape :</strong> " + escapeHtml(card.next_step);
        wrap.appendChild(ns);
      }

      $msgs.appendChild(wrap);
      scrollMsgs();
    }

    async function addToCart(prod) {
      var qty = prompt("Quantité pour " + (prod.name || "ce produit") + " ?", "1");
      if (!qty) return;
      var n = parseInt(qty, 10);
      if (!n || n < 1) return;

      setLoading(true);
      try {
        var r = await fetch(CART_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: [{ product_id: prod.product_id, qty: n }], audience: "client" })
        });
        var data = await r.json();
        if (data.ok && data.shop_link) addBotText("✅ Ajouté au panier ! Cliquez ici : " + data.shop_link);
        else addBotText("⚠️ Impossible d'ajouter au panier. Essayez via la fiche produit.");
      } catch (e) {
        addBotText("⚠️ Erreur réseau lors de l'ajout au panier.");
      } finally {
        setLoading(false);
      }
    }

    function scrollMsgs() { $msgs.scrollTop = $msgs.scrollHeight; }
    function escapeHtml(s) {
      return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
        return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
      });
    }

    // ─── HOOK GLOBAL fkOpenFabien(brief?) ──────────────────────────
    window.fkOpenFabien = function (briefOrScenario) {
      openPanel();
      if (!briefOrScenario) return;
      // Si c'est un nom de scénario connu, mappe au brief. Sinon utilise tel quel.
      var brief = SCENARIOS[briefOrScenario] || briefOrScenario;
      // Utilise un setTimeout pour laisser le greeting s'afficher d'abord
      setTimeout(function () { sendMessage(brief); }, 350);
    };

    // ─── DÉCLENCHEURS ──────────────────────────────────────────────
    // 1. Lien <a href="#" data-fk-fabien="mur-humide"> (recommandé)
    // 2. Lien <a href="javascript:fkOpenFabien('mur-humide')"> (fallback)
    // 3. Param URL ?s=mur-humide → ouverture auto au chargement
    document.addEventListener("click", function (e) {
      var el = e.target.closest && e.target.closest("[data-fk-fabien]");
      if (el) {
        e.preventDefault();
        var sc = el.getAttribute("data-fk-fabien");
        window.fkOpenFabien(sc);
      }
    });

    // Auto-ouverture sur ?s=
    try {
      var params = new URLSearchParams(window.location.search);
      var s = params.get("s");
      if (s && SCENARIOS[s]) {
        // Léger délai pour laisser la page se stabiliser
        setTimeout(function () { window.fkOpenFabien(s); }, 600);
      }
    } catch (e) { /* ignore */ }
  }

  // Init quand le DOM est prêt
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
