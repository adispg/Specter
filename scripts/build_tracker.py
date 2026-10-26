"""Build SPECTER-TRACKER.xlsx: the project tracker as a workbook.

Two sheets. "Tracker" is the item list with status, owner and notes.
"Summary" counts by status and priority with live formulas, so the counts
update if the user edits a status cell.
"""

from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation

FONT = "Arial"

# id, item, area, priority, status, owner, notes
ROWS = [
    (1, "Harvey voice bible and first app page", "Product", "P3", "Done", "Claude", "Original prototype."),
    (2, "Preview, publish and test a live consultation", "Product", "P3", "Done", "Claude", ""),
    (3, "Save source, voice bible and roadmap to the project folder", "Product", "P3", "Done", "Claude", ""),
    (4, "Rebuild as premium mobile app, three personas, voice", "Product", "P3", "Done", "Claude", ""),
    (5, "Check render, republish, update folder", "Product", "P3", "Done", "Claude", ""),
    (6, "PRD, persona specs, intents, eval set, rubric", "Product", "P3", "Done", "Claude", "docs/PRD.md and docs/harness/."),
    (7, "Design system, screen specs, mockups", "Design", "P3", "Done", "Claude", "docs/design/."),
    (8, "Engineering: Next.js, Supabase, model, voice", "Eng", "P1", "In progress", "Claude", "Core flow works end to end. Open items tracked separately below."),
    (9, "QA: test pass, harness run, bug reports", "QA", "P1", "In progress", "Claude", "Unit 75 pass. Harness 181 pass. No e2e specs yet."),
    (10, "Push to GitHub and set up hosting", "Eng", "P2", "Done", "Claude", "github.com/adispg/Specter, Vercel auto-deploy from main."),
    (11, "Design revision: type, logo, avatars, naming", "Design", "P3", "Done", "Claude", ""),
    (12, "PM design review gate, every screen and journey", "Product", "P1", "In progress", "Claude", "Live click-through review running 26 Oct."),
    (13, "PM product review of running app", "Product", "P2", "Done", "Claude", ""),
    (14, "Build all six page components", "Eng", "P2", "Done", "Claude", ""),
    (15, "Swap model to Gemini and STT to Deepgram", "Eng", "P2", "Done", "Claude", "Gemini live. Deepgram optional, see item 28."),
    (16, "Mic button hidden when onMic not passed", "Eng", "P2", "Done", "Claude", "Also wired the mic into the home composer, which was missing."),
    (17, "Suppress tab bar on the case screen", "Design", "P3", "Open", "", "Cosmetic. The overlap bug it masked is fixed in item 46 area."),
    (18, "Guest mode unavailable error", "Eng", "P0", "Done", "Claude", "Needed Supabase anonymous sign-ins plus the shadowed home page fix."),
    (19, "Verify home redesign and starters on live build", "QA", "P1", "Done", "Claude", "Confirmed in browser."),
    (20, "Verify Android male voice fix", "QA", "P1", "Open", "Aditya", "Needs the founder's own handset. Desktop masked the original bug. Voice picker in item 26 gives manual control."),
    (21, "Reply length and meta question handling", "Product", "P0", "Done", "Claude", "Added meta and clarify modes. Verified live: what can you do now returns one screen."),
    (22, "Act on the spec versus built audit", "Product", "P1", "Open", "", "Found first-run journey, talk button and recent cases specified but never built."),
    (23, "Redesign the welcome and landing screen", "Design", "P2", "Open", "", "Home screen done. Welcome not yet touched."),
    (24, "Tune voice pace and delivery", "Design", "P2", "Open", "Aditya", "Two numbers per persona in lib/personas/config.ts. Needs the founder's ear."),
    (25, "Reduce consult latency from about 19 seconds", "Eng", "P1", "Open", "", "About 14s is model time. See item 45, the likely root cause."),
    (26, "Device voice picker in settings", "Eng", "P1", "Done", "Claude", "Per persona, lists real device voices, Hear button on each. Overrides the heuristic."),
    (27, "Set guest quota environment variables", "Ops", "P1", "Done", "Aditya", "All three set and live."),
    (28, "Voice input transcription fallback", "Ops", "P3", "Open", "Aditya", "Optional. Browser speech recognition already covers Chrome and Safari without a key."),
    (29, "Google OAuth sign-in", "Ops", "P2", "Open", "Aditya", "Guests work, so not blocking."),
    (30, "Reposition toward a shareable office moment", "Product", "P1", "Open", "", "Research complete. See HANDOVER.md section 9."),
    (31, "Share card, line plus principle only", "Product", "P1", "Open", "", "Highest value remaining. Strip the situation. Specter branding only, never a character name."),
    (32, "Move humour into the read, keep plays plain", "Product", "P2", "Done", "Claude", "WHERE THE WIT GOES rule in COMMON_RULES."),
    (33, "Rewrite starters toward everyday irritation", "Product", "P2", "Done", "Claude", "Crisis framing replaced with the bad meeting and the one word reply."),
    (34, "Vent and war-story intent, one-liner not advice", "Product", "P1", "Open", "", "Founder's own example. Pairs with the share card."),
    (35, "Code audit: scale, performance, edge cases, security", "Eng", "P1", "Done", "Claude", "Findings became items 36 to 41. RLS clean, no cross-user access path."),
    (36, "Stop charging guest quota for failed consults", "Eng", "P1", "Done", "Claude", "Code shipped. Database half needs item 44."),
    (37, "Make consult persistence atomic", "Eng", "P2", "Open", "", "Three writes, no transaction. A failure leaves an orphaned case."),
    (38, "Service worker caches private pages, never invalidates", "Eng", "P2", "Open", "", "Caches case pages, not cleared on sign out, version hardcoded."),
    (39, "Cap total consult time across the model chain", "Eng", "P2", "Open", "", "Worst case exceeds the 60s function limit and 504s with quota spent."),
    (40, "Set GUEST_HASH_SALT", "Ops", "P2", "Open", "Aditya", "Empty, so it falls back to a value published in the repo."),
    (41, "Retention for audio cache, usage events, guest accounts", "Eng", "P3", "Open", "", "Nothing deletes anonymous users. DPDP and GDPR exposure at scale."),
    (42, "Build the evaluation harness runner", "QA", "P1", "Done", "Claude", "181 checks across 63 scenarios, all passing, runs offline."),
    (43, "Monitoring, structured logging, error tracking", "Eng", "P1", "Open", "", "None exists. A dead model looked like a rate limit for an hour."),
    (44, "Apply the release_guest_quota migration", "Ops", "P1", "Open", "Aditya", "Needs approval. Migration file committed. Refunds are inert until applied."),
    (45, "Migrate to @google/genai to cap thinking budget", "Eng", "P1", "Open", "", "Installed SDK is deprecated and cannot cap Gemini 3.x hidden reasoning. Biggest latency lever."),
    (46, "Audit every button and link for dead wiring", "QA", "P0", "Open", "", "Three dead controls found 26 Oct. Settings sign out posts to a route that does not exist."),
]

HEADERS = ["ID", "Item", "Area", "Priority", "Status", "Owner", "Notes"]
WIDTHS = [6, 52, 11, 10, 13, 10, 82]

STATUS_FILL = {
    "Done": PatternFill("solid", fgColor="D6EAD6"),
    "In progress": PatternFill("solid", fgColor="FFF2CC"),
    "Open": PatternFill("solid", fgColor="FADBD8"),
}
PRIORITY_FONT = {
    "P0": Font(name=FONT, size=10, bold=True, color="9C0006"),
    "P1": Font(name=FONT, size=10, bold=True),
    "P2": Font(name=FONT, size=10),
    "P3": Font(name=FONT, size=10, color="707070"),
}

thin = Side(style="thin", color="D0D0D0")
BORDER = Border(left=thin, right=thin, top=thin, bottom=thin)

wb = Workbook()

# ---------------------------------------------------------------- Tracker
ws = wb.active
ws.title = "Tracker"

ws["A1"] = "Specter: project tracker"
ws["A1"].font = Font(name=FONT, size=14, bold=True)
ws["A2"] = "Updated 26 October 2026. Full documentation in HANDOVER.md beside this file."
ws["A2"].font = Font(name=FONT, size=10, italic=True, color="707070")
ws["A3"] = "P0 blocks a demo. P1 is the next real work. P2 matters before this grows. P3 is cosmetic or optional."
ws["A3"].font = Font(name=FONT, size=10, italic=True, color="707070")

HEADER_ROW = 5
for i, h in enumerate(HEADERS, start=1):
    c = ws.cell(row=HEADER_ROW, column=i, value=h)
    c.font = Font(name=FONT, size=10, bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor="2F4257")
    c.alignment = Alignment(horizontal="left", vertical="center")
    c.border = BORDER
ws.row_dimensions[HEADER_ROW].height = 20

for r, row in enumerate(ROWS, start=HEADER_ROW + 1):
    for i, v in enumerate(row, start=1):
        c = ws.cell(row=r, column=i, value=v)
        c.font = Font(name=FONT, size=10)
        c.alignment = Alignment(vertical="top", wrap_text=(i in (2, 7)))
        c.border = BORDER
    ws.cell(row=r, column=4).font = PRIORITY_FONT[row[3]]
    ws.cell(row=r, column=5).fill = STATUS_FILL[row[4]]
    ws.cell(row=r, column=1).alignment = Alignment(horizontal="center", vertical="top")

for i, w in enumerate(WIDTHS, start=1):
    ws.column_dimensions[get_column_letter(i)].width = w

first, last = HEADER_ROW + 1, HEADER_ROW + len(ROWS)
ws.auto_filter.ref = f"A{HEADER_ROW}:G{last}"
ws.freeze_panes = f"A{HEADER_ROW + 1}"

dv_status = DataValidation(type="list", formula1='"Open,In progress,Done"', allow_blank=True)
ws.add_data_validation(dv_status)
dv_status.add(f"E{first}:E{last}")

dv_pri = DataValidation(type="list", formula1='"P0,P1,P2,P3"', allow_blank=True)
ws.add_data_validation(dv_pri)
dv_pri.add(f"D{first}:D{last}")

# ---------------------------------------------------------------- Summary
s = wb.create_sheet("Summary")
s["A1"] = "Summary"
s["A1"].font = Font(name=FONT, size=14, bold=True)
s["A2"] = "Counts are formulas over the Tracker sheet, so they follow any status you change there."
s["A2"].font = Font(name=FONT, size=10, italic=True, color="707070")

rng_status = f"Tracker!$E${first}:$E${last}"
rng_pri = f"Tracker!$D${first}:$D${last}"

s["A4"] = "By status"
s["A4"].font = Font(name=FONT, size=11, bold=True)
for i, label in enumerate(["Done", "In progress", "Open"], start=5):
    s.cell(row=i, column=1, value=label).font = Font(name=FONT, size=10)
    s.cell(row=i, column=2, value=f'=COUNTIF({rng_status},A{i})').font = Font(name=FONT, size=10)
s["A8"] = "Total"
s["A8"].font = Font(name=FONT, size=10, bold=True)
s["B8"] = f"=COUNTA(Tracker!$A${first}:$A${last})"
s["B8"].font = Font(name=FONT, size=10, bold=True)
s["A9"] = "Percent complete"
s["A9"].font = Font(name=FONT, size=10, bold=True)
s["B9"] = "=IF(B8=0,0,B5/B8)"
s["B9"].font = Font(name=FONT, size=10, bold=True)
s["B9"].number_format = "0.0%"

s["A11"] = "Open items by priority"
s["A11"].font = Font(name=FONT, size=11, bold=True)
for i, label in enumerate(["P0", "P1", "P2", "P3"], start=12):
    s.cell(row=i, column=1, value=label).font = Font(name=FONT, size=10)
    s.cell(row=i, column=2, value=f'=COUNTIFS({rng_pri},A{i},{rng_status},"Open")').font = Font(name=FONT, size=10)

s["A17"] = "By area"
s["A17"].font = Font(name=FONT, size=11, bold=True)
rng_area = f"Tracker!$C${first}:$C${last}"
for i, label in enumerate(["Eng", "Product", "QA", "Design", "Ops"], start=18):
    s.cell(row=i, column=1, value=label).font = Font(name=FONT, size=10)
    s.cell(row=i, column=2, value=f'=COUNTIF({rng_area},A{i})').font = Font(name=FONT, size=10)
    s.cell(row=i, column=3, value=f'=COUNTIFS({rng_area},A{i},{rng_status},"Open")').font = Font(name=FONT, size=10)
s["B17"] = "Total"
s["B17"].font = Font(name=FONT, size=10, bold=True)
s["C17"] = "Open"
s["C17"].font = Font(name=FONT, size=10, bold=True)

s["A24"] = "Next four, in order"
s["A24"].font = Font(name=FONT, size=11, bold=True)
for i, t in enumerate([
    "31. Share card. The one change that makes this travel between desks.",
    "34. Vent intent plus a light path for low stakes input.",
    "45. SDK migration to cut the 19 second wait.",
    "46. Sweep every control for dead wiring.",
], start=25):
    s.cell(row=i, column=1, value=t).font = Font(name=FONT, size=10)

s.column_dimensions["A"].width = 62
s.column_dimensions["B"].width = 12
s.column_dimensions["C"].width = 12

wb.save("SPECTER-TRACKER.xlsx")
print(f"written: {len(ROWS)} rows")
