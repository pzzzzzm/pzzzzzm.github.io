// Monoalphabetic substitution cipher decoder.
//
// Algorithm: simulated annealing with random restarts, scored by trigram
// log-probability. The trigram table is built once from the bundled
// freq_words_en list. Per-word trigrams come from each word wrapped in
// spaces (weighted by 1/log(rank+2)); cross-word trigrams of pattern
// "letter-space-letter" are synthesized from independent word-pair
// probabilities so that real English text doesn't lose ~1/3 of its
// trigrams to the floor.
//
// Each restart:
//   - seeds an initial key by frequency analysis (cipher symbols ordered by
//     occurrence, paired against ETAOIN-SHRDLU)
//   - at each step, swaps two cipher mappings or (with some probability)
//     swaps in a previously-unused plain letter; accepts improvements
//     unconditionally and accepts worse moves with prob exp(delta/T)
//   - cools T exponentially from T0 to T_end across maxIters
//   - tracks best-ever key separately from the random walk
//   - terminates after `staleLimit` steps without improving best-ever
//
// The best result across all restarts is returned.

(function () {
  'use strict';

  const ALL_LETTERS = 'abcdefghijklmnopqrstuvwxyz';
  const FREQ_ORDER = 'etaoinshrdlcumwfgypbvkjxqz';
  const FREQ_ORDER_W_SPACE = ' etaoinshrdlcumwfgypbvkjxqz';

  let _trigramTable = null;

  function buildTrigramTable() {
    if (_trigramTable) return _trigramTable;
    if (typeof freq_words_en === 'undefined') {
      throw new Error('freq_words_en not loaded — load freq_words.js first');
    }
    const counts = new Map();
    const words = Object.keys(freq_words_en);

    // Per-word pass: trigrams within ' word ', and accumulators for the
    // first/last letter weights used to synthesize cross-word trigrams.
    const lastLetterW = new Map();   // weight of words ending in each letter
    const firstLetterW = new Map();  // weight of words starting with each letter
    let totalWordWeight = 0;
    for (let r = 0; r < words.length; r++) {
      const word = words[r];
      if (!word) continue;
      const weight = 1 / Math.log(r + 2);
      const w = ' ' + word + ' ';
      const lim = w.length - 2;
      for (let i = 0; i < lim; i++) {
        const tg = w.substr(i, 3);
        counts.set(tg, (counts.get(tg) || 0) + weight);
      }
      const first = word[0];
      const last = word[word.length - 1];
      firstLetterW.set(first, (firstLetterW.get(first) || 0) + weight);
      lastLetterW.set(last, (lastLetterW.get(last) || 0) + weight);
      totalWordWeight += weight;
    }

    // Cross-word "letter-space-letter" trigrams. Under an independent
    // word-pair model, P(w1 then w2) ≈ weight(w1)*weight(w2)/Z. Aggregating
    // by last/first letter gives the synthetic count below. This brings
    // trigrams like "e o" (be|or), "r n" (or|not), "s t" (is|the) into the
    // table so they no longer fall to floor on real English.
    if (totalWordWeight > 0) {
      for (const [c1, w1] of lastLetterW) {
        for (const [c2, w2] of firstLetterW) {
          const tg = c1 + ' ' + c2;
          counts.set(tg, (counts.get(tg) || 0) + (w1 * w2) / totalWordWeight);
        }
      }
    }

    let total = 0;
    for (const v of counts.values()) total += v;
    const logProb = new Map();
    let minLp = Infinity;
    for (const [k, v] of counts) {
      const lp = Math.log(v / total);
      logProb.set(k, lp);
      if (lp < minLp) minLp = lp;
    }
    // Floor: unseen trigram is treated as ~100x rarer than the rarest seen.
    const floor = minLp - Math.log(100);
    // Build rank lookup so word-bonus can taper by frequency: matches on
    // "the"/"to" carry far more evidence than matches on long-tail dict
    // entries like "ti"/"sol"/"sons", which otherwise let the search
    // settle for plausible-looking but wrong decodings.
    const wordRank = new Map();
    for (let i = 0; i < words.length; i++) {
      wordRank.set(words[i], i);
    }
    _trigramTable = { logProb, floor, wordRank };
    return _trigramTable;
  }

  // Strip everything except a-z and spaces, then collapse runs of spaces.
  // Done once before scoring so trigrams containing punctuation/digits don't
  // contribute meaningless floor penalties.
  function normalizeForScoring(text) {
    return text.toLowerCase().replace(/[^a-z ]+/g, ' ').replace(/ +/g, ' ').trim();
  }

  // Bonus per dictionary-matched word. Tapers by both rank and length:
  //   rarity = log10(2000 / (rank+10)), clamped at 0
  // → "the"(rank 1) ≈ 2.26, "question"(~497) ≈ 0.6, "se"(2052) ≈ 0,
  //    "sol"(7471) → 0.
  // Multiplied by min(len, 8) and a global scale so total bonus dominates
  // trigram noise on short texts but stays in proportion on long ones.
  const WORD_BONUS_SCALE = 5.0;
  function wordBonus(rank, len) {
    if (rank === undefined) return 0;
    const rarity = Math.log10(2000 / (rank + 10));
    if (rarity <= 0) return 0;
    return Math.min(len, 8) * rarity * WORD_BONUS_SCALE;
  }

  function scoreText(text, table) {
    let s = 0;
    const lim = text.length - 2;
    for (let i = 0; i < lim; i++) {
      const lp = table.logProb.get(text.substr(i, 3));
      s += (lp !== undefined ? lp : table.floor);
    }
    if (table.wordRank) {
      const tokens = text.split(' ');
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i];
        if (t.length >= 2) {
          s += wordBonus(table.wordRank.get(t), t.length);
        }
      }
    }
    return s;
  }

  function getPlainAlphabet(opts) {
    return opts.includeSpaces ? ALL_LETTERS + ' ' : ALL_LETTERS;
  }

  function getFreqOrder(opts) {
    return opts.includeSpaces ? FREQ_ORDER_W_SPACE : FREQ_ORDER;
  }

  // Decide which distinct symbols in the ciphertext should be treated as
  // cipher (i.e., get substituted by the key). Letters always count; spaces
  // and other non-alphanumeric symbols count only if the matching option
  // is enabled.
  function extractCipherAlphabet(text, opts) {
    const set = new Set();
    for (const c of text) {
      if (/[a-z]/i.test(c)) {
        set.add(c.toLowerCase());
      } else if (opts.includeSpaces && /\s/.test(c)) {
        set.add(' ');
      } else if (opts.includePunct && /[^\sa-z]/i.test(c)) {
        set.add(c);
      }
    }
    return Array.from(set);
  }

  function capCipherAlphabet(cipherAlphabet, text, plainSize) {
    if (cipherAlphabet.length <= plainSize) return cipherAlphabet;
    const freq = new Map();
    const lc = text.toLowerCase();
    for (const c of lc) {
      if (cipherAlphabet.indexOf(c) !== -1) {
        freq.set(c, (freq.get(c) || 0) + 1);
      }
    }
    return cipherAlphabet
      .slice()
      .sort((a, b) => (freq.get(b) || 0) - (freq.get(a) || 0))
      .slice(0, plainSize);
  }

  // Apply a key (object cipherSymbol -> plainSymbol) to text. Symbols not
  // in the key pass through unchanged. Letter case in the input is
  // preserved: if the ciphertext char was uppercase, the plaintext char
  // is uppercased.
  function decrypt(text, key) {
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const lo = c.toLowerCase();
      if (key[lo] !== undefined) {
        const p = key[lo];
        out += (c !== lo) ? p.toUpperCase() : p;
      } else if (key[c] !== undefined) {
        out += key[c];
      } else {
        out += c;
      }
    }
    return out;
  }

  function initKeyByFrequency(text, cipherAlphabet, opts) {
    const freq = new Map();
    const lc = text.toLowerCase();
    for (const c of lc) {
      if (cipherAlphabet.indexOf(c) !== -1) {
        freq.set(c, (freq.get(c) || 0) + 1);
      }
    }
    const sorted = cipherAlphabet.slice().sort(
      (a, b) => (freq.get(b) || 0) - (freq.get(a) || 0)
    );
    const freqOrder = getFreqOrder(opts);
    const key = {};
    for (let i = 0; i < sorted.length; i++) {
      key[sorted[i]] = freqOrder[i];
    }
    return key;
  }

  function getUnusedPlainLetters(key, plainAlphabet) {
    const used = new Set(Object.values(key));
    const unused = [];
    for (const c of plainAlphabet) if (!used.has(c)) unused.push(c);
    return unused;
  }

  function mutateKey(key, cipherAlphabet, plainAlphabet, introRate) {
    const newKey = Object.assign({}, key);
    const unused = getUnusedPlainLetters(newKey, plainAlphabet);
    // With probability `introRate`, replace one cipher mapping with an
    // unused plain letter. Otherwise swap two cipher mappings. The intro
    // branch is the only way to recover from frequency-init placing a
    // plain letter that doesn't actually appear in the ciphertext.
    if (unused.length > 0 && Math.random() < introRate) {
      const i = Math.floor(Math.random() * cipherAlphabet.length);
      const newLetter = unused[Math.floor(Math.random() * unused.length)];
      newKey[cipherAlphabet[i]] = newLetter;
    } else {
      const n = cipherAlphabet.length;
      let i = Math.floor(Math.random() * n);
      let j = Math.floor(Math.random() * (n - 1));
      if (j >= i) j++;
      const a = cipherAlphabet[i], b = cipherAlphabet[j];
      const tmp = newKey[a];
      newKey[a] = newKey[b];
      newKey[b] = tmp;
    }
    return newKey;
  }

  function hillClimb(text, cipherAlphabet, plainAlphabet, table, opts, maxIters, staleLimit, perturbations) {
    // Short ciphertexts can't fit the full alphabet from frequency alone,
    // so push the intro-unused-letter rate up when there's lots of slack.
    const cipherSize = cipherAlphabet.length;
    const introRate = cipherSize <= 16 ? 0.30 : (cipherSize <= 22 ? 0.20 : 0.12);

    // Simulated annealing: T0 picked so the typical "small mistake" delta
    // (a few log-prob units) has ~30-50% acceptance early, dropping to
    // near-greedy by the end.
    const T0 = 4.0;
    const Tend = 0.05;
    const cooling = Math.pow(Tend / T0, 1 / Math.max(1, maxIters));

    let key = initKeyByFrequency(text, cipherAlphabet, opts);
    // Diversify across restarts: scramble a fraction of the freq-init so
    // we don't keep landing in the same basin. perturbations === 0 keeps
    // the pristine ETAOIN seed (good first guess); higher values push
    // toward random init, which is necessary to escape "letter set"
    // local optima where the active plain letters are all wrong.
    for (let p = 0; p < perturbations; p++) {
      key = mutateKey(key, cipherAlphabet, plainAlphabet, 0.5);
    }
    let scored = normalizeForScoring(decrypt(text, key));
    let score = scoreText(scored, table);
    let bestKey = Object.assign({}, key);
    let bestScore = score;
    let stale = 0;
    let T = T0;

    for (let iter = 0; iter < maxIters; iter++) {
      const newKey = mutateKey(key, cipherAlphabet, plainAlphabet, introRate);
      const newScored = normalizeForScoring(decrypt(text, newKey));
      const newScore = scoreText(newScored, table);
      const delta = newScore - score;
      if (delta > 0 || Math.random() < Math.exp(delta / T)) {
        key = newKey;
        score = newScore;
        if (score > bestScore) {
          bestScore = score;
          bestKey = Object.assign({}, key);
          stale = 0;
        } else {
          stale++;
        }
      } else {
        stale++;
      }
      if (stale >= staleLimit) break;
      T *= cooling;
    }
    return { key: bestKey, score: bestScore };
  }

  // Public entry point. Returns a promise so the caller can `await` it; the
  // function yields to the event loop between restarts to keep the UI alive.
  async function solve(text, opts = {}) {
    if (!text || text.length < 3) {
      return { error: 'ciphertext is too short' };
    }
    const o = {
      includeSpaces: !!opts.includeSpaces,
      includePunct: !!opts.includePunct,
      restarts: opts.restarts ?? 60,
      maxIters: opts.maxIters ?? 4000,
      staleLimit: opts.staleLimit ?? 1200,
      onProgress: opts.onProgress,
    };
    const plainAlphabet = getPlainAlphabet(o);
    let cipherAlphabet = extractCipherAlphabet(text, o);
    cipherAlphabet = capCipherAlphabet(cipherAlphabet, text, plainAlphabet.length);
    if (cipherAlphabet.length < 2) {
      return { error: 'not enough cipher symbols to decode' };
    }
    const table = buildTrigramTable();
    let best = null;
    for (let r = 0; r < o.restarts; r++) {
      // First restart: pure freq-init (best single guess). Subsequent
      // restarts: increasing perturbation so each lands in a different
      // basin. Caps at ~2x cipher size which is roughly fully-randomized.
      const perturbations = r === 0
        ? 0
        : Math.min(2 * cipherAlphabet.length, r * 3);
      const result = hillClimb(
        text, cipherAlphabet, plainAlphabet, table, o,
        o.maxIters, o.staleLimit, perturbations
      );
      if (!best || result.score > best.score) best = result;
      if (o.onProgress) o.onProgress(r + 1, o.restarts, best);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    const decoded = decrypt(text, best.key);
    // Normalize against the cleaned text length so the displayed
    // "per trigram" score matches what the scorer actually iterated over.
    const cleanedLen = normalizeForScoring(decoded).length;
    const normalized = best.score / Math.max(1, cleanedLen - 2);
    return {
      decoded,
      key: best.key,
      score: best.score,
      normalizedScore: normalized,
      cipherAlphabet,
    };
  }

  window.SubstDecoder = {
    solve,
    buildTrigramTable,
    decrypt,
    scoreText,
  };
})();
