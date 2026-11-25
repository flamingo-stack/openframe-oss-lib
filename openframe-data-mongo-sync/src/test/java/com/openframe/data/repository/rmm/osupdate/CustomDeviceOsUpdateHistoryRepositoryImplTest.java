package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsUpdateInstallResult;
import com.openframe.data.document.rmm.osupdate.OsUpdateOperation;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationResults;
import org.springframework.data.mongodb.core.query.Query;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomDeviceOsUpdateHistoryRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String ENTRY_ID = "6aff19c07ce86a3f0386ff82";
    private static final String IDENTIFIER = "ffeeddcc-1111-2222-3333-445566778899:198";
    private static final Instant INSTALLED_AT = Instant.parse("2026-10-15T03:12:44Z");
    private static final String ENTRY_KEY = IDENTIFIER + "|" + INSTALLED_AT.toEpochMilli() + "|INSTALL";
    private static final String CURSOR = INSTALLED_AT.toEpochMilli() + "|" + ENTRY_ID;

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;

    @InjectMocks private CustomDeviceOsUpdateHistoryRepositoryImpl repository;

    private DeviceOsUpdateHistoryEntry entry;

    @BeforeEach
    void setUp() {
        entry = DeviceOsUpdateHistoryEntry.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .entryKey(ENTRY_KEY)
                .identifier(IDENTIFIER)
                .installedAt(INSTALLED_AT)
                .operation(OsUpdateOperation.INSTALL)
                .result(OsUpdateInstallResult.SUCCEEDED)
                .build();
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findPage_noCursor_firstPageOfThatTenantAndMachineNewestFirst(String cursor) {
        // setup
        List<DeviceOsUpdateHistoryEntry> stored = List.of(entry);
        when(mongoTemplate.find(queryCaptor.capture(), eq(DeviceOsUpdateHistoryEntry.class))).thenReturn(stored);

        // execution
        List<DeviceOsUpdateHistoryEntry> page = repository.findPage(TENANT_ID, MACHINE_ID, cursor, 21);

        // verifications
        assertThat(page).containsExactly(entry);
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(machineFilter());
        assertThat(queryCaptor.getValue().getSortObject().toJson()).isEqualTo(newestFirst().toJson());
        assertThat(queryCaptor.getValue().getLimit()).isEqualTo(21);
    }

    @Test
    void findPage_cursorOfAnEntry_readsStrictlyAfterItByInstallTimeThenId() {
        // setup
        List<DeviceOsUpdateHistoryEntry> stored = List.of(entry);
        when(mongoTemplate.find(queryCaptor.capture(), eq(DeviceOsUpdateHistoryEntry.class))).thenReturn(stored);
        Document olderInstall = new Document("installedAt", new Document("$lt", INSTALLED_AT));
        Document sameInstallOlderId = new Document("installedAt", INSTALLED_AT)
                .append("_id", new Document("$lt", new ObjectId(ENTRY_ID)));
        Document keyset = new Document("$or", List.of(olderInstall, sameInstallOlderId));
        Document expectedFilter = new Document("$and", List.of(machineFilter(), keyset));

        // execution
        repository.findPage(TENANT_ID, MACHINE_ID, CURSOR, 5);

        // verifications
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
        assertThat(queryCaptor.getValue().getSortObject().toJson()).isEqualTo(newestFirst().toJson());
        assertThat(queryCaptor.getValue().getLimit()).isEqualTo(5);
    }

    @ParameterizedTest
    @CsvSource({
            "1795142470000,                          no separator",
            "yesterday|6aff19c07ce86a3f0386ff82,     Unparseable epoch millis",
            "1795142470000|not-an-object-id,         Invalid ObjectId"
    })
    void findPage_cursorOfAnotherShape_throwsBadRequest(String cursor, String expectedMessage) {
        // setup

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> repository.findPage(TENANT_ID, MACHINE_ID, cursor, 5));

        // verifications
        assertThat(ex.getMessage()).contains(expectedMessage);
    }

    @Test
    void encodeCursor_entry_installTimeInMillisThenId() {
        // setup
        entry.setId(ENTRY_ID);

        // execution
        String cursor = repository.encodeCursor(entry);

        // verifications
        assertThat(cursor).isEqualTo(CURSOR);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findInstalledDevicePage_noCursor_latestInstallPerDeviceNewestFirst(String cursor) {
        // setup
        List<InstalledOsUpdateDevice> grouped = List.of(new InstalledOsUpdateDevice(MACHINE_ID, INSTALLED_AT));
        AggregationResults<InstalledOsUpdateDevice> aggregationResults =
                new AggregationResults<>(grouped, new Document());
        when(mongoTemplate.aggregate(aggregationCaptor.capture(), eq(DeviceOsUpdateHistoryEntry.class),
                eq(InstalledOsUpdateDevice.class))).thenReturn(aggregationResults);

        // execution
        List<InstalledOsUpdateDevice> page = repository.findInstalledDevicePage(TENANT_ID, IDENTIFIER, cursor, 21);

        // verifications
        assertThat(page).containsExactly(new InstalledOsUpdateDevice(MACHINE_ID, INSTALLED_AT));
        assertThat(aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT)).containsExactly(
                new Document("$match", successfulInstalls().append("identifier", IDENTIFIER)),
                new Document("$group", latestPerDevice()),
                new Document("$sort", newestFirst()),
                new Document("$limit", 21L));
    }

    @Test
    void findInstalledDevicePage_cursorOfADevice_readsStrictlyAfterItByInstallTimeThenMachineId() {
        // setup
        String cursor = INSTALLED_AT.toEpochMilli() + "|" + MACHINE_ID;
        AggregationResults<InstalledOsUpdateDevice> aggregationResults =
                new AggregationResults<>(List.of(), new Document());
        when(mongoTemplate.aggregate(aggregationCaptor.capture(), eq(DeviceOsUpdateHistoryEntry.class),
                eq(InstalledOsUpdateDevice.class))).thenReturn(aggregationResults);
        Document installedEarlier = new Document("installedAt", new Document("$lt", INSTALLED_AT));
        Document installedTogetherLowerMachineId = new Document("installedAt", INSTALLED_AT)
                .append("_id", new Document("$lt", MACHINE_ID));
        Document keyset = new Document("$or", List.of(installedEarlier, installedTogetherLowerMachineId));

        // execution
        repository.findInstalledDevicePage(TENANT_ID, IDENTIFIER, cursor, 5);

        // verifications
        assertThat(aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT)).containsExactly(
                new Document("$match", successfulInstalls().append("identifier", IDENTIFIER)),
                new Document("$group", latestPerDevice()),
                new Document("$match", keyset),
                new Document("$sort", newestFirst()),
                new Document("$limit", 5L));
    }

    @Test
    void findInstalledDevicePage_cursorOfAnotherShape_throwsBadRequest() {
        // setup
        String cursor = "yesterday|machine-1";

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class,
                () -> repository.findInstalledDevicePage(TENANT_ID, IDENTIFIER, cursor, 5));

        // verifications
        assertThat(ex.getMessage()).contains("Unparseable epoch millis");
    }

    @Test
    void encodeInstalledDeviceCursor_installedDevice_installMillisThenMachineId() {
        // setup
        InstalledOsUpdateDevice installedDevice = new InstalledOsUpdateDevice(MACHINE_ID, INSTALLED_AT);

        // execution
        String cursor = repository.encodeInstalledDeviceCursor(installedDevice);

        // verifications
        assertThat(cursor).isEqualTo(INSTALLED_AT.toEpochMilli() + "|" + MACHINE_ID);
    }

    private static Document successfulInstalls() {
        return new Document("tenantId", TENANT_ID)
                .append("operation", OsUpdateOperation.INSTALL)
                .append("result", new Document("$in",
                        List.of(OsUpdateInstallResult.SUCCEEDED, OsUpdateInstallResult.SUCCEEDED_WITH_ERRORS)));
    }

    private static Document latestPerDevice() {
        return new Document("_id", "$machineId").append("installedAt", new Document("$max", "$installedAt"));
    }

    private static Document machineFilter() {
        return new Document("tenantId", TENANT_ID).append("machineId", MACHINE_ID);
    }

    private static Document newestFirst() {
        return new Document("installedAt", -1).append("_id", -1);
    }
}
