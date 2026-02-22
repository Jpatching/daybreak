/**
 * Feature flags — gate experimental features behind env vars.
 * Set NEXT_PUBLIC_FF_<NAME>=true in .env.local to enable.
 * In production, unset features show "Coming Soon" instead of broken UI.
 */

export const features = {
  // Confidence indicator showing data quality metrics inline
  confidenceIndicator: process.env.NEXT_PUBLIC_FF_CONFIDENCE === 'true',

  // Advanced death classification breakdown (rug vs natural vs unverified)
  deathBreakdown: process.env.NEXT_PUBLIC_FF_DEATH_BREAKDOWN === 'true',

  // Deployer comparison feature
  deployerComparison: process.env.NEXT_PUBLIC_FF_COMPARISON === 'true',

  // Historical trend charts
  historicalTrends: process.env.NEXT_PUBLIC_FF_TRENDS === 'true',

  // Browser extension promo
  browserExtension: process.env.NEXT_PUBLIC_FF_EXTENSION === 'true',
};

/**
 * Check if a feature is enabled. Returns false if flag is not set.
 */
export function isEnabled(flag) {
  return features[flag] === true;
}
