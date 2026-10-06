from threading import Lock
from time import monotonic
from urllib.parse import urlsplit, urlunsplit

from playwright.sync_api import TimeoutError as PlaywrightTimeoutError
from playwright.sync_api import sync_playwright

from app.config import get_settings

MAX_PAGES = 8
MAX_CONTENT_LENGTH = 20_000
CACHE_SECONDS = 30 * 60
_cache_lock = Lock()
_cached_content: tuple[float, str] | None = None


def _origin(url: str) -> tuple[str, str | None, int | None]:
    parsed = urlsplit(url)
    default_port = 443 if parsed.scheme == "https" else 80
    return parsed.scheme.lower(), parsed.hostname, parsed.port or default_port


def _normalized_url(url: str) -> str | None:
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return None
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", "", ""))


def _crawl_website(start_url: str) -> str:
    start_url = _normalized_url(start_url)
    if not start_url:
        raise ValueError("WEBSITE_URL must be an HTTP or HTTPS URL.")

    start_origin = _origin(start_url)
    pending = [start_url]
    visited: set[str] = set()
    pages: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page()
        try:
            while pending and len(visited) < MAX_PAGES:
                current_url = pending.pop(0)
                if current_url in visited:
                    continue
                visited.add(current_url)

                try:
                    page.goto(
                        current_url, wait_until="domcontentloaded", timeout=15_000
                    )
                    try:
                        page.wait_for_load_state("networkidle", timeout=3_000)
                    except PlaywrightTimeoutError:
                        pass
                except PlaywrightTimeoutError:
                    if not page.url:
                        continue

                if _origin(page.url) != start_origin:
                    continue

                title = page.title().strip()
                body = page.locator("body").inner_text(timeout=5_000).strip()
                if body:
                    pages.append(f"{title}\n{body}" if title else body)

                links = page.locator("a[href]").evaluate_all(
                    "anchors => anchors.map(anchor => anchor.href)"
                )
                for link in links:
                    normalized = _normalized_url(link)
                    if (
                        normalized
                        and _origin(normalized) == start_origin
                        and normalized not in visited
                        and normalized not in pending
                    ):
                        pending.append(normalized)
        finally:
            browser.close()

    content = "\n\n".join(pages)[:MAX_CONTENT_LENGTH]
    if not content:
        raise ValueError("No readable website content was found.")
    return content


def load_knowledge() -> str:
    """Read rendered content from the configured website and cache it briefly."""
    global _cached_content
    website_url = get_settings().website_url.strip()
    if not website_url:
        return "Website content is unavailable because WEBSITE_URL is not configured."

    with _cache_lock:
        now = monotonic()
        if _cached_content and _cached_content[0] > now:
            return _cached_content[1]
        content = _crawl_website(website_url)
        _cached_content = (now + CACHE_SECONDS, content)
        return content
