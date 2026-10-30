#!/usr/bin/env bash
#
# Remove the vankatum Armenian hyphenation dictionary that vankatum 0.2.3
# installed into Adobe InDesign on macOS: restores the Hunspell plugin's
# Info.plist from its backup and deletes the hy_AM folder. Quit InDesign first;
# run with sudo (the InDesign folder belongs to root).
#
#   sudo ./macos.sh --uninstall
#
# Installing is disabled (see below).
#
# Set INDESIGN to pick an installation other than the newest one found.
set -euo pipefail

LOCALE="hy_AM"
RELEASE_URL="https://github.com/lobotomoe/vankatum/releases/latest/download/hyph_hy_AM.dic"
PLUGIN_REL="Resources/Dictionaries/LILO/Linguistics/Providers/Plugins2/AdobeHunspellPlugin.bundle/Contents"

if [ "$(id -u)" -ne 0 ]; then
  echo "error: run with sudo (the InDesign folder belongs to root)" >&2
  exit 1
fi

if [ -z "${INDESIGN:-}" ]; then
  INDESIGN="$(find /Applications -maxdepth 1 -type d -name 'Adobe InDesign 20*' | sort | tail -n 1)"
fi
if [ -z "$INDESIGN" ] || [ ! -d "$INDESIGN/$PLUGIN_REL" ]; then
  echo "error: no Adobe InDesign with a Hunspell provider found (set INDESIGN=/Applications/Adobe InDesign 20XX)" >&2
  exit 1
fi
# Match the app's own executable: its crash reporter stays resident after a quit.
if pgrep -f "$INDESIGN/$(basename "$INDESIGN").app/Contents/MacOS/$(basename "$INDESIGN")\$" >/dev/null; then
  echo "error: quit InDesign first" >&2
  exit 1
fi

PLUGIN="$INDESIGN/$PLUGIN_REL"
PLIST="$PLUGIN/Info.plist"
BACKUP="$PLIST.vankatum-backup"
TARGET_DIR="$PLUGIN/SharedSupport/Dictionaries/$LOCALE"
BUDDY=/usr/libexec/PlistBuddy

has_locale() {
  "$BUDDY" -c "Print :ALPlugInLanguages:HyphenationService" "$PLIST" | grep -qx "[[:space:]]*$LOCALE"
}

if [ "${1:-}" = "--uninstall" ]; then
  if [ -f "$BACKUP" ]; then
    mv "$BACKUP" "$PLIST"
  fi
  rm -rf "$TARGET_DIR"
  echo "removed Armenian hyphenation from $INDESIGN"
  exit 0
fi

# Installing is disabled: Info.plist is sealed by the plugin's code signature,
# and once it is edited InDesign 2026 hyphenates no Hunspell language at all
# (English included). Only --uninstall, which restores the original file, runs.
echo "error: installing is disabled, it breaks hyphenation in InDesign 2026 (see README)" >&2
exit 1

# An uninstalled InDesign can leave its support folder behind without the app.
if [ ! -d "$INDESIGN/$(basename "$INDESIGN").app" ]; then
  echo "error: $INDESIGN has no $(basename "$INDESIGN").app (InDesign is not installed there)" >&2
  exit 1
fi

SOURCE="${1:-}"
if [ -z "$SOURCE" ]; then
  SOURCE="$(mktemp -t hyph_hy_AM)"
  trap 'rm -f "$SOURCE"' EXIT
  curl -fsSL "$RELEASE_URL" -o "$SOURCE"
fi
if [ "$(head -n 1 "$SOURCE")" != "UTF-8" ]; then
  echo "error: $SOURCE is not a UTF-8 libhyphen dictionary" >&2
  exit 1
fi

mkdir -p "$TARGET_DIR"
install -m 0644 "$SOURCE" "$TARGET_DIR/hyph_$LOCALE.dic"
if ! has_locale; then
  [ -f "$BACKUP" ] || cp -p "$PLIST" "$BACKUP"
  "$BUDDY" -c "Add :ALPlugInLanguages:HyphenationService:0 string $LOCALE" "$PLIST"
fi
echo "installed Armenian hyphenation into $INDESIGN"
echo "start InDesign and set Character > Language to Armenian"
