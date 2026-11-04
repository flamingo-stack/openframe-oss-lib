package com.openframe.management.packagesearch;

import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class BrewCaskAppNamesTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void appNamesOf_appWithItsInstalledTarget_oneLowerCaseName() {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"Google Chrome.app\"], \"target\": \"/Applications/Google Chrome.app\"},"
                + " {\"zap\": [{\"trash\": [\"~/Library/Google\"]}]}]");

        // execution
        List<String> appNames = BrewCatalogFetcher.appNamesOf(cask);

        // verifications
        assertThat(appNames).containsExactly("google chrome.app");
    }

    @Test
    void appNamesOf_appRenamedOnInstall_bothNames() {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"Thorium.app\", {\"target\": \"Thorium Browser.app\"}],"
                + " \"target\": \"/Applications/Thorium Browser.app\"}]");

        // execution
        List<String> appNames = BrewCatalogFetcher.appNamesOf(cask);

        // verifications
        assertThat(appNames).containsExactly("thorium.app", "thorium browser.app");
    }

    @Test
    void appNamesOf_appsInASubfolderOfTheDownload_bundleNamesOnly() {
        // setup
        BrewCaskJson cask = cask("[{\"app\": [\"Airfoil/Airfoil Satellite.app\", \"Airfoil/Airfoil.app\"]}]");

        // execution
        List<String> appNames = BrewCatalogFetcher.appNamesOf(cask);

        // verifications
        assertThat(appNames).containsExactly("airfoil satellite.app", "airfoil.app");
    }

    @Test
    void appNamesOf_pkgCask_noAppNames() {
        // setup
        BrewCaskJson cask = cask("[{\"pkg\": [\"zoomusInstallerFull.pkg\"]}]");

        // execution
        List<String> appNames = BrewCatalogFetcher.appNamesOf(cask);

        // verifications
        assertThat(appNames).isEmpty();
    }

    @Test
    void appNamesOf_noArtifacts_noAppNames() {
        // setup
        BrewCaskJson cask = new BrewCaskJson();

        // execution
        List<String> appNames = BrewCatalogFetcher.appNamesOf(cask);

        // verifications
        assertThat(appNames).isEmpty();
    }

    private static BrewCaskJson cask(String artifacts) {
        JsonNode parsed = JSON.readTree(artifacts);
        List<JsonNode> nodes = parsed.valueStream().toList();
        BrewCaskJson cask = new BrewCaskJson();
        cask.setArtifacts(nodes);
        return cask;
    }
}
