import {escapeHTML as h, ID, RANKS} from "./config.mjs";
import {t, tf} from "./i18n.mjs";
import {advancement, applyHit, loadState, number, rangeFor, severity, vehicleState} from "./rules.mjs";
import {attack, rollMode, simpleRoll, skillCheck} from "./dice.mjs";

export class ShinobiActor extends foundry.documents.Actor {
        hasSkill(key) {
                return this.system.conceptSkill === key || this.items.some(i => i.type === "skill" && i.system.skill === key) || this.items.some(i => i.type === "augmentation" && i.system.active && i.system.grantedSkill === key);
        }

        prepareDerivedData() {
                super.prepareDerivedData();
                const s = this.system;
                if (this.type === "vehicle") {
                        this.derived = vehicleState(s.damage.value, s.size);
                        s.damage.max = this.derived.destroy;
                        return;
                }
                const augmentations = this.items.filter(i => i.type === "augmentation" && i.system.active && !i.system.destroyed).map(i => i.system.key);
                const strong = this.hasSkill("strength") || augmentations.includes("muscleMatrix");
                s.stun.max = strong ? 7 : 5;
                s.damage.max = 14;
                const slots = this.items.reduce((n, i) => n + (i.system.carried && !['skill', 'augmentation', 'program', 'contact', 'service'].includes(i.type) ? i.system.slots * i.system.quantity : 0), s.extraSlots);
                const career = advancement(s.promo, s.faction);
                if (s.rankOverride >= 0) {
                        Object.assign(career, advancement(RANKS[s.rankOverride][0], s.faction));
                }
                this.derived = {
                        augmentations,
                        strong,
                        load: loadState(slots, strong, s.damage.value >= 4),
                        career,
                        severity: severity(s.damage.value),
                        armored: augmentations.includes("subdermalArmor") || this.items.some(i => i.type === "armor" && i.system.equipped && i.system.carried && i.system.quantity > 0),
                        unconscious: s.incapacitated || s.stun.value >= s.stun.max || s.damage.value >= 9
                };
        }

        async _preCreate(data, options, user) {
                await super._preCreate(data, options, user);
                this.updateSource({
                        "prototypeToken.actorLink": this.type === "character",
                        "prototypeToken.bar1.attribute": "damage",
                        "prototypeToken.bar2.attribute": this.type === "vehicle" ? null : "stun",
                        img: data.img ?? `systems/${ID}/assets/icons/${this.type === "vehicle" ? "vehicle" : "character"}.svg`
                });
                if (this.type === "npc" && !data.system?.initiativeSide) this.updateSource({"system.initiativeSide": "enemies"});
        }

        async receiveDamage(amount, {critical = false, piercing = false, type = "damage"} = {}) {
                if (!this.isOwner) return;
                amount = Math.max(0, number(amount));
                if (type === "stun" && this.type !== "vehicle") return this.update({"system.stun.value": this.system.stun.value + amount});
                if (this.type === "vehicle") return this.update({"system.damage.value": this.system.damage.value + amount});
                const hit = applyHit(this.system.damage.value, amount, {
                        critical,
                        armored: this.derived.armored && !piercing,
                        wounds: this.system.wounds
                });
                return this.update({
                        "system.damage.value": hit.damage,
                        "system.wounds": hit.wounds,
                        "system.stabilized": false, ...(hit.hit >= 4 && hit.hit <= 8 ? {"system.downRounds": 2} : {})
                });
        }

        async check(skill, options = {}) {
                return skillCheck(this, skill, options);
        }

        async reloadWeapon(item) {
                if (!this.isOwner || !item.system.usesAmmo) return;
                const ammo = this.items.find(i => i.type === "ammo" && i.system.ammoType === item.system.ammoType && i.system.carried && i.system.quantity > 0);
                if (!ammo) return ui.notifications.warn(t("messages.noAmmo"));
                if (item.system.magazine.value >= item.system.magazine.max) return ui.notifications.info(t("messages.magazineFull"));
                await this.updateEmbeddedDocuments("Item", [{
                        _id: ammo.id,
                        "system.quantity": ammo.system.quantity - 1
                }, {_id: item.id, "system.magazine.value": item.system.magazine.max}]);
                ui.notifications.info(tf("messages.reloaded", {name: item.name}));
        }

        async recoverStun() {
                if (!this.isOwner) return;
                const remaining = this.system.stunRecovery + 1;
                await this.update({
                        "system.stun.value": remaining,
                        "system.stunRecovery": remaining,
                        "system.incapacitated": false
                });
        }

        async bleedingCheck() {
                if (!this.isOwner || this.system.stabilized) return;
                const dying = this.system.damage.value >= 9;
                const result = await this.check("will", {label: dying ? `${t("status.dying")} · ${t("forms.willCheck")}` : `${t("status.wounded")} · ${t("forms.willCheck")}`});
                if (!result) return;
                if (!result.success) {
                        if (dying) await this.update({"system.damage.value": 14});
                        else await this.update({
                                "system.wounds": this.system.wounds + 1,
                                "system.damage.value": Math.max(9, this.system.damage.value)
                        });
                }
        }

        async payWeek() {
                const costs = [0, 10000, 20000, 50000], cost = costs[this.system.lifestyle];
                if (this.system.money < cost) return ui.notifications.warn(t("messages.insufficientMoney"));
                await this.update({"system.money": this.system.money - cost});
                ui.notifications.info(tf("messages.moneySpent", {cost: cost.toLocaleString("ru-RU")}));
        }
}

export class ShinobiItem extends foundry.documents.Item {
        prepareDerivedData() {
                super.prepareDerivedData();
                this.effectiveRange = rangeFor(this.system.range, this.system.laser, this.system.silencer);
        }

        async use() {
                if (!this.actor) return this.postToChat();
                if (!this.actor.isOwner) return;
                if (this.type === "weapon") return attack(this.actor, this);
                if (this.type === "skill") return this.actor.check(this.system.skill, {label: this.name});
                if (this.type === "contact") return simpleRoll("2d6", tf("chat.loyalty", {name: this.name}), this.actor, {
                        target: this.system.loyalty,
                        under: true
                });
                return this.postToChat();
        }

        async postToChat({mode = rollMode()} = {}) {
                const description = await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.system.description, {
                        async: true,
                        secrets: this.isOwner
                });
                return ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({actor: this.actor}),
                        content: `<div class="shinobi-chat"><header>${h(this.name)}</header>${description}<p>${h(this.system.notes)}</p></div>`
                }, {messageMode: mode});
        }
}

export class ShinobiCombat extends foundry.documents.Combat {
        async rollInitiative(ids, {messageOptions = {}, ...options} = {}) {
                ids = typeof ids === "string" ? [ids] : ids;
                const requested = ids ? this.combatants.filter(c => ids.includes(c.id)) : this.combatants.contents;
                const sides = [...new Set(requested.map(c => c.actor?.system.initiativeSide || "enemies"))];
                const changes = [];
                for (const side of sides) {
                        const members = this.combatants.filter(c => (c.actor?.system.initiativeSide || "enemies") === side);
                        const roll = await new Roll("1d6").evaluate();
                        for (const c of members) if (c.isOwner) changes.push({_id: c.id, initiative: roll.total});
                        await roll.toMessage({speaker: {alias: tf("tables.initiative", {side})}, ...messageOptions}, {messageMode: members.every(c => c.hidden) ? "gm" : rollMode()});
                }
                if (changes.length) await this.updateEmbeddedDocuments("Combatant", changes);
                return this;
        }

        async nextRound() {
                const result = await super.nextRound();
                if (game.user.isGM) {
                        await this.rollInitiative();
                        await this.setFlag(ID, "phase", 0);
                }
                return result;
        }
}
