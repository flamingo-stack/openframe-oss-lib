package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import com.openframe.data.document.knowledgebase.KnowledgeBaseItemType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class KnowledgeBaseFilterCriteria {
    private String parentId;
    private KnowledgeBaseItemType type;
    private List<String> tagIds;
    private List<KnowledgeBaseArticleStatus> statuses;
    /** Null lets the listing choose: one level, or the subtree under a search or a tag filter. */
    private KnowledgeBaseScope scope;
}
