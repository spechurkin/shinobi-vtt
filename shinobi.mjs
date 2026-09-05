import {escapeHTML as h, ID, ITEM_TYPES, SKILLS, STATUS} from "./module/config.mjs";
import {ShinobiCharacterData, ShinobiItemData, ShinobiVehicleData} from "./module/models.mjs";
import {ShinobiActor, ShinobiCombat, ShinobiItem} from "./module/documents.mjs";
import {ShinobiActorSheet, ShinobiItemSheet} from "./module/sheets.mjs";
import {ShinobiLibrary, ShinobiTools} from "./module/windows.mjs";
import {content, drawSource, generateCharacter} from "./module/content.mjs";
import {t, tf} from "./module/i18n.mjs";

Hooks.once("init", () => {
        CONFIG.Actor.documentClass = ShinobiActor;
        CONFIG.Item.documentClass = ShinobiItem;
        CONFIG.Combat.documentClass = ShinobiCombat;
        CONFIG.Actor.dataModels = {
                character: ShinobiCharacterData,
                npc: ShinobiCharacterData,
                vehicle: ShinobiVehicleData
        };
        CONFIG.Item.dataModels = Object.fromEntries(Object.keys(ITEM_TYPES).map(type => [type, ShinobiItemData]));
        CONFIG.Actor.typeLabels = {
                character: "TYPES.Actor.character",
                npc: "TYPES.Actor.npc",
                vehicle: "TYPES.Actor.vehicle"
        };
        CONFIG.Item.typeLabels = Object.fromEntries(Object.keys(ITEM_TYPES).map(type => [type, `TYPES.Item.${type}`]));
        CONFIG.Combat.initiative = {formula: "1d6", decimals: 0};
        CONFIG.time.roundTime = 10;
        CONFIG.time.turnTime = 0;
        CONFIG.statusEffects = STATUS;
        const sheets = foundry.applications.apps.DocumentSheetConfig;
        sheets.registerSheet(Actor, ID, ShinobiActorSheet, {
                types: ["character", "npc", "vehicle"],
                makeDefault: true,
                label: "SHINOBI.sheet.actor"
        });
        sheets.registerSheet(Item, ID, ShinobiItemSheet, {makeDefault: true, label: "SHINOBI.sheet.item"});
        game.settings.register(ID, "strictChecks", {
                name: "SHINOBI.settings.strictChecks.name",
                hint: "SHINOBI.settings.strictChecks.hint",
                scope: "world",
                config: true,
                type: Boolean,
                default: false
        });
        game.settings.registerMenu(ID, "library", {
                name: "SHINOBI.settings.library.name",
                label: "SHINOBI.settings.library.label",
                hint: "SHINOBI.settings.library.hint",
                icon: "fa-solid fa-box-archive",
                type: ShinobiLibrary,
                restricted: false
        });
        game.settings.registerMenu(ID, "tools", {
                name: "SHINOBI.settings.tools.name",
                label: "SHINOBI.settings.tools.label",
                hint: "SHINOBI.settings.tools.hint",
                icon: "fa-solid fa-dice",
                type: ShinobiTools,
                restricted: false
        });
        game.shinobi = {
                ShinobiActor,
                ShinobiItem,
                ShinobiActorSheet,
                ShinobiItemSheet,
                SKILLS,
                generateCharacter,
                drawSource,
                library: actor => new ShinobiLibrary({actor}).render(true),
                tools: actor => new ShinobiTools({actor}).render(true)
        };
});
Hooks.once("ready", () => {
        content().catch(error => ui.notifications.error(error.message));
});
Hooks.on("renderActorDirectory", (app, element) => {
        const root = element instanceof HTMLElement ? element : element[0];
        if (!root || root.querySelector(".shinobi-directory-tools")) return;
        const controls = document.createElement("div");
        controls.className = "shinobi-directory-tools";
        controls.innerHTML = `<button type="button" data-shinobi="generate">${t("library.create")}</button><button type="button" data-shinobi="catalog" title="${t("ui.catalog")}">${t("ui.catalog")}</button><button type="button" data-shinobi="tools" title="${t("ui.tools")}">${t("ui.tools")}</button>`;
        controls.addEventListener("click", event => {
                const action = event.target.closest("[data-shinobi]")?.dataset.shinobi;
                if (action === "generate") generateCharacter();
                if (action === "catalog") game.shinobi.library();
                if (action === "tools") game.shinobi.tools();
        });
        (root.querySelector(".directory-header") ?? root).append(controls);
});
Hooks.on("renderChatMessageHTML", (message, element) => {
        const button = element.querySelector("[data-shinobi-damage]");
        if (!button) return;
        button.addEventListener("click", async () => {
                const actors = [...new Map(canvas.tokens.controlled.filter(t => t.actor?.isOwner).map(t => [t.actor.uuid, t.actor])).values()];
                if (!actors.length) return ui.notifications.warn(t("messages.selectAccessibleToken"));
                const damage = message.getFlag(ID, "damage");
                if (!damage) return;
                const accepted = await foundry.applications.api.DialogV2.confirm({
                        window: {title: t("dialogs.damageApplication")},
                        content: `<p>${tf("messages.damageApplied", {
                                amount: damage.amount,
                                kind: damage.type === "stun" ? t("messages.stunPlural") : t("messages.damagePlural"),
                                critical: damage.critical ? `, ${t("messages.criticalHit").trim()}` : "",
                                actors: actors.map(a => h(a.name)).join(", ")
                        })}</p>`
                });
                if (!accepted) return;
                button.disabled = true;
                try {
                        for (const actor of actors) await actor.receiveDamage(damage.amount, damage);
                } finally {
                        button.disabled = false;
                }
        });
});
