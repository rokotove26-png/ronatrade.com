"""Actual compiled UI + Pages proxies + application handler + isolated PostgreSQL.
The login/JWT issuer and unrelated legacy bootstrap/controller are test doubles.
This is deliberately NOT production acceptance and does not connect to RONA hosts.
"""
import json, os, re, subprocess, time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
BASE = 'http://127.0.0.1:' + os.getenv('APPLICATION_TEST_PORT', '8768')
OUT = Path(os.getenv('APPLICATION_EVIDENCE_DIR', '/tmp/application-business-browser'))
OUT.mkdir(parents=True, exist_ok=True)
checks = []
def check(name, condition):
    if not condition: raise AssertionError(name)
    checks.append({'name': name, 'result': 'PASS', 'environment': 'ISOLATED_AUTHENTICATED'})
    print('BROWSER_CHECK_OK: ' + name, flush=True)
def sql(statement):
    host = os.getenv('PGHOST', '127.0.0.1')
    assert host in ('127.0.0.1', 'localhost', '::1')
    args=[os.getenv('PSQL_BIN','psql'),'-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h',host,'-p',os.getenv('PGPORT','5432'),'-U',os.getenv('PGUSER','postgres'),'-d',os.getenv('PGDATABASE','postgres')]
    p=subprocess.run(args,input=statement,text=True,capture_output=True,timeout=30,check=True)
    return p.stdout.strip()
def quote(s): return "'"+str(s).replace("'","''")+"'"
def owner_action(application_id, action, payload=None):
    claims=sql("select jsonb_build_object('sub',u.auth_user_id,'session_id',s.id,'role','authenticated') from portal_private.portal_users u join portal_private.qa_session_roles r on r.user_id=u.id join auth.sessions s on s.user_id=u.auth_user_id where 'ADMIN'=any(r.roles) order by u.id limit 1;")
    assert claims
    sql("select set_config('request.jwt.claims',"+quote(claims)+",false); select public.owner_r1_application_business_action_v2("+quote(application_id)+","+quote(action)+","+quote(json.dumps(payload or {}))+"::jsonb);")
def login(context, n):
    assert context.request.get(BASE+'/test/login?user='+str(n)).ok

def fill_form(page, quantity, calculation=False, note='ISOLATED_BROWSER'):
    page.locator('[data-rona-price-item]').click()
    form=page.locator('#ronaClientApplicationV3 form');expect(form).to_be_visible()
    form.locator('[name=quantity]').fill(str(quantity))
    form.locator('[name=destination_station]').fill('TEST STATION 0')
    form.locator('[data-combo=station] .rona-app-v3-option').first.click()
    form.locator('[name=border_station]').fill('TEST BORDER')
    form.locator('[data-combo=border] .rona-app-v3-option').first.click()
    for element in form.locator('input[required]:not([readonly])').all():
        if not element.input_value(): element.fill('ISOLATED')
    for element in form.locator('textarea[required]:not([readonly])').all():
        if not element.input_value(): element.fill('ISOLATED')
    form.locator('[name=comment]').fill(note)
    form.locator('[name=destination_quote]').set_checked(calculation)
    return form

def receipt_id(page):
    text=page.locator('#ronaClientApplicationV3Notice').inner_text()
    m=re.search(r'QA-C-[a-z0-9]+-IN-[0-9]{4}-[0-9]+', text)
    assert m, text
    return m.group(0)

def row(page, aid): return page.locator('[data-rona-live-application-id="'+aid+'"]')

with sync_playwright() as p:
    executable=os.getenv('CHROMIUM_PATH')
    browser=p.chromium.launch(headless=True,**({'executable_path':executable} if executable else {}))
    contexts=[]
    try:
        client=browser.new_context(viewport={'width':1440,'height':1100});contexts.append(client);login(client,1)
        page=client.new_page();errors=[];page.on('pageerror',lambda e: errors.append(str(e)))
        page.goto(BASE+'/portal/client');expect(page.locator('[data-application-bucket=ACTIVE]')).to_be_visible()
        check('compiled Client consumes authenticated canonical collection',page.locator('[data-rona-live-application-id]').count()>0)
        before=int(sql('select count(*) from portal_private.client_applications;'))
        form=fill_form(page,41.327,note='DOUBLE-SUBMIT')
        # Two submit events through the actual generated form while the first request is in flight.
        form.evaluate("f=>{f.requestSubmit();f.requestSubmit()}")
        expect(page.locator('#ronaClientApplicationV3')).to_have_count(0)
        aid=receipt_id(page);page.reload();expect(row(page,aid)).to_be_visible()
        check('double-submit creates exactly one numbered application',int(sql('select count(*) from portal_private.client_applications;'))==before+1)
        row(page,aid).locator('[data-rona-open-application]').click()
        expect(row(page,aid).locator('[data-rona-application-details]')).to_be_visible()
        check('Client Open resolves its exact canonical passport',aid in row(page,aid).inner_text())
        page.evaluate("aid=>{window.__RONA_QA_APPLICATION_ROW__=document.querySelector('[data-rona-live-application-id=\\\"'+CSS.escape(aid)+'\\\"]');window.dispatchEvent(new CustomEvent('rona:client-current-projection'))}",aid)
        expect(row(page,aid)).to_be_visible()
        expect(row(page,aid).locator('[data-rona-application-details]')).to_be_visible()
        check('current projection refresh preserves the same visible canonical row and open passport',page.evaluate("aid=>document.querySelector('[data-rona-live-application-id=\\\"'+CSS.escape(aid)+'\\\"]')===window.__RONA_QA_APPLICATION_ROW__",aid))
        page.screenshot(path=str(OUT/'client-canonical-passport.png'),full_page=True)
        # The actual server commits, but the first response never reaches the actual browser form.
        lost={'done':False,'id':None}
        def drop_response(route):
            response=route.fetch(); data=response.json()
            if response.ok and not lost['done']:
                lost['done']=True;lost['id']=data['application']['application_id'];route.abort('failed')
            else:route.fulfill(response=response)
        page.route('**/portal/api/v1/events',drop_response)
        fill_form(page,46.831,True,'LOST-RESPONSE').locator('[type=submit]').click()
        expect(page.locator('#ronaClientApplicationV3 [data-error]')).to_be_visible()
        check('lost delivered response retained one committed source',lost['done'] and bool(lost['id']))
        page.unroute('**/portal/api/v1/events',drop_response)
        page.reload();fill_form(page,46.831,True,'LOST-RESPONSE').locator('[type=submit]').click()
        expect(page.locator('#ronaClientApplicationV3')).to_have_count(0)
        check('reload plus network retry reuses canonical ID',receipt_id(page)==lost['id'])
        check('delivered retry creates one source-to-business link',int(sql('select count(*) from portal_private.client_applications where application_id='+quote(lost['id'])+';'))==1)
        # Multiple tabs open the same intent before either succeeds. navigator.locks and the
        # shared server receipt prevent a second identity without browser-owned business IDs.
        page.reload();second=client.new_page();second.goto(BASE+'/portal/client')
        firstform=fill_form(page,52.917,False,'MULTI-TAB');secondform=fill_form(second,52.917,False,'MULTI-TAB')
        firstform.locator('[type=submit]').click();secondform.locator('[type=submit]').click()
        expect(page.locator('#ronaClientApplicationV3')).to_have_count(0);expect(second.locator('#ronaClientApplicationV3')).to_have_count(0)
        check('two pre-opened tabs reuse one canonical ID',receipt_id(page)==receipt_id(second))
        # Actual logout/login and cookie-scoped reads; no page-local success cache.
        client.request.get(BASE+'/test/logout');r=client.request.get(BASE+'/portal/api/v1/client/context?clientId=x&contractId=y')
        check('logout rejects protected reads',r.status==401)
        login(client,1);page.goto(BASE+'/portal/client');expect(row(page,aid)).to_be_visible();check('fresh login preserves existing application',True)
        other=browser.new_context();contexts.append(other);login(other,2);otherpage=other.new_page();otherpage.goto(BASE+'/portal/client')
        expect(otherpage.locator('[data-application-bucket=ACTIVE]')).to_be_visible();check('second client cannot see first client business rows',otherpage.locator('[data-rona-live-application-id="'+aid+'"]').count()==0)
        # A source-backed accepted counter-offer. Owner/Admin sets the commercial price;
        # the client-response update is the explicitly allowed counter-response transition.
        agreed=617.43
        owner_action(aid,'COUNTER_OFFER',{'price':agreed,'currency':'USD'})
        sql("update portal_private.owner_application_workflow set business_status='CLIENT_COUNTER_ACCEPTED',client_counter_response='ACCEPTED' where application_key=(select id from portal_private.client_applications where application_id="+quote(aid)+");")
        page.reload();expect(row(page,aid)).to_be_visible()
        price=row(page,aid).locator('[data-application-agreed-price=true]');expect(price).to_be_visible()
        check('Client agreed price and currency render as one blue nowrap value','617,43 USD/т'==price.inner_text() and price.evaluate('(e)=>getComputedStyle(e).color')=='rgb(37, 99, 235)' and price.evaluate('(e)=>getComputedStyle(e).whiteSpace')=='nowrap')
        check('Client removed Price RONA text label','\u0426\u0435\u043d\u0430 RONA' not in page.locator('#page-applications').inner_text())
        admin=browser.new_context(viewport={'width':1600,'height':1100});contexts.append(admin);login(admin,3);ap=admin.new_page();ap.on('pageerror',lambda e:errors.append('ADMIN:'+str(e)))
        ap.goto(BASE+'/portal/admin');ap.wait_for_function('window.__RONA_OWNER_ADMIN_READY__===true',timeout=15000)
        check('actual emitted Admin runtime consumes canonical server collection',ap.evaluate('window.__RONA_OWNER_ADMIN_SNAPSHOT__.application_business_contract')=='RONA_APPLICATION_BUSINESS_V2')
        # Navigate the actual filter owning the authoritative bucket for this row.
        collection=admin.request.get(BASE+'/portal/admin-completed-bootstrap').json()['data'];record=next(x for x in collection['applications'] if x['application_id']==aid)
        bucket=record['business_bucket'];print('ADMIN_RECORD_BUCKET:'+bucket,flush=True)
        ap.locator('.rona-app-filter .is-'+{'NEW':'new','WORK':'work','DECISION':'decision','COMPLETED':'completed'}[bucket]).click()
        target=ap.locator('[data-rona-app-passport-open="'+aid+'"]');expect(target).to_be_visible()
        agreed_cell=target.locator('xpath=ancestor::tr').locator('[data-application-agreed-price=true]')
        expect(agreed_cell).to_be_visible()
        check('Admin numeric agreed price renders historical authority in blue',agreed_cell.inner_text()=='617,43' and agreed_cell.evaluate('(e)=>getComputedStyle(e).color')=='rgb(37, 99, 235)')
        with ap.expect_response(lambda r: '/v1/admin/applications/'+aid+'/passport' in r.url) as passport_response:
            target.click()
        passport=passport_response.value
        expect(ap.locator('.rona-app-passport-modal')).to_be_visible()
        check('Admin canonical passport requested for same ID',passport.status==200 and passport.json()['data']['application']['application_id']==aid and aid in ap.locator('.rona-app-passport-modal').inner_text())
        check('Admin numeric price has no Price RONA label','\u0426\u0435\u043d\u0430 RONA' not in ap.locator('#page-applications').inner_text())
        ap.screenshot(path=str(OUT/'admin-canonical-passport.png'),full_page=True)
        # The retained Completed bucket is read from the same server collection.
        sql("update portal_private.client_applications set status='CLOSED' where application_id="+quote(aid)+';')
        page.reload();page.locator('[data-application-bucket=COMPLETED]').click();expect(row(page,aid)).to_be_visible();row(page,aid).locator('[data-rona-open-application]').click();expect(row(page,aid).locator('[data-rona-application-details]')).to_be_visible()
        check('retained Completed row keeps universal Open',True)
        # Real commit-boundary lifecycle deletion with UI refresh and repeated recovery.
        delete_id=lost['id'];owner_action(delete_id,'REJECT',{'reason':'ISOLATED_BROWSER_OWNER_REJECT'})
        check('rejection physically deletes without waiting for reconciliation',int(sql('select count(*) from portal_private.client_applications where application_id='+quote(delete_id)+';'))==0)
        for _ in range(2):sql('select portal_private.reconcile_client_intake_v1(500); select portal_private.reconcile_client_applications_v2(500);')
        page.reload();expect(page.locator('[data-application-bucket=ACTIVE]')).to_be_visible()
        check('deleted application does not resurrect in Client',row(page,delete_id).count()==0)
        current=admin.request.get(BASE+'/portal/admin-completed-bootstrap').json()['data']
        check('Admin collection and KPI exclude deleted/technical rows',all(x['application_id']!=delete_id and x['record_kind']=='CLIENT_APPLICATION' for x in current['applications']) and current['application_kpi']['total']==len(current['applications']))
        check('KPI tonnage equals actual same business rows',abs(float(current['application_kpi']['tonnage'])-sum(float(x['quantity_tonnes']) for x in current['applications']))<0.000001)
        check('no runtime page errors',not errors)
    except Exception:
        for i,c in enumerate(contexts):
            for j,page in enumerate(c.pages):
                try:
                    page.screenshot(path=str(OUT/f'failure-{i}-{j}.png'),full_page=True)
                    (OUT/f'failure-{i}-{j}.html').write_text(page.content())
                    (OUT/f'failure-{i}-{j}.txt').write_text(page.locator('body').inner_text())
                except Exception: pass
        raise
    finally:
        (OUT/'browser-results.json').write_text(json.dumps({'environment':'ISOLATED_SIGNED_JWT_PROVIDER','production_acceptance':False,'checks':checks},indent=2))
        browser.close()