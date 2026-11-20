package com.openframe.data.document.ticket;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.data.core.TypeInformation;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver;
import org.springframework.data.mongodb.core.index.MongoPersistentEntityIndexResolver.IndexDefinitionHolder;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * A live index definition is never edited in place, so the declared set is pinned by name: keys in
 * order and uniqueness.
 */
class TicketIndexesTest {

    private static final String TENANT_CREATION_SOURCE = "tenant_creation_source";

    @Test
    void tenantCreationSourceIndex_declaredOnTenantIdThenCreationSource() {
        // execution
        Map<String, IndexDefinitionHolder> indexes = resolvedTicketIndexes();

        // verifications
        assertThat(indexes).containsKey(TENANT_CREATION_SOURCE);
        IndexDefinitionHolder index = indexes.get(TENANT_CREATION_SOURCE);
        assertThat(index.getCollection()).isEqualTo("tickets");
        assertThat(keysOf(index)).containsExactly("tenantId:1", "creationSource:1");
        assertThat(isUnique(index)).isFalse();
    }

    @Test
    void indexes_theExistingOnesUnchangedBesideTheNewOne() {
        // execution
        Map<String, IndexDefinitionHolder> indexes = resolvedTicketIndexes();

        // verifications
        assertThat(indexes).containsOnlyKeys(
                "tenant_ticketNumber_idx",
                "status_kind",
                "status_id_order",
                "tenant_status_activity",
                TENANT_CREATION_SOURCE,
                "tenant_email_sender_subject",
                "deviceId",
                "organizationId",
                "assignedTo",
                "resolvedById");
        assertIndex(indexes, "tenant_ticketNumber_idx", true, "tenantId:1", "ticketNumber:1");
        assertIndex(indexes, "status_kind", false, "statusKind:1");
        assertIndex(indexes, "status_id_order", false, "statusId:1", "order:1");
        assertIndex(indexes, "tenant_status_activity", false, "tenantId:1", "statusId:1", "lastActivityAt:1");
        assertIndex(indexes, TENANT_CREATION_SOURCE, false, "tenantId:1", "creationSource:1");
        assertIndex(indexes, "tenant_email_sender_subject", false,
                "tenantId:1", "emailOrigin.senderAddress:1", "emailOrigin.subjectKey:1");
        assertIndex(indexes, "deviceId", false, "deviceId:1");
        assertIndex(indexes, "organizationId", false, "organizationId:1");
        assertIndex(indexes, "assignedTo", false, "assignedTo:1");
        assertIndex(indexes, "resolvedById", false, "resolvedById:1");
    }

    private static void assertIndex(Map<String, IndexDefinitionHolder> indexes, String name, boolean unique,
                                    String... keys) {
        IndexDefinitionHolder index = indexes.get(name);
        assertThat(index.getCollection()).as(name).isEqualTo("tickets");
        assertThat(keysOf(index)).as(name).containsExactly(keys);
        assertThat(isUnique(index)).as(name).isEqualTo(unique);
    }

    private static Map<String, IndexDefinitionHolder> resolvedTicketIndexes() {
        MongoMappingContext mappingContext = new MongoMappingContext();
        mappingContext.setSimpleTypeHolder(new MongoCustomConversions(List.of()).getSimpleTypeHolder());
        Map<String, IndexDefinitionHolder> byName = new LinkedHashMap<>();
        new MongoPersistentEntityIndexResolver(mappingContext)
                .resolveIndexFor(TypeInformation.of(Ticket.class))
                .forEach(index -> byName.put(index.getIndexOptions().getString("name"), index));
        return byName;
    }

    private static List<String> keysOf(IndexDefinitionHolder index) {
        Document keys = index.getIndexKeys();
        return keys.entrySet().stream()
                .map(key -> key.getKey() + ":" + key.getValue())
                .toList();
    }

    private static boolean isUnique(IndexDefinitionHolder index) {
        return Boolean.TRUE.equals(index.getIndexOptions().get("unique"));
    }
}
