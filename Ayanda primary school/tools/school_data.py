"""Python port of the portal's seed generator (js/data.py) so documents use the same pupils."""
CLASSES = [
    {"id": "c1", "name": "ECD A — Sunbeams", "grade": "ECD A", "room": "Room 1", "teacherId": None, "assistantId": None},
    {"id": "c2", "name": "ECD B — Rainbows", "grade": "ECD B", "room": "Room 2", "teacherId": None, "assistantId": None},
    {"id": "c3", "name": "Grade 1 — Acacia", "grade": "Grade 1", "room": "Room 3", "teacherId": None, "assistantId": None},
    {"id": "c4", "name": "Grade 2 — Baobab", "grade": "Grade 2", "room": "Room 4", "teacherId": None, "assistantId": None},
]
STAFF = [
    # One placeholder account. Real staff are added in the portal; nothing about
    # a real teacher belongs in a file that ships with the software.
    {"id": "s01", "first": "Head", "last": "Teacher", "title": "", "role": "head",
     "email": "head@ayandainfantschool.com", "phone": "", "started": ""},
]

def _imul(a, b):
    return ((a & 0xFFFFFFFF) * (b & 0xFFFFFFFF)) & 0xFFFFFFFF

def _to_i32(x):
    x &= 0xFFFFFFFF
    return x - 0x100000000 if x & 0x80000000 else x

def mulberry32(seed):
    a = seed & 0xFFFFFFFF
    def rnd():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = _imul(a ^ (a >> 15), 1 | a)
        t = (t + _imul(t ^ (t >> 7), 61 | t)) ^ t
        t &= 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rnd

def build_pupils():
    """No children ship with the software. The roll is entered by the school,
    and every document that lists pupils is generated from it at that point."""
    return []

def staff_by_id(sid):
    return next(s for s in STAFF if s["id"] == sid)

if __name__ == "__main__":
    ps = build_pupils()
    for p in ps[:3] + ps[-2:]:
        print(p["admissionNo"], p["first"], p["last"], p["gender"], p["dob"], p["guardian"], p["medical"]["allergies"])
