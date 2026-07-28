package com.openframe.test.data.dto.ai;

/**
 * Dialog processing mode. {@link #AI} lets the assistant plan and call tools; {@link #DIRECT} is a
 * pass-through mode. E2E device flows use {@link #AI}.
 */
public enum DialogMode {
    AI,
    DIRECT
}
