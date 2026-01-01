/* =========================
 * TYPES
 * ========================= */
/* =========================
 * PARSER
 * ========================= */
export function parseDataset(input) {
    const entries = [];
    const issues = [];
    const norm = (s) => s.trim().replace(/\s+/g, " ");
    const canClose = (s, from, sq, rd) => {
        for (let j = from; j < s.length; j++) {
            const c = s[j];
            if (c === "[" && rd === 0)
                sq++;
            else if (c === "]" && rd === 0)
                sq--;
            else if (c === "(" && sq === 0)
                rd++;
            else if (c === ")" && sq === 0)
                rd--;
            if (sq === 0 && rd === 0)
                return true;
        }
        return false;
    };
    const splitTL = (s, sep, forEntries) => {
        const out = [];
        let buf = "";
        let sq = 0, rd = 0;
        for (let i = 0; i < s.length; i++) {
            const c = s[i];
            if (c === "[" && rd === 0)
                sq++;
            else if (c === "]" && rd === 0)
                sq--;
            else if (c === "(" && sq === 0)
                rd++;
            else if (c === ")" && sq === 0)
                rd--;
            if (sq < 0) {
                issues.push({ code: "EXTRA_CLOSING_SQUARE", raw: buf.trim() });
                sq = 0;
                buf = "";
                continue;
            }
            if (rd < 0) {
                issues.push({ code: "EXTRA_CLOSING_ROUND", raw: buf.trim() });
                rd = 0;
                buf = "";
                continue;
            }
            if (c === sep) {
                if (sq === 0 && rd === 0) {
                    out.push(buf.trim());
                    buf = "";
                    continue;
                }
                if (forEntries && !canClose(s, i + 1, sq, rd)) {
                    out.push(buf.trim());
                    buf = "";
                    sq = 0;
                    rd = 0;
                    continue;
                }
            }
            buf += c;
        }
        if (buf.trim())
            out.push(buf.trim());
        return out;
    };
    const hasTopLevelSemicolon = (inner) => splitTL(inner, ";", false).filter((p) => p.length).length > 1;
    const parseNode = (raw0) => {
        const raw = raw0.trim();
        let name = "";
        let i = 0;
        let seenGroup = false;
        let badOrder = false;
        const fragments = [];
        while (i < raw.length) {
            const c = raw[i];
            if (c === ")") {
                issues.push({ code: "EXTRA_CLOSING_ROUND", raw: raw0.trim() });
                i++;
                continue;
            }
            if (c === "]") {
                issues.push({ code: "EXTRA_CLOSING_SQUARE", raw: raw0.trim() });
                i++;
                continue;
            }
            /* ---------- ROUND () ---------- */
            if (c === "(") {
                let k = i + 1, inner = "", nested = false;
                while (k < raw.length && raw[k] !== ")") {
                    if (raw[k] === "(")
                        nested = true;
                    inner += raw[k++];
                }
                if (k === raw.length) {
                    issues.push({ code: "UNMATCHED_ROUND", raw: raw0.trim() });
                    break;
                }
                if (nested)
                    issues.push({ code: "NESTED_ROUND_NOT_ALLOWED", raw: raw0.trim() });
                inner
                    .split(",")
                    .map((v) => v.trim())
                    .filter(Boolean)
                    .forEach((v) => fragments.push({ type: "info", raw: v }));
                i = k + 1;
                continue;
            }
            /* ---------- SQUARE [] ---------- */
            if (c === "[") {
                let k = i + 1, d = 1, inner = "";
                while (k < raw.length && d) {
                    if (raw[k] === "[")
                        d++;
                    else if (raw[k] === "]")
                        d--;
                    if (d)
                        inner += raw[k++];
                    else
                        k++;
                }
                if (d) {
                    issues.push({ code: "UNMATCHED_SQUARE", raw: raw0.trim() });
                    break;
                }
                const bracketRaw = raw.slice(i, k).trim();
                const parts = splitTL(inner, ";", false).filter((p) => p.length);
                // Rule: if there is at least one top-level ';', always flag AMBIGUOUS.
                if (hasTopLevelSemicolon(inner)) {
                    issues.push({ code: "AMBIGUOUS_SQUARE_LIST", raw: bracketRaw });
                }
                // If there are multiple parts (top-level split on ';'), it must be a group.
                const isGroup = parts.length > 1;
                if (isGroup) {
                    seenGroup = true;
                    const members = [];
                    for (const p of parts) {
                        const m = parseNode(p);
                        if (!m.name)
                            issues.push({ code: "INVALID_MEMBER_ALIAS_ONLY", raw: p });
                        members.push(m);
                        entries.push(m);
                    }
                    fragments.push({ type: "group", raw: bracketRaw, members });
                }
                else {
                    // Invalid order occurs only if an alias follows a group within the same node.
                    if (seenGroup)
                        badOrder = true;
                    fragments.push({ type: "alias", raw: bracketRaw });
                }
                i = k;
                continue;
            }
            if (!fragments.length)
                name += c;
            i++;
        }
        name = norm(name);
        if (!name)
            issues.push({ code: "MISSING_NAME", raw: raw0.trim() });
        if (badOrder)
            issues.push({ code: "INVALID_FRAGMENT_ORDER", raw: raw0.trim() });
        return { name, fragments };
    };
    splitTL(input, ";", true)
        .filter(Boolean)
        .forEach((e) => entries.push(parseNode(e)));
    return { entries, issuesDetailed: issues };
}
export function stringifyDataset(dataset) {
    const n = (s) => s.trim().replace(/\s+/g, " ");
    const f = (x) => x.type === "info" ? `(${n(x.raw)})` : n(x.raw);
    const node = (c) => n([c.name, ...c.fragments.map(f)].join(" "));
    const mem = new Set();
    const walk = (c) => c.fragments.forEach(fr => fr.type === "group" && fr.members.forEach(m => (mem.add(n(m.name)), walk(m))));
    dataset.entries.forEach(walk);
    return n(dataset.entries.filter(e => !mem.has(n(e.name))).map(node).join("; "));
}
