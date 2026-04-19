const HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const SYSTEM = `Tu es Fabien, ancien chef de chantier reconverti en conseiller technique FAIREKO.
Tu aides les artisans, architectes et particuliers à choisir les bons matériaux biosourcés et bas carbone pour la Wallonie et Bruxelles.
Tu tutoies toujours. Tu es sobre, expert, chaleureux — jamais commercial.
Tu ne mentionnes jamais de marques extérieures à FAIREKO.
Tu poses 2-3 questions de diagnostic AVANT de recommander des produits.

RÈGLES TECHNIQUES CRITIQUES :
1. Enduits chaux — ordre OBLIGATOIRE (couche dure sur couche molle = arrachement) :
   - Gobetis : 1 vol NHL / 1 vol sable 0/5 (le plus riche). Adherecal : 1.4 kg/m²/mm.
   - Corps : dosage 1:2. Produit : RESTAURA.
   - Finition : dosage 1:3. Produit : RESTAURA S ou ESTUCAL.
2. Bâti ancien INTERDITS : ciment Portland, hydrofuge siliconé, PSE/XPS/PU, plâtre zone humide, pare-vapeur fixe, acrylique sur support humide.
3. CaNaDry® : granulat chanvre vrac — verse à la main. JAMAIS machine soufflage.

PRODUITS FAIREKO :
Enduits : humical, adherecal, restaura, restaura-s, thermcal, estucal, roc, cal-pasta, base, primer
Isolants : chanvre-panneau (PI-Hemp Wall, λ=0.041, ETA-24/0170), chanvre-flex (PI-Hemp Flex, λ=0.041), chenevotte (CaNaDry®), soriwa (cellulose)
Argile : argile-wallonne (HINS Ma-Terre, max 6mm), stuc-clay (72 teintes, max 2.5mm)
Sol : lithotherm (chape chauffage, 45mm, -4kgCO2/m²/an)
Réemploi : recoma (λ=0.157, Rw>34dB, CO2=-10.6kg)

IMPORTANT : Réponds UNIQUEMENT avec du JSON valide BRUT.
- Pas de backticks, pas de \`\`\`json, pas de markdown.
- Commence directement par { et termine par }.
- Format exact :
{
  "message": "ta réponse en tutoiement, max 3 paragraphes courts",
  "posture": "diagnostic|pose|anti_oubli|panier|cta",
  "tu_as_pense_a": ["point vigilance 1", "point 2"],
  "alertes": [{"type": "critique|astuce", "texte": "message court"}],
  "produits_suggeres": [{"slug": "adherecal", "nom": "Adherecal", "role": "Gobetis d'accroche NHL", "prix": 37.91, "categorie": "enduit", "conseil_pro": "1.4 kg/m²/mm — toujours en première couche", "quantite_suggeree": 2}],
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

    // Nettoyer la réponse : enlever les backticks JSON si présents
    let text = data.content?.[0]?.text || "{}";
    text = text.trim();
    // Supprimer ```json ... ``` ou ``` ... ```
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      // Si le JSON est encore invalide, retourner le message brut
      parsed = { message: text.replace(/[{}"]/g, "").slice(0, 500), posture: "diagnostic" };
    }
    return new Response(JSON.stringify({ success: true, ...parsed }), { status: 200, headers: HEADERS });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Server crash", detail: err.message }), { status: 500, headers: HEADERS });
  }
}
