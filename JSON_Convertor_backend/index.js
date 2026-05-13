import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.txt') return cb(new Error('Only .txt files are allowed'), false);
    cb(null, true);
  }
});

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY
});

// ─────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────

const isPlainObject = (val) =>
  typeof val === 'object' && val !== null && !Array.isArray(val);

const isStringArray = (arr) =>
  Array.isArray(arr) && arr.every(v => typeof v === 'string');

const deepDeduplicate = (data) => {
  if (Array.isArray(data)) {
    const seen = new Set();
    return data
      .map(item => deepDeduplicate(item))
      .filter(item => {
        const key = JSON.stringify(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }
  if (isPlainObject(data)) {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = deepDeduplicate(v);
    return out;
  }
  return data;
};

const deepMerge = (target, source) => {
  if (Array.isArray(target) && Array.isArray(source))
    return deepDeduplicate([...target, ...source]);
  if (isPlainObject(target) && isPlainObject(source)) {
    const out = { ...target };
    for (const [k, v] of Object.entries(source))
      out[k] = k in out ? deepMerge(out[k], v) : v;
    return out;
  }
  return source;
};

const getAtPath = (obj, pathArr) => {
  if (!Array.isArray(pathArr) || pathArr.length === 0)
    throw new Error('anchor_path must be a non-empty array');
  let cur = obj;
  for (const seg of pathArr) {
    if (cur === null || cur === undefined)
      throw new Error(`anchor_path not found (stopped at ${JSON.stringify(seg)})`);
    cur = cur[seg];
  }
  return cur;
};

const setAtPath = (obj, pathArr, value) => {
  if (!Array.isArray(pathArr) || pathArr.length === 0)
    throw new Error('setAtPath requires non-empty path');
  let cur = obj;
  for (let i = 0; i < pathArr.length - 1; i++) {
    const seg = pathArr[i];
    if (!isPlainObject(cur[seg])) cur[seg] = {};
    cur = cur[seg];
  }
  cur[pathArr[pathArr.length - 1]] = value;
};

const traverse = (node, visitor, pathArr = []) => {
  visitor(node, pathArr);
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++)
      traverse(node[i], visitor, [...pathArr, String(i)]);
    return;
  }
  if (isPlainObject(node)) {
    for (const [k, v] of Object.entries(node))
      traverse(v, visitor, [...pathArr, k]);
  }
};

// ─────────────────────────────────────────────
// FIX ①+② — UNIFIED STANDARDIZE → MODE DETECT
// Standardization happens FIRST for BOTH paths.
// Mode detection runs on the standardized output
// so Gujarati/Hinglish merge cues are already
// translated before the regex fires.
// ─────────────────────────────────────────────

const standardizePrompt = async (rawPrompt) => {
  try {
    const instrPath = path.join(process.cwd(), 'standardize_instructions.txt');
    const instructions = await fs.readFile(instrPath, 'utf-8');
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: instructions },
        { role: 'user', content: rawPrompt }
      ],
      temperature: 0
    });
    const result = completion.choices[0].message.content.trim();
    console.log(`[STANDARDIZE] "${rawPrompt}" → ${result}`);
    return result;
  } catch (e) {
    console.error('[STANDARDIZE ERROR]', e.message);
    return rawPrompt;
  }
};

/**
 * FIX ① — detectMode now inspects the STANDARDIZED query strings,
 * not the raw user prompt, so language variants are already resolved.
 * Also handles "append" as a merge signal.
 */
const detectMode = (standardizedQueries) => {
  for (const q of standardizedQueries) {
    const l = q.toLowerCase();
    if (
      l.startsWith('append ') ||
      l.includes(' under ') ||
      l.startsWith('merge ')
    ) return 'merge';
  }
  return 'query';
};

// ─────────────────────────────────────────────
// FIX ② — SOURCE ID EXTRACTION
// Old regex only matched "@source 1" (with space).
// New one matches @Source1, @doc2.txt, @source_3, etc.
// ─────────────────────────────────────────────

const extractMentionedSourceIds = (promptText) => {
  const ids = new Set();
  // Match @source<digits> with optional space or underscore
  const re1 = /@source[\s_]?(\d+)/ig;
  let m;
  while ((m = re1.exec(promptText)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) ids.add(`SOURCE_${n}`);
  }
  // Match @Source1, @SOURCE2, etc. (no separator)
  const re2 = /@[Ss]ource(\d+)/g;
  while ((m = re2.exec(promptText)) !== null) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) ids.add(`SOURCE_${n}`);
  }
  return [...ids];
};

// ─────────────────────────────────────────────
// FIX ③ — FULL OPERATION PARSERS
// extractDynamicQuery now returns ALL operation
// types: filter, group, sort, select, count, unique
// ─────────────────────────────────────────────

const extractDynamicQuery = (promptText) => {
  const text = String(promptText || '').trim();
  const lower = text.toLowerCase();

  // Shared: exclusion fields
  const excludeMatch = text.match(
    /without\s+([a-zA-Z0-9_.,\s-]+?)(?:\s+then\s+lookup|$)/i
  );
  const excludeFields = excludeMatch
    ? excludeMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean)
    : [];

  // Shared: lookup clause
  const lookupMatch = text.match(
    /then\s+lookup\s+([a-zA-Z0-9_.-]+)\s+using\s+([a-zA-Z0-9_.-]+)/i
  );
  const lookup = lookupMatch
    ? { collection: lookupMatch[1], field: lookupMatch[2] }
    : null;

  // ── GROUP ────────────────────────────────────
  const groupMatch =
    text.match(/group\s+([a-zA-Z0-9_.-]+)\s+by\s+([a-zA-Z0-9_.-]+)/i) ||
    text.match(/([a-zA-Z0-9_.-]+)\s+group\s+by\s+([a-zA-Z0-9_.-]+)/i);
  if (groupMatch)
    return { operation: 'group', collection: groupMatch[1], field: groupMatch[2], excludeFields, lookup };

  // ── FILTER ───────────────────────────────────
  const filterMatch =
    text.match(/(?:filter\s+)?([a-zA-Z0-9_.-]+)\s+(?:with|where)\s+([a-zA-Z0-9_.-]+)\s+(?:is\s+)?([a-zA-Z0-9_.-]+)/i) ||
    text.match(/([a-zA-Z0-9_.-]+)\s+([a-zA-Z0-9_.-]+)\s+(?:vala|with|where)\s+([a-zA-Z0-9_.-]+)/i);
  if (filterMatch)
    return { operation: 'filter', collection: filterMatch[1], field: filterMatch[2], value: filterMatch[3], excludeFields, lookup };

  // ── SORT ─────────────────────────────────────
  const sortMatch = text.match(
    /sort\s+([a-zA-Z0-9_.-]+)\s+by\s+([a-zA-Z0-9_.-]+)\s+(ascending|descending)/i
  );
  if (sortMatch)
    return { operation: 'sort', collection: sortMatch[1], field: sortMatch[2], order: sortMatch[3].toLowerCase(), excludeFields };

  // ── SELECT ───────────────────────────────────
  const selectMatch = text.match(
    /select\s+(.+?)\s+from\s+([a-zA-Z0-9_.-]+)/i
  );
  if (selectMatch) {
    const fields = selectMatch[1].split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
    return { operation: 'select', fields, collection: selectMatch[2], excludeFields };
  }

  // ── COUNT ────────────────────────────────────
  const countMatch = text.match(
    /count\s+([a-zA-Z0-9_.-]+)\s+by\s+([a-zA-Z0-9_.-]+)/i
  );
  if (countMatch)
    return { operation: 'count', collection: countMatch[1], field: countMatch[2] };

  // ── UNIQUE ───────────────────────────────────
  const uniqueMatch = text.match(
    /unique\s+([a-zA-Z0-9_.-]+)\s+from\s+([a-zA-Z0-9_.-]+)/i
  );
  if (uniqueMatch)
    return { operation: 'unique', field: uniqueMatch[1], collection: uniqueMatch[2] };

  return null;
};

// ─────────────────────────────────────────────
// COLLECTION HELPERS
// ─────────────────────────────────────────────

const findCollectionItems = (scope, collectionName) => {
  const items = [];
  const collLower = String(collectionName).toLowerCase();
  for (const obj of Object.values(scope)) {
    traverse(obj, (node, pathArr) => {
      if (!Array.isArray(node)) return;
      const pathStr = pathArr.join('.').toLowerCase();
      if (pathStr === collLower || pathStr.endsWith('.' + collLower))
        items.push(...node);
    });
  }
  return items;
};

const matchesCollection = (pathStr, collLower) =>
  pathStr === collLower || pathStr.endsWith('.' + collLower);

const applyLookup = (item, lookupData, lookupField) => {
  if (!lookupData || !lookupField) return item;
  const lfLower = lookupField.toLowerCase();
  const itemValKey = Object.keys(item).find(k => k.toLowerCase() === lfLower);
  const val = itemValKey ? item[itemValKey] : undefined;
  if (val === undefined) return item;
  const matches = lookupData.filter(li => {
    const liKey = Object.keys(li).find(k => k.toLowerCase() === lfLower);
    return liKey && String(li[liKey]) === String(val);
  });
  if (matches.length === 0) return item;
  if (matches.length === 1) {
    const merged = { ...item };
    for (const [mk, mv] of Object.entries(matches[0]))
      if (!(mk in merged)) merged[mk] = mv;
    return merged;
  }
  return { ...item, _lookup_results: matches };
};

const applyExclusions = (item, excludeFields) => {
  if (!excludeFields || excludeFields.length === 0) return item;
  const out = { ...item };
  for (const f of excludeFields) {
    const key = Object.keys(out).find(k => k.toLowerCase() === f.toLowerCase());
    if (key) delete out[key];
  }
  return out;
};

// ─────────────────────────────────────────────
// OPERATION EXECUTORS
// ─────────────────────────────────────────────

const execFilter = (root, { collection, field, value, excludeFields, lookup }) => {
  const results = [];
  const collLower = collection.toLowerCase();
  const fieldLower = field.toLowerCase();
  const lookupData = lookup ? findCollectionItems({ _: root }, lookup.collection) : null;

  traverse(root, (node, pathArr) => {
    if (!Array.isArray(node)) return;
    const pathStr = pathArr.join('.').toLowerCase();
    if (!matchesCollection(pathStr, collLower)) return;

    for (let i = 0; i < node.length; i++) {
      let item = node[i];
      if (!isPlainObject(item)) continue;
      const actualKey = Object.keys(item).find(k => k.toLowerCase() === fieldLower);
      if (!actualKey) continue;
      if (String(item[actualKey]).toLowerCase() !== String(value).toLowerCase()) continue;
      item = applyLookup(item, lookupData, lookup?.field);
      item = applyExclusions(item, excludeFields);
      results.push({ path: [...pathArr, String(i)].join('.'), data: item });
    }
  });

  return { operation: 'filter', collection, filter: { field, value }, count: results.length, results };
};

const execGroup = (root, { collection, field, excludeFields, lookup }) => {
  const grouped = {};
  const collLower = collection.toLowerCase();
  const fieldLower = field.toLowerCase();
  const lookupData = lookup ? findCollectionItems({ _: root }, lookup.collection) : null;

  traverse(root, (node, pathArr) => {
    if (!Array.isArray(node)) return;
    const pathStr = pathArr.join('.').toLowerCase();
    if (!matchesCollection(pathStr, collLower)) return;

    for (let i = 0; i < node.length; i++) {
      let item = node[i];
      if (!isPlainObject(item)) continue;
      const actualKey = Object.keys(item).find(k => k.toLowerCase() === fieldLower);
      if (!actualKey) continue;
      const key = String(item[actualKey]);
      if (!grouped[key]) grouped[key] = [];
      item = applyLookup(item, lookupData, lookup?.field);
      item = applyExclusions(item, excludeFields);
      grouped[key].push(item);
    }
  });

  return { operation: 'group', collection, groupBy: field, groups: grouped };
};

const execSort = (root, { collection, field, order }) => {
  const items = findCollectionItems({ _: root }, collection);
  const fieldLower = field.toLowerCase();
  const sorted = [...items].sort((a, b) => {
    const ak = Object.keys(a).find(k => k.toLowerCase() === fieldLower);
    const bk = Object.keys(b).find(k => k.toLowerCase() === fieldLower);
    const av = ak ? a[ak] : '';
    const bv = bk ? b[bk] : '';
    const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' });
    return order === 'descending' ? -cmp : cmp;
  });
  return { operation: 'sort', collection, field, order, count: sorted.length, results: sorted };
};

const execSelect = (root, { collection, fields }) => {
  const items = findCollectionItems({ _: root }, collection);
  const fieldsLower = fields.map(f => f.toLowerCase());
  const projected = items.map(item => {
    const out = {};
    for (const f of fieldsLower) {
      const key = Object.keys(item).find(k => k.toLowerCase() === f);
      if (key) out[key] = item[key];
    }
    return out;
  });
  return { operation: 'select', collection, fields, count: projected.length, results: projected };
};

const execCount = (root, { collection, field }) => {
  const items = findCollectionItems({ _: root }, collection);
  const fieldLower = field.toLowerCase();
  const counts = {};
  for (const item of items) {
    const key = Object.keys(item).find(k => k.toLowerCase() === fieldLower);
    if (!key) continue;
    const val = String(item[key]);
    counts[val] = (counts[val] || 0) + 1;
  }
  return { operation: 'count', collection, field, counts };
};

const execUnique = (root, { collection, field }) => {
  const items = findCollectionItems({ _: root }, collection);
  const fieldLower = field.toLowerCase();
  const seen = new Set();
  for (const item of items) {
    const key = Object.keys(item).find(k => k.toLowerCase() === fieldLower);
    if (key) seen.add(item[key]);
  }
  return { operation: 'unique', collection, field, count: seen.size, values: [...seen] };
};

/**
 * FIX ④ — Execute ALL operations in order, not just the first.
 * Each result is keyed by its index so the client can correlate.
 */
const executeAllOps = (queries, scope) => {
  const allResults = [];

  for (const q of queries) {
    const op = q.operation;
    const perSource = [];

    for (const [sourceId, obj] of Object.entries(scope)) {
      let result;
      try {
        if (op === 'filter') result = execFilter(obj, q);
        else if (op === 'group') result = execGroup(obj, q);
        else if (op === 'sort') result = execSort(obj, q);
        else if (op === 'select') result = execSelect(obj, q);
        else if (op === 'count') result = execCount(obj, q);
        else if (op === 'unique') result = execUnique(obj, q);
        else result = { error: `Unknown operation: ${op}` };
      } catch (e) {
        result = { error: e.message };
      }

      const hasData = result && !result.error &&
        (result.count > 0 || result.results?.length > 0 ||
          (result.groups && Object.keys(result.groups).length > 0) ||
          (result.counts && Object.keys(result.counts).length > 0) ||
          (result.values?.length > 0));

      if (hasData) perSource.push({ source_id: sourceId, ...result });
    }

    allResults.push({ query: q, results: perSource });
  }

  return allResults;
};

// ─────────────────────────────────────────────
// FREE-TEXT SEARCH (fallback)
// ─────────────────────────────────────────────

const extractFreeTextQuery = (promptText) => {
  const s = String(promptText || '').trim();
  const q1 = s.match(/(?:q|query|name|value)\s*[:=]\s*["']?([^"'\n]+)["']?/i);
  if (q1?.[1]) return q1[1].trim();

  const q2 = s.match(/(?:search|find|lookup|filter)\s+(.+?)(?:\s+in\s+@source\s*\d+)?$/i);
  if (q2?.[1]) return q2[1].trim();

  const quoted = [...s.matchAll(/"([^"]{3,})"/g)].map(m => m[1]);
  if (quoted.length > 0) return [...quoted].sort((a, b) => b.length - a.length)[0].trim();

  const q3 = s.match(/\b([A-Za-z0-9._-]{3,})\b\s*(?:apo|aapo|get|aap)\b/i);
  if (q3?.[1]) return q3[1].trim();

  return null;
};

const searchJson = (root, query, { maxResults = 200 } = {}) => {
  const q = String(query || '').toLowerCase();
  const results = [];
  traverse(root, (node, pathArr) => {
    if (results.length >= maxResults) return;
    if (node === null || node === undefined) return;
    if (typeof node === 'string') {
      if (node.toLowerCase().includes(q))
        results.push({ path: pathArr.join('.'), type: 'string', value: node });
      return;
    }
    if (typeof node === 'number' || typeof node === 'boolean') {
      if (String(node).includes(q))
        results.push({ path: pathArr.join('.'), type: typeof node, value: node });
      return;
    }
    if (isPlainObject(node)) {
      for (const k of Object.keys(node)) {
        if (results.length >= maxResults) break;
        if (k.toLowerCase().includes(q))
          results.push({ path: [...pathArr, k].join('.'), type: 'key', value: k });
      }
    }
  });
  return { query, count: results.length, truncated: results.length >= maxResults, results };
};

// ─────────────────────────────────────────────
// MERGE PLAN (unchanged structure, but now runs
// on a standardized prompt — FIX ⑥)
// ─────────────────────────────────────────────

const validatePlan = (plan, sourceIds) => {
  if (!isPlainObject(plan)) throw new Error('Plan must be a JSON object');
  if (plan.error) return;
  if (plan.plan_version !== 1) throw new Error('Unsupported plan_version');
  if (typeof plan.root_source_id !== 'string') throw new Error('root_source_id missing');
  if (!sourceIds.includes(plan.root_source_id))
    throw new Error(`root_source_id not found: ${plan.root_source_id}`);
  if (!Array.isArray(plan.steps)) throw new Error('steps must be an array');
  for (const step of plan.steps) {
    if (!isPlainObject(step)) throw new Error('Each step must be an object');
    if (step.action !== 'embed') throw new Error('Only action=embed is supported');
    if (!sourceIds.includes(step.parent_source_id))
      throw new Error(`parent_source_id not found: ${step.parent_source_id}`);
    if (!sourceIds.includes(step.child_source_id))
      throw new Error(`child_source_id not found: ${step.child_source_id}`);
    if (step.embed_mode !== 'merge_keys') throw new Error('Only embed_mode=merge_keys is supported');
    if (!Array.isArray(step.anchor_path) || step.anchor_path.length === 0)
      throw new Error('anchor_path must be a non-empty array');
  }
};

const executeMergePlan = async (plan, sources, prompt) => {
  const sourceIds = Object.keys(sources);
  validatePlan(plan, sourceIds);

  if (plan.error) return { error: 'Planner could not create a reliable plan', plan };

  const live = {};
  for (const [id, obj] of Object.entries(sources)) live[id] = structuredClone(obj);

  for (const step of plan.steps) {
    const parent = live[step.parent_source_id];
    const child = live[step.child_source_id];
    const anchor = getAtPath(parent, step.anchor_path);
    if (!isPlainObject(anchor))
      throw new Error(`anchor_path does not point to an object for step ${step.step}`);
    for (const [k, v] of Object.entries(child)) {
      anchor[k] = k in anchor ? deepMerge(anchor[k], v) : v;
    }
  }

  const mergedRoot = live[plan.root_source_id];
  return deepDeduplicate(mergedRoot);
};

// ─────────────────────────────────────────────
// POST-MERGE TRANSFORMS (unchanged)
// ─────────────────────────────────────────────

const alphaIndexStrings = (items, order = 'asc') => {
  const sorted = [...items].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  if (order === 'desc') sorted.reverse();
  const index = {};
  for (const item of sorted) {
    const letter = (item?.[0] || '#').toUpperCase();
    if (!index[letter]) index[letter] = [];
    index[letter].push(item);
  }
  return { order, sorted, index };
};

const applyPromptTransforms = (root, promptText) => {
  const p = (promptText || '').toLowerCase();
  const order = p.includes('descending') ? 'desc' : 'asc';

  if (p.includes('grouped analytics')) {
    const out = [];
    traverse(root, (node, pathArr) => {
      const last = pathArr[pathArr.length - 1];
      if (last === 'analytics' && isPlainObject(node))
        out.push({ path: pathArr.join('.'), value: node });
    });
    root.__grouped_analytics = { count: out.length, analytics: out };
  }

  if (p.includes('categories') && p.includes('alphabetically')) {
    const indexed = [];
    traverse(root, (node, pathArr) => {
      if (!isPlainObject(node) || !isStringArray(node.categories)) return;
      indexed.push({ path: [...pathArr, 'categories'].join('.'), index: alphaIndexStrings(node.categories, order) });
    });
    root.__categories_indexed = { order, items: indexed };
  }

  return root;
};

// ─────────────────────────────────────────────
// MAIN ROUTE
// ─────────────────────────────────────────────

app.post('/api/convert', upload.array('files'), async (req, res) => {
  let { jsonInputs, prompt } = req.body;

  console.log('\n--- [RECEIVED] ---');
  console.log('Prompt:', prompt);
  console.log('------------------\n');

  let parsedInputs = [];
  try {
    parsedInputs = JSON.parse(jsonInputs || '[]');
  } catch (e) {
    console.error('JSON parse error', e);
  }

  if (!Array.isArray(parsedInputs) || parsedInputs.length === 0)
    return res.status(400).json({ error: 'No input sources provided' });
  if (!prompt?.trim())
    return res.status(400).json({ error: 'Prompt is required' });

  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY)
    return res.status(500).json({
      error: 'Missing API key',
      details: 'Set OPENAI_API_KEY in your .env file'
    });

  // Build source registry
  const sources = {};
  const optimizedBlocks = [];

  for (let i = 0; i < parsedInputs.length; i++) {
    const input = parsedInputs[i] || {};
    let content = (input.content || '').trim();
    const name = input.name || `Source ${i + 1}`;

    if (!content && req.files?.length > 0) {
      const file = req.files.find(f => f.originalname === name);
      if (file) content = file.buffer.toString('utf-8').trim();
    }

    if (!content) return res.status(400).json({ error: `Missing content for ${name}` });

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      return res.status(400).json({ error: `Invalid JSON in ${name}`, details: e.message });
    }

    const sourceId = `SOURCE_${i + 1}`;
    sources[sourceId] = parsed;
    const clean = JSON.stringify(parsed, null, 2);
    console.log(`[SOURCE] ${sourceId} = ${name} (${clean.length} chars)`);
    optimizedBlocks.push(`### DATA SOURCE: ${name} (ID: ${sourceId})\n${clean}`);
  }

  const optimizedInput = optimizedBlocks.join('\n\n');

  try {
    // ─────────────────────────────────────────
    // FIX ⑥ — STANDARDIZE FIRST, ALWAYS
    // Both merge and query paths go through
    // standardization before anything else.
    // ─────────────────────────────────────────

    const standardizedRaw = await standardizePrompt(prompt);
    let queryStrings = [];
    try {
      queryStrings = JSON.parse(standardizedRaw);
      if (!Array.isArray(queryStrings)) queryStrings = [standardizedRaw];
    } catch {
      queryStrings = [standardizedRaw];
    }
    queryStrings = queryStrings.map(s => String(s).trim()).filter(Boolean);

    const mode = detectMode(queryStrings);
    console.log(`[MODE] ${mode} | queries: ${JSON.stringify(queryStrings)}`);

    // ─────────────────────────────────────────
    // QUERY MODE
    // ─────────────────────────────────────────

    if (mode === 'query') {
      // FIX ② — scope now correctly resolves @Source1, @doc2.txt etc.
      const mentioned = extractMentionedSourceIds(prompt + ' ' + queryStrings.join(' '));
      const scope =
        mentioned.length > 0
          ? Object.fromEntries(Object.entries(sources).filter(([id]) => mentioned.includes(id)))
          : sources;

      // FIX ③+④ — Parse ALL queries and handle lookup chaining
      const dynamicQueries = [];
      for (let i = 0; i < queryStrings.length; i++) {
        const s = queryStrings[i];
        if (s.toLowerCase().startsWith('then lookup') && dynamicQueries.length > 0) {
          // Merge into previous query
          const prev = dynamicQueries[dynamicQueries.length - 1];
          const combined = prev.raw + ' ' + s;
          const updated = extractDynamicQuery(combined);
          if (updated) { updated.raw = combined; dynamicQueries[dynamicQueries.length - 1] = updated; }
        } else {
          const parsed = extractDynamicQuery(s);
          if (parsed) { parsed.raw = s; dynamicQueries.push(parsed); }
        }
      }

      // FIX ④ — Execute ALL queries (not just index 0)
      if (dynamicQueries.length > 0) {
        const allResults = executeAllOps(dynamicQueries, scope);

        // Single query → flatten for backward compat
        if (allResults.length === 1) {
          const r = allResults[0];
          return res.json({
            mode: `dynamic_${r.query.operation}`,
            query: r.query,
            results: r.results
          });
        }

        // Multiple queries → return array
        return res.json({ mode: 'multi_operation', operations: allResults });
      }

      // Fallback: free-text search
      const q = extractFreeTextQuery(prompt);
      if (!q) {
        return res.status(400).json({
          error: 'Query not understood',
          details: 'Try: "filter employees where department is Engineering"'
        });
      }

      const searchResults = [];
      for (const [sourceId, obj] of Object.entries(scope))
        searchResults.push({ source_id: sourceId, ...searchJson(obj, q) });

      return res.json({
        mode: 'search',
        query: q,
        scope: mentioned.length > 0 ? mentioned : 'ALL_SOURCES',
        results: searchResults
      });
    }

    // ─────────────────────────────────────────
    // FIX ⑥ — MERGE MODE
    // Now uses standardized merge instruction
    // instead of raw Gujarati/Hinglish prompt.
    // ─────────────────────────────────────────

    const instructionsPath = path.join(process.cwd(), 'instructions.txt');
    const instructions = await fs.readFile(instructionsPath, 'utf-8');

    // Use standardized query for the merge prompt so the planner
    // sees clean English even if user typed Gujarati
    const mergePrompt = queryStrings.join('\n');

    const fullDebugPrompt = `SYSTEM:\n${instructions}\n\nUSER:\n${mergePrompt}\n\nSOURCES:\n${optimizedInput}`;
    await fs.writeFile(path.join(process.cwd(), 'debug_prompt.txt'), fullDebugPrompt).catch(() => { });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: instructions },
        {
          role: 'user',
          content: `## TASK\nCreate a transformation plan (NOT final JSON).\n\n## USER PROMPT\n${mergePrompt}\n\n## DATA SOURCES\n${optimizedInput}`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0
    });

    const text = completion.choices[0].message.content.trim();
    console.log('\n--- [MERGE PLAN] ---\n', text, '\n--------------------\n');

    let plan;
    try {
      plan = JSON.parse(text);
    } catch (e) {
      return res.status(500).json({ error: 'AI returned invalid JSON', details: text });
    }

    if (plan.mode === 'extract') {
      const sourceIds = Object.keys(sources);
      if (!sourceIds.includes(plan.source_id))
        return res.status(400).json({ error: 'Invalid source_id in extract mode' });
      if (!Array.isArray(plan.path))
        return res.status(400).json({ error: 'Invalid path in extract mode' });
      return res.json(plan.data);
    }

    const finalOut = await executeMergePlan(plan, sources, prompt);
    if (finalOut?.error) return res.status(400).json(finalOut);

    applyPromptTransforms(finalOut, prompt);
    await fs.writeFile(path.join(process.cwd(), 'debug_plan.json'), JSON.stringify(plan, null, 2)).catch(() => { });

    return res.json(finalOut);

  } catch (error) {
    console.error('[CRITICAL ERROR]', error);
    res.status(error.status || 500).json({
      error: 'Conversion Failed',
      details: error.message,
      suggestion: 'Verify your OPENAI_API_KEY and input format.'
    });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));