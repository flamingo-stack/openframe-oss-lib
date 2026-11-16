package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageCatalogEntry.PackageCatalogEntryBuilder;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.FleetSource;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrewAppMatcherTest {

    @Mock private BrewCaskIndexCache brewCaskIndexCache;

    @InjectMocks private BrewAppMatcher matcher;

    @Test
    void getFleetSource_theMacAppsTable() {
        assertThat(matcher.getFleetSource()).isEqualTo(FleetSource.APPS);
    }

    @Test
    void isForAdoption_brewUpdatesOnlyWhatItInstalled_true() {
        assertThat(matcher.isForAdoption()).isTrue();
    }

    @Test
    void match_severalApps_oneResultPerAppInTheirOrder() {
        // setup
        PackageCatalogEntry slack = slack().build();
        PackageCatalogEntry keka = cask("keka", "Keka").appNames(List.of("keka")).build();
        stubCatalog(slack, keka);
        List<InstalledProgram> apps = List.of(app("Keka", null), app("Unknown Tool", null), app("Slack", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(keka, null, slack);
    }

    @Test
    void match_appleApp_noPackageThoughACaskHasItsName() {
        // setup
        PackageCatalogEntry safari = cask("safari", "Safari").appNames(List.of("safari"))
                .bundleIds(List.of("com.apple.safari")).build();
        stubCatalog(safari);
        List<InstalledProgram> apps = List.of(app("Safari", "com.apple.Safari"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_helperNestedInAnotherApp_noPackageThoughIdAndNameFit() {
        // setup
        stubCatalog(slack().build());
        InstalledProgram helper = InstalledProgram.builder().fleetSource(FleetSource.APPS).name("Slack")
                .bundleIdentifier("com.tinyspeck.slackmacgap").appFileNames(List.of("Slack")).topLevelApp(false).build();

        // execution
        List<PackageMatch> matches = matcher.match(List.of(helper));

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(booleans = true)
    void match_appTopLevelOrOfUnknownPath_matched(Boolean topLevelApp) {
        // setup
        PackageCatalogEntry slack = slack().build();
        stubCatalog(slack);
        InstalledProgram app = InstalledProgram.builder().fleetSource(FleetSource.APPS).name("Slack")
                .bundleIdentifier("com.tinyspeck.slackmacgap").topLevelApp(topLevelApp).build();

        // execution
        List<PackageMatch> matches = matcher.match(List.of(app));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(slack);
    }

    @Test
    void match_fontCaskDisplayedAsTheApp_noPackage() {
        // setup
        PackageCatalogEntry font = PackageCatalogEntry.builder().manager(PackageManagerType.BREW)
                .brewType(BrewPackageType.CASK).packageId("font-fira-code").name("Fira Code").aliases(List.of()).build();
        PackageCatalogEntry tool = PackageCatalogEntry.builder().manager(PackageManagerType.BREW)
                .brewType(BrewPackageType.CASK).packageId("fira-code").name("Fira Code").aliases(List.of()).build();
        stubCatalog(font, tool);
        List<InstalledProgram> apps = List.of(app("Fira Code", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_bundleIdAndAppNameOfOneFamily_theBaseCask() {
        // setup
        PackageCatalogEntry firefox = firefox("firefox", "Mozilla Firefox").build();
        PackageCatalogEntry beta = firefox("firefox@beta", "Mozilla Firefox Beta").build();
        PackageCatalogEntry esr = firefox("firefox@esr", "Mozilla Firefox ESR").build();
        stubCatalog(beta, firefox, esr);
        List<InstalledProgram> apps = List.of(app("Firefox", "org.mozilla.firefox"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(firefox);
    }

    @Test
    void match_variantsWithoutTheirBase_ambiguous() {
        // setup
        stubCatalog(firefox("firefox@beta", "Mozilla Firefox Beta").build(),
                firefox("firefox@esr", "Mozilla Firefox ESR").build());
        List<InstalledProgram> apps = List.of(app("Firefox", "org.mozilla.firefox"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.ambiguous());
    }

    @Test
    void match_betaWithItsOwnAppNameAndBundleId_theBetaCaskNotATie() {
        // setup
        PackageCatalogEntry chrome = cask("google-chrome", "Google Chrome").appNames(List.of("google chrome"))
                .bundleIds(List.of("com.google.chrome")).bundleIdPrefixes(List.of("com.google.chrome.helper.")).build();
        PackageCatalogEntry chromeBeta = cask("google-chrome@beta", "Google Chrome Beta")
                .appNames(List.of("google chrome beta"))
                .bundleIds(List.of("com.google.chrome", "com.google.chrome.beta")).build();
        stubCatalog(chrome, chromeBeta);
        List<InstalledProgram> apps = List.of(app("Google Chrome Beta", "com.google.Chrome.beta"),
                app("Google Chrome", "com.google.Chrome"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(chromeBeta, chrome);
    }

    @Test
    void match_suiteAndSingleAppBothKnowTheId_theCaskNamedAsTheApp() {
        // setup
        PackageCatalogEntry word = cask("microsoft-word", "Microsoft Word")
                .bundleIds(List.of("com.microsoft.word")).bundleIdPrefixes(List.of("com.microsoft.word")).build();
        PackageCatalogEntry office = cask("microsoft-office", "Microsoft Office")
                .weakAppNames(List.of("microsoft excel", "microsoft word"))
                .bundleIds(List.of("com.microsoft.excel", "com.microsoft.word")).build();
        stubCatalog(office, word);
        List<InstalledProgram> apps = List.of(app("Microsoft Word", "com.microsoft.Word"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(word);
    }

    @Test
    void match_bundleIdAndAppOnlyInRemovalPaths_thatCask() {
        // setup
        PackageCatalogEntry office = cask("microsoft-office", "Microsoft Office")
                .weakAppNames(List.of("microsoft excel", "microsoft word"))
                .bundleIdPrefixes(List.of("com.microsoft.excel")).build();
        PackageCatalogEntry slack = slack().build();
        stubCatalog(office, slack);
        List<InstalledProgram> apps = List.of(app("Microsoft Excel", "com.microsoft.Excel"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(office);
    }

    @Test
    void match_twoCasksKnowTheIdAndRemoveTheApp_ambiguous() {
        // setup
        PackageCatalogEntry zoom = cask("zoom", "Zoom").weakAppNames(List.of("zoom.us"))
                .bundleIds(List.of("us.zoom.xos")).bundleIdPrefixes(List.of("us.zoom.")).build();
        PackageCatalogEntry zoomForItAdmins = cask("zoom-for-it-admins", "Zoom for IT Admins")
                .weakAppNames(List.of("zoom.us")).bundleIds(List.of("us.zoom.xos")).build();
        stubCatalog(zoom, zoomForItAdmins);
        List<InstalledProgram> apps = List.of(app("zoom.us", "us.zoom.xos"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.ambiguous());
    }

    @Test
    void match_exactBundleIdUnderAnotherName_theCaskOfTheId() {
        // setup
        PackageCatalogEntry code = vsCode().build();
        stubCatalog(code, slack().build());
        List<InstalledProgram> apps = List.of(app("Code", "com.microsoft.VSCode"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(code);
    }

    @Test
    void match_exactBundleIdOfTwoUnrelatedCasksUnderAnotherName_ambiguous() {
        // setup
        stubCatalog(cask("libreoffice", "LibreOffice").bundleIds(List.of("org.libreoffice.script")).build(),
                cask("libreoffice-still", "LibreOffice Still").bundleIds(List.of("org.libreoffice.script")).build());
        List<InstalledProgram> apps = List.of(app("Office Suite", "org.libreoffice.script"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.ambiguous());
    }

    @ParameterizedTest
    @CsvSource({
            "Microsoft Word Helper, com.microsoft.word.helper",
            "Slack, com.microsoft.word.updater"
    })
    void match_onlyAPrefixIdFits_noPackageWhereverTheNamePoints(String name, String bundleId) {
        // setup
        PackageCatalogEntry word = cask("microsoft-word", "Microsoft Word")
                .bundleIdPrefixes(List.of("com.microsoft.word")).build();
        stubCatalog(word, slack().build());
        List<InstalledProgram> apps = List.of(app(name, bundleId));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_nameOnlyAppWithoutABundleId_theCaskInstallingThatApp() {
        // setup
        PackageCatalogEntry slack = slack().build();
        stubCatalog(slack, vsCode().build());
        List<InstalledProgram> apps = List.of(app("Slack.app", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(slack);
    }

    @Test
    void match_nameOnlyAndTheCaskNamesNoBundleIds_matchedWhateverTheAppsId() {
        // setup
        PackageCatalogEntry keka = cask("keka", "Keka").appNames(List.of("keka")).build();
        stubCatalog(keka);
        List<InstalledProgram> apps = List.of(app("Keka", "com.aone.keka"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(keka);
    }

    @ParameterizedTest
    @MethodSource("slackCasksNamingOtherBundleIds")
    void match_nameOnlyButTheCaskNamesOtherBundleIds_noPackage(PackageCatalogEntry slack) {
        // setup
        stubCatalog(slack);
        List<InstalledProgram> apps = List.of(app("Slack", "com.example.slack-clone"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_nameOnlyTwoDifferentCasksInstallTheApp_ambiguous() {
        // setup
        stubCatalog(cask("amethyst", "Amethyst").appNames(List.of("amethyst")).build(),
                cask("amethyst-nostr", "Amethyst").appNames(List.of("amethyst")).build());
        List<InstalledProgram> apps = List.of(app("Amethyst", "com.example.unknown"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.ambiguous());
    }

    @Test
    void match_nameOnlyFamily_theBaseCask() {
        // setup
        PackageCatalogEntry iterm = cask("iterm2", "iTerm2").appNames(List.of("iterm")).build();
        PackageCatalogEntry itermBeta = cask("iterm2@beta", "iTerm2").appNames(List.of("iterm")).build();
        PackageCatalogEntry itermNightly = cask("iterm2@nightly", "iTerm2").appNames(List.of("iterm")).build();
        stubCatalog(itermNightly, itermBeta, iterm);
        List<InstalledProgram> apps = List.of(app("iTerm", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(iterm);
    }

    @Test
    void match_nameOnlyStrongAndWeakNames_theStrongOne() {
        // setup
        PackageCatalogEntry docker = cask("docker-desktop", "Docker Desktop").appNames(List.of("docker")).build();
        PackageCatalogEntry toolbox = cask("docker-toolbox", "Docker").weakAppNames(List.of("docker")).build();
        stubCatalog(toolbox, docker);
        List<InstalledProgram> apps = List.of(app("Docker", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(docker);
    }

    @ParameterizedTest
    @CsvSource({
            "zoom.us, zoom-for-it-admins",
            "Logitech Options+, logi-options+"
    })
    void match_nameOnlyByAWeakName_thatCask(String appName, String token) {
        // setup
        PackageCatalogEntry removingTheApp = cask("zoom-for-it-admins", "Zoom for IT Admins")
                .weakAppNames(List.of("zoom.us")).build();
        PackageCatalogEntry displayedAsTheApp = cask("logi-options+", "Logitech Options+").build();
        stubCatalog(removingTheApp, displayedAsTheApp);
        List<InstalledProgram> apps = List.of(app(appName, null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).extracting(PackageCatalogEntry::getPackageId)
                .containsExactly(token);
    }

    @Test
    void match_nameOnlyVariantReachedByAWeakName_noPackage() {
        // setup
        stubCatalog(cask("emclient@beta", "eM Client Beta").weakAppNames(List.of("em client")).build());
        List<InstalledProgram> apps = List.of(app("eM Client", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_nameOnlyVariantReachedByItsAppName_matched() {
        // setup
        PackageCatalogEntry beta = cask("emclient@beta", "eM Client Beta").appNames(List.of("em client")).build();
        stubCatalog(beta);
        List<InstalledProgram> apps = List.of(app("eM Client", null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(beta);
    }

    @ParameterizedTest
    @CsvSource({
            "Visual Studio Code, visual-studio-code",
            "'  Mission Control Plus ', mission-control-plus",
            "Genesis+, genesis-plus",
            "zoom.us, zoom-us",
            "TablePlus.app, tableplus",
            "Docker, docker-desktop"
    })
    void match_nameWrittenAsAToken_theCaskOfThatTokenOrOldToken(String appName, String token) {
        // setup
        stubCatalog(cask("visual-studio-code", "Microsoft Visual Studio Code").build(),
                cask("mission-control-plus", "Mission Control+").build(),
                cask("genesis-plus", "Genesis Plus").build(),
                cask("zoom-us", "Zoom Workplace").build(),
                cask("tableplus", "Table Plus").build(),
                cask("docker-desktop", "Docker Desktop").aliases(List.of("docker")).build());
        List<InstalledProgram> apps = List.of(app(appName, null));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).extracting(PackageCatalogEntry::getPackageId)
                .containsExactly(token);
    }

    @Test
    void match_appFileNamesReported_usedInPlaceOfTheDisplayName() {
        // setup
        PackageCatalogEntry code = vsCode().build();
        PackageCatalogEntry displayedAsCode = cask("code-notes", "Code").appNames(List.of("code")).build();
        stubCatalog(code, displayedAsCode);
        InstalledProgram app = InstalledProgram.builder().fleetSource(FleetSource.APPS).name("Code")
                .appFileNames(List.of("Visual Studio Code")).topLevelApp(true).build();

        // execution
        List<PackageMatch> matches = matcher.match(List.of(app));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(code);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", ".app", "+"})
    void match_noUsableNameAndNoBundleId_noPackage(String name) {
        // setup
        stubCatalog(slack().build());
        List<InstalledProgram> apps = List.of(app(name, " "));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_emptyCatalog_noPackage() {
        // setup
        stubCatalog();
        List<InstalledProgram> apps = List.of(app("Slack", "com.tinyspeck.slackmacgap"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    private static Stream<PackageCatalogEntry> slackCasksNamingOtherBundleIds() {
        return Stream.of(
                cask("slack", "Slack").appNames(List.of("slack")).bundleIds(List.of("com.tinyspeck.slackmacgap")).build(),
                cask("slack", "Slack").appNames(List.of("slack")).bundleIdPrefixes(List.of("com.tinyspeck.")).build());
    }

    private void stubCatalog(PackageCatalogEntry... casks) {
        BrewCaskIndex brewCaskIndex = new BrewCaskIndex(List.of(casks));
        when(brewCaskIndexCache.getBrewCaskIndex()).thenReturn(brewCaskIndex);
    }

    private static InstalledProgram app(String name, String bundleIdentifier) {
        return InstalledProgram.builder().fleetSource(FleetSource.APPS).name(name)
                .bundleIdentifier(bundleIdentifier).build();
    }

    private static PackageCatalogEntryBuilder cask(String token, String displayName) {
        return PackageCatalogEntry.builder().manager(PackageManagerType.BREW).brewType(BrewPackageType.CASK)
                .packageId(token).name(displayName).aliases(List.of())
                .appNames(List.of()).weakAppNames(List.of()).bundleIds(List.of()).bundleIdPrefixes(List.of());
    }

    private static PackageCatalogEntryBuilder slack() {
        return cask("slack", "Slack").appNames(List.of("slack")).bundleIds(List.of("com.tinyspeck.slackmacgap"));
    }

    private static PackageCatalogEntryBuilder vsCode() {
        return cask("visual-studio-code", "Microsoft Visual Studio Code").appNames(List.of("visual studio code"))
                .bundleIds(List.of("com.microsoft.vscode"));
    }

    private static PackageCatalogEntryBuilder firefox(String token, String displayName) {
        return cask(token, displayName).appNames(List.of("firefox")).bundleIds(List.of("org.mozilla.firefox"));
    }
}
