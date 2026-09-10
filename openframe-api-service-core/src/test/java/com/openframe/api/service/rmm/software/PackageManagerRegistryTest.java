package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PackageManagerRegistryTest {

    private final PackageManagerRegistry registry =
            new PackageManagerRegistry(List.of(new BrewPackageManagerHandler()));

    @Test
    @DisplayName("resolves the brew handler")
    void resolvesBrew() {
        assertThat(registry.handlerFor(PackageManagerType.BREW))
                .isInstanceOf(BrewPackageManagerHandler.class);
    }

    @Test
    @DisplayName("unsupported manager (winget not yet implemented) -> BadRequest, not 500")
    void unsupportedRejected() {
        assertThatThrownBy(() -> registry.handlerFor(PackageManagerType.WINGET))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("WINGET");
    }

    @Test
    @DisplayName("duplicate handlers for the same manager fail fast at construction")
    void duplicateRejected() {
        assertThatThrownBy(() -> new PackageManagerRegistry(
                List.of(new BrewPackageManagerHandler(), new BrewPackageManagerHandler())))
                .isInstanceOf(IllegalStateException.class);
    }
}
