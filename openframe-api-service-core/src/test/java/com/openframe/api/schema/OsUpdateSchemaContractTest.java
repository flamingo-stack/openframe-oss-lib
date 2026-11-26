package com.openframe.api.schema;

import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsPatchState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsRebootPending;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateClassification;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeferOption;
import com.openframe.data.document.rmm.osupdate.OsUpdateDeviceClass;
import com.openframe.data.document.rmm.osupdate.OsUpdateInUseRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateListConfidence;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.document.rmm.osupdate.OsUpdateOfflineRule;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateRestartMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateScanState;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.document.rmm.osupdate.OsUpdateType;
import graphql.language.AstPrinter;
import graphql.language.EnumTypeDefinition;
import graphql.language.EnumValueDefinition;
import graphql.language.FieldDefinition;
import graphql.language.InputObjectTypeDefinition;
import graphql.language.InputValueDefinition;
import graphql.language.ObjectTypeDefinition;
import graphql.language.ObjectTypeExtensionDefinition;
import graphql.language.Type;
import graphql.schema.idl.SchemaParser;
import graphql.schema.idl.TypeDefinitionRegistry;
import org.junit.jupiter.api.BeforeAll;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateRolloutStatus;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import com.openframe.data.document.rmm.osupdate.OsUpdateUrgency;
import com.openframe.data.document.rmm.osupdate.OsUpdateRolloutMode;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.DayOfWeek;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateSchemaContractTest {

    private static TypeDefinitionRegistry schema;

    @BeforeAll
    static void readTheSchemaFilesOfTheModule() throws IOException {
        schema = new TypeDefinitionRegistry();
        SchemaParser parser = new SchemaParser();
        Resource[] files = new PathMatchingResourcePatternResolver().getResources("classpath:schema/*.graphqls");
        for (Resource file : files) {
            schema.merge(parser.parse(file.getContentAsString(StandardCharsets.UTF_8)));
        }
    }

    @Test
    void deviceOsState_rootQueryByMachineId_nullableForADeviceThatNeverReported() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("deviceOsState");

        // verifications
        assertThat(query).as("Query.deviceOsState").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(Map.of("machineId", "String!"));
        assertThat(print(query.get().getType())).isEqualTo("DeviceOsState");
    }

    @Test
    void deviceOsPendingUpdates_listOfTheDevice_notPaginated() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("deviceOsPendingUpdates");

        // verifications
        assertThat(query).as("Query.deviceOsPendingUpdates").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(Map.of("machineId", "String!"));
        assertThat(print(query.get().getType())).isEqualTo("[DeviceOsPendingUpdate!]!");
    }

    @Test
    void deviceOsUpdateHistory_forwardPagedConnectionOfHistoryEntries() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("deviceOsUpdateHistory");

        // verifications
        assertThat(query).as("Query.deviceOsUpdateHistory").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(
                Map.of("machineId", "String!", "first", "Int", "after", "String"));
        assertThat(print(query.get().getType())).isEqualTo("DeviceOsUpdateHistoryConnection!");
        assertThat(fields("DeviceOsUpdateHistoryConnection")).containsExactlyInAnyOrderEntriesOf(
                Map.of("edges", "[DeviceOsUpdateHistoryEdge!]!", "pageInfo", "PageInfo!"));
        assertThat(fields("DeviceOsUpdateHistoryEdge")).containsExactlyInAnyOrderEntriesOf(
                Map.of("node", "DeviceOsUpdateHistoryEntry!", "cursor", "String!"));
    }

    @Test
    void osUpdates_forwardPagedConnectionOfTheTenantsUpdatesWithAnOptionalFilter() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("osUpdates");

        // verifications
        assertThat(query).as("Query.osUpdates").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(
                Map.of("filter", "OsUpdateFilterInput", "first", "Int", "after", "String"));
        assertThat(print(query.get().getType())).isEqualTo("OsUpdateConnection!");
        assertThat(fields("OsUpdateConnection")).containsExactlyInAnyOrderEntriesOf(
                Map.of("edges", "[OsUpdateEdge!]!", "pageInfo", "PageInfo!"));
        assertThat(fields("OsUpdateEdge")).containsExactlyInAnyOrderEntriesOf(
                Map.of("node", "OsUpdate!", "cursor", "String!"));
        assertThat(inputFields("OsUpdateFilterInput")).containsExactlyInAnyOrderEntriesOf(Map.of(
                "platform", "OsPlatform",
                "classifications", "[OsUpdateClassification!]",
                "search", "String",
                "organizationIds", "[String!]"));
    }

    @Test
    void osUpdate_rootQueryById_nullableForAnUpdateTheTenantDoesNotHave() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("osUpdate");

        // verifications
        assertThat(query).as("Query.osUpdate").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(Map.of("id", "ID!"));
        assertThat(print(query.get().getType())).isEqualTo("OsUpdate");
    }

    @Test
    void osUpdateDevices_forwardPagedConnectionOfTheDevicesOfOneRequiredStatus() {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField("osUpdateDevices");

        // verifications
        assertThat(query).as("Query.osUpdateDevices").isPresent();
        assertThat(arguments(query.get())).containsExactlyInAnyOrderEntriesOf(Map.of(
                "osUpdateId", "ID!", "status", "OsUpdateDeviceStatus!", "organizationIds", "[String!]", "first", "Int",
                "after", "String"));
        assertThat(print(query.get().getType())).isEqualTo("OsUpdateDeviceConnection!");
        assertThat(fields("OsUpdateDeviceConnection")).containsExactlyInAnyOrderEntriesOf(
                Map.of("edges", "[OsUpdateDeviceEdge!]!", "pageInfo", "PageInfo!"));
        assertThat(fields("OsUpdateDeviceEdge")).containsExactlyInAnyOrderEntriesOf(
                Map.of("node", "OsUpdateDevice!", "cursor", "String!"));
        assertThat(fields("OsUpdateDevice")).containsExactlyInAnyOrderEntriesOf(Map.of(
                "machineId", "String!",
                "status", "OsUpdateDeviceStatus!",
                "discoveredAt", "Instant",
                "installedAt", "Instant",
                "machine", "Machine"));
    }

    @Test
    void osUpdate_exactlyItsFieldsWithBothDeviceCounts() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("id", "ID!");
        expected.put("platform", "OsPlatform!");
        expected.put("identifier", "String!");
        expected.put("displayName", "String");
        expected.put("displayVersion", "String");
        expected.put("kbArticleIds", "[String!]!");
        expected.put("severity", "OsUpdateSeverity");
        expected.put("categories", "[String!]!");
        expected.put("categoryIds", "[String!]!");
        expected.put("updateType", "OsUpdateType");
        expected.put("classification", "OsUpdateClassification");
        expected.put("cveIds", "[String!]!");
        expected.put("publishedAt", "Instant");
        expected.put("sizeBytes", "Long");
        expected.put("rebootBehavior", "OsUpdateRebootBehavior");
        expected.put("browseOnly", "Boolean");
        expected.put("exploited", "Boolean");
        expected.put("enrichedAt", "Instant");
        expected.put("firstSeenAt", "Instant!");
        expected.put("pendingDeviceCount", "Int!");
        expected.put("installedDeviceCount", "Int!");

        // execution
        Map<String, String> osUpdate = fields("OsUpdate");

        // verifications
        assertThat(osUpdate).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"deviceOsUpdates", "deviceOsReport"})
    void queriesOfTheEarlierDesign_notInTheSchema(String name) {
        // setup

        // execution
        Optional<FieldDefinition> query = queryField(name);

        // verifications
        assertThat(query).as("Query.%s", name).isEmpty();
    }

    @Test
    void deviceOsState_exactlyTheFieldsOfTheOsTab() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("platform", "OsPlatform");
        expected.put("osVersion", "String");
        expected.put("osBuild", "String");
        expected.put("osProductName", "String");
        expected.put("scanState", "OsUpdateScanState");
        expected.put("lastScanAt", "Instant");
        expected.put("pendingUpdatesConfidence", "OsUpdateListConfidence");
        expected.put("patchState", "OsPatchState");
        expected.put("rebootPending", "OsRebootPending");
        expected.put("rebootPendingSince", "Instant");
        expected.put("manageability", "OsUpdateManageability");
        expected.put("osUpdateAuthorization", "OsUpdateAuthorization");
        expected.put("lastOsInstall", "LastOsInstall");
        expected.put("reportedAt", "Instant");
        expected.put("receivedAt", "Instant!");

        // execution
        Map<String, String> osState = fields("DeviceOsState");

        // verifications
        assertThat(osState).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void manageabilityAndLastOsInstall_exactlyTheirFields() {
        // setup

        // execution
        Map<String, String> manageability = fields("OsUpdateManageability");
        Map<String, String> lastOsInstall = fields("LastOsInstall");

        // verifications
        assertThat(manageability).containsExactlyInAnyOrderEntriesOf(
                Map.of("state", "OsUpdateManageabilityState", "reasons", "[String!]!"));
        assertThat(lastOsInstall).containsExactlyInAnyOrderEntriesOf(Map.of(
                "identifier", "String",
                "displayName", "String",
                "displayVersion", "String",
                "installedAt", "Instant!"));
    }

    @Test
    void deviceOsPendingUpdate_exactlyItsFields() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("identifier", "String!");
        expected.put("displayName", "String");
        expected.put("displayVersion", "String");
        expected.put("kbArticleIds", "[String!]!");
        expected.put("severity", "OsUpdateSeverity");
        expected.put("categories", "[String!]!");
        expected.put("categoryIds", "[String!]!");
        expected.put("updateType", "OsUpdateType");
        expected.put("classification", "OsUpdateClassification");
        expected.put("cveIds", "[String!]!");
        expected.put("publishedAt", "Instant");
        expected.put("sizeBytes", "Long");
        expected.put("rebootBehavior", "OsUpdateRebootBehavior");
        expected.put("browseOnly", "Boolean");
        expected.put("exploited", "Boolean");
        expected.put("enrichedAt", "Instant");
        expected.put("discoveredAt", "Instant!");
        expected.put("downloaded", "Boolean");
        expected.put("macosPresence", "MacosUpdatePresence");
        expected.put("rolloutState", "DeviceOsUpdateRolloutState");

        // execution
        Map<String, String> pendingUpdate = fields("DeviceOsPendingUpdate");

        // verifications
        assertThat(pendingUpdate).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void deviceOsUpdateHistoryEntry_exactlyItsFields() {
        // setup

        // execution
        Map<String, String> entry = fields("DeviceOsUpdateHistoryEntry");

        // verifications
        assertThat(entry).containsExactlyInAnyOrderEntriesOf(Map.of(
                "identifier", "String!",
                "title", "String",
                "installedAt", "Instant!",
                "operation", "OsUpdateOperation",
                "result", "OsUpdateInstallResult",
                "errorCode", "String"));
    }

    @Test
    void osUpdatePolicy_exactlyItsFieldsAndTheFieldsOfItsInput() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("id", "ID!");
        expected.put("name", "String!");
        expected.put("target", "OsUpdatePolicyTarget!");
        expected.put("rolloutRules", "[OsUpdateRolloutRule!]!");
        expected.put("restartDeadlines", "[OsUpdateRestartDeadline!]!");
        expected.put("pilotTagId", "ID");
        expected.put("maintenanceWindows", "[OsUpdateMaintenanceWindow!]!");
        expected.put("offlineRule", "OsUpdateOfflineRule");
        expected.put("inUseRule", "OsUpdateInUseRule");
        expected.put("domainControllerRestartManual", "Boolean!");
        expected.put("restartModes", "[OsUpdateDeviceClassRestartMode!]!");
        expected.put("restartDialog", "OsUpdateRestartDialog");
        expected.put("createdAt", "Instant!");
        expected.put("updatedAt", "Instant!");
        Map<String, String> expectedInput = new LinkedHashMap<>();
        expectedInput.put("name", "String!");
        expectedInput.put("target", "OsUpdatePolicyTargetInput!");
        expectedInput.put("rolloutRules", "[OsUpdateRolloutRuleInput!]!");
        expectedInput.put("restartDeadlines", "[OsUpdateRestartDeadlineInput!]!");
        expectedInput.put("pilotTagId", "ID");
        expectedInput.put("maintenanceWindows", "[OsUpdateMaintenanceWindowInput!]!");
        expectedInput.put("offlineRule", "OsUpdateOfflineRule!");
        expectedInput.put("inUseRule", "OsUpdateInUseRule!");
        expectedInput.put("domainControllerRestartManual", "Boolean!");
        expectedInput.put("restartModes", "[OsUpdateDeviceClassRestartModeInput!]!");
        expectedInput.put("restartDialog", "OsUpdateRestartDialogInput!");

        // execution, verifications
        assertThat(fields("OsUpdatePolicy")).containsExactlyInAnyOrderEntriesOf(expected);
        assertThat(inputFields("OsUpdatePolicyInput")).containsExactlyInAnyOrderEntriesOf(expectedInput);
    }

    @Test
    void rolloutRuleAndRestartDeadline_sameFieldsInTheTypeAndInItsInput() {
        // setup
        Map<String, String> expectedRule = new LinkedHashMap<>();
        expectedRule.put("urgency", "OsUpdateUrgency!");
        expectedRule.put("mode", "OsUpdateRolloutMode!");
        expectedRule.put("daysAfterRelease", "Int");
        expectedRule.put("daysLaterToEveryone", "Int");
        Map<String, String> expectedDeadline = new LinkedHashMap<>();
        expectedDeadline.put("urgency", "OsUpdateUrgency!");
        expectedDeadline.put("focusDays", "Int!");
        expectedDeadline.put("softDays", "Int!");
        expectedDeadline.put("hardDays", "Int!");

        // execution, verifications
        assertThat(fields("OsUpdateRolloutRule")).containsExactlyInAnyOrderEntriesOf(expectedRule);
        assertThat(inputFields("OsUpdateRolloutRuleInput")).containsExactlyInAnyOrderEntriesOf(expectedRule);
        assertThat(fields("OsUpdateRestartDeadline")).containsExactlyInAnyOrderEntriesOf(expectedDeadline);
        assertThat(inputFields("OsUpdateRestartDeadlineInput")).containsExactlyInAnyOrderEntriesOf(expectedDeadline);
    }

    @Test
    void windowRestartModeAndRestartDialog_sameFieldsInTheTypeAndInItsInput() {
        // setup
        Map<String, String> expectedWindow = new LinkedHashMap<>();
        expectedWindow.put("deviceClass", "OsUpdateDeviceClass!");
        expectedWindow.put("daysOfWeek", "[DayOfWeek!]!");
        expectedWindow.put("fromTime", "String!");
        expectedWindow.put("toTime", "String!");
        Map<String, String> expectedRestartMode = new LinkedHashMap<>();
        expectedRestartMode.put("deviceClass", "OsUpdateDeviceClass!");
        expectedRestartMode.put("mode", "OsUpdateRestartMode!");
        Map<String, String> expectedDialog = new LinkedHashMap<>();
        expectedDialog.put("deferOptions", "[OsUpdateDeferOption!]!");
        expectedDialog.put("autoAnswerMinutes", "Int!");
        expectedDialog.put("userMayScheduleRestart", "Boolean!");

        // execution, verifications
        assertThat(fields("OsUpdateMaintenanceWindow")).containsExactlyInAnyOrderEntriesOf(expectedWindow);
        assertThat(inputFields("OsUpdateMaintenanceWindowInput")).containsExactlyInAnyOrderEntriesOf(expectedWindow);
        assertThat(fields("OsUpdateDeviceClassRestartMode")).containsExactlyInAnyOrderEntriesOf(expectedRestartMode);
        assertThat(inputFields("OsUpdateDeviceClassRestartModeInput"))
                .containsExactlyInAnyOrderEntriesOf(expectedRestartMode);
        assertThat(fields("OsUpdateRestartDialog")).containsExactlyInAnyOrderEntriesOf(expectedDialog);
        assertThat(inputFields("OsUpdateRestartDialogInput")).containsExactlyInAnyOrderEntriesOf(expectedDialog);
    }

    @Test
    void deviceOsUpdateRolloutState_exactlyItsFields() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("policyId", "ID!");
        expected.put("status", "DeviceOsUpdateRolloutStatus!");
        expected.put("overrideAction", "OsUpdateOverrideAction");
        expected.put("installFrom", "Instant");
        expected.put("focusAt", "Instant");
        expected.put("softAt", "Instant");
        expected.put("hardAt", "Instant");

        // execution, verifications
        assertThat(fields("DeviceOsUpdateRolloutState")).containsExactlyInAnyOrderEntriesOf(expected);
    }

    @Test
    void osUpdateOverride_scopeIsOptionalInTheTypeAndInItsInput() {
        // setup
        Map<String, String> expected = new LinkedHashMap<>();
        expected.put("action", "OsUpdateOverrideAction!");
        expected.put("organizationId", "String");
        expected.put("machineId", "String");
        expected.put("actedBy", "String");
        expected.put("actedAt", "Instant!");
        Map<String, String> expectedInput = new LinkedHashMap<>();
        expectedInput.put("osUpdateId", "ID!");
        expectedInput.put("action", "OsUpdateOverrideAction!");
        expectedInput.put("organizationId", "String");
        expectedInput.put("machineId", "String");

        // execution, verifications
        assertThat(fields("OsUpdateOverride")).containsExactlyInAnyOrderEntriesOf(expected);
        assertThat(inputFields("OsUpdateOverrideInput")).containsExactlyInAnyOrderEntriesOf(expectedInput);
    }

    @ParameterizedTest
    @MethodSource("enumsOfTheFeature")
    void enum_sameValuesInTheSameOrderAsTheStoredOne(String graphQlName, Class<? extends Enum<?>> storedEnum) {
        // setup
        List<String> storedValues = Arrays.stream(storedEnum.getEnumConstants()).map(Enum::name).toList();

        // execution
        List<String> schemaValues = enumValues(graphQlName);

        // verifications
        assertThat(schemaValues).containsExactlyElementsOf(storedValues);
    }

    private static Stream<Arguments> enumsOfTheFeature() {
        return Stream.of(
                Arguments.of("OsPlatform", OsPlatform.class),
                Arguments.of("OsUpdateScanState", OsUpdateScanState.class),
                Arguments.of("OsUpdateListConfidence", OsUpdateListConfidence.class),
                Arguments.of("OsPatchState", OsPatchState.class),
                Arguments.of("OsRebootPending", OsRebootPending.class),
                Arguments.of(
                        "OsUpdateManageabilityState", OsUpdateManageabilityState.class),
                Arguments.of("OsUpdateAuthorization", OsUpdateAuthorization.class),
                Arguments.of("OsUpdateSeverity", OsUpdateSeverity.class),
                Arguments.of("OsUpdateRebootBehavior", OsUpdateRebootBehavior.class),
                Arguments.of("MacosUpdatePresence", MacosUpdatePresence.class),
                Arguments.of("OsUpdateOperation", OsUpdateOperation.class),
                Arguments.of("OsUpdateInstallResult", OsUpdateInstallResult.class),
                Arguments.of("OsUpdateType", OsUpdateType.class),
                Arguments.of("OsUpdateClassification", OsUpdateClassification.class),
                Arguments.of("OsUpdateDeviceStatus", OsUpdateDeviceStatus.class),
                Arguments.of("OsUpdatePolicyTargetType", OsUpdatePolicyTargetType.class),
                Arguments.of("OsUpdateUrgency", OsUpdateUrgency.class),
                Arguments.of("OsUpdateRolloutMode", OsUpdateRolloutMode.class),
                Arguments.of("OsUpdateDeviceClass", OsUpdateDeviceClass.class),
                Arguments.of("DayOfWeek", DayOfWeek.class),
                Arguments.of("OsUpdateOfflineRule", OsUpdateOfflineRule.class),
                Arguments.of("OsUpdateInUseRule", OsUpdateInUseRule.class),
                Arguments.of("OsUpdateRestartMode", OsUpdateRestartMode.class),
                Arguments.of("OsUpdateDeferOption", OsUpdateDeferOption.class),
                Arguments.of("OsUpdateOverrideAction", OsUpdateOverrideAction.class),
                Arguments.of("DeviceOsUpdateRolloutStatus", DeviceOsUpdateRolloutStatus.class));
    }

    private static Map<String, String> fields(String typeName) {
        Optional<ObjectTypeDefinition> type = schema.getType(typeName, ObjectTypeDefinition.class);
        assertThat(type).as("type %s in schema/*.graphqls", typeName).isPresent();
        Map<String, String> fields = new LinkedHashMap<>();
        for (FieldDefinition field : type.get().getFieldDefinitions()) {
            fields.put(field.getName(), print(field.getType()));
        }
        return fields;
    }

    private static Map<String, String> inputFields(String typeName) {
        Optional<InputObjectTypeDefinition> type = schema.getType(typeName, InputObjectTypeDefinition.class);
        assertThat(type).as("input %s in schema/*.graphqls", typeName).isPresent();
        Map<String, String> fields = new LinkedHashMap<>();
        for (InputValueDefinition field : type.get().getInputValueDefinitions()) {
            fields.put(field.getName(), print(field.getType()));
        }
        return fields;
    }

    private static List<String> enumValues(String typeName) {
        Optional<EnumTypeDefinition> type = schema.getType(typeName, EnumTypeDefinition.class);
        assertThat(type).as("enum %s in schema/*.graphqls", typeName).isPresent();
        return type.get().getEnumValueDefinitions().stream().map(EnumValueDefinition::getName).toList();
    }

    private static Optional<FieldDefinition> queryField(String name) {
        Stream<FieldDefinition> declared = schema.getType("Query", ObjectTypeDefinition.class).stream()
                .flatMap(query -> query.getFieldDefinitions().stream());
        Stream<FieldDefinition> extended = schema.objectTypeExtensions().getOrDefault("Query", List.of()).stream()
                .map(ObjectTypeExtensionDefinition::getFieldDefinitions)
                .flatMap(List::stream);
        return Stream.concat(declared, extended).filter(field -> field.getName().equals(name)).findFirst();
    }

    private static Map<String, String> arguments(FieldDefinition field) {
        Map<String, String> arguments = new LinkedHashMap<>();
        for (InputValueDefinition argument : field.getInputValueDefinitions()) {
            arguments.put(argument.getName(), print(argument.getType()));
        }
        return arguments;
    }

    private static String print(Type<?> type) {
        return AstPrinter.printAst(type);
    }
}
