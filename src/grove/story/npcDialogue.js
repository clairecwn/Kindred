// src/grove/story/npcDialogue.js
//
// NPCs on the cheap, per the Animal Crossing / Stardew Valley recipe: a
// dialogue POOL keyed by context with no-immediate-repeat (never a
// branching tree), a short daily waypoint schedule, and a single
// friendship integer gating a couple of warmer tiers. That's most of the
// effect for a few hours of writing, and it's what this file is.
//
// Eight residents (see story/cast.js). Five of them (tansy, corvin, wren,
// pell, juniper) also staff an enterable shop from interiors/interiors.js,
// so they get an extra "shop" context; bramble, marlow and nim only ever
// appear outdoors in their own district.
//
// Contexts, each with >= 6 lines:
//   greeting     — the default line when first approached that visit
//   moodEcho     — a gentle, non-diagnostic nod to today's chosen task
//                  tone (never a claim to know how the player feels)
//   returning    — said after a real gap since the player's last visit
//   shop         — counter chatter, shopkeepers only
//
// Friendship tiers: 0 "stranger" (0-1), 1 "familiar" (2-4), 2 "warm" (5+).
// Tier only ever unlocks an ADDITIONAL slice of a pool already keyed by
// context — it never rewrites base lines, so a stranger and a warm friend
// both get a real conversation, just a shorter one.

export const FRIENDSHIP_TIERS = Object.freeze([
  { tier: 0, label: "stranger", min: 0 },
  { tier: 1, label: "familiar", min: 2 },
  { tier: 2, label: "warm", min: 5 },
]);

export function friendshipTier(points) {
  let current = FRIENDSHIP_TIERS[0];
  for (const t of FRIENDSHIP_TIERS) if (points >= t.min) current = t;
  return current;
}

// Daily schedule: 3-4 named waypoints an NPC drifts between. Purely
// flavour/positioning data for GroveScene to consume later; homeOffset in
// districts.js/interiors.js remains the source of truth for their base
// standing spot.
export const NPC_SCHEDULES = Object.freeze({
  bramble: ["the raised beds", "the hedge maze entrance", "the tool shed", "the fountain edge"],
  tansy:   ["the workbench", "the supply shelf", "the workshop doorway", "the scrap pile"],
  corvin:  ["centre stage", "the wings", "the front row", "the lounge counter"],
  wren:    ["behind the counter", "the outdoor tables", "the kettle", "the cafe doorway"],
  pell:    ["the Pantry counter", "the front crates", "the stockroom", "the courtyard"],
  juniper: ["the Threadbare counter", "the mirror", "the window display", "the courtyard tables"],
  marlow:  ["the jetty head", "the mooring post", "the Landing bench", "the bridge"],
  nim:     ["your bridge", "the fire bowl", "the far shore", "the cottage porch"],
});

export const NPC_DIALOGUE = Object.freeze({
  bramble: {
    greeting: [
      "\"Beds needed weeding anyway. Suppose I'll talk while I do it.\"",
      "\"You're back. Good. The hedge maze missed having someone to confuse.\"",
      "\"Mm. Sit if you want. Standing works too.\"",
      "\"Don't mind me, I'm mid-argument with a stubborn root.\"",
      "\"Quiet day. I like those. You?\"",
      "\"The Grove doesn't need you here. Neither do I, strictly. Nice that you came anyway.\"",
    ],
    moodEcho: [
      "\"Gentle day, gentle task. That's not a small choice, whatever anyone tells you.\"",
      "\"Some days the whole job is showing up. You did that.\"",
      "\"No prize for doing more than the day's got in it.\"",
      "\"The beds don't ask to be perfect. Neither do you, far as I'm concerned.\"",
      "\"Small task, still counts. I don't rate these things, but if I did.\"",
      "\"Rest is a kind of tending too. Same beds, next season.\"",
    ],
    returning: [
      "\"Been a while. The hedges didn't notice. I did, a bit.\"",
      "\"There you are. Beds are the same. You don't have to be, either way.\"",
      "\"No lecture coming. Just glad you're back.\"",
      "\"Whatever kept you, it kept you. Welcome back regardless.\"",
      "\"The garden doesn't keep score. Good policy, that.\"",
      "\"Thought you might've settled somewhere else. Nice to be wrong.\"",
    ],
  },
  marlow: {
    greeting: [
      "\"Boat's tied. Nothing needs doing. Take a minute.\"",
      "\"Path goes to the tree. Tree goes everywhere else. That's the whole map.\"",
      "\"You can sit on the jetty as long as you like. People do.\"",
      "\"I ferry. I don't ask. Two separate jobs, and I only took the one.\"",
      "\"Tide's doing what tides do. Restful to watch, if you've got the time.\"",
      "\"Bridge behind me goes to your own island. No hurry on that either.\"",
    ],
    moodEcho: [
      "\"Some crossings take longer than others. Not a fault in the boat.\"",
      "\"You arrived. That's the part people underrate.\"",
      "\"Slow is a speed. It's the one I've built a whole life on.\"",
      "\"Nothing on this island runs to a schedule but the tide, and it's patient.\"",
      "\"Whatever today had in it, the jetty'll still be here tomorrow.\"",
      "\"You don't owe the place anything for letting you land.\"",
    ],
    returning: [
      "\"Boat's still floating. So are you. Good enough.\"",
      "\"No questions about the gap. Never been my business.\"",
      "\"The jetty kept. It does that.\"",
      "\"Long way or short way, you came back the same door.\"",
      "\"Water forgets. Handy quality in water.\"",
      "\"Welcome in. Mind the second plank, it's always been like that.\"",
    ],
  },
  juniper: {
    greeting: [
      "\"Don't buy anything. Just look. Looking's the good part.\"",
      "\"Oh — that colour. Hm. No. Wrong week for it. Come back.\"",
      "\"I'm reorganising by feeling instead of size. It's going badly and I love it.\"",
      "\"Clothes are sentences. Some days you want a short one.\"",
      "\"Try it on, put it back, tell nobody. That's a full use of a shop.\"",
      "\"I opened late. I'll probably close early. The rail's still here either way.\"",
    ],
    moodEcho: [
      "\"Dressing down on a heavy day is a decision, not a failure.\"",
      "\"Nobody here is looking at what you're wearing. Except me, professionally.\"",
      "\"You're allowed to want to look like nothing at all today.\"",
      "\"Whatever you picked, you picked it. That's the only rule in here.\"",
      "\"Style's just the shape of a mood that made it out the door.\"",
      "\"Come back in whatever you've got on. Genuinely, whatever.\"",
    ],
    returning: [
      "\"The rail hasn't moved. Neither has the coat you kept looking at.\"",
      "\"No stock expired. Nothing here works that way.\"",
      "\"Back? Good. I held something aside, badly, in a pile.\"",
      "\"I don't keep a customer list. I do keep noticing people.\"",
      "\"Whatever the gap was, come in out of it.\"",
      "\"Same shop, slightly worse organisation. Welcome.\"",
    ],
    shop: [
      "\"Nothing in here is limited. If it's gone I'll make the same thing again.\"",
      "\"Price is on the tag and that's the price. I find haggling embarrassing.\"",
      "\"That one's kind. It's the only word I've got for it.\"",
      "\"You can put it back. Putting things back is a legitimate shopping outcome.\"",
      "\"Nobody here can see what you own. It's just for you.\"",
      "\"Take a moment. I'll be pretending to fold something.\"",
    ],
  },
  nim: {
    greeting: [
      "\"Hi! Hi. Sorry. I've been practising saying hi and it still came out like that.\"",
      "\"I got here a week before you. I'm not established. I want that on record.\"",
      "\"Is it weird that I like the bridge more than the island? Don't answer.\"",
      "\"I made a list of things to say to you. I've lost the list.\"",
      "\"You can tell me to go, by the way. I won't be weird about it. I'll be slightly weird about it.\"",
      "\"Your fire bowl's nicer than mine. Mine's a bucket.\"",
    ],
    moodEcho: [
      "\"Low day? Same. We can have one at the same time, separately.\"",
      "\"I did one small thing today and I'm counting it. You should count yours.\"",
      "\"Nobody told me it was allowed to just sit here. It's allowed.\"",
      "\"You don't have to be having a good time for this to be time well spent.\"",
      "\"Being new never quite wears off. I've decided that's fine.\"",
      "\"I'll be on the bridge. No reason. That's the reason.\"",
    ],
    returning: [
      "\"You're back! I didn't check. I definitely checked.\"",
      "\"I didn't count the days. I noticed them, but I didn't count.\"",
      "\"Nothing happened while you were gone. I mean that comfortingly.\"",
      "\"Take your time getting back into it. I'm still getting into it.\"",
      "\"No catching up needed. There's nothing to catch.\"",
      "\"Hi again. Same bridge. Same me.\"",
    ],
  },
  tansy: {
    greeting: [
      "\"Oh — hi! Sorry, hands are full of glue, one second—\"",
      "\"Perfect timing, or terrible, I genuinely can't tell yet.\"",
      "\"I've almost got this to work. Almost. Give it a minute. Or don't, either's fine.\"",
      "\"You want to see something I'm probably going to ruin? Come closer.\"",
      "\"Ask me anything except how long this has been sitting half-finished.\"",
      "\"I talk with my hands, sorry if I hit you with a plank.\"",
    ],
    moodEcho: [
      "\"Small project today? Love those. Less to go wrong.\"",
      "\"Whatever you made today, it's real. That's the whole bar.\"",
      "\"I once spent a week on a spoon. A whole week. On a spoon. Point being, pace is fake.\"",
      "\"You don't have to finish a thing for it to have been worth starting.\"",
      "\"Effort's not measured in size around here, thankfully for me.\"",
      "\"Come back tomorrow or don't, the bench isn't going anywhere.\"",
    ],
    shop: [
      "\"This one's new. I made it wrong three times before it was right.\"",
      "\"No pressure to buy, I just like showing people what I've been at.\"",
      "\"Prices are what they are. I don't do the pushy sell thing, it's exhausting for everyone.\"",
      "\"That one's my favourite this week. Ask me again next week, it'll change.\"",
      "\"Take your time. I'm not going anywhere, clearly.\"",
      "\"If it's not right, bring it back. I'd rather know.\"",
    ],
  },
  corvin: {
    greeting: [
      "\"Ah. Come to haunt the stage again, have you.\"",
      "\"I remember the last thing you did up there. Don't worry, it wasn't bad.\"",
      "\"Boards creak less when someone's actually using them.\"",
      "\"Sit if you like. The seats have opinions but they keep them to themselves.\"",
      "\"Every stage needs an audience of at least one. You'll do.\"",
      "\"No show today, far as I know. Come back when there's a reason, or don't need one.\"",
    ],
    moodEcho: [
      "\"A quiet turn counts the same in my books as a loud one.\"",
      "\"I've seen worse days end in better shows. Not saying that's this. Just saying it happens.\"",
      "\"You don't have to perform anything today. Watching's a role too.\"",
      "\"Small thing, done anyway — that's most of what I remember, over the years.\"",
      "\"The stage forgives a lot. So do I, mostly.\"",
      "\"Whatever today asked of you, you brought enough for it.\"",
    ],
    shop: [
      "\"Backstage stock, mostly forgotten by whoever left it. Now it's yours if you want it.\"",
      "\"I don't oversell. I've seen too many overselling acts flop.\"",
      "\"That piece has history. Not saying whose. Not saying it matters.\"",
      "\"Buy it or don't, either way you get the story for free.\"",
      "\"Fair price. I've had decades to get bored of haggling.\"",
      "\"Take it. Something ought to leave this dusty room occasionally.\"",
    ],
  },
  wren: {
    greeting: [
      "\"Sit anywhere. The good chair's the one closest to the kettle, if you're asking.\"",
      "\"You look like you could use whatever's warm. I've got warm.\"",
      "\"News of the day: the crops are fine, the weather's fine, I made too much bread.\"",
      "\"No obligation to talk. I'll talk enough for two if it comes to that.\"",
      "\"Back again. I'll pretend I'm surprised.\"",
      "\"Cup's on the counter. Take it whenever you're ready, no rush.\"",
    ],
    moodEcho: [
      "\"Some days call for the strong stuff, some days the mild. No wrong order.\"",
      "\"Whatever you did today, it earned you a seat here same as anything bigger would.\"",
      "\"I don't ask how people are doing. I just keep the cup full and let them decide.\"",
      "\"Small day, small task, still a day you showed up for. That's plenty by my count.\"",
      "\"Rest counts as an achievement around this counter.\"",
      "\"Nobody's graded on how much they did here. Good thing, given my own week.\"",
    ],
    returning: [
      "\"Cup's been cold a while. Let's fix that.\"",
      "\"Didn't think you'd forgotten the place. Glad to be right.\"",
      "\"No questions about where you've been. Sit down.\"",
      "\"The kettle doesn't judge a gap. Neither do I.\"",
      "\"Back is back, whenever that happens to be.\"",
      "\"Missed the company more than the custom, if I'm honest.\"",
    ],
    shop: [
      "\"Fresh batch. Not saying it's my best, but it's warm, which counts for a lot.\"",
      "\"Take your time deciding, the food isn't going anywhere fast.\"",
      "\"That one's popular. Doesn't mean you have to like it.\"",
      "\"I'll tell you honestly if something's not worth the coin. Usually don't have to.\"",
      "\"On the house, this once. Don't make it a habit, or do, I don't mind.\"",
      "\"Prices are fair. I set them myself, mostly out of spite for markup.\"",
    ],
  },
  pell: {
    greeting: [
      "\"Come to browse or come to buy, both are fine by me.\"",
      "\"New stall arrangement. Tell me honestly if it's worse.\"",
      "\"I don't do the hard sell. Waste of both our time.\"",
      "\"Everything's priced plain. What you see is what it costs, no surprises.\"",
      "\"Nice outfit. Take this, on me, for the outfit alone.\"",
      "\"Market's quiet today. Suits me. Suits the stock, too.\"",
    ],
    moodEcho: [
      "\"Didn't buy anything today? That's a perfectly good visit anyway.\"",
      "\"Some days you just come to look. The stall doesn't mind.\"",
      "\"Small purchase, small day, no shame in either.\"",
      "\"I'd rather sell one thing honestly than ten things pushily.\"",
      "\"Whatever today needed from you, hope the stall made it a little easier.\"",
      "\"Come back whenever. The prices won't have gone strange in the meantime.\"",
    ],
    returning: [
      "\"Stock's rotated a bit since you were last through. Have a look.\"",
      "\"Wondered where you'd got to. No charge for wondering.\"",
      "\"Nothing here expired waiting on you. Nothing here does that.\"",
      "\"Glad the gap didn't stick. Come see what's new.\"",
      "\"Market doesn't hold grudges about who visits when.\"",
      "\"Welcome back. Same fair prices as always.\"",
    ],
    shop: [
      "\"This one's new today. Have a proper look before you decide.\"",
      "\"No countdown on anything here. Buy it today, next week, next season.\"",
      "\"If you can't afford it now, it'll still be here later. I'm not going anywhere.\"",
      "\"Exact price, exact look, no surprise box. I don't deal in those.\"",
      "\"Take your time. I like watching people actually look at things.\"",
      "\"Fair's fair. I'd rather you leave happy than leave having spent more.\"",
    ],
  },
});

// One-repeat-avoidance helper shared by every NPC/context: given a pool
// and the last line shown, returns a random line that isn't that one
// (falls back to a random line if the pool has exactly one entry).
export function pickLine(pool, lastLine, rng = Math.random) {
  if (!pool || !pool.length) return null;
  if (pool.length === 1) return pool[0];
  let candidate = pool[Math.floor(rng() * pool.length)];
  let guard = 0;
  while (candidate === lastLine && guard < 8) {
    candidate = pool[Math.floor(rng() * pool.length)];
    guard++;
  }
  return candidate;
}

export function getDialoguePool(npcId, context) {
  return NPC_DIALOGUE[npcId]?.[context] ?? null;
}
