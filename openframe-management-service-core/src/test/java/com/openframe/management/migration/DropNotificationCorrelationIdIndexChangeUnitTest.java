package com.openframe.management.migration;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexField;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.core.index.IndexOperations;

import java.util.List;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DropNotificationCorrelationIdIndexChangeUnitTest {

    private static final String COLLECTION = "notifications";

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private IndexOperations indexOperations;

    private final DropNotificationCorrelationIdIndexChangeUnit changeUnit =
            new DropNotificationCorrelationIdIndexChangeUnit();

    @Test
    @DisplayName("Given Spring Data named the index after the property, when the change unit runs, then it is still found and dropped — @Indexed does not use Mongo's field_1 convention")
    void drops_the_index_named_after_the_property() {
        stubIndexes(indexInfo("correlationId", "correlationId"), indexInfo("_id_", "_id"));

        changeUnit.execution(mongoTemplate);

        verify(indexOperations).dropIndex("correlationId");
    }

    @Test
    @DisplayName("Given the index carries Mongo's default name, when the change unit runs, then it is dropped too — the match is on the key, not the name")
    void drops_the_index_with_the_mongo_default_name() {
        stubIndexes(indexInfo("correlationId_1", "correlationId"));

        changeUnit.execution(mongoTemplate);

        verify(indexOperations).dropIndex("correlationId_1");
    }

    @Test
    @DisplayName("Given no index on the field, when the change unit runs, then nothing is dropped — a re-run on a fresh tenant must not fail")
    void drops_nothing_when_the_index_is_absent() {
        stubIndexes(indexInfo("_id_", "_id"));

        changeUnit.execution(mongoTemplate);

        verify(indexOperations, never()).dropIndex(anyString());
    }

    @Test
    @DisplayName("Given a compound index that merely includes the field, when the change unit runs, then it is left alone — only the single-field index belonged to the removed property")
    void leaves_compound_indexes_alone() {
        stubIndexes(compoundIndexInfo("tenant_correlation", "tenantId", "correlationId"));

        changeUnit.execution(mongoTemplate);

        verify(indexOperations, never()).dropIndex(anyString());
    }

    private void stubIndexes(IndexInfo... indexes) {
        List<IndexInfo> indexInfos = List.of(indexes);
        when(mongoTemplate.indexOps(COLLECTION)).thenReturn(indexOperations);
        when(indexOperations.getIndexInfo()).thenReturn(indexInfos);
    }

    private IndexInfo indexInfo(String name, String key) {
        IndexField field = IndexField.create(key, Sort.Direction.ASC);
        List<IndexField> fields = List.of(field);
        return new IndexInfo(fields, name, false, false, "");
    }

    private IndexInfo compoundIndexInfo(String name, String firstKey, String secondKey) {
        List<IndexField> fields = List.of(
                IndexField.create(firstKey, Sort.Direction.ASC),
                IndexField.create(secondKey, Sort.Direction.ASC));
        return new IndexInfo(fields, name, false, false, "");
    }
}
