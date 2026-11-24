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

    private static Document machineFilter() {
        return new Document("tenantId", TENANT_ID).append("machineId", MACHINE_ID);
    }

    private static Document newestFirst() {
        return new Document("installedAt", -1).append("_id", -1);
    }
}
