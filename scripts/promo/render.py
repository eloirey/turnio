import sys, asyncio, time
from playwright.async_api import async_playwright
# render.py outdir fps start_frame end_frame
out, fps, a, b = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])
async def main():
    async with async_playwright() as p:
        br=await p.chromium.launch(args=["--disable-gpu-vsync"])
        pg=await br.new_page(viewport={"width":1920,"height":1080})
        await pg.goto("http://localhost:3124/promo?render=1")
        await pg.wait_for_function("window.__filmReady===true")
        await pg.evaluate("document.fonts.ready")
        t0=time.time()
        for f in range(a,b):
            await pg.evaluate(f"window.__seek({f*1000/fps})")
            await pg.screenshot(path=f"{out}/f{f:05d}.jpg", type="jpeg", quality=94)
            if f % 300 == 0: print(f, round(time.time()-t0,1), flush=True)
        await br.close()
asyncio.run(main())
