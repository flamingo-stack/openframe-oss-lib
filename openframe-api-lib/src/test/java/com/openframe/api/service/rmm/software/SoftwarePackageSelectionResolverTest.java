package com.openframe.api.service.rmm.software;

import com.openframe.api.dto.rmm.software.SoftwarePackageInput;
import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwarePackageSelectionResolverTest {

    private static final String SOFTWARE_ID = "42";

    @Mock private SoftwareInventoryService softwareInventoryService;

    @InjectMocks private SoftwarePackageSelectionResolver resolver;

    @Test
    void resolve_packageManagerAndNameGiven_selectionLeftAsSent() {
        // setup
        SoftwarePackageInput selection = selection(PackageManagerType.BREW, "slack", SOFTWARE_ID);
        selection.setBrewPackageType(BrewPackageType.CASK);
        List<SoftwarePackageInput> selections = List.of(selection);

        // execution
        resolver.resolve(selections);

        // verifications
        assertThat(selection)
                .extracting(SoftwarePackageInput::getPackageManager, SoftwarePackageInput::getPackageName,
                        SoftwarePackageInput::getBrewPackageType, SoftwarePackageInput::getSoftwareId)
                .containsExactly(PackageManagerType.BREW, "slack", BrewPackageType.CASK, SOFTWARE_ID);
        verifyNoInteractions(softwareInventoryService);
    }

    @Test
    void resolve_onlySoftwareIdOfABrewTitle_filledWithTheBrewPackageAndItsType() {
        // setup
        SoftwarePackageInput selection = selection(null, null, SOFTWARE_ID);
        List<SoftwarePackageInput> selections = List.of(selection);
        PackageCatalogEntry xz = PackageCatalogEntry.builder()
                .manager(PackageManagerType.BREW).packageId("xz").brewType(BrewPackageType.FORMULA).build();
        when(softwareInventoryService.getManagingPackage(SOFTWARE_ID)).thenReturn(xz);

        // execution
        resolver.resolve(selections);

        // verifications
        assertThat(selection)
                .extracting(SoftwarePackageInput::getPackageManager, SoftwarePackageInput::getPackageName,
                        SoftwarePackageInput::getBrewPackageType, SoftwarePackageInput::getSoftwareId)
                .containsExactly(PackageManagerType.BREW, "xz", BrewPackageType.FORMULA, SOFTWARE_ID);
    }

    @Test
    void resolve_onlySoftwareIdOfAWingetMatchedProgram_filledWithTheWingetPackage() {
        // setup
        SoftwarePackageInput selection = selection(null, null, SOFTWARE_ID);
        List<SoftwarePackageInput> selections = List.of(selection);
        PackageCatalogEntry chrome = PackageCatalogEntry.builder()
                .manager(PackageManagerType.WINGET).packageId("Google.Chrome").build();
        when(softwareInventoryService.getManagingPackage(SOFTWARE_ID)).thenReturn(chrome);

        // execution
        resolver.resolve(selections);

        // verifications
        assertThat(selection)
                .extracting(SoftwarePackageInput::getPackageManager, SoftwarePackageInput::getPackageName,
                        SoftwarePackageInput::getBrewPackageType, SoftwarePackageInput::getSoftwareId)
                .containsExactly(PackageManagerType.WINGET, "Google.Chrome", null, SOFTWARE_ID);
    }

    @ParameterizedTest
    @MethodSource("selectionsBreakingTheRule")
    void resolve_neitherAPackageNorOnlySoftwareId_throwsBadRequest(PackageManagerType packageManager,
                                                                   String packageName, String softwareId) {
        // setup
        List<SoftwarePackageInput> selections = List.of(selection(packageManager, packageName, softwareId));

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class, () -> resolver.resolve(selections));

        // verifications
        assertThat(ex.getMessage()).contains("packageManager and packageName together, or only softwareId");
        verifyNoInteractions(softwareInventoryService);
    }

    @Test
    void resolve_titleNoPackageManages_throwsTheInventoryRefusal() {
        // setup
        List<SoftwarePackageInput> selections = List.of(selection(null, null, SOFTWARE_ID));
        when(softwareInventoryService.getManagingPackage(SOFTWARE_ID))
                .thenThrow(new BadRequestException("No package manager manages Adobe Acrobat"));

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class, () -> resolver.resolve(selections));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("No package manager manages Adobe Acrobat");
    }

    private static Stream<Arguments> selectionsBreakingTheRule() {
        return Stream.of(
                Arguments.of(null, null, null),
                Arguments.of(null, " ", " "),
                Arguments.of(PackageManagerType.WINGET, null, SOFTWARE_ID),
                Arguments.of(PackageManagerType.WINGET, " ", null),
                Arguments.of(null, "Google.Chrome", SOFTWARE_ID),
                Arguments.of(null, "Google.Chrome", null));
    }

    private static SoftwarePackageInput selection(PackageManagerType packageManager, String packageName,
                                                  String softwareId) {
        SoftwarePackageInput selection = new SoftwarePackageInput();
        selection.setPackageManager(packageManager);
        selection.setPackageName(packageName);
        selection.setSoftwareId(softwareId);
        return selection;
    }
}
