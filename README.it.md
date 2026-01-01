**Languages:** [English](README.md) | [Italiano](README.it.md)
# parserCharacters
**Parser strutturale conservativo per liste di personaggi**

## Descrizione del problema
Data una grammatica testuale informale adottata dal
[Grand Comics Database (GCD)](https://docs.comics.org/wiki/Main_Page)
per descrivere le
[Character Appearances](https://docs.comics.org/wiki/Character_Appearances)
all’interno delle storie, si intende progettare un parser in grado di convertire
una rappresentazione lineare (stringa di testo) in una struttura dati **AST**
(Abstract Syntax Tree), preservando la massima fedeltà strutturale possibile
e senza introdurre interpretazioni semantiche o correzioni automatiche.


Esempio di input reale (tratto da [GCD](https://docs.comics.org/wiki/Character_Appearances)):

```txt
Green Lantern [John Stewart];
Justice League [Superman [Clark Kent; Kal-El]; Batman [Bruce Wayne]];
Jimmy Olsen (origin, death);
```

## Sintassi supportata
La sintassi supportata dal parser include i seguenti elementi:
- `;` come **separatore** di elementi a livello di lista (flat)
- `[...]` per **alias** oppure **gruppi di membri**
- `(...)` per **informazioni** generiche (non annidabili)
- l’annidamento è consentito **solo** per `[...]` in caso di gruppi
  (come nell’esempio di *Justice League*)
- possibile ambiguità tra alias e gruppo di membri, ad esempio:
  - `Personaggio [Alias1; Alias2; ...]` → alias
  - `Gruppo [Membro1; Membro2; ...]` → gruppo di membri


## Requisiti del parser

### Cosa fa il parser
- ✅ converte la stringa in un AST minimale e deterministico
- ✅ conserva l’ordine strutturale
- ✅ produce una rappresentazione testuale **canonica**
- ✅ segnala errori sintattici e ambiguità tramite `IssueCode` strutturati

### Cosa non fa il parser
- ❌ corregge l’input
- ❌ interpreta semanticamente
- ❌ normalizza nomi o contenuti (eccetto trimming degli spazi)
- ❌ inserisce marker o placeholder


# Soluzione proposta
La soluzione si basa su un formato TypeScript dedicato alla definizione
dell’AST e delle `IssueCode`, accompagnato da un parser implementato
intenzionalmente *da zero*, senza ricorrere a librerie esterne.
Questa scelta consente di mantenere il pieno controllo sul comportamento
conservativo del parser e sulla gestione dei casi limite. Per lo stesso motivo, non viene fatto uso di espressioni regolari (REGEX), evitando ambiguità interpretative e garantendo un’analisi strutturale deterministica.


## Funzionalità principali dell’API (parserCharacters.ts)
Il modulo espone due funzioni principali:

```ts
export function parseDataset(input: string): Dataset
export function stringifyDataset(dataset: Dataset): string
```

* `parseDataset` converte una rappresentazione lineare in una struttura dati (Dataset)
contenente l’AST e le eventuali diagnostiche.
* `stringifyDataset` produce una rappresentazione testuale canonica a partire dal Dataset.

### Round-trip idempotence test
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

## Tipizzazioni principali AST
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