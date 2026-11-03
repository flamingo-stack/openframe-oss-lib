package com.openframe.api.dataloader;

import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.data.document.notification.RecipientType;
import com.openframe.notification.readstate.NotificationReadStateService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UnreadNotificationDataLoaderTest {

    private static final String ALICE = "user-alice";
    private static final RecipientType USER = RecipientType.USER;

    @Mock private NotificationReadStateService readStateService;

    @InjectMocks private UnreadNotificationDataLoader loader;

    @Test
    void load_devicesWithAndWithoutUnread_countsMirrorTheKeysInOrderWithZeroForTheSkippedOnes() throws Exception {
        // setup
        List<UnreadNotificationKey> keys = List.of(
                deviceKey("machine-1"), deviceKey("machine-2"), deviceKey("machine-3"));
        when(readStateService.unreadCountsByEntity(eq(ALICE), eq(USER), eq(NotificationEntityType.DEVICE), any()))
                .thenReturn(Map.of("machine-1", 3L, "machine-3", 1L));

        // execution
        List<Integer> counts = loader.load(keys).toCompletableFuture().get();

        // verifications
        assertThat(counts).containsExactly(3, 0, 1);
    }

    @Test
    void load_keysOfTwoEntityTypes_oneAggregationPerTypeWithThatTypesIdsOnly() throws Exception {
        // setup
        UnreadNotificationKey insight = new UnreadNotificationKey(ALICE, USER, NotificationEntityType.INSIGHT, "insight-1");
        List<UnreadNotificationKey> keys = List.of(deviceKey("machine-1"), insight, deviceKey("machine-2"));
        when(readStateService.unreadCountsByEntity(eq(ALICE), eq(USER), eq(NotificationEntityType.DEVICE), any()))
                .thenReturn(Map.of("machine-2", 2L));
        when(readStateService.unreadCountsByEntity(eq(ALICE), eq(USER), eq(NotificationEntityType.INSIGHT), any()))
                .thenReturn(Map.of("insight-1", 5L));

        // execution
        List<Integer> counts = loader.load(keys).toCompletableFuture().get();

        // verifications
        assertThat(counts).containsExactly(0, 5, 2);
        verify(readStateService).unreadCountsByEntity(eq(ALICE), eq(USER), eq(NotificationEntityType.DEVICE),
                argThat(ids -> sameIds(ids, Set.of("machine-1", "machine-2"))));
        verify(readStateService).unreadCountsByEntity(eq(ALICE), eq(USER), eq(NotificationEntityType.INSIGHT),
                argThat(ids -> sameIds(ids, Set.of("insight-1"))));
    }

    @Test
    void load_noKeys_emptyResultAndNoAggregation() throws Exception {
        // execution
        List<Integer> counts = loader.load(List.of()).toCompletableFuture().get();

        // verifications
        assertThat(counts).isEmpty();
        verify(readStateService, never()).unreadCountsByEntity(any(), any(), any(), any());
    }

    private static UnreadNotificationKey deviceKey(String machineId) {
        return new UnreadNotificationKey(ALICE, USER, NotificationEntityType.DEVICE, machineId);
    }

    private static boolean sameIds(Collection<String> actual, Set<String> expected) {
        return actual != null && Set.copyOf(actual).equals(expected);
    }
}
