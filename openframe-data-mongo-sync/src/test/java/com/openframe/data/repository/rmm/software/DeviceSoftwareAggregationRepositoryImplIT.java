package com.openframe.data.repository.rmm.software;

import com.openframe.data.document.rmm.software.DeviceSoftware;
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

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class DeviceSoftwareAggregationRepositoryImplIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final long CHROME = 42L;
    private static final long FIREFOX = 99L;

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private DeviceSoftwareAggregationRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(DeviceSoftware.class);
    }

    @Test
    @DisplayName("title: no connected rows -> empty")
    void title_noRows_isEmpty() {
        save(row(TENANT, "m1", CHROME).machineConnected(false).build());

        assertThat(repository.rollUpTitle(TENANT, CHROME)).isEmpty();
    }

    @Test
    @DisplayName("title: counts connected machines of this tenant and title only")
    void title_countsConnectedMachinesOfTenantAndTitle() {
        save(row(TENANT, "m1", CHROME).build());
        save(row(TENANT, "m2", CHROME).build());
        save(row(TENANT, "m3", CHROME).machineConnected(false).build());
        save(row(TENANT, "m1", FIREFOX).build());
        save(row(OTHER_TENANT, "m9", CHROME).build());

        SoftwareTitleRollup rollup = repository.rollUpTitle(TENANT, CHROME).orElseThrow();

        assertThat(rollup.devicesCount()).isEqualTo(2);
    }

    @Test
    @DisplayName("title: unions versions, CVEs and Windows keys across machines, without blanks, sorted")
    void title_unionsAcrossMachines() {
        save(row(TENANT, "m1", CHROME)
                .versions(List.of("130.0", "129.0")).vulnerabilities(List.of("CVE-2", "CVE-1"))
                .arpKeys(List.of("Google Chrome", "")).installerTypes(List.of("msi"))
                .packageFamilyNames(List.of("google.chrome_x")).build());
        save(row(TENANT, "m2", CHROME)
                .versions(List.of("129.0")).vulnerabilities(List.of("CVE-1"))
                .arpKeys(List.of("{8A69D345-D564-463C-AFF1-A69D9E530F96}")).installerTypes(List.of("exe", "msi"))
                .build());
        save(row(TENANT, "m3", CHROME).versions(null).vulnerabilities(null).build());

        SoftwareTitleRollup rollup = repository.rollUpTitle(TENANT, CHROME).orElseThrow();

        assertThat(rollup.versions()).containsExactlyInAnyOrder("129.0", "130.0");
        assertThat(rollup.cveCount()).isEqualTo(2);
        assertThat(rollup.arpKeys()).containsExactly("Google Chrome", "{8A69D345-D564-463C-AFF1-A69D9E530F96}");
        assertThat(rollup.installerTypes()).containsExactly("exe", "msi");
        assertThat(rollup.packageFamilyNames()).containsExactly("google.chrome_x");
    }

    @Test
    @DisplayName("title: counts the machines on each version, skipping missing versions")
    void title_devicesByVersion() {
        save(row(TENANT, "m1", CHROME).versions(List.of("130.0", "129.0")).build());
        save(row(TENANT, "m2", CHROME).versions(List.of("129.0")).build());
        save(row(TENANT, "m3", CHROME).versions(null).build());
        save(row(TENANT, "m4", CHROME).versions(java.util.Arrays.asList("129.0", null)).build());
        save(row(TENANT, "m5", CHROME).versions(List.of("131.0")).machineConnected(false).build());
        save(row(OTHER_TENANT, "m9", CHROME).versions(List.of("131.0")).build());

        SoftwareTitleRollup rollup = repository.rollUpTitle(TENANT, CHROME).orElseThrow();

        assertThat(rollup.devicesByVersion()).containsExactlyInAnyOrderEntriesOf(Map.of("129.0", 3, "130.0", 1));
    }

    @Test
    @DisplayName("title: no versions anywhere -> no version counts")
    void title_noVersions() {
        save(row(TENANT, "m1", CHROME).versions(null).build());

        assertThat(repository.rollUpTitle(TENANT, CHROME).orElseThrow().devicesByVersion()).isEmpty();
    }

    @Test
    @DisplayName("title: name and source from the first machine, vendor and upgrade code the first non-blank")
    void title_sampleFields() {
        save(row(TENANT, "m2", CHROME).name("Chrome B").source("programs").vendor("Google LLC").upgradeCode("{U2}").build());
        save(row(TENANT, "m1", CHROME).name("Chrome A").source("programs").vendor(" ").upgradeCode(null).build());

        SoftwareTitleRollup rollup = repository.rollUpTitle(TENANT, CHROME).orElseThrow();

        assertThat(rollup.name()).isEqualTo("Chrome A");
        assertThat(rollup.source()).isEqualTo("programs");
        assertThat(rollup.vendor()).isEqualTo("Google LLC");
        assertThat(rollup.upgradeCode()).isEqualTo("{U2}");
    }

    @Test
    @DisplayName("title: SystemComponent only when every machine that reports the flag reports it set")
    void title_systemComponent() {
        save(row(TENANT, "m1", CHROME).systemComponent(true).build());
        save(row(TENANT, "m2", CHROME).systemComponent(null).build());
        assertThat(repository.rollUpTitle(TENANT, CHROME).orElseThrow().systemComponent()).isTrue();

        save(row(TENANT, "m3", CHROME).systemComponent(false).build());
        assertThat(repository.rollUpTitle(TENANT, CHROME).orElseThrow().systemComponent()).isFalse();
    }

    @Test
    @DisplayName("title: no machine reports SystemComponent -> not a SystemComponent")
    void title_systemComponentNotReported() {
        save(row(TENANT, "m1", CHROME).systemComponent(null).build());

        assertThat(repository.rollUpTitle(TENANT, CHROME).orElseThrow().systemComponent()).isFalse();
    }

    @Test
    @DisplayName("cve: no connected rows -> empty")
    void cve_noRows_isEmpty() {
        save(row(TENANT, "m1", CHROME).vulnerabilities(List.of("CVE-1")).machineConnected(false).build());

        assertThat(repository.rollUpCve(TENANT, "CVE-1")).isEmpty();
    }

    @Test
    @DisplayName("cve: a machine affected through two titles counts once overall and once per title")
    void cve_countsDistinctMachines() {
        save(row(TENANT, "m1", CHROME).name("Chrome").source("apps")
                .versions(List.of("1.0")).vulnerabilities(List.of("CVE-1")).build());
        save(row(TENANT, "m2", CHROME).name("Chrome").source("apps")
                .versions(List.of("1.0")).vulnerabilities(List.of("CVE-1", "CVE-2")).build());
        save(row(TENANT, "m2", FIREFOX).name("Firefox").source("apps")
                .versions(List.of("5.0")).vulnerabilities(List.of("CVE-1")).build());
        save(row(TENANT, "m3", FIREFOX).vulnerabilities(List.of("CVE-1")).machineConnected(false).build());
        save(row(TENANT, "m4", FIREFOX).vulnerabilities(List.of("CVE-2")).build());
        save(row(OTHER_TENANT, "m9", CHROME).vulnerabilities(List.of("CVE-1")).build());

        CveRollup rollup = repository.rollUpCve(TENANT, "CVE-1").orElseThrow();

        assertThat(rollup.devicesCount()).isEqualTo(2);
        assertThat(rollup.titles()).extracting(CveRollup.Title::softwareTitleId).containsExactly(CHROME, FIREFOX);
        CveRollup.Title chrome = rollup.titles().getFirst();
        assertThat(chrome.devicesCount()).isEqualTo(2);
        assertThat(chrome.name()).isEqualTo("Chrome");
        assertThat(chrome.source()).isEqualTo("apps");
        assertThat(chrome.installedVersion()).isEqualTo("1.0");
        CveRollup.Title firefox = rollup.titles().get(1);
        assertThat(firefox.devicesCount()).isEqualTo(1);
        assertThat(firefox.installedVersion()).isEqualTo("5.0");
    }

    private void save(DeviceSoftware row) {
        mongoTemplate.save(row);
    }

    private static DeviceSoftware.DeviceSoftwareBuilder row(String tenantId, String machineId, long titleId) {
        return DeviceSoftware.builder()
                .tenantId(tenantId).machineId(machineId).softwareTitleId(titleId)
                .name("Google Chrome").source("apps")
                .machineConnected(true);
    }
}
