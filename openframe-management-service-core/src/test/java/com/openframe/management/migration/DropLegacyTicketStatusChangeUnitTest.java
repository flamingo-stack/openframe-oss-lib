package com.openframe.management.migration;

import com.mongodb.MongoException;
import com.mongodb.client.result.UpdateResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexOperations;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The legacy status field stopped being written once statuses moved to the lifecycle model, so the
 * copies left on existing documents are dead weight — and misleading, since they freeze whatever
 * the status was on the day of the cut-over. This clears them and drops the index that only existed
 * to sort by them.
 */
@ExtendWith(MockitoExtension.class)
class DropLegacyTicketStatusChangeUnitTest {

    private static final String COLLECTION = "tickets";

    @Mock private MongoTemplate mongoTemplate;
    @Mock private IndexOperations indexOperations;

    @InjectMocks private DropLegacyTicketStatusChangeUnit changeUnit;

    @Test
    void unsetsTheLegacyFieldOnEveryTicket() {
        givenIndexOps();

        changeUnit.execution(mongoTemplate);

        ArgumentCaptor<Update> update = ArgumentCaptor.forClass(Update.class);
        ArgumentCaptor<Query> query = ArgumentCaptor.forClass(Query.class);
        verify(mongoTemplate).updateMulti(query.capture(), update.capture(), eq(COLLECTION));
        assertThat(update.getValue().getUpdateObject().toJson()).contains("$unset").contains("status");
        assertThat(query.getValue().getQueryObject().toJson()).contains("status");
    }

    @Test
    void dropsTheIndexThatOnlyServedTheLegacyField() {
        givenIndexOps();

        changeUnit.execution(mongoTemplate);

        verify(indexOperations).dropIndex("status_order");
    }

    /** A tenant provisioned after the field was already gone has neither the index nor the values. */
    @Test
    void aMissingIndexIsNotAFailure() {
        givenIndexOps();
        doThrow(new MongoException("index not found with name [status_order]"))
                .when(indexOperations).dropIndex("status_order");

        assertThatCode(() -> changeUnit.execution(mongoTemplate)).doesNotThrowAnyException();

        verify(mongoTemplate).updateMulti(any(), any(), eq(COLLECTION));
    }

    @Test
    void rollbackIsANoOp() {
        assertThatCode(() -> changeUnit.rollback()).doesNotThrowAnyException();
    }

    private void givenIndexOps() {
        when(mongoTemplate.indexOps(COLLECTION)).thenReturn(indexOperations);
        when(mongoTemplate.updateMulti(any(), any(Update.class), eq(COLLECTION)))
                .thenReturn(UpdateResult.acknowledged(3, 3L, null));
    }
}
