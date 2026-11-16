package com.openframe.management.packagesearch;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BrewCaskKeysTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void of_appArtifact_lowerCaseAppNameWithoutTheSuffix() {
        // setup
        BrewCaskJson cask = cask("""
                [{"app": ["Google Chrome.app"], "target": "/Applications/Google Chrome.app"}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).containsExactly("google chrome");
        assertThat(keys.getWeakAppNames()).isEmpty();
        assertThat(keys.getBundleIds()).isEmpty();
        assertThat(keys.getBundleIdPrefixes()).isEmpty();
    }

    @Test
    void of_appRenamedOnInstall_onlyTheNameItIsInstalledUnder() {
        // setup
        BrewCaskJson cask = cask("""
                [{"app": ["Thorium.app", {"target": "Thorium Browser.app"}],
                  "target": "/Applications/Thorium Browser.app"}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).containsExactly("thorium browser");
    }

    @Test
    void of_appsInASubfolderOfTheDownload_fileNamesOnlySorted() {
        // setup
        BrewCaskJson cask = cask("""
                [{"app": ["Airfoil/Airfoil Satellite.app"]}, {"app": ["Airfoil/Airfoil.app"]},
                 {"app": ["Airfoil/Airfoil.app"]}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).containsExactly("airfoil", "airfoil satellite");
    }

    @Test
    void of_pkgCaskRemovingItsApp_weakAppName() {
        // setup
        BrewCaskJson cask = cask("""
                [{"pkg": ["zoomusInstallerFull.pkg"]},
                 {"uninstall": [{"pkgutil": "us.zoom.pkg.videomeeting",
                                 "delete": ["/Applications/zoom.us.app", "/Library/Internet Plug-Ins/ZoomUsPlugIn.plugin"]}]},
                 {"zap": [{"trash": "~/Applications/Zoom Rooms.app", "rmdir": "/Applications/Zoom*.app"}]}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).isEmpty();
        assertThat(keys.getWeakAppNames()).containsExactly("zoom rooms", "zoom.us");
    }

    @Test
    void of_removedAppIsTheInstalledApp_notRepeatedAsWeak() {
        // setup
        BrewCaskJson cask = cask("""
                [{"app": ["Docker.app"]},
                 {"uninstall": [{"delete": ["/Applications/Docker.app", "/Applications/Docker Helper.app"]}]}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).containsExactly("docker");
        assertThat(keys.getWeakAppNames()).containsExactly("docker helper");
    }

    @ParameterizedTest
    @CsvSource({
            "~/Library/Preferences/com.microsoft.VSCode.plist, com.microsoft.vscode",
            "~/Library/Saved Application State/com.microsoft.VSCode.savedState, com.microsoft.vscode",
            "~/Library/Caches/com.microsoft.VSCode, com.microsoft.vscode",
            "~/Library/HTTPStorages/com.microsoft.VSCode, com.microsoft.vscode",
            "~/Library/Containers/com.tinyspeck.slackmacgap, com.tinyspeck.slackmacgap",
            "~/Library/Application Scripts/com.tinyspeck.slackmacgap, com.tinyspeck.slackmacgap",
            "~/Library/WebKit/org.mozilla.fire_fox-2, org.mozilla.fire_fox-2"
    })
    void of_removedPathNamingABundleId_lowerCaseBundleId(String removedPath, String bundleId) {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"App.app\"]}, {\"zap\": [{\"trash\": [\"" + removedPath + "\"]}]}]");

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getBundleIds()).containsExactly(bundleId);
        assertThat(keys.getBundleIdPrefixes()).isEmpty();
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "~/Library/Caches/Slack",
            "~/Library/Preferences/ByHost/com.microsoft.VSCode.ShipIt.plist",
            "~/Library/Application Support/com.microsoft.VSCode",
            "~/Library/Caches/com.microsoft.VSCode/Cache",
            "/Library/Caches/com.microsoft.VSCode",
            "~/Library/Containers/com.*.helper",
            "~/Library/Containers/*",
            "~/Library/Logs/com.microsoft.VSCode"
    })
    void of_removedPathThatNamesNoBundleId_noBundleIdAndNoPrefix(String removedPath) {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"App.app\"]}, {\"zap\": [{\"trash\": [\"" + removedPath + "\"]}]}]");

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getBundleIds()).isEmpty();
        assertThat(keys.getBundleIdPrefixes()).isEmpty();
    }

    @Test
    void of_globBundleIds_prefixesWithoutTheStarAndNotExactIds() {
        // setup
        BrewCaskJson cask = cask("""
                [{"pkg": ["Microsoft_Word_Installer.pkg"]},
                 {"zap": [{"trash": ["~/Library/Containers/com.microsoft.Word*",
                                     "~/Library/Caches/com.microsoft.Word.*",
                                     "~/Library/Application Scripts/com.microsoft.Word*"]}]}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getBundleIdPrefixes()).containsExactly("com.microsoft.word", "com.microsoft.word.");
        assertThat(keys.getBundleIds()).isEmpty();
    }

    @ParameterizedTest
    @CsvSource({
            "~/Library/Caches/us.zoom.*, us.zoom.",
            "~/Library/Caches/com.abcd*, com.abcd"
    })
    void of_globBundleIdOfEightCharactersOrMore_prefixKept(String removedPath, String prefix) {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"App.app\"]}, {\"zap\": [{\"trash\": [\"" + removedPath + "\"]}]}]");

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getBundleIdPrefixes()).containsExactly(prefix);
    }

    @ParameterizedTest
    @ValueSource(strings = {"~/Library/Caches/com.abc*", "~/Library/Containers/io.ab.*", "~/Library/WebKit/com.a*"})
    void of_globBundleIdShorterThanEightCharacters_noPrefix(String removedPath) {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"App.app\"]}, {\"zap\": [{\"trash\": [\"" + removedPath + "\"]}]}]");

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getBundleIdPrefixes()).isEmpty();
        assertThat(keys.getBundleIds()).isEmpty();
    }

    @Test
    void of_quitAndLaunchctlIds_ignored() {
        // setup
        BrewCaskJson cask = cask("""
                [{"app": ["Converter.app"]},
                 {"uninstall": [{"quit": "com.google.Chrome", "launchctl": ["com.example.converter.helper"],
                                 "signal": ["KILL", "com.example.converter"]}]},
                 {"zap": [{"trash": "~/Library/Preferences/com.example.converter.plist"}]}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getBundleIds()).containsExactly("com.example.converter");
    }

    @Test
    void of_installerCaskWithoutAnApp_keysWithNoAppNames() {
        // setup
        BrewCaskJson cask = cask("""
                [{"installer": [{"manual": "Adobe Installer.app"}]},
                 {"zap": [{"trash": ["~/Library/Caches/com.adobe.acc.AdobeCreativeCloud"]}]}]
                """);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).isEmpty();
        assertThat(keys.getWeakAppNames()).isEmpty();
        assertThat(keys.getBundleIds()).containsExactly("com.adobe.acc.adobecreativecloud");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "[{\"font\": [\"ttf/FiraCode-Bold.ttf\"], \"target\": \"/$HOME/Library/Fonts/FiraCode-Bold.ttf\"}, {\"zap\": []}]",
            "[{\"binary\": [\"tool\"]}, {\"zap\": [{\"trash\": [\"~/Library/Caches/com.example.tool\", \"/Applications/Tool.app\"]}]}]",
            "[]"
    })
    void of_caskThatInstallsNoAppOrPkg_noKeys(String artifacts) {
        // setup
        BrewCaskJson cask = cask(artifacts);

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).isNull();
        assertThat(keys.getWeakAppNames()).isNull();
        assertThat(keys.getBundleIds()).isNull();
        assertThat(keys.getBundleIdPrefixes()).isNull();
    }

    @Test
    void of_caskWithoutArtifacts_noKeys() {
        // setup
        BrewCaskJson cask = new BrewCaskJson();

        // execution
        BrewCaskKeys keys = BrewCaskKeys.of(cask);

        // verifications
        assertThat(keys.getAppNames()).isNull();
        assertThat(keys.getBundleIds()).isNull();
    }

    private static BrewCaskJson cask(String artifacts) {
        JsonNode parsed = JSON.readTree(artifacts);
        List<JsonNode> nodes = parsed.valueStream().toList();
        BrewCaskJson cask = new BrewCaskJson();
        cask.setArtifacts(nodes);
        return cask;
    }
}
