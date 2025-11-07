package com.openframe.data.model.nats;

import com.openframe.data.document.toolagent.SessionType;
import lombok.Data;

import java.util.List;

@Data
public class ToolAgentUpdateMessage {
  
    private String toolAgentId;
    private String version;
    private List<String> links;
    private SessionType sessionType;
    
}
