/**
 * Compile-time exhaustiveness check for discriminated-union switches.
 *
 * Place at the `default` branch of a switch over a string-literal union.
 * If the union grows and a case is added without updating the switch,
 * `value` is no longer narrowed to `never`, and this function fails to
 * typecheck — surfacing the missing case at build time.
 *
 * At runtime, throws — the type system should make this unreachable, so
 * a thrown error indicates a real bug (cast bypassed type system, or
 * runtime data didn't match the declared union).
 */
export function assertNever(value: never): never {
  throw new Error(`Unhandled discriminant: ${String(value)}`)
}
