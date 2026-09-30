/**
 * The one account that survives everything.
 *
 * WD Logistics runs as a single organisation with several admins, and until
 * now every admin was identical: any of them could change any other's
 * password, demote them, or remove them outright. That is fine among equals
 * and wrong for the owner's own account — an admin having a bad day, or a
 * borrowed laptop, could lock the business out of its own system, and the
 * "reset everything" button would take the last way back in with it.
 *
 * So one email is the root: the account the deployment seeds, the one the
 * reset leaves standing, and the one no other admin can reach.
 *
 * ## What being root actually means
 *
 * - **Nobody else may change its password.** Other admins can still change
 *   their own and each other's; the root's is its own to change and nobody
 *   else's to touch.
 * - **Nobody may change its role or remove it.** Including itself: an
 *   organisation with no admin has no way back, and the demotion that gets
 *   you there is always an accident.
 * - **A reset keeps it.** Everything else goes — people, contacts, the
 *   assistant's memory of every conversation — and this account is what is
 *   left to start again from.
 *
 * It is not a fifth role. The root is an ordinary admin in every other
 * respect: same pages, same permissions, same rules about money. This is one
 * account marked out, not a level above admin.
 *
 * Configurable by env for a deployment that wants a different owner, and
 * compared case-insensitively because email addresses are typed by people.
 */

export const ROOT_ADMIN_EMAIL = (
  process.env.ROOT_ADMIN_EMAIL ??
  process.env.SEED_ADMIN_EMAIL ??
  "admin@wd-logistics.co.zw"
)
  .trim()
  .toLowerCase();

/** The root account's name on a fresh deployment. */
export const ROOT_ADMIN_NAME = process.env.SEED_ADMIN_NAME ?? "Administrator";

export function isRootAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === ROOT_ADMIN_EMAIL;
}

/**
 * Whether `actorEmail` may set `targetEmail`'s password.
 *
 * Everyone may set their own. An admin may set anybody else's — except the
 * root's, which only the root may change.
 */
export function canSetPasswordFor(
  actorEmail: string,
  targetEmail: string,
): boolean {
  if (actorEmail.trim().toLowerCase() === targetEmail.trim().toLowerCase()) {
    return true;
  }
  return !isRootAdmin(targetEmail);
}

/**
 * The refusal, in the words the person reads. One sentence, and it says who
 * can do it instead rather than only that they cannot.
 */
export const ROOT_PASSWORD_REFUSAL =
  "That is the root administrator's account. Only they can change their own password.";

export const ROOT_ROLE_REFUSAL =
  "The root administrator's role cannot be changed — it is the account the system is recovered from.";

export const ROOT_REMOVE_REFUSAL =
  "The root administrator cannot be removed — it is the account the system is recovered from.";
