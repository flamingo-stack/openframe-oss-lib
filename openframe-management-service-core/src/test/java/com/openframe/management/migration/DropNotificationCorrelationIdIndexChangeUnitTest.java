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
    private static final String INDEX_NAME = "correlationId_1";

    @Mock
    private MongoTemplate mongoTemplate;

    @Mock
    private IndexOperations indexOperations;

    private final DropNotificationCorrelationIdIndexChangeUnit changeUnit =
            new DropNotificationCorrelationIdIndexChangeUnit();

    @Test
    @DisplayName("Given the correlationId index is still there, when the change unit runs, then it is dropped")
    void drops_the_index_when_present() {
        stubIndexes(indexInfo(INDEX_NAME), indexInfo("_id_"));

        changeUnit.execution(mongoTemplate);

        verify(indexOperations).dropIndex(INDEX_NAME);
    }

    @Test
    @DisplayName("Given the index was already dropped, when the change unit runs, then nothing is dropped — a re-run on a fresh tenant must not fail")
    void drops_nothing_when_the_index_is_absent() {
        stubIndexes(indexInfo("_id_"));

        changeUnit.execution(mongoTemplate);

        verify(indexOperations, never()).dropIndex(anyString());
    }

    private void stubIndexes(IndexInfo... indexes) {
        List<IndexInfo> indexInfos = List.of(indexes);
        when(mongoTemplate.indexOps(COLLECTION)).thenReturn(indexOperations);
        when(indexOperations.getIndexInfo()).thenReturn(indexInfos);
    }

    private IndexInfo indexInfo(String name) {
        IndexField field = IndexField.create("correlationId", Sort.Direction.ASC);
        List<IndexField> fields = List.of(field);
        return new IndexInfo(fields, name, false, false, "");
    }
}
