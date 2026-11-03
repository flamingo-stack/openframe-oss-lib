package com.openframe.api.service;

import com.openframe.api.dto.notification.NotificationFilter;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.mapper.GraphQLNotificationMapper;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.data.repository.notification.NotificationPage;
import com.openframe.data.repository.notification.NotificationReadStateFilter;
import com.openframe.data.repository.notification.NotificationRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    private static final String ALICE = "user-alice";
    private static final RecipientType USER = RecipientType.USER;

    @Mock private NotificationRepository notificationRepository;
    @Mock private GraphQLNotificationMapper notificationMapper;

    @Captor private ArgumentCaptor<NotificationReadStateFilter> rowFilterCaptor;

    @InjectMocks private NotificationService service;

    @Test
    void list_entityFilter_rowFilterCarriesTheEntityTypeAndIdForThePageAndTheCount() {
        // setup
        stubEmptyPage();
        when(notificationRepository.countForRecipient(eq(ALICE), eq(USER), any())).thenReturn(0L);
        NotificationFilter filter = new NotificationFilter(false, null, null, null, null,
                NotificationEntityType.DEVICE, "machine-1");

        // execution
        service.list(ALICE, USER, filter, CursorPaginationCriteria.builder().limit(10).build());

        // verifications
        verify(notificationRepository).findPageForRecipient(eq(ALICE), eq(USER), rowFilterCaptor.capture(),
                any(), anyBoolean(), any(Sort.Direction.class), anyInt());
        NotificationReadStateFilter pageFilter = rowFilterCaptor.getValue();
        assertThat(pageFilter.getEntityType()).isEqualTo(NotificationEntityType.DEVICE);
        assertThat(pageFilter.getEntityId()).isEqualTo("machine-1");
        assertThat(pageFilter.getRead()).isFalse();
        verify(notificationRepository).countForRecipient(eq(ALICE), eq(USER), rowFilterCaptor.capture());
        NotificationReadStateFilter countFilter = rowFilterCaptor.getValue();
        assertThat(countFilter.getEntityType()).isEqualTo(NotificationEntityType.DEVICE);
        assertThat(countFilter.getEntityId()).isEqualTo("machine-1");
    }

    @Test
    void list_noEntityFilter_rowFilterLeavesTheEntityUnset() {
        // setup
        stubEmptyPage();
        when(notificationRepository.countForRecipient(eq(ALICE), eq(USER), any())).thenReturn(0L);

        // execution
        service.list(ALICE, USER, NotificationFilter.EMPTY, CursorPaginationCriteria.builder().limit(10).build());

        // verifications
        verify(notificationRepository).findPageForRecipient(eq(ALICE), eq(USER), rowFilterCaptor.capture(),
                any(), anyBoolean(), any(Sort.Direction.class), anyInt());
        assertThat(rowFilterCaptor.getValue().getEntityType()).isNull();
        assertThat(rowFilterCaptor.getValue().getEntityId()).isNull();
    }

    private void stubEmptyPage() {
        when(notificationRepository.findPageForRecipient(eq(ALICE), eq(USER), any(),
                any(), anyBoolean(), any(Sort.Direction.class), anyInt()))
                .thenReturn(NotificationPage.of(List.of()));
    }
}
