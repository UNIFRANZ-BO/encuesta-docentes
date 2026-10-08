"""Prueba de punta a punta de la app con un backend simulado (no toca la hoja real).
Requisitos: pip install playwright && playwright install chromium
Uso: python tests/e2e_test.py [ancho]   (390 por defecto; genera capturas en tests/shots/)
"""
import asyncio, json, pathlib, sys
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

RAIZ = pathlib.Path(__file__).resolve().parent.parent
SHOTS = RAIZ / 'tests' / 'shots'; SHOTS.mkdir(exist_ok=True)
API = 'https://script.google.com/macros/s/TESTID/exec'
W = int(sys.argv[1]) if len(sys.argv) > 1 else 390
DB, DONE = {}, {'doc.ya.respondio.xx@unifranz.edu.bo'}
ROSTER = {'doc.juanperez.lopez.ga@unifranz.edu.bo': {'nombre': 'JUAN PEREZ LOPEZ', 'sede': 'CBB', 'sede_nombre': 'Cochabamba', 'carrera_cod': 'NGE',
          'carrera': 'Negocios y Gestión Empresarial', 'plan': 2026}}

async def backend(route, req):
    q = parse_qs(urlparse(req.url).query)
    if req.method == 'POST':
        d = json.loads(req.post_data)['data']
        out = {'ok': False, 'codigo': 'ya_respondio', 'fecha': '07/10/2026'} if d['correo'] in DONE else {'ok': True, 'id': d['id']}
        if out['ok']: DB[d['id']] = d; DONE.add(d['correo'])
        return await route.fulfill(status=200, headers={'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json'}, body=json.dumps(out))
    a, cb = q.get('action', ['ping'])[0], q.get('callback', [''])[0]
    if a == 'validar':
        c = q['correo'][0]
        out = ({'ok': True, 'habilitado': False, 'motivo': 'ya_respondio', 'fecha': '07/10/2026'} if c in DONE else
               {'ok': True, 'habilitado': True, 'docente': ROSTER[c], 'carreras': []} if c in ROSTER else
               {'ok': True, 'habilitado': False, 'motivo': 'no_encontrado'})
    else:
        out = {'ok': True, 'existe': q.get('id', [''])[0] in DB}
    await route.fulfill(status=200, headers={'Content-Type': 'application/javascript'}, body=f'{cb}({json.dumps(out)});')

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width': W, 'height': 844 if W < 600 else 800}, is_mobile=W < 600, has_touch=W < 600)).new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.route('https://script.google.com/**', backend)
        await pg.goto((RAIZ / 'index.html').as_uri() + '?api=' + API); await pg.wait_for_timeout(1500)
        await pg.screenshot(path=str(SHOTS / f'{W}_00_bienvenida.png'))
        await pg.evaluate("autoNext=()=>{}")
        await pg.click('#start'); await pg.wait_for_timeout(1200)
        await pg.fill('#mailIn', 'nadie@unifranz.edu.bo'); await pg.click('#btnVerify'); await pg.wait_for_timeout(1500)
        assert 'No encontramos' in await pg.inner_text('#mailMsg')
        await pg.fill('#mailIn', 'DOC.JuanPerez.Lopez.ga@unifranz.edu.bo '); await pg.click('#btnVerify'); await pg.wait_for_timeout(2600)
        assert await pg.evaluate("STEPS[S.i].k") == 'm2'
        ANS = {'p06': 4, 'p07': 5, 'p08': 4, 'p09': 2, 'p11': 3, 'p12': 4}
        for _ in range(40):
            k = await pg.evaluate("STEPS[S.i].k")
            if k == 'review': break
            if k == 'p03':
                for i in [0, 1]: await pg.click(f'.opt[data-i="{i}"]')
            elif k == 'p04': await pg.click('.opt[data-v="Docente Tiempo Horario"]')
            elif k == 'p05': await pg.click('.opt[data-v="Requiero más información"]')
            elif k == 'p10': await pg.click('.opt[data-v="En todas mis clases"]')
            elif k == 'p13':
                for i in [0, 2]: await pg.click(f'.opt[data-i="{i}"]')
            elif k == 'p14': await pg.fill('#txIn', 'Más tiempo para coordinar.')
            elif k in ANS: await pg.click(f'.orb[data-n="{ANS[k]}"]')
            elif k == 'r01':
                for i in [1, 2, 8]: await pg.click(f'.opt[data-i="{i}"]')
            elif k == 'r02':
                assert await pg.locator('.opt').count() == 3, 'r02 debe mostrar solo lo marcado en r01'
                for i in [1, 8]: await pg.click(f'.opt[data-i="{i}"]')
            elif k == 'r03':
                assert await pg.locator('.opt').count() == 5 and await pg.locator('.orb').count() == 0, 'r03: 5 opciones de texto, sin números'
                assert (await pg.inner_text('.opt >> nth=0')).find('En todas o casi todas') >= 0, 'r03 en el orden del instrumento'
                await pg.click('.opt[data-n="4"]')
            elif k == 'r04':
                assert await pg.locator('.opt').count() == 6, 'r04: 5 niveles + No los he utilizado'
                await pg.click('.opt[data-n="2"]'); assert await pg.evaluate("S.a.r04") == 2
                await pg.click('.opt[data-n="NA"]'); assert await pg.evaluate("S.a.r04") == 'NA'
            await pg.wait_for_timeout(700)
            await pg.screenshot(path=str(SHOTS / f'{W}_{k}.png'))
            if k == 'r02':   # volver a r01, desmarcar una opción usada y comprobar que r02 se poda
                await pg.click('[data-act=prev]'); await pg.wait_for_timeout(900)
                await pg.click('.opt[data-i="8"]'); assert await pg.evaluate("S.a.r02") == [1], 'r02 no se podó'
                await pg.click('#btnNext'); await pg.wait_for_timeout(900)
            if k.startswith('m'): await pg.click('[data-act=next]')
            else: await pg.wait_for_timeout(250); await pg.click('#btnNext')
            await pg.wait_for_timeout(1100)
        await pg.screenshot(path=str(SHOTS / f'{W}_revision.png'), full_page=True)
        await pg.click('#btnSend'); await pg.wait_for_timeout(2500)
        await pg.screenshot(path=str(SHOTS / f'{W}_fin.png'))
        assert len(DB) == 1, 'la respuesta no llegó al backend'
        d = list(DB.values())[0]
        print(json.dumps(d, ensure_ascii=False))
        esper = {'p03_idx': [1, 2], 'p04': 'Docente Tiempo Horario', 'p05': 'Requiero más información', 'p10': 'En todas mis clases', 'p13_idx': [1, 3],
                 'r01_idx': [2, 3], 'r02_idx': [2], 'r04': 'NA', 'p06': 4, 'p12': 4, 'r03': 4, 'id': d['id'][:3] == 'DO-' and d['id']}
        for k, v in esper.items(): assert d[k] == v, (k, d[k], v)
        assert not errs, errs
        print('OK · errores JS:', errs)
        await b.close()

asyncio.run(main())
