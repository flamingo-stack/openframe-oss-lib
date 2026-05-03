package com.openframe.api.dto.knowledgebase;

/**
 * Action to apply to children when a folder is being deleted:
 * MOVE — re-parent children to another folder; ARCHIVE — archive recursively.
 */
public enum FolderChildrenAction {
    MOVE,
    ARCHIVE
}
