package com.openframe.api.service.rmm.script;

import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

import static com.openframe.data.document.audit.AuditAction.SCRIPT_TAG_ADD;
import static com.openframe.data.document.audit.AuditAction.SCRIPT_TAG_REMOVE;

/**
 * Manages the many-to-many link between {@code Script}s and real {@code Tag}
 * entities through {@link TagAssignment} rows (entity type {@code SCRIPT}).
 *
 * <p>Mirrors {@code KnowledgeBaseTagService}. Tags are NOT stored on the script
 * document — they live in {@code tag_assignments}, so reads here join the two
 * collections and writes replace the assignment set.
 */
@Service
@Slf4j
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScriptTagService {

    private static final TagEntityType ENTITY_TYPE = TagEntityType.SCRIPT;

    private final TagRepository tagRepository;
    private final TagAssignmentRepository tagAssignmentRepository;
    private final ScriptRepository scriptRepository;
    private final AuditRecorder auditRecorder;

    /**
     * Tags for each script id, aligned with the input order — the batched shape
     * the GraphQL {@code Script.tags} DataLoader needs.
     */
    public List<List<Tag>> getTagsByScriptIds(List<String> scriptIds) {
        if (scriptIds == null || scriptIds.isEmpty()) {
            return List.of();
        }
        List<TagAssignment> assignments =
                tagAssignmentRepository.findByEntityIdInAndEntityType(scriptIds, ENTITY_TYPE);

        Set<String> tagIds = assignments.stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        Map<String, Tag> tagMap = tagRepository.findAllById(tagIds).stream()
                .collect(Collectors.toMap(Tag::getId, t -> t));

        Map<String, List<Tag>> byScript = assignments.stream()
                .collect(Collectors.groupingBy(
                        TagAssignment::getEntityId,
                        Collectors.mapping(a -> tagMap.get(a.getTagId()),
                                Collectors.filtering(Objects::nonNull, Collectors.toList()))));

        return scriptIds.stream()
                .map(id -> byScript.getOrDefault(id, List.of()))
                .toList();
    }

    /**
     * Tag keys assigned to scripts filtered by archive state. When {@code archived}
     * is true, returns tags assigned to archived scripts; otherwise to active scripts.
     * Mirrors {@code KnowledgeBaseTagService.getAllTags}.
     */
    public List<Tag> getAllTags(boolean archived) {
        List<TagAssignment> assignments = tagAssignmentRepository.findByEntityType(ENTITY_TYPE);
        if (assignments.isEmpty()) {
            return List.of();
        }

        Set<String> scriptIds = assignments.stream()
                .map(TagAssignment::getEntityId)
                .collect(Collectors.toSet());

        Set<String> matchingScriptIds = scriptRepository.findAllById(scriptIds).stream()
                .filter(script -> archived
                        ? script.getStatus() == ScriptStatus.ARCHIVED
                        : script.getStatus() != ScriptStatus.ARCHIVED)
                .map(Script::getId)
                .collect(Collectors.toSet());

        Set<String> tagIds = assignments.stream()
                .filter(a -> matchingScriptIds.contains(a.getEntityId()))
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());

        return tagIds.isEmpty() ? List.of() : tagRepository.findAllById(tagIds);
    }

    /**
     * Replace ALL tag assignments for a script (PUT semantics) — used by create
     * and update. A null/empty {@code tagIds} simply clears them.
     */
    @Transactional
    public void replaceTags(String scriptId, List<String> tagIds) {
        Set<String> before = tagAssignmentRepository.findByEntityIdAndEntityType(scriptId, ENTITY_TYPE).stream()
                .map(TagAssignment::getTagId)
                .collect(Collectors.toSet());
        Set<String> after = tagIds == null ? Set.of() : new HashSet<>(tagIds);
        applyTags(scriptId, tagIds);
        recordTagChanges(scriptId, before, after);
    }

    private void recordTagChanges(String scriptId, Set<String> before, Set<String> after) {
        List<String> added = after.stream().filter(tagId -> !before.contains(tagId)).toList();
        List<String> removed = before.stream().filter(tagId -> !after.contains(tagId)).toList();
        if (added.isEmpty() && removed.isEmpty()) {
            return;
        }
        List<String> changedTagIds = Stream.of(added, removed).flatMap(Collection::stream).toList();
        Map<String, String> keys = tagRepository.findAllById(changedTagIds).stream()
                .collect(Collectors.toMap(Tag::getId, Tag::getKey));
        List<AuditEntry> entries = Stream.concat(
                        added.stream().map(tagId -> tagEntry(SCRIPT_TAG_ADD, scriptId, tagId, keys.get(tagId))),
                        removed.stream().map(tagId -> tagEntry(SCRIPT_TAG_REMOVE, scriptId, tagId, keys.get(tagId))))
                .toList();
        auditRecorder.recordAll(entries);
    }

    private static AuditEntry tagEntry(AuditAction action, String scriptId, String tagId, String tagKey) {
        Map<String, Object> details = new HashMap<>(Map.of("tagId", tagId));
        if (tagKey != null) {
            details.put("tagKey", tagKey);
        }
        return AuditEntry.builder()
                .action(action)
                .outcome(AuditOutcome.SUCCESS)
                .targetId(scriptId)
                .details(details)
                .build();
    }

    private void applyTags(String scriptId, List<String> tagIds) {
        tagAssignmentRepository.deleteByEntityIdAndEntityType(scriptId, ENTITY_TYPE);
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        tagIds.stream().distinct().forEach(tagId ->
                tagAssignmentRepository.save(TagAssignment.builder()
                        .entityId(scriptId)
                        .tagId(tagId)
                        .entityType(ENTITY_TYPE)
                        .build()));
        log.info("Replaced tags for script {} with {} tag(s)", scriptId, tagIds.stream().distinct().count());
    }
}
