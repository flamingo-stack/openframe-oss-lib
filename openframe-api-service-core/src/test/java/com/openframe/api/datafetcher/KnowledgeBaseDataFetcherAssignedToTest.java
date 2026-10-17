package com.openframe.api.datafetcher;

import com.openframe.api.dto.assignment.AssignmentTarget;
import com.openframe.api.dto.assignment.AssignmentTargetInput;
import com.openframe.api.mapper.GraphQLKnowledgeBaseMapper;
import com.openframe.api.service.knowledgebase.KnowledgeBaseAttachmentService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTagService;
import com.openframe.api.service.knowledgebase.KnowledgeBaseTempAttachmentService;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.tag.Tag;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** knowledgeBaseTags(assignedTo): the facet of an assigned set, routed past the folder and archive branches. */
class KnowledgeBaseDataFetcherAssignedToTest {

    private static final String RAW_MACHINE_ID = "machine-1";

    private final RelayIdCodec codec = new RelayIdCodec();
    private final KnowledgeBaseService knowledgeBaseService = mock(KnowledgeBaseService.class);
    private final KnowledgeBaseTagService knowledgeBaseTagService = mock(KnowledgeBaseTagService.class);
    private final KnowledgeBaseDataFetcher fetcher = new KnowledgeBaseDataFetcher(
            knowledgeBaseService,
            knowledgeBaseTagService,
            mock(KnowledgeBaseTempAttachmentService.class),
            mock(KnowledgeBaseAttachmentService.class),
            new GraphQLKnowledgeBaseMapper(codec),
            codec);

    @Test
    @DisplayName("with assignedTo, the tags of the articles assigned to that target, the id decoded by its type")
    void assignedToReturnsTheTagsOfTheAssignedArticles() {
        List<Tag> tags = List.of(Tag.builder().id("t1").build());
        AssignmentTarget target = new AssignmentTarget(AssignmentTargetType.DEVICE, RAW_MACHINE_ID);
        when(knowledgeBaseService.getTagsOfAssignedArticles(target)).thenReturn(tags);
        AssignmentTargetInput input = AssignmentTargetInput.builder()
                .targetType(AssignmentTargetType.DEVICE)
                .targetId(codec.encode(NodeType.MACHINE, RAW_MACHINE_ID))
                .build();

        List<Tag> result = fetcher.knowledgeBaseTags(null, null, input);

        assertThat(result).isSameAs(tags);
        verify(knowledgeBaseTagService, never()).getAllTags(false);
        verify(knowledgeBaseService, never()).getTagsInSubtree(any());
    }

    @Test
    @DisplayName("assignedTo takes precedence over a folderId sent beside it")
    void assignedToWinsOverFolderId() {
        AssignmentTargetInput input = AssignmentTargetInput.builder()
                .targetType(AssignmentTargetType.DEVICE)
                .targetId(codec.encode(NodeType.MACHINE, RAW_MACHINE_ID))
                .build();

        fetcher.knowledgeBaseTags(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, "folder-1"), true, input);

        verify(knowledgeBaseService).getTagsOfAssignedArticles(
                new AssignmentTarget(AssignmentTargetType.DEVICE, RAW_MACHINE_ID));
        verify(knowledgeBaseService, never()).getTagsInSubtree(any());
        verify(knowledgeBaseTagService, never()).getAllTags(true);
    }

    @Test
    @DisplayName("without assignedTo the query behaves as before")
    void withoutAssignedToNothingChanges() {
        List<Tag> tags = List.of(Tag.builder().id("t1").build());
        when(knowledgeBaseTagService.getAllTags(false)).thenReturn(tags);

        List<Tag> result = fetcher.knowledgeBaseTags(null, null, null);

        assertThat(result).isSameAs(tags);
        verify(knowledgeBaseService, never()).getTagsOfAssignedArticles(any());
    }

    @Test
    @DisplayName("without assignedTo a folderId still reads that folder's subtree")
    void withoutAssignedToFolderIdStillWins() {
        List<Tag> tags = List.of(Tag.builder().id("t1").build());
        when(knowledgeBaseService.getTagsInSubtree("folder-1")).thenReturn(tags);

        List<Tag> result = fetcher.knowledgeBaseTags(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, "folder-1"), null, null);

        assertThat(result).isSameAs(tags);
        verify(knowledgeBaseTagService, never()).getAllTags(any(Boolean.class));
    }
}
