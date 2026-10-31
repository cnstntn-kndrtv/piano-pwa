"""Reproduce the bundled subset of FluidR3 (CC BY 3.0) samples."""
import base64, concurrent.futures, json, pathlib, re, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
ROOTS = [21] + list(range(24, 109, 6))
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
def fetch(pair):
    local, remote = pair
    url = f'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/{remote}-mp3.js'
    text = urllib.request.urlopen(url).read().decode()
    samples = dict(re.findall(r'"([A-G][b#]?\d)":\s*"(data:audio/[^"]+)"', text))
    dest = ROOT / 'assets' / 'sounds' / local
    dest.mkdir(parents=True, exist_ok=True)
    for midi in ROOTS:
        name = f'{NAMES[midi % 12]}{midi // 12 - 1}'
        (dest / f'{midi}.mp3').write_bytes(base64.b64decode(samples[name].split(',')[1]))
    print(local, len(ROOTS), 'samples', sum(p.stat().st_size for p in dest.glob('*.mp3')), 'bytes')
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
    list(pool.map(fetch, [('piano','acoustic_grand_piano'),('marimba','marimba'),('trumpet','trumpet')]))
