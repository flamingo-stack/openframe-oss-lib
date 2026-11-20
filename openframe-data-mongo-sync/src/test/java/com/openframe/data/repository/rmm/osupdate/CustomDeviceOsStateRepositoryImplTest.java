package com.openframe.data.repository.rmm.osupdate;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsUpdateAuthorization;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagedElsewhereReason;
import com.openframe.data.document.rmm.osupdate.OsUpdateManagementState;
import com.openframe.data.document.rmm.osupdate.OsUpdateObservedReason;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomDeviceOsStateRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-19T10:15:02.417Z");
    private static final Instant LAST_SCAN_AT = Instant.parse("2026-11-19T10:14:51Z");
    private static final Instant LAST_INSTALLED_AT = Instant.parse("2026-10-16T02:41:10Z");
    private static final Instant RESTART_PENDING_SINCE = Instant.parse("2026-11-12T08:00:00Z");

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    @InjectMocks private CustomDeviceOsStateRepositoryImpl repository;

    private DeviceOsState state;

    @BeforeEach
    void setUp() {
        state = DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID).receivedAt(RECEIVED_AT).build();
    }

    @Test
    void upsertUnlessNewerStored_state_upsertedOnlyWhereTheStoredReportIsAbsentOrNotNewer() {
        // setup
        Document neverReceived = new Document("receivedAt", null);
        Document receivedEarlier = new Document("receivedAt", new Document("$lte", RECEIVED_AT));
        Document expectedFilter = new Document("tenantId", TENANT_ID)
                .append("machineId", MACHINE_ID)
                .append("$or", List.of(neverReceived, receivedEarlier));

        // execution
        boolean applied = repository.upsertUnlessNewerStored(state);

        // verifications
        verify(mongoTemplate).upsert(queryCaptor.capture(), updateCaptor.capture(), eq(DeviceOsState.class));
        assertThat(applied).isTrue();
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
    }

    @Test
    void upsertUnlessNewerStored_everyValueReported_everyValueSetAndNothingUnset() {
        // setup
        state.setOsVersion("Windows 11 Pro");
        state.setOsBuild("26100.4061");
        state.setRestartPending(true);
        state.setRestartPendingSince(RESTART_PENDING_SINCE);
        state.setLastScanAt(LAST_SCAN_AT);
        state.setLastScanError("0x80072EE2");
        state.setLastInstalledAt(LAST_INSTALLED_AT);
        state.setManagementState(OsUpdateManagementState.MANAGED_ELSEWHERE);
        state.setManagedElsewhereReason(OsUpdateManagedElsewhereReason.WSUS);
        state.setObservedReason(OsUpdateObservedReason.HOME_EDITION);
        state.setAuthorization(OsUpdateAuthorization.NOT_REQUIRED);
        Document expectedSet = new Document("receivedAt", RECEIVED_AT)
                .append("osVersion", "Windows 11 Pro")
                .append("osBuild", "26100.4061")
                .append("restartPending", true)
                .append("restartPendingSince", RESTART_PENDING_SINCE)
                .append("lastScanAt", LAST_SCAN_AT)
                .append("lastScanError", "0x80072EE2")
                .append("lastInstalledAt", LAST_INSTALLED_AT)
                .append("managementState", OsUpdateManagementState.MANAGED_ELSEWHERE)
                .append("managedElsewhereReason", OsUpdateManagedElsewhereReason.WSUS)
                .append("observedReason", OsUpdateObservedReason.HOME_EDITION)
                .append("authorization", OsUpdateAuthorization.NOT_REQUIRED);
        Document expectedUpdate = new Document("$set", expectedSet);

        // execution
        repository.upsertUnlessNewerStored(state);

        // verifications
        verify(mongoTemplate).upsert(queryCaptor.capture(), updateCaptor.capture(), eq(DeviceOsState.class));
        assertThat(updateCaptor.getValue().getUpdateObject()).isEqualTo(expectedUpdate);
    }

    @Test
    void upsertUnlessNewerStored_valuesAbsent_storedOnesUnsetButVersionAndBuildLeftAlone() {
        // setup
        Document expectedUnset = new Document("restartPending", 1)
                .append("restartPendingSince", 1)
                .append("lastScanAt", 1)
                .append("lastScanError", 1)
                .append("lastInstalledAt", 1)
                .append("managementState", 1)
                .append("managedElsewhereReason", 1)
                .append("observedReason", 1)
                .append("authorization", 1);
        Document expectedUpdate = new Document("$set", new Document("receivedAt", RECEIVED_AT))
                .append("$unset", expectedUnset);

        // execution
        repository.upsertUnlessNewerStored(state);

        // verifications
        verify(mongoTemplate).upsert(queryCaptor.capture(), updateCaptor.capture(), eq(DeviceOsState.class));
        assertThat(updateCaptor.getValue().getUpdateObject()).isEqualTo(expectedUpdate);
    }

    @ParameterizedTest
    @CsvSource({
            "1, true",
            "0, false"
    })
    void upsertUnlessNewerStored_insertRefusedByTheUniqueIndex_appliedOnlyWhenTheGuardedUpdateMatches(
            long matched, boolean expectedApplied) {
        // setup
        UpdateResult guardedUpdate = UpdateResult.acknowledged(matched, matched, null);
        when(mongoTemplate.upsert(queryCaptor.capture(), updateCaptor.capture(), eq(DeviceOsState.class)))
                .thenThrow(new DuplicateKeyException("E11000 tenant_machine"));
        when(mongoTemplate.updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(DeviceOsState.class)))
                .thenReturn(guardedUpdate);

        // execution
        boolean applied = repository.upsertUnlessNewerStored(state);

        // verifications
        assertThat(applied).isEqualTo(expectedApplied);
        assertThat(queryCaptor.getAllValues()).extracting(Query::getQueryObject).doesNotContainNull().hasSize(2);
        assertThat(queryCaptor.getAllValues()).extracting(Query::getQueryObject).containsOnly(
                queryCaptor.getValue().getQueryObject());
    }
}
