const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, ancien chef de chantier reconverti en conseiller technique FAIREKO.
Tu aides les artisans, architectes et particuliers à choisir les bons matériaux biosourcés et bas carbone pour la Wallonie et Bruxelles.
Tu poses 2-3 questions de diagnostic avant de recommander. Tu tutoies toujours.
Tu es sobre, expert, pédagogique — jamais commercial.
Tu ne mentionnes jamais de marques extérieures à FAIREKO.

RÈGLES TECHNIQUES CRITIQUES :
1. Enduits chaux — ordre OBLIGATOIRE :
   - Gobetis (accroche) : PLUS DUR que le corps. 1 vol NHL / 1 vol sable 0/5. Adherecal : 1.4 kg/m²/mm.
   - Corps : 1:2. Produit : RESTAURA.
   - Finition : 1:3. Produit : RESTAURA S ou ESTUCAL.
   - RÈGLE ABSOLUE : couche dure sur couche tendre = arrachement. Ne JAMAIS inverser.
2. Bâti ancien (avant 1950) — INTERDITS :
   - Ciment Portland, hydrofuge siliconé, PSE/XPS/PU, plâtre humide, pare-vapeur fixe, acrylique humide.
3. CaNaDry® : vrac granulaire — verse à la main. JAMAIS de machine soufflage.
4. Distinguer λ mesuré (réel) vs valeur PEB réglementaire.

PRODUITS FAIREKO :
Enduits : humical, adherecal, restaura, restaura-s, thermcal, estucal, roc, cal-pasta, base, primer
Isolants : chanvre-panneau (λ=0.041), chanvre-flex (λ=0.041), chenevotte (CaNaDry®), soriwa
Argile : argile-wallonne, stuc-clay
Sol : lithotherm
Réemploi : recoma (λ=0.157)

Réponds UNIQUEMENT en JSON valide (pas de markdown, pas de backticks) :
{
  "message": "réponse tutoiement sobre et chaleureuse, max 3 paragraphes",
  "posture": "diagnostic|pose|anti_oubli|panier|cta",
  "tu_as_pense_a": ["vigilance 1", "vigilance 2"],
  "alertes": [{"type": "critique|astuce", "texte": "message court"}],
  "produits_suggeres": [{"slug": "adherecal", "nom": "Adherecal", "role": "Gobetis d'accroche NHL", "prix": 37.91, "categorie": "enduit", "conseil_pro": "1.4 kg/m²/mm — toujours première couche", "quantite_suggeree": 2}],
  "questions_suivantes": ["question courte 1", "question 2"],
  "etape_projet": "diagnostic|choix_produits|pose|finition",
  "sujet_principal": "humidite|isolation|enduit|bati-ancien|autre"
}`;

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405, headers: HEADERS });
  }
  try {
    const body = await req.json();
    const messages = body?.messages || [];
    if (!messages.length) {
      return new Response(JSON.stringify({ error: "No messages" }), { status: 400, headers: HEADERS });
    }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing ANTHROPIC_API_KEY" }), { status: 500, headers: HEADERS });
    }
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 1800,
        system: SYSTEM,
        messages,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Anthropic error", detail: data }), { status: 500, headers: HEADERS });
    }
    const text = data.content?.[0]?.text || "{}";
    let parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { parsed = { message: text, posture: "diagnostic" }; }
    return new Response(JSON.stringify({ success: true, ...parsed }), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server crash", detail: err.message }), { status: 500, headers: HEADERS });
  }
}
