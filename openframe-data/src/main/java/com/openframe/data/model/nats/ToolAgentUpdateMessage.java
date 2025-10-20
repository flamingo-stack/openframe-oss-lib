package com.openframe.data.model.nats;

import com.openframe.data.document.toolagent.SessionType;
import lombok.Data;

@Data
public class ToolAgentUpdateMessage {
  
    private String toolAgentId;
    private String version;
    private SessionType sessionType;
    
}
