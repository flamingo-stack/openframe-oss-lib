package com.openframe.api.service.rmm.software;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.config.PackageManagerProperties;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.service.rmm.software.BrewPackageManagerHandler;
import com.openframe.data.service.rmm.software.ChocoPackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerHandler;
import com.openframe.data.service.rmm.software.PackageManagerRegistry;
import com.openframe.data.service.rmm.software.WingetPackageManagerHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;

class PackageManagerRegistryTest {

    private static final String FEED_URL = "https://feed.openframe.build/choco/index.json";

    private PackageManagerProperties properties;
    private PackageManagerRegistry registry;

    @BeforeEach
    void setUp() {
        properties = new PackageManagerProperties();
        properties.getChoco().setFeedUrl(FEED_URL);
        registry = new PackageManagerRegistry(List.of(
                new BrewPackageManagerHandler(),
                new WingetPackageManagerHandler(),
                new ChocoPackageManagerHandler(properties)), properties);
    }

    @Test
    @DisplayName("resolves the brew handler")
    void resolvesBrew() {
        assertThat(registry.handlerFor(PackageManagerType.BREW))
                .isInstanceOf(BrewPackageManagerHandler.class);
    }

    @Test
    @DisplayName("a manager without a registered handler -> BadRequest, not 500")
    void unsupportedRejected() {
        PackageManagerRegistry brewOnly = new PackageManagerRegistry(List.of(new BrewPackageManagerHandler()), properties);

        assertThatThrownBy(() -> brewOnly.handlerFor(PackageManagerType.WINGET))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("WINGET");
    }

    @Test
    @DisplayName("duplicate handlers for the same manager fail fast at construction")
    void duplicateRejected() {
        assertThatThrownBy(() -> new PackageManagerRegistry(
                List.of(new BrewPackageManagerHandler(), new BrewPackageManagerHandler()), properties))
                .isInstanceOf(IllegalStateException.class);
    }

    @Test
    void handlerFor_chocoDisabled_badRequest() {
        // setup
        properties.setChocoEnabled(false);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class,
                () -> registry.handlerFor(PackageManagerType.CHOCO));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("Package manager is disabled: CHOCO");
    }

    @Test
    void handlerFor_chocoEnabled_chocoHandler() {
        // setup
        properties.setChocoEnabled(true);

        // execution
        PackageManagerHandler handler = registry.handlerFor(PackageManagerType.CHOCO);

        // verifications
        assertThat(handler).isInstanceOf(ChocoPackageManagerHandler.class);
    }

    @Test
    void handlerFor_chocoDisabledWithoutChocoHandler_refusedAsDisabledBeforeTheLookup() {
        // setup
        properties.setChocoEnabled(false);
        PackageManagerRegistry brewOnly = new PackageManagerRegistry(List.of(new BrewPackageManagerHandler()), properties);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class,
                () -> brewOnly.handlerFor(PackageManagerType.CHOCO));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("Package manager is disabled: CHOCO");
    }

    @Test
    void handlerFor_chocoEnabledWithoutChocoHandler_refusedAsUnsupported() {
        // setup
        properties.setChocoEnabled(true);
        PackageManagerRegistry brewOnly = new PackageManagerRegistry(List.of(new BrewPackageManagerHandler()), properties);

        // execution
        BadRequestException refused = assertThrows(BadRequestException.class,
                () -> brewOnly.handlerFor(PackageManagerType.CHOCO));

        // verifications
        assertThat(refused.getMessage()).isEqualTo("Unsupported package manager: CHOCO");
    }

    @ParameterizedTest
    @MethodSource("brewAndWingetUnderEitherChocoSwitch")
    void handlerFor_brewOrWinget_resolvedWhateverTheChocoSwitch(
            boolean chocoEnabled, PackageManagerType manager, Class<? extends PackageManagerHandler> expectedHandler) {
        // setup
        properties.setChocoEnabled(chocoEnabled);

        // execution
        PackageManagerHandler handler = registry.handlerFor(manager);

        // verifications
        assertThat(handler).isInstanceOf(expectedHandler);
    }

    private static Stream<Arguments> brewAndWingetUnderEitherChocoSwitch() {
        return Stream.of(
                Arguments.of(false, PackageManagerType.BREW, BrewPackageManagerHandler.class),
                Arguments.of(false, PackageManagerType.WINGET, WingetPackageManagerHandler.class),
                Arguments.of(true, PackageManagerType.BREW, BrewPackageManagerHandler.class),
                Arguments.of(true, PackageManagerType.WINGET, WingetPackageManagerHandler.class));
    }
}
