package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareScriptCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WingetPackageManagerHandlerTest {

    private final WingetPackageManagerHandler handler = new WingetPackageManagerHandler();

    @Test
    @DisplayName("manager is WINGET")
    void manager() {
        assertThat(handler.manager()).isEqualTo(PackageManagerType.WINGET);
    }

    @Test
    @DisplayName("scriptCode maps INSTALL->WINGET_INSTALL, UPDATE->WINGET_UPDATE")
    void scriptCode() {
        assertThat(handler.scriptCode(SoftwareAction.INSTALL)).isEqualTo(SoftwareScriptCode.WINGET_INSTALL);
        assertThat(handler.scriptCode(SoftwareAction.UPDATE)).isEqualTo(SoftwareScriptCode.WINGET_UPDATE);
    }

    @Test
    @DisplayName("args select the package by exact id -> winget install --id <name> -e (packageType is ignored)")
    void args() {
        assertThat(handler.buildArgs("Microsoft.VisualStudioCode", null))
                .containsExactly("--id", "Microsoft.VisualStudioCode", "-e");
        assertThat(handler.buildArgs("Mozilla.Firefox", BrewPackageType.CASK))
                .containsExactly("--id", "Mozilla.Firefox", "-e");
    }

    @Test
    @DisplayName("blank packageName is rejected")
    void blankRejected() {
        assertThatThrownBy(() -> handler.buildArgs("  ", null))
                .isInstanceOf(BadRequestException.class);
        assertThatThrownBy(() -> handler.buildArgs(null, null))
                .isInstanceOf(BadRequestException.class);
    }
}
