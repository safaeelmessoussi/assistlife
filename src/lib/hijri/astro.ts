/**
 * The two astronomical quantities the Hijri engine needs: the instant of a
 * new moon (conjunction) and the time of sunset at a place.
 *
 * Times are Julian Days in Universal Time. Accuracy is a few minutes, which
 * is far finer than the one-day decisions built on top.
 */

const RAD = Math.PI / 180;
const sin = (deg: number) => Math.sin(deg * RAD);

/** Julian Day at 00:00 UT of day number 0 (1970-01-01). */
export const JD_EPOCH = 2440587.5;

/** Mean length of a lunar month in days. */
export const SYNODIC_MONTH = 29.530588861;

/**
 * Instant of the new moon numbered `k` (k = 0 is the new moon of 6 January 2000).
 * Jean Meeus, "Astronomical Algorithms", chapter 49, periodic terms only.
 */
export function newMoonJd(k: number): number {
  const T = k / 1236.85;
  const T2 = T * T;
  const T3 = T2 * T;
  const T4 = T3 * T;

  const mean = 2451550.09766 + SYNODIC_MONTH * k + 0.00015437 * T2 - 0.00000015 * T3 + 0.00000000073 * T4;
  const E = 1 - 0.002516 * T - 0.0000074 * T2;
  const M = 2.5534 + 29.1053567 * k - 0.0000014 * T2 - 0.00000011 * T3;
  const Mp = 201.5643 + 385.81693528 * k + 0.0107582 * T2 + 0.00001238 * T3 - 0.000000058 * T4;
  const F = 160.7108 + 390.67050284 * k - 0.0016118 * T2 - 0.00000227 * T3 + 0.000000011 * T4;
  const Om = 124.7746 - 1.56375588 * k + 0.0020672 * T2 + 0.00000215 * T3;

  const correction =
    -0.4072 * sin(Mp) +
    0.17241 * E * sin(M) +
    0.01608 * sin(2 * Mp) +
    0.01039 * sin(2 * F) +
    0.00739 * E * sin(Mp - M) -
    0.00514 * E * sin(Mp + M) +
    0.00208 * E * E * sin(2 * M) -
    0.00111 * sin(Mp - 2 * F) -
    0.00057 * sin(Mp + 2 * F) +
    0.00056 * E * sin(2 * Mp + M) -
    0.00042 * sin(3 * Mp) +
    0.00042 * E * sin(M + 2 * F) +
    0.00038 * E * sin(M - 2 * F) -
    0.00024 * E * sin(2 * Mp - M) -
    0.00017 * sin(Om) -
    0.00007 * sin(Mp + 2 * M) +
    0.00004 * sin(2 * Mp - 2 * F) +
    0.00004 * sin(3 * M) +
    0.00003 * sin(Mp + M - 2 * F) +
    0.00003 * sin(2 * Mp + 2 * F) -
    0.00003 * sin(Mp + M + 2 * F) +
    0.00003 * sin(Mp - M + 2 * F) -
    0.00002 * sin(Mp - M - 2 * F) -
    0.00002 * sin(3 * Mp + M) +
    0.00002 * sin(4 * Mp);

  // The series gives Dynamical Time; subtract ΔT (about 72 s in this era) for UT.
  return mean + correction - 72 / 86400;
}

/**
 * Sunset on a local calendar day at a place (longitude east-positive, degrees).
 * Standard sunrise equation with refraction and the solar radius (−0.833°).
 */
export function sunsetJd(day: number, lat: number, lon: number): number {
  const n = day + JD_EPOCH + 0.5 - 2451545.0;
  const jStar = n - lon / 360;
  const M = (((357.5291 + 0.98560028 * jStar) % 360) + 360) % 360;
  const C = 1.9148 * sin(M) + 0.02 * sin(2 * M) + 0.0003 * sin(3 * M);
  const lambda = (M + C + 180 + 102.9372) % 360;
  const transit = 2451545.0 + jStar + 0.0053 * sin(M) - 0.0069 * sin(2 * lambda);
  const sinDec = sin(lambda) * sin(23.4397);
  const cosDec = Math.cos(Math.asin(sinDec));
  const cosHour = (sin(-0.833) - sin(lat) * sinDec) / (Math.cos(lat * RAD) * cosDec);
  const hourAngle = Math.acos(Math.min(1, Math.max(-1, cosHour))) / RAD;
  return transit + hourAngle / 360;
}
