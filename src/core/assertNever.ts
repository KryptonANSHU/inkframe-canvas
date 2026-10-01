/** Makes a switch exhaustive: adding a union member without handling it fails to compile. */
export function assertNever(value: never): never {
  throw new Error(`Unhandled value: ${JSON.stringify(value)}`);
}
