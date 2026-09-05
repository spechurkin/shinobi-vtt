import fs from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist", "shinobi-vtt");
const files = ["system.json", "shinobi.mjs", "README.md", "LICENSE.md"];
const directories = ["assets", "data", "lang", "module", "styles", "templates"];
const packDirectories = ["catalog", "tables", "vehicles"];

await fs.rm(dist, {recursive: true, force: true});
await fs.mkdir(dist, {recursive: true});
for (const file of files) await fs.copyFile(path.join(root, file), path.join(dist, file));
for (const directory of directories) {
        await fs.cp(path.join(root, directory), path.join(dist, directory), {recursive: true, force: true});
}
await fs.mkdir(path.join(dist, "packs"), {recursive: true});
for (const pack of packDirectories) {
        await fs.cp(path.join(root, "packs", pack), path.join(dist, "packs", pack), {
                recursive: true,
                force: true,
                filter: sourcePath => {
                        const name = path.basename(sourcePath);
                        return name !== "lost" && name !== "LOCK" && !/^\d+\.log$/.test(name);
                }
        });
}
const manifest = JSON.parse(await fs.readFile(path.join(dist, "system.json"), "utf8"));
await fs.writeFile(path.join(root, "dist", "build-info.json"), JSON.stringify({
        system: manifest.id,
        version: manifest.version,
        builtAt: new Date().toISOString(),
        included: [...files, ...directories, ...packDirectories.map(pack => `packs/${pack}`)]
}, null, 2) + "\n");
console.log(`Built ${manifest.id} ${manifest.version} in ${path.relative(root, dist)}`);
