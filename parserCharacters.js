// parserCharacters.ts
// Conservative structural parser for character lists (GCD-like).
// Goal: string -> AST -> string (canonical form) without semantic “fixes”.
// Main API-----------------------------
export function parseDataset(input) {
    const issues = [];
    const top = [];
    const parts = splitByTopLevelSemicolon(input, "input", issues);
    for (let i = 0; i < parts.length; i++) {
        const raw = parts[i].trim();
        if (!raw)
            continue;
        const n = parseNode(raw, `top[${i}]`, issues);
        if (n)
            top.push(n);
    }
    // Flatten: include all reachable nodes (roots + descendants). Uses object identity as a cycle guard.
    const entries = [];
    const seen = new Set();
    const visit = (node) => {
        if (seen.has(node))
            return;
        seen.add(node);
        entries.push(node);
        for (const f of node.fragments) {
            if (f.kind !== "group")
                continue;
            for (const m of f.members) {
                if (m.kind === "node")
                    visit(m);
            }
        }
    };
    for (const n of top)
        visit(n);
    return { entries, issuesDetailed: issues };
}
export function stringifyDataset(dataset) {
    const children = new Set();
    for (const n of dataset.entries) {
        for (const f of n.fragments) {
            if (f.kind !== "group")
                continue;
            for (const m of f.members) {
                if (m.kind === "node")
                    children.add(m);
            }
        }
    }
    const roots = dataset.entries.filter((n) => !children.has(n));
    return roots.map(stringifyNode).join("; ") + (roots.length ? ";" : "");
}
// --------------------------------------
function stringifyCharacter(c) {
    return c.kind === "raw" ? c.raw.trim() : stringifyNode(c);
}
function stringifyFragment(f) {
    if (f.kind === "info")
        return ` (${f.raw.trim()})`;
    if (f.kind === "alias") {
        // Conservative: do not interpret; only trim.
        return ` [${f.raw.trim()}]`;
    }
    // Group: canonicalize from parsed members (not from raw).
    const inner = f.members.map(stringifyCharacter).join("; ");
    return ` [${inner}]`;
}
function stringifyNode(n) {
    let out = n.name.trim();
    for (const f of n.fragments)
        out += stringifyFragment(f);
    return out;
}
// Scans the string while tracking top-level nesting depth.
// Reports extra closing brackets at top-level (or when depth is already zero).
function scanTopLevel(s, path, issues, cb) {
    let round = 0;
    let sq = 0;
    for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (ch === "(") {
            round++;
            continue;
        }
        if (ch === ")") {
            if (round > 0)
                round--;
            else {
                issues.push({
                    code: "EXTRA_CLOSING_ROUND",
                    raw: s.slice(i),
                    path,
                    message: "Found ')' with no matching '('.",
                });
            }
            continue;
        }
        if (ch === "[") {
            sq++;
            continue;
        }
        if (ch === "]") {
            if (sq > 0)
                sq--;
            else {
                issues.push({
                    code: "EXTRA_CLOSING_SQUARE",
                    raw: s.slice(i),
                    path,
                    message: "Found ']' with no matching '['.",
                });
            }
            continue;
        }
        if (round === 0 && sq === 0) {
            if (cb(ch, i) === false)
                return false;
        }
    }
    return true;
}
function splitByTopLevelSemicolon(s, path, issues) {
    const out = [];
    let start = 0;
    scanTopLevel(s, path, issues, (ch, i) => {
        if (ch === ";") {
            out.push(s.slice(start, i));
            start = i + 1;
        }
    });
    out.push(s.slice(start));
    return out;
}
function parseNode(entryRaw, path, issues) {
    let i = 0;
    while (i < entryRaw.length && entryRaw[i] !== "[" && entryRaw[i] !== "(")
        i++;
    const name = entryRaw.slice(0, i).trim();
    if (!name) {
        issues.push({
            code: "MISSING_NAME",
            raw: entryRaw,
            path,
            message: "Missing character/group name before fragments.",
        });
        return null;
    }
    const fragments = [];
    let seenInfo = false;
    while (i < entryRaw.length) {
        const ch = entryRaw[i];
        if (ch === " ") {
            i++;
            continue;
        }
        if (ch === "(") {
            const r = readRoundFlat(entryRaw, i, path, issues);
            fragments.push({ kind: "info", raw: r.inner.trim() });
            seenInfo = true;
            i = r.next;
            continue;
        }
        if (ch === "[") {
            if (seenInfo) {
                issues.push({
                    code: "INVALID_FRAGMENT_ORDER",
                    raw: entryRaw.slice(i),
                    path,
                    message: "Found '[' after '()'.",
                });
            }
            const r = readSquareBalanced(entryRaw, i, path, issues);
            const inner = r.inner;
            // Conservative heuristic:
            // - any '[' inside `inner` implies nested square brackets (outer ones already stripped)
            // - ';' is detected only at top-level of `inner`
            const hasNestedSquare = inner.includes("[");
            let hasSep = false;
            scanTopLevel(inner, `${path}.square`, issues, (c) => {
                if (c === ";")
                    hasSep = true;
            });
            if (hasNestedSquare) {
                fragments.push({
                    kind: "group",
                    raw: inner,
                    members: parseMemberList(inner, `${path}.group`, issues),
                });
            }
            else {
                if (hasSep) {
                    issues.push({
                        code: "AMBIGUOUS_SQUARE_LIST",
                        raw: `[${inner}]`,
                        path,
                        message: "Could be a group or aliases. Defaulted to alias.",
                    });
                }
                fragments.push({ kind: "alias", raw: inner.trim() });
            }
            i = r.next;
            continue;
        }
        // Unknown character: ignore (conservative; no semantic correction).
        i++;
    }
    return { kind: "node", name, fragments };
}
function parseMemberList(inner, path, issues) {
    const parts = splitByTopLevelSemicolon(inner, path, issues);
    const out = [];
    for (let k = 0; k < parts.length; k++) {
        const piece = parts[k].trim();
        if (!piece)
            continue;
        if (piece[0] === "[") {
            out.push({ kind: "raw", raw: piece });
            issues.push({
                code: "INVALID_MEMBER_ALIAS_ONLY",
                raw: piece,
                path: `${path}[${k}]`,
                message: "Member starts with '['; missing name.",
            });
            continue;
        }
        const n = parseNode(piece, `${path}[${k}]`, issues);
        if (n)
            out.push(n);
    }
    return out;
}
// Round brackets are policy-flat (not allowed to nest), but consumed with depth so input stays parseable.
// If nested, report NESTED_ROUND_NOT_ALLOWED and still consume to the correct closing ')'.
function readRoundFlat(s, start, path, issues) {
    let i = start + 1;
    const innerStart = i;
    let depth = 1;
    let sawNested = false;
    while (i < s.length) {
        const ch = s[i];
        if (ch === "(") {
            depth++;
            sawNested = true;
            i++;
            continue;
        }
        if (ch === ")") {
            depth--;
            if (depth === 0) {
                if (sawNested) {
                    issues.push({
                        code: "NESTED_ROUND_NOT_ALLOWED",
                        raw: s.slice(start, i + 1),
                        path,
                        message: "Nested '(' is not allowed.",
                    });
                }
                return { inner: s.slice(innerStart, i), next: i + 1 };
            }
            i++;
            continue;
        }
        i++;
    }
    issues.push({
        code: "UNMATCHED_ROUND",
        raw: s.slice(start),
        path,
        message: "Missing closing ')'.",
    });
    return { inner: s.slice(innerStart), next: s.length };
}
// Square brackets are balanced and may nest.
// If '(' is encountered inside, it is consumed via readRoundFlat (which reports nested-round issues if needed).
function readSquareBalanced(s, start, path, issues) {
    let i = start + 1;
    const innerStart = i;
    let depth = 1;
    while (i < s.length) {
        const ch = s[i];
        if (ch === "[") {
            depth++;
            i++;
            continue;
        }
        if (ch === "]") {
            depth--;
            if (depth === 0)
                return { inner: s.slice(innerStart, i), next: i + 1 };
            i++;
            continue;
        }
        if (ch === "(") {
            i = readRoundFlat(s, i, path, issues).next;
            continue;
        }
        i++;
    }
    issues.push({
        code: "UNMATCHED_SQUARE",
        raw: s.slice(start),
        path,
        message: "Missing closing ']'.",
    });
    return { inner: s.slice(innerStart), next: s.length };
}
