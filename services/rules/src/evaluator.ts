// Minimal JSON-Logic-like evaluator with guards

export type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue };
export type Context = Record<string, any>;

export interface EvalOptions {
  maxDepth?: number;
  allowedOps?: Set<string>;
}

const defaultAllowed = new Set([
  'var',
  'all',
  'any',
  'and',
  'or',
  '!',
  '==',
  '!=',
  '>',
  '>=',
  '<',
  '<=',
  '+',
  '-',
  '*',
  '/',
  'in',
  'contains',
]);

export function evaluate(rule: JsonValue, context: Context, opts: EvalOptions = {}): any {
  const maxDepth = opts.maxDepth ?? 16;
  const allowedOps = opts.allowedOps ?? defaultAllowed;

  function getVar(path: string) {
    const parts = path.split('.');
    let cur: any = context;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function evalNode(node: any, depth: number): any {
    if (depth > maxDepth) throw new Error('Max eval depth exceeded');
    if (node === null || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((n) => evalNode(n, depth + 1));
    const keys = Object.keys(node);
    if (keys.length !== 1) throw new Error('Invalid rule node');
    const op = keys[0];
    if (!allowedOps.has(op)) throw new Error(`Operator not allowed: ${op}`);
    const args = (node as any)[op];
    const vals = Array.isArray(args)
      ? args.map((a) => evalNode(a, depth + 1))
      : [evalNode(args, depth + 1)];

    switch (op) {
      case 'var': {
        const key = Array.isArray(args) ? args[0] : args;
        if (typeof key !== 'string') return undefined;
        return getVar(key);
      }
      case 'all':
      case 'and':
        return vals.every(Boolean);
      case 'any':
      case 'or':
        return vals.some(Boolean);
      case '!':
        return !vals[0];
      case '==':
        return vals[0] == vals[1];
      case '!=':
        return vals[0] != vals[1];
      case '>':
        return Number(vals[0]) > Number(vals[1]);
      case '>=':
        return Number(vals[0]) >= Number(vals[1]);
      case '<':
        return Number(vals[0]) < Number(vals[1]);
      case '<=':
        return Number(vals[0]) <= Number(vals[1]);
      case '+':
        return Number(vals[0]) + Number(vals[1]);
      case '-':
        return Number(vals[0]) - Number(vals[1]);
      case '*':
        return Number(vals[0]) * Number(vals[1]);
      case '/':
        return Number(vals[0]) / Number(vals[1] || 1);
      case 'in': {
        const [needle, hay] = vals as any[];
        if (typeof hay === 'string') return hay.includes(String(needle));
        if (Array.isArray(hay)) return hay.includes(needle);
        return false;
      }
      case 'contains': {
        const [hay, needle] = vals as any[];
        if (typeof hay === 'string') return hay.includes(String(needle));
        if (Array.isArray(hay)) return hay.includes(needle);
        return false;
      }
      default:
        throw new Error(`Unsupported operator: ${op}`);
    }
  }

  return !!evalNode(rule, 0);
}
