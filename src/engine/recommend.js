// src/engine/recommend.js
/**
 * Recommend a size with simple, explainable logic.
 * user: { chest_cm, waist_cm }
 * sizeList: [{ size, chest_cm, waist_cm, ease_cm, length_cm, sleeve_len_cm }]
 * fit_preference: 'snug' | 'regular' | 'relaxed'
 */
export function recommendSize({ user, sizeList, fit_preference = 'regular' }) {
  const targetEase = fit_preference === 'snug' ? 2 :
                     fit_preference === 'relaxed' ? 8 : 4; // cm

  let best = null;
  for (const s of sizeList) {
    const chestEase = (s.chest_cm ?? 0) - (user.chest_cm ?? 0);
    const waistEase = (s.waist_cm ?? 0) - (user.waist_cm ?? user.chest_cm * 0.85);

    let score = 1
      - Math.abs(chestEase - targetEase) / 8
      - 0.25 * Math.max(0, -waistEase) / 4;

    score = clamp01(score);

    if (!best || score > best.fit_score) {
      best = {
        recommended: s.size,
        fit_score: score,
        label: chestEase < 2 ? 'Snug'
              : chestEase < 6 ? 'Regular'
              : 'Relaxed',
        chestEase, waistEase
      };
    }
  }

  if (!best) return { recommended: sizeList?.[0]?.size ?? 'M', fit_score: 0, label: 'Unknown' };
  return best;
}

const clamp01 = (x) => Math.max(0, Math.min(1, x));
