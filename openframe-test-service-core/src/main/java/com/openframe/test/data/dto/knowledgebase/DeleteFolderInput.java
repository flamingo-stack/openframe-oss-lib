package com.openframe.test.data.dto.knowledgebase;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DeleteFolderInput {
    private String id;
    private FolderChildrenAction childrenAction;
    private String moveTargetFolderId;
}
