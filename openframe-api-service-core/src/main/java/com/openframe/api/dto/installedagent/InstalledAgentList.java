package com.openframe.api.dto.installedagent;

import com.openframe.data.document.installedagents.InstalledAgent;
import lombok.Data;

import java.util.List;

@Data
public class InstalledAgentList {
    private List<InstalledAgent> agents;
}

