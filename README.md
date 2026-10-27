# Limamar · Navegação em Paraty

App para barqueiros e marinheiros da baía de Paraty: condições por ponto de passeio, vento hora a hora, maré, velocímetro pelo GPS e checklist de bordo.

Feito como site instalável (PWA): abra no celular e adicione à tela inicial.

Carta náutica: cartas raster 1633 e 1634 da Marinha do Brasil (DHN/CHM), recortadas para a baía de Paraty. Uso informativo e não comercial; não substitui a carta oficial.

Dados de previsão: [Open-Meteo](https://open-meteo.com) (CC BY 4.0). Não substitui o boletim da Marinha nem a experiência do mestre.

## Fontes de dados
- Vento, tempo, onda e maré estimada: [Open-Meteo](https://open-meteo.com) (modelos ECMWF, GFS e outros), renovada a cada hora.
- Avisos de mau tempo: [Marinha do Brasil, CHM](https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo). O GitHub Actions baixa a página a cada 30 min e grava `avisos.json` (`scripts/avisos.py`). Paraty fica na Área Charlie.
- Ilhas e praias: © colaboradores do [OpenStreetMap](https://www.openstreetmap.org/copyright); Ilha do Ventura pelo Portal Náutico.
