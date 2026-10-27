"""Baixa os Avisos de Mau Tempo da Marinha (CHM/SMM, METAREA V) e salva avisos.json.
Paraty fica na ÁREA CHARLIE (costeira, de Cabo de Santa Marta até Cabo Frio);
a ÁREA BRAVO é a parte oceânica do mesmo trecho."""
import html, json, re, sys, urllib.request
from datetime import datetime, timezone

URL = "https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo"
OUT = sys.argv[1] if len(sys.argv) > 1 else "avisos.json"

req = urllib.request.Request(URL, headers={
    "User-Agent": "Mozilla/5.0 (Limamar; +https://nathaemp.github.io/limar/)",
    "Accept-Language": "pt-BR,pt;q=0.9"})
raw = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")

# só a versão em português
m = re.search(r'<div class="idioma-conteudo" data-lang="pt">(.*?)(<div class="idioma-conteudo" data-lang="en">|$)', raw, re.S)
pt = m.group(1) if m else raw
if "grupo-area-avisos" not in pt and "AVISO" not in pt:
    raise SystemExit("Página da Marinha sem a lista de avisos; mantendo o arquivo anterior.")

def text(s):
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    return "\n".join(l.strip() for l in html.unescape(s).splitlines() if l.strip())

avisos, vistos = [], set()
for grupo in re.split(r'<div class="grupo-area-avisos">', pt)[1:]:
    am = re.search(r"<strong>\s*(ÁREA[^<]+)</strong>", grupo)
    area = text(am.group(1)) if am else ""
    for b in re.finditer(r'<div class="aviso-texto[^"]*"([^>]*)>(.*?)</div>', grupo, re.S):
        attrs, body = b.group(1), text(b.group(2))
        g = lambda k: (re.search(k + r'="([^"]*)"', attrs) or [None, None])[1]
        linhas = body.splitlines()
        numero = g("data-numero")
        if not area or not numero or numero in vistos:
            continue
        vistos.add(numero)
        avisos.append({
            "area": area,
            "numero": numero,
            "inicio": g("data-inicio-utc"),
            "fim": g("data-fim-utc"),
            "tipo": next((l for l in linhas if l.startswith("AVISO DE")), ""),
            "texto": body,
        })

# Só regrava se os avisos mudaram ou se a última gravação tem mais de 3 h
agora = datetime.now(timezone.utc)
try:
    antigo = json.load(open(OUT, encoding="utf-8"))
    idade = (agora - datetime.strptime(antigo["baixado"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)).total_seconds()
    if antigo.get("avisos") == avisos and idade < 3 * 3600:
        print("sem mudança nos avisos")
        raise SystemExit(0)
except (OSError, ValueError, KeyError):
    pass

dados = {
    "fonte": "Marinha do Brasil · CHM · Serviço Meteorológico Marinho",
    "url": URL,
    "baixado": agora.strftime("%Y-%m-%dT%H:%M:%SZ"),
    "avisos": avisos,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(dados, f, ensure_ascii=False, indent=1)
print(len(avisos), "avisos")
