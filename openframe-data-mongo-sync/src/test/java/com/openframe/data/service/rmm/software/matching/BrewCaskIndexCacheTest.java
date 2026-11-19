package com.openframe.data.service.rmm.software.matching;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageCatalogEntry;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.repository.packagesearch.PackageCatalogRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BrewCaskIndexCacheTest {

    private static final String TENANT_ID = "t1";
    private static final String OTHER_TENANT_ID = "t2";

    @Mock private PackageCatalogRepository packageCatalogRepository;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private BrewCaskIndexCache brewCaskIndexCache;

    @Test
    void getBrewCaskIndex_firstCall_indexOfTheBrewCasksOfTheCatalog() {
        // setup
        PackageCatalogEntry slack = slack();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(packageCatalogRepository.findByManagerAndBrewType(PackageManagerType.BREW, BrewPackageType.CASK))
                .thenReturn(List.of(slack));

        // execution
        BrewCaskIndex brewCaskIndex = brewCaskIndexCache.getBrewCaskIndex();

        // verifications
        assertThat(brewCaskIndex.withBundleId("com.tinyspeck.slackmacgap")).containsExactly("slack");
        assertThat(brewCaskIndex.caskOf("slack")).isSameAs(slack);
    }

    @Test
    void getBrewCaskIndex_secondCallOfTheTenant_sameIndexWithoutReadingTheCatalogAgain() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(packageCatalogRepository.findByManagerAndBrewType(PackageManagerType.BREW, BrewPackageType.CASK))
                .thenReturn(List.of(slack()));
        BrewCaskIndex first = brewCaskIndexCache.getBrewCaskIndex();

        // execution
        BrewCaskIndex second = brewCaskIndexCache.getBrewCaskIndex();

        // verifications
        assertThat(second).isSameAs(first);
        verify(packageCatalogRepository).findByManagerAndBrewType(PackageManagerType.BREW, BrewPackageType.CASK);
    }

    @Test
    void getBrewCaskIndex_anotherTenant_readsTheCatalogOfThatTenant() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID, OTHER_TENANT_ID);
        when(packageCatalogRepository.findByManagerAndBrewType(PackageManagerType.BREW, BrewPackageType.CASK))
                .thenReturn(List.of(slack()));
        BrewCaskIndex first = brewCaskIndexCache.getBrewCaskIndex();

        // execution
        BrewCaskIndex second = brewCaskIndexCache.getBrewCaskIndex();

        // verifications
        assertThat(second).isNotSameAs(first);
        verify(packageCatalogRepository, times(2))
                .findByManagerAndBrewType(PackageManagerType.BREW, BrewPackageType.CASK);
    }

    private static PackageCatalogEntry slack() {
        return PackageCatalogEntry.builder().manager(PackageManagerType.BREW).brewType(BrewPackageType.CASK)
                .packageId("slack").name("Slack").aliases(List.of()).appNames(List.of("slack")).weakAppNames(List.of())
                .bundleIds(List.of("com.tinyspeck.slackmacgap")).bundleIdPrefixes(List.of()).build();
    }
}
