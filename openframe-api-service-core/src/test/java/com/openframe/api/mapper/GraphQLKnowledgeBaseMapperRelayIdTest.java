package com.openframe.api.mapper;

import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.CreateArticleInput;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterInput;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.knowledgebase.UpdateArticleInput;
import com.openframe.api.relay.InvalidRelayIdException;
import com.openframe.api.relay.NodeType;
import com.openframe.api.relay.RelayIdCodec;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class GraphQLKnowledgeBaseMapperRelayIdTest {

    private static final String RAW_PARENT_ID = "folder-1";
    private static final String RAW_ARTICLE_ID = "article-1";
    private static final String RAW_TAG_ID = "tag-1";
    private static final String RAW_ORGANIZATION_ID = "org-1";
    private static final String RAW_MACHINE_ID = "machine-1";
    private static final String RAW_TICKET_ID = "ticket-1";
    private static final String RAW_LINKED_ARTICLE_ID = "article-2";

    private final RelayIdCodec codec = new RelayIdCodec();
    private final GraphQLKnowledgeBaseMapper mapper = new GraphQLKnowledgeBaseMapper(codec);

    @Test
    void toCreateCommand_globalIds_eachDecodedWithItsType() {
        // setup
        CreateArticleInput input = CreateArticleInput.builder()
                .parentId(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, RAW_PARENT_ID))
                .tagIds(List.of(codec.encode(NodeType.TAG, RAW_TAG_ID)))
                .assignedOrganizationIds(List.of(codec.encode(NodeType.ORGANIZATION, RAW_ORGANIZATION_ID)))
                .assignedDeviceIds(List.of(codec.encode(NodeType.MACHINE, RAW_MACHINE_ID)))
                .assignedTicketIds(List.of(codec.encode(NodeType.TICKET, RAW_TICKET_ID)))
                .assignedKnowledgeArticleIds(List.of(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, RAW_LINKED_ARTICLE_ID)))
                .build();

        // execution
        CreateArticleCommand command = mapper.toCreateCommand(input);

        // verifications
        assertThat(command)
                .returns(RAW_PARENT_ID, CreateArticleCommand::getParentId)
                .returns(List.of(RAW_TAG_ID), CreateArticleCommand::getTagIds)
                .returns(List.of(RAW_ORGANIZATION_ID), CreateArticleCommand::getAssignedOrganizationIds)
                .returns(List.of(RAW_MACHINE_ID), CreateArticleCommand::getAssignedDeviceIds)
                .returns(List.of(RAW_TICKET_ID), CreateArticleCommand::getAssignedTicketIds)
                .returns(List.of(RAW_LINKED_ARTICLE_ID), CreateArticleCommand::getAssignedKnowledgeArticleIds);
    }

    @Test
    void toCreateCommand_absentIds_staysNull() {
        // setup
        CreateArticleInput input = CreateArticleInput.builder().build();

        // execution
        CreateArticleCommand command = mapper.toCreateCommand(input);

        // verifications
        assertThat(command)
                .returns(null, CreateArticleCommand::getParentId)
                .returns(null, CreateArticleCommand::getTagIds)
                .returns(null, CreateArticleCommand::getAssignedDeviceIds);
    }

    @Test
    void toCreateCommand_organizationIdAmongDeviceIds_throwsInvalidRelayId() {
        // setup
        String organizationId = codec.encode(NodeType.ORGANIZATION, RAW_ORGANIZATION_ID);
        CreateArticleInput input = CreateArticleInput.builder()
                .assignedDeviceIds(List.of(organizationId))
                .build();

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> mapper.toCreateCommand(input));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Machine id, got Organization");
    }

    @Test
    void toUpdateCommand_globalIds_decodedAsKnowledgeBaseItems() {
        // setup
        UpdateArticleInput input = UpdateArticleInput.builder()
                .id(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, RAW_ARTICLE_ID))
                .parentId(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, RAW_PARENT_ID))
                .build();

        // execution
        UpdateArticleCommand command = mapper.toUpdateCommand(input);

        // verifications
        assertThat(command)
                .returns(RAW_ARTICLE_ID, UpdateArticleCommand::getId)
                .returns(RAW_PARENT_ID, UpdateArticleCommand::getParentId);
    }

    @Test
    void toFilterCriteria_globalIds_decodedWithTheirTypes() {
        // setup
        KnowledgeBaseFilterInput input = KnowledgeBaseFilterInput.builder()
                .parentId(codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, RAW_PARENT_ID))
                .tagIds(List.of(codec.encode(NodeType.TAG, RAW_TAG_ID)))
                .build();

        // execution
        KnowledgeBaseFilterCriteria criteria = mapper.toFilterCriteria(input);

        // verifications
        assertThat(criteria)
                .returns(RAW_PARENT_ID, KnowledgeBaseFilterCriteria::getParentId)
                .returns(List.of(RAW_TAG_ID), KnowledgeBaseFilterCriteria::getTagIds);
    }
}
