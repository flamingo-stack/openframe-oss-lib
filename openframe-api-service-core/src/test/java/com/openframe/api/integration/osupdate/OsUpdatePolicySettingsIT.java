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
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.api.integration.support.DeviceOsReadTestApplication.TENANT_ID;
import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(
        classes = DeviceOsReadTestApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.NONE,
        properties = {
                "openframe.rmm.os-update.enabled=true",
                "openframe.tenant-isolation.enabled=true"
        })
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class OsUpdatePolicySettingsIT extends BaseMongoIntegrationTest {

    private static final String POLICIES = "os_update_policies";

    private static final String SETTINGS = """
            maintenanceWindows { deviceClass daysOfWeek fromTime toTime }
            offlineRule inUseRule domainControllerRestartManual
            restartModes { deviceClass mode }
            restartDialog { deferOptions autoAnswerMinutes userMayScheduleRestart }
            """;
    private static final String CREATE = """
            mutation($input: OsUpdatePolicyInput!) {
              createOsUpdatePolicy(input: $input) { id %s }
            }
            """.formatted(SETTINGS);
    private static final String READ = """
            query($id: ID!) {
              osUpdatePolicy(id: $id) { name %s }
            }
            """.formatted(SETTINGS);

    @Autowired
    private DgsQueryExecutor queryExecutor;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void removeThePolicies() {
        mongoTemplate.getCollection(POLICIES).deleteMany(new Document());
    }

    @Test
    void policyCreatedWithItsSettings_readBackAsItWasSaved() {
        // setup
        Map<String, Object> settings = Map.of(
                "maintenanceWindows", List.of(
                        Map.of("deviceClass", "WORKSTATION", "daysOfWeek", List.of("TUESDAY", "THURSDAY"),
                                "fromTime", "22:00", "toTime", "02:00"),
                        Map.of("deviceClass", "SERVER", "daysOfWeek", List.of("SATURDAY"),
                                "fromTime", "03:00", "toTime", "06:00")),
                "offlineRule", "INSTALL_AT_NEXT_CHECK_IN",
                "inUseRule", "INSTALL_ASK_BEFORE_RESTART",
                "domainControllerRestartManual", true,
                "restartModes", List.of(
                        Map.of("deviceClass", "WORKSTATION", "mode", "DIALOG_THEN_DEADLINES"),
                        Map.of("deviceClass", "SERVER", "mode", "MAINTENANCE_WINDOW_ONLY")),
                "restartDialog", Map.of(
                        "deferOptions", List.of("FOUR_HOURS", "TOMORROW_MORNING"),
                        "autoAnswerMinutes", 60,
                        "userMayScheduleRestart", true));
        Map<String, Object> input = new HashMap<>(settings);
        input.put("name", "Default");
        input.put("target", Map.of("type", "TENANT"));
        input.put("rolloutRules", List.of(
                Map.of("urgency", "QUALITY", "mode", "EVERYONE_AT_ONCE", "daysAfterRelease", 7)));
        input.put("restartDeadlines", List.of(
                Map.of("urgency", "QUALITY", "focusDays", 1, "softDays", 5, "hardDays", 7)));

        // execution
        ExecutionResult created = queryExecutor.execute(CREATE, Map.of("input", input));

        // verifications
        assertThat(created.getErrors()).isEmpty();
        Map<String, Object> createdPolicy = created.<Map<String, Map<String, Object>>>getData()
                .get("createOsUpdatePolicy");
        assertThat(createdPolicy).containsAllEntriesOf(settings);
        ExecutionResult read = queryExecutor.execute(READ, Map.of("id", createdPolicy.get("id")));
        assertThat(read.getErrors()).isEmpty();
        assertThat(read.<Map<String, Map<String, Object>>>getData().get("osUpdatePolicy"))
                .containsEntry("name", "Default")
                .containsAllEntriesOf(settings);
    }
}
