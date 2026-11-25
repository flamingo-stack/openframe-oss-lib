package com.openframe.management.osupdate.parser;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;

import static com.openframe.management.osupdate.parser.MsrcCvrfDocumentParserTest.fixture;
import static org.assertj.core.api.Assertions.assertThat;

class MsrcWindowsBuildParserTest {

    private final MsrcCvrfDocumentParser parser =
            new MsrcCvrfDocumentParser(new JsonMapper(), new MsrcWindowsBuildParser());

    @Test
    void parse_novemberBulletin_latestBuildPerWindowsVersionWithoutThePrefix() throws IOException {
        // execution
        Map<String, String> latestWindowsBuilds;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Nov.json")) {
            latestWindowsBuilds = parser.parse(cvrfDocument).getLatestWindowsBuilds();
        }

        // verifications
        assertThat(latestWindowsBuilds)
                .containsExactlyInAnyOrderEntriesOf(Map.of("11 24H2", "26100.9974", "11 25H2", "26200.9974"));
    }

    @Test
    void parse_octoberBulletin_serverOfTheSameFixSkipped() throws IOException {
        // execution
        Map<String, String> latestWindowsBuilds;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Oct.json")) {
            latestWindowsBuilds = parser.parse(cvrfDocument).getLatestWindowsBuilds();
        }

        // verifications
        assertThat(latestWindowsBuilds).containsExactlyInAnyOrderEntriesOf(Map.of("10 1607", "14393.9612"));
    }

    @Test
    void parse_fixesOfEveryArchitectureAndOlderFixes_theNumericallyHighestBuildOfTheVersion() {
        // setup
        String cvrfDocument = """
                {"ProductTree":{"FullProductName":[
                   {"ProductID":"1","Value":"Windows 11 Version 24H2 for x64-based Systems"},
                   {"ProductID":"2","Value":"Windows 11 Version 24H2 for ARM64-based Systems"},
                   {"ProductID":"3","Value":"Windows 11 version 26H1 for x64-based Systems"},
                   {"ProductID":"4","Value":"Windows 10 Version 22H2 for 32-bit Systems"}]},
                 "Vulnerability":[
                  {"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"Description":{"Value":"5000001"},"ProductID":["1"],"FixedBuild":"10.0.26100.9974"},
                    {"Type":2,"Description":{"Value":"5000002"},"ProductID":["2"],"FixedBuild":"10.0.26100.10075"},
                    {"Type":2,"Description":{"Value":"5000003"},"ProductID":["3"],"FixedBuild":"10.0.28000.3501"},
                    {"Type":2,"Description":{"Value":"5000005"},"ProductID":["4"],"FixedBuild":"10.0.19045.7807"}]},
                  {"CVE":"CVE-2026-2","Remediations":[
                    {"Type":2,"Description":{"Value":"5000000"},"ProductID":["1","2"],"FixedBuild":"10.0.26100.9711"},
                    {"Type":2,"Description":{"Value":"5000004"},"ProductID":["4"],"FixedBuild":"10.0.19045.7846"}]}]}""";

        // execution
        Map<String, String> latestWindowsBuilds = parser.parse(stream(cvrfDocument)).getLatestWindowsBuilds();

        // verifications
        assertThat(latestWindowsBuilds).containsExactlyInAnyOrderEntriesOf(
                Map.of("11 24H2", "26100.10075", "11 26H1", "28000.3501", "10 22H2", "19045.7846"));
    }

    @Test
    void parse_productsThatAreNoWindowsVersionAndBuildsThatAreNoOsBuild_skipped() {
        // setup
        String cvrfDocument = """
                {"ProductTree":{"FullProductName":[
                   {"ProductID":"1","Value":"Windows Server 2025"},
                   {"ProductID":"2","Value":"HEVC Video Extensions on Windows 11 version 26H1 for x64-based Systems"},
                   {"ProductID":"3","Value":"Windows 10 for 32-bit Systems"},
                   {"ProductID":"4","Value":"Windows 11 Version 24H2 for x64-based Systems"},
                   {"ProductID":"5"}]},
                 "Vulnerability":[{"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"ProductID":["1","2","3","5","unknown"],"FixedBuild":"10.0.26100.33822"},
                    {"Type":2,"ProductID":["4"],"FixedBuild":"https://aka.ms/OfficeSecurityReleases"},
                    {"Type":2,"ProductID":["4"],"FixedBuild":"6.3.9600.23470"},
                    {"Type":2,"ProductID":["4"],"FixedBuild":"10.0.26100"},
                    {"Type":2,"ProductID":["4"]},
                    {"Type":2,"FixedBuild":"10.0.26100.9974"},
                    {"Type":6,"ProductID":["4"],"FixedBuild":"10.0.26100.9974"}]}]}""";

        // execution
        Map<String, String> latestWindowsBuilds = parser.parse(stream(cvrfDocument)).getLatestWindowsBuilds();

        // verifications
        assertThat(latestWindowsBuilds).isEmpty();
    }

    @Test
    void parse_documentWithoutProductTree_noBuild() {
        // setup
        String cvrfDocument = """
                {"Vulnerability":[{"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"ProductID":["4"],"FixedBuild":"10.0.26100.9974"}]}]}""";

        // execution
        Map<String, String> latestWindowsBuilds = parser.parse(stream(cvrfDocument)).getLatestWindowsBuilds();

        // verifications
        assertThat(latestWindowsBuilds).isEmpty();
    }

    private static InputStream stream(String json) {
        return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
    }
}
