# Roof measurement notes

## Do not divide areaMeters2 by cos(pitch)

Google Solar API documents `roofSegmentStats[].stats.areaMeters2` as:

> "This is the roof area (accounting for tilt), not the ground footprint area."

The value is already the sloped roof surface. Dividing it by cos(pitch) applies
pitch a second time and inflates every measurement by 5-41% depending on slope.
This bug was live until 2026-08-01 and, stacked with a flat 1.25 calibration
factor, made a typical 6/12 roof quote about 61% high.

Convert square meters to square feet and nothing else:

    sqft += areaMeters2 * 10.7639;

## requiredQuality is a minimum floor

`requiredQuality` sets the lowest acceptable model quality; Google returns the
best model it has at or above that floor. A single request at LOW already gets
the sharpest available model. Requesting HIGH does not get better data - it just
404s on addresses where Google has no high-quality model, and costs extra calls.
Read `response.imageryQuality` to see what you actually got.

  HIGH   = low-altitude aerial,  0.10 m/pixel
  MEDIUM = high-altitude aerial, 0.25 m/pixel
  LOW    = satellite,            0.25 m/pixel

## waste factor

`SOLAR.waste` (1.10) is a real roofing waste allowance - cuts, starter course,
ridge, valleys. It is not a fudge factor and should not be used to paper over
measurement bugs. Validate it against Hover reports grouped by facet count.

## Known permanent limitation

Google's imagery can be years stale (2016 on the original calibration house).
Additions built since the flyover are invisible. Always present the estimate as
a range confirmed at the on-site inspection.
