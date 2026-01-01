**Languages:** [English](README.md) | [Italiano](README.it.md)
# parserCharacters.ts
**Conservative structural parser for character lists**

## Problem Description
Given the informal textual grammar adopted by the
[Grand Comics Database (GCD)](https://docs.comics.org/wiki/Main_Page)
to describe the [Character Appearances](https://docs.comics.org/wiki/Character_Appearances),
the goal is to convert a linear textual representation (string) into an AST (Abstract Syntax Tree):

## Proposed Solution
The solution relies on a TypeScript-specific format for defining the AST (Abstract Syntax Tree) along with diagnostics, without using external libraries.
This choice keeps full control over the parser’s conservative behavior and boundary case handling. For the same reason, regular expressions (REGEX) are avoided to prevent interpretative ambiguities and to guarantee deterministic structural analysis.

- ✅ deterministic and conservative parser  
- ✅ each `CharacterNode` exists only once  
- ✅ preserves structural order  
- ✅ produces a canonical textual representation  
- ✅ reports syntactic errors and ambiguities  
- ✅ normalization allowed: trimming and multiple spaces  
- ❌ no input correction  
- ❌ no placeholder insertion  
- ❌ no semantic interpretation  
- ❌ no normalization of names or contents (except space trimming)  
- ❌ no insertion of markers or placeholders  

## Main API Features (parserCharacters.ts)
The module exposes two main functions:

```ts
export function parseDataset(input: string): AST
export function stringifyDataset(dataset: AST): string
```

* `parseDataset` converts a linear representation into a data structure (AST) with diagnostics.  
* `stringifyDataset` produces a canonical textual representation starting from the AST.


## Real Input Example
(from [GCD](https://docs.comics.org/wiki/Character_Appearances)):

```txt
Jimmy Olsen (origin, death);  // Info ()
Superman [Clark Kent; Kal-El];  // Alias []
Justice League [Wonder Woman; Batman [Bruce Wayne]]; // Groups `[...[]...]`
```

The syntax has intrinsic ambiguities, for example:
```txt
Character [alias1; alias2];   // Alias []
GroupName [Member1; Member2];  // Group `[...[]...]`
```

## Main AST Typings
```ts
export type CharacterNode = { name: string; fragments: Fragment[] };

export type Fragment =
  | { type: "group"; raw: string; members: CharacterNode[] }
  | { type: "alias"; raw: string }
  | { type: "info"; raw: string };

export type ParseIssue =
  | { code: "MISSING_NAME"; raw: string }
  | { code: "INVALID_MEMBER_ALIAS_ONLY"; raw: string }
  | { code: "INVALID_FRAGMENT_ORDER"; raw: string }
  | { code: "UNMATCHED_ROUND"; raw: string }
  | { code: "NESTED_ROUND_NOT_ALLOWED"; raw: string }
  | { code: "UNMATCHED_SQUARE"; raw: string }
  | { code: "AMBIGUOUS_SQUARE_LIST"; raw: string }
  | { code: "EXTRA_CLOSING_ROUND"; raw: string }
  | { code: "EXTRA_CLOSING_SQUARE"; raw: string };

export type AST = { entries: CharacterNode[]; issuesDetailed: ParseIssue[] };
```

## Canonical Stress Test (full coverage)
```txt
Alpha (a,b) (c);
Alpha;
Alpha (a);
Beta [X];
Beta [Y] (i1,i2);
Beta [X] (i3);
Gamma [A;B];
Gamma [A; B];
Gamma [A; B; C];
Gamma [A [AA]; B];
Gamma [A; B [BB]];
Delta [One Two];
Delta [One; Two];
Delta [One; Two] (info);
Epsilon [Solo];
Epsilon (info) [Solo];
Epsilon [Solo] (info1, info2);
Zeta (a(b));
Zeta (a,b;
Eta [Unclosed;
Theta (Unclosed;
Iota [A] [B];
Iota [A] (x) [B] (y);
Kappa [M [N [O]]];
Kappa [M; N [O; P]];
Lambda;
Lambda (x);
Lambda (y);
Mu [X; Y] [Z];
Mu [X] [Y; Z];
Nu [A [B; C]; D];
Xi;
Omicron (o1,o2) (o3);
Pi [P1 [P2] (pinfo)];
Rho [R1; R2] (rinfo1, rinfo2);
Sigma [One Two; Three];
Tau [One; Two Three];
Upsilon [A; B] (u1) (u2,u3);
Phi [A; B];
Chi [A [AA] (i1); B];
Psi [A; B] (i);
Omega
```
## Entry Separation
The grammar requires entries to be separated by `;` with the following rules:
* `;` separates only at the top level
* `;` is ignored inside `(...)` and `[...]`
* each entry produces a root `CharacterNode`
* each `CharacterNode` is of three types: Alias `[]`, Info `()`, Groups `[...[]...]`

## Round-trip Idempotence Test
The parser is validated through an idempotence test of the String → AST → String cycle, ensuring the canonical representation is stable (once reached, further conversions cause no changes):

```ts
// indempotenceTest.js
import { parseDataset, stringifyDataset } from "./parserCharacters.js";

function assertIdempotent(input) {
  const canon = stringifyDataset(parseDataset(input));
  const output = stringifyDataset(parseDataset(canon));

  console.assert(canon === output, "Idempotence violation", { input, canon, output });
}
```
