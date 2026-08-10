import json
import os
import re
import time
import hashlib

import requests

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://www.mmy.ye"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
SESSION = requests.Session()
SESSION.headers.update({
    "User-Agent": UA,
    "Accept-Language": "ar,en;q=0.8",
    "Referer": SITE,
})

MIN_DELAY = 1.2
MAX_DELAY = 3.5
_last_request = 0.0


def polite_get(url, retries=4, timeout=45):
    """GET with rate limiting and exponential backoff retries."""
    global _last_request
    for attempt in range(retries):
        wait = MIN_DELAY + ((_last_request + MIN_DELAY - time.time()) if time.time() < _last_request + MIN_DELAY else 0)
        if wait > 0:
            time.sleep(min(wait, MAX_DELAY))
        try:
            resp = SESSION.get(url, timeout=timeout)
            _last_request = time.time()
            if resp.status_code in (403, 429, 500, 502, 503, 504):
                backoff = (attempt + 1) * 5
                time.sleep(backoff)
                continue
            return resp
        except requests.RequestException:
            time.sleep((attempt + 1) * 4)
    return None


def polite_head(url, retries=3, timeout=30):
    global _last_request
    for attempt in range(retries):
        wait = MIN_DELAY + ((_last_request + MIN_DELAY - time.time()) % MIN_DELAY)
        if wait > 0:
            time.sleep(wait)
        try:
            resp = SESSION.head(url, timeout=timeout, allow_redirects=True)
            _last_request = time.time()
            if resp.status_code in (403, 429, 500, 502, 503, 504):
                time.sleep((attempt + 1) * 4)
                continue
            return resp
        except requests.RequestException:
            time.sleep((attempt + 1) * 3)
    return None


UNSAFE = re.compile(r'[\\/:*?"<>|\x00-\x1f]')


def sanitize(name, max_len=120):
    out = UNSAFE.sub("_", name).strip().strip("._")
    out = re.sub(r"\s+", " ", out)
    if len(out) > max_len:
        out = out[:max_len].rstrip(" ._")
    return out or "untitled"


def guess_martyr_from_title(title):
    """Try to extract the martyr name from a title like:
       'شهداء الميدان | الشهيد X ...' or 'صناع المجد – الشهيد X'
    """
    t = re.sub(r"\s+", " ", title).strip()
    for pat in [
        r"الشهيد[ة]?\s+[\u0621-\u064a]{3,}\s+[\u0621-\u064a]{3,}(?:\s+[\u0621-\u064a]{3,})?",
        r"الشهيد\s+[\u0621-\u064a]{3,}(?:\s+[\u0621-\u064a]{3,})?",
        r"عظمه\s+العطاء[^|\-–—]*",
        r"لكم\s+الخلود[^|\-–—]*",
    ]:
        m = re.search(pat, t)
        if m:
            name = re.sub(r"[^\w\u0621-\u064a\s]", "", m.group(0)).strip()
            name = re.sub(r"\s+", " ", name)
            if len(name) <= 60:
                return name
    return None


def load_json(path, default):
    try:
        with open(path, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return default


def save_json(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


def file_sha1(path, chunk=1024 * 1024):
    h = hashlib.sha1()
    with open(path, "rb") as fh:
        while True:
            block = fh.read(chunk)
            if not block:
                break
            h.update(block)
    return h.hexdigest()


def quality_rank(label):
    label = str(label or "").lower()
    for i, q in enumerate(["4k", "2160", "1440", "1080", "720", "480", "360", "240", "180"]):
        if q in label:
            return i
    return 99


def select_best_source(sources):
    """Return the source with highest quality from [{label, url}, ...]."""
    if not sources:
        return None
    best = min(sources, key=lambda s: quality_rank(s.get("label", "")))
    return best