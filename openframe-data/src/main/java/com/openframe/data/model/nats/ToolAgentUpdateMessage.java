package com.openframe.data.model.nats;

import lombok.Data;

@Data
public class ToolAgentUpdateMessage {
  
    private String toolAgentId;
    private String version;
    
}
