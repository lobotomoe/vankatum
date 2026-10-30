-- Hyphenate a word list with LuaTeX's own hyphenation routine (lang.hyphenate)
-- and hyph-hy.tex loaded verbatim: \patterns and \hyphenation as TeX reads them.
-- Run by luatex.tex; paths come from the environment. Output: one line per word,
-- "-" at each discretionary TeX inserted.
local tex_path = assert(os.getenv("E2E_TEX"), "E2E_TEX not set")
local words_path = assert(os.getenv("E2E_WORDS"), "E2E_WORDS not set")
local out_path = assert(os.getenv("E2E_OUT"), "E2E_OUT not set")

local source = assert(io.open(tex_path)):read("a")
local function block(name)
  local body = source:match("\\" .. name .. "%s*{(.-)\n}")
  return body and body:gsub("%%[^\n]*", "") or nil
end

local language = lang.new()
-- hjcodes map both cases to the lowercase letter the patterns are written in.
for code = 0x0531, 0x0556 do lang.sethjcode(language, code, code + 0x30) end
for code = 0x0561, 0x0587 do lang.sethjcode(language, code, code) end
language:patterns(assert(block("patterns"), "no \\patterns in " .. tex_path))
local exceptions = block("hyphenation")
if exceptions then language:hyphenation(exceptions) end

local GLYPH, DISC = node.id("glyph"), node.id("disc")
local out = assert(io.open(out_path, "w"))
for word in io.lines(words_path) do
  local head = node.new("glue")
  local tail = head
  for _, code in utf8.codes(word) do
    local glyph = node.new("glyph")
    glyph.subtype = 1 -- "character": TeX hyphenates only character glyphs
    glyph.char, glyph.font, glyph.lang = code, font.current(), language:id()
    glyph.left, glyph.right, glyph.uchyph = 1, 2, 1 -- \lefthyphenmin=1 \righthyphenmin=2 \uchyph=1
    head, tail = node.insert_after(head, tail, glyph)
  end
  head, tail = node.insert_after(head, tail, node.new("glue"))
  lang.hyphenate(head, tail)
  local parts = {}
  for n in node.traverse(head) do
    if n.id == GLYPH then parts[#parts + 1] = utf8.char(n.char)
    elseif n.id == DISC then parts[#parts + 1] = "-" end
  end
  out:write(table.concat(parts), "\n")
  node.flush_list(head)
end
out:close()
