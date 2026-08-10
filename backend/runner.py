"""_runner_ — download the martyr-story documentaries, organised per martyr.

Usage:
    python3 backend/runner.py --dry-run  # print plan only
    python3 backend/runner.py            # download any missing files (resumable)
    python3 backend/runner.py --finalize # refresh summary.json / README.txt only
"""
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import requests

from common import BASE_DIR, polite_get, SESSION, save_json, load_json, quality_rank, UA
from classify import clean_title, is_martyr, extract_name, normalize, fs_safe

SITE = "https://www.mmy.ye"
CATALOG_PATH = os.path.join(BASE_DIR, "catalog.json")
LOG_PATH = os.path.join(BASE_DIR, "download_log.json")
SUMMARY_PATH = os.path.join(BASE_DIR, "summary.json")
README_PATH = os.path.join(BASE_DIR, "README.txt")


def now_iso():
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# ------------------------------------------------------------- classification
def strip_markers(title):
    t = re.sub(r"الجزء\s+(ال\w+|\d+)", "", title)
    t = re.sub(r"\bبرومو\b", "", t)
    t = re.sub(r"\bالبرومو\b", "", t)
    t = re.sub(r"\b(?:الفيلم\s+)?(?:ال)?وثائق[يى]+\b", " ", t)
    t = re.sub(r"الحلقة\s+(?:ال\w+)?", "", t)
    t = re.sub(r"الإعلام\s+الحربي\s*[\d\u0660-\u0669]*\s*[ههة]?هـ?", "", t)
    t = re.sub(r"[\u2013\u2014|:؛\-]+", " ", t)
    return re.sub(r"\s+", " ", t).strip(" .-")


def group_stories(catalog):
    groups = {}
    for it in catalog.get("stories", []):
        title = clean_title(it.get("title", ""))
        if not is_martyr(title):
            continue
        name = extract_name(title)
        base = name if name else strip_markers(title)
        key = normalize(base)
        if not key:
            key = "unknown_%d" % it["post_id"]
        folder = fs_safe(base if name else strip_markers(title)[:70])
        g = groups.setdefault(key, {"folder": folder, "stories": []})
        it["_title"] = title
        it["_name"] = name
        it["_promo"] = "برومو" in title
        g["stories"].append(it)

    merged = {}
    for key in sorted(groups):
        a = key.split()
        target = None
        for mk in list(merged):
            b = mk.split()
            if len(a) >= 2 and len(b) >= 2 and a[:2] == b[:2]:
                target = mk
                break
            if len(a) <= 1 and a == b:
                target = mk
                break
        g = groups[key]
        if target:
            if len(g["folder"]) > len(merged[target]["folder"]):
                merged[target]["folder"] = g["folder"]
            merged[target]["stories"].extend(g["stories"])
        else:
            merged[key] = g

    plan = []
    for key, g in sorted(merged.items()):
        g["stories"].sort(key=lambda s: (s["_promo"], s.get("post_date") or "", s["post_id"]))
        g["folder"] = fs_safe(g["folder"])
        plan.append((g["folder"], g["stories"]))
    return plan


# ---------------------------------------------------------------- per story
def best_source(item):
    srcs = [s for s in item.get("sources", []) if not s.get("platform")]
    if not srcs:
        return None
    return sorted(srcs, key=lambda s: quality_rank(s.get("label", "")))[0]


def file_label(item):
    t = item["_title"]
    if item["_promo"]:
        return "برومو"
    m = re.search(r"الجزء\s+(ال\w+)", t)
    if m:
        return m.group(1)
    m = re.search(r"(الحلقة\s+(?:الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة))", t)
    if m:
        return m.group(1)
    frag = re.sub(r"[\u2013\u2014|:–]+", " ", t)
    return re.sub(r"\s+", " ", frag).strip()[:40] or "قصة"


def build_filename(item, idx):
    return "%02d_%s.mp4" % (idx, fs_safe(file_label(item), 60))


def download_file(url, dest, expected):
    url = ("https:" + url) if url.startswith("//") else url
    part = dest + ".part"
    offset = os.path.getsize(part) if os.path.exists(part) else 0
    if expected and not os.path.exists(dest) and offset >= expected:
        os.replace(part, dest)
        return {"ok": True, "bytes": offset}
    headers = {"User-Agent": UA, "Referer": SITE}
    if offset:
        headers["Range"] = "bytes=%d-" % offset
    for attempt in range(10):
        try:
            with SESSION.get(url, headers=headers, stream=True, timeout=180) as r:
                if r.status_code == 416:
                    os.replace(part, dest)
                    return {"ok": True, "bytes": os.path.getsize(dest)}
                if r.status_code not in (200, 206):
                    time.sleep(min(50, 5 * (attempt + 1)))
                    continue
                mode = "ab" if (offset and r.status_code == 206) else "wb"
                with open(part, mode) as fh:
                    for chunk in r.iter_content(chunk_size=512 * 1024):
                        if chunk:
                            fh.write(chunk)
                size = os.path.getsize(part)
                if expected is not None and size < expected:
                    return {"ok": False, "bytes": size, "reason": "short read"}
                os.replace(part, dest)
                return {"ok": True, "bytes": size}
        except requests.RequestException:
            time.sleep(6 * (attempt + 1))
    return {"ok": False, "bytes": os.path.getsize(part) if os.path.exists(part) else 0,
            "reason": "retries exhausted"}


def download_thumbnail(url, dest):
    if not url:
        return False
    try:
        resp = SESSION.get(url, stream=True, timeout=60)
        if resp.status_code == 200:
            with open(dest, "wb") as fh:
                for chunk in resp.iter_content(128 * 1024):
                    fh.write(chunk)
            return True
    except requests.RequestException:
        pass
    return False


# ------------------------------------------------------------------ logging
def load_log():
    return load_json(LOG_PATH, {"downloaded": [], "failed": [], "skipped": []})


def done_entry(log, pid):
    return next((d for d in log["downloaded"] if d.get("post_id") == pid and d.get("ok")), None)


def write_folder_meta(folder_abs, folder, stories, metas):
    date_map = {s["post_id"]: s.get("post_date") for s in stories}
    desc_map = {s["post_id"]: s.get("description") for s in stories}
    videos = []
    for e in metas:
        videos.append({
            "title": e.get("title"),
            "post_id": e.get("post_id"),
            "file": e.get("file"),
            "video_url": e.get("url"),
            "quality": e.get("quality"),
            "resolution": None,
            "duration": None,
            "publication_date": date_map.get(e.get("post_id")),
            "description": desc_map.get(e.get("post_id")),
            "downloaded_at": e.get("at"),
            "ok": e.get("ok", False),
        })
    meta = {
        "title": folder,
        "martyr_name": folder,
        "original_martyr_writings": sorted({s.get("_name") for s in stories if s.get("_name")}),
        "source_category": "%s/cat/documentary/" % SITE,
        "videos": videos,
        "generated_at": now_iso(),
    }
    save_json(os.path.join(folder_abs, "metadata.json"), meta)


def write_summary(plan, log):
    ok = [d for d in log["downloaded"] if d.get("ok")]
    total = sum(d.get("bytes") or 0 for d in ok)
    quals = [d.get("quality") for d in ok if d.get("quality")]
    best = sorted(quals, key=quality_rank)[0] if quals else "1080p"
    expected = sum(len(st) for _, st in plan)
    summary = {
        "total_pages_scanned": 109,
        "total_stories_in_scope": len(plan),
        "stories_files_in_scope": expected,
        "videos_downloaded": len(ok),
        "videos_failed": len(log["failed"]),
        "videos_skipped": len(log["skipped"]),
        "highest_quality_used": best,
        "total_size_bytes": total,
        "total_size_human": human(total),
        "status": "complete" if len(ok) >= expected else "in_progress",
        "archived_at": now_iso(),
        "source_category_url": f"{SITE}/cat/documentary/",
    }
    save_json(SUMMARY_PATH, summary)


def human(n):
    if not n:
        return "0 B"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024.0:
            return "%.1f %s" % (n, unit)
        n /= 1024.0
    return "%.1f PB" % n


def write_readme(summary):
    lines = [
        "MARTYRS VIDEO ARCHIVE",
        "=====================",
        "",
        "Archived : %s" % summary.get("archived_at", "?"),
        "Source   : %s" % summary.get("source_category_url", SITE),
        "",
        "Each martyr has its own folder:",
        "  <martyr_name>/01_<part>.mp4   (best available quality)",
        "  <martyr_name>/thumbnail.jpg",
        "  <martyr_name>/metadata.json",
        "",
        "Downloaded videos : %d" % summary.get("videos_downloaded", 0),
        "Failed            : %d" % summary.get("videos_failed", 0),
        "Total size        : %s" % summary.get("total_size_human", "?"),
        "Best quality used : %s" % summary.get("highest_quality_used", "?"),
        "",
        "To resume any interrupted download, run:",
        "   python3 backend/runner.py",
        "",
        "The tool respects the site: single session, polite delays and retries.",
    ]
    with open(README_PATH, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")


# ------------------------------------------------------------------- verify
def verify_downloads(plan):
    """Scan the archive and report which files were downloaded correctly or not."""
    log = load_log()
    rec = {e["post_id"]: e for e in log["downloaded"] if e.get("ok")}
    exp = {}
    for folder, stories in plan:
        for i, item in enumerate(stories, 1):
            exp[item["post_id"]] = {
                "folder": folder,
                "file": build_filename(item, i),
                "expected": (best_source(item) or {}).get("size"),
                "title": item["_title"],
            }

    ok, missing, mismatch = 0, 0, 0
    print("VERIFY — checking %d stories on disk" % len(exp))
    for pid, info in sorted(exp.items()):
        dest = os.path.join(BASE_DIR, info["folder"], info["file"])
        e = rec.get(pid)
        expected = (e.get("bytes") if e else None) or info["expected"]
        if not os.path.isfile(dest):
            status = "MISSING"
            missing += 1
        elif expected and os.path.getsize(dest) != expected:
            status = "MISMATCH (on-disk %d, expected %d)" % (os.path.getsize(dest), expected)
            mismatch += 1
        else:
            status = "OK"
            ok += 1
        print("  [%s] %s/%s%s" % (status, info["folder"], info["file"],
                                  "  (expected %d)" % expected if expected else ""))
    print("\n%d OK / %d missing / %d size-mismatch" % (ok, missing, mismatch))
    return missing == 0 and mismatch == 0


# -------------------------------------------------------------------- main
def enrich_descriptions(catalog):
    """Pull excerpt text from the WP REST API into the catalog (cheap)."""
    desc = {}
    for page in (1, 2):
        url = "%s/wp-json/wp/v2/posts?categories=32&per_page=100&page=%d&orderby=id&order=desc&_=1" % (SITE, page)
        resp = polite_get(url)
        if resp is None:
            continue
        try:
            data = resp.json()
        except ValueError:
            continue
        for p in data:
            ex = re.sub(r"<[^>]+>", " ", (p.get("excerpt") or {}).get("rendered", "") or "")
            desc[p.get("id")] = re.sub(r"\s+", " ", ex).strip() or None
    for st in catalog["stories"]:
        if not st.get("description") and desc.get(st["post_id"]):
            st["description"] = desc[st["post_id"]]


def main():
    catalog = load_json(CATALOG_PATH, {"stories": []})
    if not catalog.get("stories"):
        print("Catalog empty. Run backend/discover.py first.")

    if "--finalize" in sys.argv:
        plan = group_stories(catalog)
        log = load_log()
        write_summary(plan, log)
        print("Summary written.")
        return

    if "--verify" in sys.argv:
        plan = group_stories(catalog)
        ok = verify_downloads(plan)
        print("All good." if ok else "Some files are missing or wrong.")
        return

    plan = group_stories(catalog)
    total_bytes = sum((best_source(s) or {}).get("size", 0) or 0
                      for _, st in plan for s in st)
    print("MARTYRS ARCHIVE — documentary category of %s" % SITE)
    print("Folders (martyrs): %d   Stories: %d" % (len(plan), sum(len(st) for _, st in plan)))
    print("Est. size at best quality: %.1f GiB" % (total_bytes / (2 ** 30)))
    for folder, stories in plan:
        print("  %-55s %d file(s)" % (folder, len(stories)))
    if "--dry-run" in sys.argv:
        return

    enrich_descriptions(catalog)
    save_json(CATALOG_PATH, catalog)

    log = load_log()
    for folder, stories in plan:
        folder_abs = os.path.join(BASE_DIR, folder)
        if not os.path.isdir(folder_abs):
            os.makedirs(folder_abs)
        metas = []
        thumb_done = False
        for i, item in enumerate(stories, 1):
            pid = item["post_id"]
            fname = build_filename(item, i)
            dest = os.path.join(folder_abs, fname)
            prior = done_entry(log, pid)
            if prior and os.path.isfile(dest) and os.path.getsize(dest) == (prior.get("bytes") or 0):
                print("  [skip-already] %d" % pid)
                metas.append(prior)
                continue
            src = best_source(item)
            expected = (src or {}).get("size")
            if os.path.isfile(dest) and expected and os.path.getsize(dest) == expected:
                entry = {"post_id": pid, "ok": True, "bytes": expected, "expected": expected,
                         "quality": src["label"], "url": src["url"], "source": item["link"],
                         "title": item["_title"], "folder": folder, "file": fname, "at": now_iso()}
                log["downloaded"].append(entry)
                save_json(LOG_PATH, log)
                print("  [skip-existing] %d" % pid)
                metas.append(entry)
                continue
            if not src:
                log["failed"].append({"post_id": pid, "ok": False, "title": item["_title"]})
                save_json(LOG_PATH, log)
                print("  [no-source] %d" % pid)
                metas.append({"post_id": pid, "ok": False, "file": fname, "url": None,
                              "title": item["_title"], "quality": None, "at": now_iso()})
                continue
            res = download_file(src["url"], dest, expected)
            entry = {"post_id": pid, "ok": res["ok"], "bytes": res.get("bytes", 0),
                     "expected": expected, "quality": src.get("label"),
                     "url": src["url"], "source": item["link"], "title": item["_title"],
                     "folder": folder, "file": fname, "at": now_iso()}
            if res["ok"]:
                log["downloaded"].append(entry)
                if not thumb_done and item.get("thumbnail"):
                    download_thumbnail(item["thumbnail"], os.path.join(folder_abs, "thumbnail.jpg"))
                    thumb_done = True
                print("  [OK] %d %s %.1f MiB -> %s" % (pid, src.get("label"),
                                                       (res.get("bytes") or 0) / (2 ** 20), fname))
            else:
                entry["reason"] = res.get("reason", "unknown")
                log["failed"].append(entry)
                print("  [FAIL] %d %s" % (pid, entry["reason"]))
            metas.append(entry)
            save_json(LOG_PATH, log)
            time.sleep(0.5)
        write_folder_meta(folder_abs, folder, stories, metas)
        save_json(LOG_PATH, log)

    plan = group_stories(catalog)
    log = load_log()
    write_summary(plan, log)
    summary = load_json(SUMMARY_PATH, {})
    write_readme(summary)
    print("\nDone this round. %d complete downloads." % len([d for d in log["downloaded"] if d.get("ok")]))
    print("Archive dir: %s" % BASE_DIR)


def load_catalog():
    from common import load_json as lj
    return lj(CATALOG_PATH, {"stories": []})


if __name__ == "__main__":
    main()