**Languages:** [English](README.md) | [Italiano](README.it.md)
# parserCharacters.ts
**Parser strutturale conservativo per liste di personaggi**

## Descrizione del problema
Data una grammatica testuale informale adottata dal
[Grand Comics Database (GCD)](https://docs.comics.org/wiki/Main_Page)
per descrivere le
[Character Appearances](https://docs.comics.org/wiki/Character_Appearances).
L’obiettivo è convertire una rappresentazione testuale lineare (stringa) in un AST (Abstract Syntax Tree):

## Soluzione proposta
La soluzione si basa su un formato TypeScript dedicato alla definizione
dell’AST (Abstract Syntax Tree) contenente la diagnostica senza uso di librerie esterne.
Questa scelta consente di mantenere il pieno controllo sul comportamento
conservativo del parser e sulla gestione dei casi limite. Per lo stesso motivo, non viene fatto uso di espressioni regolari (REGEX), evitando ambiguità interpretative e garantendo un’analisi strutturale deterministica.

- ✅ Parser deterministico e conservativo
- ✅ Ogni CharacterNode esiste una sola volta.
- ✅ conserva l’ordine strutturale
- ✅ produce una rappresentazione testuale canonica
- ✅ segnala errori sintattici e ambiguità
- ✅ Normalizzazione ammessa: trimming e spazi multipli
- ❌ Nessuna correzione dell’input
- ❌ Nessun inserimento di placeholder
- ❌ Nessuna interpretazione semantica
- ❌ Nessuna normalizzazione di nomi o contenuti (eccetto trimming degli spazi)
- ❌ Nessun inserimento di marker o placeholder
## Funzionalità principali dell’API (parserCharacters.ts)
Il modulo espone due funzioni principali:

```ts
export function parseDataset(input: string): AST
export function stringifyDataset(dataset: AST): string
```

* `parseDataset` converte una rappresentazione lineare in una struttura dati (AST) comprensiva di diagnostica.
* `stringifyDataset` produce una rappresentazione testuale canonica a partire dall' AST.


## Esempio di input reale 
(tratto da [GCD](https://docs.comics.org/wiki/Character_Appearances)):

```txt
Jimmy Olsen (origin, death);  // Info ()
Superman [Clark Kent; Kal-El];  // Alias []
Justice League [Wonder Woman; Batman [Bruce Wayne]]; // Gruppi `[...[]...]`
```

La sintassi possiede ambiguità intrinseche, ad esempio:
```txt
Personaggio [alias1; alias2];   // Alias []
NomeGruppo [Membro1; Membro2];  // Gruppo `[...[]...]`
```

## Tipizzazioni principali AST
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

## Stress Test Canonico (full-coverage)
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
La grammatica prevede che le entry siano separate da `;` con le seguenti regole:
* `;` separa solo a livello top-level
* `;` è ignorato dentro `(...)` e `[...]`
* Ogni entry produce un `CharacterNode` root
* Ogni `CharacterNode` è di tre tipi: Alias `[]`, Info `()`, Gruppi `[...[]...]`

## Round-trip idempotence test
Il parser viene validato tramite un test di idempotenza del ciclo
String → AST → String, verificando che la rappresentazione canonica
sia stabile (una volta raggiunta, ulteriori conversioni non producono
modifiche):

```ts
// indempotenceTest.js
import { parseDataset, stringifyDataset } from "./parserCharacters.js";

function assertIdempotent(input) {
  const canon = stringifyDataset(parseDataset(input));
  const output = stringifyDataset(parseDataset(canon));

  console.assert(canon === output, "Idempotence violation", { input, canon, output });
}
```