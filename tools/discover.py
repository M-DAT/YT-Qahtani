"""Discovery: enumerate posts across categories and extract video sources."""
import json
import os
import re
import sys

from common import polite_get, polite_head, save_json, load_json, quality_rank, BASE_DIR

DEFAULT_CATEGORY = 32  # الإنتاج الوثائقي
CATALOG_PATH = os.path.join(BASE_DIR, "catalog.json")
CATEGORIES_PATH = os.path.join(BASE_DIR, "categories.json")


def fetch_categories():
    """Return {id: {id, name, slug, count}} from the WP REST API."""
    cats = {}
    page = 1
    while True:
        url = ("https://www.mmy.ye/wp-json/wp/v2/categories"
               "?per_page=100&page=%d&hide_empty=1&_fields=id,count,name,slug" % page)
        resp = polite_get(url)
        if resp is None or resp.status_code != 200:
            break
        data = resp.json()
        for c in data:
            cats[c["id"]] = {"id": c["id"], "name": c["name"],
                             "slug": c["slug"], "count": c["count"]}
        if len(data) < 100:
            break
        page += 1
    save_json(CATEGORIES_PATH, sorted(cats.values(), key=lambda c: -c["count"]))
    return cats


def get_all_post_meta(category_ids):
    """Fetch all posts for the given categories via the WP REST API."""
    posts = []
    for cid in category_ids:
        page = 1
        while True:
            url = (f"https://www.mmy.ye/wp-json/wp/v2/posts?categories={cid}"
                   f"&per_page=100&page={page}&orderby=id&order=desc")
            resp = polite_get(url)
            if resp is None or resp.status_code != 200:
                print(f"[!] API page {page} of cat {cid} failed", file=sys.stderr)
                break
            data = resp.json()
            total_pages = int(resp.headers.get("X-WP-TotalPages", 1))
            for p in data:
                p["category_id"] = cid
            posts.extend(data)
            if page >= total_pages:
                break
            page += 1
    return posts


def extract_video_sources(html):
    """Return list of {label, url} discovered on the page."""
    sources = []

    m = re.search(r'"single_media_sources"\s*:\s*(\[.*?\])', html)
    if m:
        try:
            arr = json.loads(m.group(1))
            for item in arr:
                src = item.get("source_file") or ""
                label = item.get("source_label") or ""
                if src.startswith(("http", "//")):
                    sources.append({"label": label, "url": src})
        except ValueError:
            pass

    if not sources:
        for m in re.finditer(r'<source[^>]+src="([^"]+)"', html):
            u = m.group(1).replace("&amp;", "&")
            if u and not any(s["url"] == u for s in sources):
                sources.append({"label": "mp4", "url": u})

    if not sources:
        for m in re.finditer(r"(https?://[^\s\"'<>]+?\.mp4(?:[^\"'\s<>]*))", html):
            u = m.group(1).replace("&amp;", "&")
            if u and not any(s["url"] == u for s in sources):
                sources.append({"label": "mp4", "url": u})

    if not sources:
        for m in re.finditer(r'<iframe[^>]+src="([^"]+)"', html):
            u = m.group(1).replace("&amp;", "&")
            if any(x in u for x in ("youtube", "youtu", "vimeo", "dailymotion", "facebook")):
                sources.append({"label": "embed", "url": u, "platform": True})

    return sources


def extract_thumbnail(html):
    m = re.search(r'<meta property="og:image"\s+content="([^"]+)"', html)
    if m:
        return m.group(1)
    m = re.search(r'thumbnailUrl"\s*:\s*"([^"]+)"', html)
    if m:
        return m.group(1)
    return None


def extract_description(html):
    for pat in (r'<meta name="description"\s+content="([^"]*)"',
                r'<meta property="og:description"\s+content="([^"]*)"'):
        m = re.search(pat, html)
        if m:
            return m.group(1)
    return None


def normalize_url(u):
    if u.startswith("//"):
        return "https:" + u
    return u


def probe_sizes(sources):
    if not sources:
        return sources
    order = sorted(sources, key=lambda s: quality_rank(s.get("label", "")))
    to_probe = order[:3]
    for s in sources:
        s["size"] = None
        s["ct"] = ""
    for s in to_probe:
        u = normalize_url(s["url"])
        resp = polite_head(u)
        if resp is not None and resp.status_code in (200, 206):
            s["size"] = int(resp.headers.get("Content-Length") or 0) or None
            s["ct"] = resp.headers.get("Content-Type", "")
    return sources


def main():
    args = [a for a in sys.argv[1:]]
    cats = fetch_categories()
    sel = []
    if "--cat" in args:
        i = args.index("--cat")
        sel = [int(x) for x in args[i + 1].split(",")]
    else:
        plugin = [a for a in args if a.startswith("--")]
        if "--all" in args:
            sel = sorted(cats.keys())
        else:
            sel = [DEFAULT_CATEGORY]
    names = {c["id"]: c["name"] for c in cats.values()}
    probe = "--no-probe" not in args
    print("Categories selected: %s" % ", ".join("%d:%s" % (c, names.get(c, "?")) for c in sel))

    posts = get_all_post_meta(sel)
    print(f"Fetched {len(posts)} posts from REST API")

    catalog = load_json(CATALOG_PATH, {"stories": []})
    existing = {s["post_id"]: s for s in catalog["stories"]}
    found = 0

    for i, p in enumerate(posts, 1):
        pid = p["id"]
        cat = names.get(p["category_id"], p["category_id"])
        if pid in existing:
            existing[pid]["category_id"] = p["category_id"]
            existing[pid]["category_name"] = cat
            continue
        resp = polite_get(p["link"])
        if resp is None:
            print(f"[{i}/{len(posts)}] SKIP {pid}: fetch failed")
            continue
        html = resp.text
        sources = extract_video_sources(html)
        if probe:
            sources = probe_sizes(sources)
        item = {
            "post_id": pid,
            "title": p.get("title", {}).get("rendered", ""),
            "post_date": p.get("date"),
            "link": p["link"],
            "thumbnail": extract_thumbnail(html),
            "description": extract_description(html),
            "category_id": p.get("category_id"),
            "category_name": cat,
            "sources": sources,
        }
        catalog["stories"].append(item)
        found += 1

        labels = [s.get("label", "") for s in sources]
        best = min(labels, key=quality_rank) if labels else None
        size = next((s["size"] for s in sources if s.get("size")), None)
        print(f"[{i}/{len(posts)}] {pid} [{cat}] {best} size={size} | {item['title'][:55]}")

        if found % 10 == 0:
            save_json(CATALOG_PATH, catalog)

    save_json(CATALOG_PATH, catalog)
    print(f"\nCatalog saved: {CATALOG_PATH} ({len(catalog['stories'])} stories)")


if __name__ == "__main__":
    main()
