"""
Builds the school's working documents (Word + Excel) into assets/documents/.
Branding follows the official letterhead: navy #16304F, gold #B08D34,
Georgia Bold headings, Calibri body.

Run:  python3 tools/build_documents.py
"""
import os, datetime as dt
from docx import Document
from docx.shared import Pt, Cm, RGBColor, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.section import WD_ORIENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, NamedStyle
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.formatting.rule import CellIsRule, FormulaRule

from school_data import CLASSES, STAFF, build_pupils, staff_by_id

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "documents")
LOGO = os.path.join(ROOT, "assets", "logo-small.png")
os.makedirs(OUT, exist_ok=True)

NAVY = RGBColor(0x16, 0x30, 0x4F); GOLD = RGBColor(0xB0, 0x8D, 0x34); INK = RGBColor(0x1F, 0x29, 0x37); MUTED = RGBColor(0x6B, 0x72, 0x80)
NAVY_HEX, GOLD_HEX, INK_HEX = "16304F", "B08D34", "1F2937"
SCHOOL = "Ayanda Infant School"; TAGLINE = "WHERE EXCELLENCE BEGINS"
ADDRESS = "1 Chazzis Way, Manningdale, Bulawayo, Zimbabwe"
CONTACT = "Tel: +263 775111171  •  Email: info@ayandainfantschool.com  •  Web: www.ayandainfantschool.com"
PUPILS = build_pupils()

# =============================================================================
# Word helpers
# =============================================================================
def shade(cell, hex_fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd"); shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), hex_fill)
    tcPr.append(shd)

def cell_borders(cell, color="D1D5DB", sz="4", sides=("top", "left", "bottom", "right")):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for s in sides:
        el = OxmlElement(f"w:{s}"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), sz); el.set(qn("w:color"), color); borders.append(el)
    tcPr.append(borders)

def para_border(paragraph, side="bottom", color=NAVY_HEX, sz="12", space="4"):
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = pPr.find(qn("w:pBdr"))
    if pBdr is None:
        pBdr = OxmlElement("w:pBdr"); pPr.append(pBdr)
    el = OxmlElement(f"w:{side}"); el.set(qn("w:val"), "single"); el.set(qn("w:sz"), sz); el.set(qn("w:space"), space); el.set(qn("w:color"), color)
    pBdr.append(el)

def set_cell_margins(table, top=60, bottom=60, left=100, right=100):
    tblPr = table._tbl.tblPr
    mar = OxmlElement("w:tblCellMar")
    for k, v in (("top", top), ("left", left), ("bottom", bottom), ("right", right)):
        el = OxmlElement(f"w:{k}"); el.set(qn("w:w"), str(v)); el.set(qn("w:type"), "dxa"); mar.append(el)
    tblPr.append(mar)

def run(p, text, bold=False, size=None, color=None, font=None, italic=False, caps=False):
    r = p.add_run(text); r.bold = bold; r.italic = italic
    if size: r.font.size = Pt(size)
    if color is not None: r.font.color.rgb = color
    if font:
        r.font.name = font; r._element.rPr.rFonts.set(qn("w:eastAsia"), font)
    if caps: r.font.all_caps = True
    return r

def heading(doc, text, level=1, space_before=14):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(space_before); p.paragraph_format.space_after = Pt(4); p.paragraph_format.keep_with_next = True
    size = {1: 15, 2: 12.5, 3: 11}[level]
    run(p, text, bold=True, size=size, color=NAVY, font="Georgia")
    if level == 1: para_border(p, "bottom", GOLD_HEX, "6", "2")
    return p

def eyebrow(doc, text):
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(10); p.paragraph_format.space_after = Pt(2)
    r = run(p, text.upper(), bold=True, size=8.5, color=GOLD); r.font.name = "Calibri"
    return p

def body(doc, text, size=10.5, italic=False, color=None, after=6, align=None):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(after)
    run(p, text, size=size, italic=italic, color=color)
    if align: p.alignment = align
    return p

def bullet(doc, text, size=10.5):
    p = doc.add_paragraph(style="List Bullet"); p.paragraph_format.space_after = Pt(2)
    run(p, text, size=size); return p

def table(doc, rows, widths_cm, header=True, font_size=9.5, header_fill=NAVY_HEX, zebra=True, align_center_cols=()):
    t = doc.add_table(rows=len(rows), cols=len(rows[0])); t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.autofit = False
    set_cell_margins(t)
    for i, row in enumerate(rows):
        for j, val in enumerate(row):
            c = t.cell(i, j); c.width = Cm(widths_cm[j]); c.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            p = c.paragraphs[0]; p.paragraph_format.space_after = Pt(0)
            if header and i == 0:
                run(p, str(val), bold=True, size=font_size - 0.5, color=RGBColor(0xFF, 0xFF, 0xFF)); shade(c, header_fill)
            else:
                run(p, str(val), size=font_size, color=INK)
                if zebra and i % 2 == 0: shade(c, "F3F6F9")
            if j in align_center_cols and not (header and i == 0): p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            cell_borders(c)
    return t

def form_table(doc, rows, widths_cm=(5.0, 11.5), font_size=10):
    """Label/value pairs with a ruled value cell for handwriting."""
    t = doc.add_table(rows=len(rows), cols=2); t.alignment = WD_TABLE_ALIGNMENT.CENTER; t.autofit = False
    set_cell_margins(t, 70, 70, 100, 100)
    for i, (label, value) in enumerate(rows):
        a, b = t.cell(i, 0), t.cell(i, 1); a.width = Cm(widths_cm[0]); b.width = Cm(widths_cm[1])
        pa = a.paragraphs[0]; pa.paragraph_format.space_after = Pt(0); run(pa, label, bold=True, size=font_size - 0.5, color=NAVY); shade(a, "F3F6F9")
        pb = b.paragraphs[0]; pb.paragraph_format.space_after = Pt(0); run(pb, value, size=font_size, color=INK)
        cell_borders(a); cell_borders(b)
        a.vertical_alignment = b.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    return t

def checkbox_line(doc, items, size=10.5):
    p = doc.add_paragraph(); p.paragraph_format.space_after = Pt(3)
    for i, it in enumerate(items):
        run(p, "☐ ", size=size + 1, color=NAVY); run(p, it + ("     " if i < len(items) - 1 else ""), size=size)
    return p

def signature_block(doc, cols):
    t = doc.add_table(rows=2, cols=len(cols)); t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for j, label in enumerate(cols):
        top = t.cell(0, j); top.paragraphs[0].paragraph_format.space_before = Pt(26); para_border(top.paragraphs[0], "bottom", INK_HEX, "6", "1")
        bot = t.cell(1, j); pb = bot.paragraphs[0]; pb.paragraph_format.space_after = Pt(0); run(pb, label, size=9, color=MUTED)
    return t

def new_doc(title, subtitle=None, landscape=False):
    doc = Document()
    st = doc.styles["Normal"]; st.font.name = "Calibri"; st.font.size = Pt(10.5); st.font.color.rgb = INK
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    for s in ("List Bullet", "List Number"):
        doc.styles[s].font.name = "Calibri"; doc.styles[s].font.size = Pt(10.5)
    sec = doc.sections[0]
    if landscape:
        sec.orientation = WD_ORIENT.LANDSCAPE; sec.page_width, sec.page_height = Cm(29.7), Cm(21.0)
    else:
        sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.0); sec.top_margin = Cm(1.6); sec.bottom_margin = Cm(1.8)
    sec.header_distance = Cm(0.8); sec.footer_distance = Cm(0.8)
    # --- header: crest left, school block right, navy + gold rule ---
    hdr = sec.header; hdr.is_linked_to_previous = False
    ht = hdr.add_table(rows=1, cols=2, width=sec.page_width - sec.left_margin - sec.right_margin); ht.autofit = False
    c0, c1 = ht.cell(0, 0), ht.cell(0, 1); c0.width = Cm(3.2); c1.width = (sec.page_width - sec.left_margin - sec.right_margin) - Cm(3.2)
    p0 = c0.paragraphs[0]; p0.add_run().add_picture(LOGO, width=Cm(2.6)); p0.paragraph_format.space_after = Pt(0)
    p1 = c1.paragraphs[0]; p1.alignment = WD_ALIGN_PARAGRAPH.RIGHT; p1.paragraph_format.space_after = Pt(0)
    run(p1, SCHOOL.upper(), bold=True, size=15, color=NAVY, font="Georgia")
    p2 = c1.add_paragraph(); p2.alignment = WD_ALIGN_PARAGRAPH.RIGHT; p2.paragraph_format.space_after = Pt(2)
    run(p2, TAGLINE, bold=True, size=7.5, color=GOLD)
    p3 = c1.add_paragraph(); p3.alignment = WD_ALIGN_PARAGRAPH.RIGHT; p3.paragraph_format.space_after = Pt(0)
    run(p3, ADDRESS, size=8.5, color=MUTED)
    c0.vertical_alignment = c1.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    rule = hdr.add_paragraph(); rule.paragraph_format.space_before = Pt(4); rule.paragraph_format.space_after = Pt(0)
    para_border(rule, "bottom", NAVY_HEX, "16", "1")
    rule2 = hdr.add_paragraph(); rule2.paragraph_format.space_before = Pt(0); rule2.paragraph_format.space_after = Pt(0); rule2.paragraph_format.line_spacing = Pt(4)
    para_border(rule2, "bottom", GOLD_HEX, "4", "1")
    # --- footer ---
    ftr = sec.footer; ftr.is_linked_to_previous = False
    fp = ftr.paragraphs[0]; fp.alignment = WD_ALIGN_PARAGRAPH.CENTER; fp.paragraph_format.space_before = Pt(4); fp.paragraph_format.space_after = Pt(0)
    para_border(fp, "top", GOLD_HEX, "6", "6")
    run(fp, CONTACT, size=8, color=MUTED)
    fp2 = ftr.add_paragraph(); fp2.alignment = WD_ALIGN_PARAGRAPH.CENTER; fp2.paragraph_format.space_after = Pt(0)
    run(fp2, TAGLINE, bold=True, size=7, color=GOLD)
    # --- title ---
    tp = doc.add_paragraph(); tp.paragraph_format.space_before = Pt(2); tp.paragraph_format.space_after = Pt(2)
    run(tp, title, bold=True, size=19, color=NAVY, font="Georgia")
    if subtitle:
        sp = doc.add_paragraph(); sp.paragraph_format.space_after = Pt(8); run(sp, subtitle, size=10.5, color=MUTED)
    return doc

def page_break(doc):
    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)

# =============================================================================
# Excel helpers
# =============================================================================
F_NAVY = PatternFill("solid", fgColor=NAVY_HEX); F_GOLD = PatternFill("solid", fgColor=GOLD_HEX)
F_NAVY50 = PatternFill("solid", fgColor="F3F6F9"); F_GOLD100 = PatternFill("solid", fgColor="F5EDD7"); F_INPUT = PatternFill("solid", fgColor="FFF9DB")
THIN = Side(style="thin", color="D1D5DB"); BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WHITE = "FFFFFF"

def wb_new(sheet_title):
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = sheet_title
    return wb, ws

def brand_title(ws, title, subtitle, ncols, row=1):
    ws.merge_cells(start_row=row, start_column=1, end_row=row, end_column=ncols)
    c = ws.cell(row=row, column=1, value=SCHOOL.upper()); c.font = Font(name="Georgia", size=16, bold=True, color=NAVY_HEX)
    ws.merge_cells(start_row=row + 1, start_column=1, end_row=row + 1, end_column=ncols)
    c = ws.cell(row=row + 1, column=1, value=TAGLINE); c.font = Font(name="Calibri", size=8, bold=True, color=GOLD_HEX)
    ws.merge_cells(start_row=row + 2, start_column=1, end_row=row + 2, end_column=ncols)
    c = ws.cell(row=row + 2, column=1, value=title); c.font = Font(name="Georgia", size=13, bold=True, color=NAVY_HEX)
    ws.merge_cells(start_row=row + 3, start_column=1, end_row=row + 3, end_column=ncols)
    c = ws.cell(row=row + 3, column=1, value=subtitle); c.font = Font(name="Calibri", size=10, italic=True, color="6B7280")
    for col in range(1, ncols + 1):
        ws.cell(row=row + 4, column=col).fill = F_GOLD
    ws.row_dimensions[row + 4].height = 4
    ws.row_dimensions[row].height = 24
    return row + 6  # first free row

def header_row(ws, row, headers, widths=None, height=30):
    for j, h in enumerate(headers, start=1):
        c = ws.cell(row=row, column=j, value=h); c.font = Font(name="Calibri", size=10, bold=True, color=WHITE); c.fill = F_NAVY
        c.alignment = Alignment(vertical="center", horizontal="center", wrap_text=True); c.border = BORDER
        if widths: ws.column_dimensions[get_column_letter(j)].width = widths[j - 1]
    ws.row_dimensions[row].height = height

def data_cell(ws, row, col, value, bold=False, fill=None, align="left", fmt=None, wrap=True, color=INK_HEX, size=10, italic=False):
    c = ws.cell(row=row, column=col, value=value)
    c.font = Font(name="Calibri", size=size, bold=bold, color=color, italic=italic); c.border = BORDER
    c.alignment = Alignment(vertical="top" if wrap else "center", horizontal=align, wrap_text=wrap)
    if fill: c.fill = fill
    if fmt: c.number_format = fmt
    return c

def legend(ws, row, lines, ncols):
    for i, line in enumerate(lines):
        ws.merge_cells(start_row=row + i, start_column=1, end_row=row + i, end_column=ncols)
        c = ws.cell(row=row + i, column=1, value=line); c.font = Font(name="Calibri", size=9, italic=True, color="6B7280")
        c.alignment = Alignment(wrap_text=True, vertical="top")
    return row + len(lines)

def print_setup(ws, landscape=True, fit_width=True):
    ws.page_setup.orientation = "landscape" if landscape else "portrait"; ws.page_setup.paperSize = ws.PAPERSIZE_A4
    ws.page_setup.fitToWidth = 1 if fit_width else 0; ws.page_setup.fitToHeight = 0; ws.sheet_properties.pageSetUpPr.fitToPage = fit_width
    ws.print_options.horizontalCentered = True; ws.page_margins.left = ws.page_margins.right = 0.5
    ws.oddFooter.center.text = CONTACT; ws.oddFooter.center.size = 8

# =============================================================================
# 1. Letter to Parents — template
# =============================================================================
def doc_letter_template():
    doc = new_doc("Letter to Parents and Guardians", "Template — replace every [bracketed] field before sending. Print on white A4; the header and footer reproduce the official letterhead.")
    p = body(doc, "[Date, e.g. 14 September 2026]", color=MUTED)
    body(doc, "Ref: [AIS/LET/2026/001]", color=MUTED, after=10)
    heading(doc, "To the Parent / Guardian of [Pupil name], [Class]", 2, 4)
    body(doc, "RE: [SUBJECT OF LETTER IN CAPITALS]", after=10).runs[0].bold = True
    body(doc, "Dear Parent / Guardian,")
    body(doc, "[Opening paragraph — state the purpose of the letter in one or two sentences. Example: We are writing to let you know about the arrangements for Sports Day on Friday 9 October 2026.]")
    body(doc, "[Detail paragraph — dates, times, what the child needs to bring or wear, costs if any, and what you need the parent to do. Keep to short sentences and use the bullet list below for practical points.]")
    bullet(doc, "[Date and time]")
    bullet(doc, "[Venue / meeting point]")
    bullet(doc, "[What to bring or wear]")
    bullet(doc, "[Cost and how to pay, if applicable]")
    body(doc, "[Closing paragraph — thank the parent, give the deadline for any reply slip, and say who to contact with questions: the class teacher in the first instance, then the school office on +263 775111171.]", after=10)
    body(doc, "Yours sincerely,")
    p = doc.add_paragraph(); p.paragraph_format.space_before = Pt(26); p.paragraph_format.space_after = Pt(0); run(p, "[Full name]", bold=True)
    body(doc, "[Position], Ayanda Infant School", color=MUTED, after=16)
    # reply slip
    rp = doc.add_paragraph(); rp.paragraph_format.space_after = Pt(4); para_border(rp, "top", NAVY_HEX, "8", "6")
    run(rp, "✂  Reply slip — please return to the class teacher by [date]", bold=True, size=10, color=NAVY)
    form_table(doc, [("Pupil's name", ""), ("Class", ""), ("I confirm that", "☐ my child WILL attend       ☐ my child will NOT attend"), ("Parent / Guardian name", ""), ("Signature and date", "")], (5.0, 11.5))
    doc.save(os.path.join(OUT, "Letter_to_Parents_Template.docx"))

# =============================================================================
# 2. End-of-term report card
# =============================================================================
def doc_report_card():
    doc = new_doc("End-of-Term Progress Report", "Infant Department (ECD A – Grade 2)  •  Term 3, 2026")
    form_table(doc, [("Pupil", ""), ("Admission No.", ""), ("Class", ""), ("Class Teacher", ""), ("Days present / possible", "          /          "), ("Times late", "")], (5.0, 11.5))
    eyebrow(doc, "How to read this report")
    body(doc, "Each learning area is graded on effort and attainment. Attainment: 4 Exceeding expectations · 3 Secure · 2 Developing · 1 Emerging. Effort: A Excellent · B Good · C Needs encouragement.", size=9.5, color=MUTED)
    heading(doc, "Learning areas", 1, 8)
    areas = [
        ("Language & Communication (English)", "Listening, speaking, early reading and writing"),
        ("Indigenous Language (isiNdebele / chiShona)", "Oral language, stories, songs and early literacy"),
        ("Mathematics & Science", "Number, shape, measure, pattern; exploring the world"),
        ("Heritage & Social Studies", "Family, community, culture and environment"),
        ("Visual & Performing Arts", "Drawing, painting, music, movement and drama"),
        ("Physical Education & Health", "Gross and fine motor skills, hygiene and safety"),
        ("Family, Religion & Moral Education", "Values, respect, kindness and responsibility"),
        ("ICT", "Using simple devices and following instructions"),
    ]
    rows = [["Learning area", "Attainment (1–4)", "Effort (A–C)", "Teacher's comment"]] + [[f"{a}\n{d}", "", "", ""] for a, d in areas]
    t = table(doc, rows, [6.0, 2.2, 2.0, 6.3], font_size=9, align_center_cols=(1, 2))
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].clear(); run(c.paragraphs[0], areas[i - 1][0], bold=True, size=9, color=INK)
        p2 = c.add_paragraph(); p2.paragraph_format.space_after = Pt(0); run(p2, areas[i - 1][1], size=8, color=MUTED)
        t.rows[i].height = Cm(1.3)
    heading(doc, "Personal and social development", 1)
    rows = [["Area", "Always", "Usually", "Sometimes", "Rarely"]] + [[a, "☐", "☐", "☐", "☐"] for a in ["Settles happily and follows class routines", "Shares, takes turns and plays cooperatively", "Listens carefully and follows instructions", "Takes care of belongings and the classroom", "Shows curiosity and perseveres with tasks", "Speaks confidently and asks for help when needed"]]
    table(doc, rows, [8.5, 2.0, 2.0, 2.0, 2.0], font_size=9.5, align_center_cols=(1, 2, 3, 4))
    heading(doc, "Class teacher's comment", 1)
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); c.width = Cm(16.5); cell_borders(c); t.rows[0].height = Cm(3.2)
    heading(doc, "Head Teacher's comment", 1)
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); c.width = Cm(16.5); cell_borders(c); t.rows[0].height = Cm(2.2)
    heading(doc, "Next term", 1)
    form_table(doc, [("Term 1, 2027 opens", "[date]"), ("Targets for next term", "")], (5.0, 11.5))
    doc.add_paragraph()
    signature_block(doc, ["Class Teacher", "Head Teacher", "Parent / Guardian", "Date"])
    doc.save(os.path.join(OUT, "End_of_Term_Report_Card.docx"))

# =============================================================================
# 3 & 4. ECD schemes of work (Excel)
# =============================================================================
WEEKS = [("1", "1 – 4 Sep"), ("2", "7 – 11 Sep"), ("3", "14 – 18 Sep"), ("4", "21 – 25 Sep"), ("5", "28 Sep – 2 Oct"), ("6", "5 – 9 Oct"), ("7", "12 – 16 Oct"),
         ("—", "19 – 23 Oct"), ("8", "26 – 30 Oct"), ("9", "2 – 6 Nov"), ("10", "9 – 13 Nov"), ("11", "16 – 20 Nov"), ("12", "23 – 27 Nov"), ("13", "30 Nov – 3 Dec")]

ECD_A = [
    ("All about me", "Say my name and age; name body parts through songs (\"Head, shoulders, knees and toes\"); listen to the story \"I like me\".", "Count body parts to 5; sort big/small; match pairs (shoes, socks).", "Body-awareness games; balancing on one foot; hand-washing routine.", "Self-portrait with crayons; mirror play; song \"If you're happy\".", "My name, my family's names; things I like; feelings faces.", "Mirror, crayons, story book, feelings cards", "Says own name; counts to 5 with objects"),
    ("My family", "Talk about who lives at home; family vocabulary (mother, father, gogo); retell a family story with puppets.", "Count family members; compare taller/shorter; pattern with two colours.", "Copy family actions (sweeping, cooking) in movement; ball rolling in pairs.", "Draw my family; make a paper-chain family; lullabies in isiNdebele.", "Family roles; respect for elders; family photos wall.", "Puppets, family photos, paper strips, glue", "Names 3 family members; copies AB pattern"),
    ("My home", "Rooms in a home; positional words (in, on, under); rhyme \"This is the house that Jack built\".", "Sort household objects by use; count doors and windows in the model home; shapes in the home (square window, rectangle door).", "Obstacle course \"around the house\"; threading beads (fine motor).", "Build a home from boxes; paint a house; sing \"Home, sweet home\".", "Keeping our home clean; safety at home (hot things, sharp things).", "Cardboard boxes, beads, paint, shape cards", "Uses in/on/under correctly; names square and circle"),
    ("Our school", "Names of teachers and helpers; school rules in pictures; story \"My first day\".", "Count chairs at our table; one-to-one matching (one cup per child); longer/shorter lines.", "Walk-the-line, tiptoe, hop; tidy-up routines; playground safety.", "Decorate the class door; clapping rhythms; class song.", "People who help us at school; our class jobs; saying please and thank you.", "Class photos, cups, rhythm sticks", "Follows two-step instruction; matches one-to-one to 5"),
    ("Food we eat", "Name foods; like/don't like; story \"The Very Hungry Caterpillar\".", "Sort fruit by colour; count to 6; heavy/light using a balance.", "Washing hands before eating; fruit tasting; cutting soft fruit with a butter knife.", "Fruit printing; make a fruit-salad collage; song \"Apples and bananas\".", "Healthy and unhealthy foods; where food comes from (garden, shop, farm).", "Real fruit, balance scale, paint, paper plates", "Sorts by one attribute; names 5 foods"),
    ("Animals on the farm", "Animal names and sounds; song \"Old MacDonald\"; sequence a 3-picture story.", "Count legs (2 and 4); big/small animals; match mother and baby.", "Move like animals (hop, crawl, gallop); egg-and-spoon walk.", "Animal masks; clay animals; farm role-play corner.", "How we care for animals; what animals give us (milk, eggs, wool).", "Animal figures, clay, masks, picture cards", "Matches 4 mother/baby pairs; counts to 6"),
    ("Wild animals of Zimbabwe", "Elephant, lion, giraffe, zebra; describing words (big, striped, tall); story \"Handa's Surprise\".", "Compare tall/taller/tallest (giraffe); count stripes; sort tame/wild.", "Animal walks; parachute game \"lions and zebras\"; stretching like a giraffe.", "Stripes and spots painting; make a zebra mask; drum rhythms.", "Where wild animals live (Hwange, Matobo); keeping safe around animals.", "Wild-animal pictures, drums, paint, parachute", "Uses one describing word; orders 3 by height"),
    ("Mid-term break", "", "", "", "", "", "", ""),
    ("Weather and the rainy season", "Weather words (sunny, rainy, windy, cloudy); daily weather chart; song \"Rain, rain, go away\".", "Count raindrops to 7; sort clothes by weather; sequence day/night.", "Umbrella dance; puddle-jumping game (hoops); putting on a jacket by myself.", "Rain-stick shakers; cloud collage with cotton wool; rain painting with droppers.", "What we do when it rains; keeping safe in storms (lightning).", "Weather chart, hoops, cotton wool, droppers", "Names 3 kinds of weather; counts to 7"),
    ("Transport", "Vehicle names; sounds (beep, choo-choo); story \"The Little Red Bus\" (kombi).", "Count wheels (2, 3, 4); fast/slow; sort land/water/air.", "Wheelbarrow walk; riding tricycles; stop/go game (traffic light colours).", "Junk-model vehicles; wheel printing; song \"The wheels on the bus\".", "Road safety: holding hands, look right-left-right; the kombi rank.", "Toy vehicles, boxes, tricycles, red/green cards", "Sorts by land/water/air; stops on red every time"),
    ("Plants and our garden", "Parts of a plant (root, stem, leaf, flower); story \"Jasper's Beanstalk\".", "Order seeds by size; count leaves; measure our bean with cubes each day.", "Digging, watering, carrying (gross motor); planting seeds (fine motor).", "Leaf rubbings; flower painting; song \"I'm a little seed\".", "Caring for plants; foods that grow in our gardens (maize, pumpkin).", "Bean seeds, cotton wool, cubes, crayons", "Names 3 plant parts; orders 3 sizes"),
    ("Water", "Wet/dry, float/sink words; story \"Mr Gumpy's Outing\".", "Full/empty/half; pouring and comparing; count cups to fill a jug.", "Water-relay with sponges; hand-washing steps; water safety.", "Bubble painting; ice-cube colour mixing; song \"Row, row, row your boat\".", "Where our water comes from (taps, boreholes, rivers); saving water.", "Water tray, jugs, sponges, ice cubes", "Predicts float/sink for 3 objects; uses full/empty"),
    ("People who help us", "Nurse, police officer, teacher, farmer, driver; who do we call?; role-play corner.", "Sort tools to helpers; count helpers on our street; match hats to jobs.", "Fire-drill practice; stretcher-carry game; stop-drop-roll.", "Make a helper's hat; dress-up parade; song \"People in our neighbourhood\".", "Community helpers visit (nurse or police); saying thank you to helpers.", "Dress-up clothes, tool pictures, card, elastic", "Names 4 helpers; matches 4 tools"),
    ("Celebrations", "Talk about celebrations at home; words for happy/party; retell the term's favourite story.", "Count candles to 8; share sweets equally between 2; shapes in decorations.", "Party games (musical statues, bean-bag toss); dance for the concert.", "Cards and decorations; rehearse Prize Giving songs; concert performance (27 Nov).", "Being thankful; giving and receiving gifts; saying goodbye for the holidays.", "Card, glitter, music, bean bags", "End-of-term observation checklist completed"),
]

ECD_B = [
    ("Myself and my feelings", "Introduce self in full sentences; initial sounds s, a, t; recognise own written name; story \"The Colour Monster\".", "Count to 10 with objects; numeral recognition 1–5; sort by two attributes (colour and size).", "Running and stopping on a signal; drawing circles and lines; tooth-brushing steps.", "Self-portrait with paint; feelings faces in clay; call-and-response songs.", "My name and family name; where I live; what makes me special.", "Name cards, numeral cards, mirrors, clay", "Writes first letter of name; counts 10 objects accurately"),
    ("My family and home", "Family words in isiNdebele and English; sounds p, i, n; write initial of family names; sequence a 4-picture story.", "Count family members and compare (more/fewer); numerals 1–6; repeating patterns ABB.", "Bean-bag balance; cutting along a line with scissors; sweeping and tidying.", "Family portrait; box-model home; traditional lullabies.", "Family roles and respect; types of homes (flat, house, hut); addresses.", "Scissors, boxes, pattern beads, family photos", "Cuts along a straight line; makes ABB pattern"),
    ("Our school community", "School helpers' names; sounds m, d, g; class rules written together; \"news time\" speaking.", "Count chairs and tables; numerals to 7; measure the classroom in footsteps.", "Team relay; throwing and catching a large ball; fire-drill practice.", "Class mural; drama \"a day at school\"; rhythm with claves.", "Class jobs rota; kindness tree; caring for our things.", "Large ball, claves, mural paper", "Recognises numerals to 7; throws and catches 3 times"),
    ("Healthy food", "Food names and tastes (sweet, sour, salty); sounds o, c, k; label a plate drawing; recipe instructions (sequence).", "Sort foods into groups; count to 8; halves (cut fruit in half).", "Hand-washing and food hygiene; making a fruit kebab; stretching after eating.", "Fruit printing; still-life drawing of fruit; food songs.", "Healthy choices; where food is grown; market visit or role-play.", "Real fruit, skewers, paint, food pictures", "Sorts into 3 food groups; shows a half"),
    ("Farm animals and their young", "Animal and baby names; sounds e, u, r; write CVC words (cat, hen, pig) with support; story \"Farmer Duck\".", "Count legs and group in 2s; numerals to 9; taller/shorter animals ordered.", "Animal movements circuit; wheelbarrow race; fine-motor \"feed the hen\" (tweezers).", "Farm collage with textures; animal masks; song \"Ngiyabonga\" farm version.", "Products from animals; caring for animals; farm safety.", "Tweezers, textured paper, masks, CVC cards", "Reads 3 CVC words; counts in 2s to 10"),
    ("Wild animals of Zimbabwe", "The Big Five; describing sentences (\"The lion is strong.\"); sounds h, b, f; information-book page.", "Compare sizes and speeds; numerals to 10; simple tally of favourite animals.", "Safari obstacle course; balance beam; freeze dance \"lion sleeps\".", "Spots-and-stripes prints; clay animals; mbira and drum patterns.", "National parks (Hwange, Matobo, Victoria Falls); protecting wildlife.", "Animal fact cards, clay, drums, balance beam", "Writes a 3-word caption; tallies to 10"),
    ("Weather and seasons", "Weather report each morning; sounds l, j, v; season words (rainy, dry, hot, cold); write a weather sentence.", "Weather pictograph over the week; numerals to 10 secure; ordering days of the week.", "Rain-dance movement; dressing for weather (zips, buttons); shelter-building outside.", "Cloud and rainbow art; wind-streamers; song \"Imvula\" (rain).", "The rainy season and planting; staying safe in lightning; saving water.", "Pictograph board, streamers, dressing frames", "Reads a pictograph; does up a zip and 2 buttons"),
    ("Mid-term break", "", "", "", "", "", "", ""),
    ("Transport and road safety", "Vehicle names; sounds w, x, y, z; write a caption for a vehicle drawing; sequence a journey.", "Count wheels and add (2 + 2); sort by number of wheels; distance far/near.", "Crossing-the-road practice (look right-left-right); tricycle circuit; stop/go signals.", "Junk-model kombi; traffic-light collage; song \"The wheels on the bus\" with actions.", "Kombi rank rules; holding hands; road signs we see.", "Toy cars, boxes, red/amber/green cards", "Adds 2 + 2 with objects; crosses safely with adult"),
    ("Plants and growing", "Life-cycle words (seed, sprout, plant, flower); sounds qu, ch, sh; write a bean diary.", "Measure bean height in cubes daily; record on a chart; order plants by height.", "Digging and watering; planting maize seeds; balancing watering cans.", "Leaf and bark rubbings; flower painting; song \"Mbeu\" (seed).", "Foods from our gardens; caring for plants; the maize season.", "Seeds, cups, cubes, chart paper", "Records 5 measurements; sequences life cycle"),
    ("Water and floating", "Prediction language (\"I think it will…\"); sounds th, ng; instructions for a water experiment.", "Capacity: full, half, empty; count scoops to fill; compare containers.", "Sponge-relay; hand-washing checklist; water safety (pools, rivers).", "Bubble prints; ice-melt colour experiment; water sounds with instruments.", "Where water comes from (boreholes, Umzingwane dam); saving water at home.", "Water tray, containers, sponges, food colouring", "Predicts and tests 4 objects; compares 3 capacities"),
    ("People who help us", "Interview a helper (questions); sounds ai, ee, oo; write a thank-you card.", "Sort helpers and tools; count in a survey; simple addition to 10.", "Fire-drill practice; first-aid role-play; stretcher relay.", "Helper hats and badges; drama corner; song \"Nurse, nurse\".", "Community visit (nurse / police); emergency numbers; helping at home.", "Dress-up, card, tool pictures", "Asks 2 questions; adds to 10 with objects"),
    ("Our country Zimbabwe", "Flag colours and meaning; sounds oa, ie; write \"I live in Zimbabwe\"; national anthem verse 1.", "Count flag stripes; symmetry in the flag; 2-D shapes in the coat of arms.", "Marching and mass-display moves; hoop routines for the concert.", "Paint the flag; make a Zimbabwe bird; drum ensemble.", "Landmarks (Great Zimbabwe, Victoria Falls); languages we speak; respect for symbols.", "Flag, paint, hoops, drums", "Names 3 flag colours and meanings; copies a symmetrical shape"),
    ("Celebrations and concert", "Retell favourite stories; invitations to Prize Giving; sight-word revision.", "Share equally between 2 and 4; count to 20; revision of numerals 1–10.", "Concert dance and mass display; party games; tidy-up teams.", "Rehearse and perform at Prize Giving (27 Nov); decorate the hall; cards for home.", "Thankfulness; celebrations in different families; saying goodbye.", "Costumes, music, card, decorations", "End-of-term assessment: sounds, numerals, name-writing"),
]

def xlsx_scheme(filename, grade, teacher, content):
    wb, ws = wb_new("Scheme of Work")
    r = brand_title(ws, f"{grade} Scheme of Work — Term 3, 2026", f"Class teacher: {teacher}   •   Term dates: Tue 1 Sept – Thu 3 Dec 2026   •   Mid-term break 19 – 23 Oct   •   Prize Giving 27 Nov", 10)
    headers = ["Wk", "Dates", "Theme", "Language & Communication", "Mathematics & Science", "Physical Education & Health", "Visual & Performing Arts", "Heritage, Family & Social", "Resources", "Assessment focus"]
    header_row(ws, r, headers, [5, 14, 18, 36, 34, 32, 32, 30, 22, 26], 34); r += 1
    for (wk, dates), row in zip(WEEKS, content):
        if row[0] == "Mid-term break":
            data_cell(ws, r, 1, wk, align="center", fill=F_GOLD100); data_cell(ws, r, 2, dates, fill=F_GOLD100)
            ws.merge_cells(start_row=r, start_column=3, end_row=r, end_column=10)
            data_cell(ws, r, 3, "Mid-term break — school closed", bold=True, fill=F_GOLD100, color=GOLD_HEX, wrap=False)
            for col in range(4, 11): ws.cell(row=r, column=col).border = BORDER; ws.cell(row=r, column=col).fill = F_GOLD100
            ws.row_dimensions[r].height = 20
        else:
            data_cell(ws, r, 1, wk, align="center", bold=True, color=NAVY_HEX); data_cell(ws, r, 2, dates)
            data_cell(ws, r, 3, row[0], bold=True, color=NAVY_HEX)
            for j, txt in enumerate(row[1:], start=4): data_cell(ws, r, j, txt, size=9.5)
            ws.row_dimensions[r].height = 118
        r += 1
    r += 1
    r = legend(ws, r, ["Learning areas follow the Zimbabwe Early Childhood Development syllabus. Weekly plans expand each cell into daily activities; record observations against the assessment focus in the class assessment file.",
                       "Edit the theme or activities directly in the cells. Keep the week and date columns unchanged so the plan matches the portal calendar."], 10)
    ws.freeze_panes = "D8"
    print_setup(ws, landscape=True)
    ws.sheet_view.zoomScale = 90
    wb.save(os.path.join(OUT, filename))

# =============================================================================
# 5. Grade 1 weekly plan
# =============================================================================
def doc_grade1_weekly_plan():
    doc = new_doc("Grade 1 Weekly Lesson Plan", "Template with a completed example week. Copy the file, rename it with the week number, and replace the example content.", landscape=True)
    form_table(doc, [("Class", "Grade 1 — Acacia (Room 3)"), ("Teacher / Assistant", ""), ("Week", "Week 3 — Monday 14 to Friday 18 September 2026 (example)"), ("Theme", "Our school community"), ("Cross-cutting focus", "Speaking in full sentences; number bonds to 10")], (5.0, 20.0))
    doc.add_paragraph()
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    subjects = ["English", "isiNdebele", "Mathematics & Science", "Heritage-Social Studies", "VPA / PE / ICT"]
    plan = {
        "English": ["Phonics: revise sh, ch. Shared reading \"Our School\" (big book). Objective: read 5 words with sh/ch.", "Sight words: the, is, and, we, my. Sentence building with word cards. Objective: write 2 sentences about school.", "Guided reading groups (3 groups, levelled readers). Objective: answer 2 who/what questions.", "Writing: \"My teacher\" — plan with a picture, then write 3 sentences. Objective: capital letter and full stop.", "Review and spelling test (8 words). Reading buddies with Grade 2."],
        "isiNdebele": ["Izifundo: amagama esikolo (school words). Ingoma \"Isikolo sethu\". Objective: name 6 school objects.", "Izinhlamvu: s, b, m — reading and writing syllables (sa, se, si…). Objective: write 4 syllables.", "Indaba: \"UThemba esikolweni\" — listening and retelling in order. Objective: retell 3 events.", "Ukubhala: izivakashi ezimbili ngesikolo (2 sentences about school). Objective: correct word spacing.", "Oral presentation: \"Mina ngiyathanda…\" (I like…). Objective: speak 3 sentences confidently."],
        "Mathematics & Science": ["Number bonds to 10 with counters and ten-frames. Objective: give the partner of any number to 10.", "Addition within 10 on a number line. Objective: solve 6 additions correctly.", "Measuring the classroom in hand spans and footsteps; compare. Objective: order 3 lengths.", "Subtraction within 10 as \"take away\" with counters. Objective: solve 6 subtractions.", "Science: materials around the school (wood, metal, plastic). Objective: sort 8 objects by material."],
        "Heritage-Social Studies": ["People who work at our school; class map of the school. Objective: name 4 roles.", "Class rules and why we have them; kindness pledge. Objective: state 3 rules.", "Our school in the community: who uses the hall; map of Manningdale. Objective: locate school on the map.", "Symbols of our school (crest, colours, motto \"Where excellence begins\"). Objective: explain the motto.", "Visitor: school groundsman talks about looking after the grounds. Objective: ask 1 question."],
        "VPA / PE / ICT": ["PE: running, dodging, team relay. Warm-up and cool-down routines.", "VPA: crest colouring with navy and gold; pattern borders.", "ICT: tablet — tapping and dragging; educational phonics app (15 min).", "VPA: class song for assembly; percussion patterns in 4s.", "PE: ball skills — bounce and catch in pairs; small-sided games."],
    }
    rows = [["Learning area"] + days]
    for s in subjects: rows.append([s] + plan[s])
    t = table(doc, rows, [3.6, 4.4, 4.4, 4.4, 4.4, 4.4], font_size=8.5)
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY; shade(c, "F3F6F9")
    heading(doc, "Resources needed this week", 2)
    body(doc, "Big book \"Our School\"; sh/ch sound cards; ten-frames and counters; number lines to 10; hand-span recording sheet; materials tray (wood, metal, plastic); tablets ×6; navy and gold crayons; percussion set.", size=9.5)
    heading(doc, "Differentiation and support", 2)
    bullet(doc, "Support group (5 pupils): number bonds to 5 first, with counters; picture prompts for writing; assistant teacher works alongside.", 9.5)
    bullet(doc, "Extension: number bonds to 20; write 5 sentences with a connective (\"and\", \"because\").", 9.5)
    bullet(doc, "Pupils with glasses sit at the front for board work; inhaler pupils — see office before PE.", 9.5)
    heading(doc, "Evaluation (complete on Friday)", 2)
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); c.width = Cm(25.5); cell_borders(c); t.rows[0].height = Cm(2.4)
    p = c.paragraphs[0]; run(p, "What went well · What to carry forward · Pupils to follow up", size=8.5, color=MUTED)
    doc.add_paragraph()
    signature_block(doc, ["Class Teacher", "Checked by (Deputy Head)", "Date"])
    doc.save(os.path.join(OUT, "Grade_1_Weekly_Lesson_Plan_Template.docx"))

# =============================================================================
# 6. Grade 2 reading assessment rubric
# =============================================================================
def doc_reading_rubric():
    doc = new_doc("Grade 2 Reading Assessment Rubric", "Term 3, 2026  •  Used for the one-to-one reading assessments starting Monday 21 September. Assess each pupil on a levelled text of about 120 words.", landscape=True)
    eyebrow(doc, "Levels")
    body(doc, "1 Emerging — needs adult support for most of the text.   2 Developing — manages with some prompting.   3 Secure — reads independently and accurately.   4 Exceeding — reads fluently with insight beyond the text.", size=9.5, color=MUTED)
    rows = [["Criterion", "1 · Emerging", "2 · Developing", "3 · Secure", "4 · Exceeding"],
        ["Phonics and decoding", "Sounds out CVC words with support; struggles with digraphs (sh, ch, th).", "Decodes most CVC and CCVC words; digraphs with prompting.", "Decodes unfamiliar words using phonics; applies digraphs and common vowel teams (ai, ee, oa).", "Uses syllables and word parts to read multi-syllable words independently."],
        ["Sight vocabulary", "Recognises fewer than 20 of the 50 Grade 2 sight words.", "Recognises 20–34 sight words.", "Recognises 35–45 sight words instantly.", "Recognises all 50 and reads them in context without hesitation."],
        ["Accuracy", "Below 90% of words read correctly.", "90–94% accuracy; self-corrects occasionally.", "95–98% accuracy; self-corrects most errors.", "99–100% accuracy on the text."],
        ["Fluency and phrasing", "Word by word; below 30 words per minute.", "Short phrases; 30–49 words per minute.", "Reads in meaningful phrases; 50–70 words per minute.", "Smooth, natural phrasing above 70 words per minute."],
        ["Expression", "Monotone; ignores punctuation.", "Pauses at full stops; some expression.", "Uses full stops, question marks and commas; voice changes for dialogue.", "Expressive reading that reflects mood and character."],
        ["Comprehension — literal", "Answers 1 of 4 questions about who, what, where.", "Answers 2 of 4 literal questions.", "Answers 3–4 literal questions and retells the main events in order.", "Retells with detail and summarises the main idea in own words."],
        ["Comprehension — inferential", "Cannot say why a character acted or what might happen next.", "Makes a simple prediction with prompting.", "Explains a character's feelings and predicts sensibly, giving a reason.", "Links the text to own experience and other stories; justifies opinions."],
        ["Reading behaviours", "Reluctant; needs encouragement to start.", "Reads when asked; chooses familiar books.", "Chooses books willingly; talks about favourites.", "Reads for pleasure daily; recommends books to others."]]
    t = table(doc, rows, [4.2, 5.3, 5.3, 5.3, 5.3], font_size=8.5)
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY
    heading(doc, "Scoring and next steps", 2)
    body(doc, "Total the eight criteria (maximum 32). 8–13: Emerging reader — daily 1:1 phonics and paired reading. 14–20: Developing — guided reading group three times a week. 21–27: Secure — independent readers with weekly conference. 28–32: Exceeding — extension texts and reading-buddy role with Grade 1.", size=9.5)
    page_break(doc)
    # class record sheet
    tp = doc.add_paragraph(); run(tp, "Class record sheet — Grade 2 Baobab", bold=True, size=14, color=NAVY, font="Georgia")
    body(doc, "Assessor: ______________________   •   Enter the level (1–4) for each criterion, then the total and the reading group.", size=9.5, color=MUTED)
    crit = ["Phonics", "Sight vocab", "Accuracy", "Fluency", "Expression", "Literal", "Inferential", "Behaviours"]
    rows = [["#", "Pupil", "Adm. No."] + crit + ["Total /32", "Group", "Date"]]
    g2 = sorted([p for p in PUPILS if p["classId"] == "c4"], key=lambda p: (p["last"], p["first"]))
    if g2:
        for i, p in enumerate(g2, 1): rows.append([str(i), f"{p['last']}, {p['first']}", p["admissionNo"]] + [""] * 8 + ["", "", ""])
    else:
        for i in range(1, 21): rows.append([str(i), "", ""] + [""] * 8 + ["", "", ""])
    t = table(doc, rows, [0.8, 4.6, 2.0] + [1.55] * 8 + [1.7, 1.8, 2.0], font_size=8.5, align_center_cols=tuple(range(3, 14)))
    doc.save(os.path.join(OUT, "Grade_2_Reading_Assessment_Rubric.docx"))

# =============================================================================
# 7. Admission form
# =============================================================================
def doc_admission_form():
    doc = new_doc("Application for Admission", "Please complete in BLOCK CAPITALS and return to the school office with the documents listed on page 2. One form per child.")
    t = doc.add_table(rows=1, cols=2); t.alignment = WD_TABLE_ALIGNMENT.RIGHT
    c = t.cell(0, 0); c.width = Cm(4); run(c.paragraphs[0], "Office use only", bold=True, size=8.5, color=GOLD)
    c = t.cell(0, 1); c.width = Cm(6.5); run(c.paragraphs[0], "Admission No. AIS/________   Class ________   Date received ________", size=8.5, color=MUTED); cell_borders(c, GOLD_HEX)
    heading(doc, "1. Child's details", 1, 6)
    form_table(doc, [("Surname", ""), ("First name(s)", ""), ("Preferred name", ""), ("Date of birth", "____ / ____ / ________        Gender:  ☐ Girl   ☐ Boy"), ("Birth certificate no.", ""), ("Nationality", ""), ("Home language(s)", "☐ isiNdebele   ☐ chiShona   ☐ English   ☐ Other: ____________"), ("Class applied for", "☐ ECD A (3–4 yrs)   ☐ ECD B (4–5 yrs)   ☐ Grade 1   ☐ Grade 2"), ("Intended start date", ""), ("Home address", "\n"), ("Previous school / crèche (if any)", "")])
    heading(doc, "2. Parent / guardian details", 1)
    form_table(doc, [("Parent / Guardian 1 — full name", ""), ("Relationship to child", ""), ("National ID no.", ""), ("Mobile phone", ""), ("Email", ""), ("Occupation and employer", ""), ("Parent / Guardian 2 — full name", ""), ("Relationship to child", ""), ("Mobile phone", ""), ("Email", ""), ("Child lives with", "☐ Both parents   ☐ Mother   ☐ Father   ☐ Guardian   ☐ Other: __________")])
    heading(doc, "3. Emergency contacts (other than parents)", 1)
    table(doc, [["Name", "Relationship", "Phone", "May collect the child?"], ["", "", "", "☐ Yes   ☐ No"], ["", "", "", "☐ Yes   ☐ No"]], [5.5, 3.5, 4.0, 3.5], font_size=9.5, zebra=False)
    for i in range(1, 3): doc.tables[-1].rows[i].height = Cm(0.9)
    page_break(doc)
    heading(doc, "4. Health information", 1, 4)
    body(doc, "This information is kept confidentially and shared only with staff who need it to keep your child safe.", size=9.5, color=MUTED)
    form_table(doc, [("Allergies (food, medicine, insect stings)", "\n"), ("Medical conditions (asthma, epilepsy, etc.)", "\n"), ("Regular medication", ""), ("Family doctor / clinic and phone", ""), ("Medical aid (name and number)", ""), ("Immunisations up to date?", "☐ Yes   ☐ No   (attach a copy of the immunisation card)"), ("Dietary requirements", ""), ("Anything else we should know to support your child", "\n")])
    heading(doc, "5. Documents to attach", 1)
    checkbox_line(doc, ["Certified copy of birth certificate", "Two passport photographs"])
    checkbox_line(doc, ["Copy of parent / guardian national ID", "Immunisation card"])
    checkbox_line(doc, ["Transfer letter / report from previous school (Grade 1–2)", "Proof of residence"])
    heading(doc, "6. Consents", 1)
    checkbox_line(doc, ["I consent to my child receiving first aid and, in an emergency, medical treatment when I cannot be reached."])
    checkbox_line(doc, ["I consent to photographs of my child being used in school displays, reports and the school newsletter (no names online)."])
    checkbox_line(doc, ["I consent to my child taking part in local educational walks and trips with prior notice for each trip."])
    heading(doc, "7. Declaration", 1)
    body(doc, "I declare that the information given on this form is true and complete. I have read and accept the school's fees policy and code of conduct for parents, and I will inform the school of any change to these details.", size=10)
    signature_block(doc, ["Parent / Guardian signature", "Full name", "Date"])
    doc.add_paragraph()
    eyebrow(doc, "Office use")
    table(doc, [["Interview date", "Interviewed by", "Placement class", "Fees deposit received", "Approved by Head Teacher"], ["", "", "", "", ""]], [3.3, 3.3, 3.3, 3.3, 3.3], font_size=9, zebra=False)
    doc.tables[-1].rows[1].height = Cm(1.0)
    doc.save(os.path.join(OUT, "Admission_Form.docx"))

# =============================================================================
# 8. Photo & trip consent register (Excel)
# =============================================================================
def xlsx_consent_register():
    wb, ws = wb_new("Consent Register")
    r = brand_title(ws, "Photo & Trip Consent Register — 2026", "One row per pupil on roll. Record the consent given on the admission form or the latest consent slip. Yellow cells are for you to fill in; the summary below updates automatically.", 10)
    headers = ["Admission No.", "Pupil", "Class", "Guardian", "Guardian phone", "Photo consent", "Trip consent", "Form received (date)", "Recorded by", "Notes"]
    header_row(ws, r, headers, [14, 26, 20, 22, 18, 14, 14, 18, 16, 30]); r += 1
    first = r
    dv = DataValidation(type="list", formula1='"Yes,No,Pending"', allow_blank=True); ws.add_data_validation(dv)
    # With no roll entered yet this prints as a blank register to fill in by hand;
    # run this script again once pupils are on the system and it fills itself.
    roster = sorted(PUPILS, key=lambda p: (p["classId"], p["last"], p["first"])) or [None] * 24
    for p in roster:
        if p is None:
            for col in (1, 2, 3, 4, 5): data_cell(ws, r, col, "", fill=F_INPUT, wrap=False)
        else:
            data_cell(ws, r, 1, p["admissionNo"], wrap=False); data_cell(ws, r, 2, f"{p['last']}, {p['first']}", wrap=False, bold=True, color=NAVY_HEX)
            data_cell(ws, r, 3, p["className"], wrap=False); data_cell(ws, r, 4, f"{p['guardian']['name']} ({p['guardian']['relationship']})", wrap=False); data_cell(ws, r, 5, p["guardian"]["phone"], wrap=False)
        for col in (6, 7): data_cell(ws, r, col, "", align="center", fill=F_INPUT, wrap=False); dv.add(ws.cell(row=r, column=col))
        data_cell(ws, r, 8, None, fill=F_INPUT, wrap=False, fmt="DD MMM YYYY"); data_cell(ws, r, 9, "", fill=F_INPUT, wrap=False); data_cell(ws, r, 10, "", fill=F_INPUT, wrap=False)
        r += 1
    last = r - 1
    # one row showing the expected format
    ws.cell(row=first, column=6, value="Yes"); ws.cell(row=first, column=7, value="Yes"); ws.cell(row=first, column=8, value=dt.date(2026, 1, 13)); ws.cell(row=first, column=10, value="Example — consent taken from the admission form")
    for col in range(1, 11): ws.cell(row=first, column=col).font = Font(name="Calibri", size=10, italic=True, color="6B7280")
    green = PatternFill("solid", fgColor="E3F1E8"); red = PatternFill("solid", fgColor="F8E4E1"); amber = PatternFill("solid", fgColor="FBEED3")
    rng = f"F{first}:G{last}"
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Yes"'], fill=green))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"No"'], fill=red))
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Pending"'], fill=amber))
    ws.freeze_panes = f"C{first}"
    ws.auto_filter.ref = f"A{first - 1}:J{last}"
    # summary
    r += 2
    ws.cell(row=r, column=1, value="Summary by class").font = Font(name="Georgia", size=12, bold=True, color=NAVY_HEX); r += 1
    header_row(ws, r, ["Class", "On roll", "Photo: Yes", "Photo: No", "Photo: not recorded", "Trip: Yes", "Trip: No", "Trip: not recorded"], height=30); r += 1
    srow = r
    for cls in CLASSES:
        n = cls["name"]
        data_cell(ws, r, 1, n, bold=True, wrap=False)
        data_cell(ws, r, 2, f'=COUNTIF($C${first}:$C${last},A{r})', align="center", wrap=False)
        data_cell(ws, r, 3, f'=COUNTIFS($C${first}:$C${last},A{r},$F${first}:$F${last},"Yes")', align="center", wrap=False)
        data_cell(ws, r, 4, f'=COUNTIFS($C${first}:$C${last},A{r},$F${first}:$F${last},"No")', align="center", wrap=False)
        data_cell(ws, r, 5, f'=B{r}-C{r}-D{r}', align="center", wrap=False)
        data_cell(ws, r, 6, f'=COUNTIFS($C${first}:$C${last},A{r},$G${first}:$G${last},"Yes")', align="center", wrap=False)
        data_cell(ws, r, 7, f'=COUNTIFS($C${first}:$C${last},A{r},$G${first}:$G${last},"No")', align="center", wrap=False)
        data_cell(ws, r, 8, f'=B{r}-F{r}-G{r}', align="center", wrap=False)
        r += 1
    data_cell(ws, r, 1, "Whole school", bold=True, fill=F_NAVY50, wrap=False)
    for col in range(2, 9):
        L = get_column_letter(col); data_cell(ws, r, col, f"=SUM({L}{srow}:{L}{r - 1})", bold=True, align="center", fill=F_NAVY50, wrap=False)
    r += 2
    legend(ws, r, ["Yellow cells are inputs. Use the drop-down (Yes / No / Pending) in the consent columns; \"not recorded\" in the summary counts blanks and Pending together.",
                   "A pupil without Photo consent = Yes must not appear in newsletters, displays or social media. A pupil without Trip consent = Yes needs a signed slip before every trip.",
                   "Pupil list generated from the staff portal on 14 Sep 2026. Add new admissions at the bottom of the list and extend the filter range."], 10)
    print_setup(ws, landscape=True)
    wb.save(os.path.join(OUT, "Photo_and_Trip_Consent_Register_2026.xlsx"))

# =============================================================================
# 9. Staff employment contract template
# =============================================================================
def doc_contract_template():
    doc = new_doc("Contract of Employment", "Template — for use by HR with the Head Teacher. Replace every [bracketed] field. Have the final contract reviewed against the current Labour Act [Chapter 28:01] and any applicable collective bargaining agreement before signing.")
    body(doc, "This contract is made between Ayanda Infant School of 1 Chazzis Way, Manningdale, Bulawayo (\"the School\") and the employee named below (\"the Employee\").", after=8)
    form_table(doc, [("Employee full name", "[Full name]"), ("National ID no.", "[00-000000-X-00]"), ("Home address", "[Address]"), ("Position", "[Class Teacher / Assistant Teacher / Bursar …]"), ("Reports to", "[Head Teacher / Deputy Head]"), ("Contract type", "☐ Permanent   ☐ Fixed term: [start] to [end]   ☐ Probationary"), ("Start date", "[date]"), ("Place of work", "Ayanda Infant School, Bulawayo")])
    clauses = [
        ("1. Appointment and probation", "The Employee is appointed to the position stated above. The first [three] months of employment are a probationary period during which either party may terminate the contract on [two] weeks' written notice. Confirmation of appointment will be given in writing on successful completion of probation."),
        ("2. Duties", "The Employee will carry out the duties in the attached job description and such other reasonable duties as the Head Teacher may assign, including participation in school events such as Sports Day, Prize Giving and parent consultations. Teaching staff will prepare schemes of work and weekly plans, maintain attendance registers on the staff portal by 08:15 daily, keep pupil records up to date and attend staff meetings."),
        ("3. Hours of work", "Normal working hours are [07:15 to 15:30], Monday to Friday, during term time, with [10] additional working days per year for planning, training and reporting as scheduled by the Head Teacher. The Employee may be required to work reasonable additional hours for school events with prior notice."),
        ("4. Remuneration", "The Employee will be paid a gross salary of [currency and amount] per month, payable on or before the [25th] of each month by bank transfer, less statutory deductions (PAYE, NSSA and any other lawful deduction). Salary will be reviewed annually in [January]. Allowances: [transport / housing / none]."),
        ("5. Leave", "Vacation leave accrues as provided in the Labour Act and is normally taken during school holidays. Sick leave and special leave are granted in accordance with the Labour Act on production of a medical certificate where required. Maternity leave is granted in accordance with the Labour Act."),
        ("6. Child protection and vetting", "This appointment is conditional on a satisfactory police clearance certificate, two references and verification of qualifications. The Employee agrees to comply with the School's Child Protection and Safeguarding Policy and Staff Code of Conduct at all times and to report any safeguarding concern to the Head Teacher the same day."),
        ("7. Confidentiality and data", "Pupil, family and staff information is confidential. The Employee will use the staff portal and Google Drive only within the access granted to their role, will not share log-in details, and will not remove or copy pupil records except as required for their duties."),
        ("8. Professional development", "The Employee will attend training arranged by the School and maintain any professional registration or first-aid certification required for the role. The School will record training in the staff CPD register."),
        ("9. Discipline and grievances", "The School's disciplinary and grievance procedures, which follow the Labour Act and the applicable employment code, apply to this contract and are available from HR."),
        ("10. Termination", "After probation, either party may terminate this contract by giving [one month's] written notice, or such longer period as required by law. The School may terminate summarily for gross misconduct in accordance with the applicable employment code. On termination the Employee will return all school property, keys, devices and records."),
        ("11. Whole agreement", "This contract, together with the job description, Staff Code of Conduct and school policies, forms the whole agreement between the parties and replaces any earlier arrangement. Changes must be agreed in writing and signed by both parties."),
    ]
    for title, text in clauses:
        heading(doc, title, 2, 10); body(doc, text, size=10)
    heading(doc, "Signatures", 1)
    body(doc, "Signed by the parties on the dates shown. The Employee confirms that they have read and understood this contract and received copies of the job description and the policies referred to above.", size=10)
    signature_block(doc, ["Employee", "Date"])
    signature_block(doc, ["For the School — Head Teacher", "Date"])
    signature_block(doc, ["Witness", "Date"])
    doc.save(os.path.join(OUT, "Staff_Employment_Contract_Template.docx"))

# =============================================================================
# 10. Staff CPD & certificates record (Excel)
# =============================================================================
def xlsx_cpd_register():
    wb, ws = wb_new("Staff Register")
    r = brand_title(ws, "Staff Certificates & CPD Record — 2026", "Kept by HR. Yellow cells are inputs. Status columns turn amber 60 days before an expiry and red once expired. Values shown are demo entries to replace with the actual records.", 12)
    headers = ["Staff ID", "Name", "Role", "Start date", "Highest qualification", "Teaching / ECD certificate no.", "Police clearance date", "Clearance status", "First aid expiry", "First aid status", "CPD hours 2026", "Notes"]
    header_row(ws, r, headers, [9, 24, 26, 12, 30, 20, 16, 16, 14, 14, 12, 30]); r += 1
    first = r
    quals = {}   # filled in by the school, per member of staff
    for i, s in enumerate(list(STAFF) + [None] * max(0, 16 - len(STAFF))):
        if s is None:
            for col in range(1, 13): data_cell(ws, r, col, "", fill=F_INPUT, wrap=False)
            r += 1
            continue
        yr = 2019 + (i % 4)
        data_cell(ws, r, 1, s["id"].upper(), wrap=False); data_cell(ws, r, 2, f"{s['title']} {s['first']} {s['last']}", bold=True, color=NAVY_HEX, wrap=False); data_cell(ws, r, 3, s["role"], wrap=False)
        data_cell(ws, r, 4, dt.date.fromisoformat(s["started"]) if s.get("started") else "", fmt="DD MMM YYYY", wrap=False)
        data_cell(ws, r, 5, quals.get(s["id"], ""), fill=F_INPUT, wrap=False); data_cell(ws, r, 6, f"[MoPSE/{yr}/{1200 + i * 37}]" if "Teacher" in s["role"] or "Head" in s["role"] else "n/a", fill=F_INPUT, wrap=False)
        data_cell(ws, r, 7, dt.date(2024 + (i % 3), 1 + (i * 2) % 12, 5 + i), fmt="DD MMM YYYY", fill=F_INPUT, wrap=False)
        data_cell(ws, r, 8, f'=IF(G{r}="","Missing",IF(G{r}+365*3<TODAY(),"Renew now",IF(G{r}+365*3-60<TODAY(),"Due soon","Valid")))', align="center", wrap=False)
        data_cell(ws, r, 9, dt.date(2026 + (i % 2), 1 + (i * 3) % 12, 10 + (i % 15)), fmt="DD MMM YYYY", fill=F_INPUT, wrap=False)
        data_cell(ws, r, 10, f'=IF(I{r}="","Missing",IF(I{r}<TODAY(),"Expired",IF(I{r}-60<TODAY(),"Due soon","Valid")))', align="center", wrap=False)
        data_cell(ws, r, 11, f"=SUMIF('CPD Log'!$B:$B,B{r},'CPD Log'!$E:$E)", align="center", wrap=False, fmt="0.0")
        data_cell(ws, r, 12, "", fill=F_INPUT, wrap=False)
        r += 1
    last = r - 1
    green = PatternFill("solid", fgColor="E3F1E8"); red = PatternFill("solid", fgColor="F8E4E1"); amber = PatternFill("solid", fgColor="FBEED3")
    for rng in (f"H{first}:H{last}", f"J{first}:J{last}"):
        ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Valid"'], fill=green))
        ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"Due soon"'], fill=amber))
        for word in ("Expired", "Renew now", "Missing"):
            ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=[f'"{word}"'], fill=red))
    r += 1
    legend(ws, r, ["Police clearance is treated as valid for 3 years from the date issued; first-aid certificates expire on the date shown. Adjust the 365*3 in column H if the school policy changes.",
                   "CPD hours are totalled automatically from the CPD Log sheet by staff name — spell the name exactly as in column B.",
                   "Qualification, certificate and date values are demo placeholders generated on 14 Sep 2026; replace them with the records in each personnel file."], 12)
    ws.freeze_panes = f"C{first}"; print_setup(ws, landscape=True)
    # CPD log sheet
    log = wb.create_sheet("CPD Log")
    r2 = brand_title(log, "CPD Log — 2026", "One row per training activity. Hours flow to the Staff Register sheet.", 7)
    header_row(log, r2, ["Date", "Staff name", "Activity", "Provider", "Hours", "Evidence filed (Drive)", "Signed off by"], [14, 26, 44, 26, 8, 22, 18]); r2 += 1
    # Two rows showing the shape. The school fills this in as training happens.
    entries = [
        (dt.date(2026, 1, 13), "", "Whole-staff safeguarding induction", "In-house", 3, "Yes", ""),
        (dt.date(2026, 3, 7), "", "Paediatric first aid (2-day)", "St John Ambulance Bulawayo", 14, "Pending", ""),
    ]
    for e in entries:
        for j, v in enumerate(e, 1): data_cell(log, r2, j, v, fmt="DD MMM YYYY" if j == 1 else ("0.0" if j == 5 else None), fill=F_INPUT, wrap=False, align="center" if j in (1, 5) else "left")
        r2 += 1
    for _ in range(10):
        for j in range(1, 8): data_cell(log, r2, j, None, fill=F_INPUT, wrap=False, fmt="DD MMM YYYY" if j == 1 else None)
        r2 += 1
    legend(log, r2 + 1, ["Demo entries dated before 14 Sep 2026 illustrate the format; replace with actual training records. Blank yellow rows are ready for new entries."], 7)
    log.freeze_panes = "A8"; print_setup(log, landscape=True)
    wb.save(os.path.join(OUT, "Staff_CPD_and_Certificates_Record_2026.xlsx"))

# =============================================================================
# 11. Staff appraisal form
# =============================================================================
def doc_appraisal_form():
    doc = new_doc("Staff Appraisal Form 2026", "Annual appraisal for teaching and administrative staff. The appraisee completes Section 2 before the meeting; the appraiser completes Sections 3–5 during it.")
    heading(doc, "1. Details", 1, 4)
    form_table(doc, [("Name of appraisee", ""), ("Position / class", ""), ("Appraiser", ""), ("Appraisal period", "January – December 2026"), ("Date of meeting", ""), ("Date of last appraisal", "")])
    heading(doc, "2. Self-assessment (appraisee)", 1)
    for q in ["What have been your main achievements this year?", "Which of last year's objectives did you meet, and which need more time?", "What has got in the way of your work, and what support would help?", "What professional development would you like next year?"]:
        eyebrow(doc, q)
        t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); c.width = Cm(16.5); cell_borders(c); t.rows[0].height = Cm(2.0)
    page_break(doc)
    heading(doc, "3. Professional standards (appraiser)", 1, 4)
    body(doc, "4 Exceeds the standard · 3 Meets the standard · 2 Partly meets · 1 Does not yet meet. Comment on any rating of 2 or 1.", size=9.5, color=MUTED)
    rows = [["Standard", "What good looks like at Ayanda", "1", "2", "3", "4"],
        ["Planning and teaching", "Schemes and weekly plans on Drive by Friday; lessons matched to pupils' stages; assessment used to adjust teaching.", "☐", "☐", "☐", "☐"],
        ["Classroom climate", "Calm, positive routines; pupils feel safe; behaviour managed with the school's restorative approach.", "☐", "☐", "☐", "☐"],
        ["Pupil progress", "Pupils make good progress from their starting points; records show evidence; parents informed.", "☐", "☐", "☐", "☐"],
        ["Safeguarding and welfare", "Registers by 08:15 daily; incidents logged the same day; policies followed; concerns escalated promptly.", "☐", "☐", "☐", "☐"],
        ["Communication", "Courteous, clear communication with parents and colleagues; uses the portal channels; meets deadlines.", "☐", "☐", "☐", "☐"],
        ["Teamwork and contribution", "Supports school events; shares resources; contributes to the ECD or Grades team.", "☐", "☐", "☐", "☐"],
        ["Professional conduct", "Punctual; models the Staff Code of Conduct; maintains confidentiality; open to feedback.", "☐", "☐", "☐", "☐"],
        ["Professional development", "Attends CPD; applies learning in practice; keeps certification current.", "☐", "☐", "☐", "☐"]]
    t = table(doc, rows, [3.6, 9.3, 0.9, 0.9, 0.9, 0.9], font_size=9, align_center_cols=(2, 3, 4, 5))
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY
    eyebrow(doc, "Appraiser's comments on the standards")
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); c.width = Cm(16.5); cell_borders(c); t.rows[0].height = Cm(3.0)
    heading(doc, "4. Objectives for 2027", 1)
    table(doc, [["Objective (specific and measurable)", "Success measure", "Support needed", "Review date"], ["", "", "", ""], ["", "", "", ""], ["", "", "", ""]], [6.0, 4.5, 3.5, 2.5], font_size=9.5, zebra=False)
    for i in range(1, 4): doc.tables[-1].rows[i].height = Cm(1.6)
    heading(doc, "5. Development plan", 1)
    table(doc, [["Development need", "Activity / course", "By when", "Cost / provider"], ["", "", "", ""], ["", "", "", ""]], [5.0, 5.5, 2.5, 3.5], font_size=9.5, zebra=False)
    for i in range(1, 3): doc.tables[-1].rows[i].height = Cm(1.4)
    heading(doc, "6. Overall assessment", 1)
    checkbox_line(doc, ["Exceeds expectations", "Meets expectations", "Partly meets — support plan agreed", "Does not meet — capability procedure"])
    eyebrow(doc, "Appraisee's comments")
    t = doc.add_table(rows=1, cols=1); c = t.cell(0, 0); c.width = Cm(16.5); cell_borders(c); t.rows[0].height = Cm(2.0)
    doc.add_paragraph()
    signature_block(doc, ["Appraisee", "Appraiser", "Head Teacher", "Date"])
    body(doc, "A copy of the signed form is filed in the personnel file on Google Drive (HR & Staff → Appraisals) and a copy given to the appraisee.", size=9, color=MUTED)
    doc.save(os.path.join(OUT, "Staff_Appraisal_Form_2026.docx"))

# =============================================================================
# 12. Term 3 fee schedule (Excel)
# =============================================================================
def xlsx_fee_schedule():
    wb, ws = wb_new("Fee Schedule")
    r = brand_title(ws, "Fee Schedule — Term 3, 2026", "All amounts in US dollars (USD). Blue figures are inputs set by the Bursar; every other figure is calculated. Assumed amounts are placeholders for the Board to confirm.", 8)
    # inputs
    ws.cell(row=r, column=1, value="Inputs").font = Font(name="Georgia", size=12, bold=True, color=NAVY_HEX); r += 1
    header_row(ws, r, ["Class", "Tuition per term", "Development levy", "Learning materials", "Meals (optional)", "Transport (optional)", "Total (compulsory)", "Total with all options"], [24, 16, 16, 16, 16, 18, 18, 20]); r += 1
    fees = [("ECD A — Sunbeams", 380, 40, 25, 90, 120), ("ECD B — Rainbows", 380, 40, 25, 90, 120), ("Grade 1 — Acacia", 420, 40, 35, 90, 120), ("Grade 2 — Baobab", 420, 40, 35, 90, 120)]
    frow = r
    for name, tu, lv, lm, me, tr in fees:
        data_cell(ws, r, 1, name, bold=True, wrap=False)
        for j, v in enumerate((tu, lv, lm, me, tr), start=2): data_cell(ws, r, j, v, fmt='"$"#,##0', align="right", wrap=False, color="0000FF", fill=F_INPUT)
        data_cell(ws, r, 7, f"=SUM(B{r}:D{r})", fmt='"$"#,##0', align="right", bold=True, wrap=False)
        data_cell(ws, r, 8, f"=SUM(B{r}:F{r})", fmt='"$"#,##0', align="right", wrap=False)
        r += 1
    flast = r - 1
    r += 1
    ws.cell(row=r, column=1, value="Discounts and payment terms").font = Font(name="Georgia", size=12, bold=True, color=NAVY_HEX); r += 1
    terms = [("Sibling discount (2nd and further child, on tuition)", 0.10, "0%"), ("Early-payment discount (paid in full by 4 Sep 2026)", 0.05, "0%"), ("Late-payment surcharge (after 30 Sep 2026)", 0.05, "0%"), ("Instalment plan: number of instalments", 3, "0"), ("Instalment due dates", "4 Sep · 2 Oct · 30 Oct 2026", None)]
    trow = r
    for label, v, fmt in terms:
        data_cell(ws, r, 1, label, wrap=False); ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=5)
        data_cell(ws, r, 6, v, fmt=fmt, align="right", wrap=False, color="0000FF" if fmt else INK_HEX, fill=F_INPUT); r += 1
    sib, early, late, ninst = f"$F${trow}", f"$F${trow + 1}", f"$F${trow + 2}", f"$F${trow + 3}"
    r += 1
    ws.cell(row=r, column=1, value="What a family pays (compulsory fees)").font = Font(name="Georgia", size=12, bold=True, color=NAVY_HEX); r += 1
    header_row(ws, r, ["Class", "Full amount", "Paid in full by 4 Sep", "Per instalment (×3)", "Second child (sibling discount)", "Second child, paid early", "If paid after 30 Sep", ""], height=34); r += 1
    for i in range(frow, flast + 1):
        data_cell(ws, r, 1, fees[i - frow][0], bold=True, wrap=False)
        data_cell(ws, r, 2, f"=G{i}", fmt='"$"#,##0', align="right", wrap=False)
        data_cell(ws, r, 3, f"=G{i}-B{i}*{early}", fmt='"$"#,##0.00', align="right", wrap=False)
        data_cell(ws, r, 4, f"=G{i}/{ninst}", fmt='"$"#,##0.00', align="right", wrap=False)
        data_cell(ws, r, 5, f"=G{i}-B{i}*{sib}", fmt='"$"#,##0.00', align="right", wrap=False)
        data_cell(ws, r, 6, f"=G{i}-B{i}*{sib}-B{i}*{early}", fmt='"$"#,##0.00', align="right", wrap=False)
        data_cell(ws, r, 7, f"=G{i}*(1+{late})", fmt='"$"#,##0.00', align="right", wrap=False)
        r += 1
    r += 1
    ws.cell(row=r, column=1, value="Expected term income (compulsory fees only)").font = Font(name="Georgia", size=12, bold=True, color=NAVY_HEX); r += 1
    header_row(ws, r, ["Class", "Pupils on roll", "Compulsory fee", "Expected income", "", "", "", ""], height=24); r += 1
    irow = r
    counts = {c["name"]: sum(1 for p in PUPILS if p["classId"] == c["id"]) for c in CLASSES}
    for i in range(frow, flast + 1):
        data_cell(ws, r, 1, fees[i - frow][0], bold=True, wrap=False)
        data_cell(ws, r, 2, counts[fees[i - frow][0]], align="center", wrap=False, color="0000FF", fill=F_INPUT)
        data_cell(ws, r, 3, f"=G{i}", fmt='"$"#,##0', align="right", wrap=False)
        data_cell(ws, r, 4, f"=B{r}*C{r}", fmt='"$"#,##0', align="right", wrap=False)
        r += 1
    data_cell(ws, r, 1, "Total", bold=True, fill=F_NAVY50, wrap=False); data_cell(ws, r, 2, f"=SUM(B{irow}:B{r - 1})", align="center", bold=True, fill=F_NAVY50, wrap=False)
    data_cell(ws, r, 3, "", fill=F_NAVY50); data_cell(ws, r, 4, f"=SUM(D{irow}:D{r - 1})", fmt='"$"#,##0', align="right", bold=True, fill=F_NAVY50, wrap=False)
    r += 2
    legend(ws, r, ["Assumptions: fee amounts, discounts and dates are placeholders entered on 14 Sep 2026 for the Board to confirm; they are not yet approved figures. Pupil numbers are from the staff portal roll on the same date.",
                   "Blue = input (change these). Black = formula. Sibling and early-payment discounts apply to tuition only; the late surcharge applies to the whole compulsory fee.",
                   "Fees are payable to the school bank account or at the office. Statements are issued from the Bursar's office; queries to b.ncube@ayandainfantschool.com."], 8)
    print_setup(ws, landscape=False)
    wb.save(os.path.join(OUT, "Term_3_2026_Fee_Schedule.xlsx"))

# =============================================================================
# 13. Budget vs actual 2026 (Excel)
# =============================================================================
def xlsx_budget():
    wb, ws = wb_new("Budget vs Actual")
    r = brand_title(ws, "Budget vs Actual — 2026", "USD. Actuals to 31 August 2026 (Terms 1 and 2 complete, Term 3 not yet invoiced). Blue figures are inputs from the Bursar; variance columns are calculated. Figures are placeholders until the Bursar loads the ledger.", 7)
    header_row(ws, r, ["Line", "Annual budget", "Actual to 31 Aug", "Remaining", "% of budget used", "Expected full year", "Notes"], [34, 16, 18, 16, 16, 18, 40]); r += 1
    def section(title):
        nonlocal r
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=7)
        c = ws.cell(row=r, column=1, value=title); c.font = Font(name="Georgia", size=11, bold=True, color=NAVY_HEX); c.fill = F_GOLD100
        for col in range(1, 8): ws.cell(row=r, column=col).border = BORDER; ws.cell(row=r, column=col).fill = F_GOLD100
        r += 1
    def line(label, budget, actual, expected_formula, note=""):
        nonlocal r
        data_cell(ws, r, 1, label, wrap=False)
        data_cell(ws, r, 2, budget, fmt='"$"#,##0;("$"#,##0);-', align="right", wrap=False, color="0000FF", fill=F_INPUT)
        data_cell(ws, r, 3, actual, fmt='"$"#,##0;("$"#,##0);-', align="right", wrap=False, color="0000FF", fill=F_INPUT)
        data_cell(ws, r, 4, f"=B{r}-C{r}", fmt='"$"#,##0;("$"#,##0);-', align="right", wrap=False)
        data_cell(ws, r, 5, f"=IF(B{r}=0,0,C{r}/B{r})", fmt="0%", align="right", wrap=False)
        data_cell(ws, r, 6, expected_formula.replace("{r}", str(r)), fmt='"$"#,##0;("$"#,##0);-', align="right", wrap=False)
        data_cell(ws, r, 7, note, size=9, color="6B7280")
        r += 1
        return r - 1
    def total(label, rows_, fill=F_NAVY50):
        nonlocal r
        data_cell(ws, r, 1, label, bold=True, fill=fill, wrap=False)
        for col in (2, 3, 4, 6):
            L = get_column_letter(col); data_cell(ws, r, col, "=" + "+".join(f"{L}{x}" for x in rows_), fmt='"$"#,##0;("$"#,##0);-', align="right", bold=True, fill=fill, wrap=False)
        data_cell(ws, r, 5, f"=IF(B{r}=0,0,C{r}/B{r})", fmt="0%", align="right", bold=True, fill=fill, wrap=False)
        data_cell(ws, r, 7, "", fill=fill)
        r += 1
        return r - 1
    section("Income")
    inc = [line("Tuition fees (3 terms)", 71400, 47800, "=C{r}/2*3", "Term 3 invoiced in Sep; 59 pupils on roll"),
           line("Development levy", 7080, 4720, "=C{r}/2*3", "Per pupil per term"),
           line("Learning materials fee", 5310, 3540, "=C{r}/2*3", ""),
           line("Meals and transport (optional)", 22000, 14100, "=C{r}/2*3", "Roughly two-thirds of families opt in"),
           line("Uniform sales", 4500, 3900, "=C{r}", "Mostly sold in Term 1"),
           line("Fundraising and donations", 6000, 2150, "=C{r}+3000", "Prize Giving raffle planned for Nov"),
           line("Registration fees (new admissions)", 1500, 1050, "=C{r}+300", "")]
    inc_t = total("Total income", inc)
    r += 1
    section("Expenditure")
    exp = [line("Salaries and NSSA", 84000, 56000, "=C{r}/8*12", "12 staff; 8 months paid"),
           line("Casual and relief staff", 2400, 1150, "=C{r}/8*12", ""),
           line("Staff training (CPD)", 2500, 1680, "=C{r}+500", "First aid course in March"),
           line("Learning materials and stationery", 6500, 4900, "=C{r}+1200", "Term 3 order placed in Aug"),
           line("Catering (meals programme)", 14000, 9300, "=C{r}/2*3", ""),
           line("Transport (bus running costs)", 9000, 6400, "=C{r}/2*3", "Fuel and service"),
           line("Utilities (electricity, water, internet)", 5400, 3720, "=C{r}/8*12", "ZESA prepaid + borehole pump"),
           line("Repairs and maintenance", 4800, 3950, "=C{r}+600", "Playground resurfacing in April"),
           line("Insurance and licences", 2200, 2200, "=C{r}", "Paid in full in January"),
           line("Administration and bank charges", 1800, 1210, "=C{r}/8*12", "Includes portal hosting"),
           line("Events (Sports Day, Prize Giving)", 3000, 900, "=C{r}+2100", "Both events fall in Term 3"),
           line("Contingency", 3000, 0, "=B{r}", "Held in reserve")]
    exp_t = total("Total expenditure", exp)
    r += 1
    data_cell(ws, r, 1, "Surplus / (deficit)", bold=True, fill=F_GOLD100, wrap=False)
    for col in (2, 3, 4, 6):
        L = get_column_letter(col); data_cell(ws, r, col, f"={L}{inc_t}-{L}{exp_t}", fmt='"$"#,##0;("$"#,##0);-', align="right", bold=True, fill=F_GOLD100, wrap=False)
    data_cell(ws, r, 5, "", fill=F_GOLD100); data_cell(ws, r, 7, "Positive = surplus", fill=F_GOLD100, size=9, color="6B7280")
    surplus_row = r
    r += 2
    red = PatternFill("solid", fgColor="F8E4E1")
    ws.conditional_formatting.add(f"E{exp[0]}:E{exp[-1]}", CellIsRule(operator="greaterThan", formula=["0.75"], fill=red))
    ws.conditional_formatting.add(f"B{surplus_row}:F{surplus_row}", CellIsRule(operator="lessThan", formula=["0"], fill=red))
    legend(ws, r, ["Blue = input. Black = formula. Remaining = budget − actual. \"Expected full year\" projects the year-end figure: termly lines scale 2 terms to 3, monthly lines scale 8 months to 12, one-off lines use the actual plus known commitments.",
                   "Expenditure lines above 75% of budget by 31 August are highlighted so the Bursar can review them before Term 3 commitments.",
                   "All amounts are placeholders entered on 14 Sep 2026 to demonstrate the layout — replace them with figures from the accounting ledger before presenting to the Board."], 7)
    ws.freeze_panes = "B8"; print_setup(ws, landscape=False)
    wb.save(os.path.join(OUT, "Budget_vs_Actual_2026.xlsx"))

# =============================================================================
# 14. Teacher recruitment & interview pack
# =============================================================================
def doc_interview_pack():
    doc = new_doc("Teacher Recruitment & Interview Pack", "The school's process for appointing class teachers and assistant teachers, with the shortlisting criteria, interview questions, scoring sheet and demo-lesson observation form. Owned by HR; approved by the Head Teacher.")
    heading(doc, "1. The process at a glance", 1, 6)
    rows = [["Step", "What happens", "Who", "Timing"],
        ["1  Vacancy approved", "Head Teacher confirms the post, class allocation (main or assistant teacher) and salary band with the Board.", "Head Teacher, Board", "Week 0"],
        ["2  Advertise", "HR places the advert (school website, MoPSE district notice board, teacher WhatsApp groups, Bulawayo press). Advert states qualifications, police clearance requirement and closing date.", "HR", "Weeks 1–2"],
        ["3  Applications logged", "Every application is entered in the portal's Recruitment page with CV, certificates and cover letter saved to Drive (HR & Staff → Recruitment).", "HR", "As received"],
        ["4  Shortlisting", "Head Teacher and HR score applications against the criteria in Section 2. Candidates scoring on all essentials are shortlisted (normally 4–6).", "Head Teacher, HR", "Within 5 days of closing"],
        ["5  Invitations", "Shortlisted candidates receive at least 5 working days' notice with the date, panel, demo-lesson brief and the documents to bring (originals of ID, certificates, police clearance if held).", "HR", "Week 3"],
        ["6  Interview", "45-minute panel interview using the questions in Section 3 and the scoring sheet in Section 4.", "Panel: Head Teacher (chair), Deputy Head or HR, one class teacher", "Week 4"],
        ["7  Demo lesson", "20-minute lesson with the relevant class on a topic set in advance, observed using Section 5. Assistant-teacher candidates lead a 10-minute activity instead.", "Panel + class teacher", "Same day"],
        ["8  Panel decision", "Scores are totalled and the panel agrees a ranked recommendation the same day. Unsuccessful candidates are told within 5 working days.", "Panel", "Same day"],
        ["9  Checks", "Two references (one from the most recent school), police clearance certificate, verification of teaching qualification with the issuing institution, and ID.", "HR", "Before offer"],
        ["10 Offer and contract", "Offer letter from the Head Teacher, then the contract of employment (see template) with the job description and policies.", "Head Teacher, HR", "Within 2 weeks of interview"],
        ["11 Induction", "Safeguarding induction, staff portal account created by HR at the correct tier, class handover with the main teacher, probation objectives set.", "HR, Head Teacher, class teacher", "First week"]]
    t = table(doc, rows, [3.0, 8.0, 3.4, 2.6], font_size=9)
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY
    body(doc, "Safeguarding first: no candidate starts work with pupils before the police clearance and both references are on file. Every panel member has completed the school's safeguarding induction.", size=9.5, italic=True, color=MUTED)
    heading(doc, "2. Shortlisting criteria", 1)
    rows = [["Criterion", "Essential", "Desirable"],
        ["Qualification", "Diploma or Certificate in ECD / Primary Education from a recognised institution (assistant: Certificate in ECD or in progress).", "Degree in Education; specialisation in early literacy or numeracy."],
        ["Experience", "At least 1 year with children aged 3–8 (assistant: 6 months, including volunteering).", "3+ years in an infant department; experience of the Zimbabwe ECD syllabus."],
        ["Safeguarding", "Willing to obtain police clearance; no unexplained gaps in employment history.", "Current paediatric first-aid certificate."],
        ["Languages", "Fluent English; conversational isiNdebele or chiShona.", "Fluent in both isiNdebele and chiShona."],
        ["Application quality", "Complete application with cover letter that addresses the advert.", "Evidence of planning, assessment or displays (portfolio)."]]
    t = table(doc, rows, [3.2, 7.2, 6.6], font_size=9)
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY
    page_break(doc)
    heading(doc, "3. Interview questions", 1, 4)
    body(doc, "Ask every candidate the same core questions in the same order. Probe with follow-ups; note evidence, not impressions. Allow about 5 minutes per section.", size=9.5, color=MUTED)
    qs = [("Opening (5 min)", ["Tell us about your teaching journey and why you applied to Ayanda Infant School.", "What do you know about our school and its motto, \"Where excellence begins\"?"]),
          ("Knowledge of early-years teaching (10 min)", ["Describe how a four-year-old learns best, and give an example of a play-based activity you have led for early number or early reading.", "How do you use the ECD syllabus or Grade 1–2 syllabus to plan a week? What would your weekly plan contain?", "How do you know whether a child has made progress, and how do you record it?"]),
          ("Classroom management and inclusion (10 min)", ["A child in your class refuses to join in and disrupts others most mornings. What do you do in the first week, and what do you do if it continues?", "How would you support a child who is well behind the rest of the class in language, and one who is well ahead?", "Describe how you and an assistant teacher (or main teacher) share the work of a class."]),
          ("Safeguarding and welfare (8 min)", ["A child tells you something that worries you about their home. What do you do, in what order, and who do you tell?", "What would you do if you saw a colleague speak harshly to a child?", "Why do we take the register by 08:15 every day?"]),
          ("Working with parents and colleagues (7 min)", ["A parent is unhappy about a mark on their child's report and comes to see you at the gate. How do you handle it?", "Tell us about a time you received feedback from a senior colleague. What did you change?"]),
          ("Closing (5 min)", ["What are you hoping to learn or develop in your first year with us?", "Do you have any questions for the panel? (Also confirm: notice period, availability for police clearance, and that references may be contacted.)"])]
    for sec, items in qs:
        heading(doc, sec, 2, 8)
        for q in items: bullet(doc, q, 10)
    heading(doc, "4. Interview scoring sheet", 1)
    form_table(doc, [("Candidate", ""), ("Post applied for", "☐ Class Teacher   ☐ Assistant Teacher      Class: ____________"), ("Date and panel", "")], (4.5, 12.0))
    doc.add_paragraph()
    body(doc, "Score each criterion 1–5:  1 No evidence · 2 Limited · 3 Adequate · 4 Strong · 5 Outstanding. Write the evidence that justifies the score.", size=9.5, color=MUTED)
    rows = [["Criterion", "What a 5 looks like", "Score", "Evidence"],
        ["Qualifications and experience", "Relevant qualification; sustained experience with the age group; clear progression.", "", ""],
        ["Early-years pedagogy", "Explains how young children learn; concrete play-based examples; links planning to the syllabus.", "", ""],
        ["Assessment and progress", "Describes simple, regular assessment and how it changes teaching.", "", ""],
        ["Classroom management and inclusion", "Calm, positive strategies; adapts for children behind and ahead; values the teacher–assistant partnership.", "", ""],
        ["Safeguarding awareness", "Reports the same day to the Head Teacher; never promises secrecy; challenges poor practice.", "", ""],
        ["Communication and parents", "Listens, stays professional, resolves calmly; clear spoken English and a home language.", "", ""],
        ["Demo lesson (from Section 5)", "Transfer the demo-lesson score.", "", ""]]
    t = table(doc, rows, [4.0, 6.4, 1.4, 5.2], font_size=9, align_center_cols=(2,))
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY; t.rows[i].height = Cm(1.3)
    form_table(doc, [("Total score (out of 35)", ""), ("Panel recommendation", "☐ Appoint   ☐ Reserve   ☐ Do not appoint"), ("Reasons and any conditions", "\n")], (4.5, 12.0))
    doc.add_paragraph(); signature_block(doc, ["Panel chair", "Panel member", "Panel member", "Date"])
    page_break(doc)
    heading(doc, "5. Demo lesson observation", 1, 4)
    body(doc, "Brief sent with the invitation: teach a 20-minute lesson to [class] on [topic from the current scheme of work]. Resources in the room: whiteboard, counters, picture cards, big books. The class teacher stays in the room.", size=9.5, color=MUTED)
    rows = [["Aspect", "Look for", "1", "2", "3", "4", "5"],
        ["Start and engagement", "Children settled quickly; clear, friendly start; objective shared in child-friendly words.", "☐", "☐", "☐", "☐", "☐"],
        ["Subject knowledge", "Accurate; age-appropriate language; models skills clearly.", "☐", "☐", "☐", "☐", "☐"],
        ["Activity and pace", "Hands-on, play-based; every child active; timing works.", "☐", "☐", "☐", "☐", "☐"],
        ["Questioning and talk", "Open questions; waits for answers; gets children talking in full sentences.", "☐", "☐", "☐", "☐", "☐"],
        ["Behaviour and relationships", "Warm, calm, consistent; praises specifically; redirects without raising voice.", "☐", "☐", "☐", "☐", "☐"],
        ["Checking learning", "Notices who has and hasn't got it; adjusts; ends with a short check.", "☐", "☐", "☐", "☐", "☐"]]
    t = table(doc, rows, [3.6, 8.9, 0.8, 0.8, 0.8, 0.8, 0.8], font_size=9, align_center_cols=(2, 3, 4, 5, 6))
    for i in range(1, len(rows)):
        c = t.cell(i, 0); c.paragraphs[0].runs[0].bold = True; c.paragraphs[0].runs[0].font.color.rgb = NAVY
    form_table(doc, [("Demo lesson score (average of the six, out of 5)", ""), ("Strengths", "\n"), ("Areas to develop", "\n")], (5.5, 11.0))
    heading(doc, "6. Reference check (telephone or email)", 1)
    for q in ["Please confirm the candidate's dates of employment, role and age group taught.", "How would you describe their planning, classroom management and relationships with children?", "Have there been any concerns about their conduct with children, or any disciplinary matters? (Required question.)", "Would you re-employ them? Why or why not?", "Is there anything else we should know before appointing them to work with children aged 3–8?"]:
        bullet(doc, q, 10)
    body(doc, "Record the referee's name, position, organisation, date and the answers on the portal candidate record. Both references must be received before an offer is made.", size=9.5, color=MUTED)
    heading(doc, "7. Fairness statement", 1)
    body(doc, "Ayanda Infant School appoints on merit. Every candidate is asked the same core questions, scored against the same criteria by the same panel, and told the outcome. Adjustments are made for candidates with disabilities on request. Scoring sheets are kept for 12 months on Drive (HR & Staff → Recruitment) and then deleted.", size=10)
    doc.save(os.path.join(OUT, "Teacher_Recruitment_and_Interview_Pack.docx"))

# =============================================================================
if __name__ == "__main__":
    for fn in (doc_letter_template, doc_report_card, doc_grade1_weekly_plan, doc_reading_rubric, doc_admission_form, doc_contract_template, doc_appraisal_form, doc_interview_pack):
        fn(); print("docx ", fn.__name__)
    xlsx_scheme("ECD_A_Scheme_of_Work_Term_3_2026.xlsx", "ECD A — Sunbeams", "", ECD_A); print("xlsx  ECD A scheme")
    xlsx_scheme("ECD_B_Scheme_of_Work_Term_3_2026.xlsx", "ECD B — Rainbows", "", ECD_B); print("xlsx  ECD B scheme")
    for fn in (xlsx_consent_register, xlsx_cpd_register, xlsx_fee_schedule, xlsx_budget):
        fn(); print("xlsx ", fn.__name__)
    print("\nWritten to", OUT)
    for f in sorted(os.listdir(OUT)): print("  ", f, os.path.getsize(os.path.join(OUT, f)) // 1024, "KB")
