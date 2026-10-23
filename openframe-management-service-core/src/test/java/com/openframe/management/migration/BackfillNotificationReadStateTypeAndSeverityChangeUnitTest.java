package com.openframe.management.migration;

import com.mongodb.client.FindIterable;
import com.mongodb.client.MongoCollection;
import com.mongodb.client.MongoCursor;
import com.mongodb.client.result.UpdateResult;
import com.openframe.data.service.TenantIdProvider;
import org.bson.Document;
import org.bson.conversions.Bson;
import org.bson.types.ObjectId;
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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BackfillNotificationReadStateTypeAndSeverityChangeUnitTest {

    private static final String TENANT = "tenant-1";
    private static final ObjectId APPROVAL_ID = new ObjectId();
    private static final ObjectId OTHER_APPROVAL_ID = new ObjectId();
    private static final ObjectId INCIDENT_ID = new ObjectId();

    @Mock private MongoTemplate mongoTemplate;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private MongoCollection<Document> notifications;
    @Mock private MongoCollection<Document> readStates;
    @Mock private FindIterable<Document> notificationRows;
    @Mock private MongoCursor<Document> notificationCursor;

    @Captor private ArgumentCaptor<Bson> filterCaptor;
    @Captor private ArgumentCaptor<Bson> updateCaptor;

    private final BackfillNotificationReadStateTypeAndSeverityChangeUnit changeUnit =
            new BackfillNotificationReadStateTypeAndSeverityChangeUnit();

    @Test
    void execution_notificationsOfTwoShapes_oneTenantScopedUpdatePerShapeOnTheUntypedRows() {
        // setup
        stubCollections();
        stubNotifications(
                notification(APPROVAL_ID, "MINGO_APPROVAL_REQUEST", "WARNING"),
                notification(OTHER_APPROVAL_ID, "MINGO_APPROVAL_REQUEST", "WARNING"),
                notification(INCIDENT_ID, "INCIDENT_CRITICAL", "DANGER"));
        when(readStates.updateMany(any(Bson.class), any(Bson.class))).thenReturn(UpdateResult.acknowledged(2, 2L, null));

        // execution
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        // verifications
        verify(readStates, org.mockito.Mockito.times(2)).updateMany(filterCaptor.capture(), updateCaptor.capture());
        List<Bson> filters = filterCaptor.getAllValues();
        List<Bson> updates = updateCaptor.getAllValues();
        Document approvalUpdate = new Document("$set",
                new Document("type", "MINGO_APPROVAL_REQUEST").append("severity", "WARNING"));
        Document incidentUpdate = new Document("$set",
                new Document("type", "INCIDENT_CRITICAL").append("severity", "DANGER"));
        assertThat(updates).containsExactlyInAnyOrder(approvalUpdate, incidentUpdate);
        Document approvalFilter = (Document) filters.get(updates.indexOf(approvalUpdate));
        assertThat(approvalFilter)
                .containsEntry("tenantId", TENANT)
                .containsEntry("type", new Document("$exists", false))
                .containsEntry("notificationId", new Document("$in",
                        List.of(APPROVAL_ID.toHexString(), OTHER_APPROVAL_ID.toHexString())));
    }

    @Test
    void execution_notificationWithoutTypeOrSeverity_nothingCopied() {
        // setup
        stubCollections();
        stubNotifications(new Document("_id", INCIDENT_ID));

        // execution
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        // verifications
        verify(readStates, never()).updateMany(any(Bson.class), any(Bson.class));
    }

    @Test
    void execution_always_readsOnlyTheTenantsNotificationsProjectedToTheTwoFields() {
        // setup
        stubCollections();
        stubNotifications();

        // execution
        changeUnit.execution(mongoTemplate, tenantIdProvider);

        // verifications
        verify(notifications).find(filterCaptor.capture());
        verify(notificationRows).projection(updateCaptor.capture());
        assertThat((Document) filterCaptor.getValue()).containsOnly(java.util.Map.entry("tenantId", TENANT));
        assertThat((Document) updateCaptor.getValue()).containsOnlyKeys("type", "severity");
    }

    @Test
    void rollback_always_noOp() {
        // setup

        // execution
        changeUnit.rollback();

        // verifications
        verifyNoInteractions(mongoTemplate, tenantIdProvider);
    }

    private void stubCollections() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT);
        when(mongoTemplate.getCollection("notifications")).thenReturn(notifications);
        when(mongoTemplate.getCollection("notification_read_states")).thenReturn(readStates);
    }

    private void stubNotifications(Document... rows) {
        when(notifications.find(any(Bson.class))).thenReturn(notificationRows);
        when(notificationRows.projection(any(Bson.class))).thenReturn(notificationRows);
        when(notificationRows.iterator()).thenReturn(notificationCursor);
        Boolean[] hasNext = new Boolean[rows.length + 1];
        for (int i = 0; i < rows.length; i++) {
            hasNext[i] = true;
        }
        hasNext[rows.length] = false;
        when(notificationCursor.hasNext()).thenReturn(hasNext[0], java.util.Arrays.copyOfRange(hasNext, 1, hasNext.length));
        if (rows.length > 0) {
            when(notificationCursor.next()).thenReturn(rows[0], java.util.Arrays.copyOfRange(rows, 1, rows.length));
        }
    }

    private static Document notification(ObjectId id, String type, String severity) {
        return new Document("_id", id).append("type", type).append("severity", severity);
    }
}
