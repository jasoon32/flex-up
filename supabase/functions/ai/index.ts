// Flex Up Pro — AI coach. One Supabase Edge Function for every AI feature, so the Gemini key
// stays on the server and every request counts toward the person's daily cap.
//
// Deploy:   npx supabase functions deploy ai --no-verify-jwt   (it checks the user itself)
// Secret:   npx supabase secrets set GEMINI_API_KEY=...   (from https://aistudio.google.com/apikey)
// Optional: GEMINI_MODEL (model id to try first), AI_DAILY_LIMIT (default 20)
//
// Only workout numbers and exercise names are sent to Google: no names, emails or body weight.

import { createClient } from 'npm:@supabase/supabase-js@2';

type Kind = 'recap' | 'swap' | 'plateau' | 'weekly';
type Lang = 'en' | 'zh';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const DAILY_LIMIT = Number(Deno.env.get('AI_DAILY_LIMIT') ?? 20);
/** Tried in order; the next one is used only when a model id doesn't exist (404). */
const MODELS = [Deno.env.get('GEMINI_MODEL'), 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-2.5-flash'].filter(
  (m): m is string => !!m,
);

const PERSONA = (lang: Lang) =>
  [
    'You are the coach inside Flex Up, a pixel-art gym tracker. Personality: a hype friend who trains with the user.',
    'Upbeat, warm and specific, but never cheesy or over the top. Talk to the user as "you".',
    'Use only facts from the data you are given; never invent numbers, exercises or dates.',
    'No emoji, no hashtags, no markdown. Plain short sentences.',
    'Give training tips only; no medical, injury or diet advice.',
    lang === 'zh'
      ? 'Write everything in Simplified Chinese (简体中文). Keep exercise names exactly as given.'
      : 'Write in English. Keep exercise names exactly as given.',
  ].join('\n');

const S = { type: 'STRING' };

const TASKS: Record<Kind, { prompt: string; schema: Record<string, unknown> }> = {
  recap: {
    prompt:
      'Write the note shown right after this workout. One or two short sentences, at most 45 words in total. ' +
      'Mention one concrete thing that went up compared with last time (from "last") or a record from "records" if there is one. ' +
      'If nothing improved, praise the consistency instead.',
    schema: { type: 'OBJECT', properties: { text: S }, required: ['text'] },
  },
  swap: {
    prompt:
      'The user cannot do "exercise" right now (the machine is busy or missing). From "candidates" ONLY, pick the 3 best ' +
      'replacements that train the same muscles with a similar movement. Do not pick anything in "inWorkout". ' +
      'For each, "why" is at most 8 words. Copy each name exactly as written in candidates.',
    schema: {
      type: 'OBJECT',
      properties: {
        options: {
          type: 'ARRAY',
          items: { type: 'OBJECT', properties: { name: S, why: S }, required: ['name', 'why'] },
        },
      },
      required: ['options'],
    },
  },
  plateau: {
    prompt:
      'This lift has not improved for at least 3 weeks ("history" is the best set of each workout, oldest first). ' +
      'Give ONE practical, specific fix in at most 35 words, for example a 10% deload then build back, a different rep range, ' +
      'an extra set, a variation, or more rest between sets. Encourage, do not scold.',
    schema: { type: 'OBJECT', properties: { tip: S }, required: ['tip'] },
  },
  weekly: {
    prompt:
      "Write this week's report card. title: at most 6 words. highlights: exactly 3 items, each at most 14 words, " +
      'drawn from the data (workouts vs planned, records, volume vs last week, streak, muscle sets). ' +
      'focus: one thing to aim for next week, at most 20 words; use "stuck" lifts or under-trained muscles if any.',
    schema: {
      type: 'OBJECT',
      properties: { title: S, highlights: { type: 'ARRAY', items: S }, focus: S },
      required: ['title', 'highlights', 'focus'],
    },
  },
};

/** Strips emoji and stray markdown in case the model ignores the rules. */
const clean = (s: unknown, max = 400) =>
  String(s ?? '')
    .replace(/\p{Extended_Pictographic}|\uFE0F|\u200D/gu, '')
    .replace(/[*_#`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

class Busy extends Error {}

async function gemini(kind: Kind, lang: Lang, data: unknown): Promise<any> {
  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const task = TASKS[kind];
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: PERSONA(lang) }] },
    contents: [{ role: 'user', parts: [{ text: `${task.prompt}\n\nData (JSON):\n${JSON.stringify(data)}` }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: task.schema,
      temperature: 0.8,
      maxOutputTokens: 2048,
    },
  });

  let lastError = 'no model available';
  for (const model of MODELS) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body,
    });
    if (res.status === 404) {
      lastError = `model ${model} not found`;
      continue;
    }
    if (res.status === 429 || res.status === 503) throw new Busy();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const out = await res.json();
    const parts: any[] = out?.candidates?.[0]?.content?.parts ?? [];
    const text = parts
      .filter((p) => !p.thought && typeof p.text === 'string')
      .map((p) => p.text)
      .join('');
    return JSON.parse(text);
  }
  throw new Error(lastError);
}

/** Keeps only what the app expects, in the shape it expects. */
function shape(kind: Kind, out: any, data: any) {
  switch (kind) {
    case 'recap':
      return { text: clean(out?.text, 300) };
    case 'plateau':
      return { tip: clean(out?.tip, 300) };
    case 'weekly':
      return {
        title: clean(out?.title, 60),
        highlights: (Array.isArray(out?.highlights) ? out.highlights : [])
          .slice(0, 3)
          .map((h: unknown) => clean(h, 120)),
        focus: clean(out?.focus, 160),
      };
    case 'swap': {
      const allowed = new Set<string>((data?.candidates ?? []).map(String));
      const skip = new Set<string>([data?.exercise, ...(data?.inWorkout ?? [])].map(String));
      const seen = new Set<string>();
      const options = (Array.isArray(out?.options) ? out.options : [])
        .map((o: any) => ({ name: String(o?.name ?? '').trim(), why: clean(o?.why, 80) }))
        .filter(
          (o: { name: string }) => allowed.has(o.name) && !skip.has(o.name) && !seen.has(o.name) && seen.add(o.name),
        )
        .slice(0, 3);
      return { options };
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);

  const auth = req.headers.get('Authorization') ?? '';
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  });
  const { data: user } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ''));
  if (!user?.user) return json({ error: 'auth' }, 401);

  let input: { kind?: Kind; lang?: Lang; data?: unknown };
  try {
    input = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }
  const kind = input.kind;
  if (!kind || !(kind in TASKS)) return json({ error: 'bad_request' }, 400);
  const lang: Lang = input.lang === 'zh' ? 'zh' : 'en';
  if (JSON.stringify(input.data ?? null).length > 8000) return json({ error: 'too_big' }, 413);

  const { data: used, error: capError } = await supabase.rpc('ai_take');
  if (capError) return json({ error: 'server', detail: capError.message }, 500);
  if (Number(used) > DAILY_LIMIT) return json({ error: 'limit', limit: DAILY_LIMIT }, 429);

  try {
    const out = await gemini(kind, lang, input.data);
    return json({ ...shape(kind, out, input.data), left: Math.max(0, DAILY_LIMIT - Number(used)) });
  } catch (e) {
    if (e instanceof Busy) return json({ error: 'busy' }, 429);
    console.error(e);
    return json({ error: 'server' }, 502);
  }
});
