import {escapeHTML as h, ID, ITEM_TYPES, options, ROOT, SKILLS} from "./config.mjs";
import {t, tf} from "./i18n.mjs";
import {addCatalogItem, content, drawSource, generateCharacter} from "./content.mjs";
import {promptForm, rollMode, selectHTML, simpleRoll} from "./dice.mjs";
import {corporateAccount} from "./rules.mjs";

const {HandlebarsApplicationMixin, ApplicationV2} = foundry.applications.api;

export class ShinobiLibrary extends HandlebarsApplicationMixin(ApplicationV2) {
        static DEFAULT_OPTIONS = {
                classes: ["shinobi", "shinobi-library"],
                position: {width: 830, height: 820},
                window: {title: t("settings.library.name"), resizable: true, icon: "fa-solid fa-box-archive"},
                actions: {add: this.add, inspect: this.inspect, generate: this.generate}
        };
        static PARTS = {main: {template: `${ROOT}/templates/library.hbs`, scrollable: [".catalog-grid"]}};

        constructor(options = {}) {
                super(options);
                this.actor = options.actor;
        }

        static async add(event, target) {
                if (this.actor?.isOwner) await addCatalogItem(this.actor, target.closest("[data-catalog-id]").dataset.catalogId);
        }

        static async inspect(event, target) {
                const item = await game.packs.get(`${ID}.catalog`).getDocument(target.closest("[data-catalog-id]").dataset.catalogId);
                return item.sheet.render(true);
        }

        static generate() {
                return generateCharacter();
        }

        async _prepareContext() {
                const {catalog} = await content();
                return {
                        items: catalog.map(i => ({
                                ...i,
                                typeLabel: game.i18n.localize(ITEM_TYPES[i.type]),
                                search: `${i.name} ${game.i18n.localize(ITEM_TYPES[i.type])}`.toLowerCase(),
                                price: i.system.price?.toLocaleString("ru-RU") ?? "0"
                        })),
                        types: options({"": "SHINOBI.library.allTypes", ...ITEM_TYPES}, ""),
                        actor: this.actor,
                        canAdd: this.actor?.isOwner
                };
        }

        _onRender(context, options) {
                super._onRender(context, options);
                const el = this.element;
                const filter = () => {
                        const q = el.querySelector("[data-search]").value.toLowerCase(),
                                type = el.querySelector("[data-filter]").value;
                        for (const row of el.querySelectorAll("[data-catalog-id]")) row.hidden = !(row.dataset.search.includes(q) && (!type || row.dataset.type === type));
                };
                el.querySelector("[data-search]").addEventListener("input", filter);
                el.querySelector("[data-filter]").addEventListener("change", filter);
                for (const row of el.querySelectorAll("[draggable]")) row.addEventListener("dragstart", event => event.dataTransfer.setData("text/plain", JSON.stringify({
                        type: "Item",
                        uuid: `Compendium.${ID}.catalog.Item.${row.dataset.catalogId}`
                })));
        }
}

export class ShinobiTools extends HandlebarsApplicationMixin(ApplicationV2) {
        static DEFAULT_OPTIONS = {
                classes: ["shinobi", "shinobi-tools"],
                position: {width: 730, height: 760},
                window: {title: t("settings.tools.name"), resizable: true, icon: "fa-solid fa-dice"},
                actions: {rollTable: this.rollTable, tool: this.tool, generate: this.generate}
        };
        static PARTS = {main: {template: `${ROOT}/templates/tools.hbs`, scrollable: [".shinobi-scroll"]}};

        constructor(options = {}) {
                super(options);
                this.actor = options.actor;
        }

        static async rollTable(event, target) {
                return drawSource(target.dataset.code, {mode: game.user.isGM ? "gm" : rollMode()});
        }

        static generate() {
                return generateCharacter();
        }

        static async tool(event, target) {
                const action = target.dataset.tool, actor = this.actor ?? canvas.tokens.controlled[0]?.actor;
                if (["initiative", "phase", "time", "encounter", "scatter", "patrol", "camera", "corporate", "reaction", "surprise", "lock", "opposed"].includes(action) && !game.user.isGM) return;
                if (action === "surprise") return simpleRoll("1d6", t("tables.surprise"), actor, {mode: "gm"});
                if (action === "initiative") return game.combat?.rollInitiative();
                if (action === "phase") {
                        if (game.combat) await game.combat.setFlag(ID, "phase", ((game.combat.getFlag(ID, "phase") ?? 0) + 1) % 5);
                        return this.render();
                }
                if (action === "reaction") {
                        const f = await promptForm(t("dialogs.reaction"), `<div class="form-group"><label>${t("forms.modifier")}</label><input name="modifier" type="number" value="${actor?.derived?.career ? actor.system.lifestyle - actor.derived.career.lifestyle : 0}"></div>`);
                        if (!f) return;
                        const roll = await new Roll(`2d6 + ${Number(f.modifier)}`).evaluate();
                        const value = Math.min(12, Math.max(2, roll.total));
                        const table = (await content()).tables.find(t => t.flags[ID].code === "B-15"),
                                result = table.results.find(r => value >= r.range[0] && value <= r.range[1]);
                        return ChatMessage.create({
                                content: `<div class="shinobi-chat"><header>${t("tables.reaction")}</header><p>${result.description}</p></div>`,
                                rolls: [roll]
                        }, {messageMode: "gm"});
                }
                if (action === "encounter") {
                        const r = await simpleRoll("1d6", t("tables.encounter"), null, {mode: "gm"});
                        if (r.total === 1) {
                                await drawSource("B-14", {mode: "gm"});
                                await simpleRoll("2d6 * 5", t("tables.distance"), null, {mode: "gm"});
                        }
                        return;
                }
                if (action === "scatter") {
                        let roll;
                        do {
                                roll = await new Roll("1d6").evaluate();
                        } while (roll.total === 6);
                        const scatter = ["", t("tables.scatterFar"), t("tables.scatterLeft"), t("tables.scatterRight"), t("tables.scatterShort"), t("tables.scatterHit")][roll.total];
                        await roll.toMessage({flavor: tf("tables.scatter", {result: scatter})}, {messageMode: "gm"});
                        if (roll.total !== 5) await simpleRoll("2d6", t("tables.scatterDistance"), null, {mode: "gm"});
                        return;
                }
                if (action === "time") {
                        const f = await promptForm(t("dialogs.time"), `<div class="form-group"><label>${t("forms.minutes")}</label><input name="minutes" type="number" min="0" value="10"></div>`, t("tools.time"));
                        if (f) await game.time.advance(Number(f.minutes) * 60);
                        return;
                }
                if (action === "corporate") {
                        const f = await promptForm(t("dialogs.corporate"), `<div class="form-group"><label>${t("forms.rankSum")}</label><input name="ranks" type="number" min="0" value="${game.actors.filter(a => a.type === "character").reduce((n, a) => n + a.derived.career.rank, 0)}"></div>`, t("dialogs.calculate"));
                        if (!f) return;
                        const sum = corporateAccount(f.ranks);
                        return ChatMessage.create({content: `<div class="shinobi-chat"><header>${t("tables.corporate")}</header><p>¥${sum.toLocaleString("ru-RU")} · ${tf("messages.cashLimit", {amount: (sum / 4).toLocaleString("ru-RU")})}</p></div>`}, {messageMode: "gm"});
                }
                if (action === "fall") {
                        if (!actor?.isOwner) return ui.notifications.warn(t("messages.selectCharacter"));
                        const f = await promptForm(t("dialogs.fall"), `<div class="form-group"><label>${t("forms.stage")}</label>${selectHTML("formula", {
                                "1d6+1": "SHINOBI.toolOptions.fall1",
                                "2d6+2": "SHINOBI.toolOptions.fall2",
                                "3d6+3": "SHINOBI.toolOptions.fall3",
                                "4d6+4": "SHINOBI.toolOptions.fall4",
                                "5d6+5": "SHINOBI.toolOptions.fall5"
                        })}</div>`);
                        if (!f) return;
                        const roll = await simpleRoll(f.formula, t("tables.fallDamage"), actor);
                        return actor.receiveDamage(roll.total);
                }
                if (action === "camera") {
                        const f = await promptForm(t("dialogs.camera"), `<div class="form-group"><label>${t("forms.situation")}</label>${selectHTML("target", {
                                "5": "SHINOBI.toolOptions.cameraDisabled",
                                "7": "SHINOBI.toolOptions.cameraCrime"
                        })}</div>`);
                        if (f) return simpleRoll("2d6", t("tables.guardNotice"), null, {
                                mode: "gm",
                                target: Number(f.target)
                        });
                        return;
                }
                if (!actor?.isOwner) return ui.notifications.warn(t("messages.openTools"));
                if (action === "patrol") {
                        const f = await promptForm(t("dialogs.patrol"), `<div class="form-group"><label>${t("forms.level")}</label>${selectHTML("level", {
                                "1": "SHINOBI.toolOptions.protectionLow",
                                "2": "SHINOBI.toolOptions.protectionMedium",
                                "3": "SHINOBI.toolOptions.protectionHigh"
                        })}</div><label><input type="checkbox" name="known"> ${t("forms.knownSchedule")}</label>`, t("dialogs.continue"));
                        if (f) return actor.check("stealth", {
                                modifier: (f.known ? [3, 2, 0] : [2, 0, -2])[Number(f.level) - 1],
                                label: t("tables.patrolHide")
                        });
                        return;
                }
                if (action === "lock") {
                        const f = await promptForm(t("dialogs.lock"), `<div class="form-group"><label>${t("forms.level")}</label>${selectHTML("level", {
                                "0": "SHINOBI.toolOptions.lockMechanical",
                                "1": "SHINOBI.toolOptions.lockCode",
                                "2": "SHINOBI.toolOptions.lockCard",
                                "3": "SHINOBI.toolOptions.lockBio"
                        })}</div><div class="form-group"><label>${t("forms.attempt")}</label><input type="number" name="attempt" min="1" max="3" value="1"></div><label><input name="tools" type="checkbox" checked> ${t("forms.tools")}</label>`, t("dialogs.continue"));
                        if (!f) return;
                        if (Number(f.level) > 0 && !f.tools) return ui.notifications.warn(t("messages.needDecryptor"));
                        const modifier = -Number(f.level) - (Number(f.attempt) - 1) + (Number(f.level) > 0 ? 2 : f.tools ? 0 : -2);
                        const result = await actor.check("security", {
                                modifier,
                                label: t("tables.lockHack"),
                                mode: "gm"
                        });
                        if (result && !result.success) ui.notifications.warn(result.critical ? t("messages.criticalAlarm") : Number(f.attempt) >= 3 ? t("messages.threeFailures") : t("messages.nextAttempt"));
                        return;
                }
                if (action === "heal") {
                        const candidates = game.actors.filter(a => a.type !== "vehicle" && a.isOwner);
                        const f = await promptForm(t("dialogs.medical"), `<div class="form-group"><label>${t("forms.patient")}</label>${selectHTML("patient", Object.fromEntries(candidates.map(a => [a.id, a.name])))}</div><label><input name="kit" type="checkbox"> ${t("forms.medicalKit")}</label>`, t("dialogs.continue"));
                        if (!f) return;
                        const patient = game.actors.get(f.patient), dying = patient.system.damage.value >= 9;
                        if (patient.system.damage.value >= 14) return ui.notifications.warn(t("messages.resuscitation"));
                        const result = await actor.check("medicine", {
                                modifier: (dying ? -2 : 0) + (f.kit ? 2 : 0),
                                label: t("tables.medicalHelp")
                        });
                        if (result?.success) await patient.update({
                                "system.stabilized": true, ...(dying ? {
                                        "system.damage.value": 4,
                                        "system.wounds": 1
                                } : {})
                        });
                        return;
                }
                if (action === "loyalty") return simpleRoll("2d6", t("ui.loyalty"), actor, {
                        target: actor.system.loyalty,
                        under: true
                });
                if (action === "opposed") {
                        const f = await promptForm(t("dialogs.opposed"), `<div class="form-group"><label>${t("forms.opponent")}</label>${selectHTML("opponent", Object.fromEntries(game.actors.filter(a => a.id !== actor.id && a.isOwner && a.type !== "vehicle").map(a => [a.id, a.name])))}</div><div class="form-group"><label>${t("forms.skill")}</label>${selectHTML("skill", SKILLS)}</div>`, t("dialogs.roll"));
                        if (!f) return;
                        const opponent = game.actors.get(f.opponent);
                        if (!opponent) return;
                        const a = actor.hasSkill(f.skill), b = opponent.hasSkill(f.skill);
                        const r1 = await simpleRoll(`2d6 + ${a && !b ? 2 : 0}`, `${t("tables.opposedCheck")} · ${actor.name}`, actor),
                                r2 = await simpleRoll(`2d6 + ${b && !a ? 2 : 0}`, `${t("tables.opposedCheck")} · ${opponent.name}`, opponent);
                        return ChatMessage.create({content: `<div class="shinobi-chat"><header>${t("tables.opposedCheck")}</header><p>${r1.total === r2.total ? t("messages.draw") : tf("messages.winner", {name: h(r1.total > r2.total ? actor.name : opponent.name)})}</p></div>`}, {messageMode: rollMode()});
                }
        }

        async _prepareContext() {
                const {tables} = await content();
                const unique = [...new Map(tables.map(t => [t.flags[ID].code, t])).values()];
                return {
                        actor: this.actor,
                        isGM: game.user.isGM,
                        tables: unique.map(t => ({code: t.flags[ID].code, name: t.name.split(" · ")[0]})),
                        combat: game.combat,
                        phase: t(["phases.ranged", "phases.movement", "phases.other", "phases.melee", "phases.cover"][game.combat?.getFlag(ID, "phase") ?? 0])
                };
        }
}
