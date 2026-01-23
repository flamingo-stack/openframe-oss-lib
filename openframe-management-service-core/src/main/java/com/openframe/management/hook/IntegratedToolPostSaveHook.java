package com.openframe.management.hook;

import com.openframe.data.document.tool.IntegratedTool;

/**
 * Lightweight extension point invoked after an IntegratedTool is saved.
 * Intended for service-specific side-effects without Spring event plumbing.
 */
public interface IntegratedToolPostSaveHook {
    void onToolSaved(String toolId, IntegratedTool tool);
}

