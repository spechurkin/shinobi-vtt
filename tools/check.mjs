import fs from "node:fs/promises";
import {execFileSync} from "node:child_process";
import path from "node:path";

const roots = ["module", "tools"];
const files = ["shinobi.mjs"];
for (const root of roots) for (const name of await fs.readdir(root)) if (name.endsWith(".mjs")) files.push(`${root}/${name}`);
for (const file of files) execFileSync(process.execPath, ["--check", file]);
execFileSync(process.execPath, ["tools/check-i18n.mjs"], {stdio: "inherit"});
const manifest = JSON.parse(await fs.readFile("system.json", "utf8"));
for (const file of [...manifest.esmodules, ...manifest.styles, ...manifest.languages.map(l => l.path), manifest.background.replace("systems/shinobi-vtt/", "")]) await fs.access(file);
for (const file of await fs.readdir("templates")) {
        const text = await fs.readFile(path.join("templates", file), "utf8");
        if (/<\/?form\b/i.test(text)) throw Error(`Nested form: ${file}`);
}
for (const file of ["templates/actor.hbs", "templates/item.hbs"]) {
        const text = await fs.readFile(file, "utf8");
        if (!text.includes('name="system.notes"') || !text.includes("<prose-mirror")) throw Error(`Notes editor missing: ${file}`);
        if (text.includes("document-uuid=") || text.includes("collaborate=")) throw Error(`Local notes editor must not enable collaboration: ${file}`);
        if (/<h(?:1|3|4|5|6)\b/i.test(text)) throw Error(`Use h2 for sheet headings: ${file}`);
}
const actorTemplate = await fs.readFile("templates/actor.hbs", "utf8");
if (!/<div class="ammo-row"[\s\S]*?data-action="itemDelete"/.test(actorTemplate)) throw Error("Ammo delete action missing");
if (!/<table class="weapons-table">[\s\S]*?<div class="weapon-actions">[\s\S]*?data-action="itemEdit"[\s\S]*?data-action="itemDelete"/.test(actorTemplate)) throw Error("Weapon actions missing or out of order");
for (const pack of manifest.packs) await fs.access(pack.path);
console.log(`Syntax OK: ${files.length} modules. Manifest paths and form ownership OK.`);
