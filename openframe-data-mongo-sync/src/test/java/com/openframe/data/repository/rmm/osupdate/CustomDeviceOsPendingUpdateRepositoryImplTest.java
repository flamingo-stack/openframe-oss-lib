package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
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
class CustomDeviceOsPendingUpdateRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String OTHER_IDENTIFIER = "ffeeddcc-1111-2222-3333-445566778899:198";
    private static final List<String> EXCLUDED_MACHINE_IDS = List.of("machine-9");
    private static final Instant DISCOVERED_AT = Instant.parse("2026-11-20T09:14:02Z");
    private static final String CURSOR = DISCOVERED_AT.toEpochMilli() + "|" + MACHINE_ID;

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Aggregation> aggregationCaptor;

    @InjectMocks private CustomDeviceOsPendingUpdateRepositoryImpl repository;

    private DeviceOsPendingUpdate pendingUpdate;

    @BeforeEach
    void setUp() {
        pendingUpdate = DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(IDENTIFIER)
                .discoveredAt(DISCOVERED_AT)
                .build();
    }

    @Test
    void countDevicesByIdentifier_identifiersAndExcludedMachines_countsThePendingRowsPerIdentifier() {
        // setup
        List<String> identifiers = List.of(IDENTIFIER, OTHER_IDENTIFIER);
        List<OsUpdateDeviceCount> counted = List.of(new OsUpdateDeviceCount(IDENTIFIER, 3));
        AggregationResults<OsUpdateDeviceCount> aggregationResults = new AggregationResults<>(counted, new Document());
        when(mongoTemplate.aggregate(aggregationCaptor.capture(), eq(DeviceOsPendingUpdate.class),
                eq(OsUpdateDeviceCount.class))).thenReturn(aggregationResults);
        Document pendingOnCountedDevices = new Document("tenantId", TENANT_ID)
                .append("platform", OsPlatform.WINDOWS)
                .append("identifier", new Document("$in", identifiers))
                .append("machineId", new Document("$nin", EXCLUDED_MACHINE_IDS));
        Document countByIdentifier = new Document("_id", "$identifier")
                .append("deviceCount", new Document("$sum", 1));

        // execution
        List<OsUpdateDeviceCount> deviceCounts = repository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, identifiers, EXCLUDED_MACHINE_IDS);

        // verifications
        assertThat(deviceCounts).containsExactly(new OsUpdateDeviceCount(IDENTIFIER, 3));
        assertThat(aggregationCaptor.getValue().toPipeline(Aggregation.DEFAULT_CONTEXT)).containsExactly(
                new Document("$match", pendingOnCountedDevices), new Document("$group", countByIdentifier));
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " "})
    void findDevicePage_noCursor_firstPageOfTheUpdatesDevicesNewestDiscoveredFirst(String cursor) {
        // setup
        List<DeviceOsPendingUpdate> stored = List.of(pendingUpdate);
        when(mongoTemplate.find(queryCaptor.capture(), eq(DeviceOsPendingUpdate.class))).thenReturn(stored);
        Document expectedFilter = new Document("$and", List.of(pendingOnListedDevices(), notExcluded()));

        // execution
        List<DeviceOsPendingUpdate> page = repository.findDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, IDENTIFIER, EXCLUDED_MACHINE_IDS, cursor, 21);

        // verifications
        assertThat(page).containsExactly(pendingUpdate);
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
        assertThat(queryCaptor.getValue().getSortObject().toJson()).isEqualTo(newestDiscoveredFirst().toJson());
        assertThat(queryCaptor.getValue().getLimit()).isEqualTo(21);
    }

    @Test
    void findDevicePage_cursorOfADevice_readsStrictlyAfterItByDiscoveryThenMachineId() {
        // setup
        when(mongoTemplate.find(queryCaptor.capture(), eq(DeviceOsPendingUpdate.class))).thenReturn(List.of());
        Document discoveredEarlier = new Document("discoveredAt", new Document("$lt", DISCOVERED_AT));
        Document discoveredTogetherLowerMachineId = new Document("discoveredAt", DISCOVERED_AT)
                .append("machineId", new Document("$lt", MACHINE_ID));
        Document keyset = new Document("$or", List.of(discoveredEarlier, discoveredTogetherLowerMachineId));
        Document expectedFilter = new Document("$and", List.of(pendingOnListedDevices(), notExcluded(), keyset));

        // execution
        repository.findDevicePage(TENANT_ID, OsPlatform.WINDOWS, IDENTIFIER, EXCLUDED_MACHINE_IDS, CURSOR, 5);

        // verifications
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
        assertThat(queryCaptor.getValue().getSortObject().toJson()).isEqualTo(newestDiscoveredFirst().toJson());
        assertThat(queryCaptor.getValue().getLimit()).isEqualTo(5);
    }

    @Test
    void findDevicePage_cursorOfAnotherShape_throwsBadRequest() {
        // setup
        String cursor = "yesterday|machine-1";

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class, () -> repository.findDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, IDENTIFIER, EXCLUDED_MACHINE_IDS, cursor, 5));

        // verifications
        assertThat(ex.getMessage()).contains("Unparseable epoch millis");
    }

    @Test
    void encodeDeviceCursor_pendingUpdate_discoveryMillisThenMachineId() {
        // setup

        // execution
        String cursor = repository.encodeDeviceCursor(pendingUpdate);

        // verifications
        assertThat(cursor).isEqualTo(CURSOR);
    }

    private static Document pendingOnListedDevices() {
        return new Document("tenantId", TENANT_ID)
                .append("platform", OsPlatform.WINDOWS)
                .append("identifier", IDENTIFIER);
    }

    private static Document notExcluded() {
        return new Document("machineId", new Document("$nin", EXCLUDED_MACHINE_IDS));
    }

    private static Document newestDiscoveredFirst() {
        return new Document("discoveredAt", -1).append("machineId", -1);
    }
}
