# Cyber Survivor V2

Mobile-first HTML5 prototype for `赛博驱魔人`.

## Current Status

The previous embedded standalone builds and generated HD/commercial art packs
were removed because they did not meet the commercial visual bar.

Do not treat generated runtime captures, rejected contact sheets, or
`COMMERCIAL_GATE=1` audit success as art acceptance. The next accepted build
must start from a new visual baseline: one map, one Boss, and a small matching
enemy set that pass real BattleScene screenshots first.

## Local Test

After a new accepted asset baseline exists, rebuild locally:

```bash
python3 build.py
```

Then serve the folder:

```bash
python3 -m http.server 8000
```

Visit:

```text
http://localhost:8000/index.html
```

## GitHub Pages

`index.html` is a generated standalone artifact and is ignored until the art
baseline is accepted. Do not push a Pages build that embeds rejected maps,
Bosses, enemies, or VFX.
