package com.openframe.management.packagesearch;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class BrewCatalogFetcherTest {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    @Test
    void toCaskEntry_caskThatInstallsAnApp_entryCarriesItsMatchingKeys() {
        // setup
        BrewCaskJson cask = JSON.readValue("""
                {"token": "visual-studio-code", "name": ["Microsoft Visual Studio Code", "VS Code"],
                 "version": "1.95.0", "disabled": false,
                 "artifacts": [
                   {"uninstall": [{"launchctl": "com.microsoft.VSCode.ShipIt", "quit": "com.microsoft.VSCode.quit",
                                   "delete": "/Applications/Code Helper.app"}]},
                   {"app": ["Visual Studio Code.app"], "target": "/Applications/Visual Studio Code.app"},
                   {"zap": [{"trash": ["~/Library/Caches/com.microsoft.VSCode",
                                       "~/Library/Saved Application State/com.microsoft.VSCode.savedState",
                                       "~/Library/Caches/com.microsoft.VSCode.ShipIt*"]}]}
                 ]}
                """, BrewCaskJson.class);
        Map<String, Integer> installs = Map.of("visual-studio-code", 1000);

        // execution
        PackageCatalogEntry entry = BrewCatalogFetcher.toCaskEntry(cask, installs);

        // verifications
        assertThat(entry.getPackageId()).isEqualTo("visual-studio-code");
        assertThat(entry.getBrewType()).isEqualTo(BrewPackageType.CASK);
        assertThat(entry.getAppNames()).containsExactly("visual studio code");
        assertThat(entry.getWeakAppNames()).containsExactly("code helper");
        assertThat(entry.getBundleIds()).containsExactly("com.microsoft.vscode");
        assertThat(entry.getBundleIdPrefixes()).containsExactly("com.microsoft.vscode.shipit");
    }

    @Test
    void toCaskEntry_fontCask_entryWithoutMatchingKeys() {
        // setup
        BrewCaskJson cask = JSON.readValue("""
                {"token": "font-fira-code", "name": ["Fira Code"], "version": "6.2",
                 "artifacts": [
                   {"font": ["ttf/FiraCode-Bold.ttf"], "target": "/$HOME/Library/Fonts/FiraCode-Bold.ttf"},
                   {"zap": [{"trash": "~/Library/Caches/com.example.fonts"}]}
                 ]}
                """, BrewCaskJson.class);
        Map<String, Integer> installs = Map.of();

        // execution
        PackageCatalogEntry entry = BrewCatalogFetcher.toCaskEntry(cask, installs);

        // verifications
        assertThat(entry.getPackageId()).isEqualTo("font-fira-code");
        assertThat(entry.getAppNames()).isNull();
        assertThat(entry.getWeakAppNames()).isNull();
        assertThat(entry.getBundleIds()).isNull();
        assertThat(entry.getBundleIdPrefixes()).isNull();
    }
}
