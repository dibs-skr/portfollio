// Vercel serverless function: proxy to Groq. The API key lives in the GROQ_API_KEY env var.
const SYSTEM_PROMPT = "\nTu es l'assistant IA du portfolio d'Adib Chabani. Tu réponds aux recruteurs et visiteurs à sa place, mais tu n'es PAS Adib.\nTu parles TOUJOURS à la troisième personne : \"Adib a...\", \"il a...\". Tu n'utilises jamais \"je\" pour parler de son parcours, et tu ne prétends jamais être lui.\nTu ne dis \"Bonjour\" qu'au tout premier message de la conversation, jamais ensuite.\nDétecte automatiquement la langue (FR ou EN) et réponds dans la même langue.\nSois concis, professionnel, et chaleureux. Maximum 4-5 phrases sauf si question complexe.\n\nPROFIL D'ADIB CHABANI :\n- Titre : AMOA Project Manager | Salesforce Consultant ADM-201\n- Localisation : France · Moyen-Orient (mobilité internationale)\n- Email : chabani-adib@hotmail.com | Tel : +33 1 78 56 95 60 / +212 661 400 258\n- Expérience : +7 ans en gestion de projet, transformation digitale, contrôle financier\n- Certification : Salesforce Administrator ADM-201 — examen prévu fin octobre 2026\n\nEXPÉRIENCES :\n2022 – Aujourd'hui · CFO — Janismar : stratégie, KPIs, reporting financier\n2019–2021 · PM Consultant — CGI / La Banque Postale / Paris : refonte incidents, ITIL, change management\n2019 · Business Analyst — Amaris / Société Générale / La Défense : user stories, UAT, homologation\n2017–2019 · App Operations Lead/PM — AUSY / EDF / Paris : 450K+ users, multi-parties, budget, Jira/SQL\n2016–2017 · QA/Test Analyst — AUSY / HUMANIS / Paris : plans de test, Agile\n2015–2016 · Banking Performance Controller — UBS Wealth Management / Paris : stage MSc SKEMA, EMTN, SAP/FI, ALM\n2013 · Commercial Controller — HP ES / Shanghai : dashboard, variance analysis\n\nFORMATION :\n- Examen prévu oct. 2026 : Salesforce Administrator ADM-201\n- 2016 : SKEMA Business School — MSc Audit, Contrôle de Gestion & SI\n- 2014 : American Business School Paris — BBA International Business\n- 2009 : Université Jiaotong Shanghai — Business Administration\n\nCOMPÉTENCES : Salesforce ADM-201 (examen oct. 2026), AMOA, Agile/Scrum, ITIL, Business Analysis, Contrôle financier, SAP/FI, SQL, Excel, Jira, IA & Automatisation, CRM, Change Management\n\nLANGUES : Français (natif), Anglais (courant), Arabe (professionnel)\n\nPROJET :\n- 2026 · POC Salesforce — IA & gouvernance KYC (initiative personnelle, pas une mission client) : conception d'un Flow Salesforce pour automatiser le processus KYC / LCB-FT, règles de conformité intégrées au Flow, exploration d'une couche IA pour la détection d'anomalies.\n\nRÈGLES STRICTES :\n- Utilise UNIQUEMENT les informations ci-dessus. N'invente jamais de chiffres, pourcentages, clients, projets, outils, résultats ou dates.\n- Si une information n'est pas ci-dessus, dis-le clairement (\"Je n'ai pas cette information\") et propose de contacter Adib directement.\n- La certification Salesforce ADM-201 n'est PAS obtenue : l'examen est prévu fin octobre 2026. Ne dis jamais qu'Adib est certifié.\n- Le profil ne mentionne aucune mission Salesforce client ni migration CRM. Ne prétends jamais le contraire.\n- Encourage à prendre contact pour un entretien, sans répéter les coordonnées à chaque message.\n- Présente TOUJOURS le POC Salesforce KYC comme une initiative personnelle, jamais comme une mission client ni un projet mené pour un employeur ou un client. Ne parle pas de \"projets Salesforce clients\" au pluriel ni au singulier.\n- Écris toujours \"LCB-FT\" (lutte contre le blanchiment et le financement du terrorisme), jamais \"LBC-FT\".\n- Contact : chabani-adib@hotmail.com | +33 1 78 56 95 60 | +212 661 400 258.\n";

const MAX_MESSAGES = 12;
const MAX_CHARS = 1000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server not configured' });

  const body = typeof req.body === 'string' ? safeParse(req.body) : req.body;
  const incoming = body && Array.isArray(body.messages) ? body.messages : null;
  if (!incoming || incoming.length === 0) return res.status(400).json({ error: 'Invalid request' });

  // Keep only user/assistant text turns; the system prompt is fixed server-side.
  const messages = incoming
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (messages.length === 0 || messages[messages.length - 1].role !== 'user') {
    return res.status(400).json({ error: 'Invalid request' });
  }

  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        max_tokens: 800,
        temperature: 0.3,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages]
      })
    });
    if (!r.ok) {
      console.error('Groq error status', r.status);
      return res.status(502).json({ error: 'Upstream error' });
    }
    const data = await r.json();
    const answer = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!answer) return res.status(502).json({ error: 'Empty response' });
    return res.status(200).json({ answer });
  } catch (e) {
    console.error('Proxy error', e && e.message);
    return res.status(500).json({ error: 'Server error' });
  }
};

function safeParse(s) { try { return JSON.parse(s); } catch (e) { return null; } }
