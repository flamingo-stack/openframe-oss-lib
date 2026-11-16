package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class PackageCandidateTieBreakTest {

    @Test
    void narrow_packagesOfEveryMajorVersion_theOneOfTheInstalledMajorVersion() {
        // setup
        List<PackageCatalogEntry> runtimes = packages("Microsoft.DotNet.Runtime.10", "Microsoft.DotNet.Runtime.5",
                "Microsoft.DotNet.Runtime.6", "Microsoft.DotNet.Runtime.7", "Microsoft.DotNet.Runtime.8",
                "Microsoft.DotNet.Runtime.9", "Microsoft.DotNet.Runtime.Preview", "Microsoft.DotNet.Runtime.11");

        // execution
        List<PackageCatalogEntry> narrowed =
                PackageCandidateTieBreak.narrow("Microsoft .NET Runtime - 8.0.34 (x64)", runtimes);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId).containsExactly("Microsoft.DotNet.Runtime.8");
    }

    @Test
    void narrow_packagesOfEveryMinorVersion_theOneOfTheWholeInstalledMinorVersion() {
        // setup
        List<PackageCatalogEntry> pythons = packages("Python.Python.3.0", "Python.Python.3.10", "Python.Python.3.11",
                "Python.Python.3.12", "Python.Python.3.13", "Python.Python.3.1", "Python.Python.3.2");

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow("Python 3.12.10 (64-bit)", pythons);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId).containsExactly("Python.Python.3.12");
    }

    @Test
    void narrow_versionWrittenWithAnUnderscoreInTheId_theOneOfTheInstalledVersion() {
        // setup
        List<PackageCatalogEntry> runtimes = packages("Microsoft.DotNet.DesktopRuntime.3_1",
                "Microsoft.DotNet.DesktopRuntime.5", "Microsoft.DotNet.DesktopRuntime.6");

        // execution
        List<PackageCatalogEntry> narrowed =
                PackageCandidateTieBreak.narrow("Microsoft Windows Desktop Runtime - 3.1.32 (x64)", runtimes);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId)
                .containsExactly("Microsoft.DotNet.DesktopRuntime.3_1");
    }

    @Test
    void narrow_installedVersionOfNoPackage_allCandidates() {
        // setup
        List<PackageCatalogEntry> pythons = packages("Python.Python.3.10", "Python.Python.3.11", "Python.Python.3.12");

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow("Python 2.7.18 (64-bit)", pythons);

        // verifications
        assertThat(narrowed).isEqualTo(pythons);
    }

    @ParameterizedTest
    @MethodSource("basesNextToTheirVariants")
    void narrow_baseNextToItsVariants_theBase(String programName, List<String> ids, String baseId) {
        // setup
        List<PackageCatalogEntry> candidates = packages(ids);

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow(programName, candidates);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId).containsExactly(baseId);
    }

    @ParameterizedTest
    @MethodSource("unrelatedPackages")
    void narrow_unrelatedPackages_allCandidates(String programName, List<String> ids) {
        // setup
        List<PackageCatalogEntry> candidates = packages(ids);

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow(programName, candidates);

        // verifications
        assertThat(narrowed).isEqualTo(candidates);
    }

    @ParameterizedTest
    @MethodSource("architectureMembers")
    void narrow_architectureInTheName_thePackageOfThatArchitecture(String programName, List<String> ids, String id) {
        // setup
        List<PackageCatalogEntry> candidates = packages(ids);

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow(programName, candidates);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId).containsExactly(id);
    }

    @Test
    void narrow_noArchitectureInTheName_allCandidates() {
        // setup
        List<PackageCatalogEntry> redistributables = packages("Microsoft.VCRedist.2008.x64", "Microsoft.VCRedist.2008.x86");

        // execution
        List<PackageCatalogEntry> narrowed =
                PackageCandidateTieBreak.narrow("Microsoft Visual C++ 2008 Redistributable - 9.0.30729.17", redistributables);

        // verifications
        assertThat(narrowed).isEqualTo(redistributables);
    }

    @Test
    void narrow_personalEditionInTheName_theFreePackage() {
        // setup
        List<PackageCatalogEntry> teams = packages("Microsoft.Teams", "Microsoft.Teams.Free");

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow("Microsoft Teams (personal)", teams);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId).containsExactly("Microsoft.Teams.Free");
    }

    @ParameterizedTest
    @MethodSource("basesNextToTheirEditions")
    void narrow_baseNextToItsEditions_theBase(String programName, List<String> ids, String baseId) {
        // setup
        List<PackageCatalogEntry> candidates = packages(ids);

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow(programName, candidates);

        // verifications
        assertThat(narrowed).extracting(PackageCatalogEntry::getPackageId).containsExactly(baseId);
    }

    @Test
    void narrow_editionNamedInTheName_allCandidates() {
        // setup
        List<PackageCatalogEntry> assistants = packages("DJI.DJIAssistant2.ConsumerDronesSeries",
                "DJI.DJIAssistant2.EnterpriseSeries", "DJI.DJIAssistant2.FPV", "DJI.DJIAssistant2");

        // execution
        List<PackageCatalogEntry> narrowed =
                PackageCandidateTieBreak.narrow("DJI Assistant 2 (DJI FPV series) version V2.1.0.11", assistants);

        // verifications
        assertThat(narrowed).isEqualTo(assistants);
    }

    @Test
    void narrow_versionPackageAndNoVersionInTheName_allCandidates() {
        // setup
        List<PackageCatalogEntry> nodes = packages("OpenJS.NodeJS.22", "OpenJS.NodeJS", "OpenJS.NodeJS.LTS");

        // execution
        List<PackageCatalogEntry> narrowed = PackageCandidateTieBreak.narrow("Node.js", nodes);

        // verifications
        assertThat(narrowed).isEqualTo(nodes);
    }

    @ParameterizedTest
    @MethodSource("packagesOfAnotherVersion")
    void isOfAnotherVersion_idOfAnotherVersionThanTheName_true(String programName, String id, String catalogName) {
        // setup
        PackageCatalogEntry entry = namedPackage(id, catalogName);

        // execution
        boolean anotherVersion = PackageCandidateTieBreak.isOfAnotherVersion(programName, entry);

        // verifications
        assertThat(anotherVersion).isTrue();
    }

    @ParameterizedTest
    @MethodSource("packagesOfNoOtherVersion")
    void isOfAnotherVersion_noOtherVersionInTheId_false(String programName, String id, String catalogName) {
        // setup
        PackageCatalogEntry entry = namedPackage(id, catalogName);

        // execution
        boolean anotherVersion = PackageCandidateTieBreak.isOfAnotherVersion(programName, entry);

        // verifications
        assertThat(anotherVersion).isFalse();
    }

    private static Stream<Arguments> basesNextToTheirVariants() {
        return Stream.of(
                Arguments.of("VLC media player", List.of("VideoLAN.VLC", "VideoLAN.VLC.Nightly"), "VideoLAN.VLC"),
                Arguments.of("Gpg4win (4.1.0)", List.of("GnuPG.Gpg4win.Beta", "GnuPG.Gpg4win"), "GnuPG.Gpg4win"),
                Arguments.of("Duplicati 2",
                        List.of("Duplicati.Duplicati", "Duplicati.Duplicati.Beta", "Duplicati.Duplicati.Canary"),
                        "Duplicati.Duplicati"),
                Arguments.of("Mozilla Firefox (x64 en-US)",
                        List.of("Mozilla.Firefox", "Mozilla.Firefox.af", "Mozilla.Firefox.en-GB", "Mozilla.Firefox.MSIX"),
                        "Mozilla.Firefox"));
    }

    private static Stream<Arguments> unrelatedPackages() {
        return Stream.of(
                Arguments.of("Chromium", List.of("eloston.ungoogled-chromium", "Hibbiki.Chromium")),
                Arguments.of("Webex", List.of("Cisco.Webex", "Telekom.CloudPBX")),
                Arguments.of("Opera GX Stable 138.0.6044.65", List.of("Opera.OperaAir", "Opera.OperaGX")),
                Arguments.of("Arduino IDE 2.3.10", List.of("ArduinoSA.IDE.beta", "ArduinoSA.IDE.stable")));
    }

    private static Stream<Arguments> architectureMembers() {
        return Stream.of(
                Arguments.of("Microsoft Visual C++ 2008 Redistributable - x64 9.0.30729.17",
                        List.of("Microsoft.VCRedist.2008.x64", "Microsoft.VCRedist.2008.x86"),
                        "Microsoft.VCRedist.2008.x64"),
                Arguments.of("Microsoft Visual C++ 2022 Redistributable (Arm64) - 14.44.35211",
                        List.of("Microsoft.VCRedist.2015+.x64", "Microsoft.VCRedist.2015+.arm64"),
                        "Microsoft.VCRedist.2015+.arm64"));
    }

    private static Stream<Arguments> basesNextToTheirEditions() {
        return Stream.of(
                Arguments.of("Microsoft Teams", List.of("Microsoft.Teams", "Microsoft.Teams.Free"), "Microsoft.Teams"),
                Arguments.of("Microsoft Teams (work or school)", List.of("Microsoft.Teams", "Microsoft.Teams.Free"),
                        "Microsoft.Teams"),
                Arguments.of("Microsoft Update Health Tools",
                        List.of("Microsoft.UpdateHealthTools", "Microsoft.UpdateHealthTools.W10",
                                "Microsoft.UpdateHealthTools.W11-21H2"),
                        "Microsoft.UpdateHealthTools"),
                Arguments.of("Inno Setup version 6.7.3", List.of("JRSoftware.InnoSetup", "JRSoftware.InnoSetup.7"),
                        "JRSoftware.InnoSetup"));
    }

    private static Stream<Arguments> packagesOfAnotherVersion() {
        return Stream.of(
                Arguments.of("Microsoft .NET Framework 4.8 SDK", "Microsoft.DotNet.Framework.DeveloperPack.4.6",
                        "Microsoft .NET Framework 4.6.2 Developer Pack"),
                Arguments.of("Microsoft .NET Core Runtime - 2.1.30 (x64)", "Microsoft.DotNet.Runtime.3_1",
                        "Microsoft .NET Runtime 3.1"),
                Arguments.of("Unity 6000.0.65f1", "Unity.Unity.2020", null),
                Arguments.of("Azul Zulu JDK 25.34.17 (25.0.3), 64-bit", "Azul.ZuluFX.23.JDK", "Azul ZuluFX JDK 23"));
    }

    private static Stream<Arguments> packagesOfNoOtherVersion() {
        return Stream.of(
                Arguments.of("Microsoft .NET Framework 4.6.2 SDK", "Microsoft.DotNet.Framework.DeveloperPack.4.6",
                        "Microsoft .NET Framework 4.6.2 Developer Pack"),
                Arguments.of("Microsoft Visual C++ 2015 UWP Runtime Package", "Microsoft.VCLibs.14",
                        "Microsoft Visual C++ 2015 UWP Runtime Package"),
                Arguments.of("Microsoft Visual C++ 2017 Redistributable (x64) - 14.16.27033",
                        "Microsoft.VCRedist.2015+.x64", "Microsoft Visual C++ v14 Redistributable (x64)"),
                Arguments.of("Bluebeam Revu x64", "Bluebeam.Revu.21", "Bluebeam Revu 21"),
                Arguments.of("Amazon Corretto 64-bit", "Amazon.Corretto.21.JDK", "Amazon Corretto 21"),
                Arguments.of("Git 2.47.1", "Git.Git", "Git"));
    }

    private static List<PackageCatalogEntry> packages(String... ids) {
        List<String> idList = List.of(ids);
        return packages(idList);
    }

    private static List<PackageCatalogEntry> packages(List<String> ids) {
        return ids.stream()
                .map(id -> namedPackage(id, null))
                .toList();
    }

    private static PackageCatalogEntry namedPackage(String id, String catalogName) {
        return PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET)
                .packageId(id)
                .name(catalogName)
                .build();
    }
}
