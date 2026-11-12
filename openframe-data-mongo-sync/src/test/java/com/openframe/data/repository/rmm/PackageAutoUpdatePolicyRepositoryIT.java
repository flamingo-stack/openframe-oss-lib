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

import java.time.Instant;
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

    @Test
    @DisplayName("disableBySoftwareId: turns off only that Software's enabled policies, rows stay")
    void disableBySoftwareId_turnsOffItsPolicies() {
        repository.enable(template("google-chrome", "title-7", WAIT, "admin@x"), List.of("m1", "m2"));
        repository.enable(template("slack", "title-9", WAIT, "admin@x"), List.of("m1"));

        long turnedOff = repository.disableBySoftwareId(TENANT, "title-7", "other@x");

        assertThat(turnedOff).isEqualTo(2);
        assertThat(repository.findByTenantIdAndSoftwareIdIn(TENANT, List.of("title-7")))
                .hasSize(2)
                .allSatisfy(p -> {
                    assertThat(p.isEnabled()).isFalse();
                    assertThat(p.getUpdatedBy()).isEqualTo("other@x");
                });
        assertThat(repository.findByTenantIdAndMachineIdAndSoftwareIdIn(TENANT, "m1", List.of("title-9")))
                .singleElement().satisfies(p -> assertThat(p.isEnabled()).isTrue());
        assertThat(repository.disableBySoftwareId(TENANT, "title-7", "other@x")).isZero();   // idempotent
    }

    @Test
    @DisplayName("lastVersion: set by enable as the starting point, moved by markOrdered; the trigger reads enabled rows only")
    void lastVersion_startsAtEnable_movesWithOrders() {
        PackageAutoUpdatePolicy chrome = template("google-chrome", null, WAIT, "admin@x");
        chrome.setLastVersion("151.0.7922.98");
        repository.enable(chrome, List.of("m1", "m2"));
        repository.enable(template("slack", "title-9", WAIT, "admin@x"), List.of("m1"));
        repository.disableBySoftwareId(TENANT, "title-9", "admin@x");

        List<PackageAutoUpdatePolicy> enabled = repository.findByTenantIdAndEnabledTrue(TENANT);
        assertThat(enabled).extracting(PackageAutoUpdatePolicy::getPackageName).containsOnly("google-chrome");
        assertThat(enabled).extracting(PackageAutoUpdatePolicy::getLastVersion).containsOnly("151.0.7922.98");

        assertThat(repository.markOrdered(List.of(), "152.0.7977.65", "req-2")).isZero();   // nothing to mark, nothing touched
        repository.markOrdered(List.of(byMachine("google-chrome").get("m1").getId()), "152.0.7977.65", "req-2");

        Map<String, PackageAutoUpdatePolicy> chromeByMachine = byMachine("google-chrome");
        assertThat(chromeByMachine.get("m1").getLastVersion()).isEqualTo("152.0.7977.65");
        assertThat(chromeByMachine.get("m1").getRequestId()).isEqualTo("req-2");
        assertThat(chromeByMachine.get("m2").getLastVersion()).isEqualTo("151.0.7922.98");
        assertThat(chromeByMachine.get("m2").getRequestId()).isNull();
    }

    @Test
    @DisplayName("requestId: named by a retry too, found by device and package, replaced by the next order")
    void requestId_setByARetry_replacedByTheNextOrder() {
        PackageAutoUpdatePolicy chrome = template("google-chrome", null, WAIT, "admin@x");
        chrome.setLastVersion("151.0.7922.98");
        repository.enable(chrome, List.of("m1"));
        String id = byMachine("google-chrome").get("m1").getId();

        repository.markRetryScheduled(id, "151.0.7922.98", "req-1");

        assertThat(repository.findByTenantIdAndMachineIdAndPackageManagerAndPackageName(TENANT, "m1",
                chrome.getPackageManager(), "google-chrome")).get()
                .extracting(PackageAutoUpdatePolicy::getRequestId).isEqualTo("req-1");

        repository.markOrdered(List.of(id), "152.0.7977.65", "req-2");

        PackageAutoUpdatePolicy ordered = byMachine("google-chrome").get("m1");
        assertThat(ordered.getRequestId()).isEqualTo("req-2");
        assertThat(ordered.getLastVersion()).isEqualTo("152.0.7977.65");
    }

    @Test
    @DisplayName("disable: turns off that one policy, the device's other policies and the other devices stay on")
    void disable_turnsOffOnePolicy() {
        repository.enable(template("google-chrome", "title-7", WAIT, "admin@x"), List.of("m1", "m2"));
        repository.enable(template("slack", "title-9", WAIT, "admin@x"), List.of("m1"));
        String id = byMachine("google-chrome").get("m1").getId();
        Instant at = Instant.parse("2026-11-02T10:00:00Z");

        assertThat(repository.disable(id, null, "package-auto-update", at)).isOne();

        PackageAutoUpdatePolicy off = byMachine("google-chrome").get("m1");
        assertThat(off.isEnabled()).isFalse();
        assertThat(off.getUpdatedBy()).isEqualTo("package-auto-update");
        assertThat(off.getUpdatedAt()).isEqualTo(at);
        assertThat(repository.findByTenantIdAndEnabledTrue(TENANT)).hasSize(2)
                .noneMatch(policy -> policy.getId().equals(id));
    }

    @Test
    @DisplayName("disable and markRetryScheduled: a policy ordered a newer version or already off since the read is left as it is")
    void conditionalWrites_policyMovedOn_matchNothing() {
        PackageAutoUpdatePolicy chrome = template("google-chrome", "title-7", WAIT, "admin@x");
        chrome.setLastVersion("151.0.7922.98");
        repository.enable(chrome, List.of("m1", "m2"));
        String m1 = byMachine("google-chrome").get("m1").getId();
        String m2 = byMachine("google-chrome").get("m2").getId();
        repository.markOrdered(List.of(m1), "152.0.7977.65", "req-2");
        repository.disable(m2, "151.0.7922.98", "admin@x", Instant.now());

        assertThat(repository.disable(m1, "151.0.7922.98", "package-auto-update", Instant.now())).isZero();
        assertThat(repository.markRetryScheduled(m1, "151.0.7922.98", "req-old")).isZero();
        assertThat(repository.markRetryScheduled(m2, "151.0.7922.98", "req-old")).isZero();

        PackageAutoUpdatePolicy ordered = byMachine("google-chrome").get("m1");
        assertThat(ordered.isEnabled()).isTrue();
        assertThat(ordered.getRequestId()).isEqualTo("req-2");
        assertThat(byMachine("google-chrome").get("m2").getRequestId()).isNull();
    }

    private Map<String, PackageAutoUpdatePolicy> byMachine(String packageName) {
        return repository.findAll().stream()
                .filter(p -> packageName.equals(p.getPackageName()))
                .collect(Collectors.toMap(PackageAutoUpdatePolicy::getMachineId, Function.identity()));
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
