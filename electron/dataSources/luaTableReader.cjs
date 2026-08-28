// Reads WoW's SavedVariables Lua table literal format -- NOT a general Lua parser,
// deliberately: WoW's own serializer only ever emits pure data literals (nested tables
// of strings/numbers/booleans, no expressions, functions or variables), so this only
// needs to handle that one well-known, consistent shape. Used by lootLog.cjs to read
// GuildToolsLoot.lua without needing a real Lua runtime or an npm Lua-parsing
// dependency. Unlike the addon that writes this file, this module runs in Node and can
// actually be unit-tested against sample SavedVariables text.

function tokenize(src) {
  const tokens = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
      i++;
      continue;
    }
    if (c === '-' && src[i + 1] === '-') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? n : nl + 1;
      continue;
    }
    if (c === '{' || c === '}' || c === '[' || c === ']' || c === '=' || c === ',') {
      tokens.push({ type: c });
      i++;
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let out = '';
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) {
          out += src[j + 1];
          j += 2;
        } else {
          out += src[j];
          j++;
        }
      }
      tokens.push({ type: 'string', value: out });
      i = j + 1;
      continue;
    }
    if (/[-\d]/.test(c) && /\d/.test(src[i + 1] ?? '')) {
      let j = i;
      if (src[j] === '-') j++;
      while (j < n && /[\d.eE+-]/.test(src[j])) j++;
      tokens.push({ type: 'number', value: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let j = i;
      while (j < n && /[a-zA-Z0-9_]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (word === 'true') tokens.push({ type: 'boolean', value: true });
      else if (word === 'false') tokens.push({ type: 'boolean', value: false });
      else if (word === 'nil') tokens.push({ type: 'nil' });
      else tokens.push({ type: 'ident', value: word });
      i = j;
      continue;
    }
    // Unrecognized character (shouldn't happen for a well-formed SavedVariables file) -- skip it.
    i++;
  }
  return tokens;
}

/** Parses one `{ ... }` table literal, positional entries as an array, `["key"]=value` entries as object keys -- mixed tables become an object with a numeric-indexed tail folded in under numeric string keys, same as Lua itself would. */
function parseTable(tokens, pos) {
  pos.i++; // consume '{'
  const arrayPart = [];
  const objectPart = {};
  let isArray = true;

  while (tokens[pos.i] && tokens[pos.i].type !== '}') {
    if (tokens[pos.i].type === '[') {
      pos.i++; // consume '['
      const keyTok = tokens[pos.i];
      pos.i++; // consume key
      pos.i++; // consume ']'
      pos.i++; // consume '='
      const key = keyTok.value;
      const value = parseValue(tokens, pos);
      objectPart[key] = value;
      isArray = false;
    } else {
      const value = parseValue(tokens, pos);
      arrayPart.push(value);
    }
    if (tokens[pos.i] && tokens[pos.i].type === ',') pos.i++;
  }
  pos.i++; // consume '}'

  if (isArray) return arrayPart;
  if (arrayPart.length > 0) {
    arrayPart.forEach((v, idx) => {
      objectPart[idx + 1] = v;
    });
  }
  return objectPart;
}

function parseValue(tokens, pos) {
  const tok = tokens[pos.i];
  if (!tok) throw new Error('Unexpected end of input parsing Lua table');
  if (tok.type === '{') return parseTable(tokens, pos);
  if (tok.type === 'string' || tok.type === 'number' || tok.type === 'boolean') {
    pos.i++;
    return tok.value;
  }
  if (tok.type === 'nil') {
    pos.i++;
    return null;
  }
  throw new Error(`Unexpected token parsing Lua table: ${tok.type}`);
}

/**
 * Parses a `VarName = { ... }` SavedVariables assignment out of raw Lua source and
 * returns the table's parsed value, or null if that variable name isn't assigned
 * anywhere in the source.
 */
function readLuaVariable(source, varName) {
  const tokens = tokenize(source);
  const pos = { i: 0 };
  while (pos.i < tokens.length) {
    const tok = tokens[pos.i];
    if (tok.type === 'ident' && tok.value === varName && tokens[pos.i + 1]?.type === '=') {
      pos.i += 2;
      if (tokens[pos.i]?.type === '{') return parseTable(tokens, pos);
      return parseValue(tokens, pos);
    }
    pos.i++;
  }
  return null;
}

module.exports = { readLuaVariable };
