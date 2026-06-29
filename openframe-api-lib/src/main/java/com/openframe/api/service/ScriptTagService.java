package com.openframe.api.service;

import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

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
