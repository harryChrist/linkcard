#!/usr/bin/env bash
#
# build-background-video.sh
#
# Converts a LARGE master video into deploy-friendly assets for Linkcard:
#
#   1. an optimized H.264/AAC MP4 with +faststart (universal fallback)
#   2. an HLS VOD rendition (master.m3u8 + joined_NNN.ts segments, #EXT-X-ENDLIST)
#
# The master is expected to live OUTSIDE this repository (and outside public/).
# Nothing is written with its final name until it is complete: every artifact is
# first produced as "<name>.partial" and only promoted with `mv` on success.
# Encoding runs in resumable chunks, so re-running the script after an
# interruption continues where it stopped instead of starting over.
#
# Usage:
#   scripts/build-background-video.sh --input /path/to/master.mp4 [options]
#
# Run with --help for the full flag list.

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

INPUT=""                                            # REQUIRED, must exist
NAME="background"                                   # output base name
OUT_DIR="${REPO_ROOT}/public/videos"                # where published assets go
FALLBACK=""                                         # default: <out-dir>/<name>-optimized.mp4
WIDTH=960                                           # scale target (keeps aspect)
CRF=30                                              # x264 quality (higher = smaller)
PRESET="medium"
AUDIO_BITRATE="96k"                                 # "" disables audio entirely
SEGMENT_TIME=6                                      # HLS target segment duration (s)
CHUNK_SECONDS=120                                   # encode this many seconds per pass
TMP_DIR=""                                          # default: <out-dir>/.tmp
SKIP_ENCODE=0

usage() {
  cat <<'EOF'
build-background-video.sh -- build MP4 fallback + HLS from a large master

REQUIRED
  --input PATH      Path to the master video. MUST exist and MUST point to a file
                    outside the repository / outside public/, because a big master
                    cannot be committed (GitHub rejects blobs > 100 MiB) and must
                    never be copied into the published bundle.
                    There is intentionally no default: pass the real path.

OPTIONS
  --name NAME       Base name for outputs (default: background)
  --out-dir DIR     Output directory (default: <repo>/public/videos)
  --fallback PATH   Explicit path for the optimized MP4
                    (default: <out-dir>/<name>-optimized.mp4)
  --width N         Max output width in pixels, keeps aspect ratio (default: 960)
  --crf N           x264 CRF, higher = smaller file (default: 30)
  --preset NAME     x264 preset (default: medium)
  --audio BITRATE   AAC bitrate, e.g. 96k; use "none" to drop audio (default: 96k)
  --segment N       HLS target segment duration in seconds (default: 6)
  --chunk N         Encode in chunks of N seconds for resumability (default: 120)
  --tmp DIR         Directory for intermediate chunks (default: <out-dir>/.tmp)
  --skip-encode     Do not re-encode; only package/validate what is already there
  --help            Show this help and exit

EXAMPLES
  # Full conversion from a master kept outside the repo
  scripts/build-background-video.sh --input ~/media/master-extended.mp4 \
      --name memphis-9mm --width 960 --crf 30

  # Only validate / repackage existing chunks
  scripts/build-background-video.sh --input ~/media/master-extended.mp4 --skip-encode
EOF
}

log()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[!]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[x]\033[0m %s\n' "$*" >&2; exit 1; }

need() {
  command -v "$1" >/dev/null 2>&1 || die "required tool '$1' not found in PATH"
}

# ffmpeg/ffprobe are native binaries. On MSYS/Cygwin (Git Bash on Windows) the
# shell converts POSIX paths passed as ARGUMENTS, but it cannot rewrite paths
# that live inside a file (ffmpeg's concat demuxer list), so convert those.
to_native_path() {
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w -- "$1"
  else
    printf '%s' "$1"
  fi
}

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------

while [[ $# -gt 0 ]]; do
  case "$1" in
    --input)       INPUT="${2:-}"; shift 2 ;;
    --name)        NAME="${2:-}"; shift 2 ;;
    --out-dir)     OUT_DIR="${2:-}"; shift 2 ;;
    --fallback)    FALLBACK="${2:-}"; shift 2 ;;
    --width)       WIDTH="${2:-}"; shift 2 ;;
    --crf)         CRF="${2:-}"; shift 2 ;;
    --preset)      PRESET="${2:-}"; shift 2 ;;
    --audio)       AUDIO_BITRATE="${2:-}"; shift 2 ;;
    --segment)     SEGMENT_TIME="${2:-}"; shift 2 ;;
    --chunk)       CHUNK_SECONDS="${2:-}"; shift 2 ;;
    --tmp)         TMP_DIR="${2:-}"; shift 2 ;;
    --skip-encode) SKIP_ENCODE=1; shift ;;
    --help|-h)     usage; exit 0 ;;
    *)             die "unknown argument: $1 (try --help)" ;;
  esac
done

# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

need ffmpeg
need ffprobe

# --input is mandatory: never silently fall back to a path that may not exist.
[[ -n "$INPUT" ]] || die "--input is required and must point to the master video outside the repository (see --help)"
[[ -f "$INPUT" ]] || die "input file not found: $INPUT"

INPUT_ABS="$(cd "$(dirname "$INPUT")" && pwd)/$(basename "$INPUT")"

# Guard: the master must live outside the repo, otherwise it would be published
# (everything under public/ is copied verbatim to the deploy) and could be
# rejected by the host / by GitHub's 100 MiB blob limit.
case "$INPUT_ABS" in
  "${REPO_ROOT}"/*) warn "input lives inside the repository: $INPUT_ABS"
                    warn "a large master must not be committed or published; consider moving it out." ;;
esac

[[ "$WIDTH" =~ ^[0-9]+$ ]] || die "--width must be an integer"
[[ "$CRF" =~ ^[0-9]+$ ]]   || die "--crf must be an integer"
[[ "$SEGMENT_TIME" =~ ^[0-9]+$ ]] || die "--segment must be an integer"
[[ "$CHUNK_SECONDS" =~ ^[0-9]+$ ]] || die "--chunk must be an integer"

mkdir -p "$OUT_DIR"
OUT_DIR="$(cd "$OUT_DIR" && pwd)"
[[ -n "$FALLBACK" ]] || FALLBACK="${OUT_DIR}/${NAME}-optimized.mp4"
[[ -n "$TMP_DIR" ]]  || TMP_DIR="${OUT_DIR}/.tmp"

HLS_DIR="${OUT_DIR}/${NAME}-hls"
MANIFEST="${HLS_DIR}/master.m3u8"
CHUNK_DIR="${TMP_DIR}/${NAME}-chunks"

mkdir -p "$HLS_DIR" "$TMP_DIR" "$CHUNK_DIR"

# ---------------------------------------------------------------------------
# Probe the source: duration must decode, otherwise fail loudly
# ---------------------------------------------------------------------------

log "probing source: $INPUT_ABS"

DURATION="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$INPUT" 2>/dev/null || true)"
[[ -n "$DURATION" ]] || die "ffprobe could not read a duration from '$INPUT' (corrupt or unsupported file?)"

# Reject NaN / empty / non-positive durations.
DURATION="$(printf '%s' "$DURATION" | tr -d '\r\n ')"
if ! printf '%s' "$DURATION" | grep -Eq '^[0-9]+(\.[0-9]+)?$'; then
  die "decoded duration is not a finite number: '$DURATION'"
fi
awk -v d="$DURATION" 'BEGIN { exit (d > 0.5) ? 0 : 1 }' \
  || die "decoded duration is not positive: '$DURATION' (the file may be truncated)"

HAS_AUDIO="$(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$INPUT" | head -n 1 || true)"
if [[ -z "$HAS_AUDIO" ]]; then
  warn "source has no audio stream; outputs will be video-only"
fi

DURATION_INT="${DURATION%%.*}"
log "source duration: ${DURATION}s  audio: ${HAS_AUDIO:+yes}${HAS_AUDIO:-no}"

# ---------------------------------------------------------------------------
# Free space check (rough): a 3x-duration safety margin in the output dir
# ---------------------------------------------------------------------------

SOURCE_BYTES="$(wc -c < "$INPUT" | tr -d ' ')"
AVAIL_KB="$(df -Pk "$OUT_DIR" | awk 'NR==2 { print $4 }')"

if [[ -n "$AVAIL_KB" ]]; then
  # Heuristic: published assets try to shrink, but chunks + HLS + MP4 coexist,
  # so ask for at least source_size (capped at 2 GiB) of headroom.
  NEED_KB=$(( SOURCE_BYTES / 1024 ))
  CAP_KB=$(( 2 * 1024 * 1024 ))
  (( NEED_KB > CAP_KB )) && NEED_KB=$CAP_KB
  if (( AVAIL_KB < NEED_KB )); then
    die "not enough free space in $OUT_DIR: have ${AVAIL_KB}KiB, need ~${NEED_KB}KiB"
  fi
  log "free space ok: ${AVAIL_KB}KiB available in $OUT_DIR"
else
  warn "could not determine free space for $OUT_DIR; continuing"
fi

# ---------------------------------------------------------------------------
# Chunked, resumable encode
#
# Each chunk covers CHUNK_SECONDS of the source and is written as
# "$CHUNK_DIR/part_NNN.mp4.partial" then promoted to ".mp4" only after the
# encode of that chunk exits 0. Re-running skips finished chunks.
# ---------------------------------------------------------------------------

build_audio_args() {
  # Populates the global AUDIO_ARGS array.
  AUDIO_ARGS=()
  if [[ -n "$HAS_AUDIO" && "$AUDIO_BITRATE" != "none" ]]; then
    AUDIO_ARGS=(-c:a aac -b:a "$AUDIO_BITRATE" -ac 2)
  else
    AUDIO_ARGS=(-an)
  fi
}

encode_chunks() {
  local total="$DURATION_INT"
  local start=0
  local index=0
  local made=0

  while (( start < total )); do
    local file
    file="$(printf '%s/part_%03d.mp4' "$CHUNK_DIR" "$index")"

    if [[ -f "$file" ]]; then
      log "chunk $index already encoded, skipping"
      start=$(( start + CHUNK_SECONDS ))
      index=$(( index + 1 ))
      continue
    fi

    local partial="${file}.partial"
    log "encoding chunk $index (${start}s -> $(( start + CHUNK_SECONDS ))s)"

    # -ss before -i seeks fast; -t bounds the chunk length.
    # `-f mp4` is explicit because the ".partial" suffix hides the format
    # from ffmpeg's extension-based muxer detection.
    ffmpeg -hide_banner -loglevel error -y \
      -ss "$start" -t "$CHUNK_SECONDS" -i "$INPUT" \
      -vf "scale=${WIDTH}:-2:flags=lanczos" \
      -c:v libx264 -preset "$PRESET" -crf "$CRF" \
      -pix_fmt yuv420p -movflags +faststart \
      "${AUDIO_ARGS[@]}" \
      -f mp4 \
      "$partial"

    [[ -s "$partial" ]] || die "chunk $index produced no data (see ffmpeg output above)"

    # Promote only after a successful encode.
    mv -f "$partial" "$file"
    made=$(( made + 1 ))

    start=$(( start + CHUNK_SECONDS ))
    index=$(( index + 1 ))
  done

  log "chunk encoding complete (${index} chunks, ${made} new)"
}

build_fallback() {
  local list="${CHUNK_DIR}/concat.txt"
  : > "$list"
  local f
  # Deterministic order: glob expansion is already sorted, and quoting each
  # path keeps directories with spaces working.
  for f in "$CHUNK_DIR"/part_*.mp4; do
    [[ -f "$f" ]] || continue
    printf "file '%s'\n" "$(to_native_path "$f")" >> "$list"
  done

  grep -q . "$list" || die "no encoded chunks found in $CHUNK_DIR"

  local partial="${FALLBACK}.partial"
  log "joining chunks into fallback MP4: $FALLBACK"

  # `-f mp4` again: the temporary name has no usable extension.
  ffmpeg -hide_banner -loglevel error -y \
    -f concat -safe 0 -i "$list" \
    -c copy -movflags +faststart \
    -f mp4 \
    "$partial"

  [[ -s "$partial" ]] || die "failed to build the fallback MP4"
  mv -f "$partial" "$FALLBACK"
}

# ---------------------------------------------------------------------------
# HLS packaging (VOD playlist with #EXT-X-ENDLIST)
# ---------------------------------------------------------------------------

build_hls() {
  local partial_dir="${HLS_DIR}.partial"
  rm -rf "$partial_dir"
  mkdir -p "$partial_dir"

  log "packaging HLS: ${HLS_DIR}/master.m3u8"
  ffmpeg -hide_banner -loglevel error -y \
    -i "$FALLBACK" \
    -c copy \
    -f hls \
    -hls_time "$SEGMENT_TIME" \
    -hls_playlist_type vod \
    -hls_flags independent_segments \
    -hls_segment_filename "${partial_dir}/joined_%03d.ts" \
    "${partial_dir}/master.m3u8"

  validate_manifest "${partial_dir}/master.m3u8" "$partial_dir"

  # Promote the whole directory only after validation.
  rm -rf "$HLS_DIR"
  mv "$partial_dir" "$HLS_DIR"
}

# validate_manifest <manifest_path> <dir_with_segments>
validate_manifest() {
  local manifest="$1"
  local dir="$2"
  local missing=0
  local count=0

  [[ -f "$manifest" ]] || die "manifest not written: $manifest"
  grep -q '#EXT-X-ENDLIST' "$manifest" || die "manifest is missing #EXT-X-ENDLIST (not a complete VOD playlist): $manifest"

  # Every URI the playlist references must exist on disk.
  while read -r uri; do
    [[ -z "$uri" ]] && continue
    count=$(( count + 1 ))
    if [[ ! -s "${dir}/${uri}" ]]; then
      warn "manifest references a missing or empty segment: $uri"
      missing=$(( missing + 1 ))
    fi
  done < <(grep -v '^#' "$manifest" | tr -d '\r' | sed '/^[[:space:]]*$/d')

  (( count > 0 )) || die "manifest references no segments: $manifest"
  (( missing == 0 )) || die "${missing} segment(s) referenced by the manifest are missing"

  # The declared media duration must decode as a finite positive number.
  local mdur
  mdur="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$manifest" 2>/dev/null || true)"
  if printf '%s' "$mdur" | grep -Eq '^[0-9]+(\.[0-9]+)?$' && awk -v d="$mdur" 'BEGIN { exit (d > 0.5) ? 0 : 1 }'; then
    log "manifest ok: ${count} segments, duration ${mdur}s"
  else
    warn "could not decode a duration from the manifest (fine for some hosts): '${mdur:-<empty>}'"
  fi
}

# ---------------------------------------------------------------------------
# Size summary
# ---------------------------------------------------------------------------

human() { # bytes -> human readable
  awk -v b="${1:-0}" 'BEGIN {
    split("B KiB MiB GiB", u, " ");
    i = 1;
    while (b >= 1024 && i < 4) { b /= 1024; i++ }
    printf "%.2f %s", b, u[i]
  }'
}

size_of() {
  local p="$1"
  if [[ -f "$p" ]]; then
    local bytes
    bytes="$(wc -c < "$p" | tr -d ' ')"
    printf '%10s  %s\n' "$(human "$bytes")" "$p"
  fi
}

summary() {
  log "published asset sizes (compare against your host's bundle limit)"
  size_of "$FALLBACK"
  size_of "$MANIFEST"
  local seg_total=0 seg f
  for f in "$HLS_DIR"/joined_*.ts; do
    [[ -f "$f" ]] || continue
    seg="$(wc -c < "$f" | tr -d ' ')"
    seg_total=$(( seg_total + seg ))
  done
  if (( seg_total > 0 )); then
    printf '%10s  %s\n' "$(human "$seg_total")" "${HLS_DIR}/joined_*.ts ($(ls -1 "$HLS_DIR"/joined_*.ts | wc -l | tr -d ' ') segments)"
  fi

  local mp4_total=0
  [[ -f "$FALLBACK" ]] && mp4_total="$(wc -c < "$FALLBACK" | tr -d ' ')"
  local grand=$(( mp4_total + seg_total + $( [[ -f "$MANIFEST" ]] && wc -c < "$MANIFEST" | tr -d ' ' || echo 0 ) ))
  printf '\n%10s  TOTAL (mp4 + hls + manifest)\n' "$(human "$grand")"
  warn "keep this total (plus bundle) comfortably below the hosting limit;"
  warn "a source master must never be added to public/ or to git."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

build_audio_args

if (( SKIP_ENCODE == 1 )); then
  log "--skip-encode: using existing fallback/chunks if present"
  if [[ ! -f "$FALLBACK" ]]; then
    build_fallback
  fi
else
  encode_chunks
  build_fallback
fi

build_hls
validate_manifest "$MANIFEST" "$HLS_DIR"

# Chunks are scratch; clean them only after everything validated.
log "cleaning intermediate chunks"
rm -rf "$CHUNK_DIR"
rmdir "$TMP_DIR" 2>/dev/null || true

summary

log "done."
