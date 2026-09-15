// Data compression & schema minification.
//
// Three layers, all reversible:
//   1. LZ-based synchronous string compression (always available) that the
//      repository storage adapter uses for on-device writes.
//   2. Browser CompressionStream (gzip) wrappers used by sync paths; they
//      gracefully fall back to the LZ encoder where CompressionStream is
//      missing. The file/blob format is marker-prefixed so uncompressed legacy
//      data always hydrates as-is.
//   3. Short-key JSON schema transformers that strip structural key bloat
//      before persistence and expand it back into full UI domain objects.
//
// The storage adapters stay *transparent*: callers hand in the exact JSON
// string they would have stored before, and receive the exact same string
// back. Backward compatibility is inherent — unmarked values pass through
// untouched.

// ---------------------------------------------------------------------------
// LZ string encoding (16-bit window). Ported from lz-string v1.5.0 (MIT):
// https://github.com/pieroxy/lz-string — compressTo/decompressFromUint8Array.
// ---------------------------------------------------------------------------

const _compress = (uncompressed, bitsPerChar, getCharFromInt) => {
  if (uncompressed == null) return "";
  let i;
  let value;
  const context_dictionary = {};
  const context_dictionaryToCreate = {};
  let context_c = "";
  let context_wc = "";
  let context_w = "";
  let context_enlargeIn = 2;
  let context_dictSize = 3;
  let context_numBits = 2;
  const context_data = [];
  let context_data_val = 0;
  let context_data_position = 0;
  let ii;

  for (ii = 0; ii < uncompressed.length; ii += 1) {
    context_c = uncompressed.charAt(ii);
    if (!Object.prototype.hasOwnProperty.call(context_dictionary, context_c)) {
      context_dictionary[context_c] = context_dictSize++;
      context_dictionaryToCreate[context_c] = true;
    }

    context_wc = context_w + context_c;
    if (Object.prototype.hasOwnProperty.call(context_dictionary, context_wc)) {
      context_w = context_wc;
    } else {
      if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
        if (context_w.charCodeAt(0) < 256) {
          for (i = 0; i < context_numBits; i += 1) {
            context_data_val = context_data_val << 1;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position += 1;
            }
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 8; i += 1) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position += 1;
            }
            value = value >> 1;
          }
        } else {
          value = 1;
          for (i = 0; i < context_numBits; i += 1) {
            context_data_val = (context_data_val << 1) | value;
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position += 1;
            }
            value = 0;
          }
          value = context_w.charCodeAt(0);
          for (i = 0; i < 16; i += 1) {
            context_data_val = (context_data_val << 1) | (value & 1);
            if (context_data_position === bitsPerChar - 1) {
              context_data_position = 0;
              context_data.push(getCharFromInt(context_data_val));
              context_data_val = 0;
            } else {
              context_data_position += 1;
            }
            value = value >> 1;
          }
        }
        context_enlargeIn -= 1;
        if (context_enlargeIn === 0) {
          context_enlargeIn = Math.pow(2, context_numBits);
          context_numBits += 1;
        }
        delete context_dictionaryToCreate[context_w];
      } else {
        value = context_dictionary[context_w];
        for (i = 0; i < context_numBits; i += 1) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position += 1;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn -= 1;
      if (context_enlargeIn === 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits += 1;
      }
      context_dictionary[context_wc] = context_dictSize++;
      context_w = context_c;
    }
  }

  if (context_w !== "") {
    if (Object.prototype.hasOwnProperty.call(context_dictionaryToCreate, context_w)) {
      if (context_w.charCodeAt(0) < 256) {
        for (i = 0; i < context_numBits; i += 1) {
          context_data_val = context_data_val << 1;
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position += 1;
          }
        }
        value = context_w.charCodeAt(0);
        for (i = 0; i < 8; i += 1) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position += 1;
          }
          value = value >> 1;
        }
      } else {
        value = 1;
        for (i = 0; i < context_numBits; i += 1) {
          context_data_val = (context_data_val << 1) | value;
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position += 1;
          }
          value = 0;
        }
        value = context_w.charCodeAt(0);
        for (i = 0; i < 16; i += 1) {
          context_data_val = (context_data_val << 1) | (value & 1);
          if (context_data_position === bitsPerChar - 1) {
            context_data_position = 0;
            context_data.push(getCharFromInt(context_data_val));
            context_data_val = 0;
          } else {
            context_data_position += 1;
          }
          value = value >> 1;
        }
      }
      context_enlargeIn -= 1;
      if (context_enlargeIn === 0) {
        context_enlargeIn = Math.pow(2, context_numBits);
        context_numBits += 1;
      }
      delete context_dictionaryToCreate[context_w];
    } else {
      value = context_dictionary[context_w];
      for (i = 0; i < context_numBits; i += 1) {
        context_data_val = (context_data_val << 1) | (value & 1);
        if (context_data_position === bitsPerChar - 1) {
          context_data_position = 0;
          context_data.push(getCharFromInt(context_data_val));
          context_data_val = 0;
        } else {
          context_data_position += 1;
        }
        value = value >> 1;
      }
    }
    context_enlargeIn -= 1;
    if (context_enlargeIn === 0) {
      context_enlargeIn = Math.pow(2, context_numBits);
      context_numBits += 1;
    }
  }

  value = 2;
  for (i = 0; i < context_numBits; i += 1) {
    context_data_val = (context_data_val << 1) | (value & 1);
    if (context_data_position === bitsPerChar - 1) {
      context_data_position = 0;
      context_data.push(getCharFromInt(context_data_val));
      context_data_val = 0;
    } else {
      context_data_position += 1;
    }
    value = value >> 1;
  }

  while (true) {
    context_data_val = context_data_val << 1;
    if (context_data_position === bitsPerChar - 1) {
      context_data.push(getCharFromInt(context_data_val));
      break;
    }
    context_data_position += 1;
  }

  return context_data;
};

const _decompress = (length, resetValue, getNextValue) => {
  const f = String.fromCharCode;
  const dictionary = [];
  const result = [];
  let next;
  let enlargeIn = 4;
  let dictSize = 4;
  let numBits = 3;
  let entry = "";
  let i;
  let w;
  let bits;
  let resb;
  let maxpower;
  let power;
  let c;
  const data = { val: getNextValue(0), position: resetValue, index: 1 };

  for (i = 0; i < 3; i += 1) {
    dictionary[i] = i;
  }

  bits = 0;
  maxpower = Math.pow(2, 2);
  power = 1;
  while (power != maxpower) {
    resb = data.val & data.position;
    data.position >>= 1;
    if (data.position == 0) {
      data.position = resetValue;
      data.val = getNextValue(data.index++);
    }
    bits |= (resb > 0 ? 1 : 0) * power;
    power <<= 1;
  }

  switch ((next = bits)) {
    case 0:
      bits = 0;
      maxpower = Math.pow(2, 8);
      power = 1;
      while (power != maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = f(bits);
      break;
    case 1:
      bits = 0;
      maxpower = Math.pow(2, 16);
      power = 1;
      while (power != maxpower) {
        resb = data.val & data.position;
        data.position >>= 1;
        if (data.position == 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index++);
        }
        bits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      c = f(bits);
      break;
    case 2:
      return "";
  }
  dictionary[3] = c;
  w = c;
  result.push(c);
  while (true) {
    if (data.index > length) {
      return "";
    }

    bits = 0;
    maxpower = Math.pow(2, numBits);
    power = 1;
    while (power != maxpower) {
      resb = data.val & data.position;
      data.position >>= 1;
      if (data.position == 0) {
        data.position = resetValue;
        data.val = getNextValue(data.index++);
      }
      bits |= (resb > 0 ? 1 : 0) * power;
      power <<= 1;
    }

    switch ((c = bits)) {
      case 0:
        bits = 0;
        maxpower = Math.pow(2, 8);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        dictionary[dictSize++] = f(bits);
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 1:
        bits = 0;
        maxpower = Math.pow(2, 16);
        power = 1;
        while (power != maxpower) {
          resb = data.val & data.position;
          data.position >>= 1;
          if (data.position == 0) {
            data.position = resetValue;
            data.val = getNextValue(data.index++);
          }
          bits |= (resb > 0 ? 1 : 0) * power;
          power <<= 1;
        }
        dictionary[dictSize++] = f(bits);
        c = dictSize - 1;
        enlargeIn--;
        break;
      case 2:
        return result.join("");
    }

    if (enlargeIn == 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }

    if (dictionary[c]) {
      entry = String(dictionary[c]);
    } else {
      if (c === dictSize) {
        entry = w + w.charAt(0);
      } else {
        return null;
      }
    }
    result.push(entry);

    dictionary[dictSize++] = w + entry.charAt(0);
    enlargeIn--;

    w = entry;

    if (enlargeIn == 0) {
      enlargeIn = Math.pow(2, numBits);
      numBits++;
    }
  }
};

// ---------------------------------------------------------------------------
// Byte <-> binary string helpers (chars 0-255, storage-safe).
// ---------------------------------------------------------------------------

const bytesToBinaryString = (bytes) => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i]);
  return out;
};

const binaryStringToBytes = (str) => {
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) bytes[i] = str.charCodeAt(i) & 0xff;
  return bytes;
};

// ---------------------------------------------------------------------------
// Public synchronous LZ string API (binary-string compressed form).
// ---------------------------------------------------------------------------

// compressString reduces 16-bit codes to a byte-exact binary string WITHOUT
// spreading huge arrays onto the call stack.
const binaryStringFromCodes = (codes) => {
  const bytes = new Uint8Array(codes.length * 2);
  for (let i = 0; i < codes.length; i += 1) {
    bytes[i * 2] = codes[i] >> 8;
    bytes[i * 2 + 1] = codes[i] & 0xff;
  }
  return bytesToBinaryString(bytes);
};

export const compressString = (uncompressed) => {
  if (uncompressed == null || uncompressed === "") return "";
  const codes = _compress(uncompressed, 16, (a) => a);
  return binaryStringFromCodes(codes);
};

export const decompressString = (compressed) => {
  if (compressed == null || compressed === "") return "";
  const bytes = binaryStringToBytes(compressed);
  return _decompress(bytes.length / 2, 32768, (index) => {
    const hi = bytes[index * 2];
    const lo = bytes[index * 2 + 1];
    return ((hi << 8) | (lo & 0xff)) & 0xffff;
  });
};

// ---------------------------------------------------------------------------
// Async CompressionStream (gzip) wrappers for sync paths.
// ---------------------------------------------------------------------------

export const compressBytes = async (input) => {
  const Stream = typeof CompressionStream !== "undefined" ? CompressionStream : null;
  if (Stream) {
    const stream = new Stream("gzip");
    const response = new Response(new Blob([input]).stream().pipeThrough(stream));
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  }
  return binaryStringToBytes(compressString(bytesToBinaryString(input)));
};

export const decompressBytes = async (input) => {
  const Stream = typeof DecompressionStream !== "undefined" ? DecompressionStream : null;
  if (Stream) {
    const stream = new Stream("gzip");
    const response = new Response(new Blob([input]).stream().pipeThrough(stream));
    const buf = await response.arrayBuffer();
    return new Uint8Array(buf);
  }
  return binaryStringToBytes(decompressString(bytesToBinaryString(input)));
};

// ---------------------------------------------------------------------------
// Short-key schema transformers (non-destructive: unknown keys pass through).
// ---------------------------------------------------------------------------

export const SCHEMA = Object.freeze({
  id: "i",
  user_id: "ui",
  created_at: "crt",
  updated_at: "upd",
  title: "t",
  content: "c",
  name: "n",
  description: "d",
  body: "b",
  date: "da",
  time: "ti",
  start_time: "st",
  end_time: "et",
  due_date: "dd",
  completed_date: "cmd",
  day_of_week: "dw",
  course_id: "ci",
  habit_id: "hi",
  post_id: "pi",
  google_event_id: "gei",
  status: "s",
  priority: "p",
  type: "ty",
  weight: "w",
  grade: "g",
  target_grade: "tg",
  target: "tr",
  current: "cur",
  unit: "un",
  deadline: "dl",
  category: "ca",
  frequency: "fq",
  target_per_week: "tpw",
  duration: "du",
  mode: "md",
  label: "lb",
  completed: "cm",
  recurring: "rc",
  pinned: "pn",
  archived: "ar",
  url: "u",
  room: "r",
  tags: "ta",
  topics: "tp",
  code: "cd",
  professor: "pr",
  semester: "se",
  academic_year: "ay",
  color: "cl",
  icon: "ic",
  rotation: "rot",
  notes: "nt",
  link: "lk",
  mastery: "my",
  reviewed: "rv",
  university: "uni",
  degree: "deg",
  year: "yr",
  language: "lg",
  target_gpa: "tgp",
  preferred_focus: "pf",
  interests: "in",
  full_name: "fn",
  email: "em",
  role: "rl",
});

const REVERSE = Object.freeze(
  Object.keys(SCHEMA).reduce((acc, k) => {
    acc[SCHEMA[k]] = k;
    return acc;
  }, {})
);

export const minifyValue = (value) => {
  if (Array.isArray(value)) return value.map(minifyValue);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      out[SCHEMA[k] !== undefined ? SCHEMA[k] : k] = minifyValue(v);
    });
    return out;
  }
  return value;
};

// Reverse expansion: short keys -> full UI domain keys.
export const expandValue = (value) => {
  if (Array.isArray(value)) return value.map(expandValue);
  if (value && typeof value === "object") {
    const out = {};
    Object.entries(value).forEach(([k, v]) => {
      out[REVERSE[k] !== undefined ? REVERSE[k] : k] = expandValue(v);
    });
    return out;
  }
  return value;
};

// Convenience aliases matching the minify/hydrate wording.
export const minifyPayload = minifyValue;
export const hydratePayload = expandValue;

// One-shot object <-> storage form (used by sync adapters / diagnostics).
export const compressPayload = (obj) => compressString(JSON.stringify(minifyValue(obj)));

export const decompressPayload = (raw) => hydratePayload(JSON.parse(decompressString(raw)));