/**
 * Minimal Redis RDB 6.0 parser
 * Extracts all keys related to a given username
 * Usage: node parse-rdb.js <rdb-file> [username]
 */

const fs = require('fs');
const path = require('path');

const RDB_OPCODE_EOF = 0xFF;
const RDB_OPCODE_SELECTDB = 0xFE;
const RDB_OPCODE_EXPIRETIME_MS = 0xFC;
const RDB_OPCODE_EXPIRETIME = 0xFD;
const RDB_TYPE_STRING = 0;
const RDB_TYPE_LIST = 1;
const RDB_TYPE_SET = 2;
const RDB_TYPE_ZSET = 3;
const RDB_TYPE_HASH = 4;
const RDB_TYPE_ZSET_2 = 5;

class RDBParser {
  constructor(buffer) {
    this.buf = buffer;
    this.pos = 0;
    this.db = 0;
    this.keys = {};
  }

  readByte() {
    if (this.pos >= this.buf.length) throw new Error('Unexpected EOF at ' + this.pos);
    return this.buf[this.pos++];
  }

  readBytes(n) {
    if (this.pos + n > this.buf.length) throw new Error('Unexpected EOF');
    const slice = this.buf.slice(this.pos, this.pos + n);
    this.pos += n;
    return slice;
  }

  // Returns { value: number|bigint, isEncoded: boolean }
  readLength() {
    const first = this.readByte();
    const encType = (first & 0xC0) >> 6;

    if (encType === 0) {
      return { value: first & 0x3F, isEncoded: false };
    } else if (encType === 1) {
      const next = this.readByte();
      return { value: ((first & 0x3F) << 8) | next, isEncoded: false };
    } else if (encType === 3) {
      const bytes = this.readBytes(8);
      let value = 0n;
      for (let i = 7; i >= 0; i--) {
        value = (value << 8n) | BigInt(bytes[i]);
      }
      return { value: Number(value), isEncoded: false };
    } else {
      // encType === 2 : special encoding in remaining 6 bits
      const enc = first & 0x3F;
      if (enc === 0) {
        const bytes = this.readBytes(4);
        return { value: new DataView(bytes.buffer).getInt32(0, true), isEncoded: true };
      } else if (enc === 1) {
        const bytes = this.readBytes(8);
        return { value: new DataView(bytes.buffer).getBigInt64(0, true), isEncoded: true };
      } else if (enc === 2) {
        const { value: len } = this.readLength();
        const str = this.readBytes(len).toString('utf8');
        return { value: parseInt(str, 10), isEncoded: true };
      }
    }
    throw new Error('Invalid length encoding');
  }

  readString() {
    const { value, isEncoded } = this.readLength();
    if (isEncoded) return String(value);
    return this.readBytes(value).toString('utf8');
  }

  readDouble() {
    const bytes = this.readBytes(8);
    return new DataView(bytes.buffer).getFloat64(0, true);
  }

  parseIntset() {
    const data = this.readBytes(this.readLength().value);
    const encoding = data.readUInt32LE(0);
    const count = data.readUInt32LE(4);
    const result = [];
    for (let i = 0; i < count; i++) {
      if (encoding === 2) result.push(data.readInt32LE(8 + i * 4));
      else if (encoding === 1) result.push(data.readInt16LE(8 + i * 2));
      else result.push(data.readInt8(8 + i));
    }
    return result;
  }

  parseHash() {
    const { value: count } = this.readLength();
    const result = {};
    for (let i = 0; i < count; i++) {
      const field = this.readString();
      result[field] = this.readString();
    }
    return result;
  }

  parseSet() {
    const { value: count } = this.readLength();
    const result = [];
    for (let i = 0; i < count; i++) result.push(this.readString());
    return result;
  }

  parseZset() {
    const { value: count } = this.readLength();
    const result = [];
    for (let i = 0; i < count; i++) {
      const member = this.readString();
      const score = this.readDouble();
      result.push({ member, score });
    }
    return result;
  }

  parseList() {
    const { value: count } = this.readLength();
    const result = [];
    for (let i = 0; i < count; i++) result.push(this.readString());
    return result;
  }

  parse() {
    // Magic: REDIS
    const magic = this.readBytes(5).toString('ascii');
    if (magic !== 'REDIS') throw new Error('Invalid RDB magic: ' + magic);

    const verStr = this.readBytes(4).toString('ascii');
    const version = parseInt(verStr, 10);
    console.log(`RDB version: ${version}`);

    while (this.pos < this.buf.length) {
      const opcode = this.readByte();

      if (opcode === RDB_OPCODE_EOF) {
        console.log('Reached EOF marker');
        break;
      }

      if (opcode === RDB_OPCODE_SELECTDB) {
        const { value: dbNum } = this.readLength();
        this.db = dbNum;
        continue;
      }

      let expire = null;
      if (opcode === RDB_OPCODE_EXPIRETIME_MS) {
        expire = this.readBytes(8); // 8-byte MS timestamp
        opcode = this.readByte();
      } else if (opcode === RDB_OPCODE_EXPIRETIME) {
        expire = this.readBytes(4); // 4-byte UNIX timestamp
        opcode = this.readByte();
      }

      this.parseKeyValue(opcode, expire);
    }

    return this.keys;
  }

  parseKeyValue(type, expire) {
    const key = this.readString();
    let value, valueType;

    switch (type) {
      case RDB_TYPE_STRING:
        value = this.readString();
        valueType = 'string';
        break;
      case RDB_TYPE_HASH:
        value = this.parseHash();
        valueType = 'hash';
        break;
      case RDB_TYPE_SET:
        value = this.parseSet();
        valueType = 'set';
        break;
      case RDB_TYPE_ZSET:
      case RDB_TYPE_ZSET_2:
        value = this.parseZset();
        valueType = 'zset';
        break;
      case RDB_TYPE_LIST:
        value = this.parseList();
        valueType = 'list';
        break;
      default:
        console.warn(`  [db${this.db}] Skipping unknown type ${type} for key: ${key}`);
        return;
    }

    const fullKey = `db${this.db}:${key}`;
    this.keys[fullKey] = { key, db: this.db, type: valueType, value, expire };
  }
}

// ---- Main ----
const rdbPath = process.argv[2] || 'E:/Users/Downloads/118ff503-a34e-4401-9d01-1e9e42221165.rdb';
const targetUsers = process.argv[3] ? process.argv[3].split(',') : ['7788'];

console.log(`Parsing RDB file: ${rdbPath}`);
console.log(`Looking for users: ${targetUsers.join(', ')}\n`);

const buffer = fs.readFileSync(rdbPath);
const parser = new RDBParser(buffer);

try {
  const allKeys = parser.parse();
  console.log(`\nTotal keys found: ${Object.keys(allKeys).length}`);
  console.log(`\n=== Keys related to specified users: ===\n`);

  const userKeys = {};
  for (const [fullKey, data] of Object.entries(allKeys)) {
    const isRelevant = targetUsers.some(u => data.key.includes(u)) || data.key.includes('admin') || data.key.includes('config');
    if (isRelevant) {
      userKeys[fullKey] = data;
      console.log(`[${data.type}] ${data.key}`);
      if (data.type === 'string') {
        const val = String(data.value);
        console.log(`  = ${val.length > 300 ? val.substring(0, 300) + '...' : val}`);
      } else {
        console.log(`  = ${JSON.stringify(data.value).substring(0, 500)}`);
      }
      console.log('');
    }
  }

  if (Object.keys(userKeys).length === 0) {
    console.log('No matching keys found.');
    console.log('\nSample keys (first 30):');
    for (const [fullKey, data] of Object.entries(allKeys).slice(0, 30)) {
      console.log(`  [${data.type}] ${data.key}`);
    }
  }

  // Save extracted keys
  const outputBase = path.join(path.dirname(rdbPath), 'rdb-extract');
  const outputPath = `${outputBase}.json`;
  fs.writeFileSync(outputPath, JSON.stringify(userKeys, null, 2));
  console.log(`\nSaved to: ${outputPath}`);

  // Also save all keys summary
  const summary = {};
  for (const [fullKey, data] of Object.entries(allKeys)) {
    summary[data.key] = data.type;
  }
  const summaryPath = path.join(path.dirname(rdbPath), 'rdb-all-keys.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Key summary saved to: ${summaryPath}`);

} catch (err) {
  console.error('Parse error:', err.message);
  console.error('At position:', parser.pos);
  const start = Math.max(0, parser.pos - 20);
  const end = Math.min(buffer.length, parser.pos + 20);
  console.error('Nearby bytes:', buffer.slice(start, end).toString('hex'));
  process.exit(1);
}
