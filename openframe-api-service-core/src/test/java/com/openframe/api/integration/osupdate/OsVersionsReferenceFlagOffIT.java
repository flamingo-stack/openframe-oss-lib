package com.openframe.api.integration.osupdate;

import com.netflix.graphql.dgs.DgsQueryExecutor;
import com.openframe.api.integration.BaseMongoIntegrationTest;
import com.openframe.api.integration.support.DeviceOsReadTestApplication;
import graphql.ExecutionResult;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.util.ClassUtils;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import static com.openframe.api.integration.osupdate.OsVersionsReadIT.build;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.machine;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.map;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.page;
import static com.openframe.api.integration.osupdate.OsVersionsReadIT.state;
import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

// openframe.rmm.os-update.os-versions.enabled is not set: off by default. No MeterRegistry either: none is needed.
@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.tenant-isolation.enabled=true"
        })
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsVersionsReferenceFlagOffIT extends BaseMongoIntegrationTest {

    private static final String MACHINE = "os-versions-flag-off-w11";

    @Autowired
    private ApplicationContext context;

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void storeOneDevice() {
        mongoTemplate.getCollection("machines").deleteMany(new Document("machineId", MACHINE));
        mongoTemplate.getCollection("device_os_states").deleteMany(new Document());
        mongoTemplate.getCollection("os_version_builds").deleteMany(new Document());
        mongoTemplate.getCollection("machines").insertOne(machine(MACHINE, TENANT_ID, "org-a", "ONLINE"));
        mongoTemplate.getCollection("device_os_states").insertOne(
                state(MACHINE, TENANT_ID, "WINDOWS", "11 24H2", "26100.4061", "Windows 11 Pro"));
    }

    @Test
    void referenceFlagOff_queriesRunWithoutTheReferenceBeans() {
        // setup

        // execution
        List<String> beans = Arrays.stream(context.getBeanDefinitionNames())
                .map(context::getType).filter(Objects::nonNull)
                .map(ClassUtils::getUserClass).map(Class::getSimpleName).toList();

        // verifications
        assertThat(beans).contains("OsVersionDataFetcher", "OsVersionService", "OsVersionResponseMapper",
                "WindowsReleaseMatcher");
        assertThat(beans).doesNotContain("WindowsReleaseClient", "WindowsReleaseParser", "WindowsReleaseMetrics");
    }

    @Test
    void osVersions_referenceFlagOff_countsWithoutTheReferenceFields() {
        // setup

        // execution
        ExecutionResult versions = queryExecutor.execute("""
                { osVersions { edges { node {
                  osVersion deviceCount devicesBehindCount currentBuild endOfSupportAt supportEnded } }
                  pageInfo { hasNextPage hasPreviousPage endCursor } } }
                """);

        // verifications
        assertThat(versions.getErrors()).isEmpty();
        assertThat(page(map(versions.<Map<String, Object>>getData()).get("osVersions")).nodes())
                .extracting(node -> node.get("osVersion"), node -> node.get("deviceCount"),
                        node -> node.get("devicesBehindCount"), node -> node.get("currentBuild"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"))
                .containsExactly(tuple("11 24H2", 1, null, null, null, null));
    }

    @Test
    void osVersionsAndDevices_referenceFlagOffWithAStoredBuild_buildFieldsWithoutTheEndOfSupport() {
        // setup
        mongoTemplate.getCollection("os_version_builds").insertOne(
                build(TENANT_ID, "WINDOWS", "11 24H2", "26100.9974"));

        // execution
        ExecutionResult versions = queryExecutor.execute("""
                { osVersions { edges { node {
                  osVersion devicesBehindCount currentBuild endOfSupportAt enterpriseEndOfSupportAt } }
                  pageInfo { hasNextPage hasPreviousPage endCursor } } }
                """);
        ExecutionResult devices = queryExecutor.execute("""
                { osVersionDevices(osVersion: "11 24H2") { edges { node {
                  machineId upToDate endOfSupportAt supportEnded } }
                  pageInfo { hasNextPage hasPreviousPage endCursor } } }
                """);

        // verifications
        assertThat(versions.getErrors()).isEmpty();
        assertThat(page(map(versions.<Map<String, Object>>getData()).get("osVersions")).nodes())
                .extracting(node -> node.get("osVersion"), node -> node.get("devicesBehindCount"),
                        node -> node.get("currentBuild"), node -> node.get("endOfSupportAt"),
                        node -> node.get("enterpriseEndOfSupportAt"))
                .containsExactly(tuple("11 24H2", 1, "26100.9974", null, null));
        assertThat(devices.getErrors()).isEmpty();
        assertThat(page(map(devices.<Map<String, Object>>getData()).get("osVersionDevices")).nodes())
                .extracting(node -> node.get("machineId"), node -> node.get("upToDate"),
                        node -> node.get("endOfSupportAt"), node -> node.get("supportEnded"))
                .containsExactly(tuple(MACHINE, false, null, null));
    }
}
