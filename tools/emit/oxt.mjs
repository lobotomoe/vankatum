/**
 * Package hyph_hy_AM.dic as a LibreOffice / OpenOffice dictionary extension
 * (vankatum-hy.oxt). The official LibreOffice builds load hyphenation
 * dictionaries only from extensions, so this is what a user installs with
 * Tools > Extensions > Add (or a double click). Layout follows the dictionaries
 * LibreOffice itself ships (github.com/LibreOffice/dictionaries).
 *
 * Usage: node tools/emit/oxt.mjs <hyph_hy_AM.dic> <vankatum-hy.oxt>
 * Requires the `zip` command.
 */

import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../..");
const DIC_NAME = "hyph_hy_AM.dic";
/** Eastern Armenian; "hy" alone so text tagged without a region matches too. */
const LOCALES = "hy hy-AM";

const MANIFEST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE manifest:manifest PUBLIC "-//OpenOffice.org//DTD Manifest 1.0//EN" "Manifest.dtd">
<manifest:manifest xmlns:manifest="http://openoffice.org/2001/manifest">
    <manifest:file-entry manifest:media-type="application/vnd.sun.star.configuration-data"
        manifest:full-path="dictionaries.xcu"/>
</manifest:manifest>
`;

const DICTIONARIES = `<?xml version="1.0" encoding="UTF-8"?>
<oor:component-data xmlns:oor="http://openoffice.org/2001/registry" xmlns:xs="http://www.w3.org/2001/XMLSchema" oor:name="Linguistic" oor:package="org.openoffice.Office">
 <node oor:name="ServiceManager">
    <node oor:name="Dictionaries">
        <node oor:name="HyphDic_hy_AM_vankatum" oor:op="fuse">
            <prop oor:name="Locations" oor:type="oor:string-list">
                <value>%origin%/${DIC_NAME}</value>
            </prop>
            <prop oor:name="Format" oor:type="xs:string">
                <value>DICT_HYPH</value>
            </prop>
            <prop oor:name="Locales" oor:type="oor:string-list">
                <value>${LOCALES}</value>
            </prop>
        </node>
    </node>
 </node>
</oor:component-data>
`;

function description(version) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<description xmlns="http://openoffice.org/extensions/description/2006" xmlns:d="http://openoffice.org/extensions/description/2006" xmlns:xlink="http://www.w3.org/1999/xlink">
    <version value="${version}" />
    <identifier value="moe.loboto.vankatum.hy.hyphenation" />
    <display-name>
        <name lang="en-US">Armenian hyphenation (vankatum)</name>
        <name lang="hy">Հայերենի տողադարձ (vankatum)</name>
    </display-name>
    <platform value="all" />
    <dependencies>
        <OpenOffice.org-minimal-version value="3.0" d:name="OpenOffice.org 3.0" />
    </dependencies>
    <publisher>
        <name xlink:href="https://github.com/lobotomoe/vankatum" lang="en-US">vankatum</name>
    </publisher>
</description>
`;
}

async function main() {
  const [dicArg, oxtArg] = process.argv.slice(2);
  if (!dicArg || !oxtArg) throw new Error("usage: oxt.mjs <hyph_hy_AM.dic> <vankatum-hy.oxt>");
  const dicPath = resolve(dicArg);
  const oxtPath = resolve(oxtArg);
  const { version } = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));

  const stage = await mkdtemp(join(tmpdir(), "vankatum-oxt-"));
  try {
    await mkdir(join(stage, "META-INF"));
    await writeFile(join(stage, "META-INF/manifest.xml"), MANIFEST, "utf8");
    await writeFile(join(stage, "description.xml"), description(version), "utf8");
    await writeFile(join(stage, "dictionaries.xcu"), DICTIONARIES, "utf8");
    await copyFile(dicPath, join(stage, DIC_NAME));
    await copyFile(join(ROOT, "LICENSE"), join(stage, "LICENSE"));
    await rm(oxtPath, { force: true });
    // -X: leave out platform-specific extra attributes (macOS resource forks, uid/gid).
    execFileSync("zip", ["-X", "-q", "-r", oxtPath, "."], { cwd: stage, stdio: "inherit" });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
  console.log(`-> ${oxtPath} (version ${version})`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
