/**
 * Password rules, shared by the web form, the server actions and the
 * assistant.
 *
 * Deliberately NOT in a `"use server"` file: such a file may only export
 * async functions, so a constant or a plain validator put there breaks the
 * build with "Only async functions are allowed to be exported" — see
 * PROGRESS.md pitfall 1, which this module exists to stop repeating.
 */

/**
 * better-auth enforces a minimum when a user signs themselves up, but not on
 * a direct write to the account row, which is what setting a password
 * administratively does. Without this an admin could set a one-character
 * password and lock nobody out at all.
 */
export const MIN_PASSWORD_LENGTH = 8;

/** The reason a password is unacceptable, or null when it is fine. */
export function passwordProblem(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `A password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (/^\s|\s$/.test(password)) {
    return "A password can't start or end with a space — it is too easy to mistype.";
  }
  return null;
}
