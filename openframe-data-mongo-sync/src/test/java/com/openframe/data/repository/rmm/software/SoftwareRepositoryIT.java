package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.Software;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import com.openframe.data.document.rmm.software.SoftwarePackageMatch;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class SoftwareRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";
    private static final Set<String> MANAGER_SOURCES = Set.of("homebrew_packages", "chocolatey_packages");

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private SoftwareRepository repository;

    @BeforeEach
    void seed() {
        mongoTemplate.remove(new Query(), Software.class);
        repository.saveAll(List.of(
                title(TENANT, 1L, "Google Chrome", "programs", match(PackageMatchState.MATCHED), 3, 2),
                title(TENANT, 2L, "Contoso Tool", "programs", match(PackageMatchState.NO_PACKAGE), 1, 0),
                title(TENANT, 3L, "node", "homebrew_packages", null, 2, 1),
                title(TENANT, 4L, "git", "chocolatey_packages", null, 1, 0),
                title(TENANT, 5L, "Ghost", "apps", null, 1, 0),                                  // the matcher never saw it
                title(TENANT, 6L, "Visual C++ 2015", "programs", match(PackageMatchState.AMBIGUOUS), 1, 0),
                title(TENANT, 7L, "gone", "apps", match(PackageMatchState.MATCHED), 0, 0),        // no device has it any more
                title("tenant-2", 1L, "Google Chrome", "programs", match(PackageMatchState.MATCHED), 5, 2)));
    }

    @Test
    @DisplayName("manageable: a title brew or choco installed, or one matched to a package; the rest are not")
    void findTitles_manageable_splitsByInstallerAndMatch() {
        assertThat(names(titles(null, false, true))).containsExactlyInAnyOrder("Google Chrome", "node", "git");
        assertThat(names(titles(null, false, false))).containsExactlyInAnyOrder("Contoso Tool", "Ghost", "Visual C++ 2015");
        assertThat(names(titles(null, false, null))).hasSize(6);
    }

    @Test
    @DisplayName("search is a quoted fragment of the lower-case name; vulnerable keeps the titles with CVEs")
    void findTitles_searchAndVulnerable() {
        assertThat(names(titles("c++", false, null))).containsExactly("Visual C++ 2015");
        assertThat(names(titles("o", true, null))).containsExactlyInAnyOrder("Google Chrome", "node");
        assertThat(names(titles("o", true, false))).isEmpty();
    }

    @Test
    void findTitles_pagesTheSortAndCountsTheWholeMatch() {
        Pageable firstTwo = PageRequest.of(0, 2, Sort.by(Sort.Direction.ASC, "nameLower"));

        Page<Software> page = repository.findTitles(
                titles().build(), firstTwo);

        assertThat(page.getTotalElements()).isEqualTo(6);
        assertThat(names(page)).containsExactly("Contoso Tool", "Ghost");
        assertThat(page.hasNext()).isTrue();
    }

    @Test
    @DisplayName("sources: winget takes the matched titles, brew and choco the ones they installed, unmanaged the rest; several are any of them")
    void findTitles_sources_eachValueAndTheirUnion() {
        SoftwareTitleQuery winget = titles().installerSources(Set.of("winget_packages")).matchedChosen(true).build();
        SoftwareTitleQuery brew = titles().installerSources(Set.of("homebrew_packages")).build();
        SoftwareTitleQuery chocolatey = titles().installerSources(Set.of("chocolatey_packages")).build();
        SoftwareTitleQuery unmanaged = titles().installerSources(Set.of()).unmanagedChosen(true).build();
        SoftwareTitleQuery brewOrUnmanaged = titles().installerSources(Set.of("homebrew_packages")).unmanagedChosen(true).build();

        assertThat(names(winget)).containsExactly("Google Chrome");
        assertThat(names(brew)).containsExactly("node");
        assertThat(names(chocolatey)).containsExactly("git");
        assertThat(names(unmanaged)).containsExactlyInAnyOrder("Contoso Tool", "Ghost", "Visual C++ 2015");
        assertThat(names(brewOrUnmanaged)).containsExactlyInAnyOrder("node", "Contoso Tool", "Ghost", "Visual C++ 2015");
    }

    @Test
    @DisplayName("sources with manageable: both must hold, and the total follows")
    void findTitles_sourcesWithManageable_bothNarrow() {
        SoftwareTitleQuery manageableBrewOrUnmanaged = titles().manageable(true)
                .installerSources(Set.of("homebrew_packages")).unmanagedChosen(true).build();
        SoftwareTitleQuery manageableUnmanaged = titles().manageable(true)
                .installerSources(Set.of()).unmanagedChosen(true).build();
        Pageable firstOne = PageRequest.of(0, 1, Sort.by(Sort.Direction.ASC, "nameLower"));

        assertThat(names(manageableBrewOrUnmanaged)).containsExactly("node");
        assertThat(names(manageableUnmanaged)).isEmpty();
        assertThat(repository.findTitles(manageableBrewOrUnmanaged, firstOne).getTotalElements()).isEqualTo(1);
    }

    @Test
    @DisplayName("os: the titles of the Fleet sources of the chosen systems")
    void findTitles_osSources_titlesOfThoseSources() {
        SoftwareTitleQuery windows = titles().osSources(Set.of("programs", "chocolatey_packages")).build();
        SoftwareTitleQuery macOs = titles().osSources(Set.of("apps", "homebrew_packages")).build();
        SoftwareTitleQuery manageableMacOs = titles().manageable(true).osSources(Set.of("apps", "homebrew_packages")).build();

        assertThat(names(windows)).containsExactlyInAnyOrder("Google Chrome", "Contoso Tool", "git", "Visual C++ 2015");
        assertThat(names(macOs)).containsExactlyInAnyOrder("node", "Ghost");
        assertThat(names(manageableMacOs)).containsExactly("node");
    }

    @Test
    @DisplayName("auto-update: ON has an enabled policy, OFF has policies all off or none and a package, NO_PACKAGE none and no package")
    void findTitles_autoUpdateStatuses_eachValueAndTheirUnion() {
        // Contoso Tool (2) has an enabled policy, git (4) only turned-off ones
        assertThat(names(autoUpdate(SoftwareAutoUpdateStatus.ON))).containsExactly("Contoso Tool");
        assertThat(names(autoUpdate(SoftwareAutoUpdateStatus.OFF))).containsExactlyInAnyOrder("git", "Google Chrome", "node");
        assertThat(names(autoUpdate(SoftwareAutoUpdateStatus.NO_PACKAGE))).isEmpty();
        assertThat(names(autoUpdate(SoftwareAutoUpdateStatus.NEEDS_ADOPTION))).isEmpty();
        assertThat(names(autoUpdate(SoftwareAutoUpdateStatus.ON, SoftwareAutoUpdateStatus.OFF)))
                .containsExactlyInAnyOrder("Contoso Tool", "git", "Google Chrome", "node");
    }

    @Test
    @DisplayName("auto-update NO_PACKAGE: a title without a policy whose match found no package; with manageable both must hold")
    void findTitles_autoUpdateNoPackage_noPolicyAndNoPackage() {
        SoftwareTitleQuery noPackage = titles().autoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.NO_PACKAGE))
                .enabledPolicyTitleIds(Set.of()).policyTitleIds(Set.of()).build();
        SoftwareTitleQuery manageableOff = titles().manageable(true)
                .autoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.OFF))
                .enabledPolicyTitleIds(Set.of()).policyTitleIds(Set.of()).build();

        assertThat(names(noPackage)).containsExactly("Contoso Tool");
        assertThat(names(manageableOff)).containsExactlyInAnyOrder("Google Chrome", "node");
    }

    @Test
    @DisplayName("brew titles: one the brew catalog lacks is NO_PACKAGE and not OFF; a matched one is OFF and is not a winget title")
    void findTitles_brewTitles_followTheirStoredMatch() {
        repository.saveAll(List.of(
                title(TENANT, 8L, "tapped-tool", "homebrew_packages", brewMatch(PackageMatchState.NO_PACKAGE), 1, 0),
                title(TENANT, 9L, "wget", "homebrew_packages", brewMatch(PackageMatchState.MATCHED), 1, 0)));
        SoftwareTitleQuery noPackage = titles().autoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.NO_PACKAGE))
                .enabledPolicyTitleIds(Set.of()).policyTitleIds(Set.of()).build();
        SoftwareTitleQuery off = titles().autoUpdateStatuses(List.of(SoftwareAutoUpdateStatus.OFF))
                .enabledPolicyTitleIds(Set.of()).policyTitleIds(Set.of()).build();
        SoftwareTitleQuery winget = titles().installerSources(Set.of("winget_packages")).matchedChosen(true).build();

        assertThat(names(noPackage)).containsExactlyInAnyOrder("Contoso Tool", "tapped-tool");
        assertThat(names(off)).containsExactlyInAnyOrder("Google Chrome", "node", "wget");
        assertThat(names(winget)).containsExactly("Google Chrome");
    }

    private static SoftwarePackageMatch brewMatch(PackageMatchState state) {
        PackageManagerType manager = state == PackageMatchState.MATCHED ? PackageManagerType.BREW : null;
        return SoftwarePackageMatch.builder().state(state).manager(manager).build();
    }

    private static SoftwareTitleQuery autoUpdate(SoftwareAutoUpdateStatus... statuses) {
        return titles().autoUpdateStatuses(List.of(statuses))
                .enabledPolicyTitleIds(Set.of(2L)).policyTitleIds(Set.of(2L, 4L)).build();
    }

    private List<String> names(SoftwareTitleQuery titles) {
        return names(repository.findTitles(titles, Pageable.unpaged()));
    }

    private static SoftwareTitleQuery.SoftwareTitleQueryBuilder titles() {
        return SoftwareTitleQuery.builder().tenantId(TENANT).managerSources(MANAGER_SOURCES);
    }

    private Page<Software> titles(String nameLower, boolean vulnerableOnly, Boolean manageable) {
        SoftwareTitleQuery titles = titles().nameLower(nameLower).vulnerableOnly(vulnerableOnly).manageable(manageable).build();
        return repository.findTitles(titles, Pageable.unpaged());
    }

    private static List<String> names(Page<Software> page) {
        return page.getContent().stream().map(Software::getName).toList();
    }

    private static SoftwarePackageMatch match(PackageMatchState state) {
        return SoftwarePackageMatch.builder().state(state).manager(PackageManagerType.WINGET).build();
    }

    private static Software title(String tenantId, long titleId, String name, String source, SoftwarePackageMatch match,
                                  int devices, int cves) {
        return Software.builder()
                .tenantId(tenantId).softwareTitleId(titleId).name(name).nameLower(name.toLowerCase(Locale.ROOT))
                .source(source).packageMatch(match).devicesCount(devices).cveCount(cves)
                .build();
    }
}
