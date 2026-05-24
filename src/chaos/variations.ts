import type { VariationOptions } from './types.js';

const PREFIXES_CASUAL = [
  'hey ', 'hi ', 'hello ', 'yo ', 'sup ', 'hii ', 'hey there, ',
  'excuse me, ', 'quick question: ', 'umm ', 'so ', 'ok so ',
];

const PREFIXES_FORMAL = [
  'Good morning, ', 'Dear support team, ', 'I would like to inquire: ',
  'Could you please help me with the following: ', 'Greetings. ',
  'I am writing to request: ', 'To whom it may concern, ',
];

const SUFFIXES_CASUAL = [
  '', ' thanks', ' thx', ' pls', ' asap', ' ty', ' plz help',
  ' lol', ' ???', '!!', ' 🙏', ' please help me',
];

const SUFFIXES_FORMAL = [
  '', '. Thank you.', '. I appreciate your help.', '. Kind regards.',
  '. Please advise.', '. Your prompt response would be appreciated.',
];

const REPHRASERS = [
  (s: string) => s,
  (s: string) => s.toUpperCase(),
  (s: string) => s.toLowerCase(),
  (s: string) => s.split(' ').reverse().join(' '),
  (s: string) => s.replace(/\./g, '!'),
  (s: string) => `Can you help me? ${s}`,
  (s: string) => `I need help with this: ${s}`,
  (s: string) => `URGENT: ${s}`,
  (s: string) => `Please: ${s}`,
  (s: string) => `${s} (this is very important)`,
  (s: string) => `${s} - can you do this quickly?`,
  (s: string) => `I was wondering if you could ${s.toLowerCase()}`,
  (s: string) => `My question is: ${s}`,
  (s: string) => `So basically ${s.toLowerCase()}`,
  (s: string) => `${s}\n\nPlease respond as soon as possible.`,
];

function addTypos(text: string): string {
  const words = text.split(' ');
  const typoIdx = Math.floor(Math.random() * words.length);
  const word = words[typoIdx];
  if (word.length < 3) return text;

  const typoTypes = [
    // swap two adjacent chars
    () => {
      const i = Math.floor(Math.random() * (word.length - 1));
      return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
    },
    // double a letter
    () => {
      const i = Math.floor(Math.random() * word.length);
      return word.slice(0, i) + word[i] + word.slice(i);
    },
    // skip a letter
    () => {
      const i = Math.floor(Math.random() * word.length);
      return word.slice(0, i) + word.slice(i + 1);
    },
  ];

  words[typoIdx] = typoTypes[Math.floor(Math.random() * typoTypes.length)]();
  return words.join(' ');
}

/**
 * Generate diverse input variations from a base input string.
 */
export function generateVariations(
  baseInput: string,
  count: number,
  options: VariationOptions = {},
): string[] {
  const diversity = options.diversity ?? 'medium';
  const results: string[] = [];
  const seen = new Set<string>();

  // Always include the original
  results.push(baseInput);
  seen.add(baseInput.toLowerCase());

  let attempts = 0;
  const maxAttempts = count * 5;

  while (results.length < count && attempts < maxAttempts) {
    attempts++;
    let variant: string;

    const strategy = Math.random();

    if (strategy < 0.25) {
      // Prefix + base
      const prefixes = diversity === 'high'
        ? [...PREFIXES_CASUAL, ...PREFIXES_FORMAL]
        : PREFIXES_CASUAL;
      const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
      variant = prefix + baseInput;
    } else if (strategy < 0.45) {
      // Base + suffix
      const suffixes = diversity === 'high'
        ? [...SUFFIXES_CASUAL, ...SUFFIXES_FORMAL]
        : SUFFIXES_CASUAL;
      const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
      variant = baseInput + suffix;
    } else if (strategy < 0.65) {
      // Rephrase
      const rephraser = REPHRASERS[Math.floor(Math.random() * REPHRASERS.length)];
      variant = rephraser(baseInput);
    } else if (strategy < 0.80 && (options.typos ?? true)) {
      // Add typos
      variant = addTypos(baseInput);
    } else if (strategy < 0.90) {
      // Prefix + rephrase + suffix
      const prefix = PREFIXES_CASUAL[Math.floor(Math.random() * PREFIXES_CASUAL.length)];
      const suffix = SUFFIXES_CASUAL[Math.floor(Math.random() * SUFFIXES_CASUAL.length)];
      const rephraser = REPHRASERS[Math.floor(Math.random() * REPHRASERS.length)];
      variant = prefix + rephraser(baseInput) + suffix;
    } else {
      // Random casing + whitespace
      variant = baseInput
        .split('')
        .map(c => Math.random() > 0.7 ? c.toUpperCase() : c.toLowerCase())
        .join('');
    }

    const key = variant.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      results.push(variant);
    }
  }

  return results.slice(0, count);
}
