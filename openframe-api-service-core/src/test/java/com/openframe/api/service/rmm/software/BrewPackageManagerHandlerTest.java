package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BrewPackageManagerHandlerTest {

    private final BrewPackageManagerHandler handler = new BrewPackageManagerHandler();

    @Test
    @DisplayName("manager is BREW")
    void manager() {
        assertThat(handler.manager()).isEqualTo(PackageManagerType.BREW);
    }

    @Test
    @DisplayName("scriptCode maps INSTALL->BREW_INSTALL, UPDATE->BREW_UPDATE")
    void scriptCode() {
        assertThat(handler.scriptCode(SoftwareAction.INSTALL)).isEqualTo(SoftwareScriptCode.BREW_INSTALL);
        assertThat(handler.scriptCode(SoftwareAction.UPDATE)).isEqualTo(SoftwareScriptCode.BREW_UPDATE);
    }

    @Test
    @DisplayName("cask gets the --cask flag -> brew install --cask slack")
    void caskArgs() {
        assertThat(handler.buildArgs("slack", BrewPackageType.CASK))
                .containsExactly("--cask", "slack");
    }

    @Test
    @DisplayName("formula (or null type) is a bare token -> brew install wireshark")
    void formulaArgs() {
        assertThat(handler.buildArgs("wireshark", BrewPackageType.FORMULA)).containsExactly("wireshark");
        assertThat(handler.buildArgs("wireshark", null)).containsExactly("wireshark");
    }

    @Test
    @DisplayName("blank packageName is rejected")
    void blankRejected() {
        assertThatThrownBy(() -> handler.buildArgs("  ", BrewPackageType.CASK))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> handler.buildArgs(null, BrewPackageType.CASK))
                .isInstanceOf(BadRequestException.class);
    }
}
