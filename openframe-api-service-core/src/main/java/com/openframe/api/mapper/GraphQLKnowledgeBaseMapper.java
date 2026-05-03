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
import com.openframe.data.document.knowledgebase.KnowledgeBaseItem;
import graphql.relay.Relay;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class GraphQLKnowledgeBaseMapper {

    private static final Relay RELAY = new Relay();

    public KnowledgeBaseFilterCriteria toFilterCriteria(KnowledgeBaseFilterInput input) {
        if (input == null) {
            return KnowledgeBaseFilterCriteria.builder().build();
        }
        return KnowledgeBaseFilterCriteria.builder()
                .parentId(decodeId(input.getParentId()))
                .type(input.getType())
                .tagIds(decodeIds(input.getTagIds()))
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
        return CreateArticleCommand.builder()
                .name(input.getName())
                .parentId(decodeId(input.getParentId()))
                .content(input.getContent())
                .summary(input.getSummary())
                .status(input.getStatus())
                .tagIds(decodeIds(input.getTagIds()))
                .assignedOrganizationIds(decodeIds(input.getAssignedOrganizationIds()))
                .assignedDeviceIds(decodeIds(input.getAssignedDeviceIds()))
                .assignedTicketIds(decodeIds(input.getAssignedTicketIds()))
                .assignedKnowledgeArticleIds(decodeIds(input.getAssignedKnowledgeArticleIds()))
                .build();
    }

    public UpdateArticleCommand toUpdateCommand(UpdateArticleInput input) {
        return UpdateArticleCommand.builder()
                .id(decodeId(input.getId()))
                .name(input.getName())
                .parentId(decodeId(input.getParentId()))
                .content(input.getContent())
                .summary(input.getSummary())
                .build();
    }

    private String decodeId(String globalId) {
        return globalId != null ? RELAY.fromGlobalId(globalId).getId() : null;
    }

    private List<String> decodeIds(List<String> globalIds) {
        if (globalIds == null) {
            return null;
        }
        return globalIds.stream().map(this::decodeId).toList();
    }
}
