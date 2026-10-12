package com.openframe.api.service.knowledgebase;

import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.service.AssignmentService;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import com.openframe.data.repository.knowledgebase.KnowledgeBaseItemRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseServiceTest {

    private static final String USER_ID = "user-1";
    private static final String UNKNOWN_TAG_ID = "tag-unknown";

    @Mock private KnowledgeBaseItemRepository repository;
    @Mock private KnowledgeBaseTagService knowledgeBaseTagService;
    @Mock private AssignmentService assignmentService;

    @InjectMocks private KnowledgeBaseService service;

    @Test
    void createArticle_unknownTag_articleNotSaved() {
        // setup
        List<String> tagIds = List.of(UNKNOWN_TAG_ID);
        CreateArticleCommand command = CreateArticleCommand.builder()
                .name("VPN setup")
                .tagIds(tagIds)
                .build();
        NotFoundException tagNotFound = new NotFoundException(ErrorCode.TAG_NOT_FOUND, "Tag not found: " + UNKNOWN_TAG_ID);
        doThrow(tagNotFound).when(knowledgeBaseTagService).requireExistingTags(tagIds);

        // execution
        assertThrows(NotFoundException.class, () -> service.createArticle(USER_ID, command));

        // verifications
        verify(repository, never()).save(any(KnowledgeBaseItem.class));
        verifyNoInteractions(assignmentService);
    }
}
