package com.openframe.api.datafetcher;

import com.openframe.api.mapper.GraphQLAssignmentMapper;
import com.openframe.graphql.relay.InvalidRelayIdException;
import com.openframe.graphql.relay.NodeType;
import com.openframe.graphql.relay.RelayIdCodec;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.params.provider.Arguments.arguments;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AssignmentDataFetcherRelayIdTest {

    private static final String RAW_ITEM_ID = "item-1";
    private static final String RAW_TARGET_ID = "target-1";
    private static final String RAW_ASSIGNMENT_ID = "assignment-1";

    @Mock private AssignmentService assignmentService;
    @Mock private GraphQLAssignmentMapper mapper;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private AssignmentDataFetcher dataFetcher;

    private final RelayIdCodec codec = new RelayIdCodec();

    @ParameterizedTest
    @MethodSource("assignableItemTypes")
    void assignedItemCounts_assignableItemGlobalId_countsByRawId(NodeType itemType) {
        // setup
        String itemId = codec.encode(itemType, RAW_ITEM_ID);

        // execution
        dataFetcher.assignedItemCounts(itemId);

        // verifications
        verify(assignmentService).countAssignmentsByTargetType(RAW_ITEM_ID);
    }

    @Test
    void assignedItemCounts_tagGlobalId_throwsInvalidRelayId() {
        // setup
        String itemId = codec.encode(NodeType.TAG, RAW_ITEM_ID);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.assignedItemCounts(itemId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Ticket or KnowledgeBaseItem or Insight id, got Tag");
        verify(assignmentService, never()).countAssignmentsByTargetType(anyString());
    }

    @ParameterizedTest
    @MethodSource("assignableItemTypes")
    void unassignAllByType_assignableItemGlobalId_unassignsByRawId(NodeType itemType) {
        // setup
        String itemId = codec.encode(itemType, RAW_ITEM_ID);

        // execution
        dataFetcher.unassignAllByType(itemId, AssignmentTargetType.DEVICE);

        // verifications
        verify(assignmentService).unassignAllByType(RAW_ITEM_ID, AssignmentTargetType.DEVICE);
    }

    @ParameterizedTest
    @MethodSource("itemNodeTypes")
    void assignItem_itemIdOfTheItemType_assignsRawItemId(AssignmentItemType itemType, NodeType itemNodeType) {
        // setup
        String itemId = codec.encode(itemNodeType, RAW_ITEM_ID);
        String targetId = codec.encode(NodeType.ORGANIZATION, RAW_TARGET_ID);

        // execution
        dataFetcher.assignItem(itemId, itemType, AssignmentTargetType.ORGANIZATION, targetId);

        // verifications
        verify(assignmentService).assignItem(RAW_ITEM_ID, itemType, AssignmentTargetType.ORGANIZATION, RAW_TARGET_ID);
    }

    @Test
    void assignItem_itemIdOfAnotherItemType_throwsInvalidRelayId() {
        // setup
        String itemId = codec.encode(NodeType.KNOWLEDGE_BASE_ITEM, RAW_ITEM_ID);
        String targetId = codec.encode(NodeType.ORGANIZATION, RAW_TARGET_ID);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.assignItem(itemId, AssignmentItemType.TICKET, AssignmentTargetType.ORGANIZATION, targetId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Ticket id, got KnowledgeBaseItem");
    }

    @ParameterizedTest
    @MethodSource("targetNodeTypes")
    void assignItem_targetIdOfTheTargetType_assignsRawTargetId(AssignmentTargetType targetType, NodeType targetNodeType) {
        // setup
        String itemId = codec.encode(NodeType.TICKET, RAW_ITEM_ID);
        String targetId = codec.encode(targetNodeType, RAW_TARGET_ID);

        // execution
        dataFetcher.assignItem(itemId, AssignmentItemType.TICKET, targetType, targetId);

        // verifications
        verify(assignmentService).assignItem(RAW_ITEM_ID, AssignmentItemType.TICKET, targetType, RAW_TARGET_ID);
    }

    @Test
    void assignItem_targetIdOfAnotherTargetType_throwsInvalidRelayId() {
        // setup
        String itemId = codec.encode(NodeType.TICKET, RAW_ITEM_ID);
        String targetId = codec.encode(NodeType.ORGANIZATION, RAW_TARGET_ID);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.assignItem(itemId, AssignmentItemType.TICKET, AssignmentTargetType.DEVICE, targetId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Machine id, got Organization");
    }

    @ParameterizedTest
    @MethodSource("targetNodeTypes")
    void unassignItem_targetIdOfTheTargetType_unassignsRawIds(AssignmentTargetType targetType, NodeType targetNodeType) {
        // setup
        String itemId = codec.encode(NodeType.INSIGHT, RAW_ITEM_ID);
        String targetId = codec.encode(targetNodeType, RAW_TARGET_ID);

        // execution
        dataFetcher.unassignItem(itemId, targetType, targetId);

        // verifications
        verify(assignmentService).unassignItem(RAW_ITEM_ID, targetType, RAW_TARGET_ID);
    }

    @Test
    void assignItem_rawIds_passedThroughUnchanged() {
        // execution
        dataFetcher.assignItem(RAW_ITEM_ID, AssignmentItemType.INSIGHT, AssignmentTargetType.TICKET, RAW_TARGET_ID);

        // verifications
        verify(assignmentService).assignItem(RAW_ITEM_ID, AssignmentItemType.INSIGHT, AssignmentTargetType.TICKET, RAW_TARGET_ID);
    }

    private static Stream<Arguments> assignableItemTypes() {
        return Stream.of(
                arguments(NodeType.TICKET),
                arguments(NodeType.KNOWLEDGE_BASE_ITEM),
                arguments(NodeType.INSIGHT));
    }

    private static Stream<Arguments> itemNodeTypes() {
        return Stream.of(
                arguments(AssignmentItemType.TICKET, NodeType.TICKET),
                arguments(AssignmentItemType.KNOWLEDGE_ARTICLE, NodeType.KNOWLEDGE_BASE_ITEM),
                arguments(AssignmentItemType.INSIGHT, NodeType.INSIGHT));
    }

    private static Stream<Arguments> targetNodeTypes() {
        return Stream.of(
                arguments(AssignmentTargetType.ORGANIZATION, NodeType.ORGANIZATION),
                arguments(AssignmentTargetType.DEVICE, NodeType.MACHINE),
                arguments(AssignmentTargetType.TICKET, NodeType.TICKET),
                arguments(AssignmentTargetType.KNOWLEDGE_ARTICLE, NodeType.KNOWLEDGE_BASE_ITEM));
    }
}
