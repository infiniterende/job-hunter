#!/usr/bin/env python3
"""
Job Hunter scraper.

Fetches public job postings from Greenhouse, Ashby and Lever boards, keeps
software-engineering roles posted within MAX_AGE_DAYS that are NYC-based or
remote, scores them (NYC/remote, SWE, React, Python, AI), upserts into
Postgres, and records the day's top-N picks.

Usage:
  python scraper.py run      # fetch + rank + save daily picks (default)
  python scraper.py check    # verify which board tokens in companies.json are live
  python scraper.py rank     # re-rank existing jobs and rebuild today's picks (no fetch)
"""
from __future__ import annotations

import html
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone, date
from pathlib import Path

import psycopg
import requests
from dotenv import load_dotenv
from psycopg.types.json import Jsonb

HERE = Path(__file__).resolve().parent
load_dotenv(HERE.parent / ".env")
load_dotenv(HERE / ".env")

# Prefer the session-mode (direct) URL: the scraper uses prepared statements, which
# transaction-mode poolers do not support.
DATABASE_URL = os.environ.get("DIRECT_URL") or os.environ.get(
    "DATABASE_URL", "postgresql://postgres@localhost:5433/job_hunter")
DAILY_TOP_N = int(os.environ.get("DAILY_TOP_N", "100"))
MAX_AGE_DAYS = int(os.environ.get("MAX_AGE_DAYS", "30"))
MAX_PER_COMPANY = int(os.environ.get("MAX_PER_COMPANY", "5"))  # keeps the top-N spread across companies
TIMEOUT = 20
UA = {"User-Agent": "job-hunter/1.0 (+personal job search tool)"}

# ---------------------------------------------------------------------------
# Scoring configuration
# ---------------------------------------------------------------------------
TITLE_SWE = re.compile(
    r"\b(software|full[- ]?stack|front[- ]?end|back[- ]?end|web|platform|application|"
    r"ai|ml|machine learning|founding|product|infrastructure|staff|principal|senior|sr\.?)\b.*"
    r"\b(engineer|developer|swe)\b|\b(engineer|developer|swe)\b",
    re.I,
)
TITLE_EXCLUDE = re.compile(
    r"\b(sales|solutions?|support|customer|hardware|mechanical|electrical|civil|"
    r"manufacturing|field|qa|quality|test|security|network|data engineer|analytics|"
    r"devops|site reliability|sre|embedded|firmware|manager|director|vp|head of|"
    r"recruit|intern|internship|technician|designer|writer|marketing|av|audio|video|"
    r"broadcast|facilities|it\b|help ?desk|process|chemical|materials|optical|rf|radio|systems engineer|"
    r"program|project|technical account|customer success|implementation|enablement|evangelist)\b",
    re.I,
)
NYC_RE = re.compile(r"\b(new york|nyc|ny\b|brooklyn|manhattan|new york city)", re.I)
REMOTE_RE = re.compile(r"\b(remote|anywhere|distributed|work from home|wfh)\b", re.I)
US_RE = re.compile(r"\b(us|usa|u\.s\.|united states|north america|americas)\b", re.I)
NON_US_REMOTE = re.compile(
    r"\b(emea|europe|eu|uk|united kingdom|england|london|ireland|dublin|germany|berlin|munich|"
    r"france|paris|spain|madrid|barcelona|portugal|lisbon|netherlands|amsterdam|poland|warsaw|"
    r"switzerland|zurich|sweden|stockholm|india|bangalore|bengaluru|hyderabad|canada|toronto|"
    r"vancouver|montreal|apac|asia|singapore|japan|tokyo|australia|sydney|melbourne|latam|"
    r"brazil|sao paulo|mexico|argentina|israel|tel aviv|uae|dubai|africa|nigeria|kenya)\b", re.I)

KEYWORDS = {
    "react":  (re.compile(r"\b(react(\.js)?|next\.?js|typescript)\b", re.I), 8),
    "python": (re.compile(r"\bpython\b|\b(django|fastapi|flask)\b", re.I), 8),
    "ai":     (re.compile(r"\b(ai|ml|machine learning|llm|llms|genai|generative|deep learning|"
                          r"rag|agents?|openai|anthropic|transformers?|pytorch)\b", re.I), 8),
}
# Level detection (mid-level to senior is the target band)
SENIOR_RE   = re.compile(r"\b(senior|sr\.?|lead)\b", re.I)
STAFF_RE    = re.compile(r"\b(staff|principal|distinguished|architect|fellow|l[6-9]|e[6-9]|ic[5-9])\b", re.I)
JUNIOR_RE   = re.compile(r"\b(junior|jr\.?|associate|entry[- ]level|new ?grad|graduate|early career|"
                         r"apprentice|intern|internship|university|campus|\bi\b|level ?1|l[1-3]|e[1-3]|ic[1-2])\b", re.I)
MID_RE      = re.compile(r"\b(ii|iii|2|3|mid[- ]?level|l[4-5]|e[4-5]|ic[3-4])\b", re.I)
SWE_TITLE   = re.compile(r"\b(software|full[- ]?stack|front[- ]?end|back[- ]?end|web|platform|product)\s+"
                         r"(engineer|developer)\b|\bswe\b", re.I)
COMPANY_TYPE_POINTS = {"healthcare": 25, "bigtech": 20, "startup": 15}


def strip_html(s: str | None) -> str:
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    return re.sub(r"\s+", " ", s).strip()


def parse_dt(v) -> datetime | None:
    if v is None or v == "":
        return None
    if isinstance(v, (int, float)):  # epoch ms (Lever)
        return datetime.fromtimestamp(v / 1000, tz=timezone.utc)
    try:
        d = datetime.fromisoformat(str(v).replace("Z", "+00:00"))
        return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# ---------------------------------------------------------------------------
# Fetchers: each yields normalized dicts
# ---------------------------------------------------------------------------
def fetch_greenhouse(token: str) -> list[dict]:
    r = requests.get(
        f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs",
        params={"content": "true"}, headers=UA, timeout=TIMEOUT,
    )
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        loc = (j.get("location") or {}).get("name") or ""
        offices = ", ".join(o.get("name", "") for o in j.get("offices", []) if o.get("name"))
        out.append({
            "source": "greenhouse",
            "external_id": str(j["id"]),
            "company": j.get("company_name") or token,
            "title": j.get("title", ""),
            "location": loc or offices,
            "remote_flag": None,
            "url": j.get("absolute_url"),
            "posted_at": parse_dt(j.get("first_published") or j.get("updated_at")),
            "description": strip_html(j.get("content")),
        })
    return out


def fetch_ashby(token: str) -> list[dict]:
    r = requests.get(
        f"https://api.ashbyhq.com/posting-api/job-board/{token}",
        params={"includeCompensation": "true"}, headers=UA, timeout=TIMEOUT,
    )
    r.raise_for_status()
    data = r.json()
    out = []
    for j in data.get("jobs", []):
        if j.get("isListed") is False:
            continue
        locs = [j.get("location") or ""] + [
            a.get("location", "") for a in j.get("secondaryLocations", []) or []
        ]
        out.append({
            "source": "ashby",
            "external_id": str(j["id"]),
            "company": data.get("organizationName") or token,
            "title": j.get("title", ""),
            "location": ", ".join(x for x in locs if x),
            "remote_flag": j.get("isRemote"),
            "url": j.get("applyUrl") or j.get("jobUrl"),
            "posted_at": parse_dt(j.get("publishedAt")),
            "description": j.get("descriptionPlain") or strip_html(j.get("descriptionHtml")),
        })
    return out


def fetch_lever(token: str) -> list[dict]:
    r = requests.get(
        f"https://api.lever.co/v0/postings/{token}", params={"mode": "json"},
        headers=UA, timeout=TIMEOUT,
    )
    r.raise_for_status()
    out = []
    for j in r.json():
        cats = j.get("categories") or {}
        loc = cats.get("location") or ""
        extra = ", ".join(j.get("allLocations", []) or [])
        wt = (j.get("workplaceType") or "").lower()
        out.append({
            "source": "lever",
            "external_id": str(j["id"]),
            "company": token,
            "title": j.get("text", ""),
            "location": loc or extra,
            "remote_flag": True if wt == "remote" else (False if wt == "on-site" else None),
            "url": j.get("applyUrl") or j.get("hostedUrl"),
            "posted_at": parse_dt(j.get("createdAt")),
            "description": j.get("descriptionPlain") or strip_html(j.get("description")),
        })
    return out


FETCHERS = {"greenhouse": fetch_greenhouse, "ashby": fetch_ashby, "lever": fetch_lever}


# ---------------------------------------------------------------------------
# Filter + score
# ---------------------------------------------------------------------------
def classify_location(location: str, remote_flag, description: str) -> tuple[bool, bool]:
    """Return (is_nyc, is_remote)."""
    loc = location or ""
    is_nyc = bool(NYC_RE.search(loc))
    is_remote = bool(remote_flag) or bool(REMOTE_RE.search(loc))
    # Remote-but-clearly-not-US is not useful for a NYC-based search.
    # Remote-but-clearly-not-US (e.g. "Paris, France" with an isRemote flag) is not
    # useful for a NYC-based search unless the location also names the US / NYC.
    if is_remote and NON_US_REMOTE.search(loc) and not US_RE.search(loc) and not is_nyc:
        is_remote = False
    return is_nyc, is_remote


def level_of(title: str) -> str:
    if JUNIOR_RE.search(title):
        return "junior"
    if STAFF_RE.search(title):
        return "staff"
    if SENIOR_RE.search(title):
        return "senior"
    return "mid"


def score_job(j: dict, company_type: str | None) -> tuple[int, dict, list[str]]:
    title = j["title"] or ""
    text = f"{title} {j.get('description','')}"
    breakdown: dict[str, int] = {}
    tags: list[str] = []

    # Location: NYC first, US-remote second, both best.
    if j["is_nyc"]:
        breakdown["nyc"] = 30; tags.append("NYC")
    if j["is_remote"]:
        breakdown["remote"] = 25 if not j["is_nyc"] else 10; tags.append("Remote")

    # Role: explicit software-engineer titles beat generic "engineer" titles.
    breakdown["swe"] = 20 if SWE_TITLE.search(title) else 10

    # Level: mid-level to senior is the target; staff+ is over-levelled.
    lvl = level_of(title)
    breakdown["level"] = {"senior": 25, "mid": 20, "staff": 5, "junior": 0}[lvl]
    tags.append({"senior": "Senior", "mid": "Mid", "staff": "Staff+", "junior": "Junior"}[lvl])

    # Company type: healthcare tech > big tech > startup.
    if company_type in COMPANY_TYPE_POINTS:
        breakdown["company"] = COMPANY_TYPE_POINTS[company_type]
        tags.append({"healthcare": "Healthcare", "bigtech": "Big tech", "startup": "Startup"}[company_type])

    # Stack keywords are a secondary signal now.
    for name, (rx, pts) in KEYWORDS.items():
        if rx.search(title):
            breakdown[name] = pts + 4; tags.append(name)
        elif rx.search(text):
            breakdown[name] = pts; tags.append(name)

    # Freshness: up to +10 for brand-new postings, decays over MAX_AGE_DAYS
    if j.get("posted_at"):
        age = (datetime.now(timezone.utc) - j["posted_at"]).days
        breakdown["fresh"] = max(0, 10 - int(age * 10 / max(MAX_AGE_DAYS, 1)))

    return sum(breakdown.values()), breakdown, tags


def is_swe(title: str) -> bool:
    return bool(TITLE_SWE.search(title)) and not TITLE_EXCLUDE.search(title)


def keep(j: dict, cutoff: datetime) -> bool:
    if not j.get("url") or not is_swe(j["title"]) or level_of(j["title"]) == "junior":
        return False
    if j["posted_at"] is None or j["posted_at"] < cutoff:
        return False
    return j["is_nyc"] or j["is_remote"]


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------
UPSERT = """
INSERT INTO jobs (source, external_id, company, title, location, is_remote, is_nyc, url,
                  posted_at, score, score_breakdown, tags, snippet, last_seen_at)
VALUES (%(source)s, %(external_id)s, %(company)s, %(title)s, %(location)s, %(is_remote)s,
        %(is_nyc)s, %(url)s, %(posted_at)s, %(score)s, %(score_breakdown)s, %(tags)s,
        %(snippet)s, now())
ON CONFLICT (source, external_id) DO UPDATE SET
  company = EXCLUDED.company, title = EXCLUDED.title, location = EXCLUDED.location,
  is_remote = EXCLUDED.is_remote, is_nyc = EXCLUDED.is_nyc, url = EXCLUDED.url,
  posted_at = COALESCE(jobs.posted_at, EXCLUDED.posted_at),
  score = EXCLUDED.score, score_breakdown = EXCLUDED.score_breakdown,
  tags = EXCLUDED.tags, snippet = EXCLUDED.snippet, last_seen_at = now()
"""


def ensure_schema(conn):
    conn.execute((HERE.parent / "schema.sql").read_text())


def load_companies() -> dict[str, list[str]]:
    data = json.loads((HERE / "companies.json").read_text())
    return {k: v for k, v in data.items() if k in FETCHERS}


def load_company_types() -> dict[str, str]:
    """token -> healthcare | bigtech | startup"""
    cats = json.loads((HERE / "companies.json").read_text()).get("categories", {})
    return {t: c for c, toks in cats.items() if isinstance(toks, list) for t in toks}


def sync_companies(conn, companies):
    for source, tokens in companies.items():
        for t in tokens:
            conn.execute(
                "INSERT INTO companies (name, source, board_token) VALUES (%s,%s,%s) "
                "ON CONFLICT (source, board_token) DO NOTHING", (t, source, t),
            )


def build_daily_picks(conn, day: date):
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    conn.execute("DELETE FROM daily_picks WHERE day = %s", (day,))
    conn.execute(
        """
        INSERT INTO daily_picks (day, rank, job_id)
        SELECT %s, row_number() OVER (ORDER BY score DESC, posted_at DESC, id), id
        FROM (
          SELECT id, score, posted_at,
                 row_number() OVER (PARTITION BY lower(company) ORDER BY score DESC, posted_at DESC, id) AS n
          FROM jobs
          WHERE posted_at >= %s
            AND last_seen_at >= now() - interval '36 hours'   -- still listed on the board
            AND id NOT IN (SELECT job_id FROM applications)
        ) ranked
        WHERE n <= %s
        ORDER BY score DESC, posted_at DESC, id
        LIMIT %s
        """,
        (day, cutoff, MAX_PER_COMPANY, DAILY_TOP_N),
    )


def cmd_run():
    companies = load_companies()
    company_types = load_company_types()
    cutoff = datetime.now(timezone.utc) - timedelta(days=MAX_AGE_DAYS)
    totals = {"fetched": 0, "kept": 0, "boards_ok": 0, "boards_failed": 0}

    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        sync_companies(conn, companies)
        conn.commit()
        run_started = datetime.now(timezone.utc)

        for source, tokens in companies.items():
            for token in tokens:
                try:
                    raw = FETCHERS[source](token)
                    status = f"ok:{len(raw)}"
                    totals["boards_ok"] += 1
                except Exception as e:  # noqa: BLE001
                    status = f"error:{type(e).__name__}"
                    if isinstance(e, requests.HTTPError) and e.response is not None:
                        status = f"http:{e.response.status_code}"
                    totals["boards_failed"] += 1
                    raw = []
                conn.execute(
                    "UPDATE companies SET last_status=%s, last_fetched_at=now() "
                    "WHERE source=%s AND board_token=%s", (status, source, token),
                )
                kept = 0
                for j in raw:
                    totals["fetched"] += 1
                    j["is_nyc"], j["is_remote"] = classify_location(
                        j["location"], j["remote_flag"], j["description"])
                    if not keep(j, cutoff):
                        continue
                    j["score"], bd, tags = score_job(j, company_types.get(token))
                    j["score_breakdown"] = Jsonb(bd)
                    j["tags"] = tags
                    j["snippet"] = (j["description"] or "")[:400]
                    conn.execute(UPSERT, j)
                    kept += 1
                totals["kept"] += kept
                conn.commit()
                print(f"[{source:10}] {token:22} {status:10} kept={kept}")

        # Postings that a successfully-fetched board no longer lists (or that no
        # longer pass the filters) are dropped, unless the user is tracking them.
        cur = conn.execute(
            """
            DELETE FROM jobs j
             USING companies c
             WHERE c.source = j.source AND c.last_status LIKE 'ok:%%'
               AND j.last_seen_at < %s
               AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.job_id = j.id)
            """, (run_started,))
        totals["removed"] = cur.rowcount
        build_daily_picks(conn, date.today())
        conn.commit()
    print(json.dumps(totals))


def cmd_rank():
    with psycopg.connect(DATABASE_URL) as conn:
        ensure_schema(conn)
        build_daily_picks(conn, date.today())
        conn.commit()
    print("daily picks rebuilt")


def cmd_check():
    for source, tokens in load_companies().items():
        for token in tokens:
            try:
                n = len(FETCHERS[source](token))
                print(f"OK    {source:10} {token:22} {n} postings")
            except requests.HTTPError as e:
                print(f"FAIL  {source:10} {token:22} HTTP {e.response.status_code}")
            except Exception as e:  # noqa: BLE001
                print(f"FAIL  {source:10} {token:22} {type(e).__name__}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "run"
    {"run": cmd_run, "rank": cmd_rank, "check": cmd_check}[cmd]()
