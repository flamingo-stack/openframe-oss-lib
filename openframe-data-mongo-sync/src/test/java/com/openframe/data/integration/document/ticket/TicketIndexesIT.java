package com.openframe.data.integration.document.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.IntegrationTestApplication;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;

import java.util.Map;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

@SpringBootTest(classes = IntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class TicketIndexesIT extends BaseMongoIntegrationTest {

    @Autowired
    private MongoTemplate mongoTemplate;

    @Test
    @DisplayName("Given the Ticket entity, when its resolved indexes are ensured against Mongo, then tenant_creation_source exists on tenantId then creationSource and no existing index conflicts")
    void given_ticket_entity_when_indexes_ensured_then_tenant_creation_source_exists_in_mongo() {
        IndexOperations indexOps = mongoTemplate.indexOps(Ticket.class);

        assertThatCode(() -> new MongoPersistentEntityIndexResolver(mongoTemplate.getConverter().getMappingContext())
                .resolveIndexFor(Ticket.class)
                .forEach(indexOps::ensureIndex))
                .doesNotThrowAnyException();

        Map<String, IndexInfo> byName = indexOps.getIndexInfo().stream()
                .collect(Collectors.toMap(IndexInfo::getName, i -> i));

        assertThat(byName).containsKeys(
                "tenant_ticketNumber_idx",
                "status_kind",
                "status_id_order",
                "tenant_status_activity",
                "tenant_creation_source");

        IndexInfo creationSource = byName.get("tenant_creation_source");
        assertThat(creationSource.isUnique()).isFalse();
        assertThat(creationSource.getIndexFields()).extracting("key")
                .containsExactly("tenantId", "creationSource");
    }
}
