/*
 * Hyphenate a word list with the real libhyphen, called the way LibreOffice's
 * lingucomponent calls it: hnj_hyphen_hyphenate3 with the dictionary's own
 * minima. Words must already be lowercase (LibreOffice lowercases first).
 *
 * Output, one line per word: the word with "-" after each standard break and
 * "[replacement]" after each non-standard one (libhyphen's "=" marks the line end).
 * For a UTF-8 dictionary libhyphen indexes hyphens/rep by character, not byte.
 *
 * Build: cc -O2 -I<hyphen-src> libhyphen.c <hyphen-src>/hyphen.c <hyphen-src>/hnjalloc.c
 * Usage: libhyphen <dictionary.dic> <words.txt>
 */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "hyphen.h"

#define MAX_WORD_BYTES 1024

static size_t utf8_length(const char *s, size_t i, size_t n) {
  size_t len = 1;
  while (i + len < n && (s[i + len] & 0xC0) == 0x80) len++;
  return len;
}

int main(int argc, char **argv) {
  if (argc != 3) {
    fprintf(stderr, "usage: libhyphen <dictionary.dic> <words.txt>\n");
    return 2;
  }
  HyphenDict *dict = hnj_hyphen_load(argv[1]);
  if (dict == NULL) {
    fprintf(stderr, "cannot load dictionary %s\n", argv[1]);
    return 1;
  }
  FILE *words = fopen(argv[2], "r");
  if (words == NULL) {
    perror(argv[2]);
    return 1;
  }

  char word[MAX_WORD_BYTES];
  while (fgets(word, sizeof word, words) != NULL) {
    size_t n = strcspn(word, "\r\n");
    if (word[n] != '\n' && word[n] != '\r' && !feof(words)) {
      fprintf(stderr, "word longer than %d bytes\n", MAX_WORD_BYTES - 1);
      return 1;
    }
    word[n] = '\0';
    if (n == 0) {
      putchar('\n');
      continue;
    }
    char *hyphens = calloc(n + 5, 1);
    char *hyphenated = calloc(n * 4 + 8, 1);
    char **rep = NULL;
    int *pos = NULL;
    int *cut = NULL;
    if (hyphens == NULL || hyphenated == NULL) {
      fprintf(stderr, "out of memory\n");
      return 1;
    }
    if (hnj_hyphen_hyphenate3(dict, word, (int)n, hyphens, hyphenated, &rep, &pos, &cut,
                              dict->lhmin, dict->rhmin, dict->clhmin, dict->crhmin) != 0) {
      fprintf(stderr, "hyphenation failed: %s\n", word);
      return 1;
    }
    size_t letter = 0;
    for (size_t i = 0; i < n; letter++) {
      size_t len = utf8_length(word, i, n);
      fwrite(word + i, 1, len, stdout);
      i += len;
      if (hyphens[letter] & 1) {
        if (rep != NULL && rep[letter] != NULL) printf("[%s]", rep[letter]);
        else putchar('-');
      }
    }
    putchar('\n');
    if (rep != NULL) {
      for (size_t i = 0; i < n; i++) free(rep[i]);
      free(rep);
      free(pos);
      free(cut);
    }
    free(hyphens);
    free(hyphenated);
  }
  fclose(words);
  hnj_hyphen_free(dict);
  return 0;
}
