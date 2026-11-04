package com.openframe.api.dataloader;

import com.netflix.graphql.dgs.DgsDataLoader;
import com.openframe.data.document.notification.NotificationEntityType;
import com.openframe.notification.readstate.NotificationReadStateService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.dataloader.BatchLoader;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.stream.Collectors;

/**
 * Batches the current recipient's unread notification counts per entity: one read-state aggregation
 * per entity type for a whole page of machines or insights, instead of one query per row.
 */
@DgsDataLoader(name = UnreadNotificationDataLoader.NAME)
@RequiredArgsConstructor
@Slf4j
public class UnreadNotificationDataLoader implements BatchLoader<UnreadNotificationKey, Integer> {

    public static final String NAME = "unreadNotificationDataLoader";

    private final NotificationReadStateService readStateService;

    @Override
    public CompletionStage<List<Integer>> load(List<UnreadNotificationKey> keys) {
        log.debug("Batch loading unread notification counts for {} entity/entities", keys.size());
        return CompletableFuture.supplyAsync(() -> countsFor(keys));
    }

    private List<Integer> countsFor(List<UnreadNotificationKey> keys) {
        Map<NotificationEntityType, List<UnreadNotificationKey>> byType =
                keys.stream().collect(Collectors.groupingBy(UnreadNotificationKey::entityType));
        Map<NotificationEntityType, Map<String, Long>> counts = new EnumMap<>(NotificationEntityType.class);
        byType.forEach((entityType, typeKeys) -> counts.put(entityType, countsFor(entityType, typeKeys)));
        // Size and order must mirror the keys: an entity the aggregation skipped has nothing unread.
        return keys.stream()
                .map(key -> counts.get(key.entityType()).getOrDefault(key.entityId(), 0L))
                .map(Long::intValue)
                .toList();
    }

    private Map<String, Long> countsFor(NotificationEntityType entityType, List<UnreadNotificationKey> keys) {
        UnreadNotificationKey first = keys.getFirst();
        Set<String> entityIds = keys.stream().map(UnreadNotificationKey::entityId).collect(Collectors.toSet());
        return readStateService.unreadCountsByEntity(first.recipientId(), first.recipientType(), entityType, entityIds);
    }
}
