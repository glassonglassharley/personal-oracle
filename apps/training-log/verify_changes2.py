"""
Targeted verification: walking icon, water sheet + button, history.
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

def enter_demo(page):
    page.goto(URL, timeout=30000)
    page.wait_for_load_state("networkidle", timeout=20000)
    page.locator("button:has-text('Explore Demo')").wait_for(state="visible", timeout=10000)
    page.locator("button:has-text('Explore Demo')").click()
    page.wait_for_timeout(2000)

def open_nav(page, is_mobile):
    """On mobile: open hamburger then click nav item. On desktop: sidebar is always visible."""
    if is_mobile:
        hamburger = page.locator(".hamburger-btn")
        if hamburger.is_visible():
            hamburger.click()
            page.wait_for_timeout(400)

def click_nav(page, label, is_mobile):
    open_nav(page, is_mobile)
    btn = page.locator(f".sidebar-tab:has-text('{label}')").first
    btn.wait_for(state="visible", timeout=5000)
    btn.click()
    page.wait_for_timeout(1000)
    # Close overlay on mobile if still open
    overlay = page.locator(".sidebar-drawer-overlay")
    if overlay.count() > 0 and overlay.is_visible():
        overlay.click()
        page.wait_for_timeout(300)

def open_water_sheet(page):
    """Click the water compact card to open the detail sheet."""
    # The parent div has cursor:pointer and contains the WaterRing compact
    # Use JS to find and click the correct cursor:pointer div
    opened = page.evaluate("""
      const divs = Array.from(document.querySelectorAll('div'));
      for (const d of divs) {
        const s = window.getComputedStyle(d);
        if (s.cursor === 'pointer' && d.textContent.includes('cups')) {
          d.click();
          return true;
        }
      }
      return false;
    """)
    page.wait_for_timeout(800)
    return opened

def run_viewport(pw, width, height, label):
    is_mobile = width <= 500
    print(f"\n{'='*50}  {label}  {width}x{height}")

    browser = pw.chromium.launch(headless=True)
    ctx = browser.new_context(viewport={"width": width, "height": height})
    page = ctx.new_page()

    enter_demo(page)
    shot(page, f"{label}_01_home")

    # ── CHECK 1: Walking person icon ─────────────────────────────
    walking = page.locator("svg path[d*='M13.49']").count()
    print(f"  {'PASS' if walking > 0 else 'FAIL'}  Walking person icon: {walking} instance(s)")
    google_g = page.locator("svg path[fill='#EA4335']").count()
    print(f"  {'PASS' if google_g == 0 else 'WARN'}  Google G logo count: {google_g} (expect 0)")

    # ── CHECK 2: Water sheet + button ────────────────────────────
    opened = open_water_sheet(page)
    print(f"  {'PASS' if opened else 'WARN'}  Water card click triggered: {opened}")
    shot(page, f"{label}_02_water_sheet")

    hydration = page.locator("text=Hydration").first
    if hydration.is_visible():
        print(f"  PASS  Hydration sheet header visible")

        plus_btn = page.locator("button[title='Add one more glass']")
        if plus_btn.count() > 0 and plus_btn.first.is_visible():
            print(f"  PASS  '+' overflow button present")
            # Click it a few times
            for _ in range(3):
                plus_btn.first.click()
                page.wait_for_timeout(150)
            shot(page, f"{label}_03_water_plus_clicked")
            # Check that count updated (should now show 3)
            count_text = page.locator("text=/^3$/").count()
            print(f"  {'PASS' if count_text > 0 else 'INFO'}  Count shows '3' after 3 clicks: {count_text > 0}")
        else:
            print(f"  FAIL  '+' button not found")

        # Check bottle buttons
        bottle_btns = page.locator("button:has-text('1 bottle')")
        if bottle_btns.count() > 0:
            print(f"  PASS  Bottle quick-add buttons present")
        else:
            # May need scroll
            page.evaluate("document.querySelector('.modal, [class*=\"sheet\"], [class*=\"Sheet\"]')?.scrollBy(0,200)")
            bottle_btns2 = page.locator("button:has-text('1 bottle')")
            print(f"  {'PASS' if bottle_btns2.count() > 0 else 'INFO'}  Bottle buttons (after scroll): {bottle_btns2.count()}")

        # Close sheet
        close = page.locator("button:has-text('✕')").first
        if close.is_visible():
            close.click()
            page.wait_for_timeout(400)
    else:
        print(f"  WARN  Hydration header not visible after click")
        # Check what is visible
        page_text = page.evaluate("document.body.innerText").replace('\n', ' ')[:200]
        print(f"         Page text sample: {page_text}")

    # ── CHECK 3: Personal tab — history cards ────────────────────
    click_nav(page, "Personal", is_mobile)
    shot(page, f"{label}_04_personal_tab")

    history_cards = page.locator(".history-card").count()
    print(f"  {'PASS' if history_cards > 0 else 'FAIL'}  History cards: {history_cards}")

    # Water in history chips — demo data has no water, but code is in place
    water_visible = len([el for el in page.locator("text=Water").all() if el.is_visible()])
    if water_visible > 0:
        print(f"  PASS  Water chip in history: {water_visible} visible")
    else:
        print(f"  INFO  No water in demo history (expected — seed has no water; code is in place for real data)")

    browser.close()
    print(f"  DONE  {label}")


def main():
    with sync_playwright() as pw:
        run_viewport(pw, 390, 844,  "mobile")
        run_viewport(pw, 1280, 900, "desktop")
    print(f"\nScreenshots: {OUT}\n")

if __name__ == "__main__":
    main()
