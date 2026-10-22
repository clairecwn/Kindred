/**
 * safety.js
 *
 * Safety rules as enforced code, not documentation. Users meeting strangers
 * from a mental health app are self-selected as vulnerable, so these are
 * hard rules, not nudges:
 *
 *  1. A user's FIRST meetup with a given host must be at a public, daytime
 *     venue -- never a private address.
 *  2. Host history must be visible before anyone can commit to host.
 *  3. Participants can see who else has joined before committing.
 *  4. "Bring a friend" must be offered as an option, not hidden.
 *  5. Blocking and reporting must be easy and non-punitive to the reporter.
 *  6. New accounts can join activities immediately but cannot HOST until a
 *     cooling-off period has passed.
 *
 * Every function here is pure: it takes plain data in and returns a plain
 * verdict out. Nothing here touches Supabase directly -- the migration in
 * supabase/migrations/20260904000000_ventures.sql stores the rows these
 * functions read (host_history, blocks, reports); RealWorldView.jsx is
 * responsible for fetching that data and calling these functions with it.
 */

export const HOST_COOLING_PERIOD_DAYS = 14;

/**
 * Has this user met this host before? Used to decide whether the "first
 * meetup must be public/daytime" rule applies.
 */
export function isFirstMeetupWithHost(userId, hostId, pastParticipation = []) {
  return !pastParticipation.some(
    (p) => p.hostId === hostId && p.userId === userId && p.attended !== false
  );
}

/**
 * Venue risk assessment for a candidate activity, given a user's history
 * with that host. Returns { suppress, reasons } -- suppress:true means the
 * activity must not be shown/joinable as-is (scoring.js treats this as a
 * hard filter failure).
 */
export function assessVenueRisk(activity, userContext = {}) {
  const reasons = [];

  const firstMeetup = isFirstMeetupWithHost(
    userContext.userId,
    activity.hostId,
    userContext.pastParticipation ?? []
  );

  if (firstMeetup && activity.hostId && activity.hostId !== userContext.userId) {
    if (activity.location.isPublicVenue === false) {
      reasons.push("first meetup with this host must be at a public venue");
    }
    if (activity.location.isDaytime === false) {
      reasons.push("first meetup with this host must be in the daytime");
    }
  }

  return { suppress: reasons.length > 0, reasons };
}

/**
 * Host eligibility: can this user host an activity right now?
 * accountCreatedAt: ISO date string or Date. now: Date, injectable for tests.
 */
export function canHost(user, now = new Date()) {
  if (!user || !user.accountCreatedAt) {
    return { canHost: false, reason: "missing account creation date" };
  }
  const created = new Date(user.accountCreatedAt);
  const ageDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays < HOST_COOLING_PERIOD_DAYS) {
    const remaining = Math.ceil(HOST_COOLING_PERIOD_DAYS - ageDays);
    return {
      canHost: false,
      reason: `new accounts can host after ${HOST_COOLING_PERIOD_DAYS} days (${remaining} day(s) left)`,
    };
  }
  if (user.isBlockedFromHosting) {
    return { canHost: false, reason: "hosting privileges suspended" };
  }
  return { canHost: true, reason: null };
}

/**
 * Summarise a host's visible history for display before anyone joins.
 * hostHistoryRows: rows from the host_history table (see migration).
 */
export function summariseHostHistory(hostHistoryRows = []) {
  const completed = hostHistoryRows.filter((r) => r.status === "completed").length;
  const cancelled = hostHistoryRows.filter((r) => r.status === "cancelled").length;
  const total = hostHistoryRows.length;
  return {
    totalHosted: total,
    completed,
    cancelled,
    isFirstTimeHost: total === 0,
    reliabilityRate: total > 0 ? completed / total : null,
  };
}

/**
 * Roster of who has joined, safe to show BEFORE a user commits to join.
 * Never expose more than displayName + optional avatar fields here.
 */
export function visibleParticipantRoster(participants = [], viewerId = null) {
  return participants
    .filter((p) => p.userId !== viewerId)
    .map((p) => ({ userId: p.userId, displayName: p.displayName ?? "Kindred member", avatar: p.avatar ?? null }));
}

/** Whether the "bring a friend" option should be offered for this activity. */
export function allowsBringAFriend(activity) {
  if (activity.capacity == null) return true;
  return (activity.joined ?? 0) + 1 < activity.capacity; // leave room for +1
}

/**
 * Build a block record. Blocking is unilateral, immediate, and requires no
 * justification -- non-punitive to the person doing the blocking.
 */
export function createBlock({ blockerId, blockedId, reason = null }) {
  if (!blockerId || !blockedId) throw new Error("createBlock requires blockerId and blockedId");
  if (blockerId === blockedId) throw new Error("cannot block yourself");
  return {
    blockerId,
    blockedId,
    reason,
    createdAt: new Date().toISOString(),
  };
}

/** Build a report record. Reporting never requires a matching block first. */
export function createReport({ reporterId, reportedId, activityId = null, category, details = "" }) {
  if (!reporterId || !reportedId || !category) {
    throw new Error("createReport requires reporterId, reportedId and category");
  }
  return {
    reporterId,
    reportedId,
    activityId,
    category, // e.g. 'harassment' | 'unsafe_venue' | 'no_show' | 'other'
    details,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

/** Given a list of block rows, should `viewerId` see content from `otherId`? */
export function isBlocked(blocks = [], viewerId, otherId) {
  return blocks.some(
    (b) =>
      (b.blockerId === viewerId && b.blockedId === otherId) ||
      (b.blockerId === otherId && b.blockedId === viewerId)
  );
}

/** Filter a list of activities to remove anything hosted by a blocked user. */
export function filterBlockedHosts(activities = [], blocks = [], viewerId) {
  return activities.filter((a) => !isBlocked(blocks, viewerId, a.hostId));
}
