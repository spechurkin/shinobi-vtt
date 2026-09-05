import {escapeHTML as h, ID, ROOT, SKILLS} from "./config.mjs";
import {t} from "./i18n.mjs";
import {promptForm, rollMode, selectHTML} from "./dice.mjs";

let cache;

export async function content() {
        return cache ??= Promise.all(["catalog", "concepts", "roll-tables"].map(async name => {
                const response = await fetch(`${ROOT}/data/${name}.json`);
                if (!response.ok) throw Error(`${t("errors.contentLoad")}: ${name} (${response.status})`);
                return response.json();
        })).then(([catalog, concepts, tables]) => ({catalog, concepts, tables}));
}

export function itemCopy(data) {
        const copy = foundry.utils.deepClone(data);
        delete copy._id;
        delete copy.ownership;
        delete copy.folder;
        return copy;
}

export async function addCatalogItem(actor, id) {
        if (!actor?.isOwner) return;
        const {catalog} = await content();
        const item = catalog.find(i => i._id === id);
        if (!item) return;
        if (["skill", "augmentation"].includes(item.type) && actor.items.some(i => i.type === item.type && i.system.key === item.system.key)) return ui.notifications.warn(t("messages.duplicateEntry"));
        return actor.createEmbeddedDocuments("Item", [itemCopy(item)]);
}

export async function drawSource(code, {chat = true, mode = rollMode()} = {}) {
        const {tables} = await content();
        const matches = tables.filter(t => t.flags[ID].code === code);
        const outputs = [];
        for (const table of matches) {
                const roll = await new Roll(table.formula).evaluate();
                const result = table.results.find(r => roll.total >= r.range[0] && roll.total <= r.range[1]);
                if (!result) throw Error(`${t("errors.contentResult")}: ${code} (${roll.total})`);
                const text = result.description.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
                outputs.push(text);
                if (chat) await ChatMessage.create({
                        content: `<div class="shinobi-chat"><header>${h(table.name)}</header><p>${h(text)}</p></div>`,
                        rolls: [roll]
                }, {messageMode: mode});
        }
        return outputs.join(" · ");
}

const die = async () => (await new Roll("1d6").evaluate()).total;

export async function generateCharacter() {
        const {catalog, concepts} = await content();
        const form = await promptForm(t("generator.title"), `<div class="form-group"><label>${t("generator.concept")}</label>${selectHTML("concept", {"random": "SHINOBI.generator.random", ...Object.fromEntries(concepts.map((c, i) => [i, c.name]))})}</div><div class="form-group"><label>${t("generator.name")}</label>${selectHTML("nameTable", {
                "A-09": "SHINOBI.generator.male",
                "A-10": "SHINOBI.generator.female"
        })}</div><div class="form-group"><label>${t("generator.faction")}</label>${selectHTML("faction", {
                zaibatsu: "SHINOBI.factions.zaibatsu",
                yakuza: "SHINOBI.factions.yakuza",
                freelance: "SHINOBI.factions.freelance"
        })}</div><div class="form-group"><label>${t("generator.martial")}</label>${selectHTML("martial", {
                karate: "SHINOBI.skills.karate",
                aikido: "SHINOBI.skills.aikido",
                bujutsu: "SHINOBI.skills.bujutsu",
                nekode: "SHINOBI.skills.nekode"
        })}</div><div class="form-group"><label>${t("generator.weapon")}</label>${selectHTML("weapon", {
                "Пистолет": "Пистолет",
                "Пистолет — пулемёт": "Пистолет-пулемёт",
                "Автомат": "Автомат",
                "Дробовик": "Дробовик",
                "Баллончик с Д-газом": "Баллончик с Д-газом",
                "Холодное оружие": "Холодное оружие"
        })}</div>`, t("generator.create"));
        if (!form) return;
        const index = form.concept === "random" ? Math.floor(((await die()) - 1) / 2) * 6 + (await die()) - 1 : Number(form.concept);
        const concept = concepts[index];
        let conceptSkill = concept.skill;
        if (concept.name === "Коммандо") conceptSkill = (await die()) <= 3 ? "heavyWeapons" : "explosives";
        const skillKeys = Object.keys(SKILLS), skills = new Set();
        while (skills.size < 5) {
                const n = ((await die()) - 1) * 6 + (await die()) - 1;
                const key = skillKeys[n];
                if (key && key !== conceptSkill) skills.add(key);
        }
        if ((conceptSkill === "chanbara" || skills.has("chanbara")) && conceptSkill !== form.martial && !skills.has(form.martial)) {
                skills.delete([...skills].find(k => k !== "chanbara"));
                skills.add(form.martial);
        }
        const items = [...skills].map(k => itemCopy(catalog.find(i => i.type === "skill" && i.system.skill === k)));
        const augRoll = await die();
        const grades = {
                1: ["A"],
                2: ["B", "D"],
                3: ["C", "C"],
                4: ["C", "D", "D"],
                5: ["D", "D", "D", "D"],
                6: ["D", "D", "D", "D"]
        }[augRoll];
        for (const grade of grades) {
                const all = catalog.filter(i => i.type === "augmentation" && i.system.class === grade);
                let picked;
                do {
                        picked = all[Math.min(all.length - 1, Math.floor(((await die()) - 1) * all.length / 6) + (all.length > 6 ? Math.floor(((await die()) - 1) / 3) : 0))];
                } while (items.some(i => i.system.key === picked.system.key));
                items.push(itemCopy(picked));
        }
        const add = (name, quantity = 1) => {
                const entry = catalog.find(i => i.name === name || i.name.startsWith(name + " ("));
                if (entry) {
                        const copy = itemCopy(entry);
                        copy.system.quantity = quantity;
                        items.push(copy);
                }
        };
        add("Пистолет");
        add("Мини-гарнитура");
        const gear = {
                "Ассасин": form.weapon,
                "Буракумин": "Холодное оружие",
                "Бегущий по лезвию": "Эмпатоскоп",
                "Студент": "Amstrad C-22",
                "Делец": "Чемоданчик гримёра",
                "Следователь": "Следящий приёмо-передатчик",
                "Автоугонщик": "Отмычки",
                "Ниндзя": "Дешифратор электронных замков",
                "Торговец органами": "Дробовик",
                "Техник": "Мультиинструмент",
                "Террорист": "Магнитная мина",
                "Самурай": "Скрытый кевларовый жилет",
                "Сарариман": "Amstrad C-22",
                "Нетраннер": "Toshiba Paraline 3030",
                "Коммандо": conceptSkill === "heavyWeapons" ? "Лёгкое противотанковое орудие" : "Магнитная мина",
                "Якудза": form.weapon
        };
        if (gear[concept.name]) add(gear[concept.name], concept.name === "Террорист" ? 2 : 1);
        if (concept.name === "Следователь") add("Жучок", 3);
        const social = [conceptSkill, ...skills].some(k => ["zaibatsu", "yakuza"].includes(k));
        const contactCount = 1 + (social ? Math.ceil((await die()) / 2) : 0);
        for (let i = 0; i < contactCount; i++) items.push({
                name: await drawSource("A-15", {chat: false}),
                type: "contact",
                img: `${ROOT}/assets/icons/contact.svg`,
                system: {slots: 0, relation: "Начальный контакт"}
        });
        let background = await drawSource("A-11.1", {chat: false});
        if (background.includes("Таблица вражды")) background += "\n" + await drawSource("A-11.2", {chat: false});
        const actor = await Actor.create({
                name: (await drawSource(form.nameTable, {chat: false})), type: "character", system: {
                        concept: concept.name,
                        conceptSkill,
                        faction: form.faction,
                        clothing: await drawSource("A-12", {chat: false}),
                        trait: await drawSource("A-14", {chat: false}),
                        motivation: await drawSource("A-13", {chat: false}),
                        problem: await drawSource("A-16", {chat: false}),
                        background,
                        money: [20000, 20000, 30000, 30000, 40000, 40000][(await die()) - 1],
                        createdByGenerator: true,
                        notes: concept.name === "Уличный хирург" ? "Дополнительно ¥20 000 на дизайнерские наркотики — выберите препараты отдельно." : ""
                }, items
        });
        await actor.sheet.render(true);
        return actor;
}
