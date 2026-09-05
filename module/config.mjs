import {localizedValue} from "./i18n.mjs";

export const ID = "shinobi-vtt";
export const ROOT = `systems/${ID}`;
export const SKILLS = Object.fromEntries(["aikido", "bujutsu", "explosives", "chanbara", "iaido", "karate", "nekode", "lightWeapons", "aiming", "heavyWeapons", "agility", "awareness", "stealth", "strength", "will", "streetwise", "chemistry", "technology", "security", "cyberspace", "medicine", "driving", "bodyLanguage", "deception", "forgery", "gambling", "seduction", "persuasion", "yakuza", "zaibatsu"].map(skill => [skill, `SHINOBI.skills.${skill}`]));
export const PHYSICAL = new Set(["aikido", "bujutsu", "chanbara", "karate", "nekode", "lightWeapons", "heavyWeapons", "agility", "stealth", "strength"]);
export const ITEM_TYPES = {
        skill: "SHINOBI.itemTypes.skill",
        augmentation: "SHINOBI.itemTypes.augmentation",
        weapon: "SHINOBI.itemTypes.weapon",
        armor: "SHINOBI.itemTypes.armor",
        gear: "SHINOBI.itemTypes.gear",
        ammo: "SHINOBI.itemTypes.ammo",
        deck: "SHINOBI.itemTypes.deck",
        program: "SHINOBI.itemTypes.program",
        drug: "SHINOBI.itemTypes.drug",
        service: "SHINOBI.itemTypes.service",
        contact: "SHINOBI.itemTypes.contact"
};
export const RANKS = [[0, "SHINOBI.ranks.zaibatsu.recruit", "SHINOBI.ranks.yakuza.recruit", 0], [3, "SHINOBI.ranks.zaibatsu.beginner", "SHINOBI.ranks.yakuza.beginner", 50000], [9, "SHINOBI.ranks.zaibatsu.agent", "SHINOBI.ranks.yakuza.agent", 100000], [18, "SHINOBI.ranks.zaibatsu.fighter", "SHINOBI.ranks.yakuza.fighter", 500000], [30, "SHINOBI.ranks.zaibatsu.guardian", "SHINOBI.ranks.yakuza.guardian", 5000000], [45, "SHINOBI.ranks.zaibatsu.samurai", "SHINOBI.ranks.yakuza.samurai", 10000000], [63, "SHINOBI.ranks.zaibatsu.daimyo", "SHINOBI.ranks.yakuza.daimyo", 25000000], [84, "SHINOBI.ranks.zaibatsu.shogun", "SHINOBI.ranks.yakuza.shogun", 100000000]];
export const AUGMENT_KEYS = {
        "Подкожная броня": "subdermalArmor",
        "Мышечная матрица": "muscleMatrix",
        "Высокий болевой порог": "painThreshold",
        "Супер-руки": "superArms",
        "Супер-ноги": "superLegs",
        "Регенерация": "regeneration",
        "Ускоритель обмена веществ": "metabolicAccelerator"
};
export const STATUS = [{
        id: "stunned",
        name: "SHINOBI.status.stunned",
        img: "icons/svg/unconscious.svg"
}, {id: "wounded", name: "SHINOBI.status.wounded", img: "icons/svg/blood.svg"}, {
        id: "dying",
        name: "SHINOBI.status.dying",
        img: "icons/svg/skull.svg"
}, {id: "dead", name: "SHINOBI.status.dead", img: "icons/svg/skull.svg"}, {
        id: "unconscious",
        name: "SHINOBI.status.unconscious",
        img: "icons/svg/unconscious.svg"
}, {id: "encumbered", name: "SHINOBI.status.encumbered", img: "icons/svg/anchor.svg"}, {
        id: "surprised",
        name: "SHINOBI.status.surprised",
        img: "icons/svg/daze.svg"
}, {id: "prone", name: "SHINOBI.status.prone", img: "icons/svg/falling.svg"}, {
        id: "burning",
        name: "SHINOBI.status.burning",
        img: "icons/svg/fire.svg"
}];
export const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[c]));
export const options = (values, selected) => Object.entries(values).map(([value, label]) => ({
        value, label: localizedValue(label), selected: value === String(selected)
}));
