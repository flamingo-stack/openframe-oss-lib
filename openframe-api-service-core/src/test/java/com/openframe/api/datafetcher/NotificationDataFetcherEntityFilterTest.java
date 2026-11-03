package com.openframe.api.datafetcher;

import com.openframe.api.dto.notification.NotificationEntityFilterInput;
import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.notification.NotificationFilterInput;
import com.openframe.api.dto.notification.NotificationRecipient;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.api.service.NotificationRecipientResolver;
import com.openframe.api.service.NotificationService;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.notification.readstate.NotificationReadStateService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationDataFetcherEntityFilterTest {

    private static final String ALICE = "user-alice";

    @Mock private NotificationService notificationService;
    @Mock private NotificationReadStateService readStateService;
    @Mock private GraphQLNotificationMapper notificationMapper;
    @Mock private NotificationRecipientResolver recipientResolver;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @Captor private ArgumentCaptor<NotificationFilter> filterCaptor;

    @InjectMocks private NotificationDataFetcher dataFetcher;

    @BeforeEach
    void signIn() {
        when(recipientResolver.current()).thenReturn(new NotificationRecipient(ALICE, RecipientType.USER));
    }

    @Test
    void notifications_entityFilter_serviceFilterCarriesTheEntityTypeAndIdNextToTheOtherArguments() {
        // setup
        when(notificationMapper.toCursorPaginationCriteria(any()))
                .thenReturn(CursorPaginationCriteria.builder().limit(10).build());
        NotificationFilterInput filter = NotificationFilterInput.builder()
                .read(false)
                .entity(new NotificationEntityFilterInput(NotificationEntityType.DEVICE, "machine-1"))
                .build();

        // execution
        dataFetcher.notifications(filter, "rec", 10, null, null, null, null, null);

        // verifications
        verify(notificationService).list(eq(ALICE), eq(RecipientType.USER), filterCaptor.capture(), any(), any(), anyBoolean());
        NotificationFilter serviceFilter = filterCaptor.getValue();
        assertThat(serviceFilter.entityType()).isEqualTo(NotificationEntityType.DEVICE);
        assertThat(serviceFilter.entityId()).isEqualTo("machine-1");
        assertThat(serviceFilter.read()).isFalse();
        assertThat(serviceFilter.search()).isEqualTo("rec");
    }

    @Test
    void notifications_entityFilterWithBlankId_rejectedBeforeTheService() {
        // setup
        NotificationFilterInput filter = NotificationFilterInput.builder()
                .entity(new NotificationEntityFilterInput(NotificationEntityType.DEVICE, " "))
                .build();

        // execution + verifications
        assertThatThrownBy(() -> dataFetcher.notifications(filter, null, 10, null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("entity.id");
        verifyNoInteractions(notificationService);
    }

    @Test
    void notifications_noFilter_serviceFilterHasNoEntity() {
        // setup
        when(notificationMapper.toCursorPaginationCriteria(any()))
                .thenReturn(CursorPaginationCriteria.builder().limit(10).build());

        // execution
        dataFetcher.notifications(null, null, 10, null, null, null, null, null);

        // verifications
        verify(notificationService).list(eq(ALICE), eq(RecipientType.USER), filterCaptor.capture(), any(), any(), anyBoolean());
        assertThat(filterCaptor.getValue().entityType()).isNull();
        assertThat(filterCaptor.getValue().entityId()).isNull();
    }
}
