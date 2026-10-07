/** 极简入参校验（不引入额外依赖） */
export const isStr = (v: unknown, min = 0, max = 500): v is string => typeof v === "string" && v.trim().length >= min && v.length <= max;
export const isOneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === "string" && (list as readonly string[]).includes(v);
