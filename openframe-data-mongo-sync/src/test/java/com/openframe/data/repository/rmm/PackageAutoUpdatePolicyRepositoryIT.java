package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.PackageAutoUpdatePolicy;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class PackageAutoUpdatePolicyRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";
    private static final PackageUpdateSettings WAIT = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.WAIT).deadlineSeconds(604_800L).countdownSeconds(300).build();
    private static final PackageUpdateSettings FORCE = PackageUpdateSettings.builder()
            .mode(PackageUpdateMode.FORCE).countdownSeconds(60).build();

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private PackageAutoUpdatePolicyRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.remove(new Query(), PackageAutoUpdatePolicy.class);
    }

    @Test
    @DisplayName("enable: one enabled policy per device, with the run's package, settings and Software")
    void enable_createsOnePolicyPerDevice() {
        repository.enable(template("slack", "title-7", WAIT, "admin@x"), List.of("m1", "m2", "m1"));

        Map<String, PackageAutoUpdatePolicy> byMachine = byMachine();
        assertThat(byMachine).containsOnlyKeys("m1", "m2");
        assertThat(byMachine.get("m1")).satisfies(p -> {
            assertThat(p.isEnabled()).isTrue();
            assertThat(p.getPackageManager()).isEqualTo(PackageManagerType.BREW);
            assertThat(p.getBrewPackageType()).isEqualTo(BrewPackageType.CASK);
            assertThat(p.getSoftwareId()).isEqualTo("title-7");
            assertThat(p.getSettings()).isEqualTo(WAIT);
            assertThat(p.getCreatedBy()).isEqualTo("admin@x");
            assertThat(p.getCreatedAt()).isNotNull();
        });
    }

    @Test
    @DisplayName("enable again: the same row, re-enabled with the newer settings; creator and Software kept")
    void enable_again_updatesInPlace() {
        repository.enable(template("slack", "title-7", WAIT, "admin@x"), List.of("m1"));
        PackageAutoUpdatePolicy first = byMachine().get("m1");
        first.setEnabled(false);
        repository.save(first);

        // picked from the package search this time: no Software id
        repository.enable(template("slack", null, FORCE, "other@x"), List.of("m1"));

        assertThat(repository.count()).isEqualTo(1);
        PackageAutoUpdatePolicy again = byMachine().get("m1");
        assertThat(again.getId()).isEqualTo(first.getId());
        assertThat(again.isEnabled()).isTrue();
        assertThat(again.getSettings()).isEqualTo(FORCE);
        assertThat(again.getSoftwareId()).isEqualTo("title-7");
        assertThat(again.getCreatedBy()).isEqualTo("admin@x");
        assertThat(again.getUpdatedBy()).isEqualTo("other@x");
    }

    @Test
    @DisplayName("enable: another package on the same device is its own policy")
    void enable_otherPackage_ownPolicy() {
        repository.enable(template("slack", null, WAIT, "admin@x"), List.of("m1"));
        repository.enable(template("google-chrome", null, WAIT, "admin@x"), List.of("m1"));

        assertThat(repository.findAll()).extracting(PackageAutoUpdatePolicy::getPackageName)
                .containsExactlyInAnyOrder("slack", "google-chrome");
    }

    private Map<String, PackageAutoUpdatePolicy> byMachine() {
        return repository.findAll().stream()
                .collect(Collectors.toMap(PackageAutoUpdatePolicy::getMachineId, Function.identity()));
    }

    private static PackageAutoUpdatePolicy template(String packageName, String softwareId,
                                                    PackageUpdateSettings settings, String actor) {
        return PackageAutoUpdatePolicy.builder()
                .tenantId(TENANT)
                .packageManager(PackageManagerType.BREW)
                .packageName(packageName)
                .brewPackageType(BrewPackageType.CASK)
                .softwareId(softwareId)
                .settings(settings)
                .updatedBy(actor)
                .build();
    }
}
