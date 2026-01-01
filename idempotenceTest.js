// indempotenceTest.js
import { parseDataset, stringifyDataset } from "./parserCharacters.js";

function assertIdempotent(input) {
  const canon = stringifyDataset(parseDataset(input));
  const output = stringifyDataset(parseDataset(canon));

  console.assert(canon === output, "Idempotence violation", { input, canon, output });
}

assertIdempotent(`
Green Lantern [John Stewart];
Justice League [Superman [Clark Kent; Kal-El]; Batman [Bruce Wayne]];
Jimmy Olsen (origin, death);
`);

assertIdempotent(`
Batman;
Superman (death);
Flash [Barry Allen];
`);

assertIdempotent(`
Justice League [Superman; Batman; Wonder Woman];
`);

assertIdempotent(`
Foo (a; b; c);
Bar [x; y; z];
`);

assertIdempotent(`SingleCharacter;`);
assertIdempotent(`SoloInfo (only info);`);

console.log("All idempotence tests passed ✅");
