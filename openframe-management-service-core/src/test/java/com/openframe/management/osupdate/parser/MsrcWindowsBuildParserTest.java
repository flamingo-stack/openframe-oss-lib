package com.openframe.management.osupdate.parser;

import com.openframe.management.osupdate.MsrcWindowsBuild;
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

    private static final String PRODUCTS = """
            "ProductTree":{"FullProductName":[
               {"ProductID":"1","Value":"Windows 11 Version 24H2 for x64-based Systems"},
               {"ProductID":"2","Value":"Windows 11 Version 24H2 for ARM64-based Systems"},
               {"ProductID":"3","Value":"Windows 11 version 26H1 for x64-based Systems"},
               {"ProductID":"4","Value":"Windows 10 Version 22H2 for 32-bit Systems"},
               {"ProductID":"5","Value":"Windows 10 Version 1607 for x64-based Systems"}]}""";

    private final MsrcCvrfDocumentParser parser =
            new MsrcCvrfDocumentParser(new JsonMapper(), new MsrcWindowsBuildParser());

    @Test
    void parse_novemberBulletin_cumulativeAndHotpatchBuildPerWindowsVersionWithoutThePrefix() throws IOException {
        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Nov.json")) {
            windowsBuilds = parser.parse(cvrfDocument).getWindowsBuilds();
        }

        // verifications
        assertThat(windowsBuilds).containsExactlyInAnyOrderEntriesOf(Map.of(
                "11 24H2", build("26100.9974", "26100.9911"),
                "11 25H2", build("26200.9974", "26200.9911")));
    }

    @Test
    void parse_octoberBulletin_serverOfTheSameFixSkippedAndNoHotpatch() throws IOException {
        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds;
        try (InputStream cvrfDocument = fixture("msrc-cvrf-2026-Oct.json")) {
            windowsBuilds = parser.parse(cvrfDocument).getWindowsBuilds();
        }

        // verifications
        assertThat(windowsBuilds).containsExactlyInAnyOrderEntriesOf(Map.of("10 1607", build("14393.9612", null)));
    }

    @Test
    void parse_fixesOfEveryArchitectureAndOlderFixes_theNumericallyHighestCumulativeBuildOfTheVersion() {
        // setup
        String cvrfDocument = "{" + PRODUCTS + """
                ,"Vulnerability":[
                  {"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["1"],"FixedBuild":"10.0.26100.9974"},
                    {"Type":2,"SubType":"Security Update","ProductID":["2"],"FixedBuild":"10.0.26100.10075"},
                    {"Type":2,"SubType":"Security Update","ProductID":["3"],"FixedBuild":"10.0.28000.3501"},
                    {"Type":2,"SubType":"Security Update","ProductID":["4"],"FixedBuild":"10.0.19045.7807"}]},
                  {"CVE":"CVE-2026-2","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["1","2"],"FixedBuild":"10.0.26100.9711"},
                    {"Type":2,"SubType":"Security Update","ProductID":["4"],"FixedBuild":"10.0.19045.7846"}]}]}""";

        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds = parser.parse(stream(cvrfDocument)).getWindowsBuilds();

        // verifications
        assertThat(windowsBuilds).containsExactlyInAnyOrderEntriesOf(Map.of(
                "11 24H2", build("26100.10075", null),
                "11 26H1", build("28000.3501", null),
                "10 22H2", build("19045.7846", null)));
    }

    @Test
    void parse_servicingStackAndOtherKindsOfFixAboveTheCumulativeUpdate_neverTheLatestBuild() {
        // setup
        String cvrfDocument = "{" + PRODUCTS + """
                ,"Vulnerability":[{"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["5"],"FixedBuild":"10.0.14393.9688"},
                    {"Type":2,"SubType":"Servicing Stack Update","ProductID":["5"],"FixedBuild":"10.0.14393.9999"},
                    {"Type":2,"SubType":"Monthly Rollup","ProductID":["5"],"FixedBuild":"10.0.14393.9998"},
                    {"Type":2,"ProductID":["5"],"FixedBuild":"10.0.14393.9997"},
                    {"Type":2,"SubType":"Servicing Stack Update","ProductID":["4"],"FixedBuild":"10.0.19045.7900"},
                    {"Type":2,"SubType":"Security Hotpatch Update","ProductID":["3"],"FixedBuild":"10.0.28000.3400"}]}]}""";

        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds = parser.parse(stream(cvrfDocument)).getWindowsBuilds();

        // verifications
        assertThat(windowsBuilds).containsExactlyInAnyOrderEntriesOf(Map.of("10 1607", build("14393.9688", null)));
    }

    @Test
    void parse_hotpatchOfTheLatestCumulativeUpdate_itsHighestBuildOfEveryArchitecture() {
        // setup
        String cvrfDocument = "{" + PRODUCTS + """
                ,"Vulnerability":[
                  {"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["1","2"],"FixedBuild":"10.0.26100.9974"},
                    {"Type":2,"SubType":"Security Hotpatch Update","ProductID":["1"],"FixedBuild":"10.0.26100.9911"},
                    {"Type":2,"SubType":"Security Hotpatch Update","ProductID":["2"],"FixedBuild":"10.0.26100.9912"}]},
                  {"CVE":"CVE-2026-2","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["1","2"],"FixedBuild":"10.0.26100.9974"}]}]}""";

        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds = parser.parse(stream(cvrfDocument)).getWindowsBuilds();

        // verifications
        assertThat(windowsBuilds)
                .containsExactlyInAnyOrderEntriesOf(Map.of("11 24H2", build("26100.9974", "26100.9912")));
    }

    @Test
    void parse_baselineMonthThatStillListsAnOlderHotpatch_noHotpatchForTheLatestBuild() {
        // setup
        String cvrfDocument = "{" + PRODUCTS + """
                ,"Vulnerability":[
                  {"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["1","2"],"FixedBuild":"10.0.26100.9711"}]},
                  {"CVE":"CVE-2026-2","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["1","2"],"FixedBuild":"10.0.26100.9168"},
                    {"Type":2,"SubType":"Security Hotpatch Update","ProductID":["1","2"],"FixedBuild":"10.0.26100.9106"}]},
                  {"CVE":"CVE-2026-3","Remediations":[
                    {"Type":2,"SubType":"Security Hotpatch Update","ProductID":["1"],"FixedBuild":"10.0.26100.9650"}]}]}""";

        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds = parser.parse(stream(cvrfDocument)).getWindowsBuilds();

        // verifications
        assertThat(windowsBuilds).containsExactlyInAnyOrderEntriesOf(Map.of("11 24H2", build("26100.9711", null)));
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
                    {"Type":2,"SubType":"Security Update","ProductID":["1","2","3","5","unknown"],
                     "FixedBuild":"10.0.26100.33822"},
                    {"Type":2,"SubType":"Security Update","ProductID":["4"],
                     "FixedBuild":"https://aka.ms/OfficeSecurityReleases"},
                    {"Type":2,"SubType":"Security Update","ProductID":["4"],"FixedBuild":"6.3.9600.23470"},
                    {"Type":2,"SubType":"Security Update","ProductID":["4"],"FixedBuild":"10.0.26100"},
                    {"Type":2,"SubType":"Security Update","ProductID":["4"]},
                    {"Type":2,"SubType":"Security Update","FixedBuild":"10.0.26100.9974"},
                    {"Type":6,"SubType":"Security Update","ProductID":["4"],"FixedBuild":"10.0.26100.9974"}]}]}""";

        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds = parser.parse(stream(cvrfDocument)).getWindowsBuilds();

        // verifications
        assertThat(windowsBuilds).isEmpty();
    }

    @Test
    void parse_documentWithoutProductTree_noBuild() {
        // setup
        String cvrfDocument = """
                {"Vulnerability":[{"CVE":"CVE-2026-1","Remediations":[
                    {"Type":2,"SubType":"Security Update","ProductID":["4"],"FixedBuild":"10.0.26100.9974"}]}]}""";

        // execution
        Map<String, MsrcWindowsBuild> windowsBuilds = parser.parse(stream(cvrfDocument)).getWindowsBuilds();

        // verifications
        assertThat(windowsBuilds).isEmpty();
    }

    private static MsrcWindowsBuild build(String latestBuild, String hotpatchBuild) {
        return MsrcWindowsBuild.builder().latestBuild(latestBuild).hotpatchBuild(hotpatchBuild).build();
    }

    private static InputStream stream(String json) {
        return new ByteArrayInputStream(json.getBytes(StandardCharsets.UTF_8));
    }
}
