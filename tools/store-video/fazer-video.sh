#!/bin/bash
# Sweatbook: vídeo de 30 s para as lojas, a partir dos cortes já feitos no simulador.
# Uso: bash tools/store-video/fazer-video.sh
#   Lê    $VIDEO/sweatbook-mao-30s-pt.mp4 e $VIDEO/sweatbook-hand-30s-en.mp4 (1206x2622, sem áudio)
#   Gera  $VIDEO/lojas/{apple-886x1920,play-1080x1920}-{pt,br,es,en}.mp4 e capa-*.png
#   VIDEO por defeito: ~/Projetos-Claude/sweatbook-app-capturas/video
# Precisa: ffmpeg com libass (brew install ffmpeg). Legendas em legendas/ ao lado deste script.
# Logótipo e letra vêm do repositório onde o script está (ou de $REPO).
# Nota: não usa drawtext; todo o texto passa pelas legendas (libass).
set -euo pipefail
FFMPEG=${FFMPEG:-ffmpeg}
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=${REPO:-$(cd "$HERE/../.." && pwd)}
[ -f "$REPO/web/public/press/sweatbook-logo-dark.png" ] || REPO=$HOME/Projetos-Claude/Live-Poker-APP
VIDEO=${VIDEO:-$HOME/Projetos-Claude/sweatbook-app-capturas/video}
LEGENDAS=${LEGENDAS:-$HERE/legendas}
LOGO="$REPO/web/public/press/sweatbook-logo-dark.png"
FONTS="$REPO/web/assets/fonts"
BG=0x0c1311                     # fundo "Noite" da marca, igual ao do logótipo
APP_SECONDS=${APP_SECONDS:-26.5} # app; mais 3 s de cartão final = 29,5 s (a Apple aceita até 30 s)
TAKE_PT=${TAKE_PT:-sweatbook-mao-30s-pt.mp4}
TAKE_EN=${TAKE_EN:-sweatbook-hand-30s-en.mp4}
for f in "$LOGO" "$FONTS/HankenGrotesk_800ExtraBold.ttf" "$VIDEO/$TAKE_PT" "$VIDEO/$TAKE_EN"; do
  [ -f "$f" ] || { echo "Falta: $f" >&2; exit 1; }
done
cd "$VIDEO"
mkdir -p tmp/legendas lojas
cp "$LEGENDAS"/{pt,br,es,en}.srt tmp/legendas/   # caminho relativo e sem espaços para o filtro subtitles

# 1. Os cortes já vêm sem tempos mortos. O passo 3 fica com os primeiros $APP_SECONDS s
#    e tira o resto do fim do replayer. Para tirar um bocado do meio, ver a secção 2 de launch/video-lojas.md.
for G in pt en; do
  [ $G = pt ] && T=$TAKE_PT || T=$TAKE_EN
  mkdir -p "tmp/quadros-$G"   # 1 imagem a cada 2 s (ficheiro N = segundo 2N), para acertar os tempos das legendas
  "$FFMPEG" -v error -y -i "$T" -vf "fps=1/2,scale=300:-2" -start_number 0 "tmp/quadros-$G/%02d.jpg"
  echo "$G: $T tem $("${FFPROBE:-ffprobe}" -v error -show_entries format=duration -of csv=p=0 "$T") s; ficam ${APP_SECONDS} s + 3 s de cartão"
done

for L in pt br es en; do
  case $L in en) T=$TAKE_EN ;; *) T=$TAKE_PT ;; esac   # pt, pt-BR e es sobre o corte em PT
  for OUT in apple:886:1920 play:1080:1920; do
    IFS=: read -r KIND W H <<<"$OUT"
    LW=$((W * 78 / 100))

    # 2. Cartão final de 3 s: logótipo no fundo da marca. A frase e sweatbook.poker vêm na última legenda.
    "$FFMPEG" -v error -y -f lavfi -i "color=c=$BG:s=${W}x${H}:r=30:d=3" -i "$LOGO" \
      -filter_complex "[1:v]scale=$LW:-1[l];[0:v][l]overlay=(W-w)/2:H*0.30" \
      -c:v libx264 -crf 14 -preset fast -pix_fmt yuv420p "tmp/cartao-$KIND-$L.mp4"

    # 3. A app no tamanho certo (886x1920 para a Apple: corta 6 px em cima e em baixo, não deforma),
    #    o cartão no fim, legendas queimadas e uma faixa de áudio em silêncio (a Apple pede áudio estéreo AAC).
    if [ "$KIND" = apple ]; then ENC="-profile:v high -level:v 4.0 -b:v 11M -maxrate 12M -bufsize 24M"; AB=256k; else ENC="-profile:v high -crf 18"; AB=192k; fi
    "$FFMPEG" -v error -y -i "$T" -i "tmp/cartao-$KIND-$L.mp4" \
      -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
      -filter_complex "[0:v]fps=30,trim=0:$APP_SECONDS,setpts=PTS-STARTPTS,scale=$W:$H:force_original_aspect_ratio=increase,crop=$W:$H,setsar=1[a];\
[1:v]setsar=1[b];[a][b]concat=n=2:v=1:a=0,fps=30,\
subtitles=tmp/legendas/$L.srt:fontsdir='$FONTS':force_style='FontName=Hanken Grotesk ExtraBold,FontSize=$((W > 900 ? 17 : 15)),PrimaryColour=&H00FFFFFF,BackColour=&H99000000,BorderStyle=3,Outline=6,Shadow=0,Alignment=2,MarginV=70'[v]" \
      -map "[v]" -map 2:a -t 29.5 -c:v libx264 $ENC -pix_fmt yuv420p -preset slow \
      -c:a aac -b:a $AB -ar 48000 -ac 2 -movflags +faststart "lojas/$KIND-${W}x${H}-$L.mp4"
  done

  # 4. Capa: o replayer aos ${CAPA:-24.5} s, com o flop à vista (antes do cartão final). Também serve para a candidatura a destaque.
  "$FFMPEG" -v error -y -ss "${CAPA:-24.5}" -i "lojas/apple-886x1920-$L.mp4" -frames:v 1 "lojas/capa-$L.png"
done

# 5. Verificação: a Apple recusa fora de 15 a 30 s, acima de 30 fps ou sem áudio.
for f in lojas/apple-*.mp4; do
  echo "$f: $("${FFPROBE:-ffprobe}" -v error -show_entries format=duration:stream=codec_name,width,height,r_frame_rate,channels -of compact=p=0:nk=1 "$f" | tr '\n' ' ')"
done
