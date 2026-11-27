package com.openframe.api.service.rmm.osupdate.release;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class WindowsReleaseParserTest {

    private final WindowsReleaseParser windowsReleaseParser = new WindowsReleaseParser(JsonMapper.builder().build());

    @Test
    void parse_trimmedRealAnswer_everyCycleWithTheBaseBuildAndTheEndOfSupport() {
        // setup
        InputStream answer = getClass().getResourceAsStream("/osupdate/release/endoflife-windows.json");

        // execution
        List<WindowsRelease> windowsReleases = windowsReleaseParser.parse(answer);

        // verifications
        assertThat(windowsReleases).extracting(WindowsRelease::getCycle).containsExactly(
                "11-25h2-e", "11-25h2-w", "11-24h2-iot-lts", "11-24h2-e-lts", "11-24h2-e", "11-24h2-w",
                "11-23h2-w", "10-22h2");
        assertThat(windowsReleases).filteredOn(windowsRelease -> windowsRelease.getCycle().equals("11-24h2-w"))
                .singleElement()
                .isEqualTo(WindowsRelease.builder()
                        .cycle("11-24h2-w")
                        .releaseLabel("11 24H2 (W)")
                        .latestBuild("26100")
                        .endOfSupportAt(LocalDate.parse("2026-10-13"))
                        .build());
        assertThat(windowsReleases).filteredOn(windowsRelease -> windowsRelease.getCycle().equals("10-22h2"))
                .singleElement()
                .satisfies(windowsRelease -> {
                    assertThat(windowsRelease.getLatestBuild()).isEqualTo("19045");
                    assertThat(windowsRelease.getEndOfSupportAt()).isEqualTo(LocalDate.parse("2025-10-14"));
                });
    }

    @Test
    void parse_eolAsBooleanAndRowWithoutCycle_noDateAndTheRowSkipped() {
        // setup
        String answer = """
                [{"cycle": "11-27h2-w", "latest": "10.0.27000", "eol": false}, {"latest": "10.0.1"}]
                """;

        // execution
        List<WindowsRelease> windowsReleases = windowsReleaseParser.parse(toStream(answer));

        // verifications
        assertThat(windowsReleases).singleElement().satisfies(windowsRelease -> {
            assertThat(windowsRelease.getCycle()).isEqualTo("11-27h2-w");
            assertThat(windowsRelease.getEndOfSupportAt()).isNull();
        });
    }

    @Test
    void parse_answerIsNoList_failsInsteadOfAnsweringNoRelease() {
        // setup
        InputStream answer = toStream("{\"message\": \"rate limited\"}");

        // execution / verifications
        assertThrows(IllegalArgumentException.class, () -> windowsReleaseParser.parse(answer));
    }

    private static InputStream toStream(String answer) {
        return new ByteArrayInputStream(answer.getBytes(StandardCharsets.UTF_8));
    }
}
