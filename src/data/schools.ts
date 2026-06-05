// Schools correspond to the POC's SCHOOL object keys (fire, frost, spark, poison, arcane)
// plus 'phys' which appears as type:'phys' in MOVES (fist/sword/bow) but has no SCHOOL entry.
export const SCHOOLS = ['phys', 'fire', 'frost', 'spark', 'poison', 'arcane'] as const;
export type School = (typeof SCHOOLS)[number];
