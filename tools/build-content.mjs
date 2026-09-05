import fs from "node:fs/promises";
import crypto from "node:crypto";
import {AUGMENT_KEYS, ROOT, SKILLS} from "../module/config.mjs";

const source = JSON.parse(await fs.readFile("tmp/pdfs/source-tables.json", "utf8"));
const descriptions = JSON.parse(await fs.readFile("tmp/pdfs/descriptions.json", "utf8"));
const id = s => crypto.createHash("sha256").update(s).digest("hex").slice(0, 16);
const norm = s => s.toLowerCase().replace(/ё/g, "е").replace(/[^а-яa-z0-9]/g, "");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
}[c]));
const tableMap = new Map();
for (const t of source) {
        if (!t.code) throw Error(`Table without ID: page ${t.page}`);
        const old = tableMap.get(t.code);
        const special = t.code === "C-16";
        const rows = t.rows.slice(special ? 1 : 2);
        if (old) {
                old.rows.push(...rows);
                old.pages.push(t.page);
        } else tableMap.set(t.code, {
                code: t.code,
                page: t.page,
                pages: [t.page],
                header: special ? ["d6", "d6", "Название 1", "Название 2", "Черта 1", "Черта 2", "Тип"] : t.rows[1],
                rows
        });
}
const titles = {
        A: ["Базовый концепт", "Навыки", "Классы аугментаций", "Определение аугментаций", "Аугментации класса А", "Аугментации класса B", "Аугментации класса C", "Аугментации класса D", "Мужские имена", "Женские имена", "Предыстория персонажа", "Одежда персонажа", "Мотивация персонажа", "Особые черты", "Контакты", "Личностные проблемы", "Стартовый капитал шиноби", "Стоимость случайных товаров", "Цены на оружие", "Лёгкое оружие", "Боеприпасы для дробовика", "Тяжёлое оружие", "Цены на медицинские товары и услуги", "Цены на киберимпланты", "Цены на еду", "Цены на жильё", "Затраты на образ жизни", "Проезд на транспорте", "Стоимость транспортных средств", "Цены на кибердеки", "Цены на компьютеры", "Цены на ПО", "Цены на ЛЕДорубы", "Цены на технические устройства", "Цены на инструменты", "Оборудование для слежки", "Цены на нелегальные услуги", "Цены на лекарства", "Цены на наркотики"],
        B: ["Определение успеха", "Ранговая система", "Очки за миссию", "Корпоративный счёт", "Структура боевого раунда", "Боевые модификаторы", "Эффект от урона", "Урон от падений и столкновений", "Модификаторы вождения", "Урон транспорта", "Движение по улицам", "Скорость личного транспорта", "Скорость общественного транспорта", "Таблица случайных встреч", "Таблица реакции", "Группа реагирования", "Размер группы реагирования", "Скорость в здании", "Уровни систем безопасности", "Пешие патрули", "Виды замков", "Типы сетей", "Провал атаки на ЛЁД", "Еженедельные траты", "Получение сведений"],
        C: ["Тип сектора", "Конфликт в секторе", "События в секторе", "Трафик: нежилые территории / промзона", "Трафик: даунтаун / застраивающийся район", "Трафик: муравейник / деловой центр", "Здания в секторе", "Особенности зданий", "Элементы интерьера", "Бизнес в секторе", "Что бросается в глаза?", "Что на дороге?", "Чьи-то случайные черты", "Задания, связанные с людьми", "Задания, связанные с предметами", "Генератор уличных банд", "Деятельность уличных банд"]
};
for (const t of tableMap.values()) t.title = t.code === "A-11.2" ? "Таблица вражды" : titles[t.code[0]][parseInt(t.code.slice(2)) - 1];
const link = page => `Шиноби, с. ${page}`;
const description = (name, page, alias = name) => {
        const entry = descriptions.find(d => norm(d.name) === norm(alias));
        return (entry ? `<p>${esc(entry.body)}</p>` : "") + `<p class="source">${link(entry?.page ?? page)}</p>`;
};
const catalog = [];

function item(name, type, data = {}, alias = name) {
        name = name.replace(/\s+/g, " ").trim();
        const key = data.key ?? id(name);
        const result = {
                _id: id(`item:${type}:${name}`),
                name,
                type,
                img: `${ROOT}/assets/icons/${type}.svg`,
                system: {key, page: data.page ?? 0, description: description(name, data.page ?? 0, alias), ...data},
                effects: [],
                ownership: {default: 0},
                flags: {"shinobi-vtt": {source: "Шиноби, 2023"}}
        };
        catalog.push(result);
        return result;
}

for (const [key, name] of Object.entries(SKILLS)) item(name, "skill", {key, skill: key, slots: 0, page: 14});

function rowsFor(code) {
        return tableMap.get(code).rows;
}

function d66Rows(t) {
        const output = [];
        const offsets = t.header[3] === "d6" ? [0, 3] : [0];
        for (const offset of offsets) {
                let group = "";
                for (const row of t.rows) {
                        if (row[offset]) group = row[offset];
                        if (group === "6" && row[offset + 1] === "-") {
                                output.push({range: [61, 66], values: ["Переброс"]});
                                continue;
                        }
                        if (!/^[1-6](?:-[1-6])?$/.test(group) || !/^[1-6]$/.test(row[offset + 1])) continue;
                        const [min, max] = group.split("-").map(Number);
                        for (let first = min; first <= (max ?? min); first++) output.push({
                                range: [first * 10 + Number(row[offset + 1]), first * 10 + Number(row[offset + 1])],
                                values: row.slice(offset + 2, offsets.length === 2 ? offset + 3 : undefined)
                        });
                }
        }
        return output;
}

for (const [code, grade] of [["A-05", "A"], ["A-06", "B"], ["A-07", "C"], ["A-08", "D"]]) {
        const names = grade === "A" || grade === "B" ? rowsFor(code).map(r => r[1]) : [...new Set(d66Rows(tableMap.get(code)).map(r => r.values[0]))];
        for (const name of names) item(name, "augmentation", {
                key: AUGMENT_KEYS[name] ?? id(name),
                class: grade,
                price: {A: 5000000, B: 2000000, C: 1000000, D: 500000}[grade],
                slots: 0,
                page: tableMap.get(code).page,
                grantedSkill: name === "Мышечная матрица" ? "strength" : ""
        });
}
const prices = new Map();
for (const code of ["A-19", "A-23", "A-24", "A-25", "A-26", "A-27", "A-28", "A-29", "A-31", "A-32", "A-33", "A-34", "A-35", "A-36", "A-37", "A-38", "A-39"]) {
        for (const row of rowsFor(code)) if (/¥/.test(row[1])) prices.set(norm(row[0]), {
                name: row[0],
                price: Number(row[1].replace(/\D/g, "")),
                page: tableMap.get(code).page,
                code
        });
}
const weaponExtras = {
        "Холодное оружие": {skill: "bujutsu", slots: 1},
        "Баллончик с Д-газом": {damage: "0", damageType: "effect", slots: 1},
        "Пистолет": {slots: 1},
        "Пистолет — пулемёт": {slots: 2, attacks: 2},
        "Автомат": {slots: 2, attacks: 2},
        "Дробовик": {slots: 2, damage: "2d6", range: 20, hitBonus: 1, category: "shotgun"},
        "Лёгкое противотанковое орудие": {slots: 2},
        "Огнемёт": {slots: 2, attacks: 2},
        "Гранатомёт": {slots: 2, damage: "3d6", category: "launcher"},
        "Снайперская винтовка": {slots: 2},
        "Пулемёт": {slots: 2, attacks: 5}
};
for (const code of ["A-20", "A-22"]) {
        for (const row of rowsFor(code)) {
                const name = row[0].startsWith("Холодное") ? "Холодное оружие" : row[0].replace(/\*/g, "");
                const magazine = parseInt(row[3]) || 0;
                const price = prices.get(norm(name))?.price ?? 5000;
                const obj = item(name, "weapon", {
                        page: tableMap.get(code).page,
                        price,
                        skill: code === "A-22" ? "heavyWeapons" : "lightWeapons",
                        damage: /\dd6/.test(row[1]) ? row[1] : "0",
                        range: parseInt(row[2]) || 0,
                        magazine: {value: magazine, max: magazine || 1},
                        usesAmmo: magazine > 0,
                        ammoType: code === "A-22" ? "heavy" : "light",
                        attacks: 1,
                        notes: row[4] === "-" ? "" : row[4], ...weaponExtras[name]
                });
                obj.system.description = `<p>${esc(row.join(" · "))}</p>` + obj.system.description;
        }
}
const grenadeNames = {
        "Дымовая граната": "Дымовая",
        "Светошумовая граната": "Светошумовая",
        "Граната с Д-газом": "С Д-газом",
        "Осколочная граната": "Осколочная",
        "Напалмовая граната": "Напалмовая",
        "Противопехотная мина": "Противопехотная",
        "Магнитная мина": "Магнитная"
};
const grenades = {
        "Осколочная граната": "3d6",
        "Напалмовая граната": "2d6",
        "Противопехотная мина": "2d6",
        "Магнитная мина": "6d6"
};
for (const data of prices.values()) {
        let {name, price, page, code} = data;
        if (catalog.some(i => norm(i.name) === norm(name))) continue;
        let type = "gear", extras = {};
        if (code === "A-29") continue;
        if (code === "A-19") {
                if (/жилет|костюм/.test(name)) {
                        type = "armor";
                        extras.slots = 1;
                } else if (/Амуниция/.test(name)) {
                        type = "ammo";
                        extras.ammoType = /тяж/.test(name) ? "heavy" : "light";
                } else if (grenadeNames[name]) {
                        type = "weapon";
                        extras = {
                                skill: "explosives",
                                category: "explosive",
                                damage: grenades[name] ?? "0",
                                damageType: grenades[name] ? "damage" : "effect",
                                range: /мина/.test(name) ? 0 : 20,
                                usesAmmo: false,
                                slots: 1
                        };
                }
        }
        if (code === "A-24") {
                type = "augmentation";
                extras = {class: "", slots: 0};
        }
        if (["A-25", "A-26", "A-27", "A-28", "A-37"].includes(code) || /Операция|Изменение лица|сканирование тела|Реанимация|Реконструкция|Создание своего клона/.test(name)) {
                type = "service";
                extras.slots = 0;
        }
        if (code === "A-32" || code === "A-33") {
                type = "program";
                extras.slots = 0;
                if (code === "A-33") {
                        extras.level = parseInt(name);
                        name = `ЛЕДоруб ${extras.level}-го уровня`;
                        extras.category = "icebreaker";
                }
        }
        if (code === "A-38" || code === "A-39") {
                type = "drug";
                extras = {doses: code === "A-38" ? 6 : 1, category: code === "A-38" ? "medicine" : "designer"};
        }
        if (name === "Смарт-карта") extras.slots = 0;
        item(name, type, {price, page, ...extras}, grenadeNames[name] ?? name);
}
for (const row of rowsFor("A-30")) item(row[0], "deck", {
        price: Number(row[2].replace(/\D/g, "")),
        deckSlots: Number(row[1]),
        slots: 1,
        page: 36
});
item("Мини-гарнитура", "gear", {
        slots: 0,
        page: 30,
        notes: "Стартовая гарнитура. Радиус 100 м.",
        description: `<p>Каждый шиноби начинает игру с пистолетом и мини-гарнитурой с радиусом действия 100 метров.</p><p>${link(30)}</p>`
});
// Shotgun cartridges retain the separate effects from A-21.
for (let i = 0; i < rowsFor("A-21").length; i += 2) {
        const row = rowsFor("A-21")[i];
        item(`Дробовик: ${row[0]}`, "ammo", {
                ammoType: "shotgun",
                page: 32,
                damage: row[1],
                range: parseInt(row[2]),
                description: `<p>${esc(rowsFor("A-21")[i + 1].join(" "))}</p><p>${link(32)}</p>`
        });
}
// Fix OCR line wraps in the names, while preserving the full original in the PDF.
for (const entry of catalog) {
        entry.name = entry.name.replace("ангиотензинпре-вращающего", "ангиотензинпревращающего");
}
const concepts = rowsFor("A-01").map(row => ({
        name: row[2],
        skill: Object.keys(SKILLS).find(k => SKILLS[k] === row[3]) ?? "",
        skillText: row[3],
        equipment: row[4],
        description: description(row[2], 10)
}));
const rolls = [];
for (const t of tableMap.values()) {
        if (!/^(?:d6|2d6)$/.test(t.header[0])) continue;
        const isD66 = t.header[1] === "d6";
        const rows = isD66 ? d66Rows(t) : t.rows.map(r => ({
                range: r[0].split("-").map(Number),
                values: r.slice(1)
        })).filter(r => r.range.every(Number.isFinite));
        const independent = /^C-(02|03|09|10|14|15|16|17)$/.test(t.code);
        const columns = independent ? Array.from({length: rows[0]?.values.length ?? 0}, (_, i) => i) : [-1];
        for (const col of columns) {
                const label = col < 0 ? "" : t.header[(isD66 ? 2 : 1) + col] || `Часть ${col + 1}`;
                if (independent && t.code === "C-03" && col === 1) continue;
                const name = `${t.code}: ${t.title}${col < 0 ? "" : ` · ${label}`}`;
                const results = rows.map((row, i) => ({
                        _id: id(`${name}:${i}`),
                        type: "text",
                        description: esc(col < 0 ? row.values.join(" · ") : row.values[col] ?? ""),
                        range: [row.range[0], row.range[1] ?? row.range[0]],
                        weight: 1,
                        drawn: false,
                        img: "icons/svg/d20-grey.svg"
                }));
                if (results.some(r => !r.description)) throw Error(`Empty result in ${name}`);
                rolls.push({
                        _id: id(name),
                        name,
                        description: `<p>${link(t.page)}</p>`,
                        img: "icons/svg/d20-grey.svg",
                        formula: isD66 ? "1d6 * 10 + 1d6" : t.header[0] === "2d6" ? "2d6" : "1d6",
                        replacement: true,
                        displayRoll: true,
                        results,
                        flags: {"shinobi-vtt": {code: t.code, column: col, page: t.page}}
                });
        }
}
const vehicles = rowsFor("A-29").map(row => {
        const name = row[0].split(".")[0];
        const size = /Мотоцикл|Спортбайк/.test(name) ? "small" : /Бронетранспортёр/.test(name) ? "large" : "medium";
        return {
                _id: id(name),
                name,
                type: "vehicle",
                img: `${ROOT}/assets/icons/vehicle.svg`,
                system: {
                        size,
                        price: Number(row[1].replace(/\D/g, "")),
                        speed: row[2] === "Медленный" ? "slow" : row[2] === "Быстрый" ? "fast" : "veryFast",
                        armored: /Бронированный|Бронетранспортёр/.test(name),
                        notes: row[0]
                },
                items: [],
                effects: []
        };
});
for (const [name, data] of [["catalog", catalog], ["tables", rolls], ["vehicles", vehicles]]) {
        const dir = `packs/_source/${name}`;
        await fs.mkdir(dir, {recursive: true});
        const expected = new Set(data.map(d => `${d._id}.json`));
        for (const name of await fs.readdir(dir)) if (/^[a-f0-9]{16}\.json$/.test(name) && !expected.has(name)) await fs.unlink(`${dir}/${name}`);
        for (const obj of data) {
                const copy = structuredClone(obj);
                const collection = {catalog: "items", tables: "tables", vehicles: "actors"}[name];
                copy._key = `!${collection}!${copy._id}`;
                for (const child of copy.results ?? []) child._key = `!tables.results!${copy._id}.${child._id}`;
                await fs.writeFile(`${dir}/${obj._id}.json`, JSON.stringify(copy, null, 2) + "\n");
        }
}
await fs.writeFile("data/catalog.json", JSON.stringify(catalog, null, 2) + "\n");
await fs.writeFile("data/concepts.json", JSON.stringify(concepts, null, 2) + "\n");
await fs.writeFile("data/roll-tables.json", JSON.stringify(rolls, null, 2) + "\n");
console.log(`${catalog.length} items, ${concepts.length} concepts, ${tableMap.size} reference tables, ${rolls.length} roll tables, ${vehicles.length} vehicles.`);
