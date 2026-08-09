import type { Prisma } from '@prisma/client';
import { SEARCH_MAX_DEPTH } from '../../../shared/constants';
import { ValidationError } from '../../../shared/errors/app-error';
import type {
  SearchAtom,
  SearchField,
  SearchFilterNode,
  SearchOperator,
} from '../schemas/search-schemas';

const STRING_FIELDS = new Set<SearchField>(['title', 'slug', 'director']);
const STRING_OPS = new Set<SearchOperator>([
  'eq',
  'neq',
  'contains',
  'startsWith',
  'endsWith',
  'in',
]);
const GENRE_OPS = new Set<SearchOperator>(['eq', 'in']);
const NUMBER_OPS = new Set<SearchOperator>([
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'between',
  'in',
]);
const DATE_OPS = new Set<SearchOperator>(['eq', 'gte', 'lte', 'between']);
const BOOL_OPS = new Set<SearchOperator>(['eq']);

function isGroup(node: SearchFilterNode): node is Extract<SearchFilterNode, { conditions: unknown }> {
  return 'conditions' in node;
}

export function buildSearchWhere(
  filter: SearchFilterNode | undefined,
  depth = 0,
): Prisma.UserMovieWhereInput | undefined {
  if (filter === undefined) {
    return undefined;
  }
  if (depth > SEARCH_MAX_DEPTH) {
    throw new ValidationError(`Search filter exceeds max depth of ${SEARCH_MAX_DEPTH}`);
  }
  if (isGroup(filter)) {
    const parts = filter.conditions.map((c) => buildSearchWhere(c, depth + 1)!);
    return filter.op === 'and' ? { AND: parts } : { OR: parts };
  }
  return buildAtomWhere(filter);
}

function buildAtomWhere(atom: SearchAtom): Prisma.UserMovieWhereInput {
  const { field, op } = atom;
  assertOperatorAllowed(field, op);

  if (field === 'title') {
    return { movie: { title: stringFilterRequired(op, atom) } };
  }
  if (field === 'slug') {
    return { movie: { slug: stringFilterNullable(op, atom) } };
  }
  if (field === 'director') {
    return { movie: { director: stringFilterNullable(op, atom) } };
  }
  if (field === 'genre') {
    return { movie: { genres: genreFilter(op, atom) } };
  }
  if (field === 'year') {
    return { movie: { year: intFilter(op, atom, { min: 1888, max: 2100 }) } };
  }
  if (field === 'rating') {
    return { rating: floatFilter(op, atom, { min: 0, max: 5 }) };
  }
  if (field === 'favorite') {
    if (typeof atom.value !== 'boolean') {
      throw new ValidationError('favorite requires a boolean value', { field, op });
    }
    return { favorite: atom.value };
  }
  if (field === 'watchedDate') {
    return { watchedDate: dateFilter(op, atom) };
  }
  throw new ValidationError(`Unsupported search field: ${field}`);
}

function assertOperatorAllowed(field: SearchField, op: SearchOperator): void {
  let allowed: Set<SearchOperator>;
  if (STRING_FIELDS.has(field)) {
    allowed = STRING_OPS;
  } else if (field === 'genre') {
    allowed = GENRE_OPS;
  } else if (field === 'year' || field === 'rating') {
    allowed = NUMBER_OPS;
  } else if (field === 'favorite') {
    allowed = BOOL_OPS;
  } else if (field === 'watchedDate') {
    allowed = DATE_OPS;
  } else {
    throw new ValidationError(`Unsupported search field: ${field}`);
  }
  if (!allowed.has(op)) {
    throw new ValidationError(`Operator "${op}" is not allowed for field "${field}"`, {
      field,
      op,
      allowed: [...allowed],
    });
  }
}

function asString(value: SearchAtom['value'], ctx: { field: SearchField; op: SearchOperator }): string {
  if (typeof value !== 'string') {
    throw new ValidationError('Expected a string value', ctx);
  }
  return value;
}

function asStringArray(
  value: SearchAtom['value'],
  ctx: { field: SearchField; op: SearchOperator },
): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new ValidationError('Expected an array of strings', ctx);
  }
  return value as string[];
}

function asNumber(
  value: SearchAtom['value'] | SearchAtom['valueTo'],
  ctx: { field: SearchField; op: SearchOperator },
): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError('Expected a number value', ctx);
  }
  return value;
}

function asNumberArray(
  value: SearchAtom['value'],
  ctx: { field: SearchField; op: SearchOperator },
): number[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'number')) {
    throw new ValidationError('Expected an array of numbers', ctx);
  }
  return value as number[];
}

function stringFilterRequired(
  op: SearchOperator,
  atom: SearchAtom,
): Prisma.StringFilter<'Movie'> {
  return stringFilterBase(op, atom) as Prisma.StringFilter<'Movie'>;
}

function stringFilterNullable(
  op: SearchOperator,
  atom: SearchAtom,
): Prisma.StringNullableFilter<'Movie'> {
  return stringFilterBase(op, atom) as Prisma.StringNullableFilter<'Movie'>;
}

function stringFilterBase(
  op: SearchOperator,
  atom: SearchAtom,
): Prisma.StringFilter<'Movie'> | Prisma.StringNullableFilter<'Movie'> {
  const ctx = { field: atom.field, op };
  switch (op) {
    case 'eq':
      return { equals: asString(atom.value, ctx), mode: 'insensitive' };
    case 'neq':
      return { not: asString(atom.value, ctx), mode: 'insensitive' };
    case 'contains':
      return { contains: asString(atom.value, ctx), mode: 'insensitive' };
    case 'startsWith':
      return { startsWith: asString(atom.value, ctx), mode: 'insensitive' };
    case 'endsWith':
      return { endsWith: asString(atom.value, ctx), mode: 'insensitive' };
    case 'in':
      return { in: asStringArray(atom.value, ctx), mode: 'insensitive' };
    default:
      throw new ValidationError(`Unsupported string operator: ${op}`, ctx);
  }
}

function genreFilter(
  op: SearchOperator,
  atom: SearchAtom,
): Prisma.StringNullableListFilter<'Movie'> {
  const ctx = { field: atom.field, op };
  if (op === 'eq') {
    return { has: asString(atom.value, ctx).toLowerCase() };
  }
  if (op === 'in') {
    return { hasSome: asStringArray(atom.value, ctx).map((g) => g.toLowerCase()) };
  }
  throw new ValidationError(`Unsupported genre operator: ${op}`, ctx);
}

function intFilter(
  op: SearchOperator,
  atom: SearchAtom,
  bounds: { min: number; max: number },
): Prisma.IntNullableFilter<'Movie'> {
  const ctx = { field: atom.field, op };
  const check = (n: number): number => {
    if (!Number.isInteger(n)) {
      throw new ValidationError('Expected an integer value', ctx);
    }
    if (n < bounds.min || n > bounds.max) {
      throw new ValidationError(`Value must be between ${bounds.min} and ${bounds.max}`, ctx);
    }
    return n;
  };

  switch (op) {
    case 'eq':
      return { equals: check(asNumber(atom.value, ctx)) };
    case 'neq':
      return { not: check(asNumber(atom.value, ctx)) };
    case 'gt':
      return { gt: check(asNumber(atom.value, ctx)) };
    case 'gte':
      return { gte: check(asNumber(atom.value, ctx)) };
    case 'lt':
      return { lt: check(asNumber(atom.value, ctx)) };
    case 'lte':
      return { lte: check(asNumber(atom.value, ctx)) };
    case 'between': {
      const from = check(asNumber(atom.value, ctx));
      const to = check(asNumber(atom.valueTo, ctx));
      if (from > to) {
        throw new ValidationError('between requires value <= valueTo', ctx);
      }
      return { gte: from, lte: to };
    }
    case 'in':
      return { in: asNumberArray(atom.value, ctx).map(check) };
    default:
      throw new ValidationError(`Unsupported number operator: ${op}`, ctx);
  }
}

function floatFilter(
  op: SearchOperator,
  atom: SearchAtom,
  bounds: { min: number; max: number },
): Prisma.FloatNullableFilter<'UserMovie'> {
  const ctx = { field: atom.field, op };
  const check = (n: number): number => {
    if (n < bounds.min || n > bounds.max) {
      throw new ValidationError(`Value must be between ${bounds.min} and ${bounds.max}`, ctx);
    }
    return n;
  };

  switch (op) {
    case 'eq':
      return { equals: check(asNumber(atom.value, ctx)) };
    case 'neq':
      return { not: check(asNumber(atom.value, ctx)) };
    case 'gt':
      return { gt: check(asNumber(atom.value, ctx)) };
    case 'gte':
      return { gte: check(asNumber(atom.value, ctx)) };
    case 'lt':
      return { lt: check(asNumber(atom.value, ctx)) };
    case 'lte':
      return { lte: check(asNumber(atom.value, ctx)) };
    case 'between': {
      const from = check(asNumber(atom.value, ctx));
      const to = check(asNumber(atom.valueTo, ctx));
      if (from > to) {
        throw new ValidationError('between requires value <= valueTo', ctx);
      }
      return { gte: from, lte: to };
    }
    case 'in':
      return { in: asNumberArray(atom.value, ctx).map(check) };
    default:
      throw new ValidationError(`Unsupported number operator: ${op}`, ctx);
  }
}

function parseDate(
  value: SearchAtom['value'] | SearchAtom['valueTo'],
  ctx: { field: SearchField; op: SearchOperator },
): Date {
  if (typeof value !== 'string') {
    throw new ValidationError('Expected an ISO datetime string', ctx);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ValidationError('Invalid ISO datetime string', ctx);
  }
  return date;
}

function dateFilter(op: SearchOperator, atom: SearchAtom): Prisma.DateTimeNullableFilter {
  const ctx = { field: atom.field, op };
  switch (op) {
    case 'eq':
      return { equals: parseDate(atom.value, ctx) };
    case 'gte':
      return { gte: parseDate(atom.value, ctx) };
    case 'lte':
      return { lte: parseDate(atom.value, ctx) };
    case 'between': {
      const from = parseDate(atom.value, ctx);
      const to = parseDate(atom.valueTo, ctx);
      if (from.getTime() > to.getTime()) {
        throw new ValidationError('between requires value <= valueTo', ctx);
      }
      return { gte: from, lte: to };
    }
    default:
      throw new ValidationError(`Unsupported date operator: ${op}`, ctx);
  }
}
