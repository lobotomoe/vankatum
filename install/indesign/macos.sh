#!/usr/bin/env bash
#
# Install (or remove) the vankatum Armenian hyphenation dictionary in Adobe
# InDesign on macOS. Quit InDesign first; run with sudo (the InDesign folder
# belongs to root).
#
#   sudo ./macos.sh [path/to/hyph_hy_AM.dic]   install (downloads the latest
#                                              release when no path is given)
#   sudo ./macos.sh --uninstall                restore Adobe's original plugin
#
# InDesign's Hunspell plugin has no Armenian. Adding a language means listing it
# in the plugin's Info.plist (Adobe's documented method), but Info.plist is
# sealed by the plugin's code signature, and with the seal broken InDesign 2026
# hyphenates no Hunspell language at all, English included. So the install
# keeps a full copy of Adobe's plugin, edits it, and signs it again locally
# (ad hoc); InDesign allows plugins not signed by Adobe. --uninstall puts the
# untouched copy back, Adobe's signature included.
#
# Set INDESIGN to pick an installation other than the newest one found.
set -euo pipefail

LOCALE="hy_AM"
RELEASE_URL="https://github.com/lobotomoe/vankatum/releases/latest/download/hyph_hy_AM.dic"
PLUGIN_REL="Resources/Dictionaries/LILO/Linguistics/Providers/Plugins2/AdobeHunspellPlugin.bundle"
ADOBE_TEAM="JQ525L2MZD"
BUDDY=/usr/libexec/PlistBuddy

if [ "$(id -u)" -ne 0 ]; then
  echo "error: run with sudo (the InDesign folder belongs to root)" >&2
  exit 1
fi

if [ -z "${INDESIGN:-}" ]; then
  INDESIGN="$(find /Applications -maxdepth 1 -type d -name 'Adobe InDesign 20*' | sort | tail -n 1)"
fi
NAME="$(basename "$INDESIGN")"
PLUGIN="$INDESIGN/$PLUGIN_REL"
if [ -z "$INDESIGN" ] || [ ! -d "$PLUGIN" ]; then
  echo "error: no Adobe InDesign with a Hunspell plugin found (set INDESIGN=/Applications/Adobe InDesign 20XX)" >&2
  exit 1
fi
# Match the app's own executable: its crash reporter stays resident after a quit.
if pgrep -f "$INDESIGN/$NAME.app/Contents/MacOS/$NAME\$" >/dev/null; then
  echo "error: quit InDesign first" >&2
  exit 1
fi

PLIST="$PLUGIN/Contents/Info.plist"
DICTIONARY_DIR="$PLUGIN/Contents/SharedSupport/Dictionaries/$LOCALE"
# Outside InDesign's folder, so InDesign never sees the copy as a second plugin.
BACKUP_ROOT="/Library/Application Support/vankatum"
BACKUP="$BACKUP_ROOT/indesign/$NAME/AdobeHunspellPlugin.bundle"
# Left by vankatum 0.2.3, which edited Info.plist in place.
LEGACY_PLIST_BACKUP="$PLIST.vankatum-backup"

signed_by_adobe() {
  codesign --verify --strict "$1" 2>/dev/null || return 1
  local details
  details="$(codesign --display --verbose=2 "$1" 2>&1)"
  grep -qx "TeamIdentifier=$ADOBE_TEAM" <<<"$details"
}

undo_legacy_install() {
  if [ -f "$LEGACY_PLIST_BACKUP" ]; then
    mv "$LEGACY_PLIST_BACKUP" "$PLIST"
    rm -rf "$DICTIONARY_DIR"
    echo "undid the vankatum 0.2.3 install"
  fi
}

if [ "${1:-}" = "--uninstall" ]; then
  if [ -d "$BACKUP" ]; then
    rm -rf "$PLUGIN"
    ditto "$BACKUP" "$PLUGIN"
    rm -rf "$BACKUP"
    find "$BACKUP_ROOT" -type d -empty -delete
  else
    undo_legacy_install
  fi
  if ! signed_by_adobe "$PLUGIN"; then
    echo "error: $PLUGIN is still not Adobe's signed original; reinstall InDesign from Creative Cloud" >&2
    exit 1
  fi
  echo "restored Adobe's Hunspell plugin in $INDESIGN"
  exit 0
fi

# An uninstalled InDesign can leave its support folder behind without the app.
if [ ! -d "$INDESIGN/$NAME.app" ]; then
  echo "error: $INDESIGN has no $NAME.app (InDesign is not installed there)" >&2
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

if [ ! -d "$BACKUP" ]; then
  undo_legacy_install
  # Only Adobe's own plugin is worth keeping: --uninstall restores this copy.
  if ! signed_by_adobe "$PLUGIN"; then
    echo "error: $PLUGIN is not Adobe's signed original, so there is nothing safe to back up;" >&2
    echo "       reinstall InDesign from Creative Cloud, then run this again" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$BACKUP")"
  ditto "$PLUGIN" "$BACKUP"
fi

mkdir -p "$DICTIONARY_DIR"
install -m 0644 "$SOURCE" "$DICTIONARY_DIR/hyph_$LOCALE.dic"
if ! "$BUDDY" -c "Print :ALPlugInLanguages:HyphenationService" "$PLIST" | grep -qx "[[:space:]]*$LOCALE"; then
  "$BUDDY" -c "Add :ALPlugInLanguages:HyphenationService:0 string $LOCALE" "$PLIST"
fi
codesign --force --sign - "$PLUGIN"
codesign --verify --strict "$PLUGIN"

echo "installed Armenian hyphenation into $INDESIGN"
echo "Adobe's original plugin is kept in $BACKUP"
echo "start InDesign and set Character > Language to Armenian (Armenia)"
