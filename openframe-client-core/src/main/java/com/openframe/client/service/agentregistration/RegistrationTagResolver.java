package com.openframe.client.service.agentregistration;

import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.tag.TagRepository;
import com.openframe.data.retry.RetryOnOptimisticLockingFailure;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.springframework.util.CollectionUtils.isEmpty;

// Agents registering together append values to the same tag; a stale copy is read again instead of failing the assignment.
@Slf4j
@Component
@RequiredArgsConstructor
public class RegistrationTagResolver {

    private final TagRepository tagRepository;

    @RetryOnOptimisticLockingFailure
    public Tag resolve(String key, List<String> values, Instant now) {
        Tag existing = tagRepository.findByKeyAndEntityType(key, TagEntityType.DEVICE);
        if (existing == null) {
            return create(key, values, now);
        }
        if (hasNewValues(existing, values)) {
            appendValues(existing, values);
        }
        return existing;
    }

    private Tag create(String key, List<String> values, Instant now) {
        Tag tag = Tag.builder()
                .key(key)
                .values(values)
                .entityType(TagEntityType.DEVICE)
                .createdAt(now)
                .build();
        Tag saved = tagRepository.save(tag);
        log.info("Created tag '{}' (id={}) with DEVICE entity type during registration", key, saved.getId());
        return saved;
    }

    private static boolean hasNewValues(Tag existing, List<String> values) {
        if (isEmpty(values)) {
            return false;
        }
        Set<String> existingValues = valuesOf(existing);
        return !existingValues.containsAll(values);
    }

    private void appendValues(Tag existing, List<String> values) {
        Set<String> merged = valuesOf(existing);
        merged.addAll(values);
        List<String> mergedValues = new ArrayList<>(merged);
        existing.setValues(mergedValues);
        tagRepository.save(existing);
        log.info("Appended values {} to existing tag '{}' during registration", values, existing.getKey());
    }

    private static Set<String> valuesOf(Tag tag) {
        List<String> values = tag.getValues();
        return isEmpty(values) ? new LinkedHashSet<>() : new LinkedHashSet<>(values);
    }
}
