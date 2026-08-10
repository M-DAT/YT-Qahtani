#!/usr/bin/env python3
"""web.py — professional web UI for browsing & downloading mmy.ye media.

Features:
  * category filter (zawamil, films, documentaries, martyrs, news, …)
  * live search, paginated grid with thumbnails
  * per-video quality picker (240p…1080p+) + "best"
  * playlist queue with background downloads, resume and progress

Usage:
    python3 tools/web.py [--port 8080]     # then open http://127.0.0.1:8080
"""
import html
import json
import os
import re
import sys
import threading
import time
import uuid
from itertools import chain
from urllib.parse import quote

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, Response, jsonify, request, send_from_directory

from common import BASE_DIR, SESSION, SITE, UA, save_json, load_json, polite_get, quality_rank
from classify import fs_safe
from discover import fetch_categories, extract_video_sources, extract_thumbnail, extract_description, probe_sizes

STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")
FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend", "dist"
)
CATALOG_PATH = os.path.join(BASE_DIR, "catalog.json")
CATEGORIES_PATH = os.path.join(BASE_DIR, "categories.json")
LIBRARY_PATH = os.path.join(BASE_DIR, "library_log.json")

app = Flask(__name__, static_folder=None)

_lock = threading.Lock()
_JOBS = {}

UNSAFE_URL = re.compile(r"\\u([0-9a-fA-F]{4})")


def fix_url(u):
    if not u:
        return u
    u = u.replace("\\/", "/")
    return UNSAFE_URL.sub(lambda m: chr(int(m.group(1), 16)), u)


def load_library():
    return load_json(LIBRARY_PATH, {"items": []})


def save_library(data):
    save_json(LIBRARY_PATH, data)


def done_ids():
    return {e.get("post_id") for e in load_library().get("items", []) if e.get("ok")}


# ---------------------------------------------------------------- categories
def get_cats():
    cats = load_json(CATEGORIES_PATH, [])
    if not cats:
        try:
            d = fetch_categories()
            cats = sorted(d.values(), key=lambda c: -c["count"])
        except Exception:
            return []
    return [c for c in cats if c.get("name") not in ("غير مصنف", "مميز")]


CAT_MAP = None


def cat_map():
    global CAT_MAP
    if CAT_MAP is None:
        CAT_MAP = {c["id"]: c for c in get_cats()}
    return CAT_MAP


# ------------------------------------------------------------------- catalog
def load_catalog():
    return load_json(CATALOG_PATH, {"stories": []})


def save_catalog(catalog):
    save_json(CATALOG_PATH, catalog)


def get_story(pid):
    """Return the story dict for pid; if absent in catalog, pull it from the
    WP REST API (title/link/category/thumbnail) and cache it."""
    catalog = load_catalog()
    story = next((s for s in catalog["stories"] if s["post_id"] == pid), None)
    if story is not None:
        return story
    resp = polite_get("https://www.mmy.ye/wp-json/wp/v2/posts/%d?_embed" % pid)
    if resp is None or resp.status_code != 200:
        return None
    p = resp.json()
    cid = next((c for c in (p.get("categories") or []) if c in cat_map()), None)
    cats = cat_map()
    emb = p.get("_embedded") or {}
    fm = (emb.get("wp:featuredmedia") or [{}])[0]
    story = {
        "post_id": pid,
        "title": clean_title((p.get("title") or {}).get("rendered")),
        "post_date": p.get("date"),
        "link": p.get("link"),
        "thumbnail": fix_url(fm.get("source_url") or ""),
        "description": None,
        "category_id": cid,
        "category_name": cats.get(cid, {}).get("name") if cid else None,
        "sources": [],
    }
    with _lock:
        catalog = load_catalog()
        if not any(s["post_id"] == pid for s in catalog["stories"]):
            catalog["stories"].append(story)
        else:
            story = next(s for s in catalog["stories"] if s["post_id"] == pid)
        save_catalog(catalog)
    return story


def ensure_sources(pid, link, title=None):
    """Return the story dict for pid, fetching page sources on demand (cached)."""
    with _lock:
        catalog = load_catalog()
        story = next((s for s in catalog["stories"] if s["post_id"] == pid), None)
        if story is None:
            story = {"post_id": pid, "title": title or "", "link": link or "",
                     "sources": [], "thumbnail": None, "description": None}
            catalog["stories"].append(story)
            save_catalog(catalog)
        if story.get("sources"):
            if any(not s.get("size") for s in story["sources"] if not s.get("platform")):
                probe_sizes(story["sources"])
                save_catalog(catalog)
            return dict(story)
        html_page = polite_get(link) if link else None
        if html_page is None:
            return dict(story)
        body = html_page.text
        story["sources"] = extract_video_sources(body)
        if any(not s.get("size") for s in story["sources"] if not s.get("platform")):
            probe_sizes(story["sources"])
        if not story.get("thumbnail"):
            story["thumbnail"] = fix_url(extract_thumbnail(body))
        if not story.get("description"):
            story["description"] = extract_description(body)
        save_catalog(catalog)
        return dict(story)


def pick_source(sources, quality):
    usable = [s for s in (sources or []) if not s.get("platform")]
    if not usable:
        return None
    if quality == "embed":
        return next((s for s in sources if s.get("platform")), None)
    if not quality or quality == "best":
        return min(usable, key=lambda s: quality_rank(s.get("label", "")))
    exact = [s for s in usable if (s.get("label") or "").lower() == quality.lower()]
    if exact:
        return exact[0]
    rq = quality_rank(quality)
    better = [s for s in usable if quality_rank(s.get("label", "")) <= rq]
    if better:
        return min(better, key=lambda s: quality_rank(s.get("label", "")))
    return min(usable, key=lambda s: quality_rank(s.get("label", "")))


def clean_title(t):
    t = html.unescape(re.sub(r"<[^>]+>", " ", t or ""))
    return re.sub(r"\s+", " ", t).strip()


# ----------------------------------------------------------------- streaming
def stream_to_file(url, dest, expected, progress):
    part = dest + ".part"
    offset = os.path.getsize(part) if os.path.exists(part) else 0
    if expected and not os.path.exists(dest) and offset >= expected:
        os.replace(part, dest)
        progress(offset, offset)
        return True, offset
    headers = {"User-Agent": UA, "Referer": SITE}
    if offset:
        headers["Range"] = "bytes=%d-" % offset
    for attempt in range(8):
        try:
            with SESSION.get(url, headers=headers, stream=True, timeout=180) as r:
                if r.status_code == 416:
                    os.replace(part, dest)
                    size = os.path.getsize(dest)
                    progress(size, size)
                    return True, size
                if r.status_code not in (200, 206):
                    time.sleep(min(30, 5 * (attempt + 1)))
                    continue
                mode = "ab" if (offset and r.status_code == 206) else "wb"
                total = expected or int(r.headers.get("Content-Length") or 0) or 0
                done = offset if (offset and r.status_code == 206) else 0
                with open(part, mode) as fh:
                    for chunk in r.iter_content(chunk_size=512 * 1024):
                        if chunk:
                            fh.write(chunk)
                            done += len(chunk)
                            progress(done, total)
                if total and done < total:
                    progress(done, total)
                    return False, done
                os.replace(part, dest)
                progress(done, done)
                return True, done
        except Exception:
            time.sleep(6 * (attempt + 1))
    return False, os.path.getsize(part) if os.path.exists(part) else 0


# --------------------------------------------------------------------- routes
@app.route("/")
def index():
    if os.path.isdir(FRONTEND_DIST):
        return send_from_directory(FRONTEND_DIST, "index.html")
    return send_from_directory(STATIC_DIR, "index.html")


@app.route("/assets/<path:name>")
def frontend_assets(name):
    return send_from_directory(os.path.join(FRONTEND_DIST, "assets"), name)


@app.route("/favicon.svg")
def frontend_favicon():
    return send_from_directory(FRONTEND_DIST, "favicon.svg")


@app.route("/icons.svg")
def frontend_icons():
    return send_from_directory(FRONTEND_DIST, "icons.svg")


@app.route("/static/<path:name>")
def static_files(name):
    return send_from_directory(STATIC_DIR, name)


@app.route("/api/meta")
def meta():
    return jsonify(categories=get_cats())


@app.route("/api/refresh_cats")
def refresh_cats():
    global CAT_MAP
    try:
        d = fetch_categories()
        CAT_MAP = None
        return jsonify(ok=True, categories=sorted(d.values(), key=lambda c: -c["count"]))
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/browse")
def browse():
    ids = [int(x) for x in (request.args.get("cat") or "").split(",") if x.strip()]
    if not ids:
        return jsonify(error="اختر تصنيفاً واحداً على الأقل"), 400
    page = max(1, int(request.args.get("page", 1)))
    per_page = 24
    q = (request.args.get("q") or "").strip()
    url = (f"https://www.mmy.ye/wp-json/wp/v2/posts?categories={','.join(map(str, ids))}"
           f"&per_page={per_page}&page={page}&orderby=date&order=desc&_embed")
    if q:
        url += "&search=" + quote(q)
    resp = polite_get(url)
    if resp is None:
        return jsonify(error="تعذر الوصول إلى الموقع"), 502
    try:
        data = resp.json()
    except ValueError:
        return jsonify(error="استجابة غير صالحة"), 502
    total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
    cats = cat_map()
    cached = {s["post_id"]: s for s in load_catalog()["stories"]}
    done = done_ids()
    items = []
    for p in data:
        pid = p.get("id")
        cid = next((c for c in (p.get("categories") or []) if c in cats), None)
        cat = cats.get(cid, {}).get("name") if cid else None
        emb = p.get("_embedded") or {}
        fm = (emb.get("wp:featuredmedia") or [{}])[0]
        thumb = fm.get("source_url") or (p.get("thumbnail") or "")
        cs = cached.get(pid)
        items.append({
            "id": pid,
            "title": clean_title((p.get("title") or {}).get("rendered")),
            "date": (p.get("date") or "")[:10],
            "category": cat,
            "thumb": fix_url(thumb),
            "sources": cs.get("sources") if cs else None,
            "status": "done" if pid in done else "queued" if _in_job(pid) else "",
        })
    return jsonify(items=items, more=page < total_pages, page=page)


def _in_job(pid):
    for job in _JOBS.values():
        for it in job["items"]:
            if it["id"] == pid and it["status"] in ("dl", "queued"):
                return True
    return False


@app.route("/media/<path:filepath>")
def media_file(filepath):
    return send_from_directory(BASE_DIR, filepath)


@app.route("/stream/<int:pid>/<int:qi>")
def stream_video(pid, qi):
    story = next((s for s in load_catalog()["stories"] if s["post_id"] == pid), None)
    if not story:
        return "غير موجود", 404
    story = ensure_sources(pid, story.get("link"), story.get("title"))
    srcs = [s for s in story.get("sources", []) if not s.get("platform")]
    if qi >= len(srcs):
        return "جودة غير صالحة", 404
    src = srcs[qi]
    url = fix_url(src.get("url", ""))
    if not url:
        return "لا رابط", 400
    headers = {"User-Agent": UA, "Referer": SITE}
    rng = request.headers.get("Range")
    if rng:
        headers["Range"] = rng
    try:
        resp = SESSION.get(url, headers=headers, stream=True, timeout=180)
        if resp.status_code in (403, 429, 500, 502, 503, 504):
            return "source error: %d" % resp.status_code, resp.status_code
        chunker = resp.iter_content(512 * 1024)
        r = Response(chunker, status=resp.status_code, content_type=resp.headers.get("Content-Type", "video/mp4"))
        for h in ("Content-Range", "Content-Length"):
            if resp.headers.get(h):
                r.headers[h] = resp.headers[h]
        r.headers["Accept-Ranges"] = "bytes"
        return r
    except Exception as e:
        return jsonify(error=str(e)), 500


@app.route("/api/post/<int:pid>")
def post_detail(pid):
    story = get_story(pid)
    if story is None:
        return jsonify(error="غير موجود"), 404
    story = ensure_sources(pid, story.get("link"), story.get("title"))

    lib = load_library()
    item = next((e for e in lib.get("items", []) if e.get("post_id") == pid and e.get("ok")), None)
    local_file = item.get("file") if item else None

    srcs = []
    for idx, s in enumerate(story.get("sources", [])):
        if s.get("platform"):
            src_url = fix_url(s.get("url"))
        elif local_file and os.path.exists(os.path.join(BASE_DIR, local_file)):
            src_url = "/media/" + quote(local_file)
        else:
            src_url = fix_url(s.get("url")) or f"/stream/{pid}/{idx}"

        srcs.append({
            "label": s.get("label", "mp4"),
            "size_h": human(s.get("size") or 0),
            "platform": bool(s.get("platform")),
            "url": src_url
        })
    return jsonify(id=pid, sources=srcs)


@app.route("/api/playlist", methods=["POST"])
def playlist():
    body = request.get_json(force=True) or {}
    quality = body.get("quality") or "best"
    items = body.get("items") or []
    if not items:
        return jsonify(error="لا عناصر"), 400
    job_id = uuid.uuid4().hex[:8]
    job = {"quality": quality, "done": False, "items": []}
    for it in items:
        job["items"].append({"id": int(it.get("id")), "quality": it.get("quality") or quality,
                             "status": "queued", "bytes": 0, "total": 0, "error": None,
                             "out": None, "title": ""})
    _JOBS[job_id] = job
    threading.Thread(target=_worker, args=(job_id,), daemon=True).start()
    return jsonify(job_id=job_id)


def _worker(job_id):
    job = _JOBS.get(job_id)
    if not job:
        return
    cats = cat_map()
    for it in job["items"]:
        it["status"] = "dl"
        try:
            get_story(it["id"])
            cat = load_catalog()
            story = next((s for s in cat["stories"] if s["post_id"] == it["id"]), None)
            if story is None:
                it["status"] = "fail"
                it["error"] = "غير موجود في الفهرس"
                continue
            it["title"] = clean_title(story.get("title"))
            story = ensure_sources(it["id"], story.get("link"), story.get("title"))
            src = pick_source(story.get("sources"), it["quality"])
            if src is None:
                it["status"] = "fail"
                it["error"] = "لا توجد مصادر قابلة للتحميل"
                continue
            if src.get("platform"):
                it["status"] = "fail"
                it["error"] = "فيديو منصّة خارجية (مشغّل فقط)"
                continue
            cname = story.get("category_name") or cats.get(story.get("category_id"), {}).get("name", "غير مصنف")
            folder = fs_safe(cname)
            fname = fs_safe(clean_title(story.get("title")) or str(it["id"]), 100) + ".mp4"
            fdir = os.path.join(BASE_DIR, folder)
            os.makedirs(fdir, exist_ok=True)
            dest = os.path.join(fdir, fname)
            expected = src.get("size")
            if os.path.isfile(dest) and expected and os.path.getsize(dest) == expected:
                it["status"] = "done"
                it["bytes"] = expected
                it["total"] = expected
                it["out"] = os.path.join(folder, fname)
                _log_download(it, cname)
                continue
            def prog(done, total):
                it["bytes"] = done
                it["total"] = total
            ok, size = stream_to_file(fix_url(src.get("url", "")), dest, expected, prog)
            it["bytes"] = size
            it["total"] = size
            if ok:
                it["status"] = "done"
                it["out"] = os.path.join(folder, fname)
                _log_download(it, cname)
            else:
                it["status"] = "fail"
                it["error"] = "نقل غير مكتمل"
        except Exception as e:
            it["status"] = "fail"
            it["error"] = str(e)[:200]
        time.sleep(0.9)
    job["done"] = True


def _log_download(it, cname):
    lib = load_library()
    lib["items"] = [e for e in lib["items"] if e.get("post_id") != it["id"]] + [{
        "post_id": it["id"], "ok": True, "bytes": it["bytes"], "quality": it["quality"],
        "title": it["title"], "category": cname, "file": it["out"],
        "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}]
    save_library(lib)


@app.route("/api/queue/<job_id>")
def queue(job_id):
    job = _JOBS.get(job_id)
    if not job:
        return jsonify(error="مهمة غير موجودة"), 404
    return jsonify(done=job["done"], quality=job["quality"],
                   items=[{k: it.get(k) for k in ("id", "status", "bytes", "total", "error", "out", "title")}
                          for it in job["items"]])


@app.route("/dl/<int:pid>/<int:qi>")
def dl(pid, qi):
    story = next((s for s in load_catalog()["stories"] if s["post_id"] == pid), None)
    if not story:
        return "غير موجود", 404
    story = ensure_sources(pid, story.get("link"), story.get("title"))
    srcs = [s for s in story.get("sources", []) if not s.get("platform")]
    if qi >= len(srcs):
        return "جودة غير صالحة", 404
    src = srcs[qi]
    url = fix_url(src.get("url", ""))
    if not url:
        return "لا رابط", 400
    fname = "%d_%s.mp4" % (pid, fs_safe(clean_title(story.get("title"))[:70]))
    headers = {"User-Agent": UA, "Referer": SITE}
    rng = request.headers.get("Range")
    if rng:
        headers["Range"] = rng
    resp = SESSION.get(url, headers=headers, stream=True, timeout=180)
    if resp.status_code in (403, 429, 500, 502, 503, 504):
        return "source error: %d" % resp.status_code, resp.status_code
    chunker = resp.iter_content(512 * 1024)
    if rng and resp.status_code == 206:
        first = next(chunker, b"")
        chunker = chain([first], chunker)
    r = Response(chunker, status=resp.status_code,
                 content_type=resp.headers.get("Content-Type", src.get("ct") or "video/mp4"))
    for h in ("Content-Range", "Content-Length"):
        if resp.headers.get(h):
            r.headers[h] = resp.headers[h]
    r.headers["Accept-Ranges"] = "bytes"
    r.headers["Content-Disposition"] = "attachment; filename*=UTF-8''%s" % quote(fname)
    return r


@app.route("/api/state")
def state():
    lib = load_library()
    return jsonify(downloaded=len([e for e in lib["items"] if e.get("ok")]),
                   failed=len([e for e in lib["items"] if not e.get("ok")]),
                   jobs=list(_JOBS.keys()))


def human(n):
    if not n:
        return "0 B"
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024.0:
            return "%.1f %s" % (n, unit)
        n /= 1024.0
    return "%.1f PB" % n


def main():
    port = 8080
    if "--port" in sys.argv:
        port = int(sys.argv[sys.argv.index("--port") + 1])
    print("Martyrs archive web UI -> http://127.0.0.1:%d" % port)
    app.run(host="127.0.0.1", port=port, debug=False, threaded=True)


if __name__ == "__main__":
    main()
