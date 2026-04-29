// Convert a dimension value to meters based on unit
function toMeters(val, unit) {
  if (unit === 'ft')   return val * 0.3048;
  if (unit === 'cm')   return val / 100;
  if (unit === 'inch') return val * 0.0254;
  return val; // already meters
}

/**
 * Returns the effective price per piece given a product's pricing mode and dimensions.
 * basePrice is price per sqm / per meter / per piece depending on pricingMode.
 */
export function calcPricePerPiece(product, basePrice) {
  if (!product || basePrice == null) return basePrice || 0;
  const mode = product.pricingMode;
  if (!mode || mode === 'per_piece') return basePrice;

  const len  = product.dimensionLength || 0;
  const wid  = product.dimensionWidth  || 0;
  const unit = product.dimensionUnit   || 'ft';

  if (mode === 'per_sqm') {
    const area = toMeters(len, unit) * toMeters(wid, unit);
    return basePrice * area;
  }
  if (mode === 'per_meter') {
    return basePrice * toMeters(len, unit);
  }
  return basePrice;
}

/** Human-readable rate label: '/sqm', '/m', '/pcs' */
export function pricingRateLabel(product) {
  if (!product?.pricingMode || product.pricingMode === 'per_piece') return '/pcs';
  if (product.pricingMode === 'per_sqm')   return '/sqm';
  if (product.pricingMode === 'per_meter') return '/m';
  return '/pcs';
}

/** Short dimension string for display: '3×3 ft', '6 m/pcs' */
export function dimensionDisplay(product) {
  if (!product?.pricingMode || product.pricingMode === 'per_piece') return null;
  const len  = product.dimensionLength || 0;
  const wid  = product.dimensionWidth  || 0;
  const unit = product.dimensionUnit   || 'ft';
  if (product.pricingMode === 'per_sqm')   return `${len}×${wid} ${unit}`;
  if (product.pricingMode === 'per_meter') return `${len} ${unit}/pcs`;
  return null;
}

/** Area or length in sqm / m (for display) */
export function calcMeasurement(product) {
  const len  = product.dimensionLength || 0;
  const wid  = product.dimensionWidth  || 0;
  const unit = product.dimensionUnit   || 'ft';
  if (product.pricingMode === 'per_sqm') {
    return toMeters(len, unit) * toMeters(wid, unit);
  }
  if (product.pricingMode === 'per_meter') {
    return toMeters(len, unit);
  }
  return null;
}
