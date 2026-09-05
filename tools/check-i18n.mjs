import fs from "node:fs/promises";

const flatten = (value, prefix = "") => Object.entries(value).flatMap(([key, child]) => {
        const full = prefix ? `${prefix}.${key}` : key;
        return child && typeof child === "object" ? flatten(child, full) : [full];
});

const lang = JSON.parse(await fs.readFile("lang/ru.json", "utf8"));
const available = new Set(flatten(lang));
const files = [];
for (const directory of ["module", "templates"]) {
        for (const name of await fs.readdir(directory)) {
                if (/\.(mjs|hbs)$/.test(name)) files.push(`${directory}/${name}`);
        }
}
const patterns = [
        /(?:localize|t|tf)\(\s*["']([^"']+)["']/g,
        /localize\s+["']([^"']+)["']/g
];
const used = new Map();
for (const file of files) {
        const source = await fs.readFile(file, "utf8");
        for (const pattern of patterns) {
                for (const match of source.matchAll(pattern)) {
                        const key = match[1];
                        if (!key.startsWith("SHINOBI.") && !key.startsWith("TYPES.")) continue;
                        if (!used.has(key)) used.set(key, []);
                        used.get(key).push(file);
                }
        }
}
const missing = [...used.entries()].filter(([key]) => !available.has(key));
if (missing.length) {
        for (const [key, filesForKey] of missing) console.error(`${key}: ${[...new Set(filesForKey)].join(", ")}`);
        process.exitCode = 1;
} else {
        console.log(`Localization keys OK: ${used.size} referenced keys.`);
}
