package com.openframe.data.repository.assignment;

import com.openframe.data.document.assignment.AssignmentItemType;
import com.openframe.data.document.assignment.AssignmentTargetType;
import com.openframe.data.document.assignment.ItemAssignment;
import com.openframe.data.mongo.TenantAwareMongoTemplate;
import org.bson.Document;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The reverse lookup: which items of one type are assigned to a target. The query is shaped for
 * the target_lookup index and reads the item id alone; the tenant is added by the template, as
 * for every query that goes through it.
 */
class ItemAssignmentTargetLookupTest {

    private final TenantAwareMongoTemplate template = mock(TenantAwareMongoTemplate.class);
    private final CustomItemAssignmentRepositoryImpl repo = new CustomItemAssignmentRepositoryImpl(template);

    @Test
    @DisplayName("filters on item type, target type and target id, and projects the item id only")
    void queryIsKeyedByTargetAndItemType() {
        when(template.find(any(Query.class), eq(ItemAssignment.class))).thenReturn(List.of());

        repo.findItemIdsByTarget(AssignmentItemType.KNOWLEDGE_ARTICLE, AssignmentTargetType.ORGANIZATION, "org-1");

        Query query = capturedFind();
        Document filter = query.getQueryObject();
        assertThat(filter.get("itemType")).isEqualTo(AssignmentItemType.KNOWLEDGE_ARTICLE);
        assertThat(filter.get("targetType")).isEqualTo(AssignmentTargetType.ORGANIZATION);
        assertThat(filter.get("targetId")).isEqualTo("org-1");
        assertThat(filter).doesNotContainKey("itemId");
        assertThat(query.getFieldsObject()).containsEntry("itemId", 1);
    }

    @Test
    @DisplayName("answers the item ids of the matching assignments, in the order they were read")
    void returnsTheItemIds() {
        when(template.find(any(Query.class), eq(ItemAssignment.class))).thenReturn(List.of(
                ItemAssignment.builder().itemId("a2").build(),
                ItemAssignment.builder().itemId("a1").build()));

        List<String> ids = repo.findItemIdsByTarget(
                AssignmentItemType.KNOWLEDGE_ARTICLE, AssignmentTargetType.DEVICE, "machine-1");

        assertThat(ids).containsExactly("a2", "a1");
    }

    private Query capturedFind() {
        ArgumentCaptor<Query> captor = ArgumentCaptor.forClass(Query.class);
        verify(template).find(captor.capture(), eq(ItemAssignment.class));
        return captor.getValue();
    }
}
