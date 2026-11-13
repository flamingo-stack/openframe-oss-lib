package com.openframe.data.document.device;

import com.openframe.data.document.tool.ToolType;

import java.util.EnumSet;
import java.util.Set;

// The tool connections a device must have before it counts as managed; phase 2 of CU-86akb8vvf promotes on it.
public final class RequiredTools {

    public static final Set<ToolType> REQUIRED_TOOL_TYPES = EnumSet.of(ToolType.FLEET_MDM, ToolType.MESHCENTRAL);

    private RequiredTools() {
    }
}
