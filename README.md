**Languages:** [English](README.md) | [Italiano](README.it.md)
# parserCharacters
**Conservative structural parser for character lists**

## Problem description
Given an informal textual grammar adopted by the
[Grand Comics Database (GCD)](https://docs.comics.org/wiki/Main_Page)
to describe
[Character Appearances](https://docs.comics.org/wiki/Character_Appearances)
within stories, the goal is to design a parser that converts a linear representation
(a text string) into an **AST** data structure (Abstract Syntax Tree), preserving the
highest possible structural fidelity and without introducing semantic interpretations
or automatic corrections.

Real-world input example (from [GCD](https://docs.comics.org/wiki/Character_Appearances)):

```txt
Green Lantern [John Stewart];
Justice League [Superman [Clark Kent; Kal-El]; Batman [Bruce Wayne]];
Jimmy Olsen (origin, death);
```

## Supported syntax
The syntax supported by the parser includes the following elements:
- `;` as a **separator** of elements at the list level (flat)
- `[...]` for **aliases** or **groups of members**
- `(...)` for **generic information** (non-nestable)
- nesting is allowed **only** for `[...]` in case of groups
  (as in the *Justice League* example)
- possible ambiguity between alias and group of members, for example:
  - `Personaggio [Alias1; Alias2; ...]` → alias
  - `Gruppo [Membro1; Membro2; ...]` → gruppo di membri


## Parser requirements

### What the parser does
- ✅ converts the string into a minimal and deterministic AST
- ✅ preserves structural order
- ✅ produces a **canonical** textual representation
- ✅ reports syntactic errors and ambiguities through structured `IssueCode`

### What the parser does not do
- ❌ correct the input
- ❌ interpret semantically
- ❌ normalize names or contents (except trimming spaces)
- ❌ insert markers or placeholders


# Proposed solution
The solution is based on a TypeScript format dedicated to the definition
of the AST and `IssueCode`, accompanied by a parser implemented
intentionally *from scratch*, without the use of external libraries.
This choice allows full control over the conservative behavior of the parser
and the handling of edge cases. For the same reason, regular expressions (REGEX)
are not used, avoiding interpretative ambiguities and ensuring deterministic
structural analysis.


## Main API features (parserCharacters.ts)
The module exposes two main functions:

```ts
export function parseDataset(input: string): Dataset
export function stringifyDataset(dataset: Dataset): string
```

* `parseDataset` converts a linear representation into a data structure (Dataset)
containing the AST and any diagnostics.
* `stringifyDataset` produces a canonical textual representation from a Dataset.

### Round-trip idempotence test
The parser is validated through an idempotence test of the cycle
String → AST → String, verifying that the canonical representation
is stable (once reached, further conversions do not produce
changes):

```ts
// indempotenceTest.js
import { parseDataset, stringifyDataset } from "./parserCharacters.js";

function assertIdempotent(input) {
  const canon = stringifyDataset(parseDataset(input));
  const output = stringifyDataset(parseDataset(canon));

  console.assert(canon === output, "Idempotence violation", { input, canon, output });
}
```

## Main AST typings
```ts
export type Fragment =
  | { kind: "group"; raw: string; members: Character[] } // square brackets parsed as a group (member list)
  | { kind: "alias"; raw: string } // square brackets parsed as raw alias text
  | { kind: "info"; raw: string }; // round brackets parsed as generic info (non-nestable by policy)

export type Character =
  | { kind: "node"; name: string; fragments: Fragment[] }
  | { kind: "raw"; raw: string };

export type CharacterNode = Extract<Character, { kind: "node" }>;

export type ParseIssue =
  | { code: "MISSING_NAME"; raw: string; path?: string; message?: string }
  | { code: "INVALID_MEMBER_ALIAS_ONLY"; raw: string; path?: string; message?: string }
  | { code: "INVALID_FRAGMENT_ORDER"; raw: string; path?: string; message?: string }
  | { code: "UNMATCHED_ROUND"; raw: string; path?: string; message?: string }
  | { code: "NESTED_ROUND_NOT_ALLOWED"; raw: string; path?: string; message?: string }
  | { code: "UNMATCHED_SQUARE"; raw: string; path?: string; message?: string }
  | { code: "AMBIGUOUS_SQUARE_LIST"; raw: string; path?: string; message?: string }
  | { code: "EXTRA_CLOSING_ROUND"; raw: string; path?: string; message?: string }
  | { code: "EXTRA_CLOSING_SQUARE"; raw: string; path?: string; message?: string };

export type IssueCode = ParseIssue["code"];

export type Dataset = {
  entries: CharacterNode[];
  issuesDetailed: ParseIssue[];
};

``` 