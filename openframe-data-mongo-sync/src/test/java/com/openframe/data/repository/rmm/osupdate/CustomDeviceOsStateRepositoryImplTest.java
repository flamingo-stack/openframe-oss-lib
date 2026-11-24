package com.openframe.data.repository.rmm.osupdate;

import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
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

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomDeviceOsStateRepositoryImplTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    @InjectMocks private CustomDeviceOsStateRepositoryImpl repository;

    @Test
    void findMachineIds_manageabilityState_machineIdsOfTheTenantsDevicesInThatState() {
        // setup
        List<String> stored = List.of("machine-1", "machine-2");
        when(mongoTemplate.findDistinct(queryCaptor.capture(), eq("machineId"), eq(DeviceOsState.class),
                eq(String.class))).thenReturn(stored);
        Document expectedFilter = new Document("tenantId", TENANT_ID)
                .append("manageability.state", OsUpdateManageabilityState.NOT_MANAGEABLE);

        // execution
        List<String> machineIds = repository.findMachineIds(TENANT_ID, OsUpdateManageabilityState.NOT_MANAGEABLE);

        // verifications
        assertThat(machineIds).containsExactly("machine-1", "machine-2");
        assertThat(queryCaptor.getValue().getQueryObject()).isEqualTo(expectedFilter);
    }
}
