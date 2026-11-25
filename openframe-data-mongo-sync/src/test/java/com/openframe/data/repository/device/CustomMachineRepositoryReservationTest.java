package com.openframe.data.repository.device;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.UpdateDefinition;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomMachineRepositoryReservationTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "m-1";
    private static final List<String> MANAGED_STORED_NAMES = List.of("MANAGED", "ACTIVE", "OFFLINE", "ONLINE");

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    @InjectMocks private CustomMachineRepositoryImpl repository;

    @Test
    void reserveForSoftwareReconnect_connectedStatuses_guardAcceptsEveryStoredNameOfManaged() {
        // setup
        stubUpdateMulti();

        // execution
        long reserved = repository.reserveForSoftwareReconnect(TENANT_ID, MACHINE_ID, 3L, DeviceStatus.CONNECTED);

        // verifications
        Document query = capturedQuery();
        assertThat(reserved).isEqualTo(1L);
        assertThat(query)
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("machineId", MACHINE_ID)
                .containsEntry("version", 3L);
        assertThat(statusIn(query)).containsExactlyElementsOf(MANAGED_STORED_NAMES);
    }

    @Test
    void reserveForSoftwareAssignments_connectedStatuses_guardAcceptsEveryStoredNameOfManaged() {
        // setup
        stubUpdateMulti();
        List<String> machineIds = List.of(MACHINE_ID, "m-2");

        // execution
        long reserved = repository.reserveForSoftwareAssignments(TENANT_ID, machineIds, DeviceStatus.CONNECTED);

        // verifications
        Document query = capturedQuery();
        assertThat(reserved).isEqualTo(1L);
        assertThat(query)
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("machineId", new Document("$in", machineIds));
        assertThat(statusIn(query)).containsExactlyElementsOf(MANAGED_STORED_NAMES);
    }

    @Test
    void reserveForSoftwareAssignments_statusWithoutRetiredNames_guardOnItsNameOnly() {
        // setup
        stubUpdateMulti();
        List<String> machineIds = List.of(MACHINE_ID);
        List<DeviceStatus> statuses = List.of(DeviceStatus.PENDING);

        // execution
        repository.reserveForSoftwareAssignments(TENANT_ID, machineIds, statuses);

        // verifications
        assertThat(statusIn(capturedQuery())).containsExactly("PENDING");
    }

    private void stubUpdateMulti() {
        when(mongoTemplate.updateMulti(any(Query.class), any(UpdateDefinition.class), eq(Machine.class)))
                .thenReturn(UpdateResult.acknowledged(1L, 1L, null));
    }

    private static List<Object> statusIn(Document query) {
        Collection<?> names = query.get("status", Document.class).get("$in", Collection.class);
        return new ArrayList<>(names);
    }

    private Document capturedQuery() {
        verify(mongoTemplate).updateMulti(queryCaptor.capture(), any(UpdateDefinition.class), eq(Machine.class));
        return queryCaptor.getValue().getQueryObject();
    }
}
