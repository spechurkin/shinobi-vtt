import {PHYSICAL, RANKS} from "./config.mjs";
import {t, tf} from "./i18n.mjs";

export const number = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
export const clamp = (v, min, max) => Math.min(max, Math.max(min, number(v)));

export function checkResult(dice, modifier = 0, trained = false, strict = false) {
        if (dice.length !== 2 || dice.some(d => !Number.isInteger(d) || d < 1 || d > 6)) throw Error(t("errors.twoD6"));
        const target = (trained ? 5 : 7) + (strict ? 1 : 0);
        const total = dice[0] + dice[1] + number(modifier);
        const success = total >= target;
        const critical = dice[0] === dice[1];
        return {
                dice,
                total,
                target,
                success,
                critical,
                label: critical ? (success ? t("outcomes.criticalSuccess") : t("outcomes.criticalFailure")) : (success ? t("outcomes.success") : t("outcomes.failure"))
        };
}

export function severity(damage) {
        const d = number(damage);
        if (d >= 14) return {tier: 4, key: "dead", label: t("status.dead")};
        if (d >= 9) return {tier: 3, key: "dying", label: t("status.dying")};
        if (d >= 4) return {tier: 2, key: "wounded", label: t("status.wounded")};
        if (d > 0) return {tier: 1, key: "stunned", label: t("status.stunned")};
        return {tier: 0, key: "healthy", label: t("status.healthy")};
}

export function criticalDamage(amount, critical = false, armored = false) {
        const d = Math.max(0, number(amount));
        if (!critical || armored || !d) return d;
        return [0, 4, 9, 14, 14][severity(d).tier] > d ? [0, 4, 9, 14, 14][severity(d).tier] : d;
}

export function applyHit(current, amount, {critical = false, armored = false, wounds = 0} = {}) {
        const hit = criticalDamage(amount, critical, armored);
        const newWound = severity(hit).tier === 2;
        const count = number(wounds) + (newWound ? 1 : 0);
        const damage = Math.max(number(current) + hit, count >= 2 ? 9 : 0);
        return {hit, damage, wounds: count, state: severity(damage)};
}

export function loadState(slots, strong = false, wounded = false) {
        const max = strong ? 20 : 15, overloaded = slots > 10, immobile = slots > max;
        const speed = immobile ? 0 : (overloaded || wounded ? 10 : 20);
        return {value: slots, max, overloaded, immobile, speed, actionSpeed: speed / 2};
}

export function advancement(points, faction = "zaibatsu") {
        let rank = 0;
        RANKS.forEach((row, i) => {
                if (number(points) >= row[0]) rank = i;
        });
        return {
                rank,
                title: faction === "freelance" ? tf("ranks.freelance", {rank}) : t(RANKS[rank][faction === "yakuza" ? 2 : 1]),
                next: RANKS[rank + 1]?.[0] ?? null,
                reward: RANKS[rank][3],
                companionLimit: rank * 2,
                hireAttempts: rank,
                lifestyle: rank < 2 ? 1 : rank < 4 ? 2 : 3,
                weekly: [10000, 20000, 50000][rank < 2 ? 0 : rank < 4 ? 1 : 2]
        };
}

export function corporateAccount(rankSum) {
        // B-04 leaves exactly 20 unspecified: use the upper band, recorded in README.
        const n = Math.max(0, number(rankSum));
        return n * (n < 10 ? 10000 : n < 20 ? 50000 : 100000);
}

export function vehicleState(damage, size = "medium") {
        const [stop, destroy] = ({small: [10, 20], medium: [15, 25], large: [20, 40]})[size] ?? [15, 25];
        return {
                stop,
                destroy,
                label: t(damage >= destroy ? "status.destroyed" : damage >= stop ? "status.stopped" : "status.working")
        };
}

export function modifiers({
                                  skill,
                                  physical = PHYSICAL.has(skill),
                                  wounded = false,
                                  overloaded = false,
                                  augmentations = []
                          }) {
        const rows = [];
        if (wounded && !augmentations.includes("painThreshold")) rows.push({label: t("modifiers.wounded"), value: -2});
        if (physical && overloaded) rows.push({label: t("modifiers.overloaded"), value: -2});
        if (skill === "strength" && augmentations.includes("muscleMatrix")) rows.push({
                label: t("modifiers.muscleMatrix"),
                value: 4
        });
        return rows;
}

export function rangeFor(base, laser = false, silencer = false) {
        const range = number(base);
        return (laser ? range + Math.min(range, 100) : range) / (silencer ? 2 : 1);
}

export function iceModifier(level, network, delayed = false) {
        return clamp(level, 0, 6) - ({low: 2, high: 4, black: 6}[network] ?? 2) - (delayed ? 2 : 0);
}
