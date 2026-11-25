package com.openframe.management.osupdate.parser;

import com.openframe.management.osupdate.MsrcKbArticle;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import org.junit.jupiter.api.Test;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class MsrcCvrfDocumentParserTest {

    private final MsrcCvrfDocumentParser parser =
            new MsrcCvrfDocumentParser(new JsonMapper(), new MsrcWindowsBuildParser());

    @Test
    void parse_novemberBulletin_kbWithItsCvesAndRatingNotExploited() throws IOException {
        // execution
        Map<String, MsrcKbArticle> kbArticles;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Nov.json")) {
            kbArticles = parser.parse(cvrfDocument).getKbArticles();
        }

        // verifications
        assertThat(kbArticles).containsOnlyKeys("5132061");
        MsrcKbArticle kbArticle = kbArticles.get("5132061");
        assertThat(kbArticle.getCveIds()).containsExactly("CVE-2026-113766", "CVE-2026-96157");
        assertThat(kbArticle.getSeverity()).isEqualTo(OsUpdateSeverity.IMPORTANT);
        assertThat(kbArticle.isExploited()).isFalse();
    }

    @Test
    void parse_octoberBulletin_kbOfAnExploitedCveIsExploited() throws IOException {
        // execution
        Map<String, MsrcKbArticle> kbArticles;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Oct.json")) {
            kbArticles = parser.parse(cvrfDocument).getKbArticles();
        }

        // verifications
        MsrcKbArticle kbArticle = kbArticles.get("5126868");
        assertThat(kbArticle.getCveIds()).containsExactly("CVE-2026-96951");
        assertThat(kbArticle.isExploited()).isTrue();
    }

    @Test
    void parse_ratingsOfOtherProducts_notCountedForTheKb() {
        // setup
        String cvrfDocument = """
                {"Vulnerability":[{"CVE":"CVE-2026-1",
                  "Threats":[{"Type":3,"Description":{"Value":"Critical"},"ProductID":["other"]},
                             {"Type":3,"Description":{"Value":"Moderate"},"ProductID":["fixed"]}],
                  "Remediations":[{"Type":2,"Description":{"Value":"5000001"},"ProductID":["fixed"]},
                                  {"Type":2,"Description":{"Value":"Release Notes"},"ProductID":["other"]},
                                  {"Type":3}]}]}""";

        // execution
        Map<String, MsrcKbArticle> kbArticles = parser.parse(stream(cvrfDocument)).getKbArticles();

        // verifications
        assertThat(kbArticles).containsOnlyKeys("5000001");
        assertThat(kbArticles.get("5000001").getSeverity()).isEqualTo(OsUpdateSeverity.MODERATE);
    }

    @Test
    void parse_documentWithoutVulnerabilities_noKb() {
        // execution
        Map<String, MsrcKbArticle> kbArticles =
                parser.parse(stream("{\"DocumentTitle\":{\"Value\":\"x\"}}")).getKbArticles();

        // verifications
        assertThat(kbArticles).isEmpty();
    }

    @Test
    void parse_truncatedDocument_failsInsteadOfReturningAPart() throws IOException {
        // setup
        byte[] wholeDocument;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Nov.json")) {
            wholeDocument = cvrfDocument.readAllBytes();
        }
        byte[] truncatedDocument = Arrays.copyOf(wholeDocument, wholeDocument.length / 2);

        // execution / verifications
        assertThrows(JacksonException.class, () -> parser.parse(new ByteArrayInputStream(truncatedDocument)));
    }

    @Test
    void parse_notAnObject_fails() {
        // execution / verifications
        assertThrows(JacksonException.class, () -> parser.parse(stream("[]")));
    }

    @Test
    void parse_exploitStatusThreat_kbExploited() {
        // setup
        String cvrfDocument = """
                {"Vulnerability":[{"CVE":"CVE-2026-1",
                  "Threats":[{"Type":1,"Description":{"Value":"Publicly Disclosed:No;Exploited:Yes"}}],
                  "Remediations":[{"Type":2,"Description":{"Value":"5000001"}}]}]}""";

        // execution
        Map<String, MsrcKbArticle> kbArticles = parser.parse(stream(cvrfDocument)).getKbArticles();

        // verifications
        assertThat(kbArticles.get("5000001").isExploited()).isTrue();
        assertThat(kbArticles.get("5000001").getSeverity()).isNull();
    }

    static InputStream fixture(String name) {
        return MsrcCvrfDocumentParserTest.class.getResourceAsStream("/osupdate/enrichment/" + name);
    }

    private static InputStream stream(String json) {
        return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
    }
}
