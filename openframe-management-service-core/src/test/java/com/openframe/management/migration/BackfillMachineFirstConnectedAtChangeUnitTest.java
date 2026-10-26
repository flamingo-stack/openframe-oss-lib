package com.openframe.management.migration;

import com.mongodb.client.MongoCollection;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Machines registered before {@code firstConnectedAt} existed must not read as "never connected" in the
 * Devices API: the first connect is at least as old as the last heartbeat, so lastSeen is the backfill.
 * PENDING machines really have not connected and stay null.
 */
@ExtendWith(MockitoExtension.class)
class BackfillMachineFirstConnectedAtChangeUnitTest {

    private static final String TENANT = "tenant-1";

    @Mock
    private MongoTemplate mongoTemplate;
    @Mock
    private TenantIdProvider tenantIdProvider;
    @Mock
    private MongoCollection<Document> machines;
    @Captor
    private ArgumentCaptor<Bson> filter;
    @Captor
    private ArgumentCaptor<List<Bson>> pipeline;

    private final BackfillMachineFirstConnectedAtChangeUnit changeUnit = new BackfillMachineFirstConnectedAtChangeUnit();

    @Test
    @DisplayName("sets firstConnectedAt from lastSeen for the tenant's non-PENDING machines that lack it")
    void backfill_setsFirstConnectedAtFromLastSeenForNonPendingMachinesMissingIt() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(mongoTemplate.getCollection("machines")).thenReturn(machines);
        when(machines.updateMany(any(Bson.class), anyList())).thenReturn(UpdateResult.acknowledged(3, 3L, null));

        changeUnit.execution(mongoTemplate, tenantIdProvider);

        verify(machines).updateMany(filter.capture(), pipeline.capture());
        Document query = (Document) filter.getValue();
        assertThat(query.getString("tenantId")).isEqualTo(TENANT);
        assertThat(query.get("status")).isEqualTo(new Document("$ne", "PENDING"));
        assertThat(query.get("firstConnectedAt")).isEqualTo(new Document("$exists", false));
        assertThat(query.get("lastSeen")).isEqualTo(new Document("$exists", true));
        assertThat(pipeline.getValue())
                .containsExactly(new Document("$set", new Document("firstConnectedAt", "$lastSeen")));
    }

    @Test
    @DisplayName("rollback is a no-op: a stamp derived from lastSeen is never wrong, only absent")
    void backfill_rollbackIsANoOp() {
        changeUnit.rollback();

        verifyNoInteractions(mongoTemplate, tenantIdProvider);
    }
}
