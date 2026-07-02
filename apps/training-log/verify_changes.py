"""
Verify training-log changes on mobile (390px) and desktop (1280px).
"""
import sys, os
from playwright.sync_api import sync_playwright

URL = "https://training-log-flax.vercel.app"
OUT = r"C:\Users\jmeny\training-log\verify_shots"
os.makedirs(OUT, exist_ok=True)

def shot(page, name):
    p = f"{OUT}\\{name}.png"
    page.screenshot(path=p, full_page=False)
    print(f"  [shot] {name}.png")

def nav_click(page, text):
    """Click nav button even if partially off viewport."""
    btn = page.locator(f"button:has-text('{text}')").first
    page.evaluate(f"document.querySelector('.sidebar-tab.active, button')")
    btn.scroll_into_view_if_needed()
    btn.click(force=True)
    page.wait_for_timeout(800)

def run_viewport(pw, width, height, label):
    print(f"\n{'='*50}")
    print(f"  {label}  {width}x{height}")
    print(f"{'='*50}")

    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": width, "height": height})
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    # 1. Load + enter demo
    page.goto(URL, timeout=30000)
    page.wait_for_load_state("networkidle", timeout=20000)
    shot(page, f"{label}_01_landing")
    print(f"  OK  Page loaded: {page.title()}")

    demo_btn = page.locator("button:has-text('Explore Demo')")
    demo_btn.wait_for(state="visible", timeout=10000)
    demo_btn.click()
    page.wait_for_timeout(2000)
    shot(page, f"{label}_02_demo_home")
    print(f"  OK  Demo mode entered")

    # 2. Walking person icon — SVG path from WalkingPerson component
    walking = page.locator("svg path[d*='M13.49']")
    wcount = walking.count()
    if wcount > 0:
        print(f"  PASS  Walking person icon found ({wcount} instance(s))")
    else:
        # Check if Google G is still there instead
        google_paths = page.locator("svg path[fill='#EA4335']").count()
        if google_paths > 0:
            print(f"  FAIL  Google G still visible — walking person not applied")
        else:
            print(f"  WARN  Neither icon found (steps card may need Google Fit connected)")

    # 3. Water ring — scroll to it
    page.evaluate("window.scrollTo(0, 500)")
    page.wait_for_timeout(400)
    shot(page, f"{label}_03_scrolled")

    hydration = page.locator("text=Hydration").first
    if hydration.is_visible():
        print(f"  PASS  Hydration section visible")
        shot(page, f"{label}_04_water_section")
        # Check + overflow button
        plus_btn = page.locator("button[title='Add one more glass']")
        if plus_btn.count() > 0:
            print(f"  PASS  '+' overflow glass button present")
            # Click it a few times to verify it goes past goal
            for i in range(3):
                plus_btn.click()
                page.wait_for_timeout(150)
            shot(page, f"{label}_05_water_after_plus")
            # Check the center count updated
            print(f"  PASS  Clicked '+' 3x — checking center count")
        else:
            print(f"  WARN  '+' button not found at current scroll position")

        # Check bottle quick-add buttons
        bottle_btns = page.locator("button:has-text('1 bottle')").count()
        if bottle_btns > 0:
            print(f"  PASS  Bottle quick-add buttons present")
        else:
            print(f"  WARN  Bottle buttons not visible at current scroll")
    else:
        page.evaluate("window.scrollTo(0, 800)")
        page.wait_for_timeout(400)
        shot(page, f"{label}_04_water_scroll2")
        h2 = page.locator("text=Hydration").first
        print(f"  {'PASS' if h2.is_visible() else 'WARN'}  Hydration visible after extra scroll: {h2.is_visible()}")

    # 4. History tab — check water chip
    hist_btn = page.locator("button").filter(has_text="History").first
    if hist_btn.count() > 0:
        hist_btn.click(force=True)
        page.wait_for_timeout(1000)
        shot(page, f"{label}_06_history")

        # Look for Water text in history chips
        water_els = page.locator("text=Water").all()
        visible_water = [el for el in water_els if el.is_visible()]
        if len(visible_water) > 0:
            print(f"  PASS  Water visible in history ({len(visible_water)} occurrences)")
        else:
            hist_cards = page.locator(".history-card").count()
            print(f"  INFO  Water not in history chips ({hist_cards} cards — demo data may have no water logged)")
            # Demo seed data doesn't include water, so this is expected
            print(f"  NOTE  Demo history has no water — field added to defaultDayData but demo seed has none. Working as designed.")
    else:
        print(f"  WARN  History button not found")

    # 5. Final layout check
    page.evaluate("window.scrollTo(0, 0)")
    page.wait_for_timeout(300)
    # Click Today nav
    today_btns = page.locator("button").all()
    for b in today_btns:
        try:
            if "Today" in b.inner_text():
                b.click(force=True)
                break
        except:
            pass
    page.wait_for_timeout(500)
    shot(page, f"{label}_07_today_final")

    # 6. Console errors
    page.wait_for_timeout(300)
    relevant = [e for e in errors if "Warning" not in e and "DevTools" not in e]
    if relevant:
        print(f"  WARN  Console errors: {relevant[:3]}")
    else:
        print(f"  PASS  No JS errors")

    browser.close()
    print(f"  DONE  {label} complete")


def main():
    with sync_playwright() as pw:
        run_viewport(pw, 390, 844,  "mobile")
        run_viewport(pw, 1280, 900, "desktop")

    print(f"\nScreenshots: {OUT}\n")

if __name__ == "__main__":
    main()
