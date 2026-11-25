package com.openframe.api.integration.osupdate;

import com.mongodb.client.MongoCollection;
import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import com.openframe.api.integration.support.EndOfLifeSource;
import graphql.ExecutionResult;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.rmm.os-update.os-versions.enabled=true",
                "openframe.tenant-isolation.enabled=true"
        })
@Import(OsVersionsReadIT.Metrics.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsVersionsReadIT extends BaseMongoIntegrationTest {

    private static final String OTHER_TENANT_ID = "tenant-b";
    private static final String OWN_MACHINES = "os-versions-read-";
    private static final String W11_A = OWN_MACHINES + "w11-a";
    private static final String W11_B = OWN_MACHINES + "w11-b";
    private static final String W11_OLD_BASE = OWN_MACHINES + "w11-c";
    private static final String W11_25H2 = OWN_MACHINES + "w11-25h2";
    private static final String W10 = OWN_MACHINES + "w10";
    private static final String MAC = OWN_MACHINES + "mac";
    private static final String NO_VERSION = OWN_MACHINES + "no-version";
    private static final String OTHER_TENANT_MACHINE = OWN_MACHINES + "of-tenant-b";

    private static final String ORG_A = "org-a";
    private static final String ORG_B = "org-b";

    private static final String OS_VERSIONS = """
            query($filter: OsVersionFilterInput, $first: Int, $after: String) {
              osVersions(filter: $filter, first: $first, after: $after) {
                edges { cursor node {
                  osVersion deviceCount devicesBehindCount currentBuild endOfSupportAt supportEnded
                  enterpriseEndOfSupportAt enterpriseSupportEnded
                } }
                pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
              }
            }
            """;
    private static final String DEVICES = """
            query($osVersion: String!, $organizationIds: [String!], $first: Int, $after: String) {
              osVersionDevices(osVersion: $osVersion, organizationIds: $organizationIds, first: $first,
                  after: $after) {
                edges { cursor node { machineId osBuild osProductName upToDate endOfSupportAt supportEnded
                  machine { machineId hostname } } }
                pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
              }
            }
            """;

    @DynamicPropertySource
    static void endOfLifeSource(DynamicPropertyRegistry registry) {
        String baseUrl = EndOfLifeSource.start();
        registry.add("openframe.rmm.os-update.os-versions.endoflife.base-url", () -> baseUrl);
    }

    @TestConfiguration
    static class Metrics {
        @Bean
        MeterRegistry meterRegistry() {
            return new SimpleMeterRegistry();
        }
    }

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private MeterRegistry meterRegistry;

    // WARNING: deleteMany, not drop: the unique indexes of the feature collections must outlive a test
    @BeforeEach
    void storeTheDevicesOfTheTenant() {
        machines().deleteMany(new Document("machineId", new Document("$regex", "^" + OWN_MACHINES)));
        stateCollection().deleteMany(new Document());
        buildCollection().deleteMany(new Document());

        machines().insertMany(List.of(
                machine(W11_A, TENANT_ID, ORG_A, "ONLINE"),
                machine(W11_OLD_BASE, TENANT_ID, ORG_A, "ONLINE"),
                machine(W11_25H2, TENANT_ID, ORG_A, "OFFLINE"),
                machine(MAC, TENANT_ID, ORG_A, "ONLINE"),
                machine(W11_B, TENANT_ID, ORG_B, "ONLINE"),
                machine(W10, TENANT_ID, ORG_B, "ONLINE"),
                machine(NO_VERSION, TENANT_ID, ORG_B, "ONLINE"),
                machine(OTHER_TENANT_MACHINE, OTHER_TENANT_ID, ORG_A, "ONLINE")));
        stateCollection().insertMany(List.of(
                state(W11_A, TENANT_ID, "WINDOWS", "11 24H2", "26100.4061", "Windows 11 Pro"),
                state(W11_B, TENANT_ID, "WINDOWS", "11 24H2", "26100.2033", "Windows 11 Enterprise"),
                state(W11_OLD_BASE, TENANT_ID, "WINDOWS", "11 24H2", "22631.4460", "Windows 11 Pro"),
                state(W11_25H2, TENANT_ID, "WINDOWS", "11 25H2", "26200.7171", "Windows 11 Pro"),
                state(W10, TENANT_ID, "WINDOWS", "10 22H2", "19045.6456", "Windows 10 Pro"),
                state(MAC, TENANT_ID, "MACOS", "26.1", "25B78", "macOS"),
                state(NO_VERSION, TENANT_ID, "WINDOWS", null, null, null),
                state(OTHER_TENANT_MACHINE, OTHER_TENANT_ID, "WINDOWS", "11 24H2", "26100.1", "Windows 11 Pro")));
        buildCollection().insertMany(List.of(
                build(TENANT_ID, "WINDOWS", "11 24H2", "26100.3775").append("hotpatchBuild", "26100.2033"),
                build(TENANT_ID, "WINDOWS", "10 22H2", "19045.6456"),
                build(TENANT_ID, "MACOS", "11 25H2", "99999.1"),
                build(OTHER_TENANT_ID, "WINDOWS", "11 24H2", "26100.99999"),
                build(OTHER_TENANT_ID, "WINDOWS", "11 25H2", "26200.99999")));
    }

    @Test
    void osVersions_windowsVersionsOfTheTenant_highestFirstWithBothEndsOfSupportAndTheNotHotpatchedBehind() {
        // setup

        // execution
        Page page = osVersions(null, null, null);

        // verifications
        assertThat(page.nodes())
                .extracting(node -> node.get("osVersion"), node -> node.get("deviceCount"),
                        node -> node.get("devicesBehindCount"), node -> node.get("currentBuild"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"),
                        node -> node.get("enterpriseEndOfSupportAt"), node -> node.get("enterpriseSupportEnded"))
                .containsExactly(
                        tuple("11 25H2", 1, null, "26200", "2027-10-12", false, "2028-10-10", false),
                        tuple("11 24H2", 3, 1, "26100.3775", "2026-10-13", true, "2027-10-12", false),
                        tuple("10 22H2", 1, 0, "19045.6456", "2025-10-14", true, "2025-10-14", true));
        assertThat(page.hasNextPage()).isFalse();
        assertThat(meterRegistry.find("openframe.rmm.os_update.os_versions.source_failed").counter()).isNull();
    }

    @Test
    void osVersions_organizations_onlyTheirDevicesCounted() {
        // setup

        // execution
        Page orgA = osVersions(Map.of("organizationIds", List.of(ORG_A)), null, null);
        Page orgB = osVersions(Map.of("organizationIds", List.of(ORG_B)), null, null);
        Page withoutDevices = osVersions(Map.of("organizationIds", List.of("org-without-devices")), null, null);

        // verifications
        assertThat(orgA.nodes()).extracting(node -> node.get("osVersion"), node -> node.get("deviceCount"),
                node -> node.get("devicesBehindCount"))
                .containsExactly(tuple("11 25H2", 1, null), tuple("11 24H2", 2, 1));
        assertThat(orgB.nodes()).extracting(node -> node.get("osVersion"), node -> node.get("deviceCount"),
                node -> node.get("devicesBehindCount"))
                .containsExactly(tuple("11 24H2", 1, 0), tuple("10 22H2", 1, 0));
        assertThat(withoutDevices.nodes()).isEmpty();
    }

    @Test
    void osVersions_inPagesOfTwo_everyVersionOnce() {
        // setup

        // execution
        Page firstPage = osVersions(null, 2, null);
        Page secondPage = osVersions(null, 2, firstPage.endCursor());

        // verifications
        assertThat(osVersionsOf(firstPage)).containsExactly("11 25H2", "11 24H2");
        assertThat(firstPage.hasNextPage()).isTrue();
        assertThat(firstPage.hasPreviousPage()).isFalse();
        assertThat(osVersionsOf(secondPage)).containsExactly("10 22H2");
        assertThat(secondPage.hasNextPage()).isFalse();
        assertThat(secondPage.hasPreviousPage()).isTrue();
    }

    @Test
    void osVersionDevices_devicesOfTheVersion_byMachineIdWithTheFlagAndTheEndOfSupportOfTheEdition() {
        // setup

        // execution
        Page page = devices("11 24H2", null, null, null);

        // verifications
        assertThat(page.nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("osBuild"),
                        node -> node.get("osProductName"), node -> node.get("upToDate"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"),
                        node -> map(node.get("machine")).get("hostname"))
                .containsExactly(
                        tuple(W11_A, "26100.4061", "Windows 11 Pro", true, "2026-10-13", true, "host-" + W11_A),
                        tuple(W11_B, "26100.2033", "Windows 11 Enterprise", true, "2027-10-12", false,
                                "host-" + W11_B),
                        tuple(W11_OLD_BASE, "22631.4460", "Windows 11 Pro", false, "2026-10-13", true,
                                "host-" + W11_OLD_BASE));
    }

    @Test
    void osVersionDevices_versionWithoutAStoredBuildAndVersionWithOneEndOfSupport_noFlagAndTheOnlyDate() {
        // setup

        // execution
        Page withoutBuild = devices("11 25H2", null, null, null);
        Page oneEndOfSupport = devices("10 22H2", null, null, null);

        // verifications
        assertThat(withoutBuild.nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("upToDate"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"))
                .containsExactly(tuple(W11_25H2, null, "2027-10-12", false));
        assertThat(oneEndOfSupport.nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("upToDate"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"))
                .containsExactly(tuple(W10, true, "2025-10-14", true));
    }

    @Test
    void osVersionDevices_inPagesOfTwoAndForOrganizations_everyDeviceOnceAndOnlyTheirs() {
        // setup

        // execution
        Page firstPage = devices("11 24H2", null, 2, null);
        Page secondPage = devices("11 24H2", null, 2, firstPage.endCursor());
        Page orgA = devices("11 24H2", List.of(ORG_A), null, null);
        Page orgBAfterTheFirst = devices("11 24H2", List.of(ORG_B), 1, firstPage.cursors().getFirst());

        // verifications
        assertThat(machineIds(firstPage)).containsExactly(W11_A, W11_B);
        assertThat(firstPage.hasNextPage()).isTrue();
        assertThat(machineIds(secondPage)).containsExactly(W11_OLD_BASE);
        assertThat(secondPage.hasNextPage()).isFalse();
        assertThat(secondPage.hasPreviousPage()).isTrue();
        assertThat(machineIds(orgA)).containsExactly(W11_A, W11_OLD_BASE);
        assertThat(machineIds(orgBAfterTheFirst)).containsExactly(W11_B);
        assertThat(orgBAfterTheFirst.hasNextPage()).isFalse();
    }

    @Test
    void osVersionDevices_versionNoDeviceRunsOrMacVersion_empty() {
        // setup

        // execution
        Page unknown = devices("11 26H2", null, null, null);
        Page mac = devices("26.1", null, null, null);

        // verifications
        assertThat(unknown.nodes()).isEmpty();
        assertThat(mac.nodes()).isEmpty();
    }

    private Page osVersions(Map<String, Object> filter, Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("filter", filter);
        variables.put("first", first);
        variables.put("after", after);
        return page(data(OS_VERSIONS, variables).get("osVersions"));
    }

    private Page devices(String osVersion, List<String> organizationIds, Integer first, String after) {
        Map<String, Object> variables = new HashMap<>();
        variables.put("osVersion", osVersion);
        variables.put("organizationIds", organizationIds);
        variables.put("first", first);
        variables.put("after", after);
        return page(data(DEVICES, variables).get("osVersionDevices"));
    }

    private Map<String, Object> data(String query, Map<String, Object> variables) {
        ExecutionResult result = queryExecutor.execute(query, variables);
        assertThat(result.getErrors()).as("GraphQL errors").isEmpty();
        return result.getData();
    }

    static Page page(Object connection) {
        Map<String, Object> pageInfo = map(map(connection).get("pageInfo"));
        List<Map<String, Object>> edges = list(map(connection).get("edges"));
        List<Map<String, Object>> nodes = edges.stream().map(edge -> map(edge.get("node"))).toList();
        List<String> cursors = edges.stream().map(edge -> (String) edge.get("cursor")).toList();
        return new Page(nodes, cursors, (boolean) pageInfo.get("hasNextPage"),
                (boolean) pageInfo.get("hasPreviousPage"), (String) pageInfo.get("endCursor"));
    }

    private static List<String> osVersionsOf(Page... pages) {
        return Arrays.stream(pages)
                .flatMap(page -> page.nodes().stream())
                .map(node -> (String) node.get("osVersion"))
                .toList();
    }

    private static List<String> machineIds(Page page) {
        return page.nodes().stream().map(node -> (String) node.get("machineId")).toList();
    }

    @SuppressWarnings("unchecked")
    static Map<String, Object> map(Object value) {
        return (Map<String, Object>) value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> list(Object value) {
        return (List<Map<String, Object>>) value;
    }

    record Page(List<Map<String, Object>> nodes, List<String> cursors, boolean hasNextPage,
                boolean hasPreviousPage, String endCursor) {
    }

    static Document machine(String machineId, String tenantId, String organizationId, String status) {
        return new Document("machineId", machineId)
                .append("tenantId", tenantId)
                .append("organizationId", organizationId)
                .append("status", status)
                .append("hostname", "host-" + machineId)
                .append("osType", "WINDOWS");
    }

    static Document state(String machineId, String tenantId, String platform, String osVersion, String osBuild,
                          String osProductName) {
        return new Document("tenantId", tenantId)
                .append("machineId", machineId)
                .append("platform", platform)
                .append("osVersion", osVersion)
                .append("osBuild", osBuild)
                .append("osProductName", osProductName)
                .append("version", 0L);
    }

    static Document build(String tenantId, String platform, String osVersion, String latestBuild) {
        return new Document("tenantId", tenantId)
                .append("platform", platform)
                .append("osVersion", osVersion)
                .append("latestBuild", latestBuild)
                .append("updatedAt", new Date())
                .append("version", 0L);
    }

    private MongoCollection<Document> buildCollection() {
        return mongoTemplate.getCollection("os_version_builds");
    }

    private MongoCollection<Document> machines() {
        return mongoTemplate.getCollection("machines");
    }

    private MongoCollection<Document> stateCollection() {
        return mongoTemplate.getCollection("device_os_states");
    }
}
