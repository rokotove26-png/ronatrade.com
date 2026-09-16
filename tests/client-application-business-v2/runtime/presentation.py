"""Focused presentation regression executed after browser.py on the same isolated server/database."""
import json, os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE='http://127.0.0.1:'+os.getenv('APPLICATION_TEST_PORT','8768')
OUT=Path(os.getenv('APPLICATION_EVIDENCE_DIR','/tmp/application-business-browser'))
OUT.mkdir(parents=True,exist_ok=True)
checks=[]
def check(name,value):
    if not value: raise AssertionError(name)
    checks.append({'name':name,'result':'PASS'})
    print('PRESENTATION_CHECK_OK: '+name,flush=True)

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    context=browser.new_context(viewport={'width':1440,'height':1000})
    try:
        assert context.request.get(BASE+'/test/login?user=1').ok
        page=context.new_page();requests=[];page.on('request',lambda r: requests.append(r.url))
        page.goto(BASE+'/portal/client')
        nav=page.locator('[data-rona-application-business-sections]');expect(nav).to_be_visible()
        active=nav.locator('[data-application-bucket=ACTIVE]');completed=nav.locator('[data-application-bucket=COMPLETED]')
        expect(active).to_be_visible();expect(completed).to_be_visible()
        check('Active and Completed are separate top-level application sections',nav.locator('[data-application-bucket]').count()==2)
        check('section navigation is a sibling immediately above the application list',nav.evaluate("n=>n.nextElementSibling?.matches('[data-rona-live-applications=\"canonical-v1\"]')===true"))
        check('bucket controls are not embedded among application cards',page.locator('[data-rona-live-applications="canonical-v1"] [data-application-bucket]').count()==0)
        completed.click();expect(completed).to_have_attribute('aria-pressed','true')
        panel=page.locator('[data-rona-live-applications="canonical-v1"] [data-rona-counter-offer-panel="v2"]').first
        expect(panel).to_be_visible()
        before=' '.join(panel.inner_text().split())
        check('accepted counter offer is rendered from the canonical application row','Встречное предложение RONA Trade' in before and 'USD/т' in before and 'Встречное предложение принято' in before)
        # Section switches re-render the same canonical collection synchronously. The accepted panel
        # must be present immediately when Completed is opened again, without an async decorator pass.
        active.click();completed.click();panel2=page.locator('[data-rona-live-applications="canonical-v1"] [data-rona-counter-offer-panel="v2"]').first
        expect(panel2).to_be_visible();after=' '.join(panel2.inner_text().split())
        check('accepted counter offer remains stable across canonical section re-renders',after==before)
        page.dispatch_event('body','rona:client-applications-rendered');expect(panel2).to_be_visible()
        check('rendered event does not remove the canonical counter-offer panel',True)
        check('counter offer does not request a second presentation projection',not any('client-counter-offer-canonical' in url for url in requests))
        page.screenshot(path=str(OUT/'client-application-sections-counteroffer.png'),full_page=True)
    finally:
        (OUT/'presentation-results.json').write_text(json.dumps({'checks':checks},ensure_ascii=False,indent=2))
        context.close();browser.close()
