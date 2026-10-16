package com.openframe.api.relay;

import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.graphql.relay.NodeType;

import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/** Which Relay node type an assignment's item or target id is encoded with, per assignment type. */
public final class AssignmentNodeTypes {

    private static final Map<AssignmentItemType, NodeType> ITEM_NODE_TYPES = itemNodeTypes();
    private static final Map<AssignmentTargetType, NodeType> TARGET_NODE_TYPES = targetNodeTypes();

    private AssignmentNodeTypes() {
    }

    public static NodeType forItem(AssignmentItemType itemType) {
        return ITEM_NODE_TYPES.get(itemType);
    }

    public static NodeType forTarget(AssignmentTargetType targetType) {
        return TARGET_NODE_TYPES.get(targetType);
    }

    private static Map<AssignmentItemType, NodeType> itemNodeTypes() {
        Map<AssignmentItemType, NodeType> types = new EnumMap<>(AssignmentItemType.class);
        types.put(AssignmentItemType.TICKET, NodeType.TICKET);
        types.put(AssignmentItemType.KNOWLEDGE_ARTICLE, NodeType.KNOWLEDGE_BASE_ITEM);
        types.put(AssignmentItemType.INSIGHT, NodeType.INSIGHT);
        return Collections.unmodifiableMap(types);
    }

    private static Map<AssignmentTargetType, NodeType> targetNodeTypes() {
        Map<AssignmentTargetType, NodeType> types = new EnumMap<>(AssignmentTargetType.class);
        types.put(AssignmentTargetType.ORGANIZATION, NodeType.ORGANIZATION);
        types.put(AssignmentTargetType.DEVICE, NodeType.MACHINE);
        types.put(AssignmentTargetType.TICKET, NodeType.TICKET);
        types.put(AssignmentTargetType.KNOWLEDGE_ARTICLE, NodeType.KNOWLEDGE_BASE_ITEM);
        return Collections.unmodifiableMap(types);
    }
}
