package com.openframe.api.service;

import org.mockito.Answers;
import com.openframe.audit.AuditAspect;
import com.openframe.audit.AuditExpressions;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.api.dto.device.MachineTag;
import com.openframe.api.service.TagService.DeletedTag;
import com.openframe.audit.AuditCall;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.core.exception.ConflictException;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.tag.TagAssignment;
import com.openframe.data.document.tag.TagEntityType;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.repository.tag.TagAssignmentRepository;
import com.openframe.data.repository.tag.TagRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Stream;

import static com.openframe.data.document.audit.AuditAction.KB_ITEM_TAG_REMOVE;
import static com.openframe.data.document.audit.AuditAction.SCRIPT_TAG_REMOVE;
import static com.openframe.data.document.audit.AuditAction.TAG_DELETE;
import static com.openframe.data.document.audit.AuditAction.TICKET_TAG_REMOVE;
import static com.openframe.data.document.audit.AuditOutcome.SUCCESS;
import static com.openframe.data.document.knowledgebase.KnowledgeBaseItemType.FOLDER;
import static com.openframe.data.document.tag.TagEntityType.DEVICE;
import static com.openframe.data.document.tag.TagEntityType.KNOWLEDGE_ARTICLE;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TagServiceTest {

    private static final Map<String, Object> REMOVED_TAG_DETAILS =
            Map.of("tagIds", List.of("tag-9"), "tagKeys", List.of("urgent"));

    @Mock private TagRepository tagRepository;
    @Mock private TagAssignmentRepository tagAssignmentRepository;
    @Mock(answer = Answers.CALLS_REAL_METHODS) private AuditedMethodRunner auditedMethodRunner;
    @Mock private AuditRecorder auditRecorder;
    @Mock private KnowledgeBaseItemRepository knowledgeBaseItemRepository;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    @Captor private ArgumentCaptor<List<AuditEntry>> removalsCaptor;

    private TagService tagService;

    private final Tag newTag = Tag.builder()
            .id("tag-1")
            .key("NewTag")
            .entityType(KNOWLEDGE_ARTICLE)
            .build();

    @BeforeEach
    void setUp() {
        tagService = new TagService(tagRepository, tagAssignmentRepository, auditedMethodRunner, auditRecorder,
                knowledgeBaseItemRepository);
    }

    @Test
    void createTagReturnsExactMatchWithoutSaving() {
        when(tagRepository.findByKeyAndEntityType("NewTag", KNOWLEDGE_ARTICLE)).thenReturn(newTag);

        Tag result = tagService.createTag("NewTag", KNOWLEDGE_ARTICLE, null, null);

        assertThat(result).isSameAs(newTag);
        verify(tagRepository, never()).save(any());
        verifyNoInteractions(auditedMethodRunner);
    }

    @Test
    void createTagRejectsCaseVariantDuplicate() {
        when(tagRepository.findByKeyAndEntityType("NEWTAG", KNOWLEDGE_ARTICLE)).thenReturn(null);
        when(tagRepository.existsByKeyIgnoreCaseAndEntityType("NEWTAG", KNOWLEDGE_ARTICLE)).thenReturn(true);

        assertThatThrownBy(() -> tagService.createTag("NEWTAG", KNOWLEDGE_ARTICLE, null, null))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("NEWTAG");
        verify(tagRepository, never()).save(any());
    }

    @Test
    void createTagSavesWhenNoCaseVariantExists() {
        when(tagRepository.findByKeyAndEntityType("Printers", KNOWLEDGE_ARTICLE)).thenReturn(null);
        when(tagRepository.existsByKeyIgnoreCaseAndEntityType("Printers", KNOWLEDGE_ARTICLE)).thenReturn(false);
        when(tagRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Tag result = tagService.createTag("Printers", KNOWLEDGE_ARTICLE, "desc", "#FF8800");

        assertThat(result.getKey()).isEqualTo("Printers");
        assertThat(result.getEntityType()).isEqualTo(KNOWLEDGE_ARTICLE);
        verify(tagRepository).save(any());
    }

    @Test
    void createTagPrefersExactMatchOverCaseVariants() {
        Tag legacyDup = Tag.builder().id("tag-2").key("NEWTAG").entityType(KNOWLEDGE_ARTICLE).build();
        when(tagRepository.findByKeyAndEntityType("NEWTAG", KNOWLEDGE_ARTICLE)).thenReturn(legacyDup);

        Tag result = tagService.createTag("NEWTAG", KNOWLEDGE_ARTICLE, null, null);

        assertThat(result).isSameAs(legacyDup);
        verify(tagRepository, never()).existsByKeyIgnoreCaseAndEntityType(any(), any());
        verify(tagRepository, never()).save(any());
    }

    @Test
    void updateTagRejectsRenameCollidingWithCaseVariantOfAnotherTag() {
        Tag other = Tag.builder().id("tag-2").key("Printers").entityType(KNOWLEDGE_ARTICLE).build();
        when(tagRepository.findById("tag-2")).thenReturn(Optional.of(other));
        when(tagRepository.existsByKeyIgnoreCaseAndEntityTypeAndIdNot("NEWTAG", KNOWLEDGE_ARTICLE, "tag-2"))
                .thenReturn(true);

        assertThatThrownBy(() -> tagService.updateTag("tag-2", "NEWTAG", null, null))
                .isInstanceOf(ConflictException.class)
                .hasMessageContaining("NEWTAG");
        verify(tagRepository, never()).save(any());
    }

    @Test
    void updateTagAllowsChangingCaseOfOwnKey() {
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(newTag));
        when(tagRepository.existsByKeyIgnoreCaseAndEntityTypeAndIdNot("NEWTAG", KNOWLEDGE_ARTICLE, "tag-1"))
                .thenReturn(false);
        when(tagRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Tag result = tagService.updateTag("tag-1", "NEWTAG", null, null);

        assertThat(result.getKey()).isEqualTo("NEWTAG");
        verify(tagRepository).save(newTag);
    }

    @Test
    void createTag_caseVariantExists_refusalNamedByTheAskedKey() {
        when(tagRepository.findByKeyAndEntityType("Printers", KNOWLEDGE_ARTICLE)).thenReturn(null);
        when(tagRepository.existsByKeyIgnoreCaseAndEntityType("Printers", KNOWLEDGE_ARTICLE)).thenReturn(true);

        assertThatThrownBy(() -> tagService.createTag("Printers", KNOWLEDGE_ARTICLE, "Office printers", "#FF8800"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tag with key 'Printers' already exists");

        assertThat(capturedCall().targetNameOf().apply(null)).isEqualTo("Printers");
    }

    @Test
    void updateTag_keyTakenByAnotherTag_refusalKeepsTheEntityTypeAndTheAskedValues() {
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(newTag));
        when(tagRepository.existsByKeyIgnoreCaseAndEntityTypeAndIdNot("Printers", KNOWLEDGE_ARTICLE, "tag-1"))
                .thenReturn(true);

        assertThatThrownBy(() -> tagService.updateTag("tag-1", "Printers", "Office printers", "#FF8800"))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Tag with key 'Printers' already exists");

        assertThat(capturedCall().detailsFromResult().apply(null)).containsExactlyInAnyOrderEntriesOf(Map.of(
                "entityType", KNOWLEDGE_ARTICLE, "key", "Printers", "description", "Office printers",
                "color", "#FF8800"));
    }

    @Test
    void updateTag_saved_detailsHoldOnlyTheEntityType() {
        when(tagRepository.findById("tag-1")).thenReturn(Optional.of(newTag));
        when(tagRepository.save(newTag)).thenReturn(newTag);

        Tag updated = tagService.updateTag("tag-1", null, "Office printers", "#FF8800");

        assertThat(capturedCall().detailsFromResult().apply(updated))
                .containsExactlyInAnyOrderEntriesOf(Map.of("entityType", KNOWLEDGE_ARTICLE));
    }

    @Test
    void deleteTag_ticketHeldTheTagTwice_oneRemovalEventPerTicket() {
        givenTagOn(TagEntityType.TICKET, "ticket-1", "ticket-1", "ticket-2");

        tagService.deleteTag("tag-9");

        assertThat(recordedRemovals())
                .extracting(AuditEntry::getAction, AuditEntry::getOutcome, AuditEntry::getTargetType,
                        AuditEntry::getTargetId, AuditEntry::getDetails)
                .containsExactly(
                        tuple(TICKET_TAG_REMOVE, SUCCESS, AuditTargetType.TICKET, "ticket-1", REMOVED_TAG_DETAILS),
                        tuple(TICKET_TAG_REMOVE, SUCCESS, AuditTargetType.TICKET, "ticket-2", REMOVED_TAG_DETAILS));
    }

    @Test
    void deleteTag_ticketHeldTheTagTwice_countsEachTicketOnce() {
        givenTagOn(TagEntityType.TICKET, "ticket-1", "ticket-1", "ticket-2");

        DeletedTag deleted = tagService.deleteTag("tag-9");

        assertThat(deleted).isEqualTo(new DeletedTag(TagEntityType.TICKET, 2));
    }

    @Test
    void deleteTag_deleted_storesTheEntityTypeAndTheRemovedCount() {
        assertThat(deleteCall().detailsFromResult().apply(new DeletedTag(TagEntityType.TICKET, 2)))
                .containsExactlyInAnyOrderEntriesOf(Map.of(
                        "entityType", TagEntityType.TICKET, "removedAssignments", 2));
    }

    @Test
    void deleteTag_refused_storesNoDetails() {
        AuditCall deleteCall = deleteCall();

        assertThat(deleteCall.action()).isEqualTo(TAG_DELETE);
        assertThat(deleteCall.targetIdBeforeCall().get()).isEqualTo("tag-9");
        assertThat(deleteCall.detailsFromResult().apply(null)).isEmpty();
    }

    @Test
    void deleteTag_scriptTag_scriptRemovalEvents() {
        givenTagOn(TagEntityType.SCRIPT, "script-1");

        tagService.deleteTag("tag-9");

        assertThat(recordedRemovals())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetType, AuditEntry::getTargetId)
                .containsExactly(tuple(SCRIPT_TAG_REMOVE, AuditTargetType.SCRIPT, "script-1"));
    }

    @Test
    void deleteTag_knowledgeBaseItemGone_removalEventOnlyForTheRemainingItem() {
        givenTagOn(KNOWLEDGE_ARTICLE, "folder-1", "folder-gone");
        KnowledgeBaseItem folder = KnowledgeBaseItem.builder().id("folder-1").type(FOLDER).build();
        when(knowledgeBaseItemRepository.findAllById(List.of("folder-1", "folder-gone"))).thenReturn(List.of(folder));

        tagService.deleteTag("tag-9");

        assertThat(recordedRemovals())
                .extracting(AuditEntry::getAction, AuditEntry::getTargetType, AuditEntry::getTargetId)
                .containsExactly(tuple(KB_ITEM_TAG_REMOVE, AuditTargetType.KB_FOLDER, "folder-1"));
    }

    @Test
    void deleteTag_deviceTag_noChildEvents() {
        givenTagOn(DEVICE, "m-1");

        tagService.deleteTag("tag-9");

        verify(auditRecorder).recordAll(List.of());
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private AuditCall deleteCall() {
        AuditedMethodRunner annotationRunner = mock(AuditedMethodRunner.class);
        AspectJProxyFactory proxyFactory = new AspectJProxyFactory(tagService);
        proxyFactory.addAspect(new AuditAspect(annotationRunner, new AuditExpressions(new RelayIdCodec())));
        TagService audited = proxyFactory.getProxy();
        audited.deleteTag("tag-9");
        verify(annotationRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private void givenTagOn(TagEntityType entityType, String... entityIds) {
        Tag tag = Tag.builder().id("tag-9").key("urgent").entityType(entityType).build();
        when(tagRepository.findById("tag-9")).thenReturn(Optional.of(tag));
        when(tagAssignmentRepository.findByTagId("tag-9")).thenReturn(Stream.of(entityIds)
                .map(entityId -> TagAssignment.builder().entityId(entityId).build())
                .toList());
    }

    private List<AuditEntry> recordedRemovals() {
        verify(auditRecorder).recordAll(removalsCaptor.capture());
        return removalsCaptor.getValue();
    }

    private static final Instant TAG_CREATED_AT = Instant.parse("2026-01-10T08:00:00Z");
    private static final Instant FIRST_TAGGED_AT = Instant.parse("2026-11-01T10:00:00Z");
    private static final Instant SECOND_TAGGED_AT = Instant.parse("2026-11-02T11:30:00Z");

    private final Tag envTag = Tag.builder()
            .id("tag-env")
            .key("env")
            .description("Environment")
            .color("#112233")
            .values(List.of("prod", "qa"))
            .entityType(DEVICE)
            .createdAt(TAG_CREATED_AT)
            .createdBy("admin")
            .build();

    private final TagAssignment firstDeviceEnv = deviceAssignment("as-1", "m-1", "tag-env", List.of("prod"),
            FIRST_TAGGED_AT, "alice");
    private final TagAssignment secondDeviceEnv = deviceAssignment("as-2", "m-2", "tag-env", List.of("qa"),
            SECOND_TAGGED_AT, "bob");

    @Test
    void getTagAssignmentsForMachines_twoDevicesSharingATag_eachGetsItsOwnAssignmentNode() {
        // setup
        List<String> machineIds = List.of("m-1", "m-2");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE))
                .thenReturn(List.of(firstDeviceEnv, secondDeviceEnv));
        when(tagRepository.findAllById(List.of("tag-env"))).thenReturn(List.of(envTag));

        // execution
        List<List<MachineTag>> result = tagService.getTagAssignmentsForMachines(machineIds);

        // verifications
        assertThat(result).hasSize(2);
        MachineTag first = result.get(0).get(0);
        MachineTag second = result.get(1).get(0);
        assertThat(first.getId()).isEqualTo("as-1");
        assertThat(second.getId()).isEqualTo("as-2");
        assertThat(first.getValues()).containsExactly("prod");
        assertThat(second.getValues()).containsExactly("qa");
        assertThat(first.getTaggedAt()).isEqualTo(FIRST_TAGGED_AT);
        assertThat(second.getTaggedAt()).isEqualTo(SECOND_TAGGED_AT);
        assertThat(first.getTaggedBy()).isEqualTo("alice");
        assertThat(second.getTaggedBy()).isEqualTo("bob");
        assertThat(first.getTag()).isSameAs(envTag);
        assertThat(second.getTag()).isSameAs(envTag);
    }

    @Test
    void getTagAssignmentsForMachines_tagIsTheStoredDefinition_notTheDevicesValues() {
        // setup
        List<String> machineIds = List.of("m-1");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE))
                .thenReturn(List.of(firstDeviceEnv));
        when(tagRepository.findAllById(List.of("tag-env"))).thenReturn(List.of(envTag));

        // execution
        Tag definition = tagService.getTagAssignmentsForMachines(machineIds).get(0).get(0).getTag();

        // verifications
        assertThat(definition.getId()).isEqualTo("tag-env");
        assertThat(definition.getKey()).isEqualTo("env");
        assertThat(definition.getDescription()).isEqualTo("Environment");
        assertThat(definition.getColor()).isEqualTo("#112233");
        assertThat(definition.getEntityType()).isEqualTo(DEVICE);
        assertThat(definition.getCreatedAt()).isEqualTo(TAG_CREATED_AT);
        assertThat(definition.getCreatedBy()).isEqualTo("admin");
        assertThat(definition.getValues()).containsExactly("prod", "qa");
    }

    @Test
    void getTagAssignmentsForMachines_oneQueryPerRepository_resultsInMachineIdOrder() {
        // setup
        Tag siteTag = Tag.builder().id("tag-site").key("site").entityType(DEVICE).build();
        TagAssignment secondDeviceSite = deviceAssignment("as-3", "m-2", "tag-site", List.of("hq"), SECOND_TAGGED_AT,
                "bob");
        List<String> machineIds = List.of("m-3", "m-2", "m-1");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE))
                .thenReturn(List.of(firstDeviceEnv, secondDeviceEnv, secondDeviceSite));
        when(tagRepository.findAllById(anyList())).thenReturn(List.of(envTag, siteTag));

        // execution
        List<List<MachineTag>> result = tagService.getTagAssignmentsForMachines(machineIds);

        // verifications
        assertThat(result).hasSize(3);
        assertThat(result.get(0)).isEmpty();
        assertThat(result.get(1)).extracting(MachineTag::getId).containsExactly("as-2", "as-3");
        assertThat(result.get(2)).extracting(MachineTag::getId).containsExactly("as-1");
        verify(tagAssignmentRepository).findByEntityIdInAndEntityType(machineIds, DEVICE);
        verify(tagRepository).findAllById(anyList());
    }

    @Test
    void getTagAssignmentsForMachines_noAssignments_oneEmptyListPerMachineWithoutATagQuery() {
        // setup
        List<String> machineIds = List.of("m-1", "m-2");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE)).thenReturn(List.of());

        // execution
        List<List<MachineTag>> result = tagService.getTagAssignmentsForMachines(machineIds);

        // verifications
        assertThat(result).containsExactly(List.of(), List.of());
        verify(tagRepository, never()).findAllById(any());
    }

    @Test
    void getTagAssignmentsForMachines_noMachines_emptyWithoutQueries() {
        // execution
        List<List<MachineTag>> result = tagService.getTagAssignmentsForMachines(List.of());

        // verifications
        assertThat(result).isEmpty();
        verify(tagAssignmentRepository, never()).findByEntityIdInAndEntityType(any(), any());
        verify(tagRepository, never()).findAllById(any());
    }

    @Test
    void getTagAssignmentsForMachines_assignmentWhoseTagIsGone_skipped() {
        // setup
        TagAssignment orphan = deviceAssignment("as-9", "m-1", "tag-gone", List.of(), FIRST_TAGGED_AT, "alice");
        List<String> machineIds = List.of("m-1");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE))
                .thenReturn(List.of(firstDeviceEnv, orphan));
        when(tagRepository.findAllById(anyList())).thenReturn(List.of(envTag));

        // execution
        List<List<MachineTag>> result = tagService.getTagAssignmentsForMachines(machineIds);

        // verifications
        assertThat(result.get(0)).extracting(MachineTag::getId).containsExactly("as-1");
    }

    @Test
    void getTagAssignmentsForMachines_assignmentWithoutValues_emptyValues() {
        // setup
        TagAssignment label = deviceAssignment("as-1", "m-1", "tag-env", null, FIRST_TAGGED_AT, "alice");
        List<String> machineIds = List.of("m-1");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE)).thenReturn(List.of(label));
        when(tagRepository.findAllById(List.of("tag-env"))).thenReturn(List.of(envTag));

        // execution
        List<List<MachineTag>> result = tagService.getTagAssignmentsForMachines(machineIds);

        // verifications
        assertThat(result.get(0).get(0).getValues()).isEmpty();
    }

    @Test
    void getTagsForMachines_unchanged_definitionIdWithTheDevicesValuesAndTaggedAt() {
        // setup
        List<String> machineIds = List.of("m-1", "m-2");
        when(tagAssignmentRepository.findByEntityIdInAndEntityType(machineIds, DEVICE))
                .thenReturn(List.of(firstDeviceEnv, secondDeviceEnv));
        when(tagRepository.findAllById(List.of("tag-env"))).thenReturn(List.of(envTag));

        // execution
        List<List<Tag>> result = tagService.getTagsForMachines(machineIds);

        // verifications
        Tag first = result.get(0).get(0);
        Tag second = result.get(1).get(0);
        assertThat(first.getId()).isEqualTo("tag-env");
        assertThat(second.getId()).isEqualTo("tag-env");
        assertThat(first.getKey()).isEqualTo("env");
        assertThat(first.getColor()).isEqualTo("#112233");
        assertThat(first.getValues()).containsExactly("prod");
        assertThat(second.getValues()).containsExactly("qa");
        assertThat(first.getCreatedAt()).isEqualTo(FIRST_TAGGED_AT);
        assertThat(second.getCreatedAt()).isEqualTo(SECOND_TAGGED_AT);
        assertThat(first.getCreatedBy()).isEqualTo("alice");
    }

    @Test
    void getMachineTagsByIds_deviceAssignment_theAssignmentWithItsDefinition() {
        // setup
        when(tagAssignmentRepository.findByIdInAndEntityType(List.of("as-1"), DEVICE))
                .thenReturn(List.of(firstDeviceEnv));
        when(tagRepository.findAllById(List.of("tag-env"))).thenReturn(List.of(envTag));

        // execution
        List<MachineTag> result = tagService.getMachineTagsByIds(List.of("as-1"));

        // verifications
        assertThat(result).hasSize(1);
        MachineTag machineTag = result.get(0);
        assertThat(machineTag.getId()).isEqualTo("as-1");
        assertThat(machineTag.getValues()).containsExactly("prod");
        assertThat(machineTag.getTaggedAt()).isEqualTo(FIRST_TAGGED_AT);
        assertThat(machineTag.getTaggedBy()).isEqualTo("alice");
        assertThat(machineTag.getTag()).isSameAs(envTag);
    }

    @Test
    void getMachineTagsByIds_unknownOrNonDeviceAssignment_emptyWithoutATagQuery() {
        // setup
        when(tagAssignmentRepository.findByIdInAndEntityType(List.of("missing"), DEVICE)).thenReturn(List.of());

        // execution
        List<MachineTag> result = tagService.getMachineTagsByIds(List.of("missing"));

        // verifications
        assertThat(result).isEmpty();
        verify(tagAssignmentRepository).findByIdInAndEntityType(List.of("missing"), DEVICE);
        verify(tagRepository, never()).findAllById(any());
    }

    @Test
    void getMachineTagsByIds_tagDefinitionGone_skipped() {
        // setup
        when(tagAssignmentRepository.findByIdInAndEntityType(List.of("as-1"), DEVICE))
                .thenReturn(List.of(firstDeviceEnv));
        when(tagRepository.findAllById(List.of("tag-env"))).thenReturn(List.of());

        // execution
        List<MachineTag> result = tagService.getMachineTagsByIds(List.of("as-1"));

        // verifications
        assertThat(result).isEmpty();
    }

    private static TagAssignment deviceAssignment(String id, String machineId, String tagId, List<String> values,
                                                  Instant taggedAt, String taggedBy) {
        return TagAssignment.builder()
                .id(id)
                .entityId(machineId)
                .tagId(tagId)
                .entityType(DEVICE)
                .values(values)
                .taggedAt(taggedAt)
                .taggedBy(taggedBy)
                .build();
    }
}
