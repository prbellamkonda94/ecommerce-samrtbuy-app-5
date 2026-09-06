# Subagent Investigation Guide

Do these three steps in order, in your own Claude Code session, in this repo.
Each step is typed as a normal chat message — Claude Code will translate it
into real `Agent` tool calls. Read the "why this earns a subagent" note
before each one; that's the part worth explaining to students, not the exact
wording.

---

## Step 1 — Parallel log triage (independent + noisy)

You have three log files, ~40-80 lines each, from three unrelated services.
None needs to be read before the others. This is the textbook parallel case.

This is also the one step that has a **reusable custom agent** behind it —
see `.claude/agents/log-triage.md`. Unlike `Explore` or `general-purpose`
(generic, built-in), `log-triage` is scoped and prompted specifically for
"here's one service's log, tell me what's wrong and correlate against these
IDs." It's the subagent analog of a Skill: defined once, shows up by name in
every future session in this repo, reusable for the next incident without
re-explaining what a good log triage report looks like.

> **Note:** custom agent definitions are picked up at session start. If you
> just created `log-triage.md` in the same session, start a new Claude Code
> session (or run `/agents` if your version supports reloading) before it
> appears in the available agent list.

**Type this:**

> Read `training/black-friday-incident/report/incident-report.md` first for
> context. Then, in a single message, launch three `log-triage` agents in
> parallel — one for `training/black-friday-incident/logs/checkout-service.log`,
> one for `training/black-friday-incident/logs/payment-gateway.log`, one for
> `training/black-friday-incident/logs/inventory-service.log`. Tell each
> agent the order IDs listed in the incident report's Section 3 table, so it
> can correlate or rule itself out. Each agent should only look at its one
> file.

**What to watch for:**
- All three should be launched in **one message with three Agent tool calls** — that's what makes it parallel instead of accidentally serial.
- The payment-gateway agent should independently arrive at "amount_mismatch, always exactly ±$0.01, only on orders with 2+ stacked discounts."
- The inventory-service agent should report the WARN spike as a real anomaly — but notice it doesn't correlate with the *same* order IDs as the payment failures. That's the red herring resolving itself: elevated but unrelated.
- If a student's inventory theory says "this is causing the checkout errors," that's a good teaching moment — ask them to cross-reference the order IDs between `report/incident-report.md` section 3 and the inventory WARN timestamps. They don't match.

---

## Step 2 — Fresh-eyes code review (independence from your own theory)

By now you have a strong theory: something about stacking two discounts.
Don't open `discount.js` yourself first — hand it to an agent that has seen
none of your Step 1 conclusions, and let it find the bug cold.

**Type this:**

> Spawn a general-purpose agent. Give it this exact brief, with no other
> context from this conversation: "Review
> `training/black-friday-incident/discount.js`. It computes a checkout total
> by applying a list of percentage discounts to a subtotal. Payment-gateway
> independently recomputes the same total from the same subtotal and
> discount list, and occasionally rejects the charge as a mismatch by
> exactly one cent. Find the discrepancy between how the two totals could be
> computed and explain it precisely — cite the line."

**What to watch for:**
- A good agent will name the exact issue: `calculateStackedTotal` rounds to
  the cent after *every* discount step, while a mathematically equivalent
  "combine multipliers, round once" approach (`calculatePreciseTotal`, also
  in the file) can land a cent apart — because rounding is not distributive
  over multiplication.
- Ask students: why brief the agent with *no* prior context instead of
  pasting your Step 1 findings? (Answer: an agent primed with "we suspect
  discount stacking" will confirm what it's told to look for. An agent given
  only the code and the symptom has to actually derive it — a stronger
  signal that the bug is real and not confirmation bias.)

---

## Step 3 — Ship-readiness audit (survey, not a task)

Once the fix is written (make `calculateStackedTotal` match
`calculatePreciseTotal` — round once, at the end, from the combined
multiplier) — this last step is a broad, shallow sweep across several things
at once, not a single deep task. That's the audit-agent pattern.

**Type this:**

> Spawn a general-purpose agent to audit whether the discount-rounding fix
> in `training/black-friday-incident/discount.js` is complete. Check: does
> `calculateStackedTotal` now produce identical output to
> `calculatePreciseTotal` for every combination of 1-3 discounts between
> 5-30% on the 39 order subtotals in
> `training/black-friday-incident/logs/checkout-service.log`? Are there any
> other functions in the file with the same per-step-rounding pattern?
> Report a pass/fail punch list.

**What to watch for:**
- This is intentionally a "checklist across several things" prompt, not "fix
  bug X" — contrast with Step 2, which was one deep focused question.

---

## Debrief — what was *not* delegated, and why

- **Writing the actual fix** to `discount.js` — small, single-file, you
  already know exactly what to change after Step 2. Delegating it would
  just add a round-trip.
- **Deciding the fix is correct and safe to ship** — a judgment call that
  synthesizes all three subagent reports; that synthesis is exactly the
  part that stays with the orchestrating conversation (you), not a
  subagent.
- **Reading `report/incident-report.md` itself** — one file, directly
  relevant, no reason not to just read it.

Use this contrast with students: the exercise had five candidate moments to
delegate, and only three were good calls. Ask them to articulate, for each
of the two you *didn't* delegate, which of the criteria (independent /
noisy / fresh-eyes-needed) it was missing.
