package com.openframe.api.dto.knowledgebase;

import com.openframe.data.document.knowledgebase.KnowledgeBaseArticleStatus;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * One save of an article. A null field or list is left as it is; an empty list means none.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateArticleCommand {
    private String id;
    private String name;
    private String parentId;
    private String content;
    private String summary;
    /** Null parentId means "unchanged", so moving to the root level needs saying outright. */
    private boolean moveToRoot;
    private KnowledgeBaseArticleStatus status;
    /** The tags the article has after the save. */
    private List<String> tagIds;
    /** The assignments of each target type the article has after the save. */
    private List<String> assignedOrganizationIds;
    private List<String> assignedDeviceIds;
    private List<String> assignedTicketIds;
    private List<String> assignedKnowledgeArticleIds;
    /** Uploaded temp attachments to attach. */
    private List<String> attachmentTempIds;
    /** Attachments of this article to delete. */
    private List<String> deleteAttachmentIds;
}
