import {escapeHTML as h, ID, PHYSICAL, SKILLS} from "./config.mjs";
import {localizedValue, t, tf} from "./i18n.mjs";
import {checkResult, iceModifier, modifiers, number} from "./rules.mjs";

export const rollMode = () => game.settings.get("core", "messageMode");

export async function promptForm(title, content, label = t("dialogs.roll")) {
        return foundry.applications.api.DialogV2.prompt({
                window: {title},
                content,
                ok: {
                        label,
                        callback: (_event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
                },
                rejectClose: false
        });
}

export function selectHTML(name, values, selected = "") {
        return `<select name="${h(name)}">${Object.entries(values).map(([value, label]) => `<option value="${h(value)}" ${String(value) === String(selected) ? "selected" : ""}>${h(localizedValue(label))}</option>`).join("")}</select>`;
}

export async function simpleRoll(formula, label, actor = null, {mode = rollMode(), target, under = false} = {}) {
        const roll = await new Roll(formula).evaluate();
        const result = target == null ? "" : ((under ? roll.total <= target : roll.total >= target) ? t("outcomes.success") : t("outcomes.failure"));
        await roll.toMessage({
                speaker: ChatMessage.getSpeaker({actor}),
                flavor: `${h(label)}${result ? ` — ${result}` : ""}`
        }, {messageMode: mode});
        return roll;
}

export async function skillCheck(actor, skill, {
        modifier = 0,
        label = localizedValue(SKILLS[skill] ?? "SHINOBI.ui.check"),
        dialog = true,
        physical = PHYSICAL.has(skill),
        trained,
        extraHTML = "",
        additional = null,
        mode = rollMode()
} = {}) {
        if (!actor.isOwner) return ui.notifications.warn(t("messages.noAccess"));
        let data = {modifier, physical, trained: trained ?? actor.hasSkill(skill), mode};
        if (dialog) {
                const answer = await promptForm(label, `<p><b>${h(actor.name)}</b> · ${h(localizedValue(SKILLS[skill] ?? skill))}</p><div class="form-group"><label>${t("forms.modifier")}</label><input name="modifier" type="number" value="${number(modifier)}"></div><div class="form-group"><label>${t("forms.trained")}</label><input type="checkbox" name="trained" ${data.trained ? "checked" : ""}></div><div class="form-group"><label>${t("forms.physical")}</label><input type="checkbox" name="physical" ${physical ? "checked" : ""}></div><div class="form-group"><label>${t("forms.visibility")}</label>${selectHTML("mode", {
                        public: "SHINOBI.visibility.public",
                        gm: "SHINOBI.visibility.gm",
                        blind: "SHINOBI.visibility.blind",
                        self: "SHINOBI.visibility.self"
                }, mode)}</div>${extraHTML}`);
                if (!answer) return null;
                data = {...data, ...answer};
        }
        const automatic = modifiers({
                skill,
                physical: data.physical,
                wounded: actor.system.damage.value >= 4 && actor.system.damage.value < 14,
                overloaded: actor.derived.load.overloaded,
                augmentations: actor.derived.augmentations
        });
        const extras = additional ? additional(data) : [];
        const rows = [...automatic, ...extras, {
                label: t("modifiers.temporary"),
                value: number(actor.system.temporaryModifier)
        }, {label: t("modifiers.situation"), value: number(data.modifier)}].filter(r => r.value);
        const mod = rows.reduce((sum, r) => sum + r.value, 0);
        const roll = await new Roll(`2d6 ${mod < 0 ? "-" : "+"} ${Math.abs(mod)}`).evaluate();
        const dice = roll.dice[0].results.filter(r => r.active !== false).map(r => r.result);
        const result = checkResult(dice, mod, Boolean(data.trained), game.settings.get(ID, "strictChecks"));
        await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({actor}),
                rolls: [roll],
                content: `<div class="shinobi-chat"><header>${h(label)}</header><strong class="${result.success ? "success" : "failure"}">${result.label}</strong><p>${data.trained ? t("messages.trained") : t("messages.untrained")} · ${tf("messages.targetResult", {
                        target: result.target,
                        total: result.total
                })}</p>${rows.length ? `<small>${rows.map(r => `${h(r.label)} ${r.value > 0 ? "+" : ""}${r.value}`).join(" · ")}</small>` : ""}</div>`,
                flags: {[ID]: {check: {skill, ...result}}}
        }, {messageMode: data.mode});
        return {...result, roll, form: data, mode: data.mode};
}

export async function attack(actor, item) {
        if (!actor.isOwner || item.system.destroyed) return;
        const s = item.system;
        if (s.usesAmmo && s.magazine.value < 1) return ui.notifications.warn(t("messages.emptyMagazine"));
        if (s.category === "explosive" && s.quantity < 1) return ui.notifications.warn(t("messages.ammoEmpty"));
        const ranged = s.range > 0;
        const result = await skillCheck(actor, s.skill, {
                label: item.name,
                physical: true,
                extraHTML: `
    ${ranged ? `<div class="form-group"><label>${t("forms.distance")}</label>${selectHTML("distance", {
                        "0": "SHINOBI.distance.normal",
                        "-2": "SHINOBI.distance.outOfRange",
                        "1": "SHINOBI.distance.close",
                        "3": "SHINOBI.distance.pointBlank"
                })}</div><div class="form-group"><label>${t("forms.targetCover")}</label>${selectHTML("cover", {
                        "0": "SHINOBI.cover.none",
                        "-2": "SHINOBI.cover.cover",
                        "-4": "SHINOBI.cover.moving"
                })}</div><div class="form-group"><label>${t("forms.aimRounds")}</label><input type="number" name="aim" value="0" min="0" max="3"></div>` : ""}
    <div class="form-group"><label>${t("forms.augmentationsApplicable")}</label><input type="checkbox" name="augBonus"></div>`,
                additional: form => [
                        {label: t("modifiers.weapon"), value: s.hitBonus}, {
                                label: t("modifiers.distance"),
                                value: number(form.distance)
                        }, {
                                label: t("modifiers.cover"),
                                value: number(form.cover)
                        },
                        {
                                label: t("modifiers.aim"),
                                value: actor.hasSkill("aiming") ? Math.min(3, Math.max(0, number(form.aim))) : 0
                        },
                        {
                                label: t("modifiers.augmentation"),
                                value: form.augBonus && actor.derived.augmentations.some(a => ["superArms", "superLegs"].includes(a)) ? 1 : 0
                        }
                ]
        });
        if (!result) return;
        if (s.usesAmmo) await item.update({"system.magazine.value": Math.max(0, item.system.magazine.value - 1)});
        if (s.category === "explosive") await item.update({"system.quantity": Math.max(0, item.system.quantity - 1)});
        if (result.success) {
                if (s.damageType === "effect" || !s.damage || s.damage === "0") return item.postToChat({mode: result.mode});
                return damageRoll(actor, item, {critical: result.critical, mode: result.mode});
        }
}

export async function damageRoll(actor, item, {critical = false, mode = rollMode()} = {}) {
        const formula = item.system.damage;
        if (!Roll.validate(formula)) return ui.notifications.error(t("messages.invalidDamageFormula"));
        const roll = await new Roll(formula).evaluate();
        await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({actor}),
                rolls: [roll],
                content: `<div class="shinobi-chat"><header>${h(item.name)} · ${t("chat.damage")}</header><p>${critical ? t("messages.criticalHit") : ""}${item.system.armorPiercing ? t("messages.ignoresArmor") : ""}</p><button type="button" data-shinobi-damage>${t("chat.applyToSelected")}</button></div>`,
                flags: {
                        [ID]: {
                                damage: {
                                        amount: roll.total,
                                        critical,
                                        piercing: item.system.armorPiercing,
                                        type: item.system.damageType
                                }
                        }
                }
        }, {messageMode: mode});
        return roll;
}

export async function unarmed(actor) {
        const known = ["aikido", "karate", "bujutsu", "nekode"].find(s => actor.hasSkill(s)) ?? "karate";
        const choice = await promptForm(t("tables.unarmedAttack"), `<div class="form-group"><label>${t("forms.combatSkill")}</label>${selectHTML("skill", Object.fromEntries(["aikido", "karate", "bujutsu", "nekode"].map(k => [k, SKILLS[k]])), known)}</div><label><input name="power" type="checkbox"> ${t("forms.powerAttack")}</label>`, t("dialogs.continue"));
        if (!choice) return;
        const result = await skillCheck(actor, choice.skill, {
                label: t("tables.unarmedAttack"),
                modifier: choice.power ? -2 : 0,
                physical: true
        });
        if (!result?.success) return;
        const strong = result.critical || choice.power;
        await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({actor}),
                content: `<div class="shinobi-chat"><header>${t("tables.unarmedStrike")}</header><p>${strong ? 2 : 1} ${t("messages.stunPlural")}.</p><button type="button" data-shinobi-damage>${t("chat.applyToSelected")}</button></div>`,
                flags: {[ID]: {damage: {amount: strong ? 2 : 1, type: "stun"}}}
        }, {messageMode: result.mode});
        if (strong) await simpleRoll("1d6", t("tables.throwDistance"), actor, {mode: result.mode});
}

export async function hack(actor) {
        const decks = actor.items.filter(i => i.type === "deck" && i.system.carried && !i.system.destroyed);
        const breakers = actor.items.filter(i => i.type === "program" && i.system.level > 0 && !i.system.destroyed);
        if (!decks.length || !breakers.length) return ui.notifications.warn(t("messages.needDeckBreaker"));
        const form = await promptForm(t("dialogs.hack"), `<div class="form-group"><label>${t("forms.deck")}</label>${selectHTML("deck", Object.fromEntries(decks.map(i => [i.id, `${i.name} · ${i.system.deckSlots} ${t("units.slotShort")}`])))}</div><div class="form-group"><label>${t("forms.breaker")}</label>${selectHTML("breaker", Object.fromEntries(breakers.map(i => [i.id, `${i.name} · +${i.system.level}`])))}</div><div class="form-group"><label>${t("forms.network")}</label>${selectHTML("network", {
                low: "SHINOBI.network.low",
                high: "SHINOBI.network.high",
                black: "SHINOBI.network.black"
        })}</div><label><input name="delayed" type="checkbox"> ${t("forms.delayed")}</label>`, t("dialogs.continue"));
        if (!form) return;
        const deck = actor.items.get(form.deck), breaker = actor.items.get(form.breaker);
        const installed = actor.items.filter(i => i.type === "program" && i.system.installed && i.system.deckId === deck.id && !i.system.destroyed);
        if (!installed.some(i => i.id === breaker.id) && installed.length >= deck.system.deckSlots) return ui.notifications.warn(t("messages.noDeckSlots"));
        const result = await skillCheck(actor, "cyberspace", {
                label: t("dialogs.hack"),
                modifier: iceModifier(breaker.system.level, form.network, form.delayed)
        });
        if (!result || result.success) return;
        const updates = [{_id: breaker.id, "system.destroyed": true, "system.installed": false}];
        if (form.network !== "low") updates.push({_id: deck.id, "system.destroyed": true});
        await actor.updateEmbeddedDocuments("Item", updates);
        if (form.network === "black") await actor.receiveDamage(5, {type: "stun"});
        await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({actor}),
                content: `<div class="shinobi-chat"><header>${t("tables.hackConsequences")}</header><p>${t("messages.breakerDestroyed")}${form.network !== "low" ? ` ${t("messages.deckBurned")}` : ""}${form.network === "black" ? ` ${t("messages.netrunnerStun")}` : ""}</p></div>`
        }, {messageMode: result.mode});
}
