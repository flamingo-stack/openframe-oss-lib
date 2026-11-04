package com.openframe.api.service.rmm.software;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.stream.IntStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class WingetNameNormalizerTest {

    private static final String TEST_DATA = "/winget/name-normalization/";

    @ParameterizedTest
    @MethodSource("wingetTestData")
    void normalize_wingetsOwnTestData_sameNameAsWinget(String displayName, String wingetName) {
        // setup
        // execution
        WingetNameNormalizer.NormalizedName normalized = WingetNameNormalizer.normalize(displayName);

        // verifications
        assertThat(normalized.getName()).isEqualTo(wingetName);
    }

    @Test
    void searchNames_nameWithArchitectureAndLocale_withArchitectureFirstThenWithout() {
        // setup
        String displayName = "Mozilla Firefox (x64 en-US)";

        // execution
        List<String> names = WingetNameNormalizer.searchNames(displayName);

        // verifications
        assertThat(names).containsExactly("mozillafirefox(X64)", "mozillafirefox");
    }

    @Test
    void searchNames_versionInTheName_versionDropped() {
        // setup
        String displayName = "7-Zip 23.01 (x64)";

        // execution
        List<String> names = WingetNameNormalizer.searchNames(displayName);

        // verifications
        assertThat(names).containsExactly("7zip(X64)", "7zip");
    }

    @Test
    void searchNames_noArchitecture_onlyTheName() {
        // setup
        String displayName = "Google Chrome";

        // execution
        List<String> names = WingetNameNormalizer.searchNames(displayName);

        // verifications
        assertThat(names).containsExactly("googlechrome");
    }

    @Test
    void searchNames_legalEntitySuffixAndSymbols_dropped() {
        // setup
        String displayName = "Notepad++ Inc";

        // execution
        List<String> names = WingetNameNormalizer.searchNames(displayName);

        // verifications
        assertThat(names).containsExactly("notepad");
    }

    @Test
    void searchNames_nothingLeftAfterNormalizing_noNames() {
        // setup
        String displayName = " (1.0) ";

        // execution
        List<String> names = WingetNameNormalizer.searchNames(displayName);

        // verifications
        assertThat(names).isEmpty();
    }

    private static Stream<Arguments> wingetTestData() {
        List<String> displayNames = lines("InputNames.txt");
        List<String> wingetIds = lines("NormalizationInitialIds.txt");
        return IntStream.range(0, displayNames.size())
                .mapToObj(line -> testCase(displayNames, wingetIds, line));
    }

    private static Arguments testCase(List<String> displayNames, List<String> wingetIds, int line) {
        String displayName = displayNames.get(line);
        String wingetId = wingetIds.get(line);
        String wingetName = wingetId.substring(wingetId.indexOf('.') + 1);
        return Arguments.of(displayName, wingetName);
    }

    private static List<String> lines(String file) {
        try (InputStream data = WingetNameNormalizerTest.class.getResourceAsStream(TEST_DATA + file)) {
            byte[] bytes = data.readAllBytes();
            String text = new String(bytes, StandardCharsets.UTF_8);
            return text.lines().toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }
}
