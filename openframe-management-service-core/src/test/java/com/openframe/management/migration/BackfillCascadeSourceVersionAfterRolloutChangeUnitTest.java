package com.openframe.management.migration;

import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BackfillCascadeSourceVersionAfterRolloutChangeUnitTest {

    private static final String TENANT_ID = "tenant-1";

    @Mock private MongoTemplate mongoTemplate;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private BackfillCascadeSourceVersionAfterRolloutChangeUnit changeUnit;

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(mongoTemplate.updateMulti(any(Query.class), any(Update.class), anyString()))
                .thenReturn(UpdateResult.acknowledged(0, 0L, null));
    }

    @Test
    void setsVersionZeroInAllSixCollections() {
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        ArgumentCaptor<String> collections = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Update> updates = ArgumentCaptor.forClass(Update.class);
        verify(mongoTemplate, times(6)).updateMulti(any(Query.class), updates.capture(), collections.capture());
        assertThat(collections.getAllValues()).containsExactlyInAnyOrder("users", "organizations", "machines", "tickets",
                "microsoft365_configs", "google_workspace_configs");
        assertThat(updates.getAllValues()).allSatisfy(update ->
                assertThat(update.getUpdateObject()).isEqualTo(new Document("$set", new Document("version", 0L))));
    }

    @Test
    void touchesOnlyTheTenantsDocumentsWithAMissingOrNullVersion() {
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        ArgumentCaptor<Query> queries = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate, times(6)).updateMulti(queries.capture(), any(Update.class), anyString());
        List<Document> filters = queries.getAllValues().stream().map(Query::getQueryObject).toList();
        Document expected = new Document("tenantId", TENANT_ID).append("version", null);
        assertThat(filters).allSatisfy(filter -> assertThat(filter).isEqualTo(expected));
    }
}
