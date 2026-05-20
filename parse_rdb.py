#!/usr/bin/env python3
"""Redis RDB 12 (Redis 7.x) parser - handles AUX fields and all types."""
import sys, json, struct

RDB_EOF           = 0xFF
RDB_SELECTDB       = 0xFE
RDB_EXPIRETIME_MS  = 0xFC
RDB_EXPIRETIME     = 0xFD
RDB_RESIZEDB       = 0xFB
RDB_AUX            = 0xFA

T_STRING    = 0
T_LIST      = 1
T_SET       = 2
T_ZSET      = 3
T_HASH      = 4
T_ZSET_2    = 5
T_MODULE    = 6
T_MODULE_2  = 7
T_HASH_ZIPMAP   = 8
T_LIST_ZIPLIST  = 9
T_SET_INTSET    = 10
T_ZSET_ZIPLIST  = 11
T_HASH_ZIPLIST  = 12
T_LIST_QUICKLIST = 13
T_STREAM_LISTPACKS = 14
T_HASH_LISTPACK    = 15
T_ZSET_LISTPACK    = 16
T_LIST_QUICKLIST_2 = 17
T_STREAM_LISTPACKS_2 = 18

def rbyte(f):
    b = f.read(1)
    if not b: raise EOFError("EOF")
    return b[0]

def rbytes(f, n):
    d = f.read(n)
    if len(d) != n: raise EOFError(f"want {n} got {len(d)}")
    return d

def rlen(f):
    first = rbyte(f)
    enc = (first & 0xC0) >> 6
    if enc == 0:  return (first & 0x3F, False)
    if enc == 1:  return (((first & 0x3F) << 8) | rbyte(f), False)
    if enc == 3:
        b = rbytes(f, 8)
        v = 0
        for i in range(8): v |= b[i] << (i*8)
        return (v, False)
    # enc == 2 : special encoding in low 6 bits
    it = first & 0x3F
    if it == 0: return (struct.unpack('<b', rbytes(f,1))[0], True)
    if it == 1: return (struct.unpack('<H', rbytes(f,2))[0], True)
    if it == 2: return (struct.unpack('<I', rbytes(f,4))[0], True)
    raise ValueError(f"Bad special enc: {it}")

def rlen_val(f):
    return rlen(f)[0]

def rstr(f):
    v, enc = rlen(f)
    if enc: return str(v)
    return rbytes(f, v).decode('utf-8', errors='replace')

def rdouble(f):
    return struct.unpack('<d', rbytes(f,8))[0]

def skip(f, t):
    if t == T_STRING: rstr(f)
    elif t in (T_LIST, T_SET):
        c = rlen_val(f)
        for _ in range(c): rstr(f)
    elif t in (T_ZSET, T_ZSET_2):
        c = rlen_val(f)
        for _ in range(c): rstr(f); rdouble(f)
    elif t == T_HASH:
        c = rlen_val(f)
        for _ in range(c): rstr(f); rstr(f)
    elif t in (T_LIST_ZIPLIST, T_SET_INTSET, T_ZSET_ZIPLIST,
               T_HASH_ZIPLIST, T_HASH_LISTPACK, T_ZSET_LISTPACK,
               T_STREAM_LISTPACKS, T_STREAM_LISTPACKS_2):
        rstr(f)  # stored as a string blob
    elif t in (T_LIST_QUICKLIST,):
        c = rlen_val(f)
        for _ in range(c): rstr(f)
    elif t == T_LIST_QUICKLIST_2:
        c = rlen_val(f)
        for _ in range(c):
            container = rbyte(f)
            if container == 2:
                cl = rlen_val(f); ul = rlen_val(f)
                rbytes(f, cl)
            else: rstr(f)
    else:
        raise ValueError(f"Cannot skip type {t}")

def parse_kv(f, t):
    key = rstr(f)
    if t == T_STRING:
        return (key, rstr(f), 'string')
    if t == T_HASH:
        c = rlen_val(f); val = {}
        for _ in range(c):
            field = rstr(f); val[field] = rstr(f)
        return (key, val, 'hash')
    if t == T_SET:
        c = rlen_val(f); val = []
        for _ in range(c): val.append(rstr(f))
        return (key, val, 'set')
    if t in (T_ZSET, T_ZSET_2):
        c = rlen_val(f); val = []
        for _ in range(c):
            val.append({'member': rstr(f), 'score': rdouble(f)})
        return (key, val, 'zset')
    if t == T_LIST:
        c = rlen_val(f); val = []
        for _ in range(c): val.append(rstr(f))
        return (key, val, 'list')
    # For encoded types, just capture size
    if t in (T_LIST_ZIPLIST, T_SET_INTSET, T_ZSET_ZIPLIST,
               T_HASH_ZIPLIST, T_HASH_LISTPACK, T_ZSET_LISTPACK):
        raw = rstr(f)
        return (key, f'<{len(raw)} bytes>', 'unknown')
    if t in (T_LIST_QUICKLIST, T_LIST_QUICKLIST_2):
        c = rlen_val(f)
        parts = []
        for _ in range(c):
            container = rbyte(f)
            if container == 2:
                cl = rlen_val(f); ul = rlen_val(f)
                rbytes(f, cl)
                parts.append('<compressed>')
            else:
                rstr(f)
                parts.append('<ziplist>')
        return (key, parts, 'list')
    if t in (T_STREAM_LISTPACKS, T_STREAM_LISTPACKS_2):
        c = rlen_val(f)
        for _ in range(c): rstr(f)
        return (key, '<stream>', 'stream')
    skip(f, t)
    return (key, f'<type-{t}>', 'unknown')

def parse(rdb_path, targets):
    all_keys = {}
    results = {}
    cur_db = 0
    with open(rdb_path, 'rb') as f:
        magic = f.read(5)
        if magic != b'REDIS': raise ValueError(f"Bad magic {magic}")
        ver = int(f.read(4).decode('ascii'))
        print(f"RDB version: {ver}", file=sys.stderr)

        while True:
            try: opcode = rbyte(f)
            except EOFError: break

            if opcode == RDB_EOF:
                print("EOF.", file=sys.stderr); break

            if opcode == RDB_AUX:
                # AUX field: key + value (both strings)
                rstr(f); rstr(f)
                continue

            if opcode == RDB_SELECTDB:
                cur_db = rlen_val(f); continue

            if opcode == RDB_RESIZEDB:
                rlen(f); rlen(f); continue

            expire = None
            if opcode == RDB_EXPIRETIME_MS:
                expire = rbytes(f, 8)
                opcode = rbyte(f)
            elif opcode == RDB_EXPIRETIME:
                expire = rbytes(f, 4)
                opcode = rbyte(f)

            try:
                key, value, vtype = parse_kv(f, opcode)
                full = f"db{cur_db}:{key}"
                entry = {'key': key, 'db': cur_db, 'type': vtype, 'value': value}
                all_keys[full] = entry
                if any(t in key for t in targets):
                    results[full] = entry
            except Exception as e:
                print(f"Error at {f.tell()}: {e}", file=sys.stderr)
                break

    return all_keys, results

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <rdb> [user1,user2,...]")
        sys.exit(1)
    rdb = sys.argv[1]
    targets = sys.argv[2].split(',') if len(sys.argv) > 2 else ['7788','5566']
    print(f"Parsing: {rdb}", file=sys.stderr)
    print(f"Targets: {targets}", file=sys.stderr)
    all_keys, results = parse(rdb, targets + ['admin','config','users'])
    print(f"\nTotal keys: {len(all_keys)}", file=sys.stderr)
    print(f"Matches: {len(results)}\n", file=sys.stderr)
    for k, e in results.items():
        print(f"[{e['type']}] {e['key']}")
        s = json.dumps(e['value'], ensure_ascii=False)
        print(f"  = {s[:400]}")
        print()
    if not results:
        print("No matches. Key pattern samples:", file=sys.stderr)
        seen = set()
        for k, e in list(all_keys.items())[:60]:
            p = e['key'].split(':')[0]
            if p not in seen:
                seen.add(p)
                print(f"  [{e['type']}] {e['key'][:70]}", file=sys.stderr)
