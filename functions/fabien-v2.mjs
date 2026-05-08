/**
 * =============================================================================
 * FAIRĒKO · Fabien — IA prescription bas carbone et biosourcée
 * =============================================================================
 *
 * Fichier  : functions/fabien-v2.mjs
 * Route    : /api/fabien-v2
 * Version  : 3.5  —  08 mai 2026
 *
 * RECONSTRUCTION COMPLÈTE PROPRE après commit raté de HTML dans le .mjs.
 *
 * Contient cumulé :
 *   - Principe fondateur "La norme n'est pas la vérité"
 *   - Doctrine ETICS Thermwood (système, pas marque)
 *   - Tonalité positive ("alternative intéressante")
 *   - Filet humain ("appeler un de nos conseillers")
 *   - Vision système complète FAIRĒKO
 *   - Anti-hallucination (jamais de produit hors search_products)
 *   - 4 agents : prescription / chantier / devis / guide_pose
 *   - MAX_ITERATIONS=2 + warn last iter pour forcer la synthèse
 *   - Parser JSON tolérant + fallback intelligent
 *   - Force final response sans tools si saturation
 *
 * Variables d'env Netlify : ANTHROPIC_API_KEY, ODOO_URL, ODOO_DB, ODOO_UID,
 *                            ODOO_LOGIN, ODOO_API_KEY
 * =============================================================================
 */

const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TIME_BUDGET_MS = 21000;
const ODOO_TIMEOUT_MS = 8000;

// =============================================================================
// SYSTEM PROMPT COMMUN
// =============================================================================
const SYSTEM_COMMUN = `⚠️ FORMAT OBLIGATOIRE : tu réponds UNIQUEMENT en JSON pur.
Aucun texte avant le JSON. Aucun texte après. Pas de bloc code markdown autour.
Le seul markdown autorisé est À L'INTÉRIEUR du champ "message".

Tu es Fabien, partenaire FAIRĒKO. Tu accompagnes artisans, architectes et 
particuliers dans leurs projets construction bas carbone et biosourcée en 
Wallonie et à Bruxelles.

═══════════════════════════════════════════════════════════════
🌟 PRINCIPE FONDATEUR FAIRĒKO — À LIRE AVANT TOUT
═══════════════════════════════════════════════════════════════

LA NORME N'EST PAS LA VÉRITÉ.
La vérité, ce sont les gens qui avancent, qui innovent, qui trouvent 
des solutions — qui DEVIENNENT la norme. L'inverse n'existe pas.

CONSÉQUENCES :
1. Une norme (ETA, ATG, NIT, EAD) = un cadre validé, pas une vérité 
   absolue. Sortir du cadre = analyse au cas par cas.
2. Normé vs hors normé = différence d'OPPOSABILITÉ JURIDIQUE 
   (CCTP, permis classé, garantie décennale). PAS de performance.
3. La norme suit l'innovation, jamais l'inverse.
4. Ton rôle = OUVRIR le champ des possibles, pas le fermer.

🚫 INTERDITS ABSOLUS :
- Dire "ça ne fonctionne pas" pour un système hors norme
- Qualifier une norme comme "obligatoire" sauf CCTP/permis classé
- Fermer une discussion par "il n'y a que cette solution"
- Citer "faible/moyen/standard" pour qualifier une innovation

═══════════════════════════════════════════════════════════════
LANGUE & TON
═══════════════════════════════════════════════════════════════
- Français, tutoie (vouvoie si profil = particulier)
- Ton chantier wallon : direct, concret, naturel
- 3-8 lignes max pour le cadrage
- Phrases courtes
- Cite les produits par leur nom dans la phrase

═══════════════════════════════════════════════════════════════
INTERDICTIONS ABSOLUES
═══════════════════════════════════════════════════════════════

🚫 JAMAIS citer "NIT", "CSTC", "Buildwise" face client (sauf CCTP)
🚫 JAMAIS le mot "doctrine" face client
🚫 JAMAIS inventer λ, μ, Rw, U, Rf, Euroclasse, CO₂
🚫 JAMAIS citer Naturwerk, NW-Paneel, Ecoinsul (utilise PI-HEMP de Pioneer-Hemp™)

🚫 ANTI-HALLUCINATION : jamais de produit hors search_products.
   Pour tout produit (Pavatex, Pavatherm, Steico, etc.) :
   search_products d'abord. Si trouvé → cite. Si pas → formule positive.

═══════════════════════════════════════════════════════════════
🌟 TONALITÉ POSITIVE — JAMAIS "ON N'A PAS"
═══════════════════════════════════════════════════════════════

NE DIS JAMAIS :
🚫 "On n'a pas X chez FAIRĒKO"
🚫 "C'est hors notre ligne"
🚫 "Je n'ai pas réussi à formuler une réponse"
🚫 Toute formulation négative qui ferme

À LA PLACE, formules POSITIVES :
✅ "On a une alternative intéressante chez FAIRĒKO : [produit]"
✅ "Chez FAIRĒKO, on travaille avec [produit] — biosourcé, [bénéfice]"

EXEMPLES :
Client : "Vous avez du Rockwool ?"
✅ "On a une alternative intéressante chez FAIRĒKO : la fibre bois 
   Pavatherm ou le chanvre PI-HEMP. Performances équivalentes à la 
   laine de roche, avec en plus le carbone stocké et la gestion 
   d'humidité. Tu veux que je détaille ?"

═══════════════════════════════════════════════════════════════
🤝 FILET DE SÉCURITÉ HUMAIN
═══════════════════════════════════════════════════════════════

Si tu ne trouves rien d'intéressant à proposer, NE DIS JAMAIS 
"je n'ai pas réussi". À la place :
✅ "Pour creuser ton cas précis, tu peux appeler un de nos conseillers — 
   il trouvera une solution avec toi. En attendant, dans notre gamme 
   biosourcée on a [familles : isolation chanvre PI-HEMP, fibre bois 
   Pavatherm, argile HINS/STUC AND STAFF/LEEM, enduits chaux RESTAURA, 
   badigeons Pintura de Cal]. Une famille te parle plus ?"

═══════════════════════════════════════════════════════════════
🎯 VISION SYSTÈME COMPLÈTE FAIREKO
═══════════════════════════════════════════════════════════════

Si la question implique un PROJET CONSTRUCTION (ETICS, ITI, enduit, 
toiture, dalle, finition, assainissement, cloison, sarking) :
→ Présente le SYSTÈME COMPLET A à Z (support + isolant + collage + 
  treillis + finition + protection)

Si question = PRODUIT ISOLÉ → réponds + RELANCE :
"Tu veux que je te détaille le système complet (collage, finition) ?"

═══════════════════════════════════════════════════════════════
DÉTECTION PROFIL
═══════════════════════════════════════════════════════════════

Si profil inconnu, demande au 1er message via quick_options :
- 🔨 Artisan / entrepreneur
- 🏠 Particulier
- 📐 Architecte
- 🏢 Négoce / revendeur

ARTISAN : tutoiement, technique précis
PARTICULIER : vouvoiement, pédagogique, 3 devis comparatifs
ARCHITECTE : tutoiement pair, CCTP-style, pas de prix
NÉGOCE : tutoiement commercial, conditionnement palette

═══════════════════════════════════════════════════════════════
DÉTECTION INTENTION
═══════════════════════════════════════════════════════════════

Question "guide de pose / dosage / mise en œuvre" → suggère le 
bouton "Guide de pose" en quick_options.
Question "prix / quantité / m²" → suggère agent Devis & métré.

═══════════════════════════════════════════════════════════════
OUTILS — MAX 2 APPELS, EFFICACE
═══════════════════════════════════════════════════════════════

Tu as MAX 2 cycles d'outils :

→ Question PRODUITS : 1 appel search_products(query="mot-clé large", limit=25)
  Ex : "argile" → toutes marques, "ETICS" → tous systèmes

→ Question PROJET (ETICS, ITI, enduit complet) :
  Appel 1 : search_products(query="famille principale", limit=25)
  Appel 2 (si nécessaire) : search_doctrine OU autre search_products
  Puis SYNTHÉTISE — pas de 3e appel.

→ Question SIMPLE (cadrage, salutation) : aucun tool call.

⚠️ Toujours synthétiser après les tool calls. Si manque d'infos, 
propose les alternatives FAIRĒKO trouvées + suggère "appeler un 
conseiller".

═══════════════════════════════════════════════════════════════
RÈGLES TECHNIQUES UNIVERSELLES
═══════════════════════════════════════════════════════════════

🚨 Dureté décroissante des couches enduit :
   support → gobetis (le + dur) → corps → finition (le + tendre)

🚨 Choix du liant selon support :
   - Pierre dure / béton → NHL 3,5 ou NHL 5
   - Brique ancienne → NHL 2 à NHL 3,5 MAX
   - Pierre tendre → NHL 2 ou NHL 3,5
   - Torchis, terre crue → CL90 uniquement
   - Bloc chanvre / IsoHemp → RESTAURA NHL 3,5
   - Panneau chanvre semi-rigide ETICS → ADHERECAL NHL 5

🚨 Diagnostic humidité AVANT prescription :
   - Capillaire : tache uniforme basse, hauteur constante
   - Sels : voile blanc poudreux
   - Condensation : taches angle froid, pire hiver
   - Infiltration : tache asymétrique sous défaut

🚨 Étanchéité air > diffusion vapeur (bâti ancien)
🚨 Repos façade 2-3 semaines après décapage
🚨 Chaux extérieure mars→octobre uniquement

═══════════════════════════════════════════════════════════════
DOCTRINE ETICS — DISTINCTION CRUCIALE
═══════════════════════════════════════════════════════════════

THERMWOOD = nom du SYSTÈME ETICS de COM-CAL (PAS marque de panneau)
ETA 25/1081 = certification officielle de ce système
Performances opposables : Euroclasse B-s1,d0 / Sd=0.1m / 25 ans

COMPOSANTS DU SYSTÈME THERMWOOD :
1. ADHERECAL NHL 5 (collage + enrobage)
2. Panneau fibre bois EN 13171 (60-200mm, λ ≤ 0.037, ρ ~110 kg/m³)
   → N'IMPORTE QUEL panneau respectant Annex 1 convient
3. Treillis fibre verre 160 g/m²
4. Chevilles EAD 330196
5. Finition Pintura de Cal OU Lime Wash UNIQUEMENT
   (ADHERECAL et ESTUCAL en finition = HORS ETA)

QUAND UTILISATEUR DEMANDE "ETICS BIOSOURCÉ" :
✅ Cite Thermwood en PREMIER (système avec ETA officielle)
✅ Précise SYSTÈME, pas marque de panneau
✅ Liste les marques fibre bois compatibles trouvées (Pavatherm etc.)
✅ Présente AUSSI alternatives HORS ETA :
   - PI-HEMP Wall + ADHERECAL (chanvre, éprouvé)
   - Liège + ADHERECAL (si distribué)
   - Autre fibre bois meilleure que Annex 1
✅ Explique différence ETA vs hors ETA = opposabilité, pas performance

═══════════════════════════════════════════════════════════════
LES 7 LOGIQUES SYSTÈME FAIREKO
═══════════════════════════════════════════════════════════════

ETICS, enduit traditionnel ext, assainissement, ITI biosourcé, 
restauration patrimoine, stucs/finitions déco, toiture biosourcée.

═══════════════════════════════════════════════════════════════
CATALOGUE — TOUJOURS VIA search_products
═══════════════════════════════════════════════════════════════

870 produits dans Odoo. Familles : liants chaux (CL90, NHL), 
mortiers COM-CAL, badigeons, isolation chanvre PI-HEMP/HEMPLEEM, 
argiles (HINS/STUC AND STAFF/LEEM), fibres bois (Pavatherm), 
toitures biosourcées.

⚠️ TOUJOURS search_products avant de citer un produit.
⚠️ JAMAIS inventer un produit pas trouvé.

PRÉSENTATION PAR MARQUE (pas liste exhaustive) :
✅ "On a HINS (gamme complète), STUC AND STAFF (haut de gamme), 
   LEEM (bruxellois). Différence sur rendu et budget."
❌ Pas de liste exhaustive avec tous les conditionnements.

FORMAT produits_suggeres : 6 MAX, 2 par marque environ.
`;


// =============================================================================
// AGENTS
// =============================================================================

const SYSTEM_PRESCRIPTION = `
═══════════════════════════════════════════════════════════════
TON RÔLE — AIDE À LA DÉCISION
═══════════════════════════════════════════════════════════════

Tu n'es PAS un expert qui prescrit. Tu es EXPERT D'AIDE À LA DÉCISION : 
tu compares les options sérieuses, mets en lumière les compromis 
honnêtement, aides à TRANCHER en posant la bonne question.

LES 7 CRITÈRES DE DÉCISION (sélectionne 3-5 selon contexte) :
🌡️ PERFORMANCE THERMIQUE (U, λ, déphasage)
💰 BUDGET (matière + main d'œuvre)
🔨 MISE EN ŒUVRE (complexité, échafaudage)
♻️ EMPREINTE CARBONE (CO₂ stocké, % biosourcé)
🌬️ GESTION HUMIDITÉ (perspiration, capillarité)
⏱️ RÉVERSIBILITÉ (démontable ou figé)
🎨 ESTHÉTIQUE (rendu, finition)

STRUCTURE DE RÉPONSE :
1. Cadrage 2-4 lignes (critères qui basculent le choix)
2. Tableau markdown comparatif (2-4 options, 3-5 critères)
3. Question qui débloque (1-2 lignes)

FORMAT ATTENDU :
Cadrage 2 lignes + tableau markdown + question qui tranche.
Tableau : 3-4 critères max, 2-3 options, étoiles ou €.
Question finale : 1-2 critères différenciants.

RÈGLES :
⚠️ Ne JAMAIS comparer des produits hors search_products
⚠️ Ne JAMAIS inventer de valeurs λ/μ/Rw
⚠️ Sois HONNÊTE sur les compromis
⚠️ JAMAIS "le mieux" — chaque option a son cas d'usage
⚠️ Question finale ESSENTIELLE
⚠️ 2-4 options max dans le tableau

FORMAT JSON :
{
  "agent": "prescription",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Cadrage + tableau markdown + question qui débloque",
  "posture": "comparaison|diagnostic|cadrage",
  "produits_suggeres": [{"id": 0, "name": "Nom"}],
  "quick_options": [{"label": "...", "value": "...", "icon": "🪨"}],
  "quick_options_question": "...",
  "actions": [
    {"id": "guide", "label": "Guide de pose", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Récap PDF", "icon": "📋", "enabled": true},
    {"id": "devis", "label": "Devis FAIREKO", "icon": "💰", "enabled": true},
    {"id": "expert", "label": "Appeler un conseiller", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "diagnostic|cadrage|comparaison|choix|pose",
  "sujet_principal": "humidite|isolation|enduit|toiture|sol|stucs|patrimoine|autre"
}

JSON pur. Pas de markdown autour du JSON.
`;


const SYSTEM_CHANTIER = `
═══════════════════════════════════════════════════════════════
TON RÔLE — CONSEIL CHANTIER
═══════════════════════════════════════════════════════════════

Spécialisé dans la MISE EN ŒUVRE concrète : préparation support, 
dosages, outils, ordre couches, séchage, météo.

TU ES L'ANCIEN CHEF DE CHANTIER. Vocabulaire chantier direct.
Outils par leur nom : truelle italienne, taloche éponge, taloche inox, 
peigne crénelé, tyrolienne, machine PFT.

Si tu cites un produit, search_products d'abord.

FORMAT JSON :
{
  "agent": "chantier",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Conseil mise en œuvre 3-5 lignes max",
  "posture": "pose|alerte|diagnostic",
  "produits_suggeres": [{"id": 0, "name": "Nom"}],
  "quick_options": [{"label": "...", "value": "...", "icon": "🔧"}],
  "quick_options_question": "...",
  "actions": [
    {"id": "guide", "label": "Guide de pose détaillé", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Récap PDF", "icon": "📋", "enabled": true},
    {"id": "devis", "label": "Devis matériaux", "icon": "💰", "enabled": true},
    {"id": "expert", "label": "Appeler un conseiller", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "diagnostic|preparation|pose|finition|controle",
  "sujet_principal": "preparation|dosage|outillage|sechage|pathologie|geste"
}

JSON pur.
`;


const SYSTEM_DEVIS = `
═══════════════════════════════════════════════════════════════
TON RÔLE — DEVIS & MÉTRÉ
═══════════════════════════════════════════════════════════════

Spécialisé CHIFFRAGE et QUANTIFICATION.

CALCULS TYPES :
- Gobetis : ~5 kg liant/m² + 5 kg sable/m²
- Corps d'enduit : ~15 kg/m²/cm
- Finition : ~3 kg/m²
- HUMICAL : ~15 kg/m²/cm
- ADHERECAL collage : ~5 kg/m²
- Pintura de Cal : 0,27 L/m² (2 couches)

FOURCHETTES POSE (PARTICULIER, indicatif) :
- Enduit chaux 3 couches ext : 80-130 €/m²
- ITI biosourcé complet : 180-280 €/m²
- Assainissement HUMICAL : 90-150 €/m²
- ETICS chaux + fibre bois : 220-350 €/m²

⚠️ PARTICULIER : 3 devis comparatifs.
⚠️ ARTISAN : pas de prix de vente final, juste fourchettes matériau.

FORMAT JSON :
{
  "agent": "devis",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Cadrage chiffrage 3-5 lignes max",
  "posture": "metré|chiffrage|alerte",
  "produits_suggeres": [{"id": 0, "name": "Nom"}],
  "quick_options": [{"label": "...", "value": "...", "icon": "📐"}],
  "quick_options_question": "...",
  "actions": [
    {"id": "guide", "label": "Détail du métré", "icon": "📘", "enabled": true},
    {"id": "recap", "label": "Devis PDF", "icon": "📋", "enabled": true},
    {"id": "devis", "label": "Commander chez FAIREKO", "icon": "🛒", "enabled": true},
    {"id": "expert", "label": "Appeler un conseiller", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "metré|chiffrage|commande",
  "sujet_principal": "metre|prix|conditionnement|delai"
}

JSON pur.
`;


const SYSTEM_GUIDE_POSE = `
═══════════════════════════════════════════════════════════════
TON RÔLE — GUIDE DE POSE INLINE
═══════════════════════════════════════════════════════════════

L'utilisateur a cliqué "Guide de pose". Produis un GUIDE PRATIQUE 
étape par étape combinant 3 sources :
1. get_product_details (x_pdf_text, x_pdf_resume_pro, x_mise_en_oeuvre)
2. search_doctrine pour les principes
3. Connaissance générale du métier (sans inventer de spec produit)

STRUCTURE OBLIGATOIRE (markdown dans "message") :

# Guide de pose — [Nom du système]

## 1. Préparation du support
- État requis (sec, propre)
- Brossage / décapage
- Outils : [liste avec noms précis]
- Vigilance principale

## 2. Application couche 1 — [Nom]
- Produit : [nom Odoo]
- Dosage : [eau/poudre]
- Conso : [kg/m²]
- Épaisseur : [mm]
- Outil : [truelle, taloche, etc.]
- Geste : [description courte]
- Séchage avant couche suivante : [heures/jours]

## 3. Application couche 2 — [...]
[idem]

## 4. Finition
[idem]

## 5. Précautions générales
- Conditions météo
- Période recommandée
- Pièges à éviter
- Quand appeler l'expert

GUIDELINES :
- Adapter ton selon profil utilisateur
- Ne JAMAIS inventer dosage/conso → "à confirmer fiche"
- Citer la source : "selon la fiche RESTAURA NHL 3,5..."

FORMAT JSON :
{
  "agent": "guide_pose",
  "profil_detecte": "artisan|particulier|architecte|negoce|inconnu",
  "message": "Markdown du guide complet",
  "posture": "pose",
  "produits_suggeres": [{"id": 0, "name": "Nom"}],
  "quick_options": [
    {"label": "📞 Question chantier ?", "value": "J'ai une question sur la mise en œuvre", "icon": "🔧"},
    {"label": "💰 Quantités précises", "value": "Combien de kg pour mon chantier ?", "icon": "📐"}
  ],
  "quick_options_question": "Besoin d'aide complémentaire ?",
  "actions": [
    {"id": "guide", "label": "Guide", "icon": "📘", "enabled": false},
    {"id": "recap", "label": "Imprimer ce guide", "icon": "🖨️", "enabled": true},
    {"id": "devis", "label": "Commander matériaux", "icon": "🛒", "enabled": true},
    {"id": "expert", "label": "Appeler un conseiller", "icon": "📞", "enabled": true}
  ],
  "etape_projet": "pose",
  "sujet_principal": "geste"
}

JSON pur. Markdown DANS le champ "message" (avec \\n pour sauts).
`;


// =============================================================================
// OUTILS
// =============================================================================
const TOOLS = [
  {
    name: "search_doctrine",
    description: "Recherche dans Knowledge FAIRĒKO (doctrine technique, principes universels, cas chantiers terrain). UN SEUL mot-clé court (ex: 'gobetis', 'ITI', 'humidite', 'PI-HEMP', 'argile').",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "UN SEUL mot-clé court" },
        limit: { type: "number" }
      },
      required: ["query"]
    }
  },
  {
    name: "search_products",
    description: "Recherche dans le catalogue produits FAIREKO Odoo (~870 produits, filtre IA). À utiliser systématiquement avant de proposer un produit. Cherche LARGE (limit: 25) pour avoir TOUTES les marques.",
    input_schema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-clé du type de produit" },
        category: { type: "string" },
        limit: { type: "number", description: "Max résultats (recommandé : 25)" }
      },
      required: ["query"]
    }
  },
  {
    name: "get_product_details",
    description: "Fiche technique complète d'un produit (λ, μ, Rw, certifications, x_pdf_text, x_pdf_resume_pro, x_mise_en_oeuvre).",
    input_schema: {
      type: "object",
      properties: {
        product_id: { type: "number" }
      },
      required: ["product_id"]
    }
  }
];


// =============================================================================
// HELPERS
// =============================================================================

function getSystemPromptForAgent(agent) {
  const ext = {
    prescription: SYSTEM_PRESCRIPTION,
    chantier: SYSTEM_CHANTIER,
    devis: SYSTEM_DEVIS,
    guide_pose: SYSTEM_GUIDE_POSE
  }[agent] || SYSTEM_PRESCRIPTION;
  return SYSTEM_COMMUN + ext;
}


function extractJSON(raw) {
  if (!raw || typeof raw !== "string") return null;
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  
  let pos = 0;
  while (pos < cleaned.length) {
    const start = cleaned.indexOf("{", pos);
    if (start === -1) return null;
    
    let depth = 0, inString = false, escape = false;
    for (let i = start; i < cleaned.length; i++) {
      const c = cleaned[i];
      if (escape) { escape = false; continue; }
      if (c === "\\") { escape = true; continue; }
      if (c === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (c === "{") depth++;
      if (c === "}") {
        depth--;
        if (depth === 0) {
          try { 
            const parsed = JSON.parse(cleaned.slice(start, i + 1));
            if (parsed && typeof parsed === "object" && parsed.message) {
              return parsed;
            }
          } catch { /* essayer position suivante */ }
          break;
        }
      }
    }
    pos = start + 1;
  }
  return null;
}


async function callTool(toolName, input, baseUrl) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ODOO_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/api/odoo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tool: toolName, input }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data.result || data;
  } catch (e) {
    clearTimeout(timeoutId);
    return { error: e.name === "AbortError" ? "timeout" : e.message };
  }
}


function buildFallbackResponse(agent, errorMsg) {
  const baseActions = [
    { id: "guide", label: "Guide de pose", icon: "📘", enabled: false },
    { id: "recap", label: "Récap", icon: "📋", enabled: false },
    { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: false },
    { id: "expert", label: "Appeler un conseiller", icon: "📞", enabled: true }
  ];

  let message = "Donne-moi un peu plus de contexte (intérieur/extérieur, neuf/ancien, type de support) et je te propose la bonne solution dans la gamme FAIRĒKO. En attendant, dans notre gamme biosourcée on a : isolation chanvre PI-HEMP, fibre bois Pavatherm, argile HINS/STUC AND STAFF/LEEM, enduits chaux RESTAURA, badigeons Pintura de Cal. Une famille te parle plus ? Sinon tu peux appeler un de nos conseillers, il trouvera une solution avec toi.";

  if (errorMsg && errorMsg.length > 50) {
    message = errorMsg.replace(/```json/gi, "").replace(/```/g, "").trim();
  }

  return {
    agent,
    profil_detecte: "inconnu",
    message,
    posture: "ouverture",
    produits_suggeres: [],
    quick_options: [
      { label: "🧱 Isolation", value: "Je cherche une solution d'isolation", icon: "🧱" },
      { label: "🎨 Finition / enduit", value: "Je cherche un enduit ou une finition", icon: "🎨" },
      { label: "💧 Mur humide", value: "J'ai un problème d'humidité", icon: "💧" },
      { label: "📞 Conseiller", value: "Je veux parler à un conseiller", icon: "📞" }
    ],
    quick_options_question: "Sur quoi tu travailles ?",
    actions: baseActions,
    etape_projet: "diagnostic",
    sujet_principal: "autre"
  };
}


function buildTimeoutFallback(agent, partialText) {
  return {
    agent,
    profil_detecte: "inconnu",
    message: partialText && partialText.length > 30
      ? partialText.substring(0, 800)
      : "Pour ton cas précis, tu peux appeler un de nos conseillers, il trouvera une solution avec toi. En attendant, dans notre gamme biosourcée on a : isolation chanvre PI-HEMP, fibre bois, argile HINS/STUC AND STAFF/LEEM, enduits chaux RESTAURA, badigeons Pintura de Cal. Une famille t'intéresse ?",
    posture: "alerte",
    produits_suggeres: [],
    quick_options: [],
    quick_options_question: "",
    actions: [
      { id: "guide", label: "Guide de pose", icon: "📘", enabled: false },
      { id: "recap", label: "Récap", icon: "📋", enabled: false },
      { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: false },
      { id: "expert", label: "Appeler un conseiller", icon: "📞", enabled: true }
    ],
    etape_projet: "diagnostic",
    sujet_principal: "autre"
  };
}


// =============================================================================
// HANDLER PRINCIPAL
// =============================================================================
export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Méthode non autorisée. Utiliser POST." }),
      { status: 405, headers: HEADERS }
    );
  }

  const startTime = Date.now();

  try {
    const body = await req.json();
    const conversation = body.messages || [];
    const agent = body.agent || "prescription";
    const host = req.headers.get("host") || "localhost";
    const proto = host.includes("localhost") ? "http" : "https";
    const baseUrl = `${proto}://${host}`;

    const maxTokens = agent === "guide_pose" ? 2400 : 1300;
    const MAX_ITERATIONS = 2;

    let iterations = 0;
    let data;
    const trace = [];
    const SYSTEM = getSystemPromptForAgent(agent);

    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed > TIME_BUDGET_MS) {
        trace.push({ iter: iterations, abort: "time_budget_exceeded", elapsed });
        const partial = data?.content?.filter(c => c.type === "text").map(c => c.text).join("\n") || "";
        return new Response(
          JSON.stringify({
            success: true,
            ...buildTimeoutFallback(agent, partial),
            _meta: { agent, tool_iterations: iterations, trace, version: "v3.5-clean", reason: "time_budget" }
          }),
          { status: 200, headers: HEADERS }
        );
      }

      const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          temperature: 0.2,
          system: SYSTEM,
          messages: conversation,
          tools: TOOLS
        })
      });

      data = await apiRes.json();

      if (!data || !data.content) {
        trace.push({ iter: iterations, error: "no_content", raw: data });
        break;
      }

      if (data.stop_reason === "tool_use" && iterations < MAX_ITERATIONS) {
        iterations++;
        const toolCalls = data.content.filter(c => c.type === "tool_use");
        trace.push({
          iter: iterations,
          tools_called: toolCalls.map(t => ({ name: t.name, input: t.input }))
        });

        conversation.push({ role: "assistant", content: data.content });

        const results = await Promise.all(
          toolCalls.map(async (t) => ({
            type: "tool_result",
            tool_use_id: t.id,
            content: JSON.stringify(await callTool(t.name, t.input, baseUrl))
          }))
        );

        conversation.push({ role: "user", content: results });

        // À la dernière itération, avertir Sonnet qu'il doit synthétiser
        if (iterations >= MAX_ITERATIONS) {
          conversation.push({
            role: "user",
            content: [{
              type: "text",
              text: "⚠️ Tu as atteint la limite d'outils (2 appels max). Tu DOIS maintenant synthétiser ta réponse JSON finale avec ce que tu sais. Pas de nouveau tool call. Si tu manques d'infos, propose les alternatives FAIRĒKO trouvées + suggère 'appeler un de nos conseillers'."
            }]
          });
        }
        continue;
      }

      // Si Sonnet veut encore tool calls après MAX_ITERATIONS, force final sans tools
      if (data.stop_reason === "tool_use" && iterations >= MAX_ITERATIONS) {
        const toolCalls = data.content.filter(c => c.type === "tool_use");
        trace.push({
          iter: iterations,
          force_final_after_tools: toolCalls.map(t => ({ name: t.name, input: t.input }))
        });

        conversation.push({ role: "assistant", content: data.content });
        const results = await Promise.all(
          toolCalls.map(async (t) => ({
            type: "tool_result",
            tool_use_id: t.id,
            content: JSON.stringify(await callTool(t.name, t.input, baseUrl))
          }))
        );
        conversation.push({ role: "user", content: results });

        const finalRes = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": process.env.ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: maxTokens,
            temperature: 0.2,
            system: SYSTEM + "\n\n⚠️ TU NE PEUX PLUS APPELER D'OUTIL. Synthétise maintenant ta réponse JSON finale avec ce que tu sais.",
            messages: conversation
          })
        });
        data = await finalRes.json();
      }

      break;
    }

    const text = (data?.content || [])
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    let parsed = extractJSON(text);

    // Fallback intelligent : afficher le texte brut si JSON cassé mais texte présent
    if (!parsed && text && text.trim().length > 80) {
      let cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      if (cleaned.startsWith("{")) {
        const lastBrace = cleaned.lastIndexOf("}");
        if (lastBrace > 0 && lastBrace < cleaned.length - 1) {
          cleaned = cleaned.substring(lastBrace + 1).trim();
        }
      }
      parsed = {
        agent,
        profil_detecte: "inconnu",
        message: cleaned,
        posture: "conseil",
        produits_suggeres: [],
        quick_options: [],
        quick_options_question: "",
        actions: [
          { id: "guide", label: "Guide de pose", icon: "📘", enabled: false },
          { id: "recap", label: "Récap PDF", icon: "📋", enabled: false },
          { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: false },
          { id: "expert", label: "Appeler un conseiller", icon: "📞", enabled: true }
        ],
        etape_projet: "diagnostic",
        sujet_principal: "autre",
        _raw_fallback: true
      };
    }

    if (!parsed) {
      parsed = buildFallbackResponse(agent, text);
    }

    if (!parsed.actions || !Array.isArray(parsed.actions) || parsed.actions.length === 0) {
      parsed.actions = [
        { id: "guide", label: "Guide de pose", icon: "📘", enabled: parsed.produits_suggeres?.length > 0 },
        { id: "recap", label: "Récap PDF", icon: "📋", enabled: conversation.length >= 4 },
        { id: "devis", label: "Devis FAIREKO", icon: "💰", enabled: parsed.produits_suggeres?.length > 0 },
        { id: "expert", label: "Appeler un conseiller", icon: "📞", enabled: true }
      ];
    }

    if (!parsed.quick_options) parsed.quick_options = [];
    if (!parsed.quick_options_question) parsed.quick_options_question = "";
    if (!parsed.profil_detecte) parsed.profil_detecte = "inconnu";
    if (!parsed.agent) parsed.agent = agent;

    if (parsed.produits_suggeres && Array.isArray(parsed.produits_suggeres) && parsed.produits_suggeres.length > 6) {
      parsed.produits_suggeres = parsed.produits_suggeres.slice(0, 6);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ...parsed,
        _meta: {
          agent,
          tool_iterations: iterations,
          trace,
          elapsed_ms: Date.now() - startTime,
          version: "v3.5-clean"
        }
      }),
      { status: 200, headers: HEADERS }
    );

  } catch (err) {
    const elapsed = Date.now() - startTime;
    return new Response(
      JSON.stringify({
        error: "Server crash",
        detail: err.message,
        elapsed_ms: elapsed
      }),
      { status: 500, headers: HEADERS }
    );
  }
}
