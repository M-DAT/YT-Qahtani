"""Classification helpers for the martyr archive."""
import html as htmllib
import re

MARTYR_INCLUDE = [
    "شهيد", "شهداء", "الشهداء", "استشهاد", "شهادة",
    "صناع المجد", "أولئك المقربون", "عظمة العطاء", "لكم الخلود",
    "وصايا", "عين الميدان", "أسطورة الشهادة", "شهيد القرآن",
]
MARTYR_EXCLUDE = [
    "أسطورة الدريهمي", "الدريهمي", "المسلسل الكرتوني", "في قبضة الأمن",
    "أطفال الحافلة", "الميدان الأقدس", "بيان القوات", "صواريخك",
    "الحرب شبابه", "الإنتاج الفني", "اليوم الموعود", "الحرب الناعمة",
    "جاسوس الموساد", "البحر المسجور", "فوق الغارة",
]

AR_KEBAB = re.compile(r"[\u0621-\u064a]{3,}[\u0621-\u064a\u200c\s]*")


def unesc(s):
    if not s:
        return ""
    if isinstance(s, list):
        s = " ".join(s)
    return htmllib.unescape(s).strip()


def clean_title(t):
    t = unesc(t)
    t = re.sub(r"&#\d+;", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def is_martyr(title):
    t = clean_title(title)
    for ex in MARTYR_EXCLUDE:
        if ex in t:
            return False
    for kw in MARTYR_INCLUDE:
        if kw in t:
            return True
    return ("المجاهد" in t or "الخلود" in t) and re.search(r"الجزء\s+ال", t)


def extract_name(title):
    """Return the martyr name (as written) or None."""
    t = clean_title(title)
    m = re.search(
        r"الشهيد[ة]?\s+(?:المجاهد\s+)?([\u0621-\u064a]{3,}"
        r"(?:\s+[\u0621-\u064a]{2,}){1,4})"
        r"(?=[\s\(\u201c\u2215\-–—-]|$)",
        t,
    )
    if m:
        name = m.group(1).strip()
        name = re.sub(r"\s*(?:ابو|أبو)\s+\S*$", "", name)
        name = re.sub(r"\s+", " ", name).strip()
        return name
    if "شهيد القرآن" in t:
        m2 = re.search(r"شهيد\s+القرآن\s+السيد\s+القائد\s+([\u0621-\u064a ]+)", t)
        if m2:
            return m2.group(1).strip()
        m3 = re.search(r"شهيد\s+القرآن\s+(?:السيد|القائد)\s+(.+?)(?=\s*[\(\[\u201c“-–—]|$)", t)
        if m3:
            return m3.group(1).strip()
    return None


def normalize(name):
    if not name:
        return ""
    n = unesc(name)
    n = re.sub(r"\([^)]*\)", " ", n)
    n = re.sub(r"[\(\)\[\].،\"“”',]", " ", n)
    n = re.sub(r"\s+", " ", n)
    n = (n.replace("أ", "ا").replace("إ", "ا").replace("آ", "ا").replace("ٱ", "ا")
          .replace("ؤ", "و").replace("ئ", "ي").replace("ة", "ه"))
    return re.sub(r"\s+", " ", n).strip()


def fs_safe(name, limit=140):
    out = re.sub(r"[\\/:*?\"<>|\x00-\x1f]", "_", name).strip().strip("._")
    out = re.sub(r"\s+", " ", out)
    if len(out) > limit:
        out = out[:limit].rstrip(" ._")
    return out or "untitled"