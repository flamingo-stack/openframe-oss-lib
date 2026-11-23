package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import com.openframe.data.service.rmm.software.ChocoPackageManagerHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ChocoPackageManagerHandlerTest {

    private static final String FEED_URL = "https://feed.openframe.build/choco/index.json";

    private PackageManagerProperties properties;
    private ChocoPackageManagerHandler handler;

    @BeforeEach
    void setUp() {
        properties = new PackageManagerProperties();
        properties.getChoco().setFeedUrl(FEED_URL);
        handler = new ChocoPackageManagerHandler(properties);
    }

    @Test
    void manager_always_choco() {
        // setup
        PackageManagerType expected = PackageManagerType.CHOCO;

        // execution
        PackageManagerType manager = handler.manager();

        // verifications
        assertThat(manager).isEqualTo(expected);
    }

    @Test
    void scriptCode_install_chocoInstall() {
        // setup
        SoftwareAction install = SoftwareAction.INSTALL;

        // execution
        SoftwareScriptCode code = handler.scriptCode(install);

        // verifications
        assertThat(code).isEqualTo(SoftwareScriptCode.CHOCO_INSTALL);
    }

    @Test
    void scriptCode_update_chocoUpdate() {
        // setup
        SoftwareAction update = SoftwareAction.UPDATE;

        // execution
        SoftwareScriptCode code = handler.scriptCode(update);

        // verifications
        assertThat(code).isEqualTo(SoftwareScriptCode.CHOCO_UPDATE);
    }

    @Test
    void scriptCode_adopt_badRequestAsNoScriptAdopts() {
        // setup
        SoftwareAction adopt = SoftwareAction.ADOPT;

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class, () -> handler.scriptCode(adopt));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("No software script adopts a package: an adoption is an order");
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "7zip", "7zip.install", "GoogleChrome", "notepadplusplus", "chocolatey-core.extension", "vcredist2015_x64"})
    void buildArgs_validId_idThenFeedUrl(String packageId) {
        // setup
        BrewPackageType noBrewType = null;

        // execution
        List<String> args = handler.buildArgs(packageId, noBrewType);

        // verifications
        assertThat(args).containsExactly(packageId, FEED_URL);
    }

    @Test
    void buildArgs_brewPackageTypeGiven_ignored() {
        // setup
        BrewPackageType cask = BrewPackageType.CASK;

        // execution
        List<String> args = handler.buildArgs("7zip", cask);

        // verifications
        assertThat(args).containsExactly("7zip", FEED_URL);
    }

    @Test
    void buildArgs_feedUrlChangedInProperties_currentFeedUsed() {
        // setup
        properties.getChoco().setFeedUrl("https://feed.openframe.ai/choco/index.json");

        // execution
        List<String> args = handler.buildArgs("7zip", null);

        // verifications
        assertThat(args).containsExactly("7zip", "https://feed.openframe.ai/choco/index.json");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "  ", "-x", "--source=evil", "a b", "a;b", "a/b", ".hidden"})
    void buildArgs_idMissingOrOutsideTheAllowedPattern_badRequest(String packageId) {
        // setup
        BrewPackageType noBrewType = null;

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class,
                () -> handler.buildArgs(packageId, noBrewType));

        // verifications
        assertThat(refused.getMessage()).isNotBlank();
    }
}
