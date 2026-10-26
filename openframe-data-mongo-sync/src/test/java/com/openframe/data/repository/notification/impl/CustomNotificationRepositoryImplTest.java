package com.openframe.data.repository.notification.impl;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationReadState;
import com.openframe.data.document.notification.NotificationSeverity;
import com.openframe.data.document.notification.ReadStatus;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import com.openframe.data.repository.notification.NotificationReadStateFilter;
import org.bson.Document;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CustomNotificationRepositoryImplTest {

    private static final String RECIPIENT_ID = "user-1";
    private static final String TENANT_ID = "tenant-1";
    private static final List<NotificationCategory> APPROVAL_CATEGORIES =
            List.of(NotificationCategory.TICKETS, NotificationCategory.MINGO);
    private static final List<String> APPROVAL_TYPES = List.of("TICKET_APPROVAL_REQUEST", "MINGO_APPROVAL_REQUEST");

    @Mock private TenantAwareMongoTemplate mongoTemplate;

    @Captor private ArgumentCaptor<Query> queryCaptor;

    private CustomNotificationRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = new CustomNotificationRepositoryImpl(mongoTemplate);
    }

    @Test
    void findPageForRecipient_categoriesTypesAndSeverities_readStatesNarrowedByEachWithIn() {
        // setup
        stubTenant();
        stubEmptyReadStates();
        NotificationReadStateFilter filter = NotificationReadStateFilter.builder()
                .read(false)
                .categories(APPROVAL_CATEGORIES)
                .types(APPROVAL_TYPES)
                .severities(List.of(NotificationSeverity.WARNING))
                .build();

        // execution
        repository.findPageForRecipient(RECIPIENT_ID, RecipientType.USER, filter, null, false, Sort.Direction.DESC, 10);

        // verifications
        Document query = readStateQuery();
        assertThat(query.get("category", Document.class)).containsEntry("$in", APPROVAL_CATEGORIES);
        assertThat(query.get("type", Document.class)).containsEntry("$in", APPROVAL_TYPES);
        assertThat(query.get("severity", Document.class)).containsEntry("$in", List.of(NotificationSeverity.WARNING));
    }

    @Test
    void findPageForRecipient_noNarrowing_onlyRecipientAndStatusMentioned() {
        // setup
        stubTenant();
        stubEmptyReadStates();

        // execution
        repository.findPageForRecipient(RECIPIENT_ID, RecipientType.USER, NotificationReadStateFilter.NONE,
                null, false, Sort.Direction.DESC, 10);

        // verifications
        assertThat(readStateQuery())
                .containsKeys("tenantId", "recipientId", "recipientType", "status")
                .doesNotContainKeys("category", "type", "severity", "title", "notificationId");
    }

    // The legacy read-and-search overload keeps working for the callers that never narrow further.
    @Test
    void findPageForRecipient_legacyReadAndSearchArguments_sameCriteriaAsTheFilterForm() {
        // setup
        stubTenant();
        stubEmptyReadStates();

        // execution
        repository.findPageForRecipient(RECIPIENT_ID, RecipientType.USER, false, "alert", null, false, 10);

        // verifications
        assertThat(readStateQuery())
                .containsEntry("status", ReadStatus.UNREAD)
                .containsKey("title");
    }

    @Test
    void countForRecipient_always_countsWithTheSameNarrowingAsThePageButNoCursor() {
        // setup
        stubTenant();
        when(mongoTemplate.count(any(Query.class), eq(NotificationReadState.class))).thenReturn(3L);
        NotificationReadStateFilter filter = NotificationReadStateFilter.builder()
                .read(false)
                .categories(APPROVAL_CATEGORIES)
                .search("alert")
                .build();

        // execution
        long count = repository.countForRecipient(RECIPIENT_ID, RecipientType.USER, filter);

        // verifications
        verify(mongoTemplate).count(queryCaptor.capture(), eq(NotificationReadState.class));
        Document query = queryCaptor.getValue().getQueryObject();
        assertThat(count).isEqualTo(3L);
        assertThat(query)
                .containsEntry("tenantId", TENANT_ID)
                .containsEntry("recipientId", RECIPIENT_ID)
                .containsEntry("recipientType", RecipientType.USER)
                .containsEntry("status", ReadStatus.UNREAD)
                .containsKeys("category", "title")
                .doesNotContainKey("notificationId");
    }

    private void stubTenant() {
        when(mongoTemplate.tenantCriteria()).thenReturn(Criteria.where("tenantId").is(TENANT_ID));
    }

    private void stubEmptyReadStates() {
        when(mongoTemplate.find(any(Query.class), eq(NotificationReadState.class))).thenReturn(List.of());
    }

    private Document readStateQuery() {
        verify(mongoTemplate).find(queryCaptor.capture(), eq(NotificationReadState.class));
        return queryCaptor.getValue().getQueryObject();
    }
}
