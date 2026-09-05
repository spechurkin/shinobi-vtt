import {pathToFileURL} from "node:url";
import path from "node:path";
import fs from "node:fs/promises";

let compilePack;
try {
        ({compilePack} = await import("@foundryvtt/foundryvtt-cli"));
} catch {
        if (!process.env.FVTT_CLI) throw Error("Install npm dependencies or set FVTT_CLI to the official CLI index.mjs.");
        ({compilePack} = await import(pathToFileURL(process.env.FVTT_CLI)));
}
for (const name of ["catalog", "tables", "vehicles"]) {
        await fs.mkdir("packs", {recursive: true});
        await compilePack(path.resolve(`packs/_source/${name}`), path.resolve(`packs/${name}`), {log: false});
        console.log(`Packed ${name}`);
}
