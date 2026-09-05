import {escapeHTML as h, ITEM_TYPES, options, ROOT, SKILLS} from "./config.mjs";
import {localizedValue, t, tf} from "./i18n.mjs";
import {ShinobiLibrary, ShinobiTools} from "./windows.mjs";
import {generateCharacter} from "./content.mjs";
import {hack, promptForm, selectHTML, unarmed} from "./dice.mjs";

const {HandlebarsApplicationMixin} = foundry.applications.api;
const blankRows = (items, min) => [...items, ...Array.from({length: Math.max(0, min - items.length)}, () => ({blank: true}))].map((v, i) => ({
        ...v,
        index: i + 1
}));
const entry = i => ({...i.toObject(), id: i.id, range: i.effectiveRange});

export class ShinobiActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
        static DEFAULT_OPTIONS = {
                classes: ["shinobi", "shinobi-actor"],
                position: {width: 950, height: 920},
                window: {resizable: true, icon: "fa-solid fa-user-ninja"},
                form: {submitOnChange: true, closeOnSubmit: false},
                actions: {
                        page: this.page,
                        library: this.library,
                        tools: this.tools,
                        check: this.check,
                        unarmed: this.unarmed,
                        hack: this.hack,
                        itemEdit: this.itemEdit,
                        itemDelete: this.itemDelete,
                        itemUse: this.itemUse,
                        itemToggle: this.itemToggle,
                        reload: this.reload,
                        track: this.track,
                        damage: this.damage,
                        recover: this.recover,
                        bleed: this.bleed,
                        week: this.week,
                        generate: this.generate,
                        itemCreate: this.itemCreate,
                        promote: this.promote
                }
        };
        static PARTS = {main: {template: `${ROOT}/templates/actor.hbs`, scrollable: [".shinobi-scroll"]}};
        currentPage = "front";

        static async page(event, target) {
                this.currentPage = target.dataset.page;
                await this.render();
        }

        static library() {
                new ShinobiLibrary({actor: this.actor}).render(true);
        }

        static tools() {
                new ShinobiTools({actor: this.actor}).render(true);
        }

        static async check() {
                const form = await promptForm(t("dialogs.skillCheck"), `<div class="form-group"><label>${t("forms.skill")}</label>${selectHTML("skill", SKILLS)}</div>`, t("dialogs.continue"));
                if (form) await this.actor.check(form.skill);
        }

        static unarmed() {
                if (this.isEditable) return unarmed(this.actor);
        }

        static hack() {
                if (this.isEditable) return hack(this.actor);
        }

        static itemEdit(event, target) {
                this.actor.items.get(target.closest("[data-item-id]").dataset.itemId)?.sheet.render(true);
        }

        static async itemDelete(event, target) {
                if (!this.isEditable) return;
                const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId);
                if (await foundry.applications.api.DialogV2.confirm({
                        window: {title: t("dialogs.deleteEntry")},
                        content: `<p>${tf("dialogs.deleteConfirm", {name: h(item.name)})}</p>`
                })) await item.delete();
        }

        static itemUse(event, target) {
                if (this.isEditable) return this.actor.items.get(target.closest("[data-item-id]").dataset.itemId)?.use();
        }

        static async itemToggle(event, target) {
                if (!this.isEditable) return;
                const item = this.actor.items.get(target.closest("[data-item-id]").dataset.itemId),
                        field = target.dataset.field;
                await item.update({[`system.${field}`]: !item.system[field]});
        }

        static reload(event, target) {
                if (this.isEditable) return this.actor.reloadWeapon(this.actor.items.get(target.closest("[data-item-id]").dataset.itemId));
        }

        static track(event, target) {
                if (!this.isEditable) return;
                const resource = target.dataset.resource, value = Number(target.dataset.value);
                return this.actor.update({[`system.${resource}.value`]: value === this.actor.system[resource].value ? value - 1 : value});
        }

        static async damage() {
                if (!this.isEditable) return;
                const f = await promptForm(t("dialogs.receiveDamage"), `<div class="form-group"><label>${t("forms.damageAmount")}</label><input name="amount" type="number" value="1" min="0"></div><label><input name="critical" type="checkbox"> ${t("forms.criticalHit")}</label><label><input name="piercing" type="checkbox"> ${t("forms.ignoreArmor")}</label>`, t("dialogs.apply"));
                if (f) await this.actor.receiveDamage(f.amount, f);
        }

        static recover() {
                if (this.isEditable) return this.actor.recoverStun();
        }

        static bleed() {
                if (this.isEditable) return this.actor.bleedingCheck();
        }

        static week() {
                if (this.isEditable) return this.actor.payWeek();
        }

        static generate() {
                return generateCharacter();
        }

        static async itemCreate(event, target) {
                if (!this.isEditable) return;
                const type = target.dataset.type ?? "gear";
                const [item] = await this.actor.createEmbeddedDocuments("Item", [{
                        name: `${t("ui.newItem")}: ${localizedValue(ITEM_TYPES[type])}`,
                        type,
                        img: `${ROOT}/assets/icons/${type}.svg`,
                        system: {slots: ["skill", "contact", "augmentation", "program"].includes(type) ? 0 : 1}
                }]);
                await item.sheet.render(true);
        }

        static async promote() {
                if (!this.isEditable) return;
                const form = await promptForm(t("dialogs.missionReward"), `<div class="form-group"><label>${t("forms.pointsChange")}</label><input name="points" type="number" value="2"></div><div class="form-group"><label>${t("forms.bonus")}</label><input name="money" type="number" value="0" min="0"></div><div class="form-group"><label>${t("forms.freeCompanionsAdd")}</label><input name="companions" type="number" value="0" min="0"></div>`, t("dialogs.apply"));
                if (form) await this.actor.update({
                        "system.promo": this.actor.system.promo + Number(form.points),
                        "system.money": this.actor.system.money + Number(form.money),
                        "system.freeCompanions": this.actor.system.freeCompanions + Number(form.companions)
                });
        }

        async _prepareContext(options) {
                const context = await super._prepareContext(options), actor = this.actor, s = actor.system;
                const items = actor.items.contents.sort((a, b) => a.sort - b.sort);
                const group = type => items.filter(i => i.type === type).map(entry);
                const notesHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(s.notes ?? "", {
                        async: true,
                        secrets: actor.isOwner,
                        relativeTo: actor
                });
                return {
                        ...context,
                        actor,
                        system: s,
                        source: actor._source.system,
                        editable: this.isEditable,
                        notesHTML,
                        d: actor.derived,
                        isVehicle: actor.type === "vehicle",
                        front: this.currentPage === "front",
                        back: this.currentPage === "back",
                        cyber: this.currentPage === "cyber",
                        isOwner: this.isEditable,
                        skillOptions: optionsList(SKILLS, s.conceptSkill),
                        factions: optionsList({
                                zaibatsu: "SHINOBI.factions.zaibatsu",
                                yakuza: "SHINOBI.factions.yakuza",
                                freelance: "SHINOBI.factions.freelance"
                        }, s.faction),
                        skills: blankRows(group("skill"), 6),
                        augmentations: blankRows(group("augmentation"), 8),
                        weapons: blankRows(group("weapon"), 4),
                        armor: group("armor"),
                        ammo: group("ammo"),
                        contacts: group("contact"),
                        equipment: items.filter(i => ["gear", "weapon", "armor", "ammo", "deck", "drug"].includes(i.type)).map(entry),
                        decks: group("deck"),
                        programs: group("program"),
                        damageTrack: Array.from({length: 14}, (_, i) => ({
                                value: i + 1,
                                filled: s.damage.value > i,
                                boundary: [3, 8, 13].includes(i + 1)
                        })),
                        stunTrack: Array.from({length: s.stun?.max ?? 0}, (_, i) => ({
                                value: i + 1,
                                filled: s.stun.value > i
                        })),
                        lifestyles: optionsList({
                                0: "SHINOBI.lifestyles.street",
                                1: "SHINOBI.lifestyles.working",
                                2: "SHINOBI.lifestyles.middle",
                                3: "SHINOBI.lifestyles.upper"
                        }, s.lifestyle),
                        sizes: optionsList({
                                small: "SHINOBI.sizes.small",
                                medium: "SHINOBI.sizes.medium",
                                large: "SHINOBI.sizes.large"
                        }, s.size),
                        speeds: optionsList({
                                slow: "SHINOBI.speeds.slow",
                                fast: "SHINOBI.speeds.fast",
                                veryFast: "SHINOBI.speeds.veryFast"
                        }, s.speed),
                        reactionModifier: actor.derived.career ? s.lifestyle - actor.derived.career.lifestyle : 0
                };
        }

        async _onChangeForm(config, event) {
                const input = event.target;
                if (input.dataset.itemField) {
                        if (!this.isEditable) return;
                        const id = input.closest("[data-item-id]")?.dataset.itemId;
                        const item = this.actor.items.get(id);
                        if (!item) return;
                        const value = input.type === "checkbox" ? input.checked : input.type === "number" ? Number(input.value) : input.value;
                        return item.update({[`system.${input.dataset.itemField}`]: value});
                }
                return super._onChangeForm(config, event);
        }

        async _onDropItem(event, item) {
                if (["skill", "augmentation"].includes(item.type) && item.actor?.uuid !== this.actor.uuid && this.actor.items.some(i => i.type === item.type && i.system.key === item.system.key)) return ui.notifications.warn(t("messages.duplicateEntry"));
                return super._onDropItem(event, item);
        }

        async _onDropActor(event, actor) {
                if (!this.isEditable) return;
                return this.actor.createEmbeddedDocuments("Item", [{
                        name: actor.name,
                        type: "contact",
                        img: actor.img,
                        system: {actorUuid: actor.uuid, companion: true, slots: 0}
                }]);
        }
}

const optionsList = options;

export class ShinobiItemSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ItemSheetV2) {
        static DEFAULT_OPTIONS = {
                classes: ["shinobi", "shinobi-item"],
                position: {width: 630, height: 800},
                window: {resizable: true},
                form: {submitOnChange: true, closeOnSubmit: false},
                actions: {post: this.post}
        };
        static PARTS = {main: {template: `${ROOT}/templates/item.hbs`, scrollable: [".shinobi-scroll"]}};

        static post() {
                return (this.item ?? this.document).postToChat();
        }

        async _prepareContext(options) {
                const context = await super._prepareContext(options), item = this.item ?? this.document;
                const notesHTML = await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.notes ?? "", {
                        async: true,
                        secrets: item.isOwner,
                        relativeTo: item
                });
                return {
                        ...context,
                        item,
                        system: item.system,
                        source: item._source.system,
                        editable: this.isEditable,
                        notesHTML,
                        typeLabel: localizedValue(ITEM_TYPES[item.type]),
                        skills: optionsList({"": "SHINOBI.messages.untrained", ...SKILLS}, item.system.skill),
                        grades: optionsList({
                                A: "A",
                                B: "B",
                                C: "C",
                                D: "D",
                                "": "SHINOBI.grades.cyber"
                        }, item.system.class),
                        isWeapon: item.type === "weapon",
                        isAug: item.type === "augmentation",
                        isSkill: item.type === "skill",
                        isProgram: item.type === "program",
                        isDeck: item.type === "deck",
                        isContact: item.type === "contact",
                        isDrug: item.type === "drug",
                        isAmmo: item.type === "ammo",
                        isArmor: item.type === "armor",
                        damageTypes: optionsList({
                                damage: "SHINOBI.damageTypes.damage",
                                stun: "SHINOBI.damageTypes.stun",
                                effect: "SHINOBI.damageTypes.effect"
                        }, item.system.damageType),
                        ammoTypes: optionsList({
                                light: "SHINOBI.ammoTypes.light",
                                heavy: "SHINOBI.ammoTypes.heavy",
                                shotgun: "SHINOBI.ammoTypes.shotgun"
                        }, item.system.ammoType),
                        decks: optionsList(Object.fromEntries((item.actor?.items.filter(i => i.type === "deck") ?? []).map(i => [i.id, i.name])), item.system.deckId),
                        description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(item.system.description, {
                                async: true,
                                secrets: item.isOwner
                        })
                };
        }
}
