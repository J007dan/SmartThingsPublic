/* ------------------------------------------------------------------
   And then . . .?  —  content + classification layer
   Separated from the view so the shipping pipeline can emit this file.
   ------------------------------------------------------------------ */

/* Recurring shapes a story resolves into. Once a story is classified,
   "what came of it" stops being open-ended research and becomes a
   specific docket to check on a known clock. */
const ARCHETYPES = {
  anchorSoften: {
    name: "Anchor, then soften",
    tell: "A maximal, category-wide action announced with no carve-outs and immediate effect.",
    check: "Agency exemption notices, waivers, and named conditional approvals",
    window: "First carve-outs 2–6 weeks; named incumbents approved 1–3 months"
  },
  anchorTookEffect: {
    name: "Took effect ≠ stuck",
    tell: "The deadline arrives and the number does not move, so the story is filed as settled. Durability is a separate question the coverage never returns to.",
    check: "The effective rate rather than the headline — exclusion notices, the scope of the covered basket, and any statute the same duty can be rebuilt on",
    window: "Erosion usually begins within 1–4 months, and arrives by exclusion rather than repeal"
  },
  stayed: {
    name: "Ruled, then stayed",
    tell: "A lower court blocks something; the celebration precedes the appeal.",
    check: "Emergency applications and the shadow docket",
    window: "Stay typically within 3–20 days"
  },
  inert: {
    name: "Inert until an agency moves",
    tell: "An order directing action that no existing product, rule or market can currently perform.",
    check: "Rulemakings, FDA/CDC schedules, and any litigation the order directs",
    window: "Months. Often never"
  },
  referred: {
    name: "Referred, not charged",
    tell: "A committee vote or referral reported as though it were a prosecution.",
    check: "Whether the receiving department files anything at all",
    window: "Most referrals produce no charge; check at 90 days"
  },
  vowsToSue: {
    name: "Vows to sue",
    tell: "A statement of intent reported as an event.",
    check: "Actual docket filings, and whether it becomes their own case or a joinder",
    window: "1–3 weeks to file; a year or more to resolve"
  },
  permanent: {
    name: "Done and irreversible",
    tell: "A confirmation, appointment or effective date with no appeal path.",
    check: "Nothing. This is the answer",
    window: "Immediate and permanent"
  },
  talksStall: {
    name: "Talks stall, then resume",
    tell: "A rejection or walkout described as collapse by one side and vindication by the other.",
    check: "Envoy travel, deadline extensions, and whether violence continued during talks",
    window: "Cycles every 2–4 weeks, often for years"
  },
  attentionNoPolicy: {
    name: "Attention without policy change",
    tell: "Verified reporting on real harm, met with letters rather than rules.",
    check: "The underlying policy document, not the individual cases",
    window: "Individual relief in days; policy change rarely"
  },
  coalition: {
    name: "Coalition fight, compounds",
    tell: "An internal succession or loyalty fight, where participants gain from continuing.",
    check: "Escalation, not resolution",
    window: "Grows over months"
  },
  emergencyToClock: {
    name: "Emergency filing, ordinary clock",
    tell: "An emergency application whose urgency is not matched by the Court's pace, or by whether the thing can physically be implemented in time.",
    check: "The order list, and the implementing agency's own capacity filings",
    window: "Weeks; frequently mooted by logistics before it is decided"
  },
  struckRebuilt: {
    name: "Struck down, rebuilt elsewhere",
    tell: "A decisive ruling against an authority the executive can substitute from another statute.",
    check: "Which statute the same policy reappears under",
    window: "3–9 months to rebuild"
  }
};

const EDITIONS = [
  {
    id: "2026-08-10",
    label: "10 August 2026",
    sub: "Fourteen days on",
    stories: [
      {
        ago: "14 days ago",
        date: "Monday, 10 August",
        headline: "Federal appeals court rules Trump cannot build his $400 million White House ballroom without Congress",
        tags: [{ t: "Supreme Court", k: "t-scotus" }],
        arch: "stayed",
        rx: {
          left: "Read as the moment a court finally drew a line on executive spending. The judges' names trended for a day and a great many posts declared that accountability had arrived.",
          right: "Read as two appellate judges blocking a privately funded gift to the White House out of spite — obstruction of a project costing taxpayers nothing."
        },
        noise: 3, then: 1,
        verdict: "Undone in 11 days",
        outcome: [
          "On 21 August, Chief Justice John Roberts issued a temporary stay lifting the hold. Construction was never actually interrupted, and the structure is now rising aboveground on the east side of the White House.",
          "The case is still live and the stay is explicitly provisional — the justices simply wanted more time. But the practical situation two weeks later is identical to the situation two weeks before: they are building the ballroom."
        ],
        sources: [
          ["Appeals court blocks construction of White House ballroom — ABC News", "https://abcnews.com/US/appeals-court-blocks-construction-white-house-ballroom/story?id=135459043"],
          ["Supreme Court allows ballroom construction to continue for now — NPR, 21 Aug", "https://www.npr.org/2026/08/21/nx-s1-5935417/supreme-court-allows-trumps-ballroom-construction-to-continue-for-now"]
        ]
      },
      {
        ago: "14 days ago",
        date: "Monday, 10 August",
        headline: "Trump signs executive order splitting the MMR vaccine into three shots and cutting the childhood schedule from 17 doses to 11",
        tags: [],
        arch: "inert",
        rx: {
          left: "Near the top of the week's alarm. Physicians' groups warned of preventable outbreaks, and the order was widely described as the end of routine childhood immunization in America.",
          right: "Framed as restoring parental choice and spacing out an overloaded schedule — a campaign promise kept and a rebuke to the public health establishment."
        },
        noise: 3, then: 1,
        verdict: "Inert, with a live fuse",
        outcome: [
          "The MMR provision cannot currently be carried out by anyone. No manufacturer sells standalone measles, mumps or rubella vaccines in the United States, and the order does not create one. Fourteen days on, nothing about vaccine availability this fall has changed.",
          "The part that could actually bite got far less attention from either side: the order directs the Attorney General to bring legal challenges against state limits on religious and medical exemptions. That is real and untested. If this story matters, it will matter through that clause, months from now, under a headline nobody connects to this one."
        ],
        sources: [
          ["What the executive order means for vaccinations this fall — CNN, 10 Aug", "https://www.cnn.com/2026/08/10/health/executive-order-vaccines-what-it-means"],
          ["Doctors push back on executive order — ABC News", "https://abcnews.com/Politics/trump-executive-order-childhood-vaccine-schedule/story?id=135524851"],
          ["CIDRAP: order to break up the measles, mumps and rubella vaccine", "https://www.cidrap.umn.edu/childhood-vaccines/trump-signs-executive-order-break-measles-mumps-rubella-vaccine"]
        ]
      },
      {
        ago: "14 days ago",
        date: "Monday, 10 August",
        headline: "Senators release texts from Fauci's government iPhone as a Senate committee votes to hold him in contempt",
        tags: [],
        arch: "referred",
        rx: {
          left: "Covered as a partisan exercise, with attention to the fact that the released texts show Fauci noting that more than 10,000 pregnant women had been vaccinated and \"no issues have arisen.\"",
          right: "Very big. Senators Johnson and Paul published texts from a phone containing more than 34,000 messages; Sen. Marshall called for a special counsel and Sen. Paul referred Fauci to the Justice Department for prosecution."
        },
        noise: 3, then: 1,
        verdict: "Referred, not charged",
        outcome: [
          "Two weeks on, the contempt referral sits where contempt referrals sit. A referral is a request that the Justice Department act; it is not a charge, and no charging decision has been announced.",
          "The texts themselves proved the least useful part of the story for the people promoting them — the passage at the centre of the release has him reporting an absence of adverse events, which is why the two lenses above describe the same document so differently.",
          "This is a right-lens mirror of \"vows to sue\": a procedural step reported as an outcome."
        ],
        sources: [
          ["Senators Johnson, Paul release initial texts from Fauci's government iPhone", "https://www.ronjohnson.senate.gov/2026/08/10/senators-johnson-paul-release-initial-texts-from-dr-faucis-government-iphone-2/"],
          ["Republican senators release Fauci's text messages — CNN, 11 Aug", "https://www.cnn.com/2026/08/11/politics/fauci-text-messages-released-covid-vaccine-pregnancy-hnk"],
          ["Senate committee votes to hold Fauci in contempt — PBS News", "https://www.pbs.org/newshour/show/news-wrap-senate-committee-votes-to-hold-fauci-in-contempt-of-congress"]
        ]
      },
      {
        ago: "14 days ago",
        date: "Monday, 10 August",
        headline: "A 50% tariff on Canada is days from taking effect, as Commerce moves to widen Section 232 duties on steel, aluminium and copper",
        tags: [{ t: "Trade · anchor", k: "t-trade" }],
        arch: "anchorTookEffect",
        rx: {
          left: "Framed as chaos and self-inflicted price increases, with the usual reminder that tariffs are paid by importers.",
          right: "Framed as finally using leverage on a neighbour that has been free-riding on American markets for decades."
        },
        noise: 2, then: 2,
        verdict: "Took effect — durability unproven",
        outcome: [
          "The tariffs took effect. Trump paused them for three days on 19 August citing a near-final deal, talks collapsed on the Friday night, and 50% duties landed at 12:01am Saturday on roughly $20 billion of Canadian goods — dairy, alcohol, cement, hockey equipment. Carney suspended negotiations and recalled Canada’s team the same day.",
          "So the anchor held at the deadline. That is where the coverage stopped, and it is the wrong place to stop. “Took effect” and “stuck” are different claims, and no comparable maximal tariff anchor has stayed at its announced level.",
          "Three things were visible on day one and went almost unreported. The legal authority is Section 338 of the Tariff Act of 1930 — an essentially unused provision, not the IEEPA power the Supreme Court struck down in February. The covered basket was carved out before the duties ever landed: energy, potash, fish, critical minerals and goods already under Section 232 are excluded, which is most of what actually matters in the relationship. And it runs alongside a live USMCA renegotiation. Holland & Knight titled their client alert “50 Percent Opening Bid.”",
          "The honest counter-signal, and the reason this is a forecast rather than a certainty: the instrument was deliberately hardened against both mechanisms that unwound the last two rounds. Section 338 is untouched by the February IEEPA ruling that collapsed Brazil’s 50%, and unlike March 2025 it explicitly denies USMCA-compliant relief — the exact escape hatch Canada used last time. Both doors were closed on purpose."
        ],
        anchorBase: true,
        prediction: {
          claim: "The 50% will not still be the operative rate across the full original $20 billion basket by the end of November 2026. The likeliest mechanism is product-level exclusions rather than repeal — the headline number survives while the basket quietly shrinks.",
          basis: "Five of six comparable maximal anchors came down substantially, most within weeks. Canada’s own March 2025 round collapsed in 48 hours via a USMCA carve-out. This action arrived pre-carved — energy, potash, fish and critical minerals excluded on day one — which is the erosion mechanism already running, and it is pressure timed to a live USMCA renegotiation rather than a standalone policy.",
          against: "Two real reasons to hold this near three-in-four rather than certain. Section 338 was chosen precisely because it dodges the IEEPA ruling and overrides USMCA relief, closing both prior exits. And India stands as the counter-example: its 25% escalated to 50% instead of settling. Anchors do sometimes ratchet up.",
          check: "Federal Register exclusion notices and the covered-goods list — the effective rate on the basket, not the headline percentage",
          by: "30 November 2026"
        },
        sources: [
          ["Trump says U.S. and Canada reached deal to delay 50% tariffs — NPR, 19 Aug", "https://www.npr.org/2026/08/19/g-s1-139156/trump-canada-tariffs"],
          ["Trump's 50% tariffs on Canada take effect as Carney vows to retaliate — ABC News", "https://abcnews.com/Business/trumps-proposed-tariffs-canada-hurtle-deadline-amid-trade/story?id=135833861"],
          ["Carney says his nation is 'at war' with U.S. — NPR, 22 Aug", "https://www.npr.org/2026/08/22/nx-s1-5941584/us-canada-tariffs"]
        ]
      },
      {
        ago: "6 months ago",
        date: "Friday, 20 February",
        headline: "The Supreme Court holds 6–3 that the president cannot impose tariffs under emergency powers",
        tags: [{ t: "Supreme Court · traced", k: "t-scotus" }, { t: "Trade", k: "t-trade" }],
        arch: "struckRebuilt",
        rx: {
          left: "Celebrated in February as the most significant judicial check on presidential power in decades — the taxing power returned to Congress.",
          right: "Called judicial overreach into the president's foreign affairs authority, and a gift to countries that had been extracting concessions for years."
        },
        noise: 3, then: 2,
        verdict: "Won on paper, rebuilt in practice",
        outcome: [
          "Included here because it is what the Supreme Court watch is for: a decision that settles a furor from a year earlier, arriving long after everyone stopped waiting for it.",
          "The Court held that the International Emergency Economic Powers Act does not authorise tariffs, because the tariff power is a branch of the taxing power reserved to Congress. Every IEEPA tariff terminated at midnight on 24 February. On its own terms this was a real and permanent constitutional ruling.",
          "And then: by August the tariff programme is substantially rebuilt on other statutes. Commerce is expanding Section 232 duties on steel, aluminium and copper, and the 50% Canadian tariffs that took effect this weekend rest on separate proclamations, untouched by the ruling. The Court also never reached the refund question, so who gets money back is still open.",
          "The honest summary is that the constitutional principle held and the tariffs came back through a different door. Neither February headline — the celebration or the catastrophe — survives contact with August."
        ],
        sources: [
          ["Supreme Court strikes down IEEPA tariffs — Holland & Knight", "https://www.hklaw.com/en/insights/publications/2026/02/supreme-court-strikes-down-ieepa-tariffs"],
          ["US terminates IEEPA-based tariffs following the decision — White & Case", "https://www.whitecase.com/insight-alert/united-states-terminates-ieepa-based-tariffs-following-supreme-court-decision"],
          ["Potential refunds: Supreme Court overturns IEEPA tariffs — Norton Rose Fulbright", "https://www.nortonrosefulbright.com/en/knowledge/publications/20f2de87/potential-refunds-us-supreme-court-overturns-ieepa-tariffs"]
        ]
      },
      {
        ago: "15 days ago",
        date: "Sunday, 9 August",
        headline: "Netanyahu rejects Trump's 15-point Gaza plan, refusing withdrawal until Hamas disarms first",
        tags: [],
        arch: "talksStall",
        rx: {
          left: "Reported as the collapse of the peace push and as evidence that Netanyahu is unconstrained by Washington.",
          right: "Reported as Israel refusing to trade a withdrawal for promises from a terror group — and, more quietly, as Trump being strung along by an ally."
        },
        noise: 3, then: 2,
        verdict: "Still unsettled",
        outcome: [
          "It was not a collapse. On 18 August Jared Kushner met Netanyahu and came away publicly optimistic; the two agreed that disarmament should begin with a Hamas weapons handover supervised by an American general.",
          "Nor was it a breakthrough. The day after Kushner left, Israeli strikes killed at least ten people, and Netanyahu has said progress is \"problematic\" ahead of Israeli elections — he is squeezed between Washington and his own coalition. Qatar and Egypt now publicly blame Israel for the stall.",
          "Two weeks of certainty in both directions, and the accurate answer is that it is unresolved and moving slowly."
        ],
        sources: [
          ["Israel rejects Trump's 15-point plan for Gaza — NBC News", "https://www.nbcnews.com/world/israel/israel-rejects-trumps-15-point-plan-gaza-pm-benjamin-netanyahu-says-rcna591555"],
          ["Kushner optimistic after meeting Netanyahu — NPR, 18 Aug", "https://www.npr.org/2026/08/18/nx-s1-5935512/kushner-optimistic-about-gaza-ceasefire-plan-after-meeting-with-netanyahu"],
          ["Deadly Gaza strikes cast doubt on ceasefire progress — Washington Post, 19 Aug", "https://www.washingtonpost.com/world/2026/08/19/gaza-israel-war-kushner-talks-trump-netanyahu/eea06114-9bd0-11f1-9cc4-2dc9b46e2d5c_story.html"]
        ]
      },
      {
        ago: "~2 weeks ago",
        date: "Early August",
        headline: "Carlson hosts Massie, Greene and other MAGA dissidents at his Maine lodge amid 2028 talk",
        tags: [],
        arch: "coalition",
        rx: {
          left: "Covered lightly, mostly as schadenfreude about a coalition cracking.",
          right: "Large inside the coalition and genuinely contested. Greene posted from the meeting that the movement had backed Trump because he promised no more foreign wars, and that \"he's betrayed us all.\""
        },
        noise: 2, then: 2,
        verdict: "This one grew",
        outcome: [
          "The rare item on this page that got bigger. On 21–22 August Trump responded with a lengthy Truth Social post branding Carlson, Greene and Massie \"LOSERS ALL\" and predicting Carlson's audience would keep shrinking. Greene answered that she wished she had never supported him. Carlson has said he intends to help build a third party rather than keep backing the GOP.",
          "Worth keeping because it corrects this app's own bias. Two weeks is usually long enough for a story to evaporate, but not always — intra-coalition fights over a succession compound rather than fade, because the participants have a reason to keep the fight alive that outrage cycles lack.",
          "A reader who waited two weeks understood this story better than someone who read it on day one, which is the actual claim this app makes. Waiting is not the same as ignoring."
        ],
        sources: [
          ["Trump erupts on Tucker Carlson and two 'Republican traitors' — WND, 21 Aug", "https://www.wnd.com/2026/08/three-losers-pocketful-change-trump-erupts-tucker-carlson/"],
          ["\"I wish I had never supported him\": MTG fires back — Salon, 22 Aug", "https://www.salon.com/2026/08/22/i-wish-i-had-never-supported-him-mtg-fires-back-after-trumps-attack-on-maga-losers/"],
          ["Trump obliterated Tucker, MTG and Massie last night — Townhall, 22 Aug", "https://townhall.com/news/mattvespa/2026/08/22/trump-obliterated-tucker-mtg-and-thomas-massie-last-night-heres-the-post-n2681714"]
        ]
      },
      {
        ago: "14 days ago",
        date: "Week of 10 August",
        headline: "More than 50 spouses and parents of active-duty U.S. troops have been detained in the immigration crackdown",
        tags: [],
        arch: "attentionNoPolicy",
        rx: {
          left: "An AP investigation that hit hard and was difficult to spin. More than 60 Democratic lawmakers signed an open letter to the defence and homeland security secretaries; several individual cases went viral.",
          right: null
        },
        noise: 2, then: 1,
        verdict: "Policy intact",
        outcome: [
          "Individual outcomes improved. A judge ordered the release of a detained husband whose wife had halted a deployment; at least one other military spouse was released and returned home. Attention demonstrably helped specific families.",
          "The policy did not move. The rule that produced the detentions — that military service alone does not exempt someone from immigration consequences, reversing decades of practice under both parties — remains in force. At least six family members have already been deported and others remain in custody. The letter from Congress produced no change.",
          "This is the most common shape of an outrage story: real, verified, genuinely bad, and structurally untouched two weeks later. The anger rescued a few people and left the machine running."
        ],
        sources: [
          ["AP Exclusive: more than 50 military spouses and parents detained — El Paso Matters", "https://elpasomatters.org/2026/08/05/trump-ice-detains-50-military-spouses-parents-rolls-back-immigration-protections/"],
          ["Dozens of military family members detained by ICE — MS NOW", "https://www.ms.now/news/ice-detains-military-spouses-parents"]
        ]
      },
      {
        ago: "13 days ago",
        date: "Tuesday, 11 August",
        headline: "Former Air Force Secretary Frank Kendall vows to sue after the Pentagon strips his security clearance",
        tags: [],
        arch: "vowsToSue",
        rx: {
          left: "A day of \"he's fighting back\" coverage, cited as proof of retaliation against critics of the administration.",
          right: "Framed as overdue accountability for a Biden-era official accused of disclosing sensitive details about the aircraft now serving as Air Force One."
        },
        noise: 2, then: 1,
        verdict: "Folded into a slower case",
        outcome: [
          "He did sue, after a fashion. By 17 August he had joined an existing multi-plaintiff suit brought on behalf of people whose clearances were revoked without due process since January 2025, represented by attorney Mark Zaid.",
          "That is a quieter thing than the headline implied. It is not his case, there is no ruling, and his clearance is still revoked. Realistically this resolves in a year or more, in a filing nobody covers.",
          "\"Vows to sue\" is among the most reliable two-week fizzles in news. It is a statement of intent reported as an event."
        ],
        sources: [
          ["Pentagon strips security clearance from ex-Air Force Secretary — Washington Post", "https://www.washingtonpost.com/national-security/2026/08/08/pentagon-strips-security-clearance-ex-air-force-secretary-frank-kendall/"],
          ["Former Air Force secretary to join lawsuit to regain clearance — Military Times, 17 Aug", "https://www.militarytimes.com/news/pentagon-congress/2026/08/17/former-air-force-secretary-to-join-others-in-lawsuit-against-white-house-to-regain-security-clearance/"]
        ]
      },
      {
        ago: "16 days ago",
        date: "Saturday, 8 August",
        headline: "Senate confirms Todd Blanche as Attorney General, 50–49",
        tags: [],
        arch: "permanent",
        rx: {
          left: "One cycle of alarm about the president's former personal defence lawyer taking over the Justice Department, then the week moved on.",
          right: "A brief victory lap over a confirmation fight won by a single vote after weeks of uncertainty, then the week moved on."
        },
        noise: 2, then: 3,
        verdict: "Permanent",
        outcome: [
          "He is the Attorney General. He was still the Attorney General fourteen days later, and there is no appeal, no stay and no second vote. Only Collins and Murkowski broke ranks; the margin was one.",
          "Nothing else on this page will shape more of the next three years, and it generated less heat than a ballroom. Every legal fight above runs through the department he now leads — the vaccine exemption suits, the clearance revocations, the immigration policy, and the decision on whether to act on that Fauci contempt referral.",
          "This is the inverse case, and it is why both bars are shown. Stories that draw the most fury are frequently the ones already headed for a stay, a court, or a shelf. The ones that stick tend to be procedural, boring, and scheduled for a Saturday."
        ],
        sources: [
          ["Senate confirms Todd Blanche as attorney general — NBC News", "https://www.nbcnews.com/politics/justice-department/senate-confirms-todd-blanche-attorney-general-weeks-uncertainty-rcna591457"],
          ["Senate votes to confirm Todd Blanche — NPR, 8 Aug", "https://www.npr.org/2026/08/08/g-s1-137631/senate-confirms-todd-blanche-attorney-general"]
        ]
      }
    ]
  },

  {
    id: "2026-07-27",
    label: "27 July 2026",
    sub: "Four weeks on",
    stories: [
      {
        ago: "27 days ago",
        date: "Tuesday, 28 July",
        headline: "The FCC adds every foreign-produced advanced robotic device to the Covered List, barring new imports",
        tags: [{ t: "Flagged · permanent watch", k: "t-flag" }, { t: "Trade · anchor", k: "t-trade" }],
        flagged: true,
        arch: "anchorSoften",
        rx: { left: null, right: null },
        noise: 1, then: 3,
        verdict: "In force — and already softening on schedule",
        outcome: [
          "The largest item in either edition, and it generated almost no public argument in either direction. Effective 28 July, any mobile ground robot over about 4.4 pounds that navigates on its own and carries sensors and connectivity — humanoids, quadrupeds, warehouse AMRs, and by the plain text of the rule robot vacuums and autonomous lawnmowers — cannot obtain the FCC equipment authorisation required to be imported, marketed or sold in the United States if it is foreign-produced.",
          "Devices authorised before 28 July keep working and keep receiving security and compatibility updates through at least 1 January 2029. New models need a Conditional Approval, reviewed for robotics by the Department of War alone, with an application deadline of 1 January 2028.",
          "The pattern almost nobody reported is that this is the third origin-based category ban in eight months — foreign drones in December 2025, foreign consumer routers in March 2026, foreign robotics in July 2026. Any one is a trade story. Three in eight months is an industrial policy executed through an equipment-authorisation database rather than a bill, with no floor vote and no news cycle."
        ],
        precedent: {
          intro: "The same play has now run twice to completion. Both times the announcement was absolute and neither stayed absolute.",
          runs: [
            {
              name: "Foreign drones",
              steps: [
                ["22 Dec 2025", "All foreign-made UAS and critical components added. No carve-outs."],
                ["7 Jan 2026", "Sixteen days later, exemptions for Blue UAS Cleared List drones and \"domestic end products\" under the Buy American standard — but time-limited to 1 Jan 2027."],
                ["Mar 2026", "First named Conditional Approvals granted."],
                ["21 Jul 2026", "Conditional Approvals stop expiring automatically; they become indefinite so long as the manufacturer keeps to its onshoring commitments."],
                ["Jul 2026", "Carve-outs extended a year to 1 Jan 2028; domestic-assembly threshold set at 65% U.S. component value; 17 platforms approved and still adding."]
              ]
            },
            {
              name: "Consumer routers",
              steps: [
                ["23 Mar 2026", "All foreign-produced consumer-grade routers added, three days after the interagency determination."],
                ["~Apr 2026", "Netgear, Adtran, Amazon and eero receive Conditional Approvals — the incumbents, first."],
                ["Apr 2026", "OET waiver permits covered routers to keep receiving security and firmware updates to at least 1 Mar 2027."],
                ["May 2026", "Further exemptions announced for routers and UAS together."]
              ]
            }
          ],
          lesson: "In both runs the ban's practical function was not a wall. It was a forced onshoring negotiation with incumbent manufacturers, announced at maximum scope so the carve-outs could be granted as concessions. The absolute version never survived first contact with the companies that actually supply the market."
        },
        prediction: {
          claim: "Expect named Conditional Approvals for major robotics incumbents by late October 2026, a category carve-out analogous to Blue UAS or a domestic-content threshold within roughly six months, and the 1 January 2028 application deadline to be extended rather than enforced.",
          basis: "Drones took about three months to first named approvals, routers about one. The robotics update waiver was granted simultaneously with the ban rather than months later, which suggests the agency now pre-loads the softening into the announcement.",
          against: "One signal cuts the other way, and it is the reason to keep watching rather than assume: robotics Conditional Approvals are reviewed by the Department of War alone, where routers could go through either the Department of War or Homeland Security. That is a narrower gate than the router precedent, so approvals may come slower even if they come.",
          check: "FCC Covered List page and OET Conditional Approval announcements",
          by: "Late October 2026"
        },
        sources: [
          ["FCC FAQs on Covered List updates: robotics and power inverters — FCC.gov", "https://www.fcc.gov/covered-list-faqs-robots-inverters"],
          ["FCC Covered List bans new foreign mobile robots in US — IEEE Spectrum", "https://spectrum.ieee.org/fcc-covered-list-mobile-robots"],
          ["FCC adds robotics and inverters, opens Conditional Approval process — Morgan Lewis", "https://www.morganlewis.com/pubs/2026/08/fcc-adds-foreign-produced-advanced-robotic-devices-and-power-inverters-to-covered-list-opens-conditional-approval-process"],
          ["Not all drones after all: FCC exempts certain foreign-made drones — Wilson Sonsini", "https://www.wsgr.com/en/insights/not-all-drones-after-all-fcc-exempts-certain-foreign-made-drones-and-critical-components-from-covered-list-and-issues-guidance-for-dow-and-dhs-conditional-approvals.html"],
          ["FCC keeps adding exemptions to its foreign drone crackdown — DroneDJ, 27 Jul", "https://dronedj.com/2026/07/27/fcc-drone-ban-exemption-update/"],
          ["FCC conditional drone approvals shift to long-term framework — DRONELIFE, 27 Jul", "https://dronelife.com/2026/07/27/fcc-conditional-drone-approvals-onshoring-framework/"],
          ["Re-routing the market: FCC adds foreign consumer routers — Wilson Sonsini", "https://www.wsgr.com/en/insights/re-routing-the-market-fcc-adds-foreign-produced-consumer-routers-to-its-covered-list.html"],
          ["FCC announces Covered List exemptions for certain routers and UAS — DLA Piper", "https://www.dlapiper.com/en-us/insights/publications/2026/05/fcc-announces-covered-list-exemptions-for-certain-routers-and-uas"]
        ]
      },
      {
        ago: "27 days ago",
        date: "Monday, 27 July",
        headline: "Trump asks the Supreme Court to let him restrict mail-in voting before the midterms",
        tags: [{ t: "Supreme Court", k: "t-scotus" }],
        arch: "emergencyToClock",
        rx: {
          left: "Treated as an emergency about the election itself — an executive order that would have DHS build state-by-state citizenship lists and the Postal Service use them to decide who may vote by mail.",
          right: "Framed as a routine integrity measure blocked by a friendly circuit, and as the Court's chance to stop lower courts from rewriting election administration."
        },
        noise: 2, then: 1,
        verdict: "Still pending, and possibly moot",
        outcome: [
          "Four weeks on, no ruling has been announced. Justice Jackson ordered the plaintiff states to respond in early August and the administration has since pressed the Court to \"act promptly.\" An emergency application, in practice, went onto an ordinary clock.",
          "The detail that decides this may have nothing to do with the Court. The Postal Service said in its own July filings that it is running out of time to implement the changes before this election regardless of how the case comes out. With fewer than 100 days to the midterms, the operational deadline is arriving faster than the legal one.",
          "Worth noticing how differently that reads at four weeks. On day one this was an emergency about whether the midterms would be free. A month later the binding constraint looks administrative, and the ruling — whenever it lands — may not change what actually happens in November."
        ],
        sources: [
          ["Trump asks Supreme Court to let him curtail mail voting — CNN, 27 Jul", "https://www.cnn.com/2026/07/27/politics/trump-supreme-court-mail-voting-executive-order"],
          ["Administration asks justices to allow full implementation — SCOTUSblog", "https://www.scotusblog.com/2026/07/trump-administration-asks-supreme-court-to-clear-the-way-for-new-mail-in-voting-restrictions/"],
          ["Time is growing short for mail ballot restrictions — Votebeat, 3 Aug", "https://www.votebeat.org/national/2026/08/03/trump-supreme-court-mail-ballot-restrictions-executive-order-usps/"]
        ]
      },
      {
        ago: "28 days ago",
        date: "Monday, 27 July",
        headline: "U.S. pauses bombing Iran after officials warn Trump about dwindling munitions stockpiles",
        tags: [],
        arch: "talksStall",
        rx: {
          left: "Read as the war hitting its natural limit, and as confirmation that the campaign had been launched without the inventory to sustain it.",
          right: "Read as a deliberate operational pause and a negotiating position, with Trump publicly dismissing the stockpile concerns."
        },
        noise: 3, then: 2,
        verdict: "Deadline passed, nothing settled",
        outcome: [
          "Iran paused its retaliatory strikes on U.S. bases in return. The 60-day memorandum of understanding then ran out on 17 August with no final agreement. Both sides remain deadlocked on the Strait of Hormuz, Iran's nuclear programme, sanctions, and frozen Iranian funds.",
          "Trump said afterwards that the 60 days had never been a hard deadline, and there is no sign the expiry triggered renewed strikes. Reports on whether the ceasefire was formally extended conflict — Al Arabiya reported an extension, a senior Iranian official denied any such talks. Trump has since threatened Oman, the mediator.",
          "The part that was under-covered at the time is the part that has held up best: the constraint driving the pause was Patriot interceptors and air-defence munitions running low, not diplomacy. That is a story about industrial capacity, and it will still be true after this negotiation ends."
        ],
        sources: [
          ["U.S. pauses bombing Iran after warnings about munitions stockpiles — Democracy Now, 27 Jul", "https://www.democracynow.org/2026/7/27/headlines/us_pauses_bombing_iran_after_officials_warn_trump_about_dwindling_munitions_stockpiles"],
          ["Why has the US halted its bombing of Iran? — Al Jazeera", "https://www.aljazeera.com/news/2026/7/27/why-has-the-us-halted-its-bombing-of-iran"],
          ["Deadline to reach US-Iran deal expires, Trump threatens Oman — CNN, 17 Aug", "https://www.cnn.com/2026/08/17/world/live-news/iran-war-trump"],
          ["The 60-day deadline is expiring. Where things stand — Washington Post, 17 Aug", "https://www.washingtonpost.com/business/2026/08/17/iran-us-war-diplomacy-deal-deadline-nuclear/72551b60-9a16-11f1-9cc4-2dc9b46e2d5c_story.html"]
        ]
      },
      {
        ago: "5 weeks ago",
        date: "Monday, 20 July",
        headline: "Three presidential proclamations authorise duties of up to 50% on Canadian goods, effective 19 August",
        tags: [{ t: "Trade · anchor", k: "t-trade" }],
        arch: "anchorTookEffect",
        rx: {
          left: "Covered as another round of economic self-harm, with the assumption — reasonable on the record — that the number would be negotiated down before it ever took effect.",
          right: "Covered as leverage finally applied, with the same assumption from the other direction: that Canada would fold before the deadline."
        },
        noise: 2, then: 2,
        verdict: "Landed on schedule",
        outcome: [
          "Both sides expected a walk-back and neither got one on the day. Trump paused the duties for three days on 19 August citing a near-final deal; talks collapsed on the Friday night; 50% landed at 12:01am Saturday. The U.S. Trade Representative said Canada declined to finalise on agreed terms, Canada said the terms moved, and Carney suspended negotiations.",
          "The detail lost between 20 July and 22 August is the instrument. These were three proclamations under Section 338 of the Tariff Act of 1930 — not the emergency power the Supreme Court voided in February, and not a Section 232 national-security action. Section 338 has essentially never been used in the modern era, and it does not admit USMCA relief.",
          "Choosing it was not incidental. It routes around the February IEEPA ruling and around the USMCA carve-out that ended Canada’s March 2025 round in two days. Whether that hardening actually holds is the live call carried on this story’s card in the August edition."
        ],
        sources: [
          ["Trump 2.0 tariff tracker — Trade Compliance Resource Hub", "https://www.tradecomplianceresourcehub.com/2026/08/19/trump-2-0-tariff-tracker/"],
          ["Trump says U.S. and Canada reached deal to delay 50% tariffs — NPR, 19 Aug", "https://www.npr.org/2026/08/19/g-s1-139156/trump-canada-tariffs"],
          ["Tariffs take effect as Carney vows to retaliate — ABC News", "https://abcnews.com/Business/trumps-proposed-tariffs-canada-hurtle-deadline-amid-trade/story?id=135833861"]
        ]
      }
    ]
  }
];

/* Comparable maximal tariff anchors and where the rate actually ended up.
   Feeds the dumbbell chart on any story flagged anchorBase. */
const ANCHOR_BASE = {
  title: "Where maximal tariff anchors actually settled",
  max: 150,
  rows: [
    { label: "China, Apr 2025", from: 145, to: 30, note: "Cut to 30% within weeks under a 90-day deal." },
    { label: "EU, 2025", from: 50, to: 15, note: "Threatened 50%, settled at 15%. Average effective bilateral rate from April 2025 to February 2026 was 7.8%." },
    { label: "Japan, 2025", from: 35, to: 15, note: "Threatened 30–35%, agreed 15%." },
    { label: "Brazil, Aug 2025", from: 50, to: 10, note: "The closest analogue. Held about six months with orange juice and aircraft carved out, then fell to 10% when the Supreme Court voided its IEEPA component. A new 25% Section 301 duty followed in July 2026." },
    { label: "Section 122 duties", from: 15, to: 10, note: "Took effect below the threatened rate." },
    { label: "India, Aug 2025", from: 25, to: 50, note: "The counter-case. Escalated rather than settling — 25% became 50% three weeks later." }
  ],
  aside: "Not plotted, because it is a change of scope rather than of rate: Canada’s own March 2025 round. The 25% took effect on 4 March 2025 and was suspended for USMCA-compliant goods on 6 March. Two days. The current action is written specifically to deny that relief.",
  lesson: "In every comparable case the announced percentage was a negotiating position rather than a forecast. Five of six came down; the one that did not, Brazil, was hollowed out by exclusions first and then collapsed on a court ruling. The number to watch is never the headline rate. It is the effective rate on the covered basket."
};

/* Every dated call the app has made. Misses stay published.
   Each call carries a probability and a resolution rule fixed at publication,
   so a miss cannot be argued into a hit afterwards. */
const LEDGER = {
  note: "A prediction the app can quietly delete is worth nothing. Every call is listed here with the probability attached to it, the rule that decides it, and the date it comes due. Misses are kept, labelled, and left in place.",
  rules: [
    "No call is published without a number. \u201CLikely\u201D is not a forecast.",
    "The resolution rule is fixed when the call is made and is never rewritten afterwards.",
    "A call is never edited after publication. A change of mind is a new call, dated.",
    "Scoring is reported by confidence band, never as a win rate. Getting 90% of calls right while claiming 60% confidence is not skill, it is timidity."
  ],
  bands: [[50, 59], [60, 69], [70, 79], [80, 89], [90, 100]],
  open: [
    {
      subject: "FCC robotics Covered List",
      claim: "Named Conditional Approvals for major robotics incumbents will be published, following the drone and router precedents.",
      confidence: 70,
      hit: "At least one Conditional Approval naming a foreign-produced advanced robotic device or its manufacturer is published on or before the due date.",
      miss: "No such approval has appeared by the due date.",
      source: "FCC Covered List page and OET Conditional Approval announcements",
      made: "24 August 2026",
      by: "31 October 2026"
    },
    {
      subject: "Canada 50% tariffs",
      claim: "The 50% Section 338 rate will no longer apply across the full original $20 billion basket \u2014 most likely narrowed by product exclusions rather than repealed.",
      confidence: 75,
      hit: "By the due date any one of: the rate is cut or suspended; the covered-goods list is narrowed by exclusion; or a settlement removes it for part of the basket.",
      miss: "The same 50% still applies to the same basket, unchanged, on the due date.",
      caveat: "Counting scope erosion as a hit makes this rule broad, and that is deliberate \u2014 erosion is the predicted mechanism. It is written down now precisely so it cannot be claimed after the fact.",
      source: "Federal Register exclusion notices and the covered-goods annex",
      made: "24 August 2026",
      by: "30 November 2026"
    },
    {
      subject: "Fauci contempt referral",
      claim: "The Justice Department will not have filed contempt charges on the Senate referral.",
      confidence: 80,
      hit: "No criminal contempt charge has been filed by the due date.",
      miss: "A charge is filed on or before the due date.",
      caveat: "The historical base rate for congressional contempt referrals would justify a higher number. It is held at 80% because this department has already charged a former FBI director, so the usual inertia is a weaker guide than normal.",
      source: "Federal court dockets and Justice Department announcements",
      made: "24 August 2026",
      by: "8 November 2026"
    },
    {
      subject: "Mail-in voting application",
      claim: "The order\u2019s DHS-list and Postal Service mechanism will not be operative for the midterms, whether or not the Court rules for the administration.",
      confidence: 85,
      hit: "On election day the DHS citizenship list plus Postal Service screening is not being used to decide mail-ballot eligibility in any state.",
      miss: "It is in use in one or more states.",
      source: "State election administration reporting and Postal Service filings",
      made: "24 August 2026",
      by: "3 November 2026"
    }
  ],
  scored: []
};
