package com.openframe.data.repository.rmm.osupdate;

import org.bson.Document;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;

import java.util.List;

// Stages that bring the customer and the connectivity of a device into an aggregation over its OS update rows:
// those rows carry the machine id only.
final class OsUpdateMachineStages {

    static final String FIELD_MACHINE = "machine";

    private static final String MACHINES_COLLECTION = "machines";
    private static final String FIELD_ID = "_id";
    private static final String FIELD_TENANT_ID = "tenantId";
    private static final String FIELD_MACHINE_ID = "machineId";
    private static final String FIELD_IDENTIFIER = "identifier";
    private static final String FIELD_IDENTIFIERS = "identifiers";
    private static final String FIELD_ORGANIZATION_ID = "organizationId";
    private static final String FIELD_TELEMETRY_STATUS = "telemetryStatus";
    private static final String FIELD_DEVICE_COUNT = "deviceCount";
    private static final String MACHINE_ORGANIZATION_ID = FIELD_MACHINE + "." + FIELD_ORGANIZATION_ID;

    private OsUpdateMachineStages() {
    }

    // Takes rows with a machine id and an identifier. A device is counted once per identifier, however many rows
    // it has; a device without a customer is not counted.
    static List<AggregationOperation> countDevicesByIdentifierAndOrganization(String tenantId) {
        Document identifiersOfMachine = new Document("$group", new Document(FIELD_ID, "$" + FIELD_MACHINE_ID)
                .append(FIELD_IDENTIFIERS, new Document("$addToSet", "$" + FIELD_IDENTIFIER)));
        Document machineWithCustomer = new Document("$match",
                new Document(MACHINE_ORGANIZATION_ID, new Document("$ne", null)));
        Document identifierAndOrganization = new Document(FIELD_IDENTIFIER, "$" + FIELD_IDENTIFIERS)
                .append(FIELD_ORGANIZATION_ID, "$" + MACHINE_ORGANIZATION_ID);
        Document devicesOfIdentifierAndOrganization = new Document("$group",
                new Document(FIELD_ID, identifierAndOrganization)
                        .append(FIELD_DEVICE_COUNT, new Document("$sum", 1)));
        Document deviceCount = new Document("$project", new Document(FIELD_ID, 0)
                .append(FIELD_IDENTIFIER, "$" + FIELD_ID + "." + FIELD_IDENTIFIER)
                .append(FIELD_ORGANIZATION_ID, "$" + FIELD_ID + "." + FIELD_ORGANIZATION_ID)
                .append(FIELD_DEVICE_COUNT, 1));
        return List.of(
                context -> identifiersOfMachine,
                lookupMachineOfGroup(tenantId),
                context -> new Document("$unwind", "$" + FIELD_MACHINE),
                context -> machineWithCustomer,
                context -> new Document("$unwind", "$" + FIELD_IDENTIFIERS),
                context -> devicesOfIdentifierAndOrganization,
                context -> deviceCount);
    }

    // After a grouping by machine id: the machine of the group as a list of one under "machine", empty when the
    // tenant has no such machine.
    static AggregationOperation lookupMachineOfGroup(String tenantId) {
        Document sameMachineId = new Document("$eq", List.of("$" + FIELD_MACHINE_ID, "$$machineId"));
        Document sameTenant = new Document("$eq", List.of("$" + FIELD_TENANT_ID, new Document("$literal", tenantId)));
        Document machineOfTenant = new Document("$match",
                new Document("$expr", new Document("$and", List.of(sameMachineId, sameTenant))));
        Document customerAndConnectivity = new Document("$project", new Document(FIELD_ID, 0)
                .append(FIELD_ORGANIZATION_ID, 1)
                .append(FIELD_TELEMETRY_STATUS, 1));
        Document lookup = new Document("$lookup", new Document("from", MACHINES_COLLECTION)
                .append("let", new Document("machineId", "$" + FIELD_ID))
                .append("pipeline", List.of(machineOfTenant, customerAndConnectivity))
                .append("as", FIELD_MACHINE));
        return context -> lookup;
    }
}
