package com.openframe.api.mapper;

import com.openframe.api.dto.CountedGenericConnection;
import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.knowledgebase.CreateArticleCommand;
import com.openframe.api.dto.knowledgebase.CreateArticleInput;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterCriteria;
import com.openframe.api.dto.knowledgebase.KnowledgeBaseFilterInput;
import com.openframe.api.dto.knowledgebase.UpdateArticleCommand;
import com.openframe.api.dto.knowledgebase.UpdateArticleInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.relay.NodeType;
import com.openframe.api.relay.RelayIdCodec;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

import static com.openframe.api.relay.NodeType.KNOWLEDGE_BASE_ITEM;
import static com.openframe.api.relay.NodeType.MACHINE;
import static com.openframe.api.relay.NodeType.ORGANIZATION;
import static com.openframe.api.relay.NodeType.TAG;
import static com.openframe.api.relay.NodeType.TICKET;

@Component
@RequiredArgsConstructor
public class GraphQLKnowledgeBaseMapper {

    private final RelayIdCodec relayIdCodec;

    public KnowledgeBaseFilterCriteria toFilterCriteria(KnowledgeBaseFilterInput input) {
        if (input == null) {
            return KnowledgeBaseFilterCriteria.builder().build();
        }
        String parentGlobalId = input.getParentId();
        List<String> tagGlobalIds = input.getTagIds();
        String parentId = decodeId(parentGlobalId, KNOWLEDGE_BASE_ITEM);
        List<String> tagIds = decodeIds(tagGlobalIds, TAG);
        return KnowledgeBaseFilterCriteria.builder()
                .parentId(parentId)
                .type(input.getType())
                .tagIds(tagIds)
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public CountedGenericConnection<GenericEdge<KnowledgeBaseItem>> toItemConnection(
            CountedGenericQueryResult<KnowledgeBaseItem> result) {
        List<GenericEdge<KnowledgeBaseItem>> edges = result.getItems().stream()
                .map(item -> GenericEdge.<KnowledgeBaseItem>builder()
                        .node(item)
                        .cursor(CursorCodec.encode(item.getId()))
                        .build())
                .collect(Collectors.toList());
        return CountedGenericConnection.<GenericEdge<KnowledgeBaseItem>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .filteredCount(result.getFilteredCount())
                .build();
    }

    public CreateArticleCommand toCreateCommand(CreateArticleInput input) {
        String parentGlobalId = input.getParentId();
        List<String> tagGlobalIds = input.getTagIds();
        List<String> organizationGlobalIds = input.getAssignedOrganizationIds();
        List<String> deviceGlobalIds = input.getAssignedDeviceIds();
        List<String> ticketGlobalIds = input.getAssignedTicketIds();
        List<String> knowledgeArticleGlobalIds = input.getAssignedKnowledgeArticleIds();
        String parentId = decodeId(parentGlobalId, KNOWLEDGE_BASE_ITEM);
        List<String> tagIds = decodeIds(tagGlobalIds, TAG);
        List<String> organizationIds = decodeIds(organizationGlobalIds, ORGANIZATION);
        List<String> deviceIds = decodeIds(deviceGlobalIds, MACHINE);
        List<String> ticketIds = decodeIds(ticketGlobalIds, TICKET);
        List<String> knowledgeArticleIds = decodeIds(knowledgeArticleGlobalIds, KNOWLEDGE_BASE_ITEM);
        return CreateArticleCommand.builder()
                .name(input.getName())
                .parentId(parentId)
                .content(input.getContent())
                .summary(input.getSummary())
                .status(input.getStatus())
                .tagIds(tagIds)
                .assignedOrganizationIds(organizationIds)
                .assignedDeviceIds(deviceIds)
                .assignedTicketIds(ticketIds)
                .assignedKnowledgeArticleIds(knowledgeArticleIds)
                .build();
    }

    public UpdateArticleCommand toUpdateCommand(UpdateArticleInput input) {
        String articleGlobalId = input.getId();
        String parentGlobalId = input.getParentId();
        String articleId = decodeId(articleGlobalId, KNOWLEDGE_BASE_ITEM);
        String parentId = decodeId(parentGlobalId, KNOWLEDGE_BASE_ITEM);
        return UpdateArticleCommand.builder()
                .id(articleId)
                .name(input.getName())
                .parentId(parentId)
                .content(input.getContent())
                .summary(input.getSummary())
                .build();
    }

    private String decodeId(String globalId, NodeType type) {
        return relayIdCodec.decode(globalId, type);
    }

    private List<String> decodeIds(List<String> globalIds, NodeType type) {
        return relayIdCodec.decodeAll(globalIds, type);
    }
}
