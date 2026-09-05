const f = foundry.data.fields;
const text = (initial = "") => new f.StringField({required: true, blank: true, initial});
const num = (initial = 0, extra = {}) => new f.NumberField({required: true, nullable: false, initial, ...extra});
const bool = (initial = false) => new f.BooleanField({initial});
const resource = max => new f.SchemaField({
        value: num(0, {min: 0, integer: true}),
        max: num(max, {min: 1, integer: true})
});

export class ShinobiCharacterData extends foundry.abstract.TypeDataModel {
        static defineSchema() {
                return {
                        concept: text(),
                        conceptSkill: text(),
                        clothing: text(),
                        trait: text(),
                        motivation: text(),
                        problem: text(),
                        background: text(),
                        notes: text(),
                        weightless: text(),
                        armorNotes: text(),
                        money: num(0, {min: 0}),
                        promo: num(),
                        rankOverride: num(-1, {min: -1, max: 7, integer: true}),
                        faction: text("zaibatsu"),
                        freeCompanions: num(0, {min: 0, integer: true}),
                        lifestyle: num(1, {min: 0, max: 3, integer: true}),
                        damage: resource(14),
                        stun: resource(5),
                        wounds: num(0, {min: 0, integer: true}),
                        stunRecovery: num(0, {min: 0, integer: true}),
                        downRounds: num(0, {min: 0, integer: true}),
                        stabilized: bool(),
                        extraSlots: num(0, {min: 0}),
                        incapacitated: bool(),
                        initiativeSide: text("players"),
                        temporaryModifier: num(),
                        createdByGenerator: bool(),
                        ammoNotes: text(),
                        appearance: text(),
                        loyalty: num(5, {min: 0, max: 12, integer: true})
                };
        }
}

export class ShinobiVehicleData extends foundry.abstract.TypeDataModel {
        static defineSchema() {
                return {
                        size: text("medium"),
                        speed: text("fast"),
                        damage: resource(25),
                        price: num(0, {min: 0}),
                        armored: bool(),
                        notes: text(),
                        crew: text(),
                        initiativeSide: text("players")
                };
        }
}

export class ShinobiItemData extends foundry.abstract.TypeDataModel {
        static defineSchema() {
                return {
                        description: text(),
                        notes: text(),
                        page: num(0, {min: 0, integer: true}),
                        key: text(),
                        category: text(),
                        price: num(0, {min: 0}),
                        quantity: num(1, {min: 0, integer: true}),
                        slots: num(1, {min: 0}),
                        carried: bool(true),
                        equipped: bool(true),
                        active: bool(true),
                        skill: text(),
                        class: text("D"),
                        damage: text("1d6"),
                        damageType: text("damage"),
                        range: num(0, {min: 0}),
                        magazine: resource(1),
                        usesAmmo: bool(),
                        ammoType: text("light"),
                        attacks: num(1, {min: 1, integer: true}),
                        hitBonus: num(),
                        armorPiercing: bool(),
                        laser: bool(),
                        silencer: bool(),
                        shotgunLoad: text("pellets"),
                        level: num(0, {min: 0, max: 6, integer: true}),
                        deckSlots: num(0, {min: 0, integer: true}),
                        installed: bool(),
                        deckId: text(),
                        destroyed: bool(),
                        loyalty: num(5, {min: 0, max: 12, integer: true}),
                        relation: text(),
                        phone: text(),
                        companion: bool(),
                        actorUuid: text(),
                        doses: num(1, {min: 0, integer: true}),
                        duration: text(),
                        grantedSkill: text()
                };
        }
}
