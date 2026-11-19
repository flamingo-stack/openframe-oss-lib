package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import org.apache.commons.lang3.StringUtils;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toSet;

final class BrewSharedWord {

    private static final Set<String> WORDS_OF_ANY_APP =
            Set.of("app", "the", "for", "mac", "macos", "desktop", "helper", "and", "pro");
    private static final int MIN_WORD_LENGTH = 3;
    private static final String NOT_A_WORD = "[^a-z0-9]+";
    private static final String VARIANT_SEPARATOR = "@";

    private BrewSharedWord() {
    }

    // a word counts inside a longer one as well: "code" is found in "vscode"
    static boolean isSharedBy(Set<String> lowerCaseAppNames, PackageCatalogEntry cask) {
        String token = cask.getPackageId();
        String baseToken = StringUtils.substringBefore(token, VARIANT_SEPARATOR);
        List<String> displayNames = Stream.ofNullable(cask.getName())
                .map(displayName -> displayName.toLowerCase(Locale.ROOT))
                .toList();
        List<String> ownNames = Stream.of(List.of(baseToken), displayNames, cask.getAppNames())
                .flatMap(List::stream)
                .toList();
        List<String> allNames = Stream.of(List.of(token), displayNames, cask.getAppNames(), cask.getWeakAppNames())
                .flatMap(List::stream)
                .toList();
        return hasAWordOf(allNames, lowerCaseAppNames) || hasAWordOf(lowerCaseAppNames, ownNames);
    }

    private static boolean hasAWordOf(Collection<String> texts, Collection<String> names) {
        Set<String> words = names.stream().flatMap(BrewSharedWord::wordsOf).collect(toSet());
        List<String> lettersAndDigits = texts.stream().map(text -> text.replaceAll(NOT_A_WORD, "")).toList();
        return words.stream().anyMatch(word -> lettersAndDigits.stream().anyMatch(text -> text.contains(word)));
    }

    private static Stream<String> wordsOf(String name) {
        return Arrays.stream(name.split(NOT_A_WORD))
                .filter(word -> word.length() >= MIN_WORD_LENGTH)
                .filter(word -> !WORDS_OF_ANY_APP.contains(word));
    }
}
