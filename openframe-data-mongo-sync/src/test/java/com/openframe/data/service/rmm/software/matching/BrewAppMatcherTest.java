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
import java.util.Locale;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrewAppMatcherTest {

    private static final String BUNDLE_ID_OF_NO_CASK = "com.example.app";
    private static final String BUNDLE_ID_OF_EVERY_CASK = "com.example.shared";

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
        PackageCatalogEntry keka = cask("keka", "Keka").appNames(List.of("keka")).bundleIds(List.of("com.aone.keka"))
                .build();
        stubCatalog(slack, keka);
        List<InstalledProgram> apps = List.of(app("Keka", "com.aone.keka"),
                app("Unknown Tool", BUNDLE_ID_OF_NO_CASK), app("Slack", "com.tinyspeck.slackmacgap"));

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
        List<InstalledProgram> apps = List.of(app("Fira Code", BUNDLE_ID_OF_NO_CASK));

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
    void match_variantsWithoutTheirBase_ambiguousAndTheBestIsTheFirstByToken() {
        // setup
        PackageCatalogEntry beta = firefox("firefox@beta", "Mozilla Firefox Beta").build();
        PackageCatalogEntry esr = firefox("firefox@esr", "Mozilla Firefox ESR").build();
        stubCatalog(esr, beta);
        List<InstalledProgram> apps = List.of(app("Firefox", "org.mozilla.firefox"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry, PackageMatch::getBestCandidate)
                .containsExactly(tuple(null, beta));
    }

    @Test
    void match_severalCasksAndAVariantIsTheMostInstalled_theBestIsABaseCask() {
        // setup
        PackageCatalogEntry figma = figma("figma").popularity(10).build();
        PackageCatalogEntry figmaBeta = figma("figma@beta").popularity(900).build();
        PackageCatalogEntry figmaAgent = figma("figma-agent").popularity(5).build();
        stubCatalog(figmaAgent, figmaBeta, figma);
        List<InstalledProgram> apps = List.of(app("Figma Desktop", "com.figma.desktop"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry, PackageMatch::getBestCandidate)
                .containsExactly(tuple(null, figma));
    }

    @Test
    void match_idAndNameAgreeOnTwoCasksAndAMoreInstalledOneOnlyKnowsTheId_theBestIsOneOfTheAgreed() {
        // setup
        PackageCatalogEntry ce = intellijIdea("intellij-idea-ce").build();
        PackageCatalogEntry oss = intellijIdea("intellij-idea-oss").build();
        PackageCatalogEntry toolbox = cask("jetbrains-toolbox", "JetBrains Toolbox").popularity(9000)
                .bundleIds(List.of("com.jetbrains.intellij.ce")).build();
        stubCatalog(toolbox, oss, ce);
        List<InstalledProgram> apps = List.of(app("IntelliJ IDEA", "com.jetbrains.intellij.ce"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry, PackageMatch::getBestCandidate)
                .containsExactly(tuple(null, ce));
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
    void match_idAndNameAgreeOnACaskAndItsEdition_theBaseCask() {
        // setup
        PackageCatalogEntry zoom = cask("zoom", "Zoom").weakAppNames(List.of("zoom.us"))
                .bundleIds(List.of("us.zoom.xos")).bundleIdPrefixes(List.of("us.zoom.")).build();
        PackageCatalogEntry zoomForItAdmins = cask("zoom-for-it-admins", "Zoom for IT Admins")
                .weakAppNames(List.of("zoom.us")).bundleIds(List.of("us.zoom.xos")).build();
        stubCatalog(zoomForItAdmins, zoom);
        List<InstalledProgram> apps = List.of(app("zoom.us", "us.zoom.xos"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(zoom);
    }

    @Test
    void match_idAndNameAgreeButTheEditionKnowsOnlyAPrefixOfTheId_ambiguousNotTheBase() {
        // setup
        PackageCatalogEntry zoom = cask("zoom", "Zoom").appNames(List.of("zoom.us"))
                .bundleIdPrefixes(List.of("us.zoom.")).build();
        PackageCatalogEntry zoomForItAdmins = cask("zoom-for-it-admins", "Zoom for IT Admins")
                .appNames(List.of("zoom.us")).bundleIds(List.of("us.zoom.xos")).build();
        stubCatalog(zoom, zoomForItAdmins);
        List<InstalledProgram> apps = List.of(app("zoom.us", "us.zoom.xos"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry, PackageMatch::getBestCandidate)
                .containsExactly(tuple(null, zoom));
    }

    @Test
    void match_idAndNameAgreeOnCasksWithoutACommonBase_ambiguous() {
        // setup
        PackageCatalogEntry ce = intellijIdea("intellij-idea-ce").build();
        PackageCatalogEntry oss = intellijIdea("intellij-idea-oss").build();
        stubCatalog(oss, ce);
        List<InstalledProgram> apps = List.of(app("IntelliJ IDEA", "com.jetbrains.intellij.ce"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry, PackageMatch::getBestCandidate)
                .containsExactly(tuple(null, ce));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "com.parallels.desktop.appstore", "com.cleverfiles.DiskDrill-setapp", "com.globaldelight.CaptoMAS",
            "com.example.slack.mas", "com.example.slack-mas", "com.example.slack_mas2", "com.example.slack.iOS"
    })
    void match_bundleIdOfAnAppStoreSetappOrIosEdition_noPackageThoughIdAndNameFit(String bundleId) {
        // setup
        String lowerCaseBundleId = bundleId.toLowerCase(Locale.ROOT);
        stubCatalog(cask("slack", "Slack").appNames(List.of("slack")).bundleIds(List.of(lowerCaseBundleId)).build());
        List<InstalledProgram> apps = List.of(app("Slack", bundleId));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @ParameterizedTest
    @ValueSource(strings = {"com.example.christmas", "com.example.XMAS", "com.example.NoMAS", "com.example.NotMAS"})
    void match_bundleIdThatOnlyLooksLikeAnEdition_matched(String bundleId) {
        // setup
        String lowerCaseBundleId = bundleId.toLowerCase(Locale.ROOT);
        PackageCatalogEntry slack = cask("slack", "Slack").appNames(List.of("slack"))
                .bundleIds(List.of(lowerCaseBundleId)).build();
        stubCatalog(slack);
        List<InstalledProgram> apps = List.of(app("Slack", bundleId));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(slack);
    }

    @ParameterizedTest
    @ValueSource(strings = {"Code", "VSCode", "Studio Helper"})
    void match_exactBundleIdUnderAnotherNameSharingAWord_theCaskOfTheId(String name) {
        // setup
        PackageCatalogEntry code = vsCode().build();
        stubCatalog(code, slack().build());
        List<InstalledProgram> apps = List.of(app(name, "com.microsoft.VSCode"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(code);
    }

    @Test
    void match_exactBundleIdUnderAnotherNameSharingAThreeLetterWord_theCaskOfTheId() {
        // setup
        PackageCatalogEntry arc = cask("arc", "Arc").appNames(List.of("arc"))
                .bundleIds(List.of("company.thebrowser.browser")).build();
        stubCatalog(arc, slack().build());
        List<InstalledProgram> apps = List.of(app("Arc Browser", "company.thebrowser.Browser"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(arc);
    }

    @Test
    void match_exactBundleIdOfACaskSharingNoWordWithTheApp_noPackage() {
        // setup
        stubCatalog(cask("wechatwebdevtools", "Wechat Web DevTools").appNames(List.of("wechatwebdevtools"))
                .bundleIds(List.of("com.github.electron")).build());
        List<InstalledProgram> apps = List.of(app("Electron", "com.github.Electron"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"VU", "Pro Helper", "The Desktop App for macOS"})
    void match_exactBundleIdAndOnlyShortWordsOrWordsOfAnyAppShared_noPackage(String name) {
        // setup
        stubCatalog(cask("vu-pro", "VU Pro for Mac").appNames(List.of("vu pro"))
                .bundleIds(List.of("com.example.vu")).build());
        List<InstalledProgram> apps = List.of(app(name, "com.example.vu"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_exactBundleIdOfACaskAndItsEditionUnderAnotherName_ambiguousNotTheBase() {
        // setup
        PackageCatalogEntry libreOffice = cask("libreoffice", "LibreOffice")
                .bundleIds(List.of("org.libreoffice.script")).build();
        PackageCatalogEntry libreOfficeStill = cask("libreoffice-still", "LibreOffice Still")
                .bundleIds(List.of("org.libreoffice.script")).build();
        stubCatalog(libreOfficeStill, libreOffice);
        List<InstalledProgram> apps = List.of(app("Office Suite", "org.libreoffice.script"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry, PackageMatch::getBestCandidate)
                .containsExactly(tuple(null, libreOffice));
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

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void match_appWithoutABundleId_noPackageThoughACaskInstallsThatApp(String bundleId) {
        // setup
        PackageCatalogEntry keka = cask("keka", "Keka").appNames(List.of("keka")).build();
        stubCatalog(slack().build(), keka);
        List<InstalledProgram> apps = List.of(app("Slack.app", bundleId), app("Keka", bundleId));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage(), PackageMatch.noPackage());
    }

    @ParameterizedTest
    @MethodSource("kekaCasksKnowingNotTheAppsBundleId")
    void match_nameOnly_noPackage(PackageCatalogEntry keka) {
        // setup
        stubCatalog(keka);
        List<InstalledProgram> apps = List.of(app("Keka", "com.aone.keka"));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).containsExactly(PackageMatch.noPackage());
    }

    @Test
    void match_bundleIdOfBothAndStrongAndWeakNames_theStrongOne() {
        // setup
        PackageCatalogEntry docker = cask("docker-desktop", "Docker Desktop").appNames(List.of("docker"))
                .bundleIds(List.of(BUNDLE_ID_OF_EVERY_CASK)).build();
        PackageCatalogEntry toolbox = cask("docker-toolbox", "Docker").weakAppNames(List.of("docker"))
                .bundleIds(List.of(BUNDLE_ID_OF_EVERY_CASK)).build();
        stubCatalog(toolbox, docker);
        List<InstalledProgram> apps = List.of(app("Docker", BUNDLE_ID_OF_EVERY_CASK));

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
    void match_bundleIdOfBothAndAWeakName_thatCask(String appName, String token) {
        // setup
        PackageCatalogEntry removingTheApp = cask("zoom-for-it-admins", "Zoom for IT Admins")
                .weakAppNames(List.of("zoom.us")).bundleIds(List.of(BUNDLE_ID_OF_EVERY_CASK)).build();
        PackageCatalogEntry displayedAsTheApp = cask("logi-options+", "Logitech Options+")
                .bundleIds(List.of(BUNDLE_ID_OF_EVERY_CASK)).build();
        stubCatalog(removingTheApp, displayedAsTheApp);
        List<InstalledProgram> apps = List.of(app(appName, BUNDLE_ID_OF_EVERY_CASK));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).extracting(PackageCatalogEntry::getPackageId)
                .containsExactly(token);
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
    void match_bundleIdOfAllAndNameWrittenAsAToken_theCaskOfThatTokenOrOldToken(String appName, String token) {
        // setup
        List<String> bundleIds = List.of(BUNDLE_ID_OF_EVERY_CASK);
        stubCatalog(cask("visual-studio-code", "Microsoft Visual Studio Code").bundleIds(bundleIds).build(),
                cask("mission-control-plus", "Mission Control+").bundleIds(bundleIds).build(),
                cask("genesis-plus", "Genesis Plus").bundleIds(bundleIds).build(),
                cask("zoom-us", "Zoom Workplace").bundleIds(bundleIds).build(),
                cask("tableplus", "Table Plus").bundleIds(bundleIds).build(),
                cask("docker-desktop", "Docker Desktop").aliases(List.of("docker")).bundleIds(bundleIds).build());
        List<InstalledProgram> apps = List.of(app(appName, BUNDLE_ID_OF_EVERY_CASK));

        // execution
        List<PackageMatch> matches = matcher.match(apps);

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).extracting(PackageCatalogEntry::getPackageId)
                .containsExactly(token);
    }

    @Test
    void match_appFileNamesReported_usedInPlaceOfTheDisplayName() {
        // setup
        PackageCatalogEntry code = cask("visual-studio-code", "Microsoft Visual Studio Code")
                .appNames(List.of("visual studio code")).bundleIds(List.of(BUNDLE_ID_OF_EVERY_CASK)).build();
        PackageCatalogEntry displayedAsCode = cask("code-notes", "Code").appNames(List.of("code"))
                .bundleIds(List.of(BUNDLE_ID_OF_EVERY_CASK)).build();
        stubCatalog(code, displayedAsCode);
        InstalledProgram app = InstalledProgram.builder().fleetSource(FleetSource.APPS).name("Code")
                .bundleIdentifier(BUNDLE_ID_OF_EVERY_CASK).appFileNames(List.of("Visual Studio Code")).topLevelApp(true)
                .build();

        // execution
        List<PackageMatch> matches = matcher.match(List.of(app));

        // verifications
        assertThat(matches).extracting(PackageMatch::getEntry).containsExactly(code);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", ".app", "+"})
    void match_noUsableNameAndABundleIdOfNoCask_noPackage(String name) {
        // setup
        stubCatalog(slack().build());
        List<InstalledProgram> apps = List.of(app(name, BUNDLE_ID_OF_NO_CASK));

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

    private static Stream<PackageCatalogEntry> kekaCasksKnowingNotTheAppsBundleId() {
        return Stream.of(
                cask("keka", "Keka").appNames(List.of("keka")).build(),
                cask("keka-helper", "Keka Helper").weakAppNames(List.of("keka")).build(),
                cask("keka-tool", "Keka").build(),
                cask("keka", "Archiver").build(),
                cask("archiver", "Archiver").aliases(List.of("keka")).build(),
                cask("keka", "Keka").appNames(List.of("keka")).bundleIds(List.of("com.aone.other")).build(),
                cask("keka", "Keka").appNames(List.of("keka")).bundleIdPrefixes(List.of("com.other.")).build());
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

    private static PackageCatalogEntryBuilder figma(String token) {
        return cask(token, "Figma").bundleIds(List.of("com.figma.desktop"));
    }

    private static PackageCatalogEntryBuilder intellijIdea(String token) {
        return cask(token, "IntelliJ IDEA").appNames(List.of("intellij idea"))
                .bundleIds(List.of("com.jetbrains.intellij.ce"));
    }

    private static PackageCatalogEntryBuilder firefox(String token, String displayName) {
        return cask(token, displayName).appNames(List.of("firefox")).bundleIds(List.of("org.mozilla.firefox"));
    }
}
