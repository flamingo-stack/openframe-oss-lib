package com.openframe.data.repository.rmm;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
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
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomPackageUpdateDeviceStateRepositoryImplTest {

    private static final String TENANT = "t1";
    private static final String REQUEST_ID = "req-1";
    private static final String MACHINE_ID = "m1";
    private static final String ERROR = "brew install --cask postman: exit 1";

    @Mock private MongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;
    @Captor private ArgumentCaptor<Update> updateCaptor;

    @InjectMocks private CustomPackageUpdateDeviceStateRepositoryImpl repository;

    @Test
    void finishInProgress_anyStatus_writesOnlyTheInProgressStateOfThatRequestAndDevice() {
        // setup
        stubUpdate(1);

        // execution
        repository.finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.FAILED, ERROR);

        // verifications
        verify(mongoTemplate).updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(PackageUpdateDeviceState.class));
        assertThat(queryCaptor.getValue().getQueryObject())
                .containsEntry("tenantId", TENANT)
                .containsEntry("requestId", REQUEST_ID)
                .containsEntry("machineId", MACHINE_ID)
                .containsEntry("status", SoftwareActionStatus.IN_PROGRESS);
    }

    @Test
    void finishInProgress_failed_setsTheStatusTheMessageAndTheTime() {
        // setup
        stubUpdate(1);

        // execution
        repository.finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.FAILED, ERROR);

        // verifications
        verify(mongoTemplate).updateFirst(queryCaptor.capture(), updateCaptor.capture(), eq(PackageUpdateDeviceState.class));
        Document set = updateCaptor.getValue().getUpdateObject().get("$set", Document.class);
        assertThat(set)
                .containsEntry("status", SoftwareActionStatus.FAILED)
                .containsEntry("failedMessage", ERROR)
                .containsKey("updatedAt");
    }

    @Test
    void finishInProgress_stateMoved_true() {
        // setup
        stubUpdate(1);

        // execution
        boolean moved = repository.finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.COMPLETED, null);

        // verifications
        assertThat(moved).isTrue();
    }

    @Test
    void finishInProgress_noStateInProgress_false() {
        // setup
        stubUpdate(0);

        // execution
        boolean moved = repository.finishInProgress(TENANT, REQUEST_ID, MACHINE_ID, SoftwareActionStatus.COMPLETED, null);

        // verifications
        assertThat(moved).isFalse();
    }

    private void stubUpdate(long modified) {
        UpdateResult result = UpdateResult.acknowledged(modified, modified, null);
        when(mongoTemplate.updateFirst(any(Query.class), any(Update.class), eq(PackageUpdateDeviceState.class)))
                .thenReturn(result);
    }
}
