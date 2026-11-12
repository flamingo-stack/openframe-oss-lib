package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageMatchState;
import com.openframe.data.document.rmm.software.Software;
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
                new SoftwareTitleQuery(TENANT, null, false, null, MANAGER_SOURCES), firstTwo);

        assertThat(page.getTotalElements()).isEqualTo(6);
        assertThat(names(page)).containsExactly("Contoso Tool", "Ghost");
        assertThat(page.hasNext()).isTrue();
    }

    private Page<Software> titles(String nameLower, boolean vulnerableOnly, Boolean manageable) {
        return repository.findTitles(
                new SoftwareTitleQuery(TENANT, nameLower, vulnerableOnly, manageable, MANAGER_SOURCES), Pageable.unpaged());
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
